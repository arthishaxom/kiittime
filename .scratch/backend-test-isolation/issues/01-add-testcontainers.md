# 01 - Add Testcontainers Dependency

## Task
Add the `testcontainers` and `testcontainers[postgres]` dependency to the backend.

## Instructions
1. Navigate to the `backend/` directory.
2. Update the Python dependency management (this project appears to use `uv` and `pyproject.toml`).
3. Run `uv add --dev "testcontainers[postgres]"` (or equivalent) to add the package as a development/testing dependency.
4. Ensure the lockfile (`uv.lock`) is correctly updated and committed.
