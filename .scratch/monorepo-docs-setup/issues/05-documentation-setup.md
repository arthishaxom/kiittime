Type: task
Status: resolved

Write the root `README.md` (under 100 lines, 1-command startup) and structure the `docs/` directory.
Best practices to enforce (Developer Experience Focus):
1. **Frictionless Onboarding:** Root README must demonstrate the 1-command startup (`pnpm install && pnpm dev`) and explicitly explain how to use `--filter` flags to run specific apps without `cd`-ing into directories.
2. **IDE Configurations:** Document how the `.vscode` workspace settings ensure Biome, ESLint, and TypeScript auto-detect the monorepo boundaries correctly so developers don't get false-positive red squiggles.
3. **Adding New Workspaces:** Create a guide in `docs/architecture.md` explaining the strict conventions (e.g., `@kiittime/*` scoping, extending `@kiittime/tsconfig`) so developers know exactly how to scaffold a new app or package.
4. **ADRs:** Establish the Architecture Decision Record standard in `docs/adr/` (integrating with existing ADRs).

## Answer

All tasks in this ticket have been successfully implemented:
1. **Root README**: Created a clean and concise [README.md](file:///C:/Users/ashis/kiittime/README.md) (46 lines) detailing the 1-command startup (`pnpm install && pnpm dev`), `pnpm --filter` usage rules, and IDE configuration details.
2. **IDE Configurations**: Configured `eslint.workingDirectories` in [.vscode/settings.json](file:///C:/Users/ashis/kiittime/.vscode/settings.json) to partition linting boundaries for each app/package and prevent red squiggles.
3. **Adding New Workspaces**: Wrote a developer-friendly workspace scaffolding and naming convention guide in [docs/architecture.md](file:///C:/Users/ashis/kiittime/docs/architecture.md).
4. **ADRs Standard**: Established the ADR standard in [docs/adr/README.md](file:///C:/Users/ashis/kiittime/docs/adr/README.md) along with [docs/adr/template.md](file:///C:/Users/ashis/kiittime/docs/adr/template.md) and indexed all 4 existing ADRs.
