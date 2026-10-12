import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

ON_RENDER = os.getenv("RENDER", "").lower() == "true"
if not ON_RENDER:
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
if ON_RENDER and not DATABASE_URL:
    raise RuntimeError("Set DATABASE_URL in Render Environment to your separate live PostgreSQL database. Local .env files are not used on Render.")
if ON_RENDER and not DATABASE_URL.startswith(("postgres://", "postgresql://", "postgresql+psycopg://", "postgresql+psycopg2://")):
    raise RuntimeError("Render requires a persistent PostgreSQL DATABASE_URL; local SQLite databases are for development only.")
DATABASE_URL = DATABASE_URL or "sqlite:///./mess.db"
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = "postgresql://" + DATABASE_URL[len("postgres://"):]

# echo=True prints every SQL query to your terminal — helpful while learning,
# turn it off (False) once things are working
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Gives each API request its own database session, then closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
