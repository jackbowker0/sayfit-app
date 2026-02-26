// ============================================================
// ICONS — Centralized Lucide icon mapping for SayFit
//
// Every emoji-to-icon mapping lives here. Screens/components
// import from this file instead of hardcoding emojis.
// ============================================================

import {
  Home,
  Dumbbell,
  ClipboardList,
  Users,
  TrendingUp,
  Settings,
  Calendar,
  Trophy,
  Scale,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Flame,
  Zap,
  Waves,
  Wind,
  Target,
  Clock,
  Pause,
  Play,
  SkipForward,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Heart,
  MessageCircle,
  Share2,
  Send,
  Search,
  Plus,
  Minus,
  Check,
  X,
  Star,
  Award,
  Crown,
  Medal,
  Shield,
  Swords,
  Brain,
  Eye,
  Bookmark,
  MoreHorizontal,
  Flag,
  Sparkles,
  Sun,
  Moon,
  Smartphone,
  Footprints,
  Mountain,
  Activity,
  Crosshair,
  Lock,
  AlertTriangle,
  Info,
  Timer,
  BarChart3,
  Grip,
  CircleUser,
  BicepsFlexed,
} from 'lucide-react-native';

// ---- TAB BAR ----
export const TAB_ICONS = {
  home: Home,
  train: Dumbbell,
  log: ClipboardList,
  community: Users,
  progress: TrendingUp,
};

// ---- COACH IDENTITY ----
export const COACH_ICONS = {
  drill: Crosshair,
  hype: Zap,
  zen: Waves,
};

// ---- EXERCISE MUSCLE GROUPS ----
export const MUSCLE_ICONS = {
  Legs: Footprints,
  Arms: BicepsFlexed,
  Core: Mountain,
  Chest: Grip,
  Back: Activity,
  Shoulders: ArrowUp,
  Glutes: Target,
  Cardio: Heart,
  'Full Body': Flame,
  default: Dumbbell,
};

// ---- NAVIGATION & ACTIONS ----
export const NAV_ICONS = {
  settings: Settings,
  calendar: Calendar,
  back: ChevronLeft,
  forward: ChevronRight,
  down: ChevronDown,
  close: X,
  search: Search,
  more: MoreHorizontal,
  plus: Plus,
  minus: Minus,
  check: Check,
  info: Info,
  lock: Lock,
  alert: AlertTriangle,
};

// ---- WORKOUT COMMANDS ----
export const COMMAND_ICONS = {
  harder: Flame,
  easier: Wind,
  swap: RefreshCw,
  skip: SkipForward,
  tired: Moon,
  pause: Pause,
  resume: Play,
};

// ---- ACHIEVEMENTS ----
export const ACHIEVEMENT_ICONS = {
  start: Flag,
  consistency: Flame,
  strength: Dumbbell,
  volume: TrendingUp,
  smart: Brain,
  default: Award,
};

// ---- ACHIEVEMENT TIERS ----
export const TIER_ICONS = {
  bronze: Medal,
  silver: Shield,
  gold: Trophy,
  diamond: Crown,
  platinum: Crown,
};

// ---- MODES ----
export const MODE_ICONS = {
  coach: Dumbbell,
  logger: ClipboardList,
  both: Zap,
  talk: MessageCircle,
  build: Swords,
};

// ---- THEME SETTINGS ----
export const THEME_ICONS = {
  light: Sun,
  dark: Moon,
  system: Smartphone,
};

// ---- SOCIAL ACTIONS ----
export const SOCIAL_ICONS = {
  like: Heart,
  comment: MessageCircle,
  share: Share2,
  send: Send,
  bookmark: Bookmark,
  report: Flag,
  follow: CircleUser,
};

// ---- STATS ----
export const STAT_ICONS = {
  calories: Flame,
  time: Clock,
  timer: Timer,
  exercises: Dumbbell,
  streak: Flame,
  weight: Scale,
  trend: TrendingUp,
  chart: BarChart3,
  star: Star,
  eye: Eye,
};

// Helper: get muscle icon with fallback
export function getMuscleIcon(muscle) {
  return MUSCLE_ICONS[muscle] || MUSCLE_ICONS.default;
}

// Helper: get achievement icon with fallback
export function getAchievementIcon(category) {
  return ACHIEVEMENT_ICONS[category] || ACHIEVEMENT_ICONS.default;
}

// Helper: get tier icon with fallback
export function getTierIcon(tier) {
  return TIER_ICONS[tier] || TIER_ICONS.bronze;
}
