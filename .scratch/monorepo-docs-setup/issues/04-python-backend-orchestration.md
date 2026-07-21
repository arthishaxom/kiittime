Type: task
Status: open
Blocked by: 01

Create a `package.json` in the `apps/backend/` folder that acts as a bridge for Turborepo to run `uv` commands.
Best practices to enforce:
1. Define a minimal wrapper `package.json` with `"name": "@kiittime/backend"` and `"private": true`. Do not add any JS dependencies.
2. Delegate scripts to your Python tools using the `-m` flag. To bypass the buggy `fastapi-cli` entirely (which crashes on Windows due to emojis/rich terminal output), use Uvicorn directly: `"dev": "uv run python -m uvicorn api:app --reload"`, `"test": "uv run python -m pytest"`. *Note: `python -m` is critical on Windows to avoid the "failed to canonicalize script path" error.*
3. Ensure the root `turbo.json` caches the Python outputs/inputs correctly (e.g., by recognizing `uv.lock` or `pyproject.toml` changes).

