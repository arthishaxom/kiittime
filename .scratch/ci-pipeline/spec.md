# CI Pipeline

**Status:** ready-for-agent

## Problem Statement

No CI exists anywhere in this repo — no `.github/workflows`, no branch protection. Every project (`backend`, `webapp`, `admin-webapp`, `mobile`) already has working `lint`/`test` scripts, but nothing runs them automatically, so broken code can be merged and — since `webapp`/`admin-webapp` (Vercel) and `backend` (Render) already auto-deploy on push to `main` via their own dashboard-configured git integrations — auto-deployed, with nothing in between catching it. Separately, none of the three TypeScript projects has a `typecheck` script; Biome doesn't type-check and `vite build`'s esbuild-based pipeline doesn't fail on type errors, so real type errors currently pass silently through both lint and build.

## Solution

A merge-gate CI pipeline: four per-project GitHub Actions workflows run lint/typecheck/test on every PR, made required via branch protection on `main`. Vercel and Render's existing auto-deploy stays completely untouched — CI's only job is ensuring nothing broken can reach `main` in the first place, not triggering or coordinating deploys itself. Mobile gets the same lint/test/typecheck gate; EAS build/submit stays a manual, developer-run step (out of scope here — see below).

## User Stories

1. As a developer opening a PR that touches `backend/`, I want lint, typecheck (N/A for Python — ruff covers this), and pytest to run automatically, so that I get fast feedback without running them locally myself.
2. As a developer opening a PR that touches only `mobile/`, I want only `mobile`'s CI to actually do work (not `backend`'s or the webapps'), so that unrelated CI doesn't waste time or create false signal.
3. As a developer, I want CI to be a required check on `main`, so that a PR literally cannot be merged while lint/typecheck/test are failing.
4. As a developer, I want a PR that doesn't touch a given project to still show that project's check as passing/skipped (not stuck "pending" forever), so that unrelated PRs aren't blocked by a check that never had a reason to run.
5. As a developer working in `webapp`/`admin-webapp`/`mobile`, I want a `typecheck` script that actually fails CI on type errors, so that type errors can no longer silently reach `main` the way they can today (neither Biome nor `vite build` catches them).
6. As a developer running backend tests locally or in CI, I want the same Postgres version (`17`) used in both places, so that test behavior doesn't diverge between my machine and CI.
7. As a developer, I want backend CI to run pending Alembic migrations against a fresh database before running tests, so that the test suite always runs against the current schema, matching how a developer sets up their local `docker-compose.yml` Postgres.
8. As a developer, I want Node, pnpm, and Python/uv versions pinned consistently across local dev, CI, and `eas.json` (which currently pins a different pnpm version than local dev uses), so that "works on my machine" drift stops being a source of confusing failures.
9. As a developer pushing to a feature branch (not yet a PR), I want CI to still run for fast feedback while iterating, so that I don't have to open a PR just to see if my change passes lint/tests.
10. As a maintainer, I want Vercel and Render's existing dashboard-configured auto-deploy to remain completely unchanged by this work, so that adopting CI doesn't require touching deploy credentials or re-plumbing anything on those platforms.
11. As a mobile developer, I want EAS build/submit to remain a manual, locally-run step for now, so that automating it isn't blocked on migrating the production Android signing keystore off `credentialsSource: "local"` — a separate decision with its own security tradeoffs.

## Implementation Decisions

- **Merge-gate model, not a deploy pipeline.** GitHub Actions never triggers or coordinates Vercel/Render deploys — those platforms keep deploying whatever lands on `main` via their own git integrations, exactly as today. CI's only responsibility is making sure only passing code can land on `main`.
- **Four separate workflow files**, one per project — right-sized for 4 services per community guidance (a single orchestrator+matrix workflow is the recommended shape at 5+ services, not before).
- **Trigger shape**: each workflow triggers on every `pull_request` targeting `main` and on every `push` to any branch (for fast local-iteration feedback) — **not** top-level `paths:`-filtered triggers. A required status check tied to a workflow that never triggers (because its trigger `paths:` excluded the PR's files) sits "pending" forever and blocks merge indefinitely, rather than reporting a skip. Instead, each workflow uses `dorny/paths-filter` as an internal step to detect whether that project's files changed, conditionally skipping the lint/typecheck/test steps if not — the job still runs and reports a real pass/skip result either way, keeping required checks consistent. `.github/workflows/**` itself is included in each project's path-filter set so CI-config edits re-validate themselves.
- **`backend-ci.yml`**: a `postgres:17` service container (image pinned to match `docker-compose.yml` exactly, not `latest`) → `uv sync --group dev` → `uv run alembic upgrade head` against the service container → `uv run ruff check` → `uv run pytest`. A real Postgres service container was chosen over Testcontainers-python: the existing SAVEPOINT-based test-isolation fixture (`tests/pipeline/conftest.py`) just needs *some* running `DATABASE_URL` and requires no rewrite; Testcontainers' multi-CI-provider portability isn't a need this single-provider repo has.
- **`webapp-ci.yml` / `admin-webapp-ci.yml`**: `pnpm install --frozen-lockfile` → new `typecheck` script (`tsc --noEmit` or `tsc -b --noEmit`) → `pnpm lint` (Biome) → `pnpm test` (Vitest).
- **`mobile-ci.yml`**: `pnpm install --frozen-lockfile` → new `typecheck` script → `pnpm lint` (`expo lint`) → `pnpm test` (Jest). No EAS build/submit step — that stays a manual, developer-run command.
- **Toolchain pinning**: add `"packageManager": "pnpm@11.12.0"` to each JS project's `package.json` (enables Corepack enforcement locally too) and bump `eas.json`'s pnpm pin from `10.12.1` to match, closing an already-existing version-drift gap. `actions/setup-node` pinned to Node 22 in all three JS workflows. `astral-sh/setup-uv` (or `actions/setup-python` pinned to 3.14) in `backend-ci.yml`, matching `requires-python = ">=3.14"` in `pyproject.toml`.
- **Branch protection on `main`**: require each project's CI check to pass before merge. A PR touching only one project shows the other three as skipped (via the internal `paths-filter` step), not pending.
- Implementation detail, not a separate decision: cache `pnpm`/`uv` package stores between runs for speed, and use a `concurrency` group per workflow+ref so a new push cancels a stale in-flight run rather than piling up runs.

## Testing Decisions

- This spec's "testing" is verifying the CI pipeline itself works, not application-level testing (that's `backend`/`webapp`/`admin-webapp`/`mobile`'s own existing test suites, which this pipeline now runs).
- Verification is inherently manual/observational: open a real PR touching only one project and confirm only that project's workflow does real work (others report skip, not pending); open a PR touching multiple projects and confirm all relevant workflows run; intentionally introduce a failing lint/typecheck/test in a throwaway branch and confirm the PR is blocked from merging by branch protection; confirm a PR touching only `docs/` or unrelated files doesn't get stuck on a pending check from any project.
- No automated test suite is proposed for the workflow YAML itself — this is standard practice; GitHub Actions workflows are conventionally verified by running them, not unit-tested.

## Out of Scope

- Automating EAS build/submit for `mobile` in CI — blocked on migrating the production Android signing keystore off `credentialsSource: "local"`, a separate future decision.
- Any GitHub-Actions-triggered or -coordinated deploy step for `webapp`/`admin-webapp`/`backend` — Vercel/Render's existing native git integrations own deployment entirely, untouched by this spec.
- Preview/staging environments, PR-specific preview deploys, or deployment protection rules — not addressed here.
- Consolidating the four workflows into a single orchestrator+matrix workflow — explicitly deferred until the project count grows past the ~5-service threshold where that pattern starts paying for itself.
- Migrating `mobile`'s signing credentials to EAS-managed cloud storage — a prerequisite for future EAS-in-CI work, not part of this spec.

## Further Notes

- See [ADR-0004](../../docs/adr/0004-ci-pipeline.md) for the full decision rationale, including the required-checks/path-filter gotcha this spec's trigger design specifically avoids.
- This spec has no ordering dependency on the [announcements](../announcements/spec.md) or [mobile offline hardening](../mobile-offline-hardening/spec.md) specs — CI will simply start running/gating whatever code lands, regardless of which feature work merges first.
