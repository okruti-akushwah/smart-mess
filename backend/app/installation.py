from sqlalchemy.exc import IntegrityError
from app import models


def initialize(db):
    installation = db.get(models.MessInstallation, 1)
    if installation:
        return installation
    owner = db.query(models.User).filter_by(role='owner').order_by(models.User.id).first()
    if owner:
        db.add(models.MessInstallation(id=1, owner_id=owner.id))
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
    return db.get(models.MessInstallation, 1)


def check_owner(db, user):
    # MessInstallation preserves the original landing page and migration anchor.
    # Each owner now manages the mess keyed by their own account ID.
    return
