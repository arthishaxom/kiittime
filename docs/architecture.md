# Architecture & Workspace Scaffolding Guide

This document details the architectural conventions, scoping, and directory layout of the KIIT Time monorepo. Follow these guidelines when creating or modifying workspaces.

---

## 📂 Directory Layout

* **`apps/`**: Complete deployment targets.
  * `admin-webapp` — Vite + React SPA for admins.
  * `backend` — Python FastAPI server.
  * `mobile` — React Native Expo application.
  * `webapp` — Vite + React PWA for students.
* **`packages/`**: Shared libraries and build utilities.
  * `api` — Shared client SDK (storage, networking, state).
  * `tsconfig` — Shared TSConfigs.

---

## 🏷 Workspace Naming & Scoping Conventions

All package/app workspace names must be scoped under `@kiittime/*` inside their `package.json`.

* **Apps**: Name must match `@kiittime/<app-name>` (e.g., `@kiittime/admin-webapp`).
* **Packages**: Name must match `@kiittime/<package-name>` (e.g., `@kiittime/api`).

---

## 📦 How to Scaffold a New Workspace

### Step 1: Create the Directory
Create a new folder in either `apps/` or `packages/`:
```bash
mkdir packages/helper-utils
```

### Step 2: Initialize `package.json`
Define the scoped name and workspace references:
```json
{
  "name": "@kiittime/helper-utils",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "devDependencies": {
    "@kiittime/tsconfig": "workspace:*",
    "typescript": "^6.0.2"
  }
}
```

### Step 3: Configure TypeScript (`tsconfig.json`)
Every TS package must extend the shared `@kiittime/tsconfig` configs.

Create `tsconfig.json`:
```json
{
  "extends": "@kiittime/tsconfig/base.json",
  "compilerOptions": {
    "declaration": true,
    "declarationMap": true
  },
  "include": ["src/**/*"]
}
```

Available base configs in `@kiittime/tsconfig`:
* `@kiittime/tsconfig/base.json` — Standard Node/ESModule environments.
* `@kiittime/tsconfig/react.json` — React web environments.
* `@kiittime/tsconfig/react-native.json` — Expo/React Native environments.

### Step 4: Configure Biome or ESLint
* **Vite/React Web apps**: Add a `biome.json` at the workspace root, extending recommended rules.
* **React Native / Expo apps**: Install and configure ESLint using Expo's flat config pattern.

### Step 5: Install Dependencies
Run `pnpm install` at the root of the monorepo to register the new workspace in the node modules lockfile and link dependencies.

---

## 🔗 Importing Local Workspaces
To consume another package in your workspace, add it as a `workspace:*` dependency:
```json
{
  "dependencies": {
    "@kiittime/api": "workspace:*"
  }
}
```
pnpm automatically links this dependency, allowing instant updates and type-safety across boundaries.
