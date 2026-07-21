# Monorepo and Docs Setup Spec

## Goal
Consolidate the polyglot stack into a unified Turborepo with a single PNPM workspace, extract duplicated API logic into a shared `@kiittime/api` package, and establish a proper documentation structure for future maintainers.

## Details
1. **Root Workspace:** Create a single `pnpm-workspace.yaml` at the root with `nodeLinker: hoisted` to fix Expo symlink issues while enabling code sharing.
2. **Turborepo:** Add `turbo.json` to orchestrate `dev`, `build`, and `lint` commands across the Python backend and JS frontends.
3. **Shared API Package:** Extract duplicated code (`api.ts`, `announcements.ts`, `utils.ts`, `storage.ts`, etc.) from `webapp`, `admin-webapp`, and `mobile` into `packages/api`.
4. **Documentation:** Create a clean, 100-line root `README.md` and a `docs/` structure (`setup.md`, `architecture.md`) without the overhead of MkDocs for now.
