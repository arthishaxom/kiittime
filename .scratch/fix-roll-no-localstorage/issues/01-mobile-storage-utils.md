Status: resolved

# Implement mobile storage utilities

In `mobile/src/lib/storage.ts`:
- [x] Define constants for `kiit-time:active-roll-no` and `kiit-time:active-academic-year`
- [x] Export `getActiveRollNo`, `setActiveRollNo`, `clearActiveRollNo`
- [x] Export `getActiveAcademicYear`, `setActiveAcademicYear`, `clearActiveAcademicYear`

(Note: `clearActiveRollNo` and `clearActiveAcademicYear` are already imported by `mobile/src/components/settings-sheet.tsx`, so adding them will resolve the pending import).
