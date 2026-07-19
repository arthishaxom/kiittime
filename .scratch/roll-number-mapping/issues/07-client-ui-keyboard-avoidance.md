# 07 — Client UI: Keyboard Avoidance for Roll Number Onboarding (Mobile & Web)

**What to build:** Ensure that the input area on the roll number onboarding screen remains accessible and visible when the virtual keyboard appears on both mobile and web platforms.

**Blocked by:** 04 — Client UI: Roll Number Onboarding (Mobile & Web)

**Status:** completed

- [x] On the mobile app (`mobile/src/app/index.tsx`), replace the root `View` with a `KeyboardAvoidingView` (using `behavior="padding"` or `"height"` based on OS).
- [x] Wrap the inner mobile layout in a `ScrollView` with `flexGrow: 1` so that the UI can naturally scroll when pushed up by the keyboard.
- [x] On the web app (`webapp/src/components/Landing.tsx`), change the root container's height class from `h-dvh` to `min-h-dvh` to allow scrolling.
- [x] Verify that the mobile browser natively scrolls the focused input into view on the web app when the keyboard opens.
