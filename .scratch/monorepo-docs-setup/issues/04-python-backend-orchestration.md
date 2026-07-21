Type: task
Status: completed
Blocked by: 01

Create a `package.json` in the `apps/backend/` folder that acts as a bridge for Turborepo to run `uv` commands.
Best practices to enforce:
1. Define a minimal wrapper `package.json` with `"name": "@kiittime/backend"` and `"private": true`. Do not add any JS dependencies.
2. Delegate all scripts directly to your Python tools (e.g., `"dev": "uv run fastapi dev"`, `"test": "uv run pytest"`).
3. Ensure the root `turbo.json` caches the Python outputs/inputs correctly (e.g., by recognizing `uv.lock` or `pyproject.toml` changes).
