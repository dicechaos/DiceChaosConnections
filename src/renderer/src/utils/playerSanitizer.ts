import {
  CameraBookmark,
  CampaignFileV2,
  CampaignSnapshot,
  CanvasTheme,
  ConnectionPreset,
  CustomEntityType,
  DndEdge,
  DndFields,
  DndNode,
  PlayerWindowStatePayload
} from '../types'
import {
  cleanEdgeForPersistence,
  cleanNodeForPersistence,
  sanitizeCustomPorts
} from './campaignSerializer'

/**
 * Strips DM-only mechanical/secret subfields from DndFields while keeping public flavor.
 */
function sanitizeDndFieldsForPlayers(fields?: DndFields): DndFields | undefined {
  if (!fields) return undefined
  const {
    voiceCue: _vc,
    alignment: _al,
    dangerTier: _dt,
    ac: _ac,
    hp: _hp,
    ...publicFields
  } = fields

  const hasAnyValue = Object.values(publicFields).some(
    (v) => v !== undefined && v !== '' && v !== false
  )
  return hasAnyValue ? publicFields : undefined
}

/**
 * Scrubs a single visible node so zero DM-only properties remain in memory or on disk.
 */
export function sanitizeNodeForPlayers(
  node: DndNode,
  visibleGroupIds?: ReadonlySet<string>
): DndNode {
  const cleaned = cleanNodeForPersistence(node)
  const {
    dmNotes: _dm,
    stats: _stats,
    isHidden: _hidden,
    dndFields,
    groupId,
    customPorts,
    ...publicData
  } = cleaned.data

  const isGroup = cleaned.type === 'groupRegion' || Boolean(publicData.isGroup)
  const safeFields = sanitizeDndFieldsForPlayers(dndFields)
  const safeGroupId =
    groupId && (!visibleGroupIds || visibleGroupIds.has(groupId)) ? groupId : undefined
  const safeCustomPorts = sanitizeCustomPorts(customPorts, isGroup, true)

  return {
    ...cleaned,
    selected: false,
    data: {
      ...publicData,
      ...(safeGroupId ? { groupId: safeGroupId } : {}),
      ...(safeFields ? { dndFields: safeFields } : {}),
      ...(safeCustomPorts ? { customPorts: safeCustomPorts } : {})
    }
  }
}

/**
 * Scrubs a single visible edge so zero DM-only properties remain in memory or on disk.
 */
export function sanitizeEdgeForPlayers(edge: DndEdge): DndEdge {
  const cleaned = cleanEdgeForPersistence(edge)
  const { dmNotes: _dm, isHidden: _hidden, ...publicData } = cleaned.data || {}

  return {
    ...cleaned,
    selected: false,
    data: publicData
  }
}

/**
 * Filters out hidden nodes and resolves fixed-point visibility for edges (including `proxy-<edgeId>` chains),
 * returning scrubbed player-safe nodes and edges.
 */
export function sanitizeGraphForPlayers(
  nodes: DndNode[],
  edges: DndEdge[]
): { nodes: DndNode[]; edges: DndEdge[] } {
  const visibleNodes = nodes.filter((n) => !n.data?.isHidden)
  const validIds = new Set<string>(visibleNodes.map((n) => n.id))
  const visibleGroupIds = new Set<string>(
    visibleNodes
      .filter((n) => n.type === 'groupRegion' || n.data?.isGroup)
      .map((n) => n.id)
  )

  const candidateEdges = edges.filter((e) => !e.data?.isHidden)
  const survivingEdges: DndEdge[] = []

  let added = true
  while (added) {
    added = false
    for (const edge of candidateEdges) {
      if (validIds.has(`proxy-${edge.id}`)) continue
      if (validIds.has(edge.source) && validIds.has(edge.target)) {
        survivingEdges.push(edge)
        validIds.add(`proxy-${edge.id}`)
        added = true
      }
    }
  }

  return {
    nodes: visibleNodes.map((n) => sanitizeNodeForPlayers(n, visibleGroupIds)),
    edges: survivingEdges.map(sanitizeEdgeForPlayers)
  }
}

export interface SanitizeStats {
  publicNodes: number
  strippedNodes: number
  publicEdges: number
  strippedEdges: number
  strippedSecretNotes: number
  publicSnapshots: number
  strippedSnapshots: number
}

export function computeSanitizeStats(input: {
  nodes: DndNode[]
  edges: DndEdge[]
  snapshots: CampaignSnapshot[]
}): SanitizeStats {
  const safeGraph = sanitizeGraphForPlayers(input.nodes, input.edges)
  let strippedSecretNotes = 0
  for (const n of input.nodes) {
    if (n.data?.dmNotes?.trim() || n.data?.dndFields?.voiceCue?.trim()) {
      strippedSecretNotes++
    }
  }
  for (const e of input.edges) {
    if (e.data?.dmNotes?.trim()) {
      strippedSecretNotes++
    }
  }

  const publicSnapshots = input.snapshots.filter((s) => s.playerVisible !== false).length

  return {
    publicNodes: safeGraph.nodes.length,
    strippedNodes: Math.max(0, input.nodes.length - safeGraph.nodes.length),
    publicEdges: safeGraph.edges.length,
    strippedEdges: Math.max(0, input.edges.length - safeGraph.edges.length),
    strippedSecretNotes,
    publicSnapshots,
    strippedSnapshots: Math.max(0, input.snapshots.length - publicSnapshots)
  }
}

/**
 * Produces a complete zero-leakage campaign payload safe for IPC to the 2nd-screen Player Window,
 * Spoiler-Free Player .json export, or Player Handout Dossier generation.
 */
export function sanitizeCampaignForPlayers(input: {
  campaignTitle: string
  canvasTheme: CanvasTheme
  nodes: DndNode[]
  edges: DndEdge[]
  connectionPresets: ConnectionPreset[]
  customEntityTypes: CustomEntityType[]
  snapshots: CampaignSnapshot[]
  cameraBookmarks?: CameraBookmark[]
}): PlayerWindowStatePayload {
  const safeLive = sanitizeGraphForPlayers(input.nodes, input.edges)

  const safeSnapshots: CampaignSnapshot[] = input.snapshots
    .filter((s) => s.playerVisible !== false)
    .map((s) => {
      const safeSnapGraph = sanitizeGraphForPlayers(s.nodes || [], s.edges || [])
      return {
        id: s.id,
        title: s.title,
        sessionNumber: s.sessionNumber,
        createdAt: s.createdAt,
        summary: s.summary || '',
        playerVisible: true,
        nodes: safeSnapGraph.nodes,
        edges: safeSnapGraph.edges
      }
    })

  const safeBookmarks = (input.cameraBookmarks || []).filter((b) => b.playerVisible !== false)

  return {
    campaignTitle: input.campaignTitle,
    canvasTheme: input.canvasTheme,
    nodes: safeLive.nodes,
    edges: safeLive.edges,
    connectionPresets: input.connectionPresets,
    customEntityTypes: input.customEntityTypes,
    snapshots: safeSnapshots,
    cameraBookmarks: safeBookmarks
  }
}

export function serializePlayerHandoutCampaign(input: {
  campaignTitle: string
  canvasTheme: CanvasTheme
  nodes: DndNode[]
  edges: DndEdge[]
  connectionPresets: ConnectionPreset[]
  customEntityTypes: CustomEntityType[]
  snapshots: CampaignSnapshot[]
  cameraBookmarks?: CameraBookmark[]
}): string {
  const safe = sanitizeCampaignForPlayers(input)
  const payload: CampaignFileV2 = {
    version: 2,
    edition: 'player',
    campaignTitle: safe.campaignTitle,
    canvasTheme: safe.canvasTheme,
    nodes: safe.nodes,
    edges: safe.edges,
    connectionPresets: safe.connectionPresets,
    customEntityTypes: safe.customEntityTypes,
    snapshots: safe.snapshots,
    ...(safe.cameraBookmarks && safe.cameraBookmarks.length > 0
      ? { cameraBookmarks: safe.cameraBookmarks }
      : {})
  }
  return JSON.stringify(payload, null, 2)
}

function normalizeKey(text?: string): string {
  return (text || '').trim().toLowerCase()
}

function mergeNoteStrings(existing?: string, incoming?: string): { text: string; changed: boolean } {
  const cur = (existing || '').trim()
  const inc = (incoming || '').trim()
  if (!inc) return { text: existing || '', changed: false }
  if (!cur) return { text: inc, changed: true }
  if (cur === inc || cur.includes(inc)) return { text: existing || cur, changed: false }
  if (inc.includes(cur)) return { text: inc, changed: true }
  return {
    text: `${cur}\n\n---\n${inc}`,
    changed: true
  }
}

export interface PartyNotesMergeResult {
  nodes: DndNode[]
  edges: DndEdge[]
  stats: {
    updatedEntityNotes: number
    updatedEdgeNotes: number
    addedTheoryNodes: number
    addedTheoryEdges: number
  }
}

/**
 * Merges `partyNotes` and `isPlayerCreated` theory nodes/edges from a player's .json file
 * into either an updated Player Handout map or the DM's master campaign map without touching DM secrets.
 */
export function mergePartyNotesIntoCampaign(
  current: { nodes: DndNode[]; edges: DndEdge[] },
  importedRaw: any
): PartyNotesMergeResult {
  const incomingNodes: DndNode[] = Array.isArray(importedRaw?.nodes)
    ? importedRaw.nodes.map((n: any) => cleanNodeForPersistence(n as DndNode))
    : []
  const incomingEdges: DndEdge[] = Array.isArray(importedRaw?.edges)
    ? importedRaw.edges.map((e: any) => cleanEdgeForPersistence(e as DndEdge))
    : []

  let updatedEntityNotes = 0
  let updatedEdgeNotes = 0
  let addedTheoryNodes = 0
  let addedTheoryEdges = 0

  const incomingNodeById = new Map<string, DndNode>()
  const incomingNodeByNameType = new Map<string, DndNode>()
  for (const incNode of incomingNodes) {
    incomingNodeById.set(incNode.id, incNode)
    const key = `${normalizeKey(incNode.data?.label)}::${normalizeKey(String(incNode.data?.entityType))}`
    if (normalizeKey(incNode.data?.label)) {
      incomingNodeByNameType.set(key, incNode)
    }
  }

  // Map old incoming theory node IDs -> resolved node IDs in merged map
  const idRemap = new Map<string, string>()

  const mergedNodes: DndNode[] = current.nodes.map((node) => {
    const byId = incomingNodeById.get(node.id)
    const fallbackKey = `${normalizeKey(node.data?.label)}::${normalizeKey(String(node.data?.entityType))}`
    const match = byId || incomingNodeByNameType.get(fallbackKey)
    if (!match) return node

    idRemap.set(match.id, node.id)
    const mergedNote = mergeNoteStrings(node.data?.partyNotes, match.data?.partyNotes)
    if (!mergedNote.changed) return node

    updatedEntityNotes++
    return {
      ...node,
      data: {
        ...node.data,
        partyNotes: mergedNote.text
      }
    }
  })

  const existingNodeIds = new Set(mergedNodes.map((n) => n.id))
  const existingNameTypes = new Set(
    mergedNodes.map(
      (n) => `${normalizeKey(n.data?.label)}::${normalizeKey(String(n.data?.entityType))}`
    )
  )

  // Import player-created theory pins that aren't already present
  for (const incNode of incomingNodes) {
    if (!incNode.data?.isPlayerCreated) continue
    const key = `${normalizeKey(incNode.data?.label)}::${normalizeKey(String(incNode.data?.entityType))}`
    if (existingNodeIds.has(incNode.id) || (normalizeKey(incNode.data?.label) && existingNameTypes.has(key))) {
      continue
    }

    const safeTheory = sanitizeNodeForPlayers({
      ...incNode,
      data: {
        ...incNode.data,
        isPlayerCreated: true,
        isHidden: false
      }
    })
    mergedNodes.push(safeTheory)
    existingNodeIds.add(safeTheory.id)
    idRemap.set(incNode.id, safeTheory.id)
    if (normalizeKey(safeTheory.data?.label)) {
      existingNameTypes.add(key)
    }
    addedTheoryNodes++
  }

  // Merge partyNotes onto existing edges
  const incomingEdgeById = new Map<string, DndEdge>()
  const incomingEdgeByEndpoints = new Map<string, DndEdge>()
  for (const incEdge of incomingEdges) {
    incomingEdgeById.set(incEdge.id, incEdge)
    const src = idRemap.get(incEdge.source) || incEdge.source
    const tgt = idRemap.get(incEdge.target) || incEdge.target
    incomingEdgeByEndpoints.set(`${src}->${tgt}::${normalizeKey(incEdge.data?.label)}`, incEdge)
  }

  const mergedEdges: DndEdge[] = current.edges.map((edge) => {
    const epKey = `${edge.source}->${edge.target}::${normalizeKey(edge.data?.label)}`
    const match = incomingEdgeById.get(edge.id) || incomingEdgeByEndpoints.get(epKey)
    if (!match) return edge

    const mergedNote = mergeNoteStrings(edge.data?.partyNotes, match.data?.partyNotes)
    if (!mergedNote.changed) return edge

    updatedEdgeNotes++
    return {
      ...edge,
      data: {
        ...edge.data,
        partyNotes: mergedNote.text
      }
    }
  })

  const existingEdgeIds = new Set(mergedEdges.map((e) => e.id))
  const existingEdgeKeys = new Set(
    mergedEdges.map((e) => `${e.source}->${e.target}::${normalizeKey(e.data?.label)}`)
  )

  const validEndpointIds = new Set<string>([
    ...mergedNodes.map((n) => n.id),
    ...mergedEdges.map((e) => `proxy-${e.id}`)
  ])

  for (const incEdge of incomingEdges) {
    if (!incEdge.data?.isPlayerCreated) continue
    const resolvedSource = idRemap.get(incEdge.source) || incEdge.source
    const resolvedTarget = idRemap.get(incEdge.target) || incEdge.target
    const epKey = `${resolvedSource}->${resolvedTarget}::${normalizeKey(incEdge.data?.label)}`

    if (existingEdgeIds.has(incEdge.id) || existingEdgeKeys.has(epKey)) continue
    if (!validEndpointIds.has(resolvedSource) || !validEndpointIds.has(resolvedTarget)) continue

    const safeTheoryEdge = sanitizeEdgeForPlayers({
      ...incEdge,
      source: resolvedSource,
      target: resolvedTarget,
      data: {
        ...incEdge.data,
        isPlayerCreated: true,
        isHidden: false
      }
    })
    mergedEdges.push(safeTheoryEdge)
    existingEdgeIds.add(safeTheoryEdge.id)
    existingEdgeKeys.add(epKey)
    validEndpointIds.add(`proxy-${safeTheoryEdge.id}`)
    addedTheoryEdges++
  }

  return {
    nodes: mergedNodes,
    edges: mergedEdges,
    stats: {
      updatedEntityNotes,
      updatedEdgeNotes,
      addedTheoryNodes,
      addedTheoryEdges
    }
  }
}
