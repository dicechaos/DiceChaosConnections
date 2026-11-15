import {
  BuiltinPortId,
  CanvasTheme,
  ConnectionPreset,
  CustomPerimeterPort,
  CustomPortShape,
  CustomPortSize,
  CustomPortVisibility,
  DndEdge,
  DndNode,
  DragSnapOption,
  DragSnapSize,
  EntityNodeData,
  PerimeterAnchor,
  PerimeterSide
} from '../types'
import { normalizeHexColor } from './colorUtils'
import { resolveEdgeFilterKey } from './edgeFilters'

/**
 * Expands `proxy-<edgeId>` endpoints to their parent edge's endpoints so hop-distance traversal
 * treats edge-to-label relationships intuitively.
 */
export function getConnectedNodesWithinDegrees(
  startNodeId: string,
  edges: DndEdge[],
  maxDegree: number,
  seedNodeIds?: string[]
): Set<string> {
  const edgeById = new Map(edges.map((e) => [e.id, e]))
  const expandEndpoint = (id: string): string[] => {
    if (id.startsWith('proxy-')) {
      const parent = edgeById.get(id.slice(6))
      return parent ? [id, parent.source, parent.target] : [id]
    }
    return [id]
  }

  const initialIds = seedNodeIds && seedNodeIds.length > 0 ? [startNodeId, ...seedNodeIds] : [startNodeId]
  const visited = new Set<string>(initialIds)
  let currentLevel = new Set<string>(initialIds)

  for (let i = 0; i < maxDegree; i++) {
    const nextLevel = new Set<string>()
    edges.forEach((edge) => {
      const sources = expandEndpoint(edge.source)
      const targets = expandEndpoint(edge.target)
      const touchesSource = sources.some((s) => currentLevel.has(s))
      const touchesTarget = targets.some((t) => currentLevel.has(t))

      if (touchesSource) {
        targets.forEach((t) => {
          if (!visited.has(t)) {
            visited.add(t)
            nextLevel.add(t)
          }
        })
        visited.add(`proxy-${edge.id}`)
      }
      if (touchesTarget) {
        sources.forEach((s) => {
          if (!visited.has(s)) {
            visited.add(s)
            nextLevel.add(s)
          }
        })
        visited.add(`proxy-${edge.id}`)
      }
    })
    if (nextLevel.size === 0) break
    currentLevel = nextLevel
  }
  return visited
}

export type SearchMatchBadge =
  | 'Name'
  | 'Alias'
  | '#Tag'
  | 'Type'
  | 'Sheet'
  | 'Lore'
  | 'Party Note'
  | 'DM Secret'

export interface NodeSearchMatch {
  node: DndNode
  badges: SearchMatchBadge[]
  snippet?: string
}

export interface EdgeSearchMatch {
  edge: DndEdge
  badges: SearchMatchBadge[]
  snippet?: string
}

function extractMatchSnippet(text: string | undefined, queryLower: string): string | undefined {
  if (!text) return undefined
  const clean = text.replace(/\s+/g, ' ')
  const idx = clean.toLowerCase().indexOf(queryLower)
  if (idx === -1) return undefined
  const start = Math.max(0, idx - 28)
  const end = Math.min(clean.length, idx + queryLower.length + 42)
  return `${start > 0 ? '…' : ''}${clean.slice(start, end).trim()}${end < clean.length ? '…' : ''}`
}

/**
 * Evaluates whether a node matches a search query (including `#tag` queries, aliases, D&D sheet fields,
 * and lore notes while strictly hiding DM secrets when `hideSecrets` is true).
 */
export function matchNodeAgainstQuery(
  node: DndNode,
  rawQuery: string,
  hideSecrets: boolean
): NodeSearchMatch | null {
  const trimmed = rawQuery.trim()
  if (!trimmed) return null
  const q = trimmed.toLowerCase()
  const isTagQuery = q.startsWith('#') && q.length > 1
  const tagNeedle = isTagQuery ? q.slice(1) : q

  const d = node.data
  const f = d.dndFields || {}
  const badges: SearchMatchBadge[] = []
  let snippet: string | undefined

  if (isTagQuery) {
    const matchedTag = (d.tags || []).find((t) =>
      t.replace(/^#/, '').toLowerCase().includes(tagNeedle)
    )
    if (!matchedTag) return null
    return {
      node,
      badges: ['#Tag'],
      snippet: `#${matchedTag.replace(/^#/, '')}`
    }
  }

  if (d.label?.toLowerCase().includes(q) || d.groupSubtitle?.toLowerCase().includes(q)) {
    badges.push('Name')
  }

  const matchedAlias = (d.aliases || []).find((a) => a.toLowerCase().includes(q))
  if (matchedAlias) {
    badges.push('Alias')
    snippet = snippet || `Alias: ${matchedAlias}`
  }

  const matchedTag = (d.tags || []).find((t) => t.toLowerCase().includes(q))
  if (matchedTag) {
    badges.push('#Tag')
    snippet = snippet || `#${matchedTag.replace(/^#/, '')}`
  }

  if (String(d.entityType || '').toLowerCase().includes(q)) {
    badges.push('Type')
  }

  const sheetHit = Boolean(
    f.faction?.toLowerCase().includes(q) ||
      f.ancestry?.toLowerCase().includes(q) ||
      f.classOrRole?.toLowerCase().includes(q) ||
      f.region?.toLowerCase().includes(q) ||
      f.locationType?.toLowerCase().includes(q) ||
      f.holder?.toLowerCase().includes(q) ||
      f.rarity?.toLowerCase().includes(q) ||
      f.disposition?.toLowerCase().includes(q) ||
      f.influence?.toLowerCase().includes(q) ||
      f.headquarters?.toLowerCase().includes(q) ||
      f.goal?.toLowerCase().includes(q) ||
      f.questStatus?.toLowerCase().includes(q) ||
      (d.statusIcons || []).some((ic) => ic.toLowerCase().includes(q)) ||
      (!hideSecrets &&
        (d.stats?.toLowerCase().includes(q) ||
          f.voiceCue?.toLowerCase().includes(q) ||
          f.dangerTier?.toLowerCase().includes(q) ||
          f.alignment?.toLowerCase().includes(q)))
  )
  if (sheetHit) {
    badges.push('Sheet')
  }

  const pubLore = d.publicNotes ?? d.description
  if (pubLore?.toLowerCase().includes(q)) {
    badges.push('Lore')
    snippet = snippet || extractMatchSnippet(pubLore, q)
  }

  if (d.partyNotes?.toLowerCase().includes(q)) {
    badges.push('Party Note')
    snippet = snippet || extractMatchSnippet(d.partyNotes, q)
  }

  if (!hideSecrets && d.dmNotes?.toLowerCase().includes(q)) {
    badges.push('DM Secret')
    snippet = snippet || extractMatchSnippet(d.dmNotes, q)
  }

  if (badges.length === 0) return null
  return { node, badges, snippet }
}

export function matchEdgeAgainstQuery(
  edge: DndEdge,
  rawQuery: string,
  hideSecrets: boolean
): EdgeSearchMatch | null {
  const trimmed = rawQuery.trim()
  if (!trimmed || trimmed.startsWith('#')) return null
  const q = trimmed.toLowerCase()
  const d = edge.data || {}
  const badges: SearchMatchBadge[] = []
  let snippet: string | undefined

  if (d.label?.toLowerCase().includes(q) || d.preset?.toLowerCase().includes(q)) {
    badges.push('Name')
  }
  if (d.publicNotes?.toLowerCase().includes(q)) {
    badges.push('Lore')
    snippet = snippet || extractMatchSnippet(d.publicNotes, q)
  }
  if (d.partyNotes?.toLowerCase().includes(q)) {
    badges.push('Party Note')
    snippet = snippet || extractMatchSnippet(d.partyNotes, q)
  }
  if (!hideSecrets && d.dmNotes?.toLowerCase().includes(q)) {
    badges.push('DM Secret')
    snippet = snippet || extractMatchSnippet(d.dmNotes, q)
  }

  if (badges.length === 0) return null
  return { edge, badges, snippet }
}

/**
 * Shared Graph Computation Pipeline used by both the main Studio (`App.tsx`) and Player Screen (`PlayerScreenApp.tsx`).
 * Supports Universal Focus Web (Degrees of Separation in BOTH DM View and Player View!).
 */
export function computeVisibleGraph(params: {
  baseNodes: DndNode[]
  baseEdges: DndEdge[]
  hideSecrets: boolean
  visibleTypes: Record<string, boolean>
  visibleEdgeTypes: Record<string, boolean>
  connectionPresets: ConnectionPreset[]
  degrees: number | ''
  degreeMode: 'fade' | 'hide'
  searchQuery: string
}): {
  displayNodes: DndNode[]
  displayEdges: DndEdge[]
  finalNodes: DndNode[]
  finalEdges: DndEdge[]
  renderedNodes: any[]
  selectedNode: DndNode | undefined
  selectedEdge: DndEdge | undefined
  selectedNodes: DndNode[]
  matchedNodeIds: string[]
} {
  const {
    baseNodes,
    baseEdges,
    hideSecrets,
    visibleTypes,
    visibleEdgeTypes,
    connectionPresets,
    degrees,
    degreeMode,
    searchQuery
  } = params

  // 1. Filter visible entity & group region nodes
  //    Toggling `visibleTypes['Group'] === false` hides only the group boundary frames while keeping
  //    all member entities inside them visible on the canvas.
  const displayNodes = baseNodes.filter((n) => {
    if (hideSecrets && n.data?.isHidden) return false
    const isGroup = n.type === 'groupRegion' || Boolean(n.data?.isGroup)
    if (isGroup && visibleTypes['Group'] === false) {
      return false
    }
    if (!isGroup && n.data?.entityType && visibleTypes[n.data.entityType] === false) {
      return false
    }
    return true
  })

  const visibleNodeIds = new Set(displayNodes.map((n) => n.id))
  const displayNodeById = new Map(displayNodes.map((n) => [n.id, n]))

  // 2. Iteratively resolve visible edges (preserving connections attached to `proxy-<edgeId>` labels)
  const candidateEdges = baseEdges.filter((e) => {
    if (hideSecrets && e.data?.isHidden) return false
    const filterKey = resolveEdgeFilterKey(e, connectionPresets)
    if (visibleEdgeTypes[filterKey] === false) return false
    return true
  })

  const visibleEdgeIds = new Set<string>()
  let changed = true
  let guard = 0
  while (changed && guard < 6) {
    changed = false
    guard++
    for (const e of candidateEdges) {
      if (visibleEdgeIds.has(e.id)) continue
      const sourceOk =
        visibleNodeIds.has(e.source) ||
        (e.source.startsWith('proxy-') && visibleEdgeIds.has(e.source.slice(6)))
      const targetOk =
        visibleNodeIds.has(e.target) ||
        (e.target.startsWith('proxy-') && visibleEdgeIds.has(e.target.slice(6)))
      if (sourceOk && targetOk) {
        visibleEdgeIds.add(e.id)
        changed = true
      }
    }
  }

  const displayEdges = candidateEdges.filter((e) => visibleEdgeIds.has(e.id))

  let finalNodes: DndNode[] = displayNodes
  let finalEdges: DndEdge[] = displayEdges

  const selectedNodes = displayNodes.filter((n) => n.selected)
  const selectedNode = selectedNodes.length === 1 ? selectedNodes[0] : selectedNodes[0]
  const selectedEdge = displayEdges.find((e) => e.selected)

  // 3. Universal Focus Web (Degrees of Separation — available in DM View, Player View, and Player Edition!)
  if (selectedNodes.length === 1 && degrees !== '') {
    const focusRoot = selectedNodes[0]
    const isRootGroup = focusRoot.type === 'groupRegion' || Boolean(focusRoot.data?.isGroup)
    const groupMemberIds = isRootGroup
      ? displayNodes.filter((n) => n.data?.groupId === focusRoot.id).map((n) => n.id)
      : focusRoot.data?.groupId
        ? []
        : []
    const allowedIds = getConnectedNodesWithinDegrees(
      focusRoot.id,
      displayEdges,
      degrees,
      groupMemberIds
    )
    // Also keep a member's parent group frame visible/unfaded if any member inside it is in focus
    for (const n of displayNodes) {
      if (n.data?.groupId && allowedIds.has(n.id)) {
        allowedIds.add(n.data.groupId)
      }
    }
    if (degreeMode === 'hide') {
      finalNodes = finalNodes.filter((n) => allowedIds.has(n.id))
      finalEdges = finalEdges.filter(
        (e) =>
          (allowedIds.has(e.source) || allowedIds.has(`proxy-${e.id}`)) &&
          (allowedIds.has(e.target) || allowedIds.has(`proxy-${e.id}`))
      )
    } else {
      finalNodes = finalNodes.map((n) => ({
        ...n,
        data: { ...n.data, isDegreeFaded: !allowedIds.has(n.id) }
      }))
      finalEdges = finalEdges.map((e) => ({
        ...e,
        data: {
          ...e.data,
          isDegreeFaded: !(allowedIds.has(e.source) && allowedIds.has(e.target))
        }
      }))
    }
  }

  // 4. Search & #Tag Filter
  const matchedNodeIds: string[] = []
  if (searchQuery.trim()) {
    finalNodes = finalNodes.map((n) => {
      const hit = matchNodeAgainstQuery(n, searchQuery, hideSecrets)
      if (hit) matchedNodeIds.push(n.id)
      return {
        ...n,
        data: { ...n.data, isSearchFaded: !hit }
      }
    })

    const fadedNodeIds = new Set(
      finalNodes.filter((n) => n.data.isSearchFaded).map((n) => n.id)
    )

    finalEdges = finalEdges.map((e) => {
      const edgeHit = matchEdgeAgainstQuery(e, searchQuery, hideSecrets)
      const isFaded =
        !edgeHit && (fadedNodeIds.has(e.source) || fadedNodeIds.has(e.target))
      return {
        ...e,
        data: { ...e.data, isSearchFaded: isFaded }
      }
    })
  }

  // 5. Enforce deterministic 5-band viewport stacking order so connection lines & entity cards ALWAYS
  //    render OVER group backgrounds while allowing free user stacking within the Entity and Group tiers:
  //    Band 1 (zIndex: 1..999)   -> Group Region containers (`groupRegion`) — ordered by `nodes[]` rank, never boosted on select
  //    Band 2 (zIndex: 1000/1001)-> Connection SVG paths (`dndEdge`)
  //    Band 3 (z-index: 1500)    -> `.react-flow__edgelabel-renderer` (edge labels)
  //    Band 4 (zIndex: 2000+)    -> Entity cards (`entity`) — ordered by `nodes[]` rank, never overridden on select
  //    Band 5 (zIndex: 9000)     -> Edge-to-edge midpoint proxy handles (`edgeProxy`)
  let groupRank = 0
  let entityRank = 0
  finalNodes = finalNodes.map((n) => {
    const isGroup = n.type === 'groupRegion' || Boolean(n.data?.isGroup)
    const locked = isNodeEffectivelyLocked(n, displayNodeById)
    if (isGroup) {
      const { w, h } = resolveNodeSize(n)
      const groupZ = Math.min(999, 1 + groupRank++)
      return {
        ...n,
        type: 'groupRegion',
        zIndex: groupZ,
        ...(locked ? { draggable: false } : {}),
        style: {
          ...(n.style || {}),
          width: w,
          height: h,
          zIndex: groupZ
        }
      }
    }
    const entityZ = 2000 + entityRank++
    const { width: entityW, height: entityH } = resolveEntityExplicitSize(n.data)
    const nextStyle: Record<string, any> = {
      ...(n.style || {}),
      zIndex: entityZ
    }
    if (entityW !== undefined) nextStyle.width = entityW
    else delete nextStyle.width
    if (entityH !== undefined) nextStyle.height = entityH
    else delete nextStyle.height

    return {
      ...n,
      width: entityW,
      height: entityH,
      zIndex: entityZ,
      ...(locked ? { draggable: false } : {}),
      style: nextStyle
    }
  })

  finalEdges = finalEdges.map((e) => ({
    ...e,
    zIndex: e.selected ? 1001 : 1000
  }))

  // 6. Build Proxy Nodes for visible labeled edges so edge-to-label links anchor accurately
  //    Uses waypoint-aware curve midpoints and `pointerEvents: 'none'` on the outer `.react-flow__node`
  //    wrapper so only the inner left/right `<Handle>` dots receive pointer events (never occluding labels or anchors).
  const proxyNodes: any[] = []
  const getNodeOrProxy = (id: string) =>
    finalNodes.find((n) => n.id === id) || proxyNodes.find((p) => p.id === id)

  finalEdges.forEach((e) => {
    if (e.data?.label) {
      let lx = 0
      let ly = 0
      const s = getNodeOrProxy(e.source)
      const t = getNodeOrProxy(e.target)
      if (s && t) {
        const { w: sw, h: sh } = resolveNodeSize(s)
        const { w: tw, h: th } = resolveNodeSize(t)

        const sx = s.position.x + sw / 2
        const sy = s.position.y + sh / 2
        const tx = t.position.x + tw / 2
        const ty = t.position.y + th / 2

        const mid = computeEdgeCurveMidpoint(sx, sy, tx, ty, e.data.waypoints, e.data.labelPos)
        lx = mid.x
        ly = mid.y
      }
      proxyNodes.push({
        id: `proxy-${e.id}`,
        type: 'edgeProxy',
        position: { x: lx - 30, y: ly - 10 },
        data: { edgeId: e.id, label: e.data.label, selected: e.selected },
        selectable: false,
        draggable: false,
        zIndex: 9000,
        style: { width: 60, height: 20, zIndex: 9000, pointerEvents: 'none' }
      })
    }
  })

  return {
    displayNodes,
    displayEdges,
    finalNodes,
    finalEdges,
    renderedNodes: [...finalNodes, ...proxyNodes],
    selectedNode,
    selectedEdge,
    selectedNodes,
    matchedNodeIds
  }
}

// ============================================================================
// CONNECTION ROUTING ANCHOR (WAYPOINT) GEOMETRY HELPERS
// ============================================================================

export function computeEdgeCurveMidpoint(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  waypoints?: Array<{ x: number; y: number }>,
  labelPos?: { x: number; y: number }
): { x: number; y: number } {
  let labelX = 0
  let labelY = 0
  if (waypoints && waypoints.length > 0) {
    const points = [[sx, sy], ...waypoints.map((w) => [w.x, w.y]), [tx, ty]]
    const midIndex = Math.floor(points.length / 2)
    if (points.length % 2 === 0) {
      labelX = (points[midIndex - 1][0] + points[midIndex][0]) / 2
      labelY = (points[midIndex - 1][1] + points[midIndex][1]) / 2
    } else {
      labelX = points[midIndex][0]
      labelY = points[midIndex][1]
    }
  } else {
    labelX = (sx + tx) / 2
    labelY = (sy + ty) / 2
  }

  return {
    x: labelX + (labelPos?.x || 0),
    y: labelY + (labelPos?.y || 0)
  }
}

export function resolveEdgeEndpointCenter(
  endpointId: string,
  nodes: DndNode[],
  edges: DndEdge[],
  depth = 0
): { x: number; y: number } {
  if (endpointId.startsWith('proxy-') && depth < 5) {
    const parentEdge = edges.find((e) => e.id === endpointId.slice(6))
    if (parentEdge) {
      const s = resolveEdgeEndpointCenter(parentEdge.source, nodes, edges, depth + 1)
      const t = resolveEdgeEndpointCenter(parentEdge.target, nodes, edges, depth + 1)
      return computeEdgeCurveMidpoint(
        s.x,
        s.y,
        t.x,
        t.y,
        parentEdge.data?.waypoints,
        parentEdge.data?.labelPos
      )
    }
  }

  const node = nodes.find((n) => n.id === endpointId)
  if (!node) return { x: 0, y: 0 }
  const { w, h } = getNodeSize(node)
  return { x: node.position.x + w / 2, y: node.position.y + h / 2 }
}

function pointToSegmentDistanceSq(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = bx - ax
  const dy = by - ay
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return (px - ax) * (px - ax) + (py - ay) * (py - ay)
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq))
  const projX = ax + t * dx
  const projY = ay + t * dy
  return (px - projX) * (px - projX) + (py - projY) * (py - projY)
}

/**
 * Inserts a new curve anchor into the closest segment along `sourceCenter -> ...waypoints -> targetCenter`
 * so adding an anchor mid-curve preserves smooth topological order instead of looping back from the end.
 */
export function insertWaypointInNearestSegment(
  waypoints: Array<{ id: string; x: number; y: number }>,
  sourceCenter: { x: number; y: number },
  targetCenter: { x: number; y: number },
  x: number,
  y: number,
  id: string = crypto.randomUUID()
): Array<{ id: string; x: number; y: number }> {
  const nextPoint = { id, x: Math.round(x), y: Math.round(y) }
  if (waypoints.length === 0) return [nextPoint]

  const pts = [sourceCenter, ...waypoints, targetCenter]
  let bestSegIdx = waypoints.length
  let bestDistSq = Number.POSITIVE_INFINITY

  for (let i = 0; i < pts.length - 1; i++) {
    const distSq = pointToSegmentDistanceSq(x, y, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y)
    if (distSq < bestDistSq) {
      bestDistSq = distSq
      bestSegIdx = i
    }
  }

  const copy = [...waypoints]
  copy.splice(bestSegIdx, 0, nextPoint)
  return copy
}

/**
 * Computes a clean default coordinate for the Sidebar `+ Add Anchor` button by subdividing the
 * longest current polyline segment (with a gentle 22px perpendicular bow on the first anchor so
 * the curve bends visibly and clears any centered label pill, and never stacks two anchors on one pixel).
 */
export function computeNextDefaultWaypointPosition(
  waypoints: Array<{ id: string; x: number; y: number }>,
  sourceCenter: { x: number; y: number },
  targetCenter: { x: number; y: number }
): { x: number; y: number } {
  const pts = [sourceCenter, ...waypoints, targetCenter]
  let longestIdx = 0
  let longestLen = -1

  for (let i = 0; i < pts.length - 1; i++) {
    const dx = pts[i + 1].x - pts[i].x
    const dy = pts[i + 1].y - pts[i].y
    const len = Math.hypot(dx, dy)
    if (len > longestLen) {
      longestLen = len
      longestIdx = i
    }
  }

  const a = pts[longestIdx]
  const b = pts[longestIdx + 1]
  const midX = (a.x + b.x) / 2
  const midY = (a.y + b.y) / 2

  if (waypoints.length === 0 && longestLen > 1) {
    const nx = -(b.y - a.y) / longestLen
    const ny = (b.x - a.x) / longestLen
    return {
      x: Math.round(midX + nx * 22),
      y: Math.round(midY + ny * 22)
    }
  }

  return {
    x: Math.round(midX),
    y: Math.round(midY)
  }
}

// ============================================================================
// SHAPE-AWARE NODE BORDER PROJECTION (FLUSH EDGE ENDPOINTS ON ROUNDED SHAPES)
// ============================================================================

export const ENTITY_MIN_WIDTH = 150
export const ENTITY_MAX_WIDTH = 960
export const ENTITY_MIN_HEIGHT = 60
export const ENTITY_CARD_PORTRAIT_MIN_HEIGHT = 148
export const ENTITY_MAX_HEIGHT = 960

export function resolveEntityExplicitSize(data?: Partial<EntityNodeData>): {
  width?: number
  height?: number
  minWidth: number
  minHeight: number
  maxWidth: number
  maxHeight: number
} {
  const isCardPortrait = Boolean(data?.portrait) && data?.portraitMode === 'card'
  const minWidth = ENTITY_MIN_WIDTH
  const minHeight = isCardPortrait ? ENTITY_CARD_PORTRAIT_MIN_HEIGHT : ENTITY_MIN_HEIGHT
  const maxWidth = ENTITY_MAX_WIDTH
  const maxHeight = ENTITY_MAX_HEIGHT

  const width =
    typeof data?.entityWidth === 'number' && Number.isFinite(data.entityWidth) && data.entityWidth > 0
      ? Math.min(maxWidth, Math.max(minWidth, Math.round(data.entityWidth)))
      : undefined
  const height =
    typeof data?.entityHeight === 'number' &&
    Number.isFinite(data.entityHeight) &&
    data.entityHeight > 0
      ? Math.min(maxHeight, Math.max(minHeight, Math.round(data.entityHeight)))
      : undefined

  return { width, height, minWidth, minHeight, maxWidth, maxHeight }
}

export function computeEntityVisualScale(
  nodeId: string,
  data: EntityNodeData | undefined,
  _selected: boolean | undefined,
  edges: DndEdge[]
): number {
  let scaleFactor = data?.baseScale || 1
  if (data?.autoScale) {
    const connectionCount = edges.filter((e) => e.source === nodeId || e.target === nodeId).length
    scaleFactor *= Math.min(1 + connectionCount * 0.1, 2.5)
  }
  if (data?.isSearchFaded || data?.isDegreeFaded) scaleFactor *= 0.98
  return scaleFactor
}

export interface NodeBorderGeometryInput {
  positionAbsolute: { x: number; y: number }
  width: number
  height: number
  shape?: string
  scaleFactor?: number
}

/**
 * Projects a React Flow handle endpoint `(rawX, rawY)` directly onto the painted outer border
 * of an `EntityNode` across all 7 card shapes (`default`, `box`, `pill`, `leaf`, `arch`, `oval`, `sticky`),
 * eliminating both the 5px invisible-handle overhang and floating gaps outside curved corners/semicircles/ellipses.
 *
 * @param borderOutsetPx Radial offset relative to the outer card border:
 *   - `0` = exact outer perimeter of the card border
 *   - negative (e.g. `-1.2`) = tucked inside the `2px` card border for plain strokes
 *   - positive (e.g. `+1.6`) = pulled back slightly outside so an SVG `<marker>` tip lands at `0px` on the outer border
 */
export function snapEndpointToNodeBorder(
  rawX: number,
  rawY: number,
  side: 'top' | 'bottom' | 'left' | 'right',
  node: NodeBorderGeometryInput,
  borderOutsetPx = 0
): { x: number; y: number } {
  if (!node.width || !node.height || node.width <= 0 || node.height <= 0) {
    return { x: rawX, y: rawY }
  }

  const s = node.scaleFactor && node.scaleFactor > 0 ? node.scaleFactor : 1
  const cx = node.positionAbsolute.x + node.width / 2
  const cy = node.positionAbsolute.y + node.height / 2
  const w = node.width * s
  const h = node.height * s

  const inset = -borderOutsetPx
  const left = cx - w / 2 + inset
  const right = cx + w / 2 - inset
  const top = cy - h / 2 + inset
  const bottom = cy + h / 2 - inset
  const w0 = Math.max(2, right - left)
  const h0 = Math.max(2, bottom - top)

  const shape = node.shape || 'default'

  // True ellipse (`rounded-[50%]`)
  if (shape === 'oval') {
    const a = w0 / 2
    const b = h0 / 2
    if (side === 'top' || side === 'bottom') {
      const clampedX = Math.max(cx - a * 0.94, Math.min(cx + a * 0.94, rawX))
      const u = (clampedX - cx) / a
      const dy = b * Math.sqrt(Math.max(0, 1 - u * u))
      return { x: clampedX, y: side === 'top' ? cy - dy : cy + dy }
    } else {
      const clampedY = Math.max(cy - b * 0.94, Math.min(cy + b * 0.94, rawY))
      const v = (clampedY - cy) / b
      const dx = a * Math.sqrt(Math.max(0, 1 - v * v))
      return { x: side === 'left' ? cx - dx : cx + dx, y: clampedY }
    }
  }

  // Generalized 4-corner rounded rectangle (CSS Backgrounds & Borders L3 corner-radius normalization)
  let rTL = 0
  let rTR = 0
  let rBR = 0
  let rBL = 0

  if (shape === 'pill') {
    rTL = rTR = rBR = rBL = 9999
  } else if (shape === 'arch') {
    rTL = rTR = Math.max(0, 24 * s - inset)
    rBR = rBL = Math.max(0, 6 * s - inset)
  } else if (shape === 'leaf') {
    rTL = rBR = Math.max(0, 24 * s - inset)
    rTR = rBL = Math.max(0, 6 * s - inset)
  } else if (shape === 'box' || shape === 'sticky') {
    rTL = rTR = rBR = rBL = 0
  } else if (shape === 'group') {
    // 'group' -> rounded-xl (12px)
    rTL = rTR = rBR = rBL = Math.max(0, 12 * s - inset)
  } else if (shape === 'group:rounded') {
    rTL = rTR = rBR = rBL = Math.max(0, 16 * s - inset)
  } else if (shape === 'group:sharp') {
    rTL = rTR = rBR = rBL = Math.max(0, 6 * s - inset)
  } else if (shape === 'group:beveled') {
    rTL = rBR = Math.max(0, 16 * s - inset)
    rTR = rBL = Math.max(0, 2 * s - inset)
  } else if (shape === 'group:arch') {
    rTL = rTR = Math.max(0, 40 * s - inset)
    rBR = rBL = Math.max(0, 12 * s - inset)
  } else {
    // 'default' -> rounded-lg (8px)
    rTL = rTR = rBR = rBL = Math.max(0, 8 * s - inset)
  }

  const f = Math.min(
    1,
    rTL + rTR > 0 ? w0 / (rTL + rTR) : 1,
    rBL + rBR > 0 ? w0 / (rBL + rBR) : 1,
    rTL + rBL > 0 ? h0 / (rTL + rBL) : 1,
    rTR + rBR > 0 ? h0 / (rTR + rBR) : 1
  )
  rTL = Math.max(0, rTL * f)
  rTR = Math.max(0, rTR * f)
  rBR = Math.max(0, rBR * f)
  rBL = Math.max(0, rBL * f)

  const xGuard = Math.min(4 * s, w0 * 0.1)
  const yGuard = Math.min(4 * s, h0 * 0.1)

  if (side === 'top') {
    const x = Math.max(left + xGuard, Math.min(right - xGuard, rawX))
    if (x < left + rTL) {
      const dx = left + rTL - x
      return { x, y: top + rTL - Math.sqrt(Math.max(0, rTL * rTL - dx * dx)) }
    }
    if (x > right - rTR) {
      const dx = x - (right - rTR)
      return { x, y: top + rTR - Math.sqrt(Math.max(0, rTR * rTR - dx * dx)) }
    }
    return { x, y: top }
  }

  if (side === 'bottom') {
    const x = Math.max(left + xGuard, Math.min(right - xGuard, rawX))
    if (x < left + rBL) {
      const dx = left + rBL - x
      return { x, y: bottom - rBL + Math.sqrt(Math.max(0, rBL * rBL - dx * dx)) }
    }
    if (x > right - rBR) {
      const dx = x - (right - rBR)
      return { x, y: bottom - rBR + Math.sqrt(Math.max(0, rBR * rBR - dx * dx)) }
    }
    return { x, y: bottom }
  }

  if (side === 'left') {
    const y = Math.max(top + yGuard, Math.min(bottom - yGuard, rawY))
    if (y < top + rTL) {
      const dy = top + rTL - y
      return { x: left + rTL - Math.sqrt(Math.max(0, rTL * rTL - dy * dy)), y }
    }
    if (y > bottom - rBL) {
      const dy = y - (bottom - rBL)
      return { x: left + rBL - Math.sqrt(Math.max(0, rBL * rBL - dy * dy)), y }
    }
    return { x: left, y }
  }

  // side === 'right'
  const y = Math.max(top + yGuard, Math.min(bottom - yGuard, rawY))
  if (y < top + rTR) {
    const dy = top + rTR - y
    return { x: right - rTR + Math.sqrt(Math.max(0, rTR * rTR - dy * dy)), y }
  }
  if (y > bottom - rBR) {
    const dy = y - (bottom - rBR)
    return { x: right - rBR + Math.sqrt(Math.max(0, rBR * rBR - dy * dy)), y }
  }
  return { x: right, y }
}

// ============================================================================
// CUSTOM PERIMETER PORTS & 360-DEGREE EDGE ENDPOINT PROJECTION ENGINE
// ============================================================================

export const PERIMETER_SIDES: readonly PerimeterSide[] = ['top', 'right', 'bottom', 'left']

export const PERIMETER_SIDE_LABELS: Record<PerimeterSide, string> = {
  top: 'Top',
  right: 'Right',
  bottom: 'Bottom',
  left: 'Left'
}

export const PERIMETER_MIN_OFFSET = 0.05
export const PERIMETER_MAX_OFFSET = 0.95

export const STANDARD_SIDE_HANDLE_ID: Record<PerimeterSide, 't' | 'r' | 'b' | 'l'> = {
  top: 't',
  right: 'r',
  bottom: 'b',
  left: 'l'
}

export function clampPerimeterOffset(offset: number): number {
  if (!Number.isFinite(offset)) return 0.5
  const clamped = Math.max(PERIMETER_MIN_OFFSET, Math.min(PERIMETER_MAX_OFFSET, offset))
  return Math.round(clamped * 10000) / 10000
}

export function sanitizePerimeterSide(
  side: unknown,
  fallback: PerimeterSide = 'top'
): PerimeterSide {
  if (side === 'top' || side === 'right' || side === 'bottom' || side === 'left') {
    return side
  }
  return fallback
}

export interface BuiltinPortSpec {
  id: BuiltinPortId
  side: PerimeterSide
  offset: number
  defaultLabel: string
}

export const BUILTIN_PERIMETER_PORTS: readonly BuiltinPortSpec[] = [
  { id: 't', side: 'top', offset: 0.5, defaultLabel: 'Top' },
  { id: 'r', side: 'right', offset: 0.5, defaultLabel: 'Right' },
  { id: 'b', side: 'bottom', offset: 0.5, defaultLabel: 'Bottom' },
  { id: 'l', side: 'left', offset: 0.5, defaultLabel: 'Left' },
  { id: 'tl', side: 'top', offset: 0.25, defaultLabel: 'Top-Left' },
  { id: 'tr', side: 'top', offset: 0.75, defaultLabel: 'Top-Right' },
  { id: 'bl', side: 'bottom', offset: 0.25, defaultLabel: 'Bottom-Left' },
  { id: 'br', side: 'bottom', offset: 0.75, defaultLabel: 'Bottom-Right' }
]

const BUILTIN_PORT_BY_ID: ReadonlyMap<string, BuiltinPortSpec> = new Map(
  BUILTIN_PERIMETER_PORTS.map((spec) => [spec.id, spec])
)

export function isBuiltinPerimeterPortId(id: unknown): id is BuiltinPortId {
  return typeof id === 'string' && BUILTIN_PORT_BY_ID.has(id)
}

export function getBuiltinPortSpec(id: string | null | undefined): BuiltinPortSpec | undefined {
  if (!id) return undefined
  return BUILTIN_PORT_BY_ID.get(id)
}

export function getDefaultPortStyleForId(
  id: string,
  isGroup = false
): {
  shape: CustomPortShape
  size: CustomPortSize
  visibility: CustomPortVisibility
} {
  if (isBuiltinPerimeterPortId(id)) {
    return {
      shape: 'circle',
      size: isGroup ? 'md' : 'sm',
      visibility: 'hover'
    }
  }
  return {
    shape: 'diamond',
    size: 'md',
    visibility: 'dm'
  }
}

export function resolvePortDisplayName(port: CustomPerimeterPort, customIndex?: number): string {
  if (port.label?.trim()) return port.label.trim()
  const spec = getBuiltinPortSpec(port.id)
  if (spec) return spec.defaultLabel
  return customIndex !== undefined ? `Point ${customIndex + 1}` : 'Custom Point'
}

export const CUSTOM_PORT_SHAPES: readonly CustomPortShape[] = [
  'diamond',
  'circle',
  'ring',
  'square',
  'pill',
  'none'
]

export const CUSTOM_PORT_SHAPE_LABELS: Record<CustomPortShape, string> = {
  diamond: 'Diamond',
  circle: 'Circle',
  ring: 'Ring',
  square: 'Square',
  pill: 'Bar',
  none: 'Flush'
}

export const CUSTOM_PORT_SIZES: readonly CustomPortSize[] = ['sm', 'md', 'lg']

export const CUSTOM_PORT_SIZE_LABELS: Record<CustomPortSize, string> = {
  sm: 'Small',
  md: 'Medium',
  lg: 'Large'
}

export const CUSTOM_PORT_VISIBILITIES: readonly CustomPortVisibility[] = ['dm', 'hover', 'public']

export const CUSTOM_PORT_VISIBILITY_LABELS: Record<CustomPortVisibility, string> = {
  dm: 'DM Studio',
  hover: 'Hover Only',
  public: 'Public Map'
}

export function sanitizeCustomPortShape(
  val: unknown,
  fallback: CustomPortShape = 'diamond'
): CustomPortShape {
  if (
    val === 'diamond' ||
    val === 'circle' ||
    val === 'ring' ||
    val === 'square' ||
    val === 'pill' ||
    val === 'none'
  ) {
    return val
  }
  return fallback
}

export function sanitizeCustomPortSize(
  val: unknown,
  fallback: CustomPortSize = 'md'
): CustomPortSize {
  if (val === 'sm' || val === 'md' || val === 'lg') {
    return val
  }
  return fallback
}

export function sanitizeCustomPortVisibility(
  val: unknown,
  fallback: CustomPortVisibility = 'dm'
): CustomPortVisibility {
  if (val === 'dm' || val === 'hover' || val === 'public') {
    return val
  }
  return fallback
}

export function isBuiltinPortModified(
  port: CustomPerimeterPort,
  isGroup = false
): boolean {
  const spec = getBuiltinPortSpec(port.id)
  if (!spec) return false
  if (port.disabled) return true
  const defaults = getDefaultPortStyleForId(spec.id, isGroup)
  if (sanitizePerimeterSide(port.side, spec.side) !== spec.side) return true
  if (Math.abs(clampPerimeterOffset(port.offset) - spec.offset) > 0.0005) return true
  if (port.label?.trim()) return true
  if (sanitizeCustomPortShape(port.shape, defaults.shape) !== defaults.shape) return true
  if (normalizeHexColor(port.color)) return true
  if (sanitizeCustomPortSize(port.size, defaults.size) !== defaults.size) return true
  if (sanitizeCustomPortVisibility(port.visibility, defaults.visibility) !== defaults.visibility) {
    return true
  }
  if (port.showLabel) return true
  return false
}

/**
 * Resolves the unified list of ALL perimeter ports for a node:
 * - All 8 pre-populated built-in ports (`t`, `r`, `b`, `l`, `tl`, `tr`, `bl`, `br`), merged with any user overrides
 *   stored in `nodeData.customPorts` (preserving `disabled: true` for inert carrier handles).
 * - Followed by all user-added `cp-*` custom ports in creation order.
 */
export function resolveNodePerimeterPorts(
  nodeData?: Partial<EntityNodeData>,
  isGroup = false
): CustomPerimeterPort[] {
  const stored = nodeData?.customPorts || []
  const overrideById = new Map<string, CustomPerimeterPort>()
  const addedPorts: CustomPerimeterPort[] = []

  for (const raw of stored) {
    if (!raw || typeof raw.id !== 'string') continue
    if (isBuiltinPerimeterPortId(raw.id)) {
      overrideById.set(raw.id, raw)
    } else if (!raw.disabled) {
      const defaults = getDefaultPortStyleForId(raw.id, isGroup)
      addedPorts.push({
        id: raw.id,
        side: sanitizePerimeterSide(raw.side, 'right'),
        offset: clampPerimeterOffset(raw.offset),
        ...(raw.label?.trim() ? { label: raw.label.trim() } : {}),
        shape: sanitizeCustomPortShape(raw.shape, defaults.shape),
        ...(normalizeHexColor(raw.color) ? { color: normalizeHexColor(raw.color) } : {}),
        size: sanitizeCustomPortSize(raw.size, defaults.size),
        visibility: sanitizeCustomPortVisibility(raw.visibility, defaults.visibility),
        ...(raw.showLabel ? { showLabel: true } : {})
      })
    }
  }

  const resolvedBuiltins: CustomPerimeterPort[] = BUILTIN_PERIMETER_PORTS.map((spec) => {
    const ov = overrideById.get(spec.id)
    const defaults = getDefaultPortStyleForId(spec.id, isGroup)
    if (!ov) {
      return {
        id: spec.id,
        side: spec.side,
        offset: spec.offset,
        shape: defaults.shape,
        size: defaults.size,
        visibility: defaults.visibility
      }
    }
    return {
      id: spec.id,
      side: sanitizePerimeterSide(ov.side, spec.side),
      offset: clampPerimeterOffset(ov.offset ?? spec.offset),
      ...(ov.label?.trim() ? { label: ov.label.trim() } : {}),
      shape: sanitizeCustomPortShape(ov.shape, defaults.shape),
      ...(normalizeHexColor(ov.color) ? { color: normalizeHexColor(ov.color) } : {}),
      size: sanitizeCustomPortSize(ov.size, defaults.size),
      visibility: sanitizeCustomPortVisibility(ov.visibility, defaults.visibility),
      ...(ov.showLabel ? { showLabel: true } : {}),
      ...(ov.disabled ? { disabled: true } : {})
    }
  })

  return [...resolvedBuiltins, ...addedPorts]
}

/**
 * Returns all active (non-disabled) perimeter connection points on a node — both pre-populated and user-added.
 */
export function resolveActivePerimeterPorts(
  nodeData?: Partial<EntityNodeData>,
  isGroup = false
): CustomPerimeterPort[] {
  return resolveNodePerimeterPorts(nodeData, isGroup).filter((p) => !p.disabled)
}

export function hasModifiedBuiltinPorts(
  nodeData?: Partial<EntityNodeData>,
  isGroup = false
): boolean {
  if (!nodeData?.customPorts || nodeData.customPorts.length === 0) return false
  return nodeData.customPorts.some(
    (p) => isBuiltinPerimeterPortId(p.id) && isBuiltinPortModified(p, isGroup)
  )
}

export function resolveNodeShapeKey(
  nodeData?: Partial<EntityNodeData>,
  isGroup = false
): string {
  if (isGroup) {
    return nodeData?.groupShape ? `group:${nodeData.groupShape}` : 'group:rounded'
  }
  return nodeData?.shape || 'default'
}

export function standardHandleToPerimeterAnchor(
  handleId: string | null | undefined,
  fallbackSide: PerimeterSide = 'right'
): PerimeterAnchor {
  switch (handleId) {
    case 't':
      return { side: 'top', offset: 0.5 }
    case 'tl':
      return { side: 'top', offset: 0.25 }
    case 'tr':
      return { side: 'top', offset: 0.75 }
    case 'b':
      return { side: 'bottom', offset: 0.5 }
    case 'bl':
      return { side: 'bottom', offset: 0.25 }
    case 'br':
      return { side: 'bottom', offset: 0.75 }
    case 'l':
      return { side: 'left', offset: 0.5 }
    case 'r':
      return { side: 'right', offset: 0.5 }
    default:
      return { side: fallbackSide, offset: 0.5 }
  }
}

export function resolveEffectiveEdgePerimeterAnchor(params: {
  handleId?: string | null
  explicitAnchor?: PerimeterAnchor | null
  nodeData?: Partial<EntityNodeData>
  fallbackSide?: PerimeterSide
}): {
  anchor: PerimeterAnchor
  customPort?: CustomPerimeterPort
  isExplicitOrCustom: boolean
} {
  const { handleId, explicitAnchor, nodeData, fallbackSide = 'right' } = params

  // 1. Explicit per-edge freeform anchors take priority over carrier handles ('t' | 'r' | 'b' | 'l')
  if (
    explicitAnchor &&
    typeof explicitAnchor.offset === 'number' &&
    Number.isFinite(explicitAnchor.offset)
  ) {
    return {
      anchor: {
        side: sanitizePerimeterSide(explicitAnchor.side, fallbackSide),
        offset: clampPerimeterOffset(explicitAnchor.offset)
      },
      isExplicitOrCustom: true
    }
  }

  // 2. Match against unified perimeter ports (both customized/default built-in ports and added cp-* ports)
  if (handleId) {
    const isGroup = Boolean(nodeData?.isGroup)
    const allPorts = resolveNodePerimeterPorts(nodeData, isGroup)
    const matchedPort = allPorts.find((p) => p.id === handleId && !p.disabled)
    if (matchedPort) {
      const spec = getBuiltinPortSpec(matchedPort.id)
      const isMovedBuiltin = Boolean(
        spec &&
          (matchedPort.side !== spec.side ||
            Math.abs(matchedPort.offset - spec.offset) > 0.0005)
      )
      return {
        anchor: {
          side: sanitizePerimeterSide(matchedPort.side, fallbackSide),
          offset: clampPerimeterOffset(matchedPort.offset)
        },
        customPort: matchedPort,
        isExplicitOrCustom: !spec || isMovedBuiltin
      }
    }
  }

  return {
    anchor: standardHandleToPerimeterAnchor(handleId, fallbackSide),
    isExplicitOrCustom: false
  }
}

/**
 * Resolves a normalized `{ side, offset }` perimeter anchor into exact flow coordinates `(x, y)`
 * along the painted border of any entity shape (`default`, `box`, `sticky`, `pill`, `leaf`, `arch`, `oval`)
 * or group shape (`group:rounded`, `group:sharp`, `group:beveled`, `group:arch`).
 */
export function resolvePerimeterAnchorPoint(
  anchor: PerimeterAnchor,
  node: NodeBorderGeometryInput,
  borderOutsetPx = 0
): { x: number; y: number; side: PerimeterSide } {
  const side = sanitizePerimeterSide(anchor.side, 'top')
  const t = clampPerimeterOffset(anchor.offset)
  const s = node.scaleFactor && node.scaleFactor > 0 ? node.scaleFactor : 1
  const cx = node.positionAbsolute.x + node.width / 2
  const cy = node.positionAbsolute.y + node.height / 2
  const w = Math.max(2, node.width * s)
  const h = Math.max(2, node.height * s)
  const left = cx - w / 2
  const top = cy - h / 2

  let rawX = cx
  let rawY = cy
  if (side === 'top') {
    rawX = left + w * t
    rawY = top
  } else if (side === 'bottom') {
    rawX = left + w * t
    rawY = top + h
  } else if (side === 'left') {
    rawX = left
    rawY = top + h * t
  } else {
    rawX = left + w
    rawY = top + h * t
  }

  const pt = snapEndpointToNodeBorder(rawX, rawY, side, node, borderOutsetPx)
  return { x: pt.x, y: pt.y, side }
}

/**
 * Computes inline CSS positioning for a custom `<Handle>` inside `EntityNode` or `GroupNode`
 * using unscaled local node coordinates so ports sit directly on curved borders (`oval`, `pill`, `arch`, `leaf`)
 * without bottom/right half-handle offset drift.
 */
export function resolveNodeLocalCustomPortStyle(
  port: PerimeterAnchor,
  width: number,
  height: number,
  shape?: string
): {
  left: string
  top: string
  right: 'auto'
  bottom: 'auto'
  transform: string
} {
  const safeW = Math.max(2, width)
  const safeH = Math.max(2, height)
  const pt = resolvePerimeterAnchorPoint(
    port,
    {
      positionAbsolute: { x: 0, y: 0 },
      width: safeW,
      height: safeH,
      shape,
      scaleFactor: 1
    },
    0
  )
  const leftPct = Math.round((pt.x / safeW) * 10000) / 100
  const topPct = Math.round((pt.y / safeH) * 10000) / 100
  return {
    left: `${leftPct}%`,
    top: `${topPct}%`,
    right: 'auto',
    bottom: 'auto',
    transform: 'translate(-50%, -50%)'
  }
}

/**
 * Projects any flow-space coordinate `(flowX, flowY)` onto the nearest perimeter point across all 4 sides
 * of `node`, with optional magnetic snapping (`25%`, `50%`, `75%` and custom ports on that side).
 * Pass `magneticSnap: false` (e.g. when holding `Alt`) for smooth continuous `0.05..0.95` sliding.
 */
export function projectPointToNodePerimeter(
  flowX: number,
  flowY: number,
  node: NodeBorderGeometryInput,
  options?: {
    customPorts?: CustomPerimeterPort[]
    magneticSnap?: boolean
    excludePortId?: string
  }
): {
  side: PerimeterSide
  offset: number
  x: number
  y: number
  matchedPortId?: string
} {
  const s = node.scaleFactor && node.scaleFactor > 0 ? node.scaleFactor : 1
  const cx = node.positionAbsolute.x + node.width / 2
  const cy = node.positionAbsolute.y + node.height / 2
  const w = Math.max(2, node.width * s)
  const h = Math.max(2, node.height * s)
  const left = cx - w / 2
  const top = cy - h / 2

  const normDx = Math.abs((flowX - cx) / (w / 2))
  const normDy = Math.abs((flowY - cy) / (h / 2))
  const prefersHorizontalNormal = normDx >= normDy

  let bestSide: PerimeterSide = 'top'
  let bestOffset = 0.5
  let bestScore = Number.POSITIVE_INFINITY

  for (const side of PERIMETER_SIDES) {
    const rawOffset =
      side === 'top' || side === 'bottom'
        ? clampPerimeterOffset((flowX - left) / w)
        : clampPerimeterOffset((flowY - top) / h)
    const candidatePt = resolvePerimeterAnchorPoint({ side, offset: rawOffset }, node, 0)
    const dist = Math.hypot(flowX - candidatePt.x, flowY - candidatePt.y)
    const isHorizNormal = side === 'left' || side === 'right'
    const quadrantTiePenalty = isHorizNormal === prefersHorizontalNormal ? 0 : 0.35
    const score = dist + quadrantTiePenalty
    if (score < bestScore) {
      bestScore = score
      bestSide = side
      bestOffset = rawOffset
    }
  }

  let finalOffset = bestOffset
  let matchedPortId: string | undefined
  const magnetic = options?.magneticSnap !== false

  if (magnetic) {
    const candidatePorts = (options?.customPorts || []).filter(
      (p) => !p.disabled && p.side === bestSide && p.id !== options?.excludePortId
    )
    let closestPort: CustomPerimeterPort | undefined
    let closestPortDiff = Number.POSITIVE_INFINITY
    for (const p of candidatePorts) {
      const diff = Math.abs(bestOffset - clampPerimeterOffset(p.offset))
      if (diff <= 0.045 && diff < closestPortDiff) {
        closestPortDiff = diff
        closestPort = p
      }
    }

    if (closestPort) {
      finalOffset = clampPerimeterOffset(closestPort.offset)
      matchedPortId = closestPort.id
    } else if (options?.customPorts === undefined || Boolean(options?.excludePortId)) {
      for (const detent of [0.25, 0.5, 0.75]) {
        if (Math.abs(bestOffset - detent) <= 0.03) {
          finalOffset = detent
          break
        }
      }
    }
  }

  const finalPt = resolvePerimeterAnchorPoint({ side: bestSide, offset: finalOffset }, node, 0)
  return {
    side: bestSide,
    offset: finalOffset,
    x: finalPt.x,
    y: finalPt.y,
    ...(matchedPortId ? { matchedPortId } : {})
  }
}

/**
 * Steps a `PerimeterAnchor` clockwise (`clockwiseDelta > 0`) or counter-clockwise (`clockwiseDelta < 0`)
 * seamlessly around all 4 corners (`top -> right -> bottom -> left -> top`) with zero dead stops at corners.
 */
export function stepPerimeterAnchor(
  anchor: PerimeterAnchor,
  clockwiseDelta: number
): PerimeterAnchor {
  const span = PERIMETER_MAX_OFFSET - PERIMETER_MIN_OFFSET // 0.90 per side
  const totalRing = span * 4 // 3.60 around all 4 sides
  const side = sanitizePerimeterSide(anchor.side, 'top')
  const clamped = clampPerimeterOffset(anchor.offset)

  // Convert local side offset into clockwise progress [0, span] along that side
  const sideProgress =
    side === 'top' || side === 'right'
      ? clamped - PERIMETER_MIN_OFFSET
      : PERIMETER_MAX_OFFSET - clamped

  const sideIndex = side === 'top' ? 0 : side === 'right' ? 1 : side === 'bottom' ? 2 : 3
  const currentPos = sideIndex * span + sideProgress
  const wrappedPos = (((currentPos + clockwiseDelta) % totalRing) + totalRing) % totalRing

  const nextSideIndex = Math.min(3, Math.floor(wrappedPos / span))
  const nextProgress = wrappedPos - nextSideIndex * span
  const nextSide = PERIMETER_SIDES[nextSideIndex]
  const rawNextOffset =
    nextSide === 'top' || nextSide === 'right'
      ? PERIMETER_MIN_OFFSET + nextProgress
      : PERIMETER_MAX_OFFSET - nextProgress

  return {
    side: nextSide,
    offset: clampPerimeterOffset(rawNextOffset)
  }
}

export function formatPerimeterAnchorDescription(
  anchor: PerimeterAnchor,
  customPortLabel?: string
): string {
  const sideLabel = PERIMETER_SIDE_LABELS[sanitizePerimeterSide(anchor.side, 'top')]
  const pct = Math.round(clampPerimeterOffset(anchor.offset) * 100)
  if (customPortLabel?.trim()) {
    return `${customPortLabel.trim()} (${sideLabel} edge, ${pct}%)`
  }
  return `${sideLabel} edge, ${pct}%`
}

// ============================================================================
// MULTI-SELECT ALIGNMENT, DISTRIBUTION & GRID LAYOUT UTILITIES
// ============================================================================

export type AlignMode = 'left' | 'centerX' | 'right' | 'top' | 'middleY' | 'bottom'
export type DistributeMode = 'horizontal' | 'vertical'

export function resolveNodeSize(n: {
  type?: string
  measured?: { width?: number; height?: number }
  data?: Partial<EntityNodeData>
}): { w: number; h: number } {
  if (n.type === 'edgeProxy') {
    return {
      w: n.measured?.width || 60,
      h: n.measured?.height || 20
    }
  }
  if (n.type === 'groupRegion' || n.data?.isGroup) {
    return {
      w: Math.max(220, n.data?.groupWidth || n.measured?.width || 360),
      h: Math.max(150, n.data?.groupHeight || n.measured?.height || 240)
    }
  }
  const scale = n.data?.baseScale || 1
  const { width: customW, height: customH } = resolveEntityExplicitSize(n.data)
  const explicitW =
    customW ??
    (typeof (n as any).width === 'number'
      ? (n as any).width
      : typeof (n as any).style?.width === 'number'
        ? (n as any).style.width
        : undefined)
  const explicitH =
    customH ??
    (typeof (n as any).height === 'number'
      ? (n as any).height
      : typeof (n as any).style?.height === 'number'
        ? (n as any).style.height
        : undefined)
  const baseW = customW ?? n.measured?.width ?? explicitW ?? 225
  const baseH =
    customH ??
    n.measured?.height ??
    explicitH ??
    (n.data?.portraitMode === 'card' && n.data?.portrait ? 195 : 88)
  return { w: baseW * scale, h: baseH * scale }
}

/**
 * Builds an exact `NodeBorderGeometryInput` from a store `DndNode` using unscaled layout dimensions
 * `(baseW, baseH)` plus `computeEntityVisualScale`, matching React Flow's `measured` + CSS `scale()` center.
 */
export function buildNodeBorderGeometry(
  node: DndNode,
  edges: DndEdge[] = []
): NodeBorderGeometryInput {
  const isGroup = node.type === 'groupRegion' || Boolean(node.data?.isGroup)
  if (isGroup) {
    const w = Math.max(220, node.data?.groupWidth || node.measured?.width || 360)
    const h = Math.max(150, node.data?.groupHeight || node.measured?.height || 240)
    return {
      positionAbsolute: node.position,
      width: w,
      height: h,
      shape: resolveNodeShapeKey(node.data, true),
      scaleFactor: 1
    }
  }

  const { width: customW, height: customH } = resolveEntityExplicitSize(node.data)
  const explicitW =
    customW ??
    (typeof (node as any).width === 'number'
      ? (node as any).width
      : typeof (node as any).style?.width === 'number'
        ? (node as any).style.width
        : undefined)
  const explicitH =
    customH ??
    (typeof (node as any).height === 'number'
      ? (node as any).height
      : typeof (node as any).style?.height === 'number'
        ? (node as any).style.height
        : undefined)
  const baseW = customW ?? node.measured?.width ?? explicitW ?? 225
  const baseH =
    customH ??
    node.measured?.height ??
    explicitH ??
    (node.data?.portraitMode === 'card' && node.data?.portrait ? 195 : 88)

  return {
    positionAbsolute: node.position,
    width: baseW,
    height: baseH,
    shape: resolveNodeShapeKey(node.data, false),
    scaleFactor: computeEntityVisualScale(node.id, node.data, node.selected, edges)
  }
}

/**
 * Resolves the exact border endpoint coordinate `(x, y)` for either end (`source` or `target`) of an edge
 * so curve waypoint insertion and Sidebar default waypoint placement respect custom ports and anchors.
 */
export function resolveEdgeEndpointPoint(
  edge: DndEdge,
  which: 'source' | 'target',
  nodes: DndNode[],
  edges: DndEdge[]
): { x: number; y: number } {
  const endpointId = which === 'source' ? edge.source : edge.target
  if (endpointId.startsWith('proxy-')) {
    return resolveEdgeEndpointCenter(endpointId, nodes, edges)
  }
  const node = nodes.find((n) => n.id === endpointId)
  if (!node) return { x: 0, y: 0 }

  const geom = buildNodeBorderGeometry(node, edges)
  const handleId = which === 'source' ? edge.sourceHandle : edge.targetHandle
  const explicitAnchor = which === 'source' ? edge.data?.sourceAnchor : edge.data?.targetAnchor
  const fallbackSide: PerimeterSide = which === 'source' ? 'right' : 'left'
  const { anchor } = resolveEffectiveEdgePerimeterAnchor({
    handleId,
    explicitAnchor,
    nodeData: node.data,
    fallbackSide
  })
  const pt = resolvePerimeterAnchorPoint(anchor, geom, 0)
  return { x: pt.x, y: pt.y }
}

/**
 * Hit-tests `(flowX, flowY)` during an interactive edge-endpoint drag to determine whether the user is
 * sliding along the `currentAttachmentNodeId` or dragging onto a different connectable entity/group.
 * - Keeps attachment on `currentAttachmentNodeId` while near its border unless hovering directly inside another entity.
 * - Group regions match along their border/header band (`<= 28px`) so hollow group interiors never hijack member drags.
 */
export function findConnectableNodeAtPoint(
  flowX: number,
  flowY: number,
  nodes: DndNode[],
  edges: DndEdge[],
  options?: {
    currentAttachmentNodeId?: string
    disallowNodeId?: string
    hideSecrets?: boolean
  }
): DndNode | null {
  const hideSecrets = Boolean(options?.hideSecrets)
  const candidates = nodes.filter((n) => {
    if ((n.type as string) === 'edgeProxy') return false
    if (options?.disallowNodeId && n.id === options.disallowNodeId) return false
    if (hideSecrets && n.data?.isHidden) return false
    return true
  })

  // 1. Check non-group entity cards from frontmost (end of array) to backmost
  for (let i = candidates.length - 1; i >= 0; i--) {
    const n = candidates[i]
    if (n.type === 'groupRegion' || n.data?.isGroup) continue
    if (n.id === options?.currentAttachmentNodeId) continue
    const geom = buildNodeBorderGeometry(n, edges)
    const s = geom.scaleFactor || 1
    const cx = geom.positionAbsolute.x + geom.width / 2
    const cy = geom.positionAbsolute.y + geom.height / 2
    const halfW = (geom.width * s) / 2 + 12
    const halfH = (geom.height * s) / 2 + 12
    if (Math.abs(flowX - cx) <= halfW && Math.abs(flowY - cy) <= halfH) {
      return n
    }
  }

  // 2. If cursor is still reasonably near the current node's perimeter (<= 48px), stay on current node
  if (options?.currentAttachmentNodeId) {
    const current = candidates.find((n) => n.id === options.currentAttachmentNodeId)
    if (current) {
      const geom = buildNodeBorderGeometry(current, edges)
      const proj = projectPointToNodePerimeter(flowX, flowY, geom, { magneticSnap: false })
      if (Math.hypot(flowX - proj.x, flowY - proj.y) <= 48) {
        return current
      }
    }
  }

  // 3. Check Group Region containers along their perimeter band (<= 28px from group border)
  for (let i = candidates.length - 1; i >= 0; i--) {
    const n = candidates[i]
    if (n.type !== 'groupRegion' && !n.data?.isGroup) continue
    const geom = buildNodeBorderGeometry(n, edges)
    const proj = projectPointToNodePerimeter(flowX, flowY, geom, { magneticSnap: false })
    if (Math.hypot(flowX - proj.x, flowY - proj.y) <= 28) {
      return n
    }
  }

  // 4. Fallback to currentAttachmentNodeId so dragging into empty space still orbits the attached card smoothly
  if (options?.currentAttachmentNodeId) {
    const current = candidates.find((n) => n.id === options.currentAttachmentNodeId)
    if (current) return current
  }

  return null
}

export function isNodeEffectivelyLocked(
  node: DndNode,
  nodesOrMap: ReadonlyMap<string, DndNode> | readonly DndNode[]
): boolean {
  if (node.data?.isLocked) return true
  if (node.data?.groupId) {
    const parent = Array.isArray(nodesOrMap)
      ? nodesOrMap.find((n) => n.id === node.data.groupId)
      : (nodesOrMap as ReadonlyMap<string, DndNode>).get(node.data.groupId)
    if (parent?.data?.isLocked) return true
  }
  return false
}

export function computeGroupBoundsForMembers(
  members: DndNode[]
): { x: number; y: number; width: number; height: number } | null {
  const validMembers = members.filter((m) => m.type !== 'groupRegion' && !m.data?.isGroup)
  if (validMembers.length === 0) return null

  const padTop = 52
  const padX = 32
  const padBottom = 32

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxRight = Number.NEGATIVE_INFINITY
  let maxBottom = Number.NEGATIVE_INFINITY

  for (const m of validMembers) {
    const { w, h } = resolveNodeSize(m)
    minX = Math.min(minX, m.position.x)
    minY = Math.min(minY, m.position.y)
    maxRight = Math.max(maxRight, m.position.x + w)
    maxBottom = Math.max(maxBottom, m.position.y + h)
  }

  return {
    x: Math.round(minX - padX),
    y: Math.round(minY - padTop),
    width: Math.max(240, Math.round(maxRight - minX + padX * 2)),
    height: Math.max(170, Math.round(maxBottom - minY + padTop + padBottom))
  }
}

function getNodeSize(n: DndNode): { w: number; h: number } {
  return resolveNodeSize(n)
}

export function alignSelectedNodes(
  nodes: DndNode[],
  mode: AlignMode
): Map<string, { x: number; y: number }> {
  const updates = new Map<string, { x: number; y: number }>()
  if (nodes.length < 2) return updates

  const rects = nodes.map((n) => {
    const { w, h } = getNodeSize(n)
    return {
      id: n.id,
      x: n.position.x,
      y: n.position.y,
      w,
      h,
      cx: n.position.x + w / 2,
      cy: n.position.y + h / 2,
      right: n.position.x + w,
      bottom: n.position.y + h
    }
  })

  if (mode === 'left') {
    const minLeft = Math.min(...rects.map((r) => r.x))
    rects.forEach((r) => updates.set(r.id, { x: Math.round(minLeft), y: r.y }))
  } else if (mode === 'right') {
    const maxRight = Math.max(...rects.map((r) => r.right))
    rects.forEach((r) => updates.set(r.id, { x: Math.round(maxRight - r.w), y: r.y }))
  } else if (mode === 'centerX') {
    const avgCx = rects.reduce((acc, r) => acc + r.cx, 0) / rects.length
    rects.forEach((r) => updates.set(r.id, { x: Math.round(avgCx - r.w / 2), y: r.y }))
  } else if (mode === 'top') {
    const minTop = Math.min(...rects.map((r) => r.y))
    rects.forEach((r) => updates.set(r.id, { x: r.x, y: Math.round(minTop) }))
  } else if (mode === 'bottom') {
    const maxBottom = Math.max(...rects.map((r) => r.bottom))
    rects.forEach((r) => updates.set(r.id, { x: r.x, y: Math.round(maxBottom - r.h) }))
  } else if (mode === 'middleY') {
    const avgCy = rects.reduce((acc, r) => acc + r.cy, 0) / rects.length
    rects.forEach((r) => updates.set(r.id, { x: r.x, y: Math.round(avgCy - r.h / 2) }))
  }

  return updates
}

export function distributeSelectedNodes(
  nodes: DndNode[],
  mode: DistributeMode
): Map<string, { x: number; y: number }> {
  const updates = new Map<string, { x: number; y: number }>()
  if (nodes.length < 3) return updates

  const rects = nodes.map((n) => {
    const { w, h } = getNodeSize(n)
    return {
      id: n.id,
      x: n.position.x,
      y: n.position.y,
      w,
      h,
      cx: n.position.x + w / 2,
      cy: n.position.y + h / 2
    }
  })

  if (mode === 'horizontal') {
    const sorted = [...rects].sort((a, b) => a.cx - b.cx)
    const firstCx = sorted[0].cx
    const lastCx = sorted[sorted.length - 1].cx
    const step = (lastCx - firstCx) / (sorted.length - 1)
    sorted.forEach((r, idx) => {
      const targetCx = firstCx + step * idx
      updates.set(r.id, { x: Math.round(targetCx - r.w / 2), y: r.y })
    })
  } else {
    const sorted = [...rects].sort((a, b) => a.cy - b.cy)
    const firstCy = sorted[0].cy
    const lastCy = sorted[sorted.length - 1].cy
    const step = (lastCy - firstCy) / (sorted.length - 1)
    sorted.forEach((r, idx) => {
      const targetCy = firstCy + step * idx
      updates.set(r.id, { x: r.x, y: Math.round(targetCy - r.h / 2) })
    })
  }

  return updates
}

export function tidySelectedNodesGrid(nodes: DndNode[]): Map<string, { x: number; y: number }> {
  const updates = new Map<string, { x: number; y: number }>()
  if (nodes.length < 2) return updates

  const sorted = [...nodes].sort((a, b) =>
    Math.abs(a.position.y - b.position.y) > 90
      ? a.position.y - b.position.y
      : a.position.x - b.position.x
  )

  const cols = Math.max(2, Math.ceil(Math.sqrt(sorted.length)))
  const startX = Math.min(...sorted.map((n) => n.position.x))
  const startY = Math.min(...sorted.map((n) => n.position.y))
  const colPitch = 288
  const rowPitch = 216

  sorted.forEach((n, idx) => {
    const col = idx % cols
    const row = Math.floor(idx / cols)
    updates.set(n.id, {
      x: Math.round((startX + col * colPitch) / 16) * 16,
      y: Math.round((startY + row * rowPitch) / 16) * 16
    })
  })

  return updates
}

export type LayerReorderDirection = 'front' | 'forward' | 'backward' | 'back'

export interface NodeStackBounds {
  canBringFront: boolean
  canSendBack: boolean
  tierCount: number
}

function isGroupTierNode(n: DndNode): boolean {
  return n.type === 'groupRegion' || Boolean(n.data?.isGroup)
}

export function doNodesOverlapOnCanvas(a: DndNode, b: DndNode): boolean {
  const { w: aw, h: ah } = resolveNodeSize(a)
  const { w: bw, h: bh } = resolveNodeSize(b)
  const margin = 1
  return (
    a.position.x + margin < b.position.x + bw &&
    a.position.x + aw - margin > b.position.x &&
    a.position.y + margin < b.position.y + bh &&
    a.position.y + ah - margin > b.position.y
  )
}

function computeTierStackBounds(tierList: DndNode[], targetIdSet: Set<string>): NodeStackBounds {
  let seenNonTarget = false
  let canSendBack = false
  for (let i = 0; i < tierList.length; i++) {
    if (targetIdSet.has(tierList[i].id)) {
      if (seenNonTarget) canSendBack = true
    } else {
      seenNonTarget = true
    }
  }

  let seenNonTargetFromTop = false
  let canBringFront = false
  for (let i = tierList.length - 1; i >= 0; i--) {
    if (targetIdSet.has(tierList[i].id)) {
      if (seenNonTargetFromTop) canBringFront = true
    } else {
      seenNonTargetFromTop = true
    }
  }

  return {
    canBringFront,
    canSendBack,
    tierCount: tierList.length
  }
}

/**
 * Evaluates whether the specified node(s) can move further forward/to-front or backward/to-back
 * within their respective z-index tier (`entity` vs `groupRegion`).
 */
export function getNodeStackBounds(nodes: DndNode[], nodeIds: string[]): NodeStackBounds {
  if (nodeIds.length === 0) {
    return { canBringFront: false, canSendBack: false, tierCount: 0 }
  }
  const idSet = new Set(nodeIds)
  const targets = nodes.filter((n) => idSet.has(n.id))
  if (targets.length === 0) {
    return { canBringFront: false, canSendBack: false, tierCount: 0 }
  }

  const hasGroupTarget = targets.some(isGroupTierNode)
  const hasEntityTarget = targets.some((n) => !isGroupTierNode(n))

  let canBringFront = false
  let canSendBack = false
  let tierCount = 0

  if (hasEntityTarget) {
    const entityTier = nodes.filter((n) => !isGroupTierNode(n))
    const b = computeTierStackBounds(entityTier, idSet)
    canBringFront = canBringFront || b.canBringFront
    canSendBack = canSendBack || b.canSendBack
    tierCount += b.tierCount
  }

  if (hasGroupTarget) {
    const groupTier = nodes.filter(isGroupTierNode)
    const b = computeTierStackBounds(groupTier, idSet)
    canBringFront = canBringFront || b.canBringFront
    canSendBack = canSendBack || b.canSendBack
    tierCount += b.tierCount
  }

  return { canBringFront, canSendBack, tierCount }
}

function reorderSingleTier(
  tierList: DndNode[],
  targetIdSet: Set<string>,
  direction: LayerReorderDirection
): DndNode[] {
  const selectedInTier = tierList.filter((n) => targetIdSet.has(n.id))
  const othersInTier = tierList.filter((n) => !targetIdSet.has(n.id))
  if (selectedInTier.length === 0 || othersInTier.length === 0) {
    return tierList
  }

  if (direction === 'front') {
    return [...othersInTier, ...selectedInTier]
  }

  if (direction === 'back') {
    return [...selectedInTier, ...othersInTier]
  }

  if (direction === 'backward') {
    // Overlap-smart step: if any lower-ranked peer overlaps any target card, move targets immediately
    // behind the topmost overlapping peer below them so 1 click visibly swaps stacked cards.
    let pivotNodeId: string | null = null
    for (let i = tierList.length - 1; i >= 0; i--) {
      const candidate = tierList[i]
      if (targetIdSet.has(candidate.id)) continue
      const overlapsHigherTarget = tierList
        .slice(i + 1)
        .some((above) => targetIdSet.has(above.id) && doNodesOverlapOnCanvas(candidate, above))
      if (overlapsHigherTarget) {
        pivotNodeId = candidate.id
        break
      }
    }

    if (pivotNodeId) {
      const pivotIdxInOthers = othersInTier.findIndex((n) => n.id === pivotNodeId)
      if (pivotIdxInOthers !== -1) {
        return [
          ...othersInTier.slice(0, pivotIdxInOthers),
          ...selectedInTier,
          ...othersInTier.slice(pivotIdxInOthers)
        ]
      }
    }

    // Fallback when no lower peer overlaps: step backward by 1 slot in tier order
    const next = [...tierList]
    for (let i = 1; i < next.length; i++) {
      if (targetIdSet.has(next[i].id) && !targetIdSet.has(next[i - 1].id)) {
        const tmp = next[i - 1]
        next[i - 1] = next[i]
        next[i] = tmp
      }
    }
    return next
  }

  // direction === 'forward'
  // Overlap-smart step: if any higher-ranked peer overlaps any target card, move targets immediately
  // in front of the lowest overlapping peer above them so 1 click visibly steps above the covering card.
  let pivotNodeId: string | null = null
  for (let i = 0; i < tierList.length; i++) {
    const candidate = tierList[i]
    if (targetIdSet.has(candidate.id)) continue
    const overlapsLowerTarget = tierList
      .slice(0, i)
      .some((below) => targetIdSet.has(below.id) && doNodesOverlapOnCanvas(candidate, below))
    if (overlapsLowerTarget) {
      pivotNodeId = candidate.id
      break
    }
  }

  if (pivotNodeId) {
    const pivotIdxInOthers = othersInTier.findIndex((n) => n.id === pivotNodeId)
    if (pivotIdxInOthers !== -1) {
      return [
        ...othersInTier.slice(0, pivotIdxInOthers + 1),
        ...selectedInTier,
        ...othersInTier.slice(pivotIdxInOthers + 1)
      ]
    }
  }

  // Fallback when no higher peer overlaps: step forward by 1 slot in tier order
  const next = [...tierList]
  for (let i = next.length - 2; i >= 0; i--) {
    if (targetIdSet.has(next[i].id) && !targetIdSet.has(next[i + 1].id)) {
      const tmp = next[i + 1]
      next[i + 1] = next[i]
      next[i] = tmp
    }
  }
  return next
}

/**
 * Reorders target nodes within their strict canvas tier (`entity` vs `groupRegion`) so entities
 * never cross into the group band and groups never cross into the entity or connection bands.
 */
export function reorderNodesByTier(
  nodes: DndNode[],
  nodeIds: string[],
  direction: LayerReorderDirection
): DndNode[] {
  if (nodeIds.length === 0 || nodes.length < 2) return nodes
  const targetIdSet = new Set(nodeIds)

  const groupIndices: number[] = []
  const entityIndices: number[] = []
  for (let i = 0; i < nodes.length; i++) {
    if (isGroupTierNode(nodes[i])) groupIndices.push(i)
    else entityIndices.push(i)
  }

  const nextNodes = [...nodes]

  if (groupIndices.some((idx) => targetIdSet.has(nodes[idx].id))) {
    const reorderedGroups = reorderSingleTier(
      groupIndices.map((idx) => nodes[idx]),
      targetIdSet,
      direction
    )
    groupIndices.forEach((slotIdx, k) => {
      nextNodes[slotIdx] = reorderedGroups[k]
    })
  }

  if (entityIndices.some((idx) => targetIdSet.has(nodes[idx].id))) {
    const reorderedEntities = reorderSingleTier(
      entityIndices.map((idx) => nodes[idx]),
      targetIdSet,
      direction
    )
    entityIndices.forEach((slotIdx, k) => {
      nextNodes[slotIdx] = reorderedEntities[k]
    })
  }

  return nextNodes
}

// ============================================================================
// DRAG SNAP / GRID STEP HELPERS & BACKGROUND HARMONIZATION
// ============================================================================

export const DRAG_SNAP_SIZES: readonly DragSnapSize[] = [4, 8, 16, 24, 32, 48]
export const DRAG_SNAP_OPTIONS: readonly DragSnapOption[] = [0, 4, 8, 16, 24, 32, 48]
export const DEFAULT_DRAG_SNAP_SIZE: DragSnapSize = 16
export const DRAG_SNAP_ENABLED_STORAGE_KEY = 'dcc:drag-snap-enabled'
export const DRAG_SNAP_SIZE_STORAGE_KEY = 'dcc:drag-snap-size'

export const DRAG_SNAP_LABELS: Record<DragSnapOption, { short: string; full: string }> = {
  0: { short: 'Free', full: 'Free (Smooth 1px)' },
  4: { short: '4px', full: '4px (Micro)' },
  8: { short: '8px', full: '8px (Fine)' },
  16: { short: '16px', full: '16px (Standard)' },
  24: { short: '24px', full: '24px (Medium)' },
  32: { short: '32px', full: '32px (Large)' },
  48: { short: '48px', full: '48px (Coarse)' }
}

export function sanitizeDragSnapSize(raw: unknown): DragSnapSize {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN
  if ((DRAG_SNAP_SIZES as readonly number[]).includes(n)) {
    return n as DragSnapSize
  }
  return DEFAULT_DRAG_SNAP_SIZE
}

export function snapCoordinateToStep(
  value: number,
  enabled: boolean,
  stepSize: DragSnapSize
): number {
  if (!enabled || !Number.isFinite(stepSize) || stepSize <= 1) {
    return Math.round(value)
  }
  return Math.round(value / stepSize) * stepSize
}

/**
 * Computes the visual `<Background gap={...}>` for the active canvas theme so that:
 * - When grid snap is OFF (`Free`), each theme keeps its signature aesthetic spacing.
 * - When grid snap is ON, visible dots/lines use a clean integer multiple of `stepSize`
 *   (avoiding dense Moiré dot clutter at 4px/8px while ensuring snapped positions align with the grid).
 */
export function computeHarmonizedBackgroundGap(
  theme: CanvasTheme,
  snapEnabled: boolean,
  stepSize: DragSnapSize
): number {
  const themeDefaultGap =
    theme === 'arcane' ? 22 : theme === 'parchment' ? 32 : theme === 'corkboard' ? 24 : 16
  if (!snapEnabled) return themeDefaultGap

  if (stepSize === 4) {
    return theme === 'parchment' ? 32 : theme === 'corkboard' ? 24 : 16
  }
  if (stepSize === 8) {
    return theme === 'parchment' ? 32 : theme === 'corkboard' || theme === 'arcane' ? 24 : 16
  }
  if (stepSize === 16) {
    return theme === 'parchment' ? 32 : 16
  }
  return stepSize
}
