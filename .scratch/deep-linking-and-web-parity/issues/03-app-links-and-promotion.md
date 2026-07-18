# 03 — Implement App Links, Cross-Promotion & Dynamic Env Config

**What to build:** Centralize the mobile domain in environment variables and implement an end-to-end strategy for bridging web users to the mobile app. The mobile domain (formerly hardcoded to vercel) must now be dynamically loaded via `.env` and set to `kiittime.apothal.dev`. The mobile app requires intent filter configuration to act as the default handler for this domain on Android. The webapp must serve `assetlinks.json` to prove domain ownership. Additionally, the webapp should intelligently prompt Android users to download the native app via a new button in the Settings bottom sheet, and dynamic share messages should include the download link on both platforms.

**Blocked by:** 02 — Standardize Webapp Share Link Format

**Status:** resolved

- [x] Webapp features a visually distinct "Download App" banner in the Settings Bottom Sheet.
- [x] Mobile app `app.config.js` is updated with `intentFilters` handling Android App Links for the production domain.
- [x] Mobile share logic falls back to `EXPO_PUBLIC_WEBAPP_URL` environment variables if present.s public directory (using placeholder fingerprints).
- [ ] Webapp Settings bottom sheet detects Android users via user-agent and conditionally displays a "Download Mobile App" button.
- [ ] Share messages on both platforms append a link to download the native app.
