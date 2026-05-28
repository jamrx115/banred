import os
from urllib.parse import quote_plus
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

def build_database_url() -> str:
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        return database_url

    db_name = os.getenv("DB_NAME")
    db_user = os.getenv("DB_USER")
    db_password = os.getenv("DB_PASSWORD")
    db_host = os.getenv("DB_HOST")
    if db_name and db_user and db_password and db_host:
        user = quote_plus(db_user)
        password = quote_plus(db_password)
        host = quote_plus(db_host)
        return f"postgresql+psycopg2://{user}:{password}@/{db_name}?host={host}"

    return "postgresql+psycopg2://demo:demo123@localhost:5432/transacciones"

DATABASE_URL = build_database_url()
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
