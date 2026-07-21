Type: task
Status: completed

Establish root workspace setup with standard conventions and best practices:
1. Move existing applications (`webapp`, `admin-webapp`, `mobile`, `backend`) to a new `apps/` subdirectory.
2. Update root `pnpm-workspace.yaml` to target `apps/*` and `packages/*`.
3. Delete all local `pnpm-lock.yaml` and `node_modules/` from individual subfolders (`webapp/`, `admin-webapp/`, `mobile/`, etc.).
4. Configure `pnpm.overrides` and `pnpm.peerDependencyRules` in the root `package.json` to resolve core library conflicts (React 19, Tailwind, type definitions).
5. Clean install dependencies from the root.
6. Create a shared `@kiittime/tsconfig` package in `packages/tsconfig` containing global base configurations (`base.json`, `react.json`, `react-native.json`).
