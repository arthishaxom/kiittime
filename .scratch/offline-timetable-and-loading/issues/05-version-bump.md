Blocked by: 02, 03, 04
Status: resolved
Type: task

Version bump both the mobile and webapp projects after implementation of the features/improvements is complete.

- Because we are introducing new UX features (skeletons, summarized headers, offline dialogs), a **minor** version bump is appropriate under SemVer rules.
- Mobile: Navigate to the `mobile/` directory and run `pnpm version minor`. (This should update version from `2.2.0` to `2.3.0` in package.json).
- Webapp: Navigate to the `webapp/` directory and run `pnpm version minor`. (This should update version from `1.3.0` to `1.4.0` in package.json).
