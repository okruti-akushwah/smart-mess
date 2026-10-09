from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session
from app import models
from app.database import get_db
from app.routes.owner_meal_routes import require_owner
from app.menu_catalog import DEFAULT_ITEMS, remember
router = APIRouter(prefix='/owner/menu-items', tags=['menu choices'])


@router.get('')
def items(db: Session = Depends(get_db), owner=Depends(require_owner)):
    saved = db.query(models.MenuItem).filter_by(owner_id=owner.id).order_by(models.MenuItem.name).all()
    return DEFAULT_ITEMS + [i.name for i in saved if i.key not in {n.casefold() for n in DEFAULT_ITEMS}]


class ItemInput(BaseModel):
    name: str = Field(min_length=1, max_length=100)

    @field_validator('name')
    @classmethod
    def clean(cls, value):
        value = ' '.join(value.split())
        if not value:
            raise ValueError('Enter a dish name')
        if any(c in value for c in ',;\n'):
            raise ValueError('Add one dish at a time')
        return value


@router.post('', status_code=201)
def add(body: ItemInput, db: Session = Depends(get_db), owner=Depends(require_owner)):
    remember(db, owner.id, body.name)
    db.commit()
    return {'name': body.name}
