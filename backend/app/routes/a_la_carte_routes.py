"""Owner catalogue and transactional meal extras, isolated by the selected mess."""
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Literal
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app import models
from app.database import get_db
from app.meal_coverage import covers
from app.subscription_extensions import lock_customer
from app.routes.discovery_routes import customer
from app.routes.owner_meal_routes import require_owner
from app.a_la_carte import line_output

router = APIRouter(tags=['a la carte'])
MealType = Literal['breakfast', 'lunch', 'dinner']


class ItemInput(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    name_hi: str = Field(default='', max_length=100)
    description: str = Field(default='', max_length=500)
    description_hi: str = Field(default='', max_length=500)
    price: Decimal = Field(gt=0, le=10000, max_digits=7, decimal_places=2)
    available: bool = True
    meal_types: list[MealType] = Field(min_length=1, max_length=3)

    @field_validator('name', 'name_hi', 'description', 'description_hi')
    @classmethod
    def trim(cls, value, info):
        value = value.strip()
        if info.field_name == 'name' and not value:
            raise ValueError('Enter an item name')
        return value

    @field_validator('meal_types')
    @classmethod
    def distinct(cls, value):
        if len(value) != len(set(value)):
            raise ValueError('Choose each meal type only once')
        return value


def item_output(item):
    return {'id':item.id, **{field:getattr(item, field) for field in ItemInput.model_fields if field != 'price'}, 'price':float(item.price)}


@router.get('/owner/a-la-carte/items')
def owner_items(db: Session = Depends(get_db), owner=Depends(require_owner)):
    return [item_output(item) for item in db.query(models.ALaCarteItem).order_by(models.ALaCarteItem.id).all()]


@router.post('/owner/a-la-carte/items', status_code=201)
def create_item(body: ItemInput, db: Session = Depends(get_db), owner=Depends(require_owner)):
    item = models.ALaCarteItem(**body.model_dump())
    db.add(item); db.commit(); db.refresh(item)
    return item_output(item)


@router.put('/owner/a-la-carte/items/{item_id}')
def update_item(item_id: int, body: ItemInput, db: Session = Depends(get_db), owner=Depends(require_owner)):
    item = db.query(models.ALaCarteItem).filter_by(id=item_id).with_for_update().first()
    if not item:
        raise HTTPException(404, 'Item not found')
    for field,value in body.model_dump().items():
        setattr(item, field, value)
    db.commit()
    return item_output(item)


def eligible_booking(db, user, meal_id, plan_id=None):
    meal = db.get(models.Meal, meal_id)
    if not meal:
        raise HTTPException(404, 'Meal not found')
    now = datetime.now(timezone.utc)
    if meal.date < now.astimezone(timezone(timedelta(hours=5,minutes=30))).date() or (meal.cutoff_time and meal.cutoff_time.replace(tzinfo=timezone.utc) <= now):
        raise HTTPException(409, 'Ordering for this meal has closed')
    address = db.get(models.DeliveryProfile, user.id)
    if not address or len(address.address.strip()) < 10:
        raise HTTPException(409, 'Add your delivery address before ordering extras')
    candidates = db.query(models.MealPlan).filter_by(user_id=user.id,status='active').order_by(models.MealPlan.id).all()
    plan = next((p for p in candidates if (plan_id is None or p.id == plan_id) and covers(p,meal) and (p.meal_id is None or p.accepted)),None)
    if not plan:
        raise HTTPException(409, 'An active subscription or accepted single-meal booking is required')
    order = db.query(models.MealOrder).filter_by(user_id=user.id,meal_id=meal_id).first()
    pause = db.query(models.MealDatePause).filter_by(user_id=user.id,date=meal.date,active=True).first()
    if (order and order.status == 'skipped') or pause:
        raise HTTPException(409, 'Undo the meal pause or skip before ordering extras')
    delivery = db.query(models.DeliveryUpdate).filter_by(user_id=user.id,meal_id=meal_id).first()
    if delivery and delivery.status in ('out_for_delivery','delivered'):
        raise HTTPException(409, 'This meal has been dispatched. Meal changes are closed.')
    return meal,plan


@router.get('/customer/a-la-carte/items')
def customer_items(meal_id: int, db: Session = Depends(get_db), user=Depends(customer)):
    meal,plan = eligible_booking(db,user,meal_id)
    return {'plan_id':plan.id, 'items':[item_output(item) for item in db.query(models.ALaCarteItem).filter_by(available=True).order_by(models.ALaCarteItem.id).all() if meal.meal_type in item.meal_types]}


class OrderLineInput(BaseModel):
    item_id: int
    quantity: int = Field(ge=1,le=100,strict=True)
    expected_unit_price: Decimal = Field(gt=0,le=10000,max_digits=7,decimal_places=2)


class OrderInput(BaseModel):
    meal_id: int
    plan_id: int
    purchase_key: UUID
    lines: list[OrderLineInput] = Field(min_length=1,max_length=30)

    @field_validator('lines')
    @classmethod
    def distinct(cls,value):
        if len(value) != len({line.item_id for line in value}):
            raise ValueError('Choose each item only once')
        return value


def order_output(order,db,owner=False):
    meal = db.get(models.Meal,order.meal_id)
    latest = db.query(models.IssuedBill).filter_by(plan_id=order.plan_id).order_by(models.IssuedBill.id.desc()).first()
    data = {'id':order.id,'plan_id':order.plan_id,'meal_id':order.meal_id,'date':meal.date,'meal_type':meal.meal_type,
            'created_at':order.created_at,'status':order.status,'total':float(order.total),
            'bill_id':latest.id if latest else None,'lines':[line_output(line,order) for line in order.lines]}
    if owner:
        person = db.get(models.User,order.user_id)
        address = db.get(models.DeliveryProfile,order.user_id)
        data.update(customer_name=person.name, customer_phone=person.phone, address=address.address if address else '', instructions=address.instructions if address else '')
    return data


@router.post('/customer/a-la-carte/orders',status_code=201)
def create_order(body: OrderInput,db: Session = Depends(get_db),user=Depends(customer)):
    from app.date_pauses import lock_mess
    lock_mess(db)
    lock_customer(db,user.id)
    previous = db.query(models.ALaCarteOrder).filter_by(purchase_key=str(body.purchase_key)).first()
    if previous:
        old = sorted((line.item_id,line.quantity,line.unit_price) for line in previous.lines)
        new = sorted((line.item_id,line.quantity,line.expected_unit_price) for line in body.lines)
        if previous.user_id != user.id or previous.plan_id != body.plan_id or previous.meal_id != body.meal_id or old != new:
            raise HTTPException(409,'Order key already used for a different order')
        return order_output(previous,db)
    meal,plan = eligible_booking(db,user,body.meal_id,body.plan_id)
    # Hold catalogue row locks until the bill is committed so price edits cannot race an order.
    items = {item.id:item for item in db.query(models.ALaCarteItem).filter(models.ALaCarteItem.id.in_([line.item_id for line in body.lines])).order_by(models.ALaCarteItem.id).populate_existing().with_for_update().all()}
    total = Decimal('0')
    for line in body.lines:
        item = items.get(line.item_id)
        if not item:
            raise HTTPException(404,'Item not found')
        if not item.available or meal.meal_type not in item.meal_types or item.price != line.expected_unit_price:
            raise HTTPException(409,'An item price or availability changed. Refresh and review your order.')
        total += item.price * line.quantity
    # Do not commit an order that crossed the cutoff while waiting for catalogue locks.
    eligible_booking(db,user,body.meal_id,body.plan_id)
    order = models.ALaCarteOrder(user_id=user.id,plan_id=plan.id,meal_id=meal.id,purchase_key=str(body.purchase_key),total=total)
    db.add(order)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, 'Order key already used. Open your extra orders before retrying.') from None
    for line in body.lines:
        item = items[line.item_id]
        db.add(models.ALaCarteOrderLine(order_id=order.id,item_id=item.id,quantity=line.quantity,
            unit_price=item.price,name=item.name,name_hi=item.name_hi))
    db.flush()
    from app.routes.billing_routes import get_current_bill
    totals = get_current_bill(db,user,plan.id)
    db.add(models.IssuedBill(user_id=user.id,plan_id=plan.id,
        **{field:totals[field] for field in ('base_amount','deductions','extras_total','final_amount','extra_lines')}))
    db.commit()
    return order_output(order,db)


@router.get('/customer/a-la-carte/orders')
def customer_orders(meal_id: int | None = None,db: Session = Depends(get_db),user=Depends(customer)):
    query = db.query(models.ALaCarteOrder).filter_by(user_id=user.id)
    if meal_id is not None:
        query = query.filter_by(meal_id=meal_id)
    return [order_output(order,db) for order in query.order_by(models.ALaCarteOrder.id.desc()).all()]


@router.get('/owner/a-la-carte/orders')
def owner_orders(meal_id: int | None = None,db: Session = Depends(get_db),owner=Depends(require_owner)):
    query = db.query(models.ALaCarteOrder)
    if meal_id is not None:
        query = query.filter_by(meal_id=meal_id)
    return [order_output(order,db,owner=True) for order in query.order_by(models.ALaCarteOrder.id.desc()).all()]
