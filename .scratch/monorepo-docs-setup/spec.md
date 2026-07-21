# Monorepo and Docs Setup Spec

## Goal
Consolidate the polyglot stack into a unified Turborepo with a single PNPM workspace, extract duplicated API logic into a shared `@kiittime/api` package, and establish a proper documentation structure for future maintainers using industry-standard monorepo best practices.

## Details
1. **Root Workspace & Structure:** Move all applications into an `apps/` folder (`apps/webapp`, `apps/admin-webapp`, `apps/mobile`, `apps/backend`). Create a single `pnpm-workspace.yaml` at the root directing to `apps/*` and `packages/*`. Enable `nodeLinker: hoisted` to support Expo/React Native requirements.
2. **Lockfile & Node Modules Hygiene:** Delete all subpackage-level `pnpm-lock.yaml` and `node_modules/` folders. Restructure to enforce a single source-of-truth lockfile at the workspace root.
3. **Global Resolutions & Peer Overrides:** Add a `pnpm` config block in the root `package.json` defining `overrides` (for pinning matching React, Tailwind, and Type versions) and `peerDependencyRules.ignoreMissing` to ignore React 18 peer warnings from older libraries.
4. **Turborepo:** Add `turbo.json` to orchestrate `dev`, `build`, and `lint` commands across the Python backend and JS frontends.
5. **Shared API Package:** Extract duplicated code (`api.ts`, `announcements.ts`, `utils.ts`, `storage.ts`, etc.) from apps into `packages/api`.
6. **Documentation:** Create a clean, 100-line root `README.md` and a `docs/` structure (`setup.md`, `architecture.md`).

