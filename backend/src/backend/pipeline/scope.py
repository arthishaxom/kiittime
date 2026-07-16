from pydantic import BaseModel, model_validator


class UpsertScope(BaseModel):
    """Describes which sections a gold upsert is allowed to touch.

    - Both fields None  -> "full semester" (no filter, everything in scope).
    - section_ids set   -> only those sections are in scope.
    - year set          -> only sections in that academic year are in scope.
    - Both set          -> invalid; we have no defined semantics for combining
                           them yet, so we refuse to guess and raise.
    """

    section_ids: list[int] | None = None
    year: int | None = None

    @model_validator(mode="after")
    def _reject_combined_scope(self) -> "UpsertScope":
        if self.section_ids is not None and self.year is not None:
            raise ValueError("UpsertScope cannot combine section_ids and year yet")
        return self

    def matches(self, section_id: int, section_year: int | None) -> bool:
        """Return whether a section falls inside this scope.

        `section_year` is only consulted when year scoping is used; it is
        ignored otherwise (and may be None).
        """
        if self.section_ids is not None:
            return section_id in self.section_ids
        if self.year is not None:
            return section_year == self.year
        return True
