import {
  Skull,
  Sparkles,
  Scroll,
  Crown,
  Castle,
  Tent,
  Gem,
  Book,
  Coins,
  Crosshair,
  Feather,
  Flame,
  Heart,
  Key,
  Moon,
  Sun,
  Star,
  Component,
  Zap,
  Droplet,
  TreePine,
  Mountain,
  Ghost,
  Anchor,
  Eye,
  Sword,
  Shield,
  Compass,
  Wand2,
  AlertTriangle,
  Lock,
  Flag,
  Trophy,
  Hourglass,
  Footprints,
  Scale,
  HelpCircle,
  MapPin,
  User,
  Users,
  type LucideIcon
} from 'lucide-react'

export const availableIcons: Record<string, LucideIcon> = {
  Skull,
  Sword,
  Shield,
  Eye,
  Crown,
  Flame,
  Sparkles,
  Wand2,
  Scroll,
  Book,
  Castle,
  Tent,
  MapPin,
  Compass,
  Gem,
  Coins,
  Key,
  Lock,
  Heart,
  Crosshair,
  AlertTriangle,
  Flag,
  Trophy,
  Hourglass,
  Footprints,
  Scale,
  Feather,
  Moon,
  Sun,
  Star,
  Zap,
  Droplet,
  TreePine,
  Mountain,
  Ghost,
  Anchor,
  HelpCircle,
  User,
  Users,
  Component
}

const iconPalette: Record<string, { light: string; dark: string; both: string }> = {
  Skull: { light: 'text-red-600', dark: 'text-red-400', both: 'text-red-600 dark:text-red-400' },
  Crosshair: { light: 'text-red-600', dark: 'text-red-400', both: 'text-red-600 dark:text-red-400' },
  Sword: { light: 'text-rose-600', dark: 'text-rose-400', both: 'text-rose-600 dark:text-rose-400' },
  Heart: { light: 'text-pink-600', dark: 'text-pink-400', both: 'text-pink-600 dark:text-pink-400' },
  Flame: {
    light: 'text-orange-600',
    dark: 'text-orange-400',
    both: 'text-orange-600 dark:text-orange-400'
  },
  Crown: {
    light: 'text-amber-600',
    dark: 'text-amber-300',
    both: 'text-amber-600 dark:text-amber-300'
  },
  Star: {
    light: 'text-amber-600',
    dark: 'text-amber-300',
    both: 'text-amber-600 dark:text-amber-300'
  },
  Sun: {
    light: 'text-amber-600',
    dark: 'text-amber-300',
    both: 'text-amber-600 dark:text-amber-300'
  },
  Sparkles: {
    light: 'text-amber-600',
    dark: 'text-amber-300',
    both: 'text-amber-600 dark:text-amber-300'
  },
  Coins: {
    light: 'text-amber-700',
    dark: 'text-amber-300',
    both: 'text-amber-700 dark:text-amber-300'
  },
  Trophy: {
    light: 'text-amber-700',
    dark: 'text-amber-300',
    both: 'text-amber-700 dark:text-amber-300'
  },
  AlertTriangle: {
    light: 'text-amber-700',
    dark: 'text-amber-300',
    both: 'text-amber-700 dark:text-amber-300'
  },
  Hourglass: {
    light: 'text-amber-700',
    dark: 'text-amber-300',
    both: 'text-amber-700 dark:text-amber-300'
  },
  Zap: {
    light: 'text-yellow-600',
    dark: 'text-yellow-300',
    both: 'text-yellow-600 dark:text-yellow-300'
  },
  Scroll: {
    light: 'text-amber-800',
    dark: 'text-amber-200',
    both: 'text-amber-800 dark:text-amber-200'
  },
  Feather: {
    light: 'text-amber-800',
    dark: 'text-amber-200',
    both: 'text-amber-800 dark:text-amber-200'
  },
  Key: {
    light: 'text-amber-700',
    dark: 'text-amber-300',
    both: 'text-amber-700 dark:text-amber-300'
  },
  Footprints: {
    light: 'text-amber-800',
    dark: 'text-amber-200',
    both: 'text-amber-800 dark:text-amber-200'
  },
  Shield: {
    light: 'text-blue-700',
    dark: 'text-sky-300',
    both: 'text-blue-700 dark:text-sky-300'
  },
  Compass: {
    light: 'text-blue-700',
    dark: 'text-sky-300',
    both: 'text-blue-700 dark:text-sky-300'
  },
  Anchor: {
    light: 'text-blue-700',
    dark: 'text-sky-300',
    both: 'text-blue-700 dark:text-sky-300'
  },
  Droplet: {
    light: 'text-sky-600',
    dark: 'text-sky-300',
    both: 'text-sky-600 dark:text-sky-300'
  },
  Gem: {
    light: 'text-cyan-700',
    dark: 'text-cyan-300',
    both: 'text-cyan-700 dark:text-cyan-300'
  },
  Eye: {
    light: 'text-violet-700',
    dark: 'text-violet-300',
    both: 'text-violet-700 dark:text-violet-300'
  },
  Ghost: {
    light: 'text-purple-700',
    dark: 'text-purple-300',
    both: 'text-purple-700 dark:text-purple-300'
  },
  Moon: {
    light: 'text-indigo-700',
    dark: 'text-indigo-300',
    both: 'text-indigo-700 dark:text-indigo-300'
  },
  Wand2: {
    light: 'text-indigo-700',
    dark: 'text-indigo-300',
    both: 'text-indigo-700 dark:text-indigo-300'
  },
  Book: {
    light: 'text-indigo-700',
    dark: 'text-indigo-300',
    both: 'text-indigo-700 dark:text-indigo-300'
  },
  HelpCircle: {
    light: 'text-indigo-700',
    dark: 'text-indigo-300',
    both: 'text-indigo-700 dark:text-indigo-300'
  },
  TreePine: {
    light: 'text-emerald-700',
    dark: 'text-emerald-300',
    both: 'text-emerald-700 dark:text-emerald-300'
  },
  Flag: {
    light: 'text-emerald-700',
    dark: 'text-emerald-300',
    both: 'text-emerald-700 dark:text-emerald-300'
  },
  Tent: {
    light: 'text-emerald-700',
    dark: 'text-emerald-300',
    both: 'text-emerald-700 dark:text-emerald-300'
  },
  MapPin: {
    light: 'text-emerald-700',
    dark: 'text-emerald-300',
    both: 'text-emerald-700 dark:text-emerald-300'
  },
  Mountain: {
    light: 'text-stone-700',
    dark: 'text-stone-300',
    both: 'text-stone-700 dark:text-stone-300'
  },
  Castle: {
    light: 'text-slate-700',
    dark: 'text-slate-200',
    both: 'text-slate-700 dark:text-slate-200'
  },
  Scale: {
    light: 'text-slate-700',
    dark: 'text-slate-200',
    both: 'text-slate-700 dark:text-slate-200'
  },
  Lock: {
    light: 'text-slate-700',
    dark: 'text-slate-200',
    both: 'text-slate-700 dark:text-slate-200'
  },
  User: {
    light: 'text-blue-700',
    dark: 'text-blue-300',
    both: 'text-blue-700 dark:text-blue-300'
  },
  Users: {
    light: 'text-emerald-700',
    dark: 'text-emerald-300',
    both: 'text-emerald-700 dark:text-emerald-300'
  },
  Component: {
    light: 'text-slate-700',
    dark: 'text-slate-200',
    both: 'text-slate-700 dark:text-slate-200'
  }
}

export const getIconColor = (name: string, isDarkSurface?: boolean): string => {
  const entry = iconPalette[name] || iconPalette.Component
  if (isDarkSurface === true) return entry.dark
  if (isDarkSurface === false) return entry.light
  return entry.both
}
