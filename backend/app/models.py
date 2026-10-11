from sqlalchemy import Column, Integer, String, Date, ForeignKey, Numeric, Boolean, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    phone = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="customer")  # "customer" or "owner"
    mess_owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    language_pref = Column(String, default="en")
    created_at = Column(DateTime, default=datetime.utcnow)


class MealPlan(Base):
    __tablename__ = "meal_plans"
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    offer_id = Column(Integer, ForeignKey("plan_offers.id"), nullable=True)
    meal_id = Column(Integer, ForeignKey("meals.id"), nullable=True)
    purchase_key = Column(String(36), nullable=True, unique=True)
    plan_type = Column(String)  # monthly / weekly

    # Total subscription amount
    price = Column(Numeric(10, 2), nullable=False)

    # Amount deducted when customer skips one meal
    meal_price = Column(Numeric(10, 2), default=50)

    start_date = Column(Date)
    end_date = Column(Date)

    original_start_date = Column(Date, nullable=True)
    original_end_date = Column(Date, nullable=True)
    skip_count = Column(Integer, nullable=False, default=0, server_default="0")
    accepted = Column(Boolean, nullable=False, default=False, server_default="false")
    status = Column(String, default="active")

    user = relationship("User", foreign_keys=[user_id])

class Meal(Base):
    __tablename__ = "meals"
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False)
    meal_type = Column(String)  # "lunch" or "dinner"
    menu_description = Column(String)
    image_url = Column(String, nullable=True)
    single_price = Column(Numeric(10, 2), nullable=True)
    is_complimentary = Column(Boolean, default=True)
    cutoff_time = Column(DateTime)


class MealOrder(Base):
    __tablename__ = "meal_orders"
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    meal_id = Column(Integer, ForeignKey("meals.id"))
    status = Column(String, default="confirmed")  # "confirmed", "skipped", "guest_added"
    extension_plan_id = Column(Integer, ForeignKey("meal_plans.id"), nullable=True)
    extra_items = Column(String, nullable=True)
    extra_cost = Column(Numeric(10, 2), default=0)
    guest_count = Column(Integer, nullable=False, default=1)

    user = relationship("User", foreign_keys=[user_id])
    meal = relationship("Meal")


class Bill(Base):
    __tablename__ = "bills"
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    month = Column(String)  # e.g. "2026-10"
    base_amount = Column(Numeric(10, 2))
    deductions = Column(Numeric(10, 2), default=0)
    extras_total = Column(Numeric(10, 2), default=0)
    final_amount = Column(Numeric(10, 2))
    payment_status = Column(String, default="pending")

    user = relationship("User", foreign_keys=[user_id])


class Feedback(Base):
    __tablename__ = "feedback"
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    meal_id = Column(Integer, ForeignKey("meals.id"))
    rating = Column(Integer)  # 1-5
    comment = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class PlanOffer(Base):
    __tablename__ = "plan_offers"
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    duration_days = Column(Integer, nullable=False)
    price = Column(Numeric(10, 2), nullable=False)
    meal_price = Column(Numeric(10, 2), nullable=False)
    description = Column(String, nullable=False)
    active = Column(Boolean, default=True)


class PlanRequest(Base):
    __tablename__ = "plan_requests"
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    offer_id = Column(Integer, ForeignKey("plan_offers.id"), nullable=False)
    start_date = Column(Date, nullable=False)
    status = Column(String, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)
    user = relationship("User", foreign_keys=[user_id])
    offer = relationship("PlanOffer")


class DeliveryProfile(Base):
    __tablename__ = "delivery_profiles"
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    address = Column(String, nullable=False)
    instructions = Column(String, default="")


class DeliveryUpdate(Base):
    __tablename__ = "delivery_updates"
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    meal_id = Column(Integer, ForeignKey("meals.id"), nullable=False)
    status = Column(String, default="preparing")
    updated_at = Column(DateTime, default=datetime.utcnow)


class PaymentRecord(Base):
    __tablename__ = "payment_records"
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    id = Column(Integer, primary_key=True)
    plan_id = Column(Integer, ForeignKey("meal_plans.id"), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    reference = Column(String, default="")
    receipt_key = Column(String, unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class PaymentSettings(Base):
    __tablename__ = "payment_settings"
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    id = Column(Integer, primary_key=True)
    payee_name = Column(String, default="")
    upi_id = Column(String, default="")
    instructions = Column(String, default="Pay cash directly to your mess owner.")
    qr_url = Column(String, nullable=True)

class IssuedBill(Base):
    __tablename__ = "issued_bills"
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    plan_id = Column(Integer, ForeignKey("meal_plans.id"), nullable=False)
    base_amount = Column(Numeric(10, 2), nullable=False)
    deductions = Column(Numeric(10, 2), nullable=False)
    extras_total = Column(Numeric(10, 2), nullable=False)
    final_amount = Column(Numeric(10, 2), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    seen = Column(Boolean, default=False)


class PaymentSubmission(Base):
    __tablename__ = "payment_submissions"
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    bill_id = Column(Integer, ForeignKey("issued_bills.id"), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    method = Column(String, nullable=False)
    reference = Column(String, default="")
    image_name = Column(String, nullable=True)
    status = Column(String, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)

class JoinInvite(Base):
    __tablename__ = "join_invites"
    owner_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    token = Column(String, unique=True, nullable=False)


class JoinRequest(Base):
    __tablename__ = "join_requests"
    id = Column(Integer, primary_key=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    status = Column(String, default="pending", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class MessProfile(Base):
    __tablename__ = "mess_profiles"
    owner_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    name_hi = Column(String, default="")
    about_hi = Column(String, default="")
    preparation_hi = Column(String, default="")
    address_hi = Column(String, default="")
    name = Column(String, default="")
    address = Column(String, default="")
    contact = Column(String, default="")
    hours = Column(String, default="")
    about = Column(String, default="")
    preparation = Column(String, default="")

class JoinSelection(Base):
    __tablename__ = "join_selections"
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    request_id = Column(Integer, ForeignKey("join_requests.id"), primary_key=True)
    offer_id = Column(Integer, ForeignKey("plan_offers.id"), nullable=False)
    start_date = Column(Date, nullable=False)


class MealTiming(Base):
    __tablename__ = "meal_timings"
    owner_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    meal_type = Column(String, primary_key=True)
    from_time = Column(String, nullable=False)
    to_time = Column(String, nullable=False)


class MenuItem(Base):
    __tablename__ = "menu_items"
    owner_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    key = Column(String, primary_key=True)
    name = Column(String, nullable=False)


class GuestPricing(Base):
    __tablename__ = "guest_pricing"
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    id = Column(Integer, primary_key=True)
    price = Column(Numeric(10, 2), nullable=False, default=50)


class MessInstallation(Base):
    __tablename__ = "mess_installation"
    id = Column(Integer, primary_key=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)


class SignupChallenge(Base):
    __tablename__ = "signup_challenges"
    id = Column(String(64), primary_key=True)
    phone = Column(String(10), nullable=False, index=True)
    scope = Column(String(150), nullable=False)
    mode = Column(String(16), nullable=False)
    code_hash = Column(String(64), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    attempts = Column(Integer, nullable=False, default=0)
    consumed = Column(Boolean, nullable=False, default=False)
    verified = Column(Boolean, nullable=False, default=False)

class SignupOtpPhone(Base):
    __tablename__ = "signup_otp_phones"
    phone = Column(String(10), primary_key=True)


class MealDatePause(Base):
    __tablename__ = "meal_date_pauses"
    __table_args__ = (UniqueConstraint("user_id", "date", name="uq_meal_date_pause_user_date"),)
    id = Column(Integer, primary_key=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    plan_id = Column(Integer, ForeignKey("meal_plans.id"), nullable=False)
    date = Column(Date, nullable=False, index=True)
    active = Column(Boolean, nullable=False, default=True, server_default="true")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
