from pydantic import BaseModel, Field, field_validator
from typing import Literal
from datetime import date as Date, datetime, timezone
from typing import Optional



class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    phone: str = Field(pattern=r"^[0-9]{10}$")
    password: str = Field(min_length=8, max_length=72)
    role: Literal["customer", "owner"] = "customer"

    @field_validator("password")
    @classmethod
    def password_bytes(cls, value):
        if len(value.encode()) > 72:
            raise ValueError("Password must be at most 72 bytes")
        return value


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


class MealOut(BaseModel):
    id: int
    date: Date
    meal_type: str
    menu_description: Optional[str] = None
    is_complimentary: bool
    cutoff_time: Optional[datetime] = None
    status: str = "confirmed"
    image_url: Optional[str] = None
    single_price: Optional[float] = None
    can_manage: bool = False
    booked: bool = False

    class Config:
        from_attributes = True


class SkipMealRequest(BaseModel):
    meal_id: int


class AddGuestRequest(BaseModel):
    meal_id: int
    guest_count: int = Field(default=1, ge=1, le=100, strict=True)
    expected_unit_price: Optional[float] = Field(default=None, ge=0, le=10000, allow_inf_nan=False)
    extra_items: Optional[str] = None
    extra_cost: float = Field(default=50, ge=0, le=10000, allow_inf_nan=False)


# =========================================================
# OWNER MEAL MANAGEMENT
# =========================================================

class MealDates(BaseModel):
    @field_validator("cutoff_time", check_fields=False)
    @classmethod
    def utc_cutoff(cls, value):
        if value and value.tzinfo:
            return value.astimezone(timezone.utc).replace(tzinfo=None)
        return value


class MealCreate(MealDates):
    date: Date
    meal_type: Literal["breakfast", "lunch", "dinner"]
    menu_description: Optional[str] = None
    is_complimentary: bool = True
    cutoff_time: Optional[datetime] = None
    image_url: Optional[str] = None
    single_price: Optional[float] = Field(default=None, gt=0, le=10000, allow_inf_nan=False, multiple_of=0.01)


class MealUpdate(MealDates):
    date: Optional[Date] = None
    meal_type: Optional[Literal["breakfast", "lunch", "dinner"]] = None
    menu_description: Optional[str] = None
    is_complimentary: Optional[bool] = None
    cutoff_time: Optional[datetime] = None
    image_url: Optional[str] = None
    single_price: Optional[float] = Field(default=None, gt=0, le=10000, allow_inf_nan=False, multiple_of=0.01)

    @field_validator("date", "meal_type", "is_complimentary")
    @classmethod
    def reject_null(cls, value):
        if value is None:
            raise ValueError("This field cannot be null")
        return value


class WeeklyMenuItem(BaseModel):
    weekday: int = Field(ge=0, le=6)
    meal_type: Literal["breakfast", "lunch", "dinner"]
    menu_description: str = Field(min_length=1, max_length=500)
    image_url: Optional[str] = None
    single_price: Optional[float] = Field(default=None, gt=0, le=10000, allow_inf_nan=False, multiple_of=0.01)
    is_complimentary: bool = True
    cutoff_time: str = Field(pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")

    @field_validator("menu_description")
    @classmethod
    def clean_menu_description(cls, value):
        value = value.strip()
        if not value:
            raise ValueError("Enter at least one dish for this meal")
        return value


class WeeklyMenuSave(BaseModel):
    items: list[WeeklyMenuItem] = Field(max_length=21)

    @field_validator("items")
    @classmethod
    def unique_weekday_meals(cls, value):
        keys = [(item.weekday, item.meal_type) for item in value]
        if len(keys) != len(set(keys)):
            raise ValueError("Choose each meal type only once per weekday")
        return value


class MealOrderOut(BaseModel):
    id: int
    meal_id: int
    status: str
    extra_items: Optional[str] = None
    extra_cost: float
    meal: MealOut

    class Config:
        from_attributes = True


class PlanCreate(BaseModel):
    meal_types: list[Literal["breakfast", "lunch", "dinner"]] = Field(default_factory=lambda: ["breakfast", "lunch", "dinner"], min_length=1, max_length=3)

    @field_validator("meal_types")
    @classmethod
    def unique_meal_types(cls, value):
        if len(value) != len(set(value)):
            raise ValueError("Choose each meal type only once")
        return [kind for kind in ["breakfast", "lunch", "dinner"] if kind in value]

    user_id: int
    price: float = Field(gt=0, allow_inf_nan=False)
    meal_price: float = Field(gt=0, allow_inf_nan=False)
    start_date: Date
    end_date: Date


class CustomerCreate(UserCreate):
    email: Optional[str] = Field(default=None, max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


class CustomerCreated(UserOut):
    email_status: str
