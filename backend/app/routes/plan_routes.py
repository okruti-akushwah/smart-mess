from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app import models, schemas
from app.database import get_db
from app.routes.owner_meal_routes import require_owner
from uuid import uuid4

router = APIRouter(prefix="/owner", tags=["subscriptions"])


@router.get("/customers")
def customers(db: Session = Depends(get_db), owner=Depends(require_owner)):
    users = db.query(models.User).filter(models.User.role == "customer").all()
    return [{"id": u.id, "name": u.name, "phone": u.phone} for u in users]


@router.post("/plans", status_code=201)
def assign_plan(req: schemas.PlanCreate, db: Session = Depends(get_db), owner=Depends(require_owner)):
    user = db.get(models.User, req.user_id)
    if not user or user.role != "customer":
        raise HTTPException(404, "Customer not found")
    if req.end_date < req.start_date:
        raise HTTPException(422, "End date must be on or after start date")
    db.query(models.User).filter_by(id=user.id).with_for_update().first()
    overlaps = db.query(models.MealPlan).filter(
        models.MealPlan.user_id == req.user_id,
        models.MealPlan.status.in_(["active", "pending_payment", "pending_acceptance"]),
        models.MealPlan.start_date <= req.end_date,
        models.MealPlan.end_date >= req.start_date,
    ).all()
    replaceable = []
    for existing in overlaps:
        has_receipts = db.query(models.PaymentRecord).filter_by(plan_id=existing.id).first()
        has_submission = db.query(models.PaymentSubmission).join(models.IssuedBill,
            models.IssuedBill.id == models.PaymentSubmission.bill_id).filter(
                models.IssuedBill.plan_id == existing.id, models.PaymentSubmission.status == "pending").first()
        if existing.status == "pending_payment" and existing.offer_id is None and existing.meal_id is None and not has_receipts and not has_submission:
            replaceable.append(existing)
        else:
            raise HTTPException(400, "Customer already has an active plan or a payment in progress for these dates. Choose dates after it ends.")
    for existing in replaceable:
        existing.status = "cancelled"
    plan = models.MealPlan(**req.model_dump(), plan_type="Owner-assigned subscription", status="pending_payment",
        purchase_key=str(uuid4()), original_start_date=req.start_date, original_end_date=req.end_date)
    db.add(plan)
    db.flush()
    db.add(models.IssuedBill(user_id=user.id, plan_id=plan.id, base_amount=plan.price,
        deductions=0, extras_total=0, final_amount=plan.price))
    db.commit()
    db.refresh(plan)
    return {"id": plan.id, "status": plan.status, "message": "Subscription assigned awaiting payment. It activates only after full payment is confirmed by the owner."}

@router.post("/customers", response_model=schemas.CustomerCreated, status_code=201)
def create_customer(req: schemas.CustomerCreate, db: Session = Depends(get_db), owner=Depends(require_owner)):
    from app.auth import hash_password
    if req.role != "customer":
        raise HTTPException(422, "Only customer accounts can be created here")
    if db.query(models.User).filter_by(phone=req.phone).first():
        raise HTTPException(409, "Phone number already registered")
    user = models.User(name=req.name.strip(), phone=req.phone, password_hash=hash_password(req.password), role="customer")
    if not user.name:
        raise HTTPException(422, "Customer name is required")
    db.add(user)
    from sqlalchemy.exc import IntegrityError
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Phone number already registered")
    db.refresh(user)
    from app.credential_email import send_credentials
    status = send_credentials(req.email, user.name, user.phone, req.password) if req.email else "not_requested"
    return {"id": user.id, "name": user.name, "phone": user.phone, "role": user.role, "email_status": status}

