// ============================================================
// THEME — Design system for SayFit
//
// Light + Dark palettes with auto-detection.
// The old COLORS export is kept for backward compatibility
// so un-updated screens don't break.
//
// New screens should use: const { colors } = useTheme();
// ============================================================

export const lightPalette = {
  // Backgrounds
  bg: '#F5F5F7',
  bgCard: '#FFFFFF',
  bgCardHover: '#F0F0F2',
  bgOverlay: 'rgba(0,0,0,0.4)',
  bgElevated: '#FFFFFF',
  bgInput: '#F0F0F2',
  bgSubtle: '#E8E8ED',

  // Text
  textPrimary: '#1A1A1A',
  textSecondary: '#6B6B6B',
  textMuted: '#9A9A9A',
  textDim: '#C0C0C0',
  textOnAccent: '#FFFFFF',

  // Borders
  border: 'rgba(0,0,0,0.08)',
  borderLight: 'rgba(0,0,0,0.04)',
  borderFocus: 'rgba(0,0,0,0.15)',

  // Semantic
  red: '#FF3B30',
  orange: '#FF6B35',
  yellow: '#FFCC00',
  green: '#34C759',
  blue: '#007AFF',
  purple: '#AF52DE',
  heartRate: '#FF3B30',

  // Shadows (light mode only — dark mode uses borders)
  shadow: 'rgba(0,0,0,0.06)',
  shadowMd: 'rgba(0,0,0,0.1)',

  // Glass-morphism
  glassBg: 'rgba(255, 255, 255, 0.8)',
  glassBorder: 'rgba(0,0,0,0.06)',
  glassHighlight: 'rgba(255,255,255,0.5)',
  bgGradientStart: '#F5F5F7',
  bgGradientEnd: '#EEEEF2',
  bgSheet: '#FFFFFF',
  bgSheetHandle: 'rgba(0,0,0,0.15)',
};

export const darkPalette = {
  // Backgrounds
  bg: '#0A0A0F',
  bgCard: '#161620',
  bgCardHover: '#1E1E2A',
  bgOverlay: 'rgba(0,0,0,0.7)',
  bgElevated: '#1C1C28',
  bgInput: '#12121C',
  bgSubtle: '#1A1A26',

  // Text
  textPrimary: '#F5F5F7',
  textSecondary: 'rgba(255,255,255,0.65)',
  textMuted: 'rgba(255,255,255,0.4)',
  textDim: 'rgba(255,255,255,0.2)',
  textOnAccent: '#FFFFFF',

  // Borders
  border: 'rgba(255,255,255,0.08)',
  borderLight: 'rgba(255,255,255,0.04)',
  borderFocus: 'rgba(255,255,255,0.15)',

  // Semantic
  red: '#FF4136',
  orange: '#FF6B35',
  yellow: '#FFDC00',
  green: '#2ECC40',
  blue: '#7FDBFF',
  purple: '#B10DC9',
  heartRate: '#FF4136',

  // Shadows (not really visible in dark, but kept for consistency)
  shadow: 'rgba(0,0,0,0.3)',
  shadowMd: 'rgba(0,0,0,0.5)',

  // Glass-morphism
  glassBg: 'rgba(22, 22, 32, 0.7)',
  glassBorder: 'rgba(255,255,255,0.06)',
  glassHighlight: 'rgba(255,255,255,0.03)',
  bgGradientStart: '#0A0A0F',
  bgGradientEnd: '#0F0F1A',
  bgSheet: '#1A1A28',
  bgSheetHandle: 'rgba(255,255,255,0.15)',
};

// ---- BACKWARD COMPATIBILITY ----
// Old screens import { COLORS } — this maps to dark palette
// so nothing breaks until screens are updated to useTheme()
export const COLORS = {
  ...darkPalette,
  // Legacy aliases that old screens use
  bgCard: '#ffffff06',
  bgCardHover: '#ffffff0a',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 20,
  xl: 32,
  xxl: 48,
  screenPadding: 20,
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  round: 100,
};

// ---- TYPOGRAPHY ----
export const FONT = {
  hero: { fontSize: 34, fontWeight: '800', letterSpacing: -0.8 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  heading: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  subhead: { fontSize: 17, fontWeight: '600', letterSpacing: -0.2 },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 22 },
  caption: { fontSize: 12, fontWeight: '500' },
  label: { fontSize: 11, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },
  stat: { fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statLg: { fontSize: 36, fontWeight: '800', fontVariant: ['tabular-nums'] },
};

// ---- ANIMATION TIMING ----
export const TIMING = {
  fast: 150,
  normal: 250,
  slow: 400,
  spring: { damping: 15, stiffness: 150 },
  springBouncy: { damping: 12, stiffness: 180 },
};

// ---- GLOW SIZES ----
export const GLOW = {
  sm: 4,
  md: 8,
  lg: 16,
};

// ---- HELPERS ----
export function getIntensityColor(level) {
  if (level >= 8) return '#FF4136';
  if (level >= 5) return '#FFDC00';
  return '#2ECC40';
}

/**
 * Get text color for use on a coach color background.
 * Yellow needs dark text; everything else uses white.
 */
export function getTextOnColor(coachColor) {
  return coachColor === '#FFDC00' || coachColor === '#FFCC00' ? '#000' : '#fff';
}