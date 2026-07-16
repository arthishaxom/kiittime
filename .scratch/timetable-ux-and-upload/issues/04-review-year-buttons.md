# 04 — Replace year number input with 1–4 buttons on the review/approve screen

**What to build:** On the upload-review screen (`admin-webapp/src/routes/_authenticated/review.$uploadId.tsx`), replace the free-text numeric `Year` input shown for "By year" scope with a row of four buttons (1/2/3/4), matching the year picker already used on the upload screen (`admin-webapp/src/routes/_authenticated/index.tsx`).

**Blocked by:** none — the underlying `year`-scope plumbing (ticket 01) is already implemented and working, verified end-to-end against the DB.

**Status:** closed

- [x] Replace the `<Input id="year" type="number" ...>` in the `scopeMode === "year"` block with four `Button`s (values 1–4), styled and behaving like the upload screen's year picker (`variant={year === y ? "default" : "outline"}`, `flex-1`, `onClick={() => setYear(y)}`).
- [x] Change `year` state from `string` to `number | null` (mirrors the upload screen's `useState<number | null>(null)`) so it can drive button selection directly, instead of parsing free text.
- [x] Update `buildScopeBody` to accept `number | null` for `year` instead of parsing a string, and its call site in `approveMutation`.
- [x] No `Input`/`Label htmlFor="year"` left over from the old numeric-input version.
- [x] Verifiable end-to-end: opening a pending upload's review page, selecting "By year" scope shows four tappable year buttons (not a text box); the selected button is visually highlighted; approving sends the correct `year` value in the request body (confirm via network tab or backend logs).

## Comments

Implemented via TDD (seam: `buildScopeBody`, confirmed with user first). Extracted `buildScopeBody` from `review.$uploadId.tsx` into `admin-webapp/src/lib/scope.ts` so it's testable; `admin-webapp/src/lib/__tests__/scope.test.ts` covers year/null/sections/full modes (4/4 pass via `pnpm test`, first test file introduced in admin-webapp — vitest tooling already existed, unused until now). `year` state is now `number | null`, driving four highlight-on-select buttons matching the upload screen. `tsc --noEmit` clean aside from one pre-existing unrelated error in `_authenticated.tsx`.
