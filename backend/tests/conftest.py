import os

import pytest
from dotenv import load_dotenv
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session

load_dotenv()


@pytest.fixture
def db():
    """Isolate each test in a SAVEPOINT nested inside an outer transaction.

    Code under test may call session.commit() as part of normal,
    production-correct behavior. A plain session.rollback() at teardown does
    nothing once that commit has already happened. Instead: bind the Session
    to a Connection that already has an outer transaction open.
    session.commit() then only ends the inner SAVEPOINT, leaving the outer
    transaction open. Roll back the outer transaction at teardown to erase
    everything, including anything the code under test committed.
    """
    database_url = os.getenv("DATABASE_URL")
    if database_url is None:
        raise RuntimeError("DATABASE_URL is not set (check your .env)")

    engine = create_engine(database_url)
    connection = engine.connect()
    
    # Truncate tables to ensure database is clean for tests
    from sqlalchemy import text
    connection.execute(text(
        "TRUNCATE TABLE "
        "kiittime.class_sessions, "
        "kiittime.roll_number_mappings, "
        "kiittime.sections, "
        "kiittime.courses, "
        "kiittime.faculty, "
        "kiittime.rooms, "
        "kiittime.bronze_snapshots, "
        "kiittime.announcements "
        "CASCADE"
    ))
    # Some SQLAlchemy versions auto-commit, some require manual commit on connection
    try:
        connection.commit()
    except Exception:
        pass

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
