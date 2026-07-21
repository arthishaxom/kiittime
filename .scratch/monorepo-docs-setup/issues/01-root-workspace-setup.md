Type: task
Status: open

Establish root workspace setup with standard conventions and best practices:
1. Move existing applications (`webapp`, `admin-webapp`, `mobile`, `backend`) to a new `apps/` subdirectory.
2. Update root `pnpm-workspace.yaml` to target `apps/*` and `packages/*`.
3. Delete all local `pnpm-lock.yaml` and `node_modules/` from individual subfolders (`webapp/`, `admin-webapp/`, `mobile/`, etc.).
4. Configure `overrides` and `peerDependencyRules` in `pnpm-workspace.yaml` (pnpm v11+ standard) to resolve core library conflicts (React 19, Tailwind, type definitions).
5. Clean install dependencies from the root.
6. Create a shared `@kiittime/tsconfig` package in `packages/tsconfig` containing global base configurations (`base.json`, `react.json`, `react-native.json`).
7. Add convenience script aliases to the root `package.json` to boot specific stacks, including `"dev:mobile"`, `"dev:web"`, and a specific `"dev:core"` that runs mobile, webapp, and backend at once (`turbo run dev --filter=@kiittime/mobile --filter=@kiittime/webapp --filter=@kiittime/backend`).

## Answer

Convenience script aliases have been successfully added to the root [package.json](file:///C:/Users/ashis/kiittime/package.json):
* `"dev:mobile"`: `"turbo dev --filter=@kiittime/mobile"`
* `"dev:web"`: `"turbo dev --filter=@kiittime/webapp --filter=@kiittime/admin-webapp"`
* `"dev:core"`: `"turbo dev --filter=@kiittime/mobile --filter=@kiittime/webapp --filter=@kiittime/backend"`
