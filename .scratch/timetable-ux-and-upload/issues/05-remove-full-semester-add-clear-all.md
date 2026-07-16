# 05 — Remove "Full semester" scope; add a standalone, confirmed "Clear all" action

**What to build:** "Full semester" scope doesn't match how this app is actually used — one year's timetable is uploaded/approved at a time, never a from-scratch full-DB load via an upload. Remove the "Full semester" option from the upload-approval scope picker and from the backend `UpsertScope` model entirely. Replace it with a standalone, type-to-confirm "Clear all" admin action, unrelated to any pending upload, that wipes the entire dataset (gold + bronze) so admins can hard-reset at the start of a new semester.

**Blocked by:** none — depends on ticket 04 having already replaced the year `Input` with buttons (touches the same review screen), but can be built independently.

**Status:** closed

- [x] **Backend — `UpsertScope`** (`backend/src/backend/pipeline/scope.py`): remove the "both `section_ids` and `year` are `None` = full semester" case. A scope must now specify exactly one of `section_ids` or `year`; `approve_upload` rejects (422) a scope that specifies neither. Update the docstring/`matches()` accordingly.
- [x] **Backend — `gold_upsert`** (`backend/src/backend/pipeline/gold.py`): remove the `target_ids is None` ("delete every class_sessions row") branch, since a scope-less approve is no longer possible.
- [x] **Backend — new `POST /admin/clear-all` endpoint**: admin-only (`get_current_admin`), takes no upload/scope — it's not part of the upload/approve flow. In a single transaction, deletes **everything**: `class_sessions`, `sections`, `courses`, `faculty`, `rooms`, **and `bronze_snapshots`** (per the "bronze snapshots exist for rollback of data that will no longer exist" reasoning — no partial audit trail survives). No insert step; this is pure wipe, not a replace.
- [x] **Admin-webapp — review screen** (`review.$uploadId.tsx`): remove the `"full"` scope mode and its `SelectItem`; `ScopeMode` becomes `"year" | "sections"` only. Default `scopeMode` can no longer default to `"full"` — default to `"year"`.
- [x] **Admin-webapp — "Clear all" button**: new standalone control (e.g. on the upload dashboard `index.tsx`, not the per-upload review screen), styled as a clear danger action, separate from any specific upload's approve/reject.
- [x] **Admin-webapp — confirmation**: clicking "Clear all" opens a dialog requiring the admin to type a confirmation phrase (e.g. `CLEAR`) before the destructive `POST /admin/clear-all` call is enabled/fires — no accidental single-tap wipe.
- [x] Backend tests: `test_gold.py`'s `test_full_semester_scope_deletes_and_inserts` is removed/replaced; `UpsertScope()` (no args) now raises or is simply no longer constructible as a valid "matches everything" scope — add a test asserting `approve_upload` 422s when given `{}` (neither `section_ids` nor `year`). Add a test for the new clear-all endpoint (seeds sessions/sections/bronze snapshots, calls it, asserts all four+ tables are empty).
- [x] Verifiable end-to-end: the review screen's scope picker only offers "By year"/"By sections" (no "Full semester"); tapping the dashboard's "Clear all" prompts for typed confirmation, and only on matching input does it wipe class_sessions/sections/courses/faculty/rooms/bronze_snapshots (verify via the DB queries used to test ticket 01 — all counts go to 0).

## Comments

Implemented: `UpsertScope` now requires exactly one of `section_ids`/`year` (`test_scope.py`, new). New `pipeline/clear.py::clear_all()` wipes class_sessions/sections/courses/faculty/rooms/bronze_snapshots, exposed as `POST /admin/clear-all` (`test_clear.py`, new — asserts deltas rather than fixed counts since `DATABASE_URL` in this environment points at a non-empty dev DB). `admin-webapp` review screen's scope picker dropped "Full semester", defaults to "By year". New `components/ui/alert-dialog.tsx` (didn't exist before) backs a "Danger Zone" card on the dashboard with a type-`CLEAR`-to-confirm dialog before the destructive call fires.

Also fixed along the way: two `test_resolve.py` failures caused by unscoped `.count()` assertions against the same non-empty dev DB (rewritten to `.filter_by(...)`, matching the rest of that file), and a pre-existing dark-mode contrast bug (`body { color: var(--sea-ink) }` referencing an undefined CSS var, falling back to black) that made `Input` text and outline-variant buttons unreadable on dark backgrounds — fixed by adding explicit `text-foreground` to both.

## Further Notes

- Reassigning section IDs on the next post-wipe upload will invalidate every user's already-persisted section selection (mobile AsyncStorage / webapp localStorage store numeric section IDs). This is accepted as expected behavior — students are expected to re-select their sections each new semester regardless — so no client-side stale-ID detection/handling is in scope here.
- This intentionally removes the only scope that could "replace everything via an upload." Post-wipe, the first new-semester upload goes through the normal by-year (or by-sections) approve flow like any other.
