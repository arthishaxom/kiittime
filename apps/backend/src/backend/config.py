"""Backend configuration and DuckDB connection factory."""

import duckdb
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    R2_ACCESS_KEY: str = ""
    R2_SECRET_KEY: str = ""
    CF_ACCOUNT_ID: str = ""
    R2_BUCKET_NAME: str = "kiittime-analytics"
    GOLD_BASE_PATH: str | None = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


def get_settings() -> Settings:
    return Settings()


def get_duckdb_conn(settings: Settings | None = None) -> duckdb.DuckDBPyConnection:
    """Returns a DuckDB in-memory connection configured with httpfs and R2 S3 secrets."""
    if settings is None:
        settings = get_settings()

    conn = duckdb.connect()
    try:
        conn.execute("LOAD httpfs;")
    except Exception:
        conn.execute("INSTALL httpfs;")
        conn.execute("LOAD httpfs;")

    if settings.R2_ACCESS_KEY and settings.R2_SECRET_KEY and settings.CF_ACCOUNT_ID:
        conn.execute(f"""
            CREATE OR REPLACE SECRET r2 (
                TYPE R2,
                KEY_ID '{settings.R2_ACCESS_KEY}',
                SECRET '{settings.R2_SECRET_KEY}',
                ACCOUNT_ID '{settings.CF_ACCOUNT_ID}',
                SCOPE ('s3://', 'r2://')
            );
        """)

    return conn
