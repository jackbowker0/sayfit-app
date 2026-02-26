// ============================================================
// SHARE TEMPLATES — Template definitions for share cards
//
// Each template has an id, display name, aspect ratio,
// and style configuration. The Classic template matches
// the original ShareCard design.
//
// NOTE: `emoji` is kept for share card image content only.
// `icon` is the Lucide icon name used in the UI (customizer).
// ============================================================

export const SHARE_TEMPLATES = {
  classic: {
    id: 'classic',
    name: 'Classic',
    emoji: '🎴',
    icon: 'LayoutGrid',
    description: 'The original SayFit card',
    aspectRatio: 4 / 5,     // 1080x1350
    width: 1080,
    height: 1350,
    bgColor: '#0A0A0F',
    textColor: '#FFFFFF',
    supportsCoachColors: true,
  },
  minimal: {
    id: 'minimal',
    name: 'Clean',
    emoji: '🤍',
    icon: 'Minus',
    description: 'Minimal white design',
    aspectRatio: 1,          // 1080x1080
    width: 1080,
    height: 1080,
    bgColor: '#FFFFFF',
    textColor: '#1A1A1A',
    supportsCoachColors: false,
  },
  story: {
    id: 'story',
    name: 'Story',
    emoji: '📱',
    icon: 'Smartphone',
    description: 'Instagram Stories format',
    aspectRatio: 9 / 16,     // 1080x1920
    width: 1080,
    height: 1920,
    bgColor: '#0A0A0F',
    textColor: '#FFFFFF',
    supportsCoachColors: true,
  },
  neon: {
    id: 'neon',
    name: 'Neon',
    emoji: '🌈',
    icon: 'Sparkles',
    description: 'Gradient glow effect',
    aspectRatio: 4 / 5,
    width: 1080,
    height: 1350,
    bgColor: '#0A0A0F',
    textColor: '#FFFFFF',
    usesGradient: true,
    supportsCoachColors: true,
  },
  statsFocus: {
    id: 'statsFocus',
    name: 'Stats',
    emoji: '📊',
    icon: 'BarChart3',
    description: 'Big numbers, minimal text',
    aspectRatio: 1,
    width: 1080,
    height: 1080,
    bgColor: '#0A0A0F',
    textColor: '#FFFFFF',
    supportsCoachColors: true,
  },
};

export const TEMPLATE_LIST = Object.values(SHARE_TEMPLATES);

// Default visible stats for each workout type
export const DEFAULT_STAT_VISIBILITY = {
  guided: {
    time: true,
    calories: true,
    exercises: true,
    adaptations: true,
    muscles: true,
    coachQuote: true,
    streak: true,
  },
  logged: {
    time: true,
    exercises: true,
    sets: true,
    volume: true,
    muscles: true,
    coachQuote: true,
    streak: true,
  },
};
