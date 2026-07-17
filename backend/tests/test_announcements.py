from backend.api.dao.announcement_dao import (
    create_announcement,
    deactivate_current,
    get_current_announcement,
)


def make_announcement(db, **overrides):
    defaults = dict(
        title="Timetable live",
        body="The new semester timetable is up.",
        link_label=None,
        link_url=None,
        created_by="tester",
    )
    defaults.update(overrides)
    return create_announcement(db, **defaults)


def test_create_announcement_deactivates_prior_active_row(db):
    first = make_announcement(db, title="First")
    second = make_announcement(db, title="Second")

    db.flush()
    db.refresh(first)

    assert first.is_active is False
    assert second.is_active is True


def test_get_current_announcement_returns_most_recent_active(db):
    make_announcement(db, title="First")
    second = make_announcement(db, title="Second")

    current = get_current_announcement(db)

    assert current is not None
    assert current.id == second.id


def test_get_current_announcement_returns_none_when_no_active(db):
    assert get_current_announcement(db) is None


def test_deactivate_current_clears_active_row_without_inserting(db):
    announcement = make_announcement(db)

    deactivate_current(db)
    db.refresh(announcement)

    assert announcement.is_active is False
    assert get_current_announcement(db) is None


def test_deactivate_current_is_noop_when_nothing_active(db):
    deactivate_current(db)

    assert get_current_announcement(db) is None
