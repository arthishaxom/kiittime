"""Unit tests for analytics config and DuckDB connection factory."""

from analytics.config import Settings, get_duckdb_conn


def test_get_duckdb_conn_without_r2_keys():
    settings = Settings(
        R2_ACCESS_KEY="",
        R2_SECRET_KEY="",
        CF_ACCOUNT_ID="",
        AXIOM_API_KEY="dummy",
        ENVIRONMENT="test",
    )
    conn = get_duckdb_conn(settings)
    assert conn is not None
    res = conn.execute("SELECT 1").fetchone()
    assert res == (1,)
    conn.close()


def test_get_duckdb_conn_with_dummy_r2_keys():
    settings = Settings(
        R2_ACCESS_KEY="dummy_key",
        R2_SECRET_KEY="dummy_secret",
        CF_ACCOUNT_ID="dummy_account_id",
        AXIOM_API_KEY="dummy_axiom",
        ENVIRONMENT="test",
    )
    conn = get_duckdb_conn(settings)
    assert conn is not None
    secrets = conn.execute("FROM duckdb_secrets();").fetchall()
    assert len(secrets) >= 1
    conn.close()
