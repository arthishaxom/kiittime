Status: resolved
Type: task

Improve the sections header UX on the timetable page to avoid visual congestion when multiple sections are selected.

- **Summarized Text**: Instead of joining all section names (e.g., "Sec1, Sec2, Sec3"), summarize it:
  - 1 section selected: "Section A"
  - >1 section selected: "Section A + 2 others"
- **Dropdown UI**: Add a chevron (`˅`) icon next to the text.
- **Section Management Modal**: Tapping the summarized text or chevron should open a modal that displays:
  - The full list of selected sections.
  - The active roll number associated with them.
  - A button/action to "Relink Roll Number".
