"""Explicit, transactional schema upgrades; importing this module never connects."""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path

from sqlalchemy import Column, DateTime, MetaData, String, Table, inspect, select, text


REVISIONS = ("0001_baseline", "0002_concurrency_invariants", "0003_pause_date_credits", "0004_weekly_menu", "0005_multi_mess_memberships", "0006_business_details", "0007_in_app_chat")
VERSION_TABLE = Table("app_schema_revisions", MetaData(),
                      Column("revision", String(64), primary_key=True),
                      Column("applied_at", DateTime, nullable=False))
MIGRATION_LOCK = 71404001
LEGACY_ADDITIONS = {
    "users": {"mess_owner_id"},
    "meals": {"owner_id", "image_url", "single_price", "weekly_menu_entry_id", "weekly_menu_override"},
    "meal_plans": {"owner_id", "offer_id", "meal_price", "meal_id", "purchase_key",
                   "original_start_date", "original_end_date", "skip_count", "accepted", "meal_types"},
    "meal_orders": {"owner_id", "guest_count", "extension_plan_id", "extension_credit"},
    "mess_profiles": {'about_hi', 'tagline', 'business_type', 'operating_days', 'opening_time', 'city', 'food_type', 'service_type', 'owner_name', 'closing_time', 'area', 'business_status', 'preparation_hi', 'name_hi', 'fssai_number', 'address_hi'},
    "plan_offers": {"owner_id", "meal_types"},
}
for _table in ("bills", "feedback", "plan_requests", "delivery_profiles", "delivery_updates",
               "payment_records", "payment_settings", "issued_bills", "payment_submissions",
               "join_selections", "guest_pricing"):
    LEGACY_ADDITIONS[_table] = {"owner_id"}


def schema_status(connection):
    from app.models import Base
    inspector = inspect(connection)
    tables = set(inspector.get_table_names())
    applied = list(connection.execute(select(VERSION_TABLE.c.revision)).scalars()) if VERSION_TABLE.name in tables else []
    if set(applied) - set(REVISIONS):
        raise RuntimeError("Database has an unsupported migration revision; use the matching application release")
    missing, unsupported, primary_keys, column_types = {}, {}, {}, {}
    for table in Base.metadata.sorted_tables:
        if table.name not in tables:
            missing[table.name] = [column.name for column in table.columns]
            continue
        actual_columns = {column["name"]: column for column in inspector.get_columns(table.name)}
        additions = {column.name for column in table.columns} - set(actual_columns)
        expected_key = {column.name for column in table.primary_key.columns}
        if set(inspector.get_pk_constraint(table.name)["constrained_columns"]) != expected_key:
            primary_keys[table.name] = sorted(expected_key)
        mismatches = [column.name for column in table.columns if column.name in actual_columns
                      and actual_columns[column.name]["type"]._type_affinity != column.type._type_affinity]
        if mismatches:
            column_types[table.name] = mismatches
        if additions:
            missing[table.name] = sorted(additions)
            unknown = additions - LEGACY_ADDITIONS.get(table.name, set())
            if unknown:
                unsupported[table.name] = sorted(unknown)
    missing_indexes = {}
    for name, table, _, _ in CONCURRENCY_INDEXES:
        if table in tables and name not in {index["name"] for index in inspector.get_indexes(table)}:
            missing_indexes[table] = sorted(set(missing_indexes.get(table, [])) | {name})
    return {"applied": [revision for revision in REVISIONS if revision in applied],
            "pending": [revision for revision in REVISIONS if revision not in applied],
            "existing_database": bool(tables - {VERSION_TABLE.name}),
            "missing": missing, "unsupported_missing_columns": unsupported,
            "unsupported_primary_keys": primary_keys, "unsupported_column_types": column_types,
            "missing_indexes": missing_indexes}


def status(engine):
    database = engine.url.database
    if engine.dialect.name == "sqlite" and database and database != ":memory:" and not engine.url.query.get("uri") and not Path(database).exists():
        raise RuntimeError("SQLite database file does not exist. Run the explicit migration command before starting the API")
    with engine.connect() as connection:
        return schema_status(connection)


def require_current_schema(engine):
    report = status(engine)
    if (report["pending"] or report["missing"] or report["unsupported_primary_keys"]
            or report["unsupported_column_types"] or report["missing_indexes"]):
        raise RuntimeError("Database schema is not current. Run the explicit migration command before starting the API")


def baseline(connection):
    from app.models import Base
    from app import migrations
    Base.metadata.create_all(connection)
    for operation in (migrations.add_menu_image_column, migrations.add_skip_deduction_column,
                      migrations.add_guest_count_column, migrations.add_plan_offer_column,
                      migrations.add_customer_checkout, migrations.add_subscription_extensions,
                      migrations.add_pause_date_credit, migrations.add_plan_meal_types, migrations.add_profile_languages,
                      migrations.add_mess_ownership, migrations.add_weekly_menu, migrations.add_business_details):
        operation(connection)
    # Preserve the original installation anchor, without a nested Session commit.
    if connection.execute(text("SELECT owner_id FROM mess_installation WHERE id = 1")).scalar() is None:
        connection.execute(text("INSERT INTO mess_installation (id, owner_id) "
                                "SELECT 1, id FROM users WHERE role = 'owner' ORDER BY id LIMIT 1"))


CONCURRENCY_INDEXES = (
    ("uq_meals_owner_date_type", "meals", "owner_id, date, meal_type", None),
    ("uq_meal_orders_user_meal", "meal_orders", "user_id, meal_id", None),
    ("uq_feedback_user_meal", "feedback", "user_id, meal_id", None),
    ("uq_delivery_updates_user_meal", "delivery_updates", "user_id, meal_id", None),
    ("uq_payment_submissions_pending_bill", "payment_submissions", "bill_id", "status = 'pending'"),
)


def concurrency_invariants(connection):
    inspector = inspect(connection)
    existing_indexes = {table: {index["name"] for index in inspector.get_indexes(table)}
                        for _, table, _, _ in CONCURRENCY_INDEXES}
    duplicates = {}
    for name, table, columns, predicate in CONCURRENCY_INDEXES:
        if name in existing_indexes[table]:
            continue
        column_names = [part.strip() for part in columns.split(",")]
        grouped = ", ".join(column_names)
        condition = f" WHERE {predicate}" if predicate else ""
        rows = connection.execute(text(
            f"SELECT {grouped}, COUNT(*) AS row_count FROM {table}{condition} "
            f"GROUP BY {grouped} HAVING COUNT(*) > 1 LIMIT 10"
        )).mappings().all()
        if rows:
            duplicates[name] = [dict(row) for row in rows]
    if duplicates:
        raise RuntimeError("Duplicate records prevent concurrency constraints; review and reconcile them before retrying: "
                           + json.dumps(duplicates, sort_keys=True, default=str))
    for name, table, columns, predicate in CONCURRENCY_INDEXES:
        where = f" WHERE {predicate}" if predicate else ""
        connection.execute(text(f"CREATE UNIQUE INDEX IF NOT EXISTS {name} ON {table} ({columns}){where}"))


def pause_date_credits(connection):
    """Keep legacy skip credits while allowing new pauses to credit once per date."""
    from app.migrations import add_pause_date_credit
    add_pause_date_credit(connection)


def weekly_menu(connection):
    """Add recurring weekday menu templates without changing existing meals."""
    from app.migrations import add_weekly_menu
    add_weekly_menu(connection)


def multi_mess_memberships(connection):
    """Allow one member account to hold a separate join request for each mess."""
    from app.migrations import allow_multi_mess_memberships
    allow_multi_mess_memberships(connection)


def business_details(connection):
    from app.migrations import add_business_details
    add_business_details(connection)


def in_app_chat(connection):
    from app.models import ChatMessage
    ChatMessage.__table__.create(connection, checkfirst=True)


OPERATIONS = {
    "0001_baseline": baseline,
    "0002_concurrency_invariants": concurrency_invariants,
    "0003_pause_date_credits": pause_date_credits,
    "0004_weekly_menu": weekly_menu,
    "0005_multi_mess_memberships": multi_mess_memberships,
    "0006_business_details": business_details,
    "0007_in_app_chat": in_app_chat,
}


def upgrade(engine, allow_legacy_upgrade=False):
    if engine.dialect.name not in {"sqlite", "postgresql"}:
        raise RuntimeError("Migrations support SQLite and PostgreSQL")
    with engine.begin() as connection:
        if engine.dialect.name == "sqlite":
            connection.exec_driver_sql("BEGIN IMMEDIATE")
        else:
            connection.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": MIGRATION_LOCK})
        report = schema_status(connection)
        unsupported = {key: report[key] for key in ("unsupported_missing_columns", "unsupported_primary_keys", "unsupported_column_types") if report[key]}
        if unsupported:
            raise RuntimeError("Unsupported legacy schema: " + json.dumps(unsupported, sort_keys=True))
        if report["existing_database"] and not report["applied"] and not allow_legacy_upgrade:
            raise RuntimeError("Unversioned database: inspect status and back up first, then explicitly use --allow-legacy-upgrade")
        if not report["pending"]:
            if report["missing"] or report["missing_indexes"]:
                raise RuntimeError("Versioned schema is incomplete; inspect it before proceeding")
            return []
        VERSION_TABLE.create(connection, checkfirst=True)
        for revision in report["pending"]:
            OPERATIONS[revision](connection)
            migrated = schema_status(connection)
            missing_now = {table: columns for table, columns in migrated['missing'].items()
                           if table != 'chat_messages' or revision == '0007_in_app_chat'}
            if missing_now or (revision == "0002_concurrency_invariants" and migrated["missing_indexes"]):
                raise RuntimeError("Migration did not produce the expected schema")
            connection.execute(VERSION_TABLE.insert().values(
                revision=revision, applied_at=datetime.now(timezone.utc).replace(tzinfo=None)))
        return report["pending"]


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("status", "upgrade"))
    parser.add_argument("--allow-legacy-upgrade", action="store_true",
                        help="Explicitly adopt an inspected, backed-up unversioned database")
    args = parser.parse_args(argv)
    # Never infer a migration target from .env or a fallback database.
    if not os.getenv("DATABASE_URL", "").strip():
        parser.error("Set DATABASE_URL explicitly; migration targets are never loaded from .env")
    engine = None
    try:
        from app.database import engine
        if args.command == "status":
            print(json.dumps(status(engine), indent=2))
        else:
            print(json.dumps({"applied": upgrade(engine, args.allow_legacy_upgrade)}))
    except RuntimeError as error:
        parser.exit(1, str(error) + "\n")
    except Exception as error:
        parser.exit(1, f"Migration command failed ({type(error).__name__}); no revision was committed. Check connectivity and schema constraints.\n")
    finally:
        if engine is not None:
            engine.dispose()


if __name__ == "__main__":
    main()
