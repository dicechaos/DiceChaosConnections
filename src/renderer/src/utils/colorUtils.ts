/**
 * Shared color normalization, WCAG 2.1 relative luminance contrast detection,
 * and curated preset palettes for Entity Card & Group Region background colors.
 */

export interface EntityBgSwatch {
  key: string
  label: string
  hex: string
}

/**
 * Curated light & dark tabletop background swatches for one-click Entity card recoloring.
 */
export const ENTITY_BG_SWATCHES: EntityBgSwatch[] = [
  { key: 'ivory', label: 'Ivory Vellum', hex: '#fffdf7' },
  { key: 'parchment', label: 'Warm Parchment', hex: '#fef3c7' },
  { key: 'sage', label: 'Sage Meadow', hex: '#dcfce7' },
  { key: 'frost', label: 'Frost Mist', hex: '#e0f2fe' },
  { key: 'lavender', label: 'Lavender Ward', hex: '#f3e8ff' },
  { key: 'rose', label: 'Rose Quartz', hex: '#ffe4e6' },
  { key: 'slate', label: 'Midnight Slate', hex: '#1e293b' },
  { key: 'arcane', label: 'Arcane Indigo', hex: '#1e1b4b' },
  { key: 'forest', label: 'Forest Shadow', hex: '#064e3b' },
  { key: 'crimson', label: 'Crimson Keep', hex: '#4c0519' }
]

/**
 * Validates and normalizes `#rgb` or `#rrggbb` into lowercase `#rrggbb`.
 * Returns `undefined` when empty or not a valid hex color.
 */
export function normalizeHexColor(value?: string | null): string | undefined {
  if (!value || typeof value !== 'string') return undefined
  const trimmed = value.trim()
  const shortMatch = /^#([0-9a-fA-F]{3})$/.exec(trimmed)
  if (shortMatch) {
    const [r, g, b] = shortMatch[1].toLowerCase().split('')
    return `#${r}${r}${g}${g}${b}${b}`
  }
  const fullMatch = /^#([0-9a-fA-F]{6})$/.exec(trimmed)
  if (fullMatch) {
    return `#${fullMatch[1].toLowerCase()}`
  }
  return undefined
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const norm = normalizeHexColor(hex)
  if (!norm) return null
  const intVal = parseInt(norm.slice(1), 16)
  return {
    r: (intVal >> 16) & 255,
    g: (intVal >> 8) & 255,
    b: intVal & 255
  }
}

/**
 * WCAG 2.1 sRGB relative luminance (`0` = pure black, `1` = pure white).
 */
export function getRelativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex)
  if (!rgb) return 1
  const toLinear = (channel255: number): number => {
    const c = channel255 / 255
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  const r = toLinear(rgb.r)
  const g = toLinear(rgb.g)
  const b = toLinear(rgb.b)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * Exact WCAG 1.4.3 luminance crossover (`sqrt(1.05 * 0.05) - 0.05 ≈ 0.17913`) where
 * white (`#ffffff`) and black (`#000000`) foreground text achieve equal contrast (> 4.5:1).
 */
export const WCAG_LUMINANCE_THRESHOLD = 0.17913

/**
 * Returns `true` when `hex` is dark enough that light foreground text & dark-surface pills
 * maximize WCAG AA readability.
 */
export function isHexColorDark(hex?: string | null): boolean {
  const norm = normalizeHexColor(hex)
  if (!norm) return false
  return getRelativeLuminance(norm) <= WCAG_LUMINANCE_THRESHOLD
}
