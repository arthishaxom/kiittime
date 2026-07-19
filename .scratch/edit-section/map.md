# Edit Section Map

## Issues

- [01-ui-edit-button.md](issues/01-ui-edit-button.md)
- [03-version-bump.md](issues/03-version-bump.md)
- [04-lint-and-format.md](issues/04-lint-and-format.md)

## Notes / Decisions-so-far
- Reusing the existing OTP and Select Section flow for editing a roll number's section.
- Doing a minor version bump on both `mobile` and `webapp` at the end of the feature implementation.
- Completed implementation of Edit Section button next to section names on timetable views (mobile & webapp). Clicking it navigates to section selection while storing the active roll number as the temporary linking roll number, which triggers the OTP verification flow on Done. Version bumped both packages.
