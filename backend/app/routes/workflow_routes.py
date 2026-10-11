from pathlib import Path
from typing import Literal
from decimal import Decimal
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app import models
from app.database import get_db
from app.auth import get_current_user
from app.routes.owner_meal_routes import require_owner
from app.routes.discovery_routes import customer
from app.routes.billing_routes import get_current_bill

router = APIRouter(tags=["bill workflow"])
PROOF_DIR = Path(__file__).resolve().parents[2] / "payment_proofs"
PROOF_DIR.mkdir(exist_ok=True)


def bill_output(bill, db):
    plan = db.get(models.MealPlan, bill.plan_id)
    paid = sum((p.amount for p in db.query(models.PaymentRecord).filter_by(plan_id=plan.id)), Decimal("0"))
    return {"id": bill.id, "plan_id": plan.id, "created_at": bill.created_at, "seen": bill.seen,
            "start_date": plan.start_date, "end_date": plan.end_date, "name": plan.plan_type,
            "kind": "meal" if plan.meal_id else "subscription", "status": plan.status,
            "base_amount": float(bill.base_amount), "deductions": float(bill.deductions),
            "extras_total": float(bill.extras_total), "final_amount": float(bill.final_amount),
            "amount_paid": float(paid), "balance_due": float(max(bill.final_amount-paid, Decimal("0")))}


@router.post("/owner/bills/{plan_id}", status_code=201)
def issue_bill(plan_id: int, db: Session = Depends(get_db), owner=Depends(require_owner)):
    plan = db.get(models.MealPlan, plan_id)
    if not plan:
        raise HTTPException(404, "Subscription not found")
    totals = get_current_bill(db, db.get(models.User, plan.user_id))
    if totals["plan_id"] != plan_id:
        raise HTTPException(400, "Choose the current subscription")
    previous = db.query(models.IssuedBill).filter_by(plan_id=plan_id).order_by(models.IssuedBill.id.desc()).first()
    fields = ("base_amount", "deductions", "extras_total", "final_amount")
    if previous and all(getattr(previous, f) == Decimal(str(totals[f])) for f in fields):
        return bill_output(previous, db)
    bill = models.IssuedBill(user_id=plan.user_id, plan_id=plan.id, **{f: totals[f] for f in fields})
    db.add(bill)
    db.commit()
    db.refresh(bill)
    return bill_output(bill, db)


@router.get("/bills/issued")
def issued(db: Session = Depends(get_db), user=Depends(customer)):
    return [bill_output(b, db) for b in db.query(models.IssuedBill).filter_by(user_id=user.id).order_by(models.IssuedBill.id.desc())]


@router.post("/bills/issued/{bill_id}/seen")
def seen(bill_id: int, db: Session = Depends(get_db), user=Depends(customer)):
    bill = db.query(models.IssuedBill).filter_by(id=bill_id, user_id=user.id).first()
    if not bill:
        raise HTTPException(404, "Bill not found")
    bill.seen = True
    db.commit()
    return {"message": "Notification read"}


def submission_output(s, db):
    user = db.get(models.User, s.user_id)
    bill = db.get(models.IssuedBill, s.bill_id)
    plan = db.get(models.MealPlan, bill.plan_id)
    return {"id": s.id, "bill_id": s.bill_id, "name": user.name, "amount": float(s.amount),
            "purchase_name": plan.plan_type, "kind": "meal" if plan.meal_id else "subscription",
            "method": s.method, "reference": s.reference, "status": s.status,
            "has_image": bool(s.image_name), "created_at": s.created_at}


@router.post("/payments/submissions", status_code=201)
async def submit_payment(bill_id: int = Form(...), amount: Decimal = Form(...),
                         method: Literal["upi"] = Form(...), reference: str = Form(""),
                         file: UploadFile | None = File(None), db: Session = Depends(get_db), user=Depends(customer)):
    bill = db.query(models.IssuedBill).filter_by(id=bill_id, user_id=user.id).first()
    if not bill:
        raise HTTPException(404, "Bill not found")
    if db.get(models.MealPlan, bill.plan_id).status == "cancelled":
        raise HTTPException(409, "This checkout was cancelled")
    if not amount.is_finite() or amount <= 0 or amount > Decimal(str(bill_output(bill, db)["balance_due"])) or amount.as_tuple().exponent < -2:
        raise HTTPException(422, "Enter a positive amount up to the bill balance with at most two decimals")
    if len(reference) > 200:
        raise HTTPException(422, "Reference must be at most 200 characters")
    if db.query(models.PaymentSubmission).filter_by(bill_id=bill_id, status="pending").first():
        raise HTTPException(409, "A payment for this bill is already awaiting owner review")
    filename = None
    if method == "upi":
        if not file:
            raise HTTPException(422, "Upload your payment screenshot")
        content = await file.read(5 * 1024 * 1024 + 1)
        await file.close()
        if len(content) > 5 * 1024 * 1024:
            raise HTTPException(413, "Screenshot must be smaller than 5 MB")
        if content.startswith(b"\x89PNG\r\n\x1a\n") and content.endswith(b"IEND\xaeB`\x82"):
            ext = ".png"
        elif content.startswith(b"\xff\xd8\xff") and content.endswith(b"\xff\xd9"):
            ext = ".jpg"
        else:
            raise HTTPException(422, "Upload a PNG or JPEG screenshot")
        filename = uuid4().hex + ext
        (PROOF_DIR / filename).write_bytes(content)
    submission = models.PaymentSubmission(user_id=user.id, bill_id=bill_id, amount=amount, method=method, reference=reference.strip(), image_name=filename)
    db.add(submission)
    try:
        db.commit()
    except Exception:
        db.rollback()
        if filename:
            (PROOF_DIR / filename).unlink(missing_ok=True)
        raise
    return {"message": "Payment submitted. Awaiting owner confirmation."}


@router.get("/payments/submissions")
def submissions(db: Session = Depends(get_db), user=Depends(get_current_user)):
    query = db.query(models.PaymentSubmission)
    if user.role != "owner":
        query = query.filter_by(user_id=user.id)
    return [submission_output(s, db) for s in query.order_by(models.PaymentSubmission.id.desc())]


@router.get("/payments/submissions/{submission_id}/image")
def proof(submission_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    s = db.get(models.PaymentSubmission, submission_id)
    if not s or (user.role != "owner" and s.user_id != user.id) or not s.image_name:
        raise HTTPException(404, "Screenshot not found")
    return FileResponse(PROOF_DIR / s.image_name)


class Review(BaseModel):
    status: Literal["approved", "rejected"]


@router.patch("/owner/payment-submissions/{submission_id}")
def review(submission_id: int, body: Review, db: Session = Depends(get_db), owner=Depends(require_owner)):
    s = db.query(models.PaymentSubmission).filter_by(id=submission_id).with_for_update().first()
    if not s:
        raise HTTPException(404, "Payment not found")
    if s.status != "pending":
        if s.status == body.status:
            return {"message": "Already reviewed"}
        raise HTTPException(409, "Payment already reviewed")
    bill = db.get(models.IssuedBill, s.bill_id)
    plan = db.query(models.MealPlan).filter_by(id=bill.plan_id).with_for_update().first()
    if body.status == "approved":
        # An issued bill remains payable after its subscription expires.
        latest = db.query(models.IssuedBill).filter_by(plan_id=plan.id).order_by(models.IssuedBill.id.desc()).first()
        balance = bill_output(latest, db)["balance_due"]
        try:
            live = get_current_bill(db, db.get(models.User, s.user_id))
            if live["plan_id"] == plan.id:
                balance = min(balance, live["balance_due"])
        except HTTPException as exc:
            if exc.status_code != 404:
                raise
        if s.amount > Decimal(str(balance)):
            raise HTTPException(400, "Payment exceeds remaining balance. Reject and ask customer to resubmit.")
        db.add(models.PaymentRecord(plan_id=plan.id, amount=s.amount, reference=f"{s.method}: {s.reference}", receipt_key=f"submission-{s.id}"))
        db.flush()
        from app.routes.purchase_routes import activate_paid_purchase
        activate_paid_purchase(plan, db)
    s.status = body.status
    db.commit()
    return {"message": "Payment " + body.status}
