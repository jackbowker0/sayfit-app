// ============================================================
// THEME — Design system for SayFit
//
// Rebrand 2026-07-08: clean neutral darks, ONE restrained amber
// accent (no per-coach color noise), solid surfaces + hairlines
// (glassmorphism removed), glow removed, Hanken Grotesk type.
//
// Screens use: const { colors } = useTheme();
// Token NAMES are unchanged — only values — so every screen
// restyles at once without edits.
// ============================================================

// The one brand accent — a refined amber. Premium, athletic, and
// colorblind-safe (distinguishable across all CB types). Reserved
// for ~10% of the UI (primary actions, active states, "due").
const ACCENT = '#F0913A';

export const lightPalette = {
  // Backgrounds — off-white, never pure #fff
  bg: '#FAFAFA',
  bgCard: '#FFFFFF',
  bgCardHover: '#F4F4F5',
  bgOverlay: 'rgba(20,21,23,0.4)',
  bgElevated: '#FFFFFF',
  bgInput: '#F4F4F5',
  bgSubtle: '#EFEFF1',

  // Text — off-black, never pure #000
  textPrimary: '#18191B',
  textSecondary: '#5B5D63',
  textMuted: '#8A8C93',
  textDim: '#B8BAC0',
  textOnAccent: '#1A1206',

  // Borders — soft hairlines
  border: 'rgba(20,21,23,0.09)',
  borderLight: 'rgba(20,21,23,0.05)',
  borderFocus: 'rgba(20,21,23,0.18)',

  // Semantic — desaturated, deliberate (not the clrs.cc crayons)
  red: '#D64550',
  orange: ACCENT,
  yellow: '#D89B2E',
  green: '#2E9E77',
  blue: '#3B7FD4',
  purple: '#8A5FC7',
  accent: ACCENT,
  heartRate: '#D64550',

  // Elevation via layered soft shadows (light mode only)
  shadow: 'rgba(20,21,23,0.06)',
  shadowMd: 'rgba(20,21,23,0.10)',

  // (kept keys — now SOLID surfaces, not glass)
  glassBg: '#FFFFFF',
  glassBorder: 'rgba(20,21,23,0.09)',
  glassHighlight: 'rgba(20,21,23,0.03)',
  bgGradientStart: '#FAFAFA',
  bgGradientEnd: '#FAFAFA',
  bgSheet: '#FFFFFF',
  bgSheetHandle: 'rgba(20,21,23,0.16)',
};

export const darkPalette = {
  // Backgrounds — clean near-neutral darks (killed the blue-purple murk)
  bg: '#0B0B0C',
  bgCard: '#141517',
  bgCardHover: '#1B1C1F',
  bgOverlay: 'rgba(0,0,0,0.72)',
  bgElevated: '#1B1C1F',
  bgInput: '#141517',
  bgSubtle: '#1B1C1F',

  // Text — off-white ramp
  textPrimary: '#F4F4F5',
  textSecondary: '#A2A3A9',
  textMuted: '#6A6C72',
  textDim: 'rgba(255,255,255,0.22)',
  textOnAccent: '#1A1206',

  // Borders — hairlines
  border: 'rgba(255,255,255,0.08)',
  borderLight: 'rgba(255,255,255,0.05)',
  borderFocus: 'rgba(255,255,255,0.16)',

  // Semantic — desaturated for a dark ground
  red: '#E5565F',
  orange: ACCENT,
  yellow: '#E3B341',
  green: '#3FB489',
  blue: '#5B93E6',
  purple: '#9E77D6',
  accent: ACCENT,
  heartRate: '#E5565F',

  // Dark elevation comes from surface lightness + hairline, not shadow
  shadow: 'rgba(0,0,0,0.4)',
  shadowMd: 'rgba(0,0,0,0.6)',

  // (kept keys — now SOLID surfaces, not glass)
  glassBg: '#141517',
  glassBorder: 'rgba(255,255,255,0.08)',
  glassHighlight: 'rgba(255,255,255,0.05)',
  bgGradientStart: '#0B0B0C',
  bgGradientEnd: '#0B0B0C',
  bgSheet: '#141517',
  bgSheetHandle: 'rgba(255,255,255,0.18)',
};

// ---- BACKWARD COMPATIBILITY ----
// Old screens import { COLORS } — maps to dark palette so nothing breaks.
export const COLORS = {
  ...darkPalette,
  bgCard: '#141517',
  bgCardHover: '#1B1C1F',
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
// Hanken Grotesk (bundled, loaded via useFonts in App.js). Family carries the
// weight (static faces), so we set fontFamily per token rather than fontWeight.
export const FONT = {
  hero:    { fontFamily: 'Hanken-Bold',     fontSize: 32, letterSpacing: -0.8 },
  title:   { fontFamily: 'Hanken-Bold',     fontSize: 25, letterSpacing: -0.5 },
  heading: { fontFamily: 'Hanken-SemiBold', fontSize: 20, letterSpacing: -0.3 },
  subhead: { fontFamily: 'Hanken-SemiBold', fontSize: 16, letterSpacing: -0.1 },
  body:    { fontFamily: 'Hanken-Regular',  fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: 'Hanken-Medium',   fontSize: 13 },
  label:   { fontFamily: 'Hanken-SemiBold', fontSize: 11, letterSpacing: 0.9, textTransform: 'uppercase' },
  stat:    { fontFamily: 'Hanken-Bold',     fontSize: 22, letterSpacing: -0.4, fontVariant: ['tabular-nums'] },
  statLg:  { fontFamily: 'Hanken-Bold',     fontSize: 34, letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
};

// ---- ANIMATION TIMING ----
export const TIMING = {
  fast: 150,
  normal: 250,
  slow: 400,
  spring: { damping: 15, stiffness: 150 },
  springBouncy: { damping: 12, stiffness: 180 },
};

// ---- GLOW (deprecated — kept as no-ops so any remaining refs don't neon) ----
export const GLOW = {
  sm: 0,
  md: 0,
  lg: 0,
};

// ---- HELPERS ----
export function getIntensityColor(level) {
  if (level >= 8) return '#E5565F';
  if (level >= 5) return '#E3B341';
  return '#3FB489';
}

/**
 * Text color to sit on an accent-colored background. The amber accent and any
 * yellow are light — they need dark text; everything else uses white.
 */
export function getTextOnColor(coachColor) {
  const light = ['#F0913A', '#FFDC00', '#FFCC00', '#E3B341', '#D89B2E'];
  return light.includes(coachColor) ? '#1A1206' : '#FFFFFF';
}
