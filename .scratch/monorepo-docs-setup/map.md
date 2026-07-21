# Wayfinder Map: Monorepo & Docs Setup

## Notes / Fog
- Expo requires `nodeLinker: hoisted` in the `pnpm-workspace.yaml`.
- The Python backend will be orchestrated via a dummy `package.json` inside `backend/` that runs `uv`.
- The shared logic sits in `packages/api` and is consumed by `webapp`, `admin-webapp`, and `mobile`.

## Decisions So Far
- Use Turborepo for task orchestration.
- Use a single root `pnpm-workspace.yaml`.
- Do not use MkDocs yet; stick to Markdown files in `docs/`.
