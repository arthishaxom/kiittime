import os

import pytest
from dotenv import load_dotenv
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session

load_dotenv()


@pytest.fixture(scope="session", autouse=True)
def postgres_container():
    """Start Postgres Testcontainer and run migrations."""
    from alembic import command
    from alembic.config import Config
    from testcontainers.postgres import PostgresContainer

    with PostgresContainer("postgres:17", driver="psycopg") as container:
        db_url = container.get_connection_url()
        os.environ["DATABASE_URL"] = db_url

        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        ini_path = os.path.join(base_dir, "alembic.ini")

        alembic_cfg = Config(ini_path)
        alembic_cfg.set_main_option("sqlalchemy.url", db_url)
        command.upgrade(alembic_cfg, "head")

        yield container


@pytest.fixture
def db(postgres_container):
    """Isolate each test in a SAVEPOINT nested inside an outer transaction.

    Code under test may call session.commit() as part of normal,
    production-correct behavior. A plain session.rollback() at teardown does
    nothing once that commit has already happened. Instead: bind the Session
    to a Connection that already has an outer transaction open.
    session.commit() then only ends the inner SAVEPOINT, leaving the outer
    transaction open. Roll back the outer transaction at teardown to erase
    everything, including anything the code under test committed.
    """
    database_url = postgres_container.get_connection_url()

    engine = create_engine(database_url)
    connection = engine.connect()

    outer_transaction = connection.begin()

    session = Session(bind=connection)
    session.begin_nested()

    @event.listens_for(session, "after_transaction_end")
    def restart_savepoint(sess, transaction):
        if transaction.nested and not transaction._parent.nested:
            sess.begin_nested()

    yield session

    session.close()
    outer_transaction.rollback()
    connection.close()
