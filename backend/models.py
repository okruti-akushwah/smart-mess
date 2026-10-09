from sqlalchemy import Column, Integer, String, Date, ForeignKey, Numeric, Boolean, DateTime
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
    language_pref = Column(String, default="en")
    created_at = Column(DateTime, default=datetime.utcnow)


class MealPlan(Base):
    __tablename__ = "meal_plans"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    plan_type = Column(String)  # "monthly" or "weekly"
    price = Column(Numeric(10, 2))
    start_date = Column(Date)
    end_date = Column(Date)
    status = Column(String, default="active")

    user = relationship("User")


class Meal(Base):
    __tablename__ = "meals"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False)
    meal_type = Column(String)  # "lunch" or "dinner"
    menu_description = Column(String)
    is_complimentary = Column(Boolean, default=True)
    cutoff_time = Column(DateTime)


class MealOrder(Base):
    __tablename__ = "meal_orders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    meal_id = Column(Integer, ForeignKey("meals.id"))
    status = Column(String, default="confirmed")  # "confirmed", "skipped", "guest_added"
    extra_items = Column(String, nullable=True)
    extra_cost = Column(Numeric(10, 2), default=0)

    user = relationship("User")
    meal = relationship("Meal")


class Bill(Base):
    __tablename__ = "bills"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    month = Column(String)  # e.g. "2026-10"
    base_amount = Column(Numeric(10, 2))
    deductions = Column(Numeric(10, 2), default=0)
    extras_total = Column(Numeric(10, 2), default=0)
    final_amount = Column(Numeric(10, 2))
    payment_status = Column(String, default="pending")

    user = relationship("User")


class Feedback(Base):
    __tablename__ = "feedback"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    meal_id = Column(Integer, ForeignKey("meals.id"))
    rating = Column(Integer)  # 1-5
    comment = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)