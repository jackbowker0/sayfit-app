// ============================================================
// useTheme — Access theme from any screen
//
// Usage:
//   const { colors, isDark, themeMode, setThemeMode } = useTheme();
//
// themeMode: 'dark' | 'light' | 'system'
// setThemeMode: call to change the preference
// ============================================================

import { useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';

export function useTheme() {
  return useContext(ThemeContext);
}