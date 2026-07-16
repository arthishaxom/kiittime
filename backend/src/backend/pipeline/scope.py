from pydantic import BaseModel, model_validator


class UpsertScope(BaseModel):
    """Describes which sections a gold upsert is allowed to touch.

    Exactly one of the two fields must be set:
    - section_ids set -> only those sections are in scope.
    - year set        -> only sections in that academic year are in scope.

    There is no "match everything" scope (that was the removed "full
    semester" mode) — a full reset goes through the standalone clear-all
    action instead, not a scoped upsert.
    """

    section_ids: list[int] | None = None
    year: int | None = None

    @model_validator(mode="after")
    def _require_exactly_one_scope(self) -> "UpsertScope":
        if (self.section_ids is None) == (self.year is None):
            raise ValueError("UpsertScope requires exactly one of section_ids or year")
        return self

    def matches(self, section_id: int, section_year: int | None) -> bool:
        """Return whether a section falls inside this scope.

        `section_year` is only consulted when year scoping is used; it is
        ignored otherwise (and may be None).
        """
        if self.section_ids is not None:
            return section_id in self.section_ids
        return section_year == self.year
