Status: ready-for-agent

## Problem Statement

The web and mobile platforms of KIIT Time currently have several inconsistencies regarding timetable sharing, section selection limits, and cross-platform navigation:
1. When sharing a single section from the mobile app, the webapp crashes to an empty view because its routing schema cannot handle a single un-arrayed number.
2. When sharing from the webapp, the URL contains a JSON-stringified array (e.g., `?section_id=%5B1%5D`) which breaks Expo Router's deep linking in the mobile app if an Android user taps it.
3. The webapp allows users to select an unlimited number of sections, while the mobile app limits selection to 5 sections.
4. Deep linking (Android App Links) is not fully set up to seamlessly open `kiittime.apothal.dev` links inside the mobile app.
5. Android users visiting the webapp are not currently informed about or directed to download the native mobile app.

## Solution

We will standardize URL sharing across platforms to use standard repeating query parameters (`?section_id=1&section_id=2`), aligning the webapp with the mobile app. We will enforce identical section limits (max 5) on the webapp. Finally, we will implement full Android deep linking by verifying domain ownership (`assetlinks.json`) and adding an unobtrusive "Download Mobile App" button inside the webapp's Settings bottom sheet to gracefully push Android web users toward the mobile app.

## User Stories

1. As a student sharing my timetable from the mobile app, I want my friends on the web to be able to open my link seamlessly, even if I only share a single section, so that my schedule is visible.
2. As a student sharing my timetable from the webapp, I want the generated URL to use standard URL parameters so that if a friend opens it on their Android phone, the KIIT Time native app can intercept and parse it flawlessly.
3. As an Android user opening a `kiittime.apothal.dev` URL, I want it to open directly in the KIIT Time mobile app without showing an intent chooser, so that I get a faster, native experience.
4. As a webapp user configuring my timetable, I want to be restricted to selecting at most 5 sections, so that my experience matches the mobile app constraints and prevents the UI from becoming unreadable.
5. As an Android user browsing the KIIT Time webapp, I want to see a visible "Download Android App" button in the Settings, so that I can easily switch to the smoother native experience.
6. As a student sharing my timetable, I want the shared message to include a link to download the native app, so that my friends can discover the native app easily.

## Implementation Decisions

- **Routing & Schema Changes (Webapp):**
  - Update `searchSchema` in `webapp/src/routes/timetable.tsx` to handle both single numeric values (coercing them to arrays) and arrays of numbers to support incoming links from the mobile app.
- **Share Link Generation (Webapp):**
  - Update `webapp/src/lib/share.ts` to construct the share URL manually. It will use `window.location.origin` and append `section_id` parameters individually (`?section_id=1&section_id=2`) instead of reading `window.location.href`.
  - Update the dynamically generated share text to include "📱 Get the KIIT Time app: [Link]" when appropriate.
- **Share Link Generation (Mobile App):**
  - Update `WEBAPP_URL` in `mobile/src/lib/share.ts` from `https://kiittime.vercel.app` to the new production URL `https://kiittime.apothal.dev`.
- **Section Selection Limit (Webapp):**
  - Update `webapp/src/routes/select/sections.tsx` to enforce a `MAX_SECTIONS = 5` limit. If the user hits 5 sections, disable further selection and show a "Max 5 sections" inline warning text, mimicking `mobile/src/app/select/sections.tsx`.
- **Android Deep Linking (Mobile):**
  - Modify `mobile/app.config.js` to add an `intentFilters` configuration for `kiittime.apothal.dev` with `autoVerify: true`.
- **Android Deep Linking (Webapp):**
  - Add `webapp/public/.well-known/assetlinks.json` containing the required JSON structure to prove domain ownership for the Android app. Placeholder SHA-256 fingerprints will be used for now.
- **Cross-Promotion UX (Webapp):**
  - Update `webapp/src/routes/timetable.tsx` (the Settings bottom sheet component) to include a "Download Mobile App" button (with a smartphone icon) when the `navigator.userAgent` indicates an Android device.

## Testing Decisions

- **Testing Seams:**
  - Share logic will be tested at the unit level. We will add a `webapp/src/lib/__tests__/share.test.ts` (if testing framework exists) to assert that the generated URL strictly matches standard repeating query parameters.
  - Zod search schema will be tested by running the web application and simulating navigation with `?section_id=1`.
  - The `MAX_SECTIONS` limit will be tested manually or via unit tests for the component's state constraint logic.
  - Deep linking (`assetlinks.json` and `intentFilters`) is an integration-level boundary and will be verified manually via build tools and the Android `adb shell am start` command in a later phase.

## Out of Scope

- Implementing iOS universal links (`apple-app-site-association`). This will be handled in a separate ticket when iOS deployment is prioritized.
- Writing E2E tests for the native Android App Links mechanism.

## Further Notes

- Placeholder links will be used for the Android Play Store download button. The developer must swap them out once the app is published.
- The SHA-256 fingerprint in `assetlinks.json` is a placeholder ("XX:XX:...") and must be updated with the actual fingerprint via EAS credentials before App Links will auto-verify on devices.
