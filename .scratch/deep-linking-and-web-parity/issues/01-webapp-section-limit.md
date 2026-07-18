# 01 — Enforce MAX_SECTIONS limit on Webapp

**What to build:** Enforce a maximum limit of 5 sections when a user is selecting sections on the web platform, mirroring the mobile app constraints. When the 5-section limit is reached, further selections should be blocked and an inline warning message ("Max 5 sections") should be displayed.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [x] Webapp section selector respects the `MAX_SECTIONS = 5` limit.
- [x] Users are prevented from selecting a 6th section.
- [x] An inline visual warning is displayed when the 5-section cap is reached.
- [x] Fix TanStack Router warning about the test file missing a Route export (by prefixing it with `-` or ignoring it).
- [x] Fix TanStack Router code-splitting warning caused by exporting `SectionSearch` directly from the route file.
