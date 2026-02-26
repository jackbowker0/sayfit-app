// ============================================================
// ThemeContext — App-wide theme state
//
// Stores user preference: 'dark' | 'light' | 'system'
// Persists to AsyncStorage so it survives app restarts.
//
// Usage in App.js:
//   <ThemeProvider> ... </ThemeProvider>
//
// Usage in screens:
//   const { colors, isDark, themeMode, setThemeMode } = useTheme();
// ============================================================

import React, { createContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightPalette, darkPalette } from '../constants/theme';

const THEME_KEY = 'sayfit_theme_mode';

export const ThemeContext = createContext({
  colors: darkPalette,
  isDark: true,
  themeMode: 'system', // 'dark' | 'light' | 'system'
  setThemeMode: () => {},
});

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme(); // 'light' | 'dark' | null
  const [themeMode, setThemeModeState] = useState('system');
  const [loaded, setLoaded] = useState(false);

  // Load saved preference on mount
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_KEY);
        if (saved === 'dark' || saved === 'light' || saved === 'system') {
          setThemeModeState(saved);
        }
      } catch (e) {
        // ignore
      }
      setLoaded(true);
    })();
  }, []);

  // Persist when changed
  const setThemeMode = async (mode) => {
    setThemeModeState(mode);
    try {
      await AsyncStorage.setItem(THEME_KEY, mode);
    } catch (e) {
      // ignore
    }
  };

  // Resolve actual dark/light
  let isDark;
  if (themeMode === 'system') {
    isDark = systemScheme !== 'light'; // default dark if null
  } else {
    isDark = themeMode === 'dark';
  }

  const colors = isDark ? darkPalette : lightPalette;

  // Don't render until we've loaded the preference to avoid flash
  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={{ colors, isDark, themeMode, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
}