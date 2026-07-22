import { DarkTheme, type Theme } from 'expo-router/react-navigation';

// Fixed dark palette, ported 1:1 from the webapp — the app has no light/dark switching.
export const THEME = {
  bg: '#121212',
  surface: '#1e1e1e',
  sheet: '#181818',
  pill: '#161616',
  border: '#414040',
  borderSubtle: '#272625',
  brand: '#f57c00',
  brandActive: '#ff8000',
  text: '#ffffff',
  textMuted: '#d4d4d4',
  danger: '#e42a33',
};

export const NAV_THEME: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: 'transparent',
    border: THEME.border,
    card: THEME.surface,
    notification: THEME.danger,
    primary: THEME.brand,
    text: THEME.text,
  },
};
