from sqlalchemy import inspect, text
from sqlalchemy.engine import Connection
from contextlib import contextmanager


@contextmanager
def migration_transaction(bind):
    """Join the versioned runner's transaction, or retain standalone helper use."""
    if isinstance(bind, Connection):
        yield bind
    else:
        with bind.begin() as connection:
            yield connection


def add_subscription_extensions(engine):
    with migration_transaction(engine) as connection:
        for table, name, definition in (
            ("meal_plans", "original_start_date", "DATE"),
            ("meal_plans", "original_end_date", "DATE"),
            ("meal_plans", "skip_count", "INTEGER NOT NULL DEFAULT 0"),
            ("meal_plans", "accepted", "BOOLEAN NOT NULL DEFAULT FALSE"),
            ("meal_orders", "extension_plan_id", "INTEGER REFERENCES meal_plans(id)"),
        ):
            columns = {c["name"] for c in inspect(connection).get_columns(table)}
            if name not in columns:
                connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {definition}"))
        connection.execute(text("UPDATE meal_plans SET original_start_date = start_date WHERE original_start_date IS NULL"))
        connection.execute(text("UPDATE meal_plans SET original_end_date = end_date WHERE original_end_date IS NULL"))
        connection.execute(text("UPDATE meal_plans SET accepted = TRUE WHERE meal_id IS NOT NULL AND status = 'active'"))


def add_pause_date_credit(engine):
    """Preserve existing meal credits while tracking per-date pause credits."""
    with migration_transaction(engine) as connection:
        columns = {c["name"] for c in inspect(connection).get_columns("meal_orders")}
        if "extension_credit" not in columns:
            connection.execute(text(
                "ALTER TABLE meal_orders ADD COLUMN extension_credit BOOLEAN NOT NULL DEFAULT TRUE"
            ))


def add_weekly_menu(engine):
    """Create weekly templates and link dated meal instances to their source entry."""
    from app.models import WeeklyMenuEntry
    with migration_transaction(engine) as connection:
        WeeklyMenuEntry.__table__.create(connection, checkfirst=True)
        columns = {c["name"] for c in inspect(connection).get_columns("meals")}
        if "weekly_menu_entry_id" not in columns:
            connection.execute(text(
                "ALTER TABLE meals ADD COLUMN weekly_menu_entry_id INTEGER "
                "REFERENCES weekly_menu_entries(id) ON DELETE SET NULL"
            ))
        columns = {c["name"] for c in inspect(connection).get_columns("meals")}
        if "weekly_menu_override" not in columns:
            connection.execute(text(
                "ALTER TABLE meals ADD COLUMN weekly_menu_override BOOLEAN NOT NULL DEFAULT FALSE"
            ))
        connection.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_meals_weekly_menu_entry_id "
            "ON meals (weekly_menu_entry_id)"
        ))


def allow_multi_mess_memberships(connection):
    """Remove the legacy one-mess-per-account constraint and index memberships."""
    inspector = inspect(connection)
    if connection.dialect.name == "sqlite":
        constraints = inspector.get_unique_constraints("join_requests")
        if not any(item.get("column_names") == ["user_id"] for item in constraints):
            connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_join_requests_owner_user ON join_requests (owner_id, user_id)"))
            return
        connection.exec_driver_sql("PRAGMA defer_foreign_keys=ON")
        connection.execute(text("""CREATE TABLE join_requests_new (
            id INTEGER NOT NULL PRIMARY KEY,
            owner_id INTEGER NOT NULL REFERENCES users(id),
            user_id INTEGER NOT NULL REFERENCES users(id),
            status VARCHAR NOT NULL,
            created_at DATETIME
        )"""))
        connection.execute(text("INSERT INTO join_requests_new (id, owner_id, user_id, status, created_at) "
                                "SELECT id, owner_id, user_id, status, created_at FROM join_requests"))
        connection.execute(text("DROP TABLE join_requests"))
        connection.execute(text("ALTER TABLE join_requests_new RENAME TO join_requests"))
        connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_join_requests_owner_user ON join_requests (owner_id, user_id)"))
        # DROP records deferred violations even after the replacement restores
        # the parent rows. Validate the final schema before clearing that state.
        violations = connection.exec_driver_sql("PRAGMA foreign_key_check").all()
        if violations:
            raise RuntimeError("Membership migration found invalid foreign key references")
        connection.exec_driver_sql("PRAGMA defer_foreign_keys=OFF")
        return

    constraints = inspector.get_unique_constraints("join_requests")
    for constraint in constraints:
        if constraint.get("column_names") == ["user_id"] and constraint.get("name"):
            quoted = connection.dialect.identifier_preparer.quote(constraint["name"])
            connection.execute(text(f"ALTER TABLE join_requests DROP CONSTRAINT {quoted}"))
    connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_join_requests_owner_user ON join_requests (owner_id, user_id)"))


def add_customer_checkout(engine):
    with migration_transaction(engine) as connection:
        for table, name, definition in (
            ("meals", "single_price", "NUMERIC(10, 2)"),
            ("meal_plans", "meal_id", "INTEGER REFERENCES meals(id)"),
            ("meal_plans", "purchase_key", "VARCHAR(36)"),
        ):
            columns = {c["name"] for c in inspect(connection).get_columns(table)}
            if name not in columns:
                connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {definition}"))
        connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_meal_plans_purchase_key ON meal_plans (purchase_key)"))


def add_menu_image_column(engine):
    """Add the nullable image field for existing SQLite/PostgreSQL installations."""
    with migration_transaction(engine) as connection:
        columns = {column["name"] for column in inspect(connection).get_columns("meals")}
        if "image_url" not in columns:
            connection.execute(text("ALTER TABLE meals ADD COLUMN image_url VARCHAR"))


def add_skip_deduction_column(engine):
    """Bring legacy plans up to date without replacing existing subscriptions."""
    with migration_transaction(engine) as connection:
        columns = {column["name"] for column in inspect(connection).get_columns("meal_plans")}
        if "meal_price" not in columns:
            connection.execute(text("ALTER TABLE meal_plans ADD COLUMN meal_price NUMERIC(10, 2) DEFAULT 50"))


def add_guest_count_column(engine):
    with migration_transaction(engine) as connection:
        columns = {column["name"] for column in inspect(connection).get_columns("meal_orders")}
        if "guest_count" not in columns:
            connection.execute(text("ALTER TABLE meal_orders ADD COLUMN guest_count INTEGER NOT NULL DEFAULT 1"))


def add_plan_offer_column(engine):
    """Preserve existing subscriptions while linking new ones to their catalogue plan."""
    with migration_transaction(engine) as connection:
        columns = {column["name"] for column in inspect(connection).get_columns("meal_plans")}
        if "offer_id" not in columns:
            connection.execute(text("ALTER TABLE meal_plans ADD COLUMN offer_id INTEGER REFERENCES plan_offers(id)"))


def add_mess_ownership(engine):
    """Backfill existing data into its original mess without changing record IDs."""
    tables = ("meals", "plan_offers", "meal_plans", "meal_orders", "bills", "feedback",
              "plan_requests", "delivery_profiles", "delivery_updates", "payment_records",
              "payment_settings", "issued_bills", "payment_submissions", "join_selections", "guest_pricing")
    with migration_transaction(engine) as connection:
        for table, column in [("users", "mess_owner_id"), *((t, "owner_id") for t in tables)]:
            columns = {c["name"] for c in inspect(connection).get_columns(table)}
            if column not in columns:
                connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} INTEGER REFERENCES users(id)"))
            connection.execute(text(f"CREATE INDEX IF NOT EXISTS ix_{table}_{column} ON {table} ({column})"))
        owner = connection.execute(text("SELECT owner_id FROM mess_installation WHERE id = 1")).scalar()
        if owner is None:
            owner = connection.execute(text("SELECT id FROM users WHERE role = 'owner' ORDER BY id LIMIT 1")).scalar()
        if owner is None:
            return
        connection.execute(text("UPDATE users SET mess_owner_id = COALESCE((SELECT owner_id FROM join_requests WHERE user_id = users.id), :owner) WHERE role = 'customer' AND mess_owner_id IS NULL"), {"owner": owner})
        # Rows with a customer/parent reference retain that customer's membership.
        parents = {
            "meal_plans": ("users", "user_id", "id", "mess_owner_id"),
            "meal_orders": ("users", "user_id", "id", "mess_owner_id"),
            "bills": ("users", "user_id", "id", "mess_owner_id"),
            "feedback": ("users", "user_id", "id", "mess_owner_id"),
            "plan_requests": ("users", "user_id", "id", "mess_owner_id"),
            "delivery_profiles": ("users", "user_id", "id", "mess_owner_id"),
            "delivery_updates": ("users", "user_id", "id", "mess_owner_id"),
            "payment_records": ("meal_plans", "plan_id", "id", "owner_id"),
            "issued_bills": ("users", "user_id", "id", "mess_owner_id"),
            "payment_submissions": ("users", "user_id", "id", "mess_owner_id"),
            "join_selections": ("join_requests", "request_id", "id", "owner_id"),
        }
        for table in tables:
            expression = ":owner"
            if table in parents:
                parent, foreign, key, column = parents[table]
                expression = f"COALESCE((SELECT {column} FROM {parent} WHERE {parent}.{key} = {table}.{foreign}), :owner)"
            connection.execute(text(f"UPDATE {table} SET owner_id = {expression} WHERE owner_id IS NULL"), {"owner": owner})


def add_profile_languages(engine):
    with migration_transaction(engine) as connection:
        columns = {column["name"] for column in inspect(connection).get_columns("mess_profiles")}
        for field in ("name_hi", "about_hi", "preparation_hi", "address_hi"):
            if field not in columns:
                connection.execute(text(f"ALTER TABLE mess_profiles ADD COLUMN {field} VARCHAR DEFAULT ''"))


def add_plan_meal_types(engine):
    with migration_transaction(engine) as connection:
        for table in ('plan_offers', 'meal_plans'):
            if 'meal_types' not in {c['name'] for c in inspect(connection).get_columns(table)}:
                connection.execute(text(f"ALTER TABLE {table} ADD COLUMN meal_types JSON NOT NULL DEFAULT '[\"breakfast\", \"lunch\", \"dinner\"]'"))


def add_business_details(engine):
    """Add optional public business details without rewriting existing profiles."""
    with migration_transaction(engine) as connection:
        columns = {column["name"] for column in inspect(connection).get_columns("mess_profiles")}
        for field in ('owner_name', 'business_type', 'tagline', 'food_type', 'service_type', 'operating_days', 'opening_time', 'closing_time', 'city', 'area', 'fssai_number', 'business_status'):
            if field not in columns:
                connection.execute(text(f"ALTER TABLE mess_profiles ADD COLUMN {field} VARCHAR DEFAULT ''"))


def add_kitchen_location(engine):
    with migration_transaction(engine) as connection:
        columns = {c['name'] for c in inspect(connection).get_columns('mess_profiles')}
        for field in ('latitude', 'longitude'):
            if field not in columns:
                connection.execute(text(f'ALTER TABLE mess_profiles ADD COLUMN {field} FLOAT'))


def add_a_la_carte(engine):
    from app.models import ALaCarteItem, ALaCarteOrder, ALaCarteOrderLine
    with migration_transaction(engine) as connection:
        for model in (ALaCarteItem, ALaCarteOrder, ALaCarteOrderLine):
            model.__table__.create(connection, checkfirst=True)
        columns = {c['name'] for c in inspect(connection).get_columns('issued_bills')}
        if 'extra_lines' not in columns:
            connection.execute(text("ALTER TABLE issued_bills ADD COLUMN extra_lines JSON NOT NULL DEFAULT '[]'"))
