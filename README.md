# KIIT Time Monorepo

A modern monorepo for the KIIT Time timetable and announcement system.

## 🚀 Quick Start (1-Command Startup)

Install dependencies and start all applications (web, admin web, mobile, and backend) concurrently:

```bash
pnpm install && pnpm dev
```

---

## 🛠 Working with Workspace Filters

Manage apps and packages from the root without changing directories (`cd`):

### Running Development Servers
* **All Apps:** `pnpm dev`
* **Student Web App:** `pnpm --filter @kiittime/webapp dev`
* **Admin Web App:** `pnpm --filter @kiittime/admin-webapp dev`
* **Mobile App:** `pnpm --filter @kiittime/mobile dev` *(Uses `pnpm expo` under the hood)*
* **Backend API:** `pnpm --filter @kiittime/backend dev`

### Package Management (Adding/Removing Dependencies)
* **Add dependency to a specific workspace:**
  ```bash
  pnpm --filter @kiittime/api add lodash
  ```
* **Add dev dependency to a specific workspace:**
  ```bash
  pnpm --filter @kiittime/mobile add -D @types/jest
  ```

---

## 💻 IDE Configurations & Editor Setup

To prevent false-positive red squiggles and ensure linting, formatting, and TypeScript auto-detect project boundaries:

1. **Workspace Settings (`.vscode/settings.json`):** 
   Configures ESLint and Biome to treat each subdirectory in `apps/*` and `packages/*` as independent project roots.
2. **Extensions Recommended:**
   * **Biome** (for `@kiittime/webapp` and `@kiittime/admin-webapp`)
   * **ESLint** (for `@kiittime/mobile`)
   * **TypeScript and JavaScript Language Features** (built-in, automatically resolves paths via `@kiittime/tsconfig`)

---

## 📂 Repository Structure

* `apps/`
  * [webapp](file:///C:/Users/ashis/kiittime/apps/webapp) — Student Web application (Vite + React)
  * [admin-webapp](file:///C:/Users/ashis/kiittime/apps/admin-webapp) — Admin management application (Vite + React)
  * [mobile](file:///C:/Users/ashis/kiittime/apps/mobile) — React Native Expo application
  * [backend](file:///C:/Users/ashis/kiittime/apps/backend) — FastAPI server (Python)
* `packages/`
  * [api](file:///C:/Users/ashis/kiittime/packages/api) — Shared client APIs, storage, and utility functions
  * [tsconfig](file:///C:/Users/ashis/kiittime/packages/tsconfig) — Shared TypeScript configurations
* `docs/` — Architecture decisions and guides
