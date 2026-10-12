from sqlalchemy import inspect, text


def add_subscription_extensions(engine):
    with engine.begin() as connection:
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


def add_customer_checkout(engine):
    with engine.begin() as connection:
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
    with engine.begin() as connection:
        columns = {column["name"] for column in inspect(connection).get_columns("meals")}
        if "image_url" not in columns:
            connection.execute(text("ALTER TABLE meals ADD COLUMN image_url VARCHAR"))


def add_skip_deduction_column(engine):
    """Bring legacy plans up to date without replacing existing subscriptions."""
    with engine.begin() as connection:
        columns = {column["name"] for column in inspect(connection).get_columns("meal_plans")}
        if "meal_price" not in columns:
            connection.execute(text("ALTER TABLE meal_plans ADD COLUMN meal_price NUMERIC(10, 2) DEFAULT 50"))


def add_guest_count_column(engine):
    with engine.begin() as connection:
        columns = {column["name"] for column in inspect(connection).get_columns("meal_orders")}
        if "guest_count" not in columns:
            connection.execute(text("ALTER TABLE meal_orders ADD COLUMN guest_count INTEGER NOT NULL DEFAULT 1"))


def add_plan_offer_column(engine):
    """Preserve existing subscriptions while linking new ones to their catalogue plan."""
    with engine.begin() as connection:
        columns = {column["name"] for column in inspect(connection).get_columns("meal_plans")}
        if "offer_id" not in columns:
            connection.execute(text("ALTER TABLE meal_plans ADD COLUMN offer_id INTEGER REFERENCES plan_offers(id)"))


def add_mess_ownership(engine):
    """Backfill existing data into its original mess without changing record IDs."""
    tables = ("meals", "plan_offers", "meal_plans", "meal_orders", "bills", "feedback",
              "plan_requests", "delivery_profiles", "delivery_updates", "payment_records",
              "payment_settings", "issued_bills", "payment_submissions", "join_selections", "guest_pricing")
    with engine.begin() as connection:
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
    with engine.begin() as connection:
        columns = {column["name"] for column in inspect(connection).get_columns("mess_profiles")}
        for field in ("name_hi", "about_hi", "preparation_hi", "address_hi"):
            if field not in columns:
                connection.execute(text(f"ALTER TABLE mess_profiles ADD COLUMN {field} VARCHAR DEFAULT ''"))


def add_plan_meal_types(engine):
    with engine.begin() as connection:
        for table in ('plan_offers', 'meal_plans'):
            if 'meal_types' not in {c['name'] for c in inspect(connection).get_columns(table)}:
                connection.execute(text(f"ALTER TABLE {table} ADD COLUMN meal_types JSON NOT NULL DEFAULT '[\"breakfast\", \"lunch\", \"dinner\"]'"))
