Type: task
Status: resolved

Create the root `pnpm-workspace.yaml` with `nodeLinker: hoisted`, the root `package.json` with Turborepo, and the `turbo.json` file. Remove individual workspace files from apps.

## Answer
- Created root `pnpm-workspace.yaml` with `nodeLinker: hoisted`.
- Created root `package.json` with Turborepo dependencies.
- Created root `turbo.json` with standard tasks (`build`, `dev`, `lint`, `test`, `format`).
- Removed `webapp/pnpm-workspace.yaml` and `mobile/pnpm-workspace.yaml`.
- Configured root `.gitignore` to ignore `node_modules` and `.turbo`.
- Executed `pnpm install` and verified workspace builds successfully via Turbo.

