# 03 — Center Section Name Header in Timetable (Mobile & Webapp)

**What to build:** Centers the section code header text visually at the top of the timetable screen to provide a more balanced layout.

**Blocked by:** None — can start immediately.

**Status:** closed

- [x] Add centering classes (e.g., `text-center` or `items-center`) to the container holding the section name header in the Mobile app (`mobile/src/app/timetable.tsx`).
- [x] Add centering classes to the container holding the section name header in the Webapp (`webapp/src/routes/timetable.tsx`).
- [x] Ensure the header is perfectly centered horizontally across the screen width.

## Comments

Added `items-center` to the header wrapper `View` in `mobile/src/app/timetable.tsx` and `text-center` to the header wrapper `div` in `webapp/src/routes/timetable.tsx`.
