# Wayfinder Map: Monorepo & Docs Setup

## Notes / Fog
- Expo requires `nodeLinker: hoisted` in the `pnpm-workspace.yaml`.
- The Python backend will be orchestrated via a dummy `package.json` inside `apps/backend/` that runs `uv`.
- The shared logic sits in `packages/api` and is consumed by webapp, admin-webapp, and mobile.

## Decisions So Far
- Use Turborepo for task orchestration.
- Use a single root `pnpm-workspace.yaml` targeting `apps/*` and `packages/*`.
- Do not use MkDocs yet; stick to Markdown files in `docs/`.
- Clean up subpackage lockfiles (`pnpm-lock.yaml`) and local `node_modules` folders.
- Organize projects under an `apps/` subfolder.
- Pin matching core dependency versions globally using `pnpm.overrides` and bypass warnings using `peerDependencyRules`.
- Work is tracked under [01-root-workspace-setup.md](file:///C:/Users/ashis/kiittime/.scratch/monorepo-docs-setup/issues/01-root-workspace-setup.md) (resolved).


