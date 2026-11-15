import { ConnectionPreset, DndEdge, DndNode, EntityNodeData } from '../types'
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
