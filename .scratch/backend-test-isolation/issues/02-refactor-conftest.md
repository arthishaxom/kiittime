# 02 - Refactor conftest.py for Test Isolation

## Task
Refactor `tests/conftest.py` to use a Postgres Testcontainer instead of the development database, and remove the destructive `TRUNCATE` operations.

## Instructions
1. In `tests/conftest.py`, import `PostgresContainer` from `testcontainers.postgres`.
2. Create a session-scoped fixture (e.g., `postgres_container`) that starts the container and yields it. This ensures the container only spins up once per test session.
3. Once the container starts, programmatically run Alembic migrations against it using `alembic.config.Config` and `alembic.command.upgrade(alembic_cfg, "head")`.
4. Update the `db()` fixture:
   - Make it depend on the `postgres_container` fixture.
   - Use the `postgres_container.get_connection_url()` instead of `os.getenv("DATABASE_URL")` to create the SQLAlchemy engine.
   - **Crucial:** Delete the entire block of code that executes `TRUNCATE TABLE ... CASCADE`.
5. Run `pytest` to ensure all tests pass against the new isolated container.
6. Verify locally that running `pytest` no longer deletes data from the development database.
