"""Build a pgAdmin-ready SQL file without connecting to any database."""
import sys
from pathlib import Path
from sqlalchemy.schema import CreateTable, CreateIndex
from sqlalchemy.dialects import postgresql

sys.path.insert(0, str(Path(__file__).resolve().parent))
from app import models
from app.database import Base
from app.auth import hash_password, verify_password

password_hash = hash_password("Demo1234")
assert verify_password("Demo1234", password_hash)
dialect = postgresql.dialect()
ddl = []
for table in Base.metadata.sorted_tables:
    ddl.append(str(CreateTable(table, if_not_exists=True).compile(dialect=dialect)) + ";")
    for index in table.indexes:
        ddl.append(str(CreateIndex(index, if_not_exists=True).compile(dialect=dialect)) + ";")

data = r"""
ALTER TABLE meals ADD COLUMN IF NOT EXISTS image_url VARCHAR;
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS meal_price NUMERIC(10,2) DEFAULT 50;

DO $demo$
DECLARE
  demo_today DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE;
  active_customer INTEGER;
  new_customer INTEGER;
  demo_plan INTEGER;
  offer_id INTEGER;
  meal_id INTEGER;
  offset_days INTEGER;
  entry RECORD;
BEGIN
  -- Refuse to reuse a phone that already belongs to a different person.
  IF EXISTS (SELECT 1 FROM users WHERE phone IN ('9100000001','9100000002','9100000003')
       AND name NOT IN ('PgAdmin Demo Owner','PgAdmin Demo Customer','PgAdmin Demo New Customer')) THEN
    RAISE EXCEPTION 'A demo phone number belongs to an existing user. No demo rows were committed.';
  END IF;

  INSERT INTO users (name,phone,password_hash,role,language_pref,created_at)
  VALUES
    ('PgAdmin Demo Owner','9100000001','__HASH__','owner','en',CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
    ('PgAdmin Demo Customer','9100000002','__HASH__','customer','en',CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
    ('PgAdmin Demo New Customer','9100000003','__HASH__','customer','en',CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
  ON CONFLICT (phone) DO NOTHING;

  SELECT id INTO active_customer FROM users WHERE phone='9100000002';
  SELECT id INTO new_customer FROM users WHERE phone='9100000003';

  FOR entry IN SELECT * FROM (VALUES
    ('PgAdmin Demo Trial',1,150),
    ('PgAdmin Demo Weekly',7,900),
    ('PgAdmin Demo Monthly',30,3000)
  ) AS offers(name,days,price)
  LOOP
    INSERT INTO plan_offers (name,category,duration_days,price,meal_price,description,active)
    SELECT entry.name,'regular',entry.days,entry.price,50,'DEMO: all scheduled meals during the plan dates.',TRUE
    WHERE NOT EXISTS (SELECT 1 FROM plan_offers WHERE name=entry.name);
  END LOOP;

  SELECT id INTO demo_plan FROM meal_plans WHERE user_id=active_customer AND plan_type='PgAdmin Demo Monthly' ORDER BY id LIMIT 1;
  IF demo_plan IS NULL THEN
    INSERT INTO meal_plans (user_id,plan_type,price,meal_price,start_date,end_date,status)
    VALUES (active_customer,'PgAdmin Demo Monthly',3000,50,demo_today-2,demo_today+27,'active')
    RETURNING id INTO demo_plan;
  END IF;

  -- Reuse existing meals for each date/type, without changing their menus.
  FOR offset_days IN -2..4 LOOP
    FOR entry IN SELECT * FROM (VALUES
      ('breakfast','Poha, fresh fruit & masala chai'),
      ('lunch','Paneer curry, dal, rice & soft rotis'),
      ('dinner','Seasonal sabzi, dal tadka & jeera rice')
    ) AS menus(kind,menu)
    LOOP
      INSERT INTO meals (date,meal_type,menu_description,image_url,is_complimentary,cutoff_time)
      SELECT demo_today+offset_days,entry.kind,entry.menu,NULL,TRUE,
        (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + offset_days*INTERVAL '1 day' + INTERVAL '4 hours'
      WHERE NOT EXISTS (SELECT 1 FROM meals WHERE date=demo_today+offset_days AND meal_type=entry.kind);
    END LOOP;
  END LOOP;

  SELECT id INTO meal_id FROM meals WHERE date=demo_today+1 AND meal_type='breakfast' ORDER BY id LIMIT 1;
  INSERT INTO meal_orders (user_id,meal_id,status,extra_items,extra_cost)
  SELECT active_customer,meal_id,'skipped',NULL,0
  WHERE NOT EXISTS (SELECT 1 FROM meal_orders WHERE user_id=active_customer AND meal_orders.meal_id=meal_id);

  SELECT id INTO meal_id FROM meals WHERE date=demo_today+1 AND meal_type='lunch' ORDER BY id LIMIT 1;
  INSERT INTO meal_orders (user_id,meal_id,status,extra_items,extra_cost)
  SELECT active_customer,meal_id,'guest_added','1 demo guest meal',75
  WHERE NOT EXISTS (SELECT 1 FROM meal_orders WHERE user_id=active_customer AND meal_orders.meal_id=meal_id);

  INSERT INTO delivery_profiles (user_id,address,instructions)
  VALUES (active_customer,'Demo hostel, Room 201, Sample Road','DEMO: leave at reception.')
  ON CONFLICT (user_id) DO NOTHING;

  SELECT id INTO meal_id FROM meals WHERE date=demo_today AND meal_type='lunch' ORDER BY id LIMIT 1;
  INSERT INTO delivery_updates (user_id,meal_id,status,updated_at)
  SELECT active_customer,meal_id,'preparing',CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
  WHERE NOT EXISTS (SELECT 1 FROM delivery_updates WHERE user_id=active_customer AND delivery_updates.meal_id=meal_id);

  INSERT INTO payment_records (plan_id,amount,reference,receipt_key,created_at)
  SELECT demo_plan,1000,'DEMO cash receipt: no real payment','pgadmin-demo-receipt-'||demo_plan,
    CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
  WHERE NOT EXISTS (SELECT 1 FROM payment_records WHERE receipt_key='pgadmin-demo-receipt-'||demo_plan);

  -- Existing owner QR/settings are deliberately preserved. No fake QR or UPI address is added.
  INSERT INTO payment_settings (id,payee_name,upi_id,instructions,qr_url)
  VALUES (1,'PgAdmin Demo Owner','','DEMO: cash collection at the mess counter, 6–8 pm.',NULL)
  ON CONFLICT (id) DO NOTHING;

  SELECT id INTO meal_id FROM meals WHERE date=demo_today-1 AND meal_type='lunch' ORDER BY id LIMIT 1;
  INSERT INTO feedback (user_id,meal_id,rating,comment,created_at)
  SELECT active_customer,meal_id,5,'DEMO review: enjoyed the meal!',CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
  WHERE NOT EXISTS (SELECT 1 FROM feedback WHERE user_id=active_customer AND feedback.meal_id=meal_id);

  SELECT id INTO offer_id FROM plan_offers WHERE name='PgAdmin Demo Weekly' ORDER BY id LIMIT 1;
  INSERT INTO plan_requests (user_id,offer_id,start_date,status,created_at)
  SELECT new_customer,offer_id,demo_today,'pending',CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
  WHERE NOT EXISTS (SELECT 1 FROM plan_requests WHERE user_id=new_customer);

  INSERT INTO bills (user_id,month,base_amount,deductions,extras_total,final_amount,payment_status)
  SELECT active_customer,TO_CHAR(demo_today-INTERVAL '1 month','YYYY-MM'),3000,100,50,2950,'paid'
  WHERE NOT EXISTS (SELECT 1 FROM bills WHERE user_id=active_customer);
END;
$demo$;

COMMIT;

SELECT name,phone,role FROM users WHERE phone IN ('9100000001','9100000002','9100000003') ORDER BY phone;
"""
# PL/pgSQL variables must never share a name with columns in SQL predicates.
data = data.replace('meal_id', 'demo_meal_id').replace('(user_id,demo_meal_id', '(user_id,meal_id')
data = data.replace('meal_orders.demo_meal_id', 'meal_orders.meal_id').replace('delivery_updates.demo_meal_id', 'delivery_updates.meal_id').replace('feedback.demo_meal_id', 'feedback.meal_id')
data = data.replace('__HASH__', password_hash)
target = Path(__file__).resolve().parents[1] / 'demo_pgadmin.sql'
target.write_text('-- Smart Mess sample data. Run in pgAdmin Query Tool on your app database.\n'
    '-- Demo password: Demo1234. Reruns preserve demo actions; no existing records are deleted.\n'
    '-- These demo records will be visible to other users of this single-mess app.\n'
    'BEGIN;\nSET LOCAL search_path TO public;\n\n' + '\n\n'.join(ddl) + '\n' + data, encoding='utf-8')
print('Created', target.name, 'with a verified bcrypt hash. No database was changed.')
