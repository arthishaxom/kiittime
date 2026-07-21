Type: task
Status: completed
Blocked by: 01

Create `packages/api` and move duplicated logic (`api.ts`, `announcements.ts`, `utils.ts`, `share.ts`, `storage.ts`) from the apps into this shared package.
Best practices to enforce:
1. Use scoped naming: `"name": "@kiittime/api"` in its `package.json`.
2. Define modern module resolution using the `"exports"` field in `package.json` to clearly expose entry points.
3. Establish a strict `tsconfig.json` that extends from the global `@kiittime/tsconfig`. Set `"module": "ESNext"` and `"moduleResolution": "Bundler"` to properly support source-level bundling without `.js` extension errors.
