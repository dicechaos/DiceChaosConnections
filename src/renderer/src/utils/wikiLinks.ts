import { CustomArchetype, CustomEntityType, DndEdge, DndNode } from '../types'

export function parseWikiToken(rawInner: string): { targetQuery: string; displayText: string } {
  const pipeIdx = rawInner.indexOf('|')
  if (pipeIdx === -1) {
    const trimmed = rawInner.trim()
    return { targetQuery: trimmed, displayText: trimmed }
  }
  const targetQuery = rawInner.slice(0, pipeIdx).trim()
  const displayText = rawInner.slice(pipeIdx + 1).trim() || targetQuery
  return { targetQuery, displayText }
}

/**
 * Resolves a `[[Target]]` or `[[Target|Display]]` token against node labels and `aliases`.
 * Strictly enforces `hideSecrets`: if the matched node is `isHidden` while `hideSecrets` is true,
 * returns `node: null` so zero spoiler links become clickable or leaked in Player View.
 */
export function resolveWikiTargetNode(
  rawInner: string,
  nodes: DndNode[],
  hideSecrets: boolean
): { node: DndNode | null; displayText: string; targetQuery: string } {
  const { targetQuery, displayText } = parseWikiToken(rawInner)
  const q = targetQuery.toLowerCase()
  if (!q) return { node: null, displayText, targetQuery }

  // 1. Exact case-insensitive label match first
  let matched = nodes.find((n) => (n.data?.label || '').trim().toLowerCase() === q)

  // 2. Fallback to exact case-insensitive alias match
  if (!matched) {
    matched = nodes.find((n) =>
      (n.data?.aliases || []).some((a) => a.trim().toLowerCase() === q)
    )
  }

  if (!matched) {
    return { node: null, displayText, targetQuery }
  }

  if (hideSecrets && matched.data?.isHidden) {
    return { node: null, displayText, targetQuery }
  }

  return { node: matched, displayText, targetQuery }
}

/**
 * Rewrites `[[OldName]]` -> `[[NewName]]` and `[[OldName|Custom]]` -> `[[NewName|Custom]]`
 * across any note string when an entity's canonical label is renamed.
 */
export function rewriteWikiLinksInText(
  text: string | undefined,
  oldLabel: string,
  newLabel: string
): string | undefined {
  if (!text) return text
  const oldNorm = oldLabel.trim().toLowerCase()
  const nextClean = newLabel.trim()
  if (!oldNorm || !nextClean || oldNorm === nextClean.toLowerCase()) return text

  return text.replace(/\[\[([^\]]+)\]\]/g, (full, inner: string) => {
    const pipeIdx = inner.indexOf('|')
    if (pipeIdx === -1) {
      if (inner.trim().toLowerCase() === oldNorm) {
        return `[[${nextClean}]]`
      }
      return full
    }
    const targetPart = inner.slice(0, pipeIdx).trim()
    const displayPart = inner.slice(pipeIdx + 1)
    if (targetPart.toLowerCase() === oldNorm) {
      return `[[${nextClean}|${displayPart}]]`
    }
    return full
  })
}

export function refactorGraphWikiLinks(
  nodes: DndNode[],
  edges: DndEdge[],
  oldLabel: string,
  newLabel: string
): { nodes: DndNode[]; edges: DndEdge[] } {
  const oldNorm = oldLabel.trim().toLowerCase()
  const nextClean = newLabel.trim()
  if (!oldNorm || !nextClean || oldNorm === nextClean.toLowerCase()) {
    return { nodes, edges }
  }

  const nextNodes = nodes.map((n) => {
    const pub = rewriteWikiLinksInText(n.data.publicNotes, oldLabel, nextClean)
    const party = rewriteWikiLinksInText(n.data.partyNotes, oldLabel, nextClean)
    const dm = rewriteWikiLinksInText(n.data.dmNotes, oldLabel, nextClean)
    const desc = rewriteWikiLinksInText(n.data.description, oldLabel, nextClean)
    if (
      pub === n.data.publicNotes &&
      party === n.data.partyNotes &&
      dm === n.data.dmNotes &&
      desc === n.data.description
    ) {
      return n
    }
    return {
      ...n,
      data: {
        ...n.data,
        ...(pub !== undefined ? { publicNotes: pub } : {}),
        ...(party !== undefined ? { partyNotes: party } : {}),
        ...(dm !== undefined ? { dmNotes: dm } : {}),
        ...(desc !== undefined ? { description: desc } : {})
      }
    }
  })

  const nextEdges = edges.map((e) => {
    if (!e.data) return e
    const pub = rewriteWikiLinksInText(e.data.publicNotes, oldLabel, nextClean)
    const party = rewriteWikiLinksInText(e.data.partyNotes, oldLabel, nextClean)
    const dm = rewriteWikiLinksInText(e.data.dmNotes, oldLabel, nextClean)
    if (
      pub === e.data.publicNotes &&
      party === e.data.partyNotes &&
      dm === e.data.dmNotes
    ) {
      return e
    }
    return {
      ...e,
      data: {
        ...e.data,
        ...(pub !== undefined ? { publicNotes: pub } : {}),
        ...(party !== undefined ? { partyNotes: party } : {}),
        ...(dm !== undefined ? { dmNotes: dm } : {})
      }
    }
  })

  return { nodes: nextNodes, edges: nextEdges }
}

export interface DirectConnectionItem {
  edgeId: string
  relationLabel: string
  color: string
  directionBadge: '→' | '←' | '↔' | '—'
  neighborNodeId?: string
  neighborLabel: string
  isHidden: boolean
}

export interface BacklinkItem {
  sourceType: 'node' | 'edge'
  id: string
  title: string
  subtitle?: string
  noteScope: 'Public Lore' | 'Party Note' | 'DM Secret'
  snippet: string
}

function buildSnippet(text: string, matchIndex: number, matchLen: number): string {
  const clean = text.replace(/\s+/g, ' ')
  const start = Math.max(0, matchIndex - 36)
  const end = Math.min(clean.length, matchIndex + matchLen + 44)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < clean.length ? '…' : ''
  return `${prefix}${clean.slice(start, end).trim()}${suffix}`
}

/**
 * Computes direct graph edges and incoming `[[Wiki-Link]]` backlinks for a given entity,
 * strictly respecting `hideSecrets` so zero DM-only relationships or notes ever appear in Player View.
 */
export function computeEntityConnectionsAndBacklinks(
  nodeId: string,
  nodes: DndNode[],
  edges: DndEdge[],
  hideSecrets: boolean
): {
  connections: DirectConnectionItem[]
  backlinks: BacklinkItem[]
} {
  const targetNode = nodes.find((n) => n.id === nodeId)
  if (!targetNode) return { connections: [], backlinks: [] }

  const visibleNodes = hideSecrets ? nodes.filter((n) => !n.data?.isHidden) : nodes
  const nodeById = new Map(visibleNodes.map((n) => [n.id, n]))
  const edgeById = new Map(edges.map((e) => [e.id, e]))

  const resolveEndpointLabel = (endpointId: string): { nodeId?: string; label: string } | null => {
    if (endpointId.startsWith('proxy-')) {
      const parentEdge = edgeById.get(endpointId.slice(6))
      if (!parentEdge) return null
      if (hideSecrets && parentEdge.data?.isHidden) return null
      const sNode = nodeById.get(parentEdge.source)
      const tNode = nodeById.get(parentEdge.target)
      if (hideSecrets && (!sNode || !tNode)) return null
      const pLabel = parentEdge.data?.label || 'Connection'
      return {
        nodeId: sNode?.id,
        label:
          sNode && tNode
            ? `${pLabel} (${sNode.data.label} → ${tNode.data.label})`
            : pLabel
      }
    }
    const n = nodeById.get(endpointId)
    if (!n) return null
    return { nodeId: n.id, label: n.data.label || 'Unnamed Entity' }
  }

  const connections: DirectConnectionItem[] = []

  for (const edge of edges) {
    if (hideSecrets && edge.data?.isHidden) continue
    const isSource = edge.source === nodeId
    const isTarget = edge.target === nodeId

    // Also include edges attached to a proxy whose parent edge touches nodeId? Keep direct first;
    // if an edge attaches FROM another node TO `proxy-<thisNodeEdge>`, that's on the parent edge.
    if (!isSource && !isTarget) continue

    const otherEndpointId = isSource ? edge.target : edge.source
    const resolvedOther = resolveEndpointLabel(otherEndpointId)
    if (!resolvedOther) continue

    const dir = edge.data?.direction || 'none'
    let directionBadge: '→' | '←' | '↔' | '—' = '—'
    if (dir === 'bidirectional') {
      directionBadge = '↔'
    } else if (dir === 'forward') {
      directionBadge = isSource ? '→' : '←'
    } else if (dir === 'reverse') {
      directionBadge = isSource ? '←' : '→'
    }

    connections.push({
      edgeId: edge.id,
      relationLabel: edge.data?.label || edge.data?.preset || 'Connected',
      color: edge.data?.color || '#94a3b8',
      directionBadge,
      neighborNodeId: resolvedOther.nodeId,
      neighborLabel: resolvedOther.label,
      isHidden: Boolean(edge.data?.isHidden)
    })
  }

  // Match names for backlinks: canonical label + all aliases of targetNode
  const matchNames = new Set<string>(
    [targetNode.data.label, ...(targetNode.data.aliases || [])]
      .map((s) => (s || '').trim().toLowerCase())
      .filter(Boolean)
  )

  const backlinks: BacklinkItem[] = []
  const scanField = (
    text: string | undefined,
    noteScope: BacklinkItem['noteScope'],
    meta: { sourceType: 'node' | 'edge'; id: string; title: string; subtitle?: string }
  ) => {
    if (!text || !text.trim()) return
    const regex = /\[\[([^\]]+)\]\]/g
    let match: RegExpExecArray | null
    while ((match = regex.exec(text)) !== null) {
      const { targetQuery } = parseWikiToken(match[1])
      if (matchNames.has(targetQuery.toLowerCase())) {
        backlinks.push({
          ...meta,
          noteScope,
          snippet: buildSnippet(text, match.index, match[0].length)
        })
        break // One clean entry per field per item
      }
    }
  }

  for (const n of visibleNodes) {
    if (n.id === nodeId) continue
    const meta = {
      sourceType: 'node' as const,
      id: n.id,
      title: n.data.label || 'Unnamed Entity',
      subtitle: String(n.data.entityType || 'Entity')
    }
    scanField(n.data.publicNotes ?? n.data.description, 'Public Lore', meta)
    scanField(n.data.partyNotes, 'Party Note', meta)
    if (!hideSecrets) {
      scanField(n.data.dmNotes, 'DM Secret', meta)
    }
  }

  for (const e of edges) {
    if (hideSecrets && e.data?.isHidden) continue
    const s = resolveEndpointLabel(e.source)
    const t = resolveEndpointLabel(e.target)
    if (!s || !t) continue
    const meta = {
      sourceType: 'edge' as const,
      id: e.id,
      title: e.data?.label || 'Connection',
      subtitle: `${s.label} → ${t.label}`
    }
    scanField(e.data?.publicNotes, 'Public Lore', meta)
    scanField(e.data?.partyNotes, 'Party Note', meta)
    if (!hideSecrets) {
      scanField(e.data?.dmNotes, 'DM Secret', meta)
    }
  }

  return { connections, backlinks }
}

/**
 * Resolves which D&D sheet field template ('character' | 'location' | 'item' | 'organization' | 'event')
 * applies to a built-in or custom entity category.
 */
export function resolveCategoryArchetype(
  entityType: string | undefined,
  customEntityTypes: CustomEntityType[]
): CustomArchetype {
  const t = entityType || 'NPC'
  if (t === 'PC' || t === 'NPC') return 'character'
  if (t === 'Location') return 'location'
  if (t === 'Item') return 'item'
  if (t === 'Organization') return 'organization'
  if (t === 'Event') return 'event'

  const custom = customEntityTypes.find((c) => c.label === t)
  if (custom?.archetype) return custom.archetype

  const lower = t.toLowerCase()
  if (
    lower.includes('army') ||
    lower.includes('host') ||
    lower.includes('faction') ||
    lower.includes('guild') ||
    lower.includes('cult') ||
    lower.includes('house')
  ) {
    return 'organization'
  }
  if (
    lower.includes('deity') ||
    lower.includes('patron') ||
    lower.includes('monster') ||
    lower.includes('villain') ||
    lower.includes('ally')
  ) {
    return 'character'
  }
  if (lower.includes('region') || lower.includes('realm') || lower.includes('dungeon')) {
    return 'location'
  }
  if (lower.includes('relic') || lower.includes('artifact') || lower.includes('spell')) {
    return 'item'
  }
  return 'event'
}
