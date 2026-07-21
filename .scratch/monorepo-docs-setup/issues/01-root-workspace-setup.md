Type: task
Status: resolved

Establish root workspace setup with standard conventions and best practices:
1. Move existing applications (`webapp`, `admin-webapp`, `mobile`, `backend`) to a new `apps/` subdirectory.
2. Update root `pnpm-workspace.yaml` to target `apps/*` and `packages/*`.
3. Delete all local `pnpm-lock.yaml` and `node_modules/` from individual subfolders (`webapp/`, `admin-webapp/`, `mobile/`, etc.).
4. Configure `pnpm.overrides` and `pnpm.peerDependencyRules` in the root `package.json` to resolve core library conflicts (React 19, Tailwind, type definitions).
5. Clean install dependencies from the root.

## Answer
- Moved `webapp`, `admin-webapp`, `mobile`, and `backend` under `apps/` directory using `git mv`.
- Updated root `pnpm-workspace.yaml` to point to `apps/*` and `packages/*`.
- Cleaned up all package-level `node_modules/` and `pnpm-lock.yaml` files.
- Added `pnpm.overrides` and `pnpm.peerDependencyRules` configuration blocks to the root `package.json` to lock React 19 types/libraries and allow matching peer resolutions.


