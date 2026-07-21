# Backend Test Isolation Spec

## 1. Goal
Migrate the backend integration tests to use an isolated testing database via `testcontainers`, instead of relying on the local development database specified in `.env`. Remove the destructive `TRUNCATE` logic that currently deletes development data.

## 2. Motivation
Currently, `tests/conftest.py` connects to the `DATABASE_URL` from the `.env` file and executes a hard `TRUNCATE TABLE ... CASCADE` to clean the database before running tests. This wipes out all local development data, creating a frustrating developer experience and preventing tests from being run safely. We must fix this before continuing with other docs or workspace implementation.

## 3. Proposed Architecture (Industry Best Practice)
1. **Testcontainers Setup**: Use the `testcontainers` Python package to spin up an ephemeral PostgreSQL Docker container at the start of the `pytest` session.
2. **Schema Initialization**: Programmatically execute Alembic migrations (`alembic upgrade head`) against the Testcontainer database so that the schema perfectly mirrors production.
3. **Transaction Rollbacks**: Retain the existing `SAVEPOINT` / nested transaction logic for inter-test isolation (as it's very fast), but completely remove the `TRUNCATE` command.

## 4. Tickets
- **01-add-testcontainers**: Add the necessary `testcontainers` package to `pyproject.toml` or `uv.lock`.
- **02-refactor-conftest**: Update the pytest fixtures in `conftest.py` to spin up the container, run Alembic migrations, bind the engine to the container's URL instead of `.env`, and remove the `TRUNCATE` logic.
