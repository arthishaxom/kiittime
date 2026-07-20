Status: completed
Type: task

Fix the invisible text on the "Relink Roll Number" button and clear stale state linking data.

1. **Relink Button Text Visibility**:
   - In `webapp/src/routes/timetable.tsx`, the relink button has classes `bg-brand text-brand-active`.
   - Both variables resolve to almost identical shades of orange, rendering the text invisible.
   - Change `text-brand-active` to `text-white` on this button.

2. **Stale `temp_linking_roll_no` Bug (Unwanted Link Prompts)**:
   - When a user starts but abandons a roll number linking flow, `temp_linking_roll_no` persists in `localStorage`.
   - When subsequently choosing to "Select sections manually" and clicking "Done", the user is incorrectly prompted to link the abandoned roll number.
   - To fix this, add `localStorage.removeItem("temp_linking_roll_no")` in the following places:
     - `webapp/src/routes/timetable.tsx`: Inside `handleReset()`.
     - `webapp/src/components/Landing.tsx`: When the user clicks the "Select sections manually" button.
     - `webapp/src/components/Landing.tsx`: On component mount (using `useEffect`) to ensure a clean state initially.
