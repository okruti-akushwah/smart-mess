from sqlalchemy import Column, Integer, String, Date, ForeignKey, Numeric, Boolean, DateTime, UniqueConstraint, JSON, Index, text, Float
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
    meal_types = Column(JSON, nullable=False, default=lambda: ['breakfast', 'lunch', 'dinner'], server_default='["breakfast", "lunch", "dinner"]')
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
    __table_args__ = (Index("uq_meals_owner_date_type", "owner_id", "date", "meal_type", unique=True),)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False)
    meal_type = Column(String)  # "lunch" or "dinner"
    menu_description = Column(String)
    image_url = Column(String, nullable=True)
    single_price = Column(Numeric(10, 2), nullable=True)
    is_complimentary = Column(Boolean, default=True)
    cutoff_time = Column(DateTime)
    weekly_menu_entry_id = Column(Integer, ForeignKey("weekly_menu_entries.id", ondelete="SET NULL"), nullable=True)
    weekly_menu_override = Column(Boolean, nullable=False, default=False, server_default="false")


class WeeklyMenuEntry(Base):
    __tablename__ = "weekly_menu_entries"
    __table_args__ = (UniqueConstraint("owner_id", "weekday", "meal_type", name="uq_weekly_menu_owner_day_type"),)

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    weekday = Column(Integer, nullable=False)  # Monday = 0
    meal_type = Column(String, nullable=False)
    menu_description = Column(String, nullable=False)
    image_url = Column(String, nullable=True)
    single_price = Column(Numeric(10, 2), nullable=True)
    is_complimentary = Column(Boolean, nullable=False, default=True, server_default="true")
    cutoff_time = Column(String(5), nullable=True)  # UTC HH:MM, matching Meal.cutoff_time


class MealOrder(Base):
    __tablename__ = "meal_orders"
    __table_args__ = (Index("uq_meal_orders_user_meal", "user_id", "meal_id", unique=True),)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    meal_id = Column(Integer, ForeignKey("meals.id"))
    status = Column(String, default="confirmed")  # "confirmed", "skipped", "guest_added"
    extension_plan_id = Column(Integer, ForeignKey("meal_plans.id"), nullable=True)
    extension_credit = Column(Boolean, nullable=False, default=True, server_default="true")
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
    __table_args__ = (Index("uq_feedback_user_meal", "user_id", "meal_id", unique=True),)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    meal_id = Column(Integer, ForeignKey("meals.id"))
    rating = Column(Integer)  # 1-5
    comment = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class PlanOffer(Base):
    meal_types = Column(JSON, nullable=False, default=lambda: ['breakfast', 'lunch', 'dinner'], server_default='["breakfast", "lunch", "dinner"]')
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
    __table_args__ = (Index("uq_delivery_updates_user_meal", "user_id", "meal_id", unique=True),)
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
    extra_lines = Column(JSON, nullable=False, default=list, server_default='[]')
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
    __table_args__ = (Index("uq_payment_submissions_pending_bill", "bill_id", unique=True,
                             sqlite_where=text("status = 'pending'"),
                             postgresql_where=text("status = 'pending'")),)
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
    __table_args__ = (Index("uq_join_requests_owner_user", "owner_id", "user_id", unique=True),)
    id = Column(Integer, primary_key=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String, default="pending", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class ALaCarteItem(Base):
    __tablename__ = 'a_la_carte_items'
    id = Column(Integer, primary_key=True)
    owner_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    name_hi = Column(String(100), nullable=False, default='')
    description = Column(String(500), nullable=False, default='')
    description_hi = Column(String(500), nullable=False, default='')
    price = Column(Numeric(10, 2), nullable=False)
    available = Column(Boolean, nullable=False, default=True)
    meal_types = Column(JSON, nullable=False)


class ALaCarteOrder(Base):
    __tablename__ = 'a_la_carte_orders'
    id = Column(Integer, primary_key=True)
    owner_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    plan_id = Column(Integer, ForeignKey('meal_plans.id'), nullable=False, index=True)
    meal_id = Column(Integer, ForeignKey('meals.id'), nullable=False, index=True)
    purchase_key = Column(String(36), nullable=False, unique=True)
    total = Column(Numeric(12, 2), nullable=False)
    status = Column(String(20), nullable=False, default='confirmed')
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    lines = relationship('ALaCarteOrderLine', order_by='ALaCarteOrderLine.id')


class ALaCarteOrderLine(Base):
    __tablename__ = 'a_la_carte_order_lines'
    id = Column(Integer, primary_key=True)
    owner_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    order_id = Column(Integer, ForeignKey('a_la_carte_orders.id'), nullable=False, index=True)
    item_id = Column(Integer, ForeignKey('a_la_carte_items.id'), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(10, 2), nullable=False)
    name = Column(String(100), nullable=False)
    name_hi = Column(String(100), nullable=False, default='')


class MessProfile(Base):
    __tablename__ = "mess_profiles"
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    owner_name = Column(String, default="")
    business_type = Column(String, default="")
    tagline = Column(String, default="")
    food_type = Column(String, default="")
    service_type = Column(String, default="")
    operating_days = Column(String, default="")
    opening_time = Column(String, default="")
    closing_time = Column(String, default="")
    city = Column(String, default="")
    area = Column(String, default="")
    fssai_number = Column(String, default="")
    business_status = Column(String, default="")
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


class AuthAttemptBucket(Base):
    __tablename__ = "auth_attempt_buckets"
    key = Column(String(64), primary_key=True)
    attempts = Column(Integer, nullable=False, default=0)
    window_start = Column(DateTime, nullable=False)


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


class ChatMessage(Base):
    __tablename__ = 'chat_messages'
    __table_args__ = (
        UniqueConstraint('owner_id', 'customer_id', 'from_owner', 'client_key', name='uq_chat_message_retry'),
        Index('ix_chat_conversation', 'owner_id', 'customer_id', 'id'),
    )
    id = Column(Integer, primary_key=True)
    owner_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    customer_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    from_owner = Column(Boolean, nullable=False)
    body = Column(String(2000), nullable=False)
    client_key = Column(String(36), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    read_at = Column(DateTime, nullable=True)
