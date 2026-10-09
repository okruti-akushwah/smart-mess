from decimal import Decimal
from datetime import date
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app import models
from app.database import get_db
from app.routes.discovery_routes import customer
from app.routes.owner_meal_routes import require_owner
from app.routes.billing_routes import get_current_bill
from app.auth import get_current_user
from app.payment_uploads import PAYMENT_IMAGE_DIR
from fastapi.responses import HTMLResponse
from html import escape
from datetime import timezone, timedelta

router = APIRouter(tags=["direct payments"])


@router.get("/payments/receipts/{receipt_id}")
def download_receipt(receipt_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    receipt = db.get(models.PaymentRecord, receipt_id)
    plan = db.get(models.MealPlan, receipt.plan_id) if receipt else None
    if not plan or (user.role != "owner" and plan.user_id != user.id):
        raise HTTPException(404, "Receipt not found")
    customer_user = db.get(models.User, plan.user_id)
    profile = db.query(models.MessProfile).first()
    owner = db.get(models.User, plan.owner_id)
    mess_name = profile.name if profile and profile.name else owner.name
    received = receipt.created_at.replace(tzinfo=timezone.utc).astimezone(timezone(timedelta(hours=5, minutes=30)))
    fields = [
        ("Receipt number", f"SM-{receipt.id:06d}"),
        ("Payment confirmed", received.strftime("%d %b %Y, %I:%M %p IST")),
        ("Customer", customer_user.name),
        ("Customer phone", customer_user.phone),
        ("Purchase", plan.plan_type),
        ("Purchase type", "Single meal" if plan.meal_id else "Subscription"),
        ("Meal date" if plan.meal_id else "Subscription dates", str(plan.start_date) if plan.meal_id else f"{plan.start_date} to {plan.end_date}"),
        ("Payment reference / note", receipt.reference or "Payment recorded by owner"),
    ]
    rows = "".join(f"<tr><th>{escape(label)}</th><td>{escape(str(value))}</td></tr>" for label, value in fields)
    html = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Payment receipt SM-{receipt.id:06d}</title><style>
    *{{box-sizing:border-box}}body{{margin:0;background:#f6f7f3;color:#17221c;font:16px Arial,sans-serif;line-height:1.5}}main{{max-width:760px;margin:40px auto;padding:40px;background:white;border:1px solid #dce5d8;border-radius:20px}}h1{{margin:8px 0 24px}}.brand{{color:#176c46;font-weight:bold}}.paid{{display:inline-block;padding:6px 14px;border-radius:20px;background:#edf6ee;color:#176c46;font-weight:bold}}table{{width:100%;border-collapse:collapse;margin:24px 0}}th,td{{text-align:left;vertical-align:top;border-bottom:1px solid #e3e8e0;padding:14px 0;overflow-wrap:anywhere}}th{{width:38%;padding-right:20px;color:#65756c;font-weight:normal}}.total{{display:flex;justify-content:space-between;gap:20px;border-top:2px solid #176c46;padding:20px 0;font-size:24px;font-weight:bold}}.note{{color:#65756c;font-size:13px}}@media(max-width:600px){{main{{margin:12px;padding:24px}}}}@media print{{body{{background:white}}main{{margin:0;max-width:none;border:0;padding:20px}}.print-note{{display:none}}}}
    </style></head><body><main><div class="brand">{escape(mess_name)}</div><h1>Payment receipt</h1><span class="paid">Confirmed payment</span><table>{rows}</table><div class="total"><span>Amount received</span><span>₹{receipt.amount:.2f}</span></div><p class="note">This receipt acknowledges this confirmed payment only. It is not a tax invoice.</p><p class="note print-note">To print or save as PDF, open this receipt in your browser and choose Print → Save as PDF.</p></main></body></html>'''
    return HTMLResponse(html, headers={"Content-Disposition": f'attachment; filename="smart-mess-receipt-{receipt.id}.html"', "Cache-Control": "no-store"})


def settings_output(item):
    return {"payee_name": item.payee_name or "" if item else "", "upi_id": item.upi_id or "" if item else "",
            "instructions": item.instructions or "" if item else "Pay cash directly to your mess owner.",
            "qr_url": item.qr_url if item else None, "cash_available": True}


@router.get("/payments/methods")
def payment_methods(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return settings_output(db.query(models.PaymentSettings).first())


class SettingsInput(BaseModel):
    payee_name: str = Field(default="", max_length=100)
    upi_id: str = Field(default="", max_length=100)
    instructions: str = Field(default="", max_length=500)


def settings_row(db):
    item = db.query(models.PaymentSettings).first()
    if not item:
        item = models.PaymentSettings()
        db.add(item)
    return item


@router.put("/owner/payment-methods")
def save_methods(body: SettingsInput, db: Session = Depends(get_db), owner=Depends(require_owner)):
    item = settings_row(db)
    item.payee_name = body.payee_name.strip()
    item.upi_id = body.upi_id.strip()
    item.instructions = body.instructions.strip()
    db.commit()
    return {"message": "Payment details saved", **settings_output(item)}


@router.post("/owner/payment-qr")
async def upload_qr(file: UploadFile = File(...), db: Session = Depends(get_db), owner=Depends(require_owner)):
    content = await file.read(5 * 1024 * 1024 + 1)
    await file.close()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(413, "Choose an image smaller than 5 MB")
    if content.startswith(b"\x89PNG\r\n\x1a\n") and len(content) >= 45 and content[12:16] == b"IHDR" and content.endswith(b"IEND\xaeB`\x82"):
        extension = ".png"
    elif content.startswith(b"\xff\xd8\xff") and content.endswith(b"\xff\xd9") and len(content) >= 20:
        extension = ".jpg"
    else:
        raise HTTPException(422, "Upload a PNG or JPEG image of your payment QR")
    # Ignore supplied filenames and use immutable URLs so browsers show replacements immediately.
    filename = uuid4().hex + extension
    item = settings_row(db)
    old_url = item.qr_url
    path = PAYMENT_IMAGE_DIR / filename
    path.write_bytes(content)
    item.qr_url = f"/payment-images/{filename}"
    try:
        db.commit()
    except Exception:
        db.rollback()
        path.unlink(missing_ok=True)
        raise
    if old_url:
        old_file = PAYMENT_IMAGE_DIR / old_url.rsplit("/", 1)[-1]
        if old_file.parent == PAYMENT_IMAGE_DIR:
            old_file.unlink(missing_ok=True)
    return {"message": "Payment QR uploaded. Customers can now view it in Bills.", **settings_output(item)}


@router.delete("/owner/payment-qr")
def remove_qr(db: Session = Depends(get_db), owner=Depends(require_owner)):
    item = settings_row(db)
    old_url = item.qr_url
    item.qr_url = None
    db.commit()
    if old_url:
        path = PAYMENT_IMAGE_DIR / old_url.rsplit("/", 1)[-1]
        if path.parent == PAYMENT_IMAGE_DIR:
            path.unlink(missing_ok=True)
    return {"message": "QR removed. Customers can still pay cash.", **settings_output(item)}


@router.get("/owner/payments")
def account_balances(db: Session = Depends(get_db), owner=Depends(require_owner)):
    users = db.query(models.User).filter_by(role="customer").all()
    result = []
    for user in users:
        try:
            bill = get_current_bill(db, user)
            issued = db.query(models.IssuedBill).filter_by(plan_id=bill["plan_id"]).order_by(models.IssuedBill.id.desc()).first()
            generated = bool(issued and all(getattr(issued, field) == Decimal(str(bill[field])) for field in ("base_amount", "deductions", "extras_total", "final_amount")))
            result.append({"user_id":user.id,"name":user.name,"phone":user.phone,**bill,
                           "bill_generated": generated, "issued_bill_id": issued.id if issued else None})
        except HTTPException as exc:
            if exc.status_code != 404:
                raise
    # Checkouts already have a bill, including future plans and individual meals.
    from app.routes.workflow_routes import bill_output
    listed = {row["plan_id"] for row in result}
    for plan in db.query(models.MealPlan).filter(models.MealPlan.purchase_key.is_not(None), models.MealPlan.status != "cancelled").all():
        if plan.id in listed:
            continue
        issued = db.query(models.IssuedBill).filter_by(plan_id=plan.id).order_by(models.IssuedBill.id.desc()).first()
        user = db.get(models.User, plan.user_id)
        result.append({**bill_output(issued, db), "purchase_name": plan.plan_type, "user_id": user.id, "name": user.name, "phone": user.phone,
                       "bill_generated": True, "issued_bill_id": issued.id})
    return result


class PaymentInput(BaseModel):
    plan_id: int
    amount: Decimal = Field(gt=0, le=100000, max_digits=12, decimal_places=2)
    reference: str = Field(default="", max_length=200)
    receipt_key: UUID


@router.post("/owner/payments", status_code=201)
def record_payment(body: PaymentInput, db: Session = Depends(get_db), owner=Depends(require_owner)):
    plan = db.query(models.MealPlan).filter_by(id=body.plan_id).with_for_update().first()
    if not plan or (not plan.purchase_key and (not (plan.start_date <= date.today() <= plan.end_date) or plan.status != "active")) or plan.status == "cancelled":
        raise HTTPException(400, "Payments can be recorded for current active subscriptions")
    existing = db.query(models.PaymentRecord).filter_by(receipt_key=str(body.receipt_key)).first()
    if existing:
        if existing.plan_id != body.plan_id or existing.amount != body.amount or existing.reference != body.reference.strip():
            raise HTTPException(409, "Receipt key was already used for a different payment")
        return {"message":"Payment already recorded", "id":existing.id}
    if plan.purchase_key and (plan.meal_id or plan.status == "pending_payment" or plan.start_date > date.today() or plan.end_date < date.today()):
        from app.routes.workflow_routes import bill_output
        issued = db.query(models.IssuedBill).filter_by(plan_id=plan.id).order_by(models.IssuedBill.id.desc()).first()
        bill = bill_output(issued, db)
    else:
        bill = get_current_bill(db, db.get(models.User, plan.user_id))
    if body.amount > Decimal(str(bill["balance_due"])):
        raise HTTPException(400, "Payment exceeds the current balance due")
    receipt = models.PaymentRecord(plan_id=plan.id, amount=body.amount, reference=body.reference.strip(), receipt_key=str(body.receipt_key))
    db.add(receipt)
    db.flush()
    from app.routes.purchase_routes import activate_paid_purchase
    activate_paid_purchase(plan, db)
    db.commit()
    db.refresh(receipt)
    return {"message":"Payment received from customer recorded", "id":receipt.id}


@router.get("/payments/history")
def receipts(db: Session = Depends(get_db), user=Depends(customer)):
    records = db.query(models.PaymentRecord, models.MealPlan).join(models.MealPlan, models.MealPlan.id == models.PaymentRecord.plan_id).filter(models.MealPlan.user_id == user.id).order_by(models.PaymentRecord.id.desc()).all()
    return [{"id":r.id,"amount":float(r.amount),"reference":r.reference,"created_at":r.created_at,
             "start_date":p.start_date,"end_date":p.end_date} for r,p in records]
