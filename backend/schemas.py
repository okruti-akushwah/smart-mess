from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


# =========================================================
# USER SCHEMAS
# =========================================================

class UserCreate(BaseModel):
    name: str
    phone: str
    password: str
    role: str = "customer"


class UserLogin(BaseModel):
    phone: str
    password: str


class UserOut(BaseModel):
    id: int
    name: str
    phone: str
    role: str

    class Config:
        from_attributes = True


# =========================================================
# MEAL SCHEMAS
# =========================================================

class MealOut(BaseModel):
    id: int
    date: date
    meal_type: str
    menu_description: Optional[str] = None
    is_complimentary: bool
    cutoff_time: Optional[datetime] = None

    class Config:
        from_attributes = True


class MealCreate(BaseModel):
    date: date
    meal_type: str
    menu_description: Optional[str] = None
    is_complimentary: bool = True
    cutoff_time: Optional[datetime] = None


class MealUpdate(BaseModel):
    date: Optional[date] = None
    meal_type: Optional[str] = None
    menu_description: Optional[str] = None
    is_complimentary: Optional[bool] = None
    cutoff_time: Optional[datetime] = None


# =========================================================
# MEAL ACTION SCHEMAS
# =========================================================

class SkipMealRequest(BaseModel):
    meal_id: int


class AddGuestRequest(BaseModel):
    meal_id: int
    extra_items: Optional[str] = None
    extra_cost: float = 0