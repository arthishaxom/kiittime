Status: resolved

# Wire up Setters on Onboarding and OTP

## Web App:
- [x] In `webapp/src/components/Landing.tsx`, after `fetchRollNumberMapping` succeeds, `localStorage.setItem` the roll number and `data.academic_year`.
- [x] In `webapp/src/components/SectionSearch.tsx`, after `verifyOtp` succeeds, `localStorage.setItem` the roll number and `data.academic_year`.

## Mobile App:
- [x] In `mobile/src/app/index.tsx`, after `fetchRollNumberMapping` succeeds, call `setActiveRollNo` and `setActiveAcademicYear(data.academic_year)`.
- [x] In `mobile/src/app/select/sections.tsx`, after `verifyOtp` succeeds, call `setActiveRollNo` and `setActiveAcademicYear(data.academic_year)`.
