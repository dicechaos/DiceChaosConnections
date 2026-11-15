import {
  CameraBookmark,
  CampaignEdition,
  CampaignFileV2,
  CampaignSnapshot,
  CanvasTheme,
  ConnectionPreset,
  CustomEntityType,
  CustomPerimeterPort,
  DndEdge,
  DndNode,
  FieldDiffEntry,
  PerimeterAnchor
} from '../types'
import {
  clampPerimeterOffset,
  getBuiltinPortSpec,
  getDefaultPortStyleForId,
  isBuiltinPerimeterPortId,
  isBuiltinPortModified,
  sanitizeCustomPortShape,
  sanitizeCustomPortSize,
  sanitizeCustomPortVisibility,
  sanitizePerimeterSide
} from './graphPipeline'
import { normalizeHexColor } from './colorUtils'

export function sanitizeCustomPorts(
  raw: unknown,
  isGroup = false,
  hideSecrets = false
): CustomPerimeterPort[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined
  const seenIds = new Set<string>()
  const cleaned: CustomPerimeterPort[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const id = typeof (item as any).id === 'string' ? (item as any).id.trim() : ''
    if (!id || seenIds.has(id)) continue
    seenIds.add(id)

    const builtinSpec = getBuiltinPortSpec(id)
    const defaults = getDefaultPortStyleForId(id, isGroup)
    const side = sanitizePerimeterSide((item as any).side, builtinSpec?.side ?? 'right')
    const rawOffset = Number((item as any).offset)
    const offset = clampPerimeterOffset(
      Number.isFinite(rawOffset) ? rawOffset : (builtinSpec?.offset ?? 0.5)
    )
    const disabled = Boolean(builtinSpec && (item as any).disabled)

    if (!builtinSpec && Boolean((item as any).disabled)) {
      continue
    }

    const visibility = sanitizeCustomPortVisibility((item as any).visibility, defaults.visibility)
    const isPublic = visibility === 'public' && !disabled
    const label =
      (!hideSecrets || isPublic) &&
      typeof (item as any).label === 'string' &&
      (item as any).label.trim()
        ? (item as any).label.trim()
        : undefined
    const shape =
      !hideSecrets || isPublic
        ? sanitizeCustomPortShape((item as any).shape, defaults.shape)
        : defaults.shape
    const color =
      !hideSecrets || isPublic ? normalizeHexColor((item as any).color) : undefined
    const size =
      !hideSecrets || isPublic
        ? sanitizeCustomPortSize((item as any).size, defaults.size)
        : defaults.size
    const effectiveVisibility = !hideSecrets || isPublic ? visibility : defaults.visibility
    const showLabel = Boolean((!hideSecrets || isPublic) && (item as any).showLabel)

    const entry: CustomPerimeterPort = {
      id,
      side,
      offset,
      ...(label ? { label } : {}),
      ...(shape !== defaults.shape ? { shape } : {}),
      ...(color ? { color } : {}),
      ...(size !== defaults.size ? { size } : {}),
      ...(effectiveVisibility !== defaults.visibility ? { visibility: effectiveVisibility } : {}),
      ...(showLabel ? { showLabel: true } : {}),
      ...(disabled ? { disabled: true } : {})
    }

    if (isBuiltinPerimeterPortId(id) && !isBuiltinPortModified(entry, isGroup)) {
      continue
    }

    cleaned.push(entry)
  }
  return cleaned.length > 0 ? cleaned : undefined
}

function sanitizePerimeterAnchor(
  raw: unknown,
  fallbackSide: 'top' | 'right' | 'bottom' | 'left'
): PerimeterAnchor | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  if (typeof (raw as any).side !== 'string' || typeof (raw as any).offset !== 'number') {
    return undefined
  }
  return {
    side: sanitizePerimeterSide((raw as any).side, fallbackSide),
    offset: clampPerimeterOffset((raw as any).offset)
  }
}

export function cleanNodeForPersistence(node: DndNode): DndNode {
  const {
    isSearchFaded: _sf,
    isDegreeFaded: _df,
    isSpotlighted: _sp,
    diffStatus: _ds,
    description,
    publicNotes,
    ...restData
  } = node.data || { label: 'Entity', entityType: 'NPC' }

  const resolvedPublic = publicNotes !== undefined ? publicNotes : description || ''
  const isGroupNode = node.type === 'groupRegion' || Boolean(restData.isGroup)
  const sanitizedEntityWidth =
    !isGroupNode && typeof restData.entityWidth === 'number' && Number.isFinite(restData.entityWidth) && restData.entityWidth > 0
      ? Math.round(restData.entityWidth)
      : undefined
  const sanitizedEntityHeight =
    !isGroupNode && typeof restData.entityHeight === 'number' && Number.isFinite(restData.entityHeight) && restData.entityHeight > 0
      ? Math.round(restData.entityHeight)
      : undefined
  const sanitizedCustomPorts = sanitizeCustomPorts(restData.customPorts, isGroupNode, false)
  const {
    entityWidth: _ew,
    entityHeight: _eh,
    customPorts: _cp,
    ...cleanRestData
  } = restData

  return {
    id: node.id,
    type: isGroupNode ? 'groupRegion' : 'entity',
    position: {
      x: Math.round(node.position.x * 100) / 100,
      y: Math.round(node.position.y * 100) / 100
    },
    data: {
      ...cleanRestData,
      ...(sanitizedEntityWidth !== undefined ? { entityWidth: sanitizedEntityWidth } : {}),
      ...(sanitizedEntityHeight !== undefined ? { entityHeight: sanitizedEntityHeight } : {}),
      ...(sanitizedCustomPorts ? { customPorts: sanitizedCustomPorts } : {}),
      ...(isGroupNode ? { isGroup: true, entityType: cleanRestData.entityType || 'Group' } : {}),
      publicNotes: resolvedPublic
    }
  }
}

export function cleanEdgeForPersistence(edge: DndEdge): DndEdge {
  const {
    isSearchFaded: _sf,
    isDegreeFaded: _df,
    isSpotlighted: _sp,
    diffStatus: _ds,
    sourceAnchor: rawSourceAnchor,
    targetAnchor: rawTargetAnchor,
    ...restData
  } = edge.data || {}

  const sanitizedSourceAnchor = sanitizePerimeterAnchor(rawSourceAnchor, 'right')
  const sanitizedTargetAnchor = sanitizePerimeterAnchor(rawTargetAnchor, 'left')

  return {
    id: edge.id,
    type: 'dndEdge',
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle ?? null,
    targetHandle: edge.targetHandle ?? null,
    data: {
      ...restData,
      ...(sanitizedSourceAnchor ? { sourceAnchor: sanitizedSourceAnchor } : {}),
      ...(sanitizedTargetAnchor ? { targetAnchor: sanitizedTargetAnchor } : {})
    }
  }
}

export function serializeCampaign(params: {
  edition?: CampaignEdition
  campaignTitle: string
  canvasTheme: CanvasTheme
  nodes: DndNode[]
  edges: DndEdge[]
  connectionPresets: ConnectionPreset[]
  customEntityTypes: CustomEntityType[]
  snapshots: CampaignSnapshot[]
  cameraBookmarks?: CameraBookmark[]
}): string {
  const payload: CampaignFileV2 = {
    version: 2,
    ...(params.edition === 'player' ? { edition: 'player' } : {}),
    campaignTitle: params.campaignTitle,
    canvasTheme: params.canvasTheme,
    nodes: params.nodes.map(cleanNodeForPersistence),
    edges: params.edges.map(cleanEdgeForPersistence),
    connectionPresets: params.connectionPresets,
    customEntityTypes: params.customEntityTypes,
    snapshots: params.snapshots.map((s) => ({
      ...s,
      nodes: s.nodes.map(cleanNodeForPersistence),
      edges: s.edges.map(cleanEdgeForPersistence)
    })),
    ...(params.cameraBookmarks && params.cameraBookmarks.length > 0
      ? { cameraBookmarks: params.cameraBookmarks }
      : {})
  }
  return JSON.stringify(payload, null, 2)
}

export function migrateLoadedCampaign(raw: any): {
  edition: CampaignEdition
  campaignTitle: string
  canvasTheme: CanvasTheme
  nodes: DndNode[]
  edges: DndEdge[]
  connectionPresets: ConnectionPreset[]
  customEntityTypes: CustomEntityType[]
  snapshots: CampaignSnapshot[]
  cameraBookmarks: CameraBookmark[]
} {
  const edition: CampaignEdition = raw?.edition === 'player' ? 'player' : 'dm'
  const validThemes: CanvasTheme[] = ['modern', 'arcane', 'parchment', 'corkboard']
  const canvasTheme: CanvasTheme = validThemes.includes(raw?.canvasTheme)
    ? raw.canvasTheme
    : 'modern'

  const nodes: DndNode[] = Array.isArray(raw?.nodes)
    ? raw.nodes.map((n: any) => cleanNodeForPersistence(n as DndNode))
    : []

  const edges: DndEdge[] = Array.isArray(raw?.edges)
    ? raw.edges.map((e: any) => cleanEdgeForPersistence(e as DndEdge))
    : []

  const defaultPresets: ConnectionPreset[] = [
    { label: 'Allied', color: '#10b981', lineStyle: 'solid', thickness: 2, direction: 'none' },
    { label: 'Commands', color: '#ef4444', lineStyle: 'solid', thickness: 3, direction: 'forward' },
    {
      label: 'Enemies',
      color: '#ef4444',
      lineStyle: 'dashed',
      thickness: 2,
      direction: 'bidirectional'
    },
    { label: 'Secret', color: '#8b5cf6', lineStyle: 'dashed', thickness: 2, direction: 'none' },
    { label: 'Seeking', color: '#3b82f6', lineStyle: 'solid', thickness: 2, direction: 'forward' },
    {
      label: 'Clue / Trail',
      color: '#eab308',
      lineStyle: 'dotted',
      thickness: 2,
      direction: 'forward'
    },
    { label: 'Neutral', color: '#94a3b8', lineStyle: 'solid', thickness: 2, direction: 'none' }
  ]

  const connectionPresets: ConnectionPreset[] = Array.isArray(raw?.connectionPresets)
    ? raw.connectionPresets
    : defaultPresets

  const customEntityTypes: CustomEntityType[] = Array.isArray(raw?.customEntityTypes)
    ? raw.customEntityTypes
    : []

  const snapshots: CampaignSnapshot[] = Array.isArray(raw?.snapshots)
    ? raw.snapshots.map((s: any) => ({
        id: s.id || crypto.randomUUID(),
        title: s.title || 'Snapshot',
        sessionNumber: typeof s.sessionNumber === 'number' ? s.sessionNumber : undefined,
        createdAt: s.createdAt || new Date().toISOString(),
        summary: s.summary || '',
        playerVisible: s.playerVisible !== false,
        nodes: Array.isArray(s.nodes) ? s.nodes.map((n: any) => cleanNodeForPersistence(n)) : [],
        edges: Array.isArray(s.edges) ? s.edges.map((e: any) => cleanEdgeForPersistence(e)) : []
      }))
    : []

  const cameraBookmarks: CameraBookmark[] = Array.isArray(raw?.cameraBookmarks)
    ? raw.cameraBookmarks
        .filter(
          (b: any) =>
            b &&
            typeof b.label === 'string' &&
            typeof b.centerX === 'number' &&
            typeof b.centerY === 'number' &&
            typeof b.zoom === 'number'
        )
        .map((b: any) => ({
          id: b.id || crypto.randomUUID(),
          label: b.label,
          centerX: b.centerX,
          centerY: b.centerY,
          zoom: b.zoom,
          playerVisible: b.playerVisible !== false
        }))
    : []

  return {
    edition,
    campaignTitle:
      typeof raw?.campaignTitle === 'string' ? raw.campaignTitle : 'Imported Campaign',
    canvasTheme,
    nodes,
    edges,
    connectionPresets,
    customEntityTypes,
    snapshots,
    cameraBookmarks
  }
}

function summarizeNoteValue(val?: string): string {
  const clean = (val || '').trim()
  if (!clean) return 'Empty'
  return clean.length > 64 ? `${clean.slice(0, 61)}…` : clean
}

/**
 * Computes human-readable field-level differences between an earlier checkpoint node (`before`)
 * and a later/live node (`after`). Scrubs DM-only fields when `hideSecrets` is true.
 */
export function computeNodeDiffFields(
  before: DndNode | undefined,
  after: DndNode | undefined,
  hideSecrets = false
): FieldDiffEntry[] {
  if (!before || !after) return []
  const b = before.data || ({} as any)
  const a = after.data || ({} as any)
  const bf = b.dndFields || {}
  const af = a.dndFields || {}
  const entries: FieldDiffEntry[] = []

  const pushScalar = (field: string, v1?: string, v2?: string, isDmOnly = false) => {
    if (hideSecrets && isDmOnly) return
    const s1 = (v1 || '').trim()
    const s2 = (v2 || '').trim()
    if (s1 !== s2) {
      entries.push({
        field,
        before: s1 || 'None',
        after: s2 || 'None',
        isDmOnly
      })
    }
  }

  pushScalar('Name', b.label, a.label)
  if (b.isGroup || a.isGroup) {
    pushScalar('Subtitle', b.groupSubtitle, a.groupSubtitle)
    pushScalar(
      'Group Backdrop',
      b.hasBackground ? `Shown (${b.groupCustomColor || b.groupColor || 'gold'})` : 'Outline Only',
      a.hasBackground ? `Shown (${a.groupCustomColor || a.groupColor || 'gold'})` : 'Outline Only'
    )
    pushScalar('Group Icon', b.groupIcon || 'Default', a.groupIcon || 'Default')
    pushScalar('Group Shape', b.groupShape || 'rounded', a.groupShape || 'rounded')
    pushScalar('Header Align', b.groupHeaderAlign || 'left', a.groupHeaderAlign || 'left')
  } else {
    pushScalar('Category', String(b.entityType || ''), String(a.entityType || ''))
    pushScalar('Card Color', b.bgColor || 'Default', a.bgColor || 'Default')
    const formatCardSize = (d: any): string => {
      const hasW = typeof d.entityWidth === 'number' && Number.isFinite(d.entityWidth)
      const hasH = typeof d.entityHeight === 'number' && Number.isFinite(d.entityHeight)
      if (!hasW && !hasH) return 'Auto'
      if (hasW && hasH) return `${Math.round(d.entityWidth)}×${Math.round(d.entityHeight)}px`
      if (hasW) return `${Math.round(d.entityWidth)}×Auto px`
      return `Auto×${Math.round(d.entityHeight)}px`
    }
    pushScalar('Card Size', formatCardSize(b), formatCardSize(a))
  }
  pushScalar('Standing', bf.disposition, af.disposition)
  pushScalar('Quest Status', bf.questStatus, af.questStatus)
  pushScalar('Rarity', bf.rarity, af.rarity)
  pushScalar('Holder', bf.holder, af.holder)
  pushScalar('Faction', bf.faction, af.faction)
  pushScalar('Region', bf.region, af.region)
  pushScalar('Influence', bf.influence, af.influence)
  pushScalar('HQ', bf.headquarters, af.headquarters)
  pushScalar('Objective', bf.goal, af.goal)

  const bAliases = [...(b.aliases || [])].join(', ')
  const aAliases = [...(a.aliases || [])].join(', ')
  if (bAliases !== aAliases) {
    entries.push({
      field: 'Aliases',
      before: bAliases || 'None',
      after: aAliases || 'None'
    })
  }

  const bTags = [...(b.tags || [])].join(', ')
  const aTags = [...(a.tags || [])].join(', ')
  if (bTags !== aTags) {
    entries.push({
      field: 'Tags',
      before: bTags || 'None',
      after: aTags || 'None'
    })
  }

  const bIcons = [...(b.statusIcons || [])].sort().join(', ')
  const aIcons = [...(a.statusIcons || [])].sort().join(', ')
  if (bIcons !== aIcons) {
    entries.push({
      field: 'Status Markers',
      before: bIcons || 'None',
      after: aIcons || 'None'
    })
  }

  const bPub = (b.publicNotes ?? b.description ?? '').trim()
  const aPub = (a.publicNotes ?? a.description ?? '').trim()
  if (bPub !== aPub) {
    entries.push({
      field: 'Public Lore',
      before: summarizeNoteValue(bPub),
      after: summarizeNoteValue(aPub)
    })
  }

  const bParty = (b.partyNotes || '').trim()
  const aParty = (a.partyNotes || '').trim()
  if (bParty !== aParty) {
    entries.push({
      field: 'Party Notes',
      before: summarizeNoteValue(bParty),
      after: summarizeNoteValue(aParty)
    })
  }

  if (!hideSecrets) {
    pushScalar('Quick Stats', b.stats, a.stats, true)
    pushScalar('Danger Tier', bf.dangerTier, af.dangerTier, true)
    pushScalar('Visibility', b.isHidden ? 'Hidden' : 'Public', a.isHidden ? 'Hidden' : 'Public', true)
    const bDm = (b.dmNotes || '').trim()
    const aDm = (a.dmNotes || '').trim()
    if (bDm !== aDm) {
      entries.push({
        field: 'DM Secrets',
        before: summarizeNoteValue(bDm),
        after: summarizeNoteValue(aDm),
        isDmOnly: true
      })
    }
  }

  return entries
}

export function computeEdgeDiffFields(
  before: DndEdge | undefined,
  after: DndEdge | undefined,
  hideSecrets = false
): FieldDiffEntry[] {
  if (!before || !after) return []
  const b = before.data || {}
  const a = after.data || {}
  const entries: FieldDiffEntry[] = []

  if ((b.label || '') !== (a.label || '')) {
    entries.push({
      field: 'Relationship',
      before: b.label || 'Unlabeled',
      after: a.label || 'Unlabeled'
    })
  }
  if ((b.direction || 'none') !== (a.direction || 'none')) {
    entries.push({
      field: 'Direction',
      before: b.direction || 'none',
      after: a.direction || 'none'
    })
  }
  if ((b.lineStyle || 'solid') !== (a.lineStyle || 'solid') || (b.color || '') !== (a.color || '')) {
    entries.push({
      field: 'Style',
      before: `${b.lineStyle || 'solid'}`,
      after: `${a.lineStyle || 'solid'}`
    })
  }
  if ((b.publicNotes || '').trim() !== (a.publicNotes || '').trim()) {
    entries.push({
      field: 'Known Details',
      before: summarizeNoteValue(b.publicNotes),
      after: summarizeNoteValue(a.publicNotes)
    })
  }
  if ((b.partyNotes || '').trim() !== (a.partyNotes || '').trim()) {
    entries.push({
      field: 'Party Notes',
      before: summarizeNoteValue(b.partyNotes),
      after: summarizeNoteValue(a.partyNotes)
    })
  }
  if (!hideSecrets) {
    if (Boolean(b.isHidden) !== Boolean(a.isHidden)) {
      entries.push({
        field: 'Visibility',
        before: b.isHidden ? 'Hidden' : 'Public',
        after: a.isHidden ? 'Hidden' : 'Public',
        isDmOnly: true
      })
    }
    if ((b.dmNotes || '').trim() !== (a.dmNotes || '').trim()) {
      entries.push({
        field: 'DM Secrets',
        before: summarizeNoteValue(b.dmNotes),
        after: summarizeNoteValue(a.dmNotes),
        isDmOnly: true
      })
    }
  }
  return entries
}

function nodeSignature(n: DndNode, hideSecrets: boolean): string {
  const d = n.data || ({} as any)
  return JSON.stringify({
    label: d.label || '',
    entityType: d.entityType || '',
    bgColor: d.bgColor || '',
    entityWidth: typeof d.entityWidth === 'number' ? Math.round(d.entityWidth) : null,
    entityHeight: typeof d.entityHeight === 'number' ? Math.round(d.entityHeight) : null,
    hasBackground: !!d.hasBackground,
    groupColor: d.groupColor || '',
    groupCustomColor: d.groupCustomColor || '',
    groupSubtitle: d.groupSubtitle || '',
    groupIcon: d.groupIcon || '',
    groupShape: d.groupShape || '',
    groupHeaderAlign: d.groupHeaderAlign || '',
    groupPortraitMode: d.groupPortraitMode || '',
    portrait: d.portrait ? 'has-portrait' : '',
    publicNotes: d.publicNotes ?? d.description ?? '',
    partyNotes: d.partyNotes || '',
    statusIcons: [...(d.statusIcons || [])].sort(),
    disposition: d.dndFields?.disposition || '',
    questStatus: d.dndFields?.questStatus || '',
    rarity: d.dndFields?.rarity || '',
    holder: d.dndFields?.holder || '',
    faction: d.dndFields?.faction || '',
    region: d.dndFields?.region || '',
    influence: d.dndFields?.influence || '',
    headquarters: d.dndFields?.headquarters || '',
    goal: d.dndFields?.goal || '',
    aliases: [...(d.aliases || [])],
    tags: [...(d.tags || [])],
    customPorts: sanitizeCustomPorts(d.customPorts, Boolean(d.isGroup), hideSecrets) || [],
    ...(hideSecrets
      ? {}
      : {
          stats: d.stats || '',
          dangerTier: d.dndFields?.dangerTier || '',
          dmNotes: d.dmNotes || '',
          isHidden: !!d.isHidden
        })
  })
}

function edgeSignature(e: DndEdge, hideSecrets: boolean): string {
  const d = e.data || {}
  return JSON.stringify({
    source: e.source,
    target: e.target,
    sourceCustomPort: e.sourceHandle?.startsWith('cp-') ? e.sourceHandle : null,
    targetCustomPort: e.targetHandle?.startsWith('cp-') ? e.targetHandle : null,
    sourceAnchor: sanitizePerimeterAnchor(d.sourceAnchor, 'right') || null,
    targetAnchor: sanitizePerimeterAnchor(d.targetAnchor, 'left') || null,
    label: d.label || '',
    color: d.color || '',
    lineStyle: d.lineStyle || 'solid',
    direction: d.direction || 'none',
    publicNotes: d.publicNotes || '',
    partyNotes: d.partyNotes || '',
    ...(hideSecrets ? {} : { isHidden: !!d.isHidden, dmNotes: d.dmNotes || '' })
  })
}

/**
 * Computes a visual diff showing how `targetNodes`/`targetEdges` (Live Map or another checkpoint)
 * evolved since `snapshot`. When `hideSecrets` is true, ignores DM-only fields & hidden items!
 */
export function computeSnapshotDiff(
  snapshot: CampaignSnapshot,
  liveNodes: DndNode[],
  liveEdges: DndEdge[],
  hideSecrets = false
): {
  nodes: DndNode[]
  edges: DndEdge[]
  stats: { added: number; modified: number; removed: number }
} {
  const baseSnapNodes = hideSecrets
    ? snapshot.nodes.filter((n) => !n.data?.isHidden)
    : snapshot.nodes
  const baseLiveNodes = hideSecrets ? liveNodes.filter((n) => !n.data?.isHidden) : liveNodes

  const snapNodeMap = new Map(baseSnapNodes.map((n) => [n.id, n]))
  const liveNodeMap = new Map(baseLiveNodes.map((n) => [n.id, n]))

  let added = 0
  let modified = 0
  let removed = 0

  const resultNodes: DndNode[] = baseLiveNodes.map((liveNode) => {
    const snapNode = snapNodeMap.get(liveNode.id)
    if (!snapNode) {
      added++
      return { ...liveNode, data: { ...liveNode.data, diffStatus: 'added' } }
    }
    if (nodeSignature(snapNode, hideSecrets) !== nodeSignature(liveNode, hideSecrets)) {
      modified++
      return { ...liveNode, data: { ...liveNode.data, diffStatus: 'modified' } }
    }
    return { ...liveNode, data: { ...liveNode.data, diffStatus: null } }
  })

  baseSnapNodes.forEach((snapNode) => {
    if (!liveNodeMap.has(snapNode.id)) {
      removed++
      resultNodes.push({
        ...snapNode,
        selected: false,
        data: { ...snapNode.data, diffStatus: 'removed' }
      })
    }
  })

  const baseSnapEdges = hideSecrets
    ? snapshot.edges.filter((e) => !e.data?.isHidden)
    : snapshot.edges
  const baseLiveEdges = hideSecrets ? liveEdges.filter((e) => !e.data?.isHidden) : liveEdges

  const snapEdgeMap = new Map(baseSnapEdges.map((e) => [e.id, e]))
  const liveEdgeMap = new Map(baseLiveEdges.map((e) => [e.id, e]))

  const resultEdges: DndEdge[] = baseLiveEdges.map((liveEdge) => {
    const snapEdge = snapEdgeMap.get(liveEdge.id)
    if (!snapEdge) {
      return { ...liveEdge, data: { ...liveEdge.data, diffStatus: 'added' } }
    }
    if (edgeSignature(snapEdge, hideSecrets) !== edgeSignature(liveEdge, hideSecrets)) {
      return { ...liveEdge, data: { ...liveEdge.data, diffStatus: 'modified' } }
    }
    return { ...liveEdge, data: { ...liveEdge.data, diffStatus: null } }
  })

  baseSnapEdges.forEach((snapEdge) => {
    if (!liveEdgeMap.has(snapEdge.id)) {
      resultEdges.push({
        ...snapEdge,
        selected: false,
        data: { ...snapEdge.data, diffStatus: 'removed' }
      })
    }
  })

  return { nodes: resultNodes, edges: resultEdges, stats: { added, modified, removed } }
}

export interface PersistentCampaignSlice {
  campaignEdition: CampaignEdition
  campaignTitle: string
  canvasTheme: CanvasTheme
  nodes: DndNode[]
  edges: DndEdge[]
  connectionPresets: ConnectionPreset[]
  customEntityTypes: CustomEntityType[]
  snapshots: CampaignSnapshot[]
  cameraBookmarks: CameraBookmark[]
}

export function capturePersistentCampaignSlice(state: PersistentCampaignSlice): PersistentCampaignSlice {
  return {
    campaignEdition: state.campaignEdition,
    campaignTitle: state.campaignTitle,
    canvasTheme: state.canvasTheme,
    nodes: state.nodes,
    edges: state.edges,
    connectionPresets: state.connectionPresets,
    customEntityTypes: state.customEntityTypes,
    snapshots: state.snapshots,
    cameraBookmarks: state.cameraBookmarks
  }
}

function isSameNodePersistence(a: DndNode, b: DndNode): boolean {
  if (a === b) return true
  if (a.id !== b.id) return false
  const isGroupA = a.type === 'groupRegion' || Boolean(a.data?.isGroup)
  const isGroupB = b.type === 'groupRegion' || Boolean(b.data?.isGroup)
  if (isGroupA !== isGroupB) return false
  if (
    Math.round(a.position.x * 100) !== Math.round(b.position.x * 100) ||
    Math.round(a.position.y * 100) !== Math.round(b.position.y * 100)
  ) {
    return false
  }
  if (a.data === b.data) return true
  return JSON.stringify(cleanNodeForPersistence(a)) === JSON.stringify(cleanNodeForPersistence(b))
}

function isSameEdgePersistence(a: DndEdge, b: DndEdge): boolean {
  if (a === b) return true
  if (
    a.id !== b.id ||
    a.source !== b.source ||
    a.target !== b.target ||
    (a.sourceHandle ?? null) !== (b.sourceHandle ?? null) ||
    (a.targetHandle ?? null) !== (b.targetHandle ?? null)
  ) {
    return false
  }
  if (a.data === b.data) return true
  return JSON.stringify(cleanEdgeForPersistence(a)) === JSON.stringify(cleanEdgeForPersistence(b))
}

/**
 * Fast persistent-data comparator that ignores transient React Flow UI mutations
 * (`selected`, `measured`, `dragging`, `resizing`, `zIndex`, search/degree/spotlight/diff flags)
 * while catching every persisted campaign modification (including layer order and Undo reverts).
 */
export function hasPersistentCampaignDiff(
  prev: PersistentCampaignSlice | null | undefined,
  next: PersistentCampaignSlice
): boolean {
  if (!prev) return false
  if (
    prev.campaignEdition !== next.campaignEdition ||
    prev.campaignTitle !== next.campaignTitle ||
    prev.canvasTheme !== next.canvasTheme
  ) {
    return true
  }

  if (prev.nodes !== next.nodes) {
    if (prev.nodes.length !== next.nodes.length) return true
    for (let i = 0; i < prev.nodes.length; i++) {
      if (!isSameNodePersistence(prev.nodes[i], next.nodes[i])) return true
    }
  }

  if (prev.edges !== next.edges) {
    if (prev.edges.length !== next.edges.length) return true
    for (let i = 0; i < prev.edges.length; i++) {
      if (!isSameEdgePersistence(prev.edges[i], next.edges[i])) return true
    }
  }

  if (
    prev.connectionPresets !== next.connectionPresets &&
    JSON.stringify(prev.connectionPresets) !== JSON.stringify(next.connectionPresets)
  ) {
    return true
  }

  if (
    prev.customEntityTypes !== next.customEntityTypes &&
    JSON.stringify(prev.customEntityTypes) !== JSON.stringify(next.customEntityTypes)
  ) {
    return true
  }

  if (
    prev.cameraBookmarks !== next.cameraBookmarks &&
    JSON.stringify(prev.cameraBookmarks) !== JSON.stringify(next.cameraBookmarks)
  ) {
    return true
  }

  if (prev.snapshots !== next.snapshots) {
    if (prev.snapshots.length !== next.snapshots.length) return true
    const cleanPrevSnaps = prev.snapshots.map((s) => ({
      ...s,
      nodes: s.nodes.map(cleanNodeForPersistence),
      edges: s.edges.map(cleanEdgeForPersistence)
    }))
    const cleanNextSnaps = next.snapshots.map((s) => ({
      ...s,
      nodes: s.nodes.map(cleanNodeForPersistence),
      edges: s.edges.map(cleanEdgeForPersistence)
    }))
    if (JSON.stringify(cleanPrevSnaps) !== JSON.stringify(cleanNextSnaps)) return true
  }

  return false
}
