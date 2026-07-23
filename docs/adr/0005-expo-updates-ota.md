# 5. OTA Updates via expo-updates + EAS Update

Date: 2026-07-22

## Status

Accepted

## Context

KIIT Time is currently distributed solely through the Google Play Store. Every JS/asset change — no matter how small — requires a full binary rebuild, review queue wait, and manual student update. `app.config.js` already carries an `updates.url` pointing at `https://u.expo.dev/f7de0f76-...` and `runtimeVersion: { policy: "appVersion" }`, meaning the infrastructure is wired but `expo-updates` is not yet installed as a package and no update-check code exists in the app.

Adding `expo-updates` requires a native module — so the first rollout is a Play Store binary update. All subsequent JS/asset hotfixes can be delivered as OTA updates without a new binary, as long as no native-layer changes are made.

The existing ADR-0004 explicitly deferred mobile CD (automated `eas build`/`eas submit`) pending keystore migration. `eas update` has no signing surface — it only publishes a JS bundle — so OTA publishing can be manual from a dev machine using only an `EXPO_TOKEN`, independent of the keystore migration.

## Decision

**Install `expo-updates` and wire a silent check-on-launch / apply-on-next-launch strategy.**

- `expo-updates` is added as a package dep and its config plugin added to `app.config.js` plugins array.
- On every cold launch (production builds only), the app calls `Updates.checkForUpdateAsync()`. If an update is available it is downloaded silently via `Updates.fetchUpdateAsync()`. The update is **not** applied mid-session — it applies automatically on the next cold launch (`launchesUntilUpdate: 1` semantics via the default Expo behaviour).
- On the launch *after* a successful update has been applied, a brief dismissible toast ("App updated ✓") is shown using `sonner-native`, which is already installed. This is the only user-visible surface.
- All update logic is gated behind `!__DEV__` (and `Updates.isEmbeddedLaunch` check) so development builds are unaffected.

**Two OTA channels: `production` + `preview`.**

- `eas.json` gains an explicit `channel` field on the `preview` build profile (`"channel": "preview"`). Production already has `"channel": "production"`.
- Hotfixes go to `preview` first for internal validation, then `eas update --branch production` promotes to live users.

**Runtime version policy: unchanged (`appVersion`).**

- OTA updates only reach devices running the same `version` binary. If a native change ships (new dep, SDK bump), `version` is bumped in `package.json`, a new binary is built and submitted, and prior binaries naturally stop receiving updates.

**Rollback: EAS platform crash rollback + manual CLI.**

- EAS Update's built-in automatic crash rollback handles the catastrophic case (app crashes shortly after applying an update).
- Non-crash regressions are handled by `eas update:rollback` from the developer's terminal.
- No bespoke in-app crash detection layer is added.

**Publishing: automated via GitHub Actions (#60).**

- GitHub Actions workflow `.github/workflows/eas-build-update.yml` automatically triggers on push to `main` (and pull requests).
- Uses `dorny/paths-filter` to smartly distinguish between native and non-native changes:
  - **Native changes**: Runs `eas build --platform all --auto-submit` to trigger native builds and submission to app stores.
  - **Non-native (JS/asset) changes**: Runs `eas update --branch production` on push to `main` (or `--branch preview` on PR) to publish OTA updates automatically.

**Stallion migration exit condition (documented, not planned).**

React Native Stallion is the natural successor to CodePush and supports self-hosted OTA with differential patching (up to 98% smaller bundles). The trigger to migrate away from EAS Update would be MAU-driven cost pressure — if the per-MAU pricing on EAS Update becomes material at KIIT Time's scale. Bundle size is not currently a concern for a timetable app. Migration would require replacing `expo-updates` with the Stallion SDK and configuring a self-hosted or Stallion-managed server; the `runtimeVersion` concept maps 1:1.

## Consequences

- **First delivery requires a Play Store binary update.** `expo-updates` is a native module; the feature cannot ship as its own OTA. Version bump + `eas build` + Play Store review is required for the initial rollout.
- Students on older binaries (`v2.2.x`, `v2.2.x`) never receive OTA updates — they must update via Play Store. This is correct and expected given `appVersion` policy.
- OTA updates for JS/asset-only changes (copy tweaks, bug fixes, timetable display logic) no longer require a Play Store submission — they reach live users within minutes of `eas update`.
- The `preview` OTA channel gives the maintainer a safe staging lane to validate JS hotfixes on a real device before promoting to all live users.
- `__DEV__` guard ensures local development is completely unaffected by update logic.
- No new CI secrets or workflows are introduced in this pass.
