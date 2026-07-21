Type: task
Status: open
Blocked by: 02

Update `webapp`, `admin-webapp`, and `mobile` to consume `@kiittime/api`.
Best practices to enforce:
1. Add the dependency using the PNPM workspace protocol: `"@kiittime/api": "workspace:*"` in each app's `package.json`.
2. Ensure bundlers correctly transpile the shared package (Vite handles this natively, but Expo's `metro.config.js` may require `watchFolders` and `nodeModulesPaths` adjustments for monorepo support).
3. Delete redundant local wrapper files (e.g., `apps/mobile/src/lib/storage.ts` that just re-export the package) and update all app components to import directly from `@kiittime/api` (e.g., `import { storage } from "@kiittime/api/storage";`).
4. Update `tsconfig.json` in all apps to extend from the appropriate shared configuration in `@kiittime/tsconfig`.
