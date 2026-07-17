# 4. CI Pipeline (Lint/Typecheck/Test as a Merge Gate)

Date: 2026-07-16

## Status

Accepted

## Context

No CI existed prior to this decision — no `.github/workflows`, no branch protection. Every project (`backend`, `webapp`, `admin-webapp`, `mobile`) already has working `lint`/`test` scripts, but nothing runs them automatically. `webapp` and `admin-webapp` deploy via Vercel's native GitHub integration (auto-deploy on push to `main`); `backend` deploys the same way via Render's native GitHub integration. `mobile` has no equivalent push-to-deploy path — app store releases go through manual review regardless, and `eas.json`'s production Android profile currently uses `credentialsSource: "local"` (signing keystore lives on a dev machine, not EAS's cloud credential store).

Because Vercel/Render already deploy directly off `main`, running CI *on* `main` would race the deploy rather than gate it. The only point where CI can actually prevent broken code from reaching production is the PR merge itself.

Additionally: none of the three TypeScript projects have a `typecheck` script — Biome doesn't type-check, and `vite build` (esbuild-based) doesn't fail on type errors, so a real type error currently passes lint, passes build, and can be merged/deployed uncaught. Backend tests (`backend/tests/pipeline/conftest.py`) require a real Postgres — SAVEPOINT-based per-test isolation, `JSONB` columns in `db/models.py` — and are not portable to SQLite or a mocked engine.

## Decision

**Merge-gate model, not a deploy pipeline.** GitHub Actions' only job is to run lint/typecheck/test on every PR and be required via branch protection on `main`. Vercel/Render's existing dashboard-configured auto-deploy is untouched — CI's job is making sure only passing code can reach `main` in the first place, not triggering or coordinating the deploys themselves.

**Four separate workflow files**, one per project (`backend-ci.yml`, `webapp-ci.yml`, `admin-webapp-ci.yml`, `mobile-ci.yml`) — right-sized per community guidance for <5 services (a single orchestrator+matrix workflow is the recommended shape at 5+ services, not before). Each workflow:
- Triggers on **every** `pull_request` targeting `main` (not path-filtered at the trigger level — see below) and on `push` to any branch for fast feedback while iterating.
- Uses `dorny/paths-filter` as an internal step to detect whether that project's files actually changed, conditionally skipping the lint/test/typecheck steps if not. **Not** top-level `on.pull_request.paths` filtering — GitHub required status checks stay stuck "pending" forever on a workflow that never triggers, silently blocking merges on unrelated PRs. Filtering inside the job (so it always runs, just conditionally skips work) keeps required checks consistently reporting pass/skip.
- Includes `.github/workflows/**` itself in the paths-filter set, so edits to CI config re-validate themselves.

**Per-project pipeline contents:**
- `backend-ci.yml`: `postgres:17` service container (image pinned to match `docker-compose.yml`, not `latest`) → `uv sync --group dev` → `uv run alembic upgrade head` (against the service container) → `uv run ruff check` → `uv run pytest`. Chosen over Testcontainers-python: no fixture rewrite needed (the existing SAVEPOINT-based `conftest.py` fixture just needs *a* running `DATABASE_URL`), no new Python dependency, and the portability Testcontainers buys (same containers across CI providers) isn't needed on a single-provider setup.
- `webapp-ci.yml` / `admin-webapp-ci.yml`: `pnpm install --frozen-lockfile` → `pnpm typecheck` (new script, `tsc --noEmit` or `tsc -b --noEmit`, added to `package.json` — currently missing entirely, so type errors pass silently through both lint and build today) → `pnpm lint` (Biome) → `pnpm test` (Vitest).
- `mobile-ci.yml`: `pnpm install --frozen-lockfile` → `pnpm typecheck` (new script) → `pnpm lint` (`expo lint`) → `pnpm test` (Jest). EAS build/submit is explicitly **not** automated in this pass — stays a manual, developer-run `eas build`/`eas submit` step, since `credentialsSource: "local"` means the signing keystore isn't in EAS's cloud store yet; migrating that is a separate future decision with its own security tradeoffs.

**Toolchain pinning** — kills an already-existing drift (`eas.json` pins `pnpm@10.12.1`, local dev is on `pnpm@11.12.0`):
- Add `"packageManager": "pnpm@11.12.0"` to each JS project's `package.json` (enables Corepack enforcement locally, not just in CI) and bump `eas.json`'s pnpm pin to match.
- `actions/setup-node` pinned to Node 22 in all three JS workflows.
- `astral-sh/setup-uv` (or `actions/setup-python` pinned to 3.14) in `backend-ci.yml`, matching `requires-python = ">=3.14"`.

**Branch protection on `main`**: require the relevant per-project check(s) to pass before merge — a PR that only touches `mobile/` only needs `mobile-ci` to pass (the others report "skip" via the `paths-filter` step, not "pending").

## Consequences

- No new deploy secrets/tokens needed in GitHub Actions for `webapp`/`admin-webapp`/`backend` — Vercel/Render keep owning deployment entirely through their own dashboards.
- `mobile` CD (automated EAS build/submit) remains a manual step and a follow-up decision, gated on migrating off `credentialsSource: "local"`.
- A whole class of previously-invisible type errors is now caught before merge, at the cost of one new script per TS project and marginally longer CI runs.
- Backend CI takes on the cost of a live Postgres service container + running migrations on every relevant PR — heavier than a mocked/SQLite suite, but matches this repo's existing testing philosophy (real Postgres locally via `docker-compose.yml`, SAVEPOINT-isolated real-DB tests) rather than diverging from it.
- Adding `dorny/paths-filter` as a third-party action is a small supply-chain surface increase, standard/widely-used for this exact problem.
