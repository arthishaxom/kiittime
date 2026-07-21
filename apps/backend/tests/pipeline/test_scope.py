import pytest
from pydantic import ValidationError

from backend.pipeline.scope import UpsertScope


def test_requires_exactly_one_of_section_ids_or_year():
    with pytest.raises(ValidationError):
        UpsertScope()


def test_rejects_combining_section_ids_and_year():
    with pytest.raises(ValidationError):
        UpsertScope(section_ids=[1], year=1)


def test_section_ids_scope_matches_only_listed_sections():
    scope = UpsertScope(section_ids=[1, 2])
    assert scope.matches(1, None) is True
    assert scope.matches(3, None) is False


def test_year_scope_matches_only_that_year():
    scope = UpsertScope(year=2)
    assert scope.matches(1, 2) is True
    assert scope.matches(1, 3) is False
