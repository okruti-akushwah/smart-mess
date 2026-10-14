"""Request-local mess isolation for ORM reads, writes and relationship loads.

An owner's user ID is the stable mess key. Public browsing selects it via an
invite token; authenticated requests derive it from the stored membership.
Unscoped sessions are reserved for registration, authentication and migration.
"""
from fastapi import Depends, HTTPException, Request
from sqlalchemy import event, or_, select
from sqlalchemy.orm import Session, with_loader_criteria
from app import models
from app.database import get_db

SCOPED_MODELS = tuple(
    mapper.class_ for mapper in models.Base.registry.mappers
    if hasattr(mapper.class_, "owner_id") and mapper.class_ not in (models.MessInstallation, models.DeliveryProfile)
)


def default_owner_id(db):
    installation = db.get(models.MessInstallation, 1)
    if installation and db.get(models.User, installation.owner_id):
        return installation.owner_id
    owner = db.query(models.User).filter_by(role="owner").order_by(models.User.id).first()
    return owner.id if owner else None


def owner_for_user(db, user, mess_token=None):
    if user.role == "owner":
        return user.id
    if mess_token:
        invite = db.query(models.JoinInvite).filter_by(token=mess_token).first()
        if not invite:
            raise HTTPException(403, "Select a valid mess to continue")
        membership = db.query(models.JoinRequest).filter_by(user_id=user.id, owner_id=invite.owner_id).first()
        if not membership and user.mess_owner_id != invite.owner_id:
            raise HTTPException(403, "Request to join this mess before opening its member account")
        return invite.owner_id
    memberships = db.query(models.JoinRequest).filter_by(user_id=user.id).all()
    if len(memberships) == 1:
        return memberships[0].owner_id
    if len(memberships) > 1:
        raise HTTPException(409, "Choose a mess from your account before continuing")
    if user.mess_owner_id:
        return user.mess_owner_id
    raise HTTPException(403, "Join a mess using its owner's invitation link")


def scope(db, owner_id):
    if db.info.get("mess_owner_id") not in (None, owner_id):
        raise HTTPException(403, "Cannot switch mess within a request")
    db.info["mess_owner_id"] = owner_id
    return db


@event.listens_for(Session, "do_orm_execute")
def isolate_queries(state):
    owner_id = state.session.info.get("mess_owner_id")
    if owner_id is None or state.execution_options.get("all_messes"):
        return
    options = [with_loader_criteria(
        entity, entity.owner_id == owner_id, include_aliases=True
    ) for entity in SCOPED_MODELS]
    options.append(with_loader_criteria(models.User, or_(
        models.User.id == owner_id, models.User.mess_owner_id == owner_id,
        models.User.id.in_(select(models.JoinRequest.user_id).where(models.JoinRequest.owner_id == owner_id)),
    ), include_aliases=True))
    state.statement = state.statement.options(*options)


@event.listens_for(Session, "before_flush")
def isolate_writes(db, context, instances):
    owner_id = db.info.get("mess_owner_id")
    if owner_id is None:
        return
    for item in db.new.union(db.dirty).union(db.deleted):
        if isinstance(item, models.User):
            if item.role == "customer" and item in db.new and item.mess_owner_id is None:
                item.mess_owner_id = owner_id
            if item.id != owner_id and item.mess_owner_id != owner_id:
                membership = db.query(models.JoinRequest.id).filter_by(user_id=item.id, owner_id=owner_id).first()
                if not membership:
                    raise HTTPException(403, "Customer does not belong to this mess")
        elif isinstance(item, SCOPED_MODELS):
            if item in db.new and item.owner_id is None:
                item.owner_id = owner_id
            if item.owner_id != owner_id:
                raise HTTPException(403, "Record belongs to another mess")
            # Validate references as well as the row's own mess key.
            for column in item.__table__.columns:
                if column.name == "owner_id":
                    continue
                value = getattr(item, column.name)
                if value is None:
                    continue
                for foreign_key in column.foreign_keys:
                    target = next((m.class_ for m in models.Base.registry.mappers
                                   if m.local_table.name == foreign_key.column.table.name), None)
                    if target and db.get(target, value) is None:
                        raise HTTPException(404, "Referenced record does not belong to this mess")


def public_db(request: Request, db: Session = Depends(get_db)):
    from app.routes.join_routes import find_invite
    token = request.path_params.get("token") or request.query_params.get("mess_token")
    if token:
        owner_id = find_invite(token, db).owner_id
    elif request.headers.get("authorization", "").startswith("Bearer "):
        from app.auth import decode_access_token
        try:
            payload = decode_access_token(request.headers["authorization"][7:])
            user = db.get(models.User, int(payload["sub"]))
        except Exception:
            raise HTTPException(401, "Invalid or expired token")
        if not user:
            raise HTTPException(401, "User not found")
        owner_id = owner_for_user(db, user, request.headers.get("X-Mess-Token"))
    else:
        owner_id = default_owner_id(db)
    # Empty installations have empty catalogues, never an unscoped query.
    return scope(db, owner_id or -1)
