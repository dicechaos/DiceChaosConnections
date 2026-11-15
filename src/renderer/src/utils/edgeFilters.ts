import { ConnectionPreset, DndEdge } from '../types'

export const OTHER_EDGE_FILTER_KEY = '__other__'

/**
 * Resolves which Legend Connection Filter row controls a given edge:
 * 1. Explicit `edge.data.preset` matching a saved preset (or OTHER_EDGE_FILTER_KEY)
 * 2. Case-insensitive `edge.data.label` matching a saved preset
 * 3. Exact `(color, lineStyle)` visual match against a saved preset
 * 4. Unique `color` match when only one preset uses that color
 * 5. Fallback to `OTHER_EDGE_FILTER_KEY` ("Other / Custom") so 100% of map lines can be toggled
 */
export function resolveEdgeFilterKey(
  edge: DndEdge,
  connectionPresets: ConnectionPreset[]
): string {
  const d = edge.data || {}

  if (d.preset === OTHER_EDGE_FILTER_KEY) {
    return OTHER_EDGE_FILTER_KEY
  }

  if (d.preset?.trim()) {
    const byPreset = connectionPresets.find(
      (p) => p.label.toLowerCase() === d.preset!.trim().toLowerCase()
    )
    if (byPreset) return byPreset.label
  }

  if (d.label?.trim()) {
    const byLabel = connectionPresets.find(
      (p) => p.label.toLowerCase() === d.label!.trim().toLowerCase()
    )
    if (byLabel) return byLabel.label
  }

  const edgeColor = (d.color || '#94a3b8').trim().toLowerCase()
  const edgeStyle = d.lineStyle || 'solid'

  const byColorAndStyle = connectionPresets.find(
    (p) =>
      p.color.trim().toLowerCase() === edgeColor && (p.lineStyle || 'solid') === edgeStyle
  )
  if (byColorAndStyle) return byColorAndStyle.label

  const sameColorPresets = connectionPresets.filter(
    (p) => p.color.trim().toLowerCase() === edgeColor
  )
  if (sameColorPresets.length === 1) {
    return sameColorPresets[0].label
  }

  return OTHER_EDGE_FILTER_KEY
}
