import { create } from 'zustand'
import {
  Connection,
  EdgeChange,
  NodeChange,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  reconnectEdge,
  Edge
} from '@xyflow/react'
import {
  CameraBookmark,
  CampaignEdition,
  CampaignSnapshot,
  CanvasTheme,
  ConnectionPreset,
  CustomEntityType,
  DndEdge,
  DndEdgeData,
  DndNode,
  EntityNodeData,
  GroupTintKey
} from '../types'
import {
  cleanEdgeForPersistence,
  cleanNodeForPersistence,
  migrateLoadedCampaign
} from '../utils/campaignSerializer'
import { mergePartyNotesIntoCampaign, PartyNotesMergeResult } from '../utils/playerSanitizer'
import { OTHER_EDGE_FILTER_KEY } from '../utils/edgeFilters'
import {
  computeGroupBoundsForMembers,
  insertWaypointInNearestSegment,
  isNodeEffectivelyLocked,
  LayerReorderDirection,
  reorderNodesByTier,
  resolveEdgeEndpointCenter,
  resolveEntityExplicitSize,
  resolveNodeSize,
  tidySelectedNodesGrid
} from '../utils/graphPipeline'
import { refactorGraphWikiLinks } from '../utils/wikiLinks'
import { normalizeHexColor } from '../utils/colorUtils'
import {
  STARTER_CAMERA_BOOKMARKS,
  STARTER_CAMPAIGN_TITLE,
  STARTER_CANVAS_THEME,
  STARTER_CONNECTION_PRESETS,
  STARTER_CUSTOM_ENTITY_TYPES,
  STARTER_EDGES,
  STARTER_NODES,
  STARTER_SNAPSHOTS
} from './starterMap'

export type { ConnectionPreset }

let lastHistoryPushAt = 0
const activeEntityResizeIds = new Set<string>()

export function setEntityResizing(nodeId: string, active: boolean): void {
  if (active) activeEntityResizeIds.add(nodeId)
  else activeEntityResizeIds.delete(nodeId)
}

interface HistoryEntry {
  nodes: DndNode[]
  edges: DndEdge[]
}

interface AppState {
  // History
  past: HistoryEntry[]
  future: HistoryEntry[]
  pushHistory: (force?: boolean) => void
  clearHistory: () => void
  undo: () => void
  redo: () => void

  // Campaign Metadata & Canvas Theme
  campaignEdition: CampaignEdition
  campaignTitle: string
  setCampaignTitle: (title: string) => void
  canvasTheme: CanvasTheme
  setCanvasTheme: (theme: CanvasTheme) => void

  // Graph State
  nodes: DndNode[]
  edges: DndEdge[]
  onNodesChange: (changes: NodeChange<DndNode>[]) => void
  onEdgesChange: (changes: EdgeChange<DndEdge>[]) => void
  onConnect: (connection: Connection) => void
  onReconnect: (oldEdge: Edge, newConnection: Connection) => void
  addNode: (node: DndNode) => void
  addConnectedNode: (
    node: DndNode,
    connection: { source: string; sourceHandle?: string | null; isFromTargetHandle?: boolean }
  ) => void
  deleteNode: (id: string) => void
  updateNodeData: (nodeId: string, data: Partial<EntityNodeData>, recordHistory?: boolean) => void
  renameEntityLabel: (
    nodeId: string,
    nextLabel: string,
    options?: { fromLabel?: string; recordHistory?: boolean }
  ) => void
  batchUpdateNodes: (nodeIds: string[], updater: (node: DndNode) => DndNode) => void
  batchDeleteNodes: (nodeIds: string[]) => void
  setNodes: (nodes: DndNode[]) => void

  // Group Regions & Locking
  createGroupFromSelection: (options?: {
    lock?: boolean
    withBackground?: boolean
    color?: GroupTintKey
    customColor?: string
    label?: string
    nodeIds?: string[]
  }) => string | null
  ungroupNodes: (groupId: string) => void
  deleteGroupWithContents: (groupId: string) => void
  fitGroupToMembers: (groupId: string) => void
  tidyGroupMembers: (groupId: string) => void
  selectGroupMembers: (groupId: string) => void
  toggleNodeLock: (nodeIds: string[], forceLocked?: boolean) => void
  reorderNodes: (nodeIds: string[], direction: LayerReorderDirection) => void
  resizeEntityNode: (
    nodeId: string,
    patch: {
      width?: number | null
      height?: number | null
      position?: { x: number; y: number }
    },
    recordHistory?: boolean
  ) => void
  resetEntitySize: (nodeIds: string[]) => void
  matchSelectedEntitySizes: (nodeIds: string[], mode: 'width' | 'size') => void
  assignNodesToGroup: (nodeIds: string[], groupId: string | undefined) => void
  deleteEdge: (id: string) => void
  setEdges: (edges: DndEdge[]) => void
  updateEdgeData: (edgeId: string, data: Partial<DndEdgeData>, recordHistory?: boolean) => void
  reverseEdgeDirection: (edgeId: string) => void
  addWaypoint: (edgeId: string, x: number, y: number) => void
  updateWaypoint: (edgeId: string, waypointId: string, x: number, y: number) => void
  removeWaypoint: (edgeId: string, waypointId: string) => void
  clearWaypoints: (edgeId: string) => void

  // Clipboard & Duplication
  clipboard: { nodes: DndNode[]; edges: DndEdge[] } | null
  copySelection: (overrideNodeId?: string) => void
  pasteClipboard: (targetPosition?: { x: number; y: number }) => void
  duplicateSelection: (overrideNodeId?: string) => void

  // View & Theme Modes
  isPlayerView: boolean
  togglePlayerView: () => void
  isDarkMode: boolean
  setDarkModeFromSystem: (isDark: boolean) => void
  toggleDarkMode: () => void

  // Legend & Presets
  visibleTypes: Record<string, boolean>
  toggleTypeVisibility: (type: string) => void
  setAllEntityVisibility: (visible: boolean) => void
  setAllEdgeVisibility: (visible: boolean) => void
  setAllTypesVisibility: (visible: boolean) => void
  connectionPresets: ConnectionPreset[]
  saveConnectionPreset: (preset: ConnectionPreset) => void
  deleteConnectionPreset: (label: string) => void
  visibleEdgeTypes: Record<string, boolean>
  toggleEdgeTypeVisibility: (label: string) => void
  customEntityTypes: CustomEntityType[]
  addCustomEntityType: (type: CustomEntityType) => void
  updateCustomEntityType: (oldLabel: string, updated: CustomEntityType) => void
  removeCustomEntityType: (label: string) => void

  // Camera Bookmarks
  cameraBookmarks: CameraBookmark[]
  addCameraBookmark: (bookmark: Omit<CameraBookmark, 'id'> & { id?: string }) => CameraBookmark
  updateCameraBookmark: (id: string, patch: Partial<Omit<CameraBookmark, 'id'>>) => void
  deleteCameraBookmark: (id: string) => void

  // Session Timeline Snapshots ("Time Machine")
  snapshots: CampaignSnapshot[]
  activeSnapshotId: string | null
  showSnapshotDiff: boolean
  diffTargetSnapshotId: string | 'live'
  setDiffTargetSnapshotId: (id: string | 'live') => void
  createSnapshot: (params: {
    title: string
    sessionNumber?: number
    summary?: string
    playerVisible?: boolean
  }) => void
  updateSnapshotMeta: (
    id: string,
    patch: { title?: string; sessionNumber?: number; summary?: string; playerVisible?: boolean }
  ) => void
  deleteSnapshot: (id: string) => void
  setActiveSnapshot: (id: string | null) => void
  toggleSnapshotDiff: () => void
  restoreSnapshotToLive: (id: string) => void

  // File Lifecycle
  resetBlankMap: () => void
  loadStarterDemo: () => void
  loadCampaignState: (raw: any) => void
  importPartyNotes: (raw: any) => PartyNotesMergeResult['stats']
}

const getInitialDarkMode = (): boolean => {
  if (typeof document !== 'undefined') {
    return document.documentElement.classList.contains('dark')
  }
  return false
}

export const useStore = create<AppState>((set, get) => ({
  past: [],
  future: [],
  pushHistory: (force = false) => {
    const now = Date.now()
    if (!force && now - lastHistoryPushAt < 45) return
    lastHistoryPushAt = now

    set((state) => {
      const snapshot: HistoryEntry = {
        nodes: state.nodes.map(cleanNodeForPersistence),
        edges: state.edges.map(cleanEdgeForPersistence)
      }
      const past = [...state.past, snapshot]
      if (past.length > 50) past.shift()
      return { past, future: [] }
    })
  },
  clearHistory: () => {
    lastHistoryPushAt = 0
    set({ past: [], future: [] })
  },
  undo: () => {
    set((state) => {
      if (state.activeSnapshotId !== null || state.past.length === 0) return state
      const previous = state.past[state.past.length - 1]
      const newPast = state.past.slice(0, state.past.length - 1)
      const currentSnapshot: HistoryEntry = {
        nodes: state.nodes.map(cleanNodeForPersistence),
        edges: state.edges.map(cleanEdgeForPersistence)
      }
      return {
        past: newPast,
        future: [currentSnapshot, ...state.future],
        nodes: previous.nodes,
        edges: previous.edges
      }
    })
  },
  redo: () => {
    set((state) => {
      if (state.activeSnapshotId !== null || state.future.length === 0) return state
      const next = state.future[0]
      const newFuture = state.future.slice(1)
      const currentSnapshot: HistoryEntry = {
        nodes: state.nodes.map(cleanNodeForPersistence),
        edges: state.edges.map(cleanEdgeForPersistence)
      }
      return {
        past: [...state.past, currentSnapshot],
        future: newFuture,
        nodes: next.nodes,
        edges: next.edges
      }
    })
  },

  campaignEdition: 'dm',
  campaignTitle: STARTER_CAMPAIGN_TITLE,
  setCampaignTitle: (campaignTitle) => set({ campaignTitle }),
  canvasTheme: STARTER_CANVAS_THEME,
  setCanvasTheme: (canvasTheme) => set({ canvasTheme }),

  nodes: STARTER_NODES,
  edges: STARTER_EDGES,

  onNodesChange: (changes: NodeChange<DndNode>[]) => {
    if (get().activeSnapshotId !== null) return
    const isPlayerEdition = get().campaignEdition === 'player'
    const currentNodes = get().nodes
    const nodeById = new Map(currentNodes.map((n) => [n.id, n]))

    const safeChanges = changes.filter((c) => {
      if (c.type === 'remove') {
        const target = nodeById.get(c.id)
        if (!target) return false
        if (isNodeEffectivelyLocked(target, nodeById)) return false
        if (isPlayerEdition && !target.data?.isPlayerCreated) return false
        return true
      }
      if (c.type === 'position') {
        if (activeEntityResizeIds.has(c.id)) return false
        const target = nodeById.get(c.id)
        if (!target) return false
        if (isNodeEffectivelyLocked(target, nodeById)) return false
        if (isPlayerEdition && !target.data?.isPlayerCreated) return false
        return true
      }
      if (c.type === 'dimensions' && c.resizing) {
        const target = nodeById.get(c.id)
        if (!target) return false
        if (isNodeEffectivelyLocked(target, nodeById)) return false
        if (isPlayerEdition && !target.data?.isPlayerCreated) return false
        return true
      }
      return true
    })

    if (safeChanges.length === 0) return
    if (safeChanges.some((c) => c.type === 'remove')) get().pushHistory()

    // Detect moved Group Region containers so member entities and internal waypoints move in lockstep
    const explicitPosIds = new Set<string>()
    const groupDeltas = new Map<string, { dx: number; dy: number }>()
    const removedGroupIds = new Set<string>()

    for (const c of safeChanges) {
      if (c.type === 'position' && c.position) {
        explicitPosIds.add(c.id)
        const target = nodeById.get(c.id)
        if (target && (target.type === 'groupRegion' || target.data?.isGroup)) {
          const dx = c.position.x - target.position.x
          const dy = c.position.y - target.position.y
          if (dx !== 0 || dy !== 0) {
            groupDeltas.set(c.id, { dx, dy })
          }
        }
      } else if (c.type === 'remove') {
        const target = nodeById.get(c.id)
        if (target && (target.type === 'groupRegion' || target.data?.isGroup)) {
          removedGroupIds.add(c.id)
        }
      }
    }

    let nextNodes = applyNodeChanges(safeChanges, currentNodes)
    let nextEdges = get().edges
    let edgesChanged = false

    if (groupDeltas.size > 0) {
      nextNodes = nextNodes.map((n) => {
        if (!n.data?.groupId || explicitPosIds.has(n.id)) return n
        const delta = groupDeltas.get(n.data.groupId)
        if (!delta) return n
        return {
          ...n,
          position: {
            x: n.position.x + delta.dx,
            y: n.position.y + delta.dy
          }
        }
      })

      // Translate internal curve waypoints when both endpoints belong to the moved group
      const groupSetByGroupId = new Map<string, Set<string>>()
      for (const gId of groupDeltas.keys()) {
        const setIds = new Set<string>([gId])
        for (const n of currentNodes) {
          if (n.data?.groupId === gId) setIds.add(n.id)
        }
        groupSetByGroupId.set(gId, setIds)
      }

      nextEdges = nextEdges.map((e) => {
        if (!e.data?.waypoints || e.data.waypoints.length === 0) return e
        for (const [gId, delta] of groupDeltas.entries()) {
          const setIds = groupSetByGroupId.get(gId)!
          if (setIds.has(e.source) && setIds.has(e.target)) {
            edgesChanged = true
            return {
              ...e,
              data: {
                ...e.data,
                waypoints: e.data.waypoints.map((w) => ({
                  ...w,
                  x: w.x + delta.dx,
                  y: w.y + delta.dy
                }))
              }
            }
          }
        }
        return e
      })
    }

    if (removedGroupIds.size > 0) {
      nextNodes = nextNodes.map((n) =>
        n.data?.groupId && removedGroupIds.has(n.data.groupId)
          ? { ...n, data: { ...n.data, groupId: undefined } }
          : n
      )
    }

    set(edgesChanged ? { nodes: nextNodes, edges: nextEdges } : { nodes: nextNodes })
  },
  onEdgesChange: (changes: EdgeChange<DndEdge>[]) => {
    if (get().activeSnapshotId !== null) return
    const isPlayerEdition = get().campaignEdition === 'player'
    const currentEdges = get().edges
    const safeChanges = isPlayerEdition
      ? changes.filter((c) => {
          if (c.type !== 'remove') return true
          const target = currentEdges.find((e) => e.id === c.id)
          return !!target?.data?.isPlayerCreated
        })
      : changes
    if (safeChanges.length === 0) return
    if (safeChanges.some((c) => c.type === 'remove')) get().pushHistory()
    set({
      edges: applyEdgeChanges(safeChanges, currentEdges)
    })
  },
  onConnect: (connection: Connection) => {
    if (get().activeSnapshotId !== null) return
    get().pushHistory(true)
    set((state) => {
      const isPlayerEdition = state.campaignEdition === 'player'
      const newEdge: DndEdge = {
        id: `edge-${crypto.randomUUID()}`,
        type: 'dndEdge',
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle ?? null,
        targetHandle: connection.targetHandle ?? null,
        selected: true,
        data: {
          color: '#94a3b8',
          lineStyle: isPlayerEdition ? 'dashed' : 'solid',
          thickness: 2,
          direction: 'forward',
          ...(isPlayerEdition ? { isPlayerCreated: true, label: 'Theory' } : {})
        }
      }
      const newEdges = addEdge(newEdge, state.edges.map((e) => ({ ...e, selected: false })))
      return {
        nodes: state.nodes.map((n) => ({ ...n, selected: false })),
        edges: newEdges as DndEdge[]
      }
    })
  },
  onReconnect: (oldEdge: Edge, newConnection: Connection) => {
    if (get().activeSnapshotId !== null) return
    if (get().campaignEdition === 'player' && !(oldEdge as DndEdge).data?.isPlayerCreated) return
    get().pushHistory(true)
    set((state) => {
      const newEdges = reconnectEdge(oldEdge, newConnection, state.edges) as DndEdge[]
      return {
        nodes: state.nodes.map((n) => ({ ...n, selected: false })),
        edges: newEdges.map((e) => {
          const isJustReconnected =
            e.source === newConnection.source &&
            e.target === newConnection.target &&
            e.sourceHandle === newConnection.sourceHandle &&
            e.targetHandle === newConnection.targetHandle
          return { ...e, selected: isJustReconnected }
        })
      }
    })
  },
  addNode: (node: DndNode) => {
    if (get().activeSnapshotId !== null) return
    get().pushHistory(true)
    set((state) => {
      const isPlayerEdition = state.campaignEdition === 'player'
      const taggedNode: DndNode = isPlayerEdition
        ? { ...node, data: { ...node.data, isPlayerCreated: true, isHidden: false } }
        : node
      return {
        nodes: [...state.nodes.map((n) => ({ ...n, selected: false })), { ...taggedNode, selected: true }],
        edges: state.edges.map((e) => ({ ...e, selected: false }))
      }
    })
  },
  addConnectedNode: (node, conn) => {
    if (get().activeSnapshotId !== null) return
    get().pushHistory(true)
    set((state) => {
      const isPlayerEdition = state.campaignEdition === 'player'
      const taggedNode: DndNode = isPlayerEdition
        ? { ...node, data: { ...node.data, isPlayerCreated: true, isHidden: false } }
        : node
      const edgeId = `edge-${crypto.randomUUID()}`
      const edgeBaseData: DndEdgeData = {
        color: '#94a3b8',
        lineStyle: isPlayerEdition ? 'dashed' : 'solid',
        thickness: 2,
        direction: 'forward',
        ...(isPlayerEdition ? { isPlayerCreated: true, label: 'Theory' } : {})
      }
      const newEdge: DndEdge = conn.isFromTargetHandle
        ? {
            id: edgeId,
            type: 'dndEdge',
            source: taggedNode.id,
            target: conn.source,
            sourceHandle: null,
            targetHandle: conn.sourceHandle ?? null,
            selected: false,
            data: edgeBaseData
          }
        : {
            id: edgeId,
            type: 'dndEdge',
            source: conn.source,
            target: taggedNode.id,
            sourceHandle: conn.sourceHandle ?? null,
            targetHandle: null,
            selected: false,
            data: edgeBaseData
          }
      return {
        nodes: [...state.nodes.map((n) => ({ ...n, selected: false })), { ...taggedNode, selected: true }],
        edges: [...state.edges.map((e) => ({ ...e, selected: false })), newEdge]
      }
    })
  },
  deleteNode: (id: string) => {
    if (get().activeSnapshotId !== null) return
    if (get().campaignEdition === 'player') {
      const target = get().nodes.find((n) => n.id === id)
      if (!target?.data?.isPlayerCreated) return
    }
    get().pushHistory(true)
    set((state) => {
      const removedTargets = new Set<string>([id])
      let remainingEdges = state.edges
      let changed = true
      while (changed) {
        changed = false
        remainingEdges = remainingEdges.filter((e) => {
          if (removedTargets.has(e.source) || removedTargets.has(e.target)) {
            removedTargets.add(`proxy-${e.id}`)
            changed = true
            return false
          }
          return true
        })
      }
      return {
        nodes: state.nodes
          .filter((n) => n.id !== id)
          .map((n) =>
            n.data?.groupId === id ? { ...n, data: { ...n.data, groupId: undefined } } : n
          ),
        edges: remainingEdges
      }
    })
  },
  updateNodeData: (nodeId: string, data: Partial<EntityNodeData>, recordHistory = false) => {
    if (get().activeSnapshotId !== null) return
    if (recordHistory) get().pushHistory(true)
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
      )
    }))
  },
  renameEntityLabel: (nodeId, nextLabel, options) => {
    if (get().activeSnapshotId !== null) return
    if (options?.recordHistory) get().pushHistory(true)
    set((state) => {
      const target = state.nodes.find((n) => n.id === nodeId)
      if (!target) return state
      const oldLabel = options?.fromLabel ?? target.data?.label ?? ''
      const updatedNodes = state.nodes.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, label: nextLabel } } : node
      )
      if (
        oldLabel.trim() &&
        nextLabel.trim() &&
        oldLabel.trim().toLowerCase() !== nextLabel.trim().toLowerCase()
      ) {
        return refactorGraphWikiLinks(updatedNodes, state.edges, oldLabel, nextLabel)
      }
      return { nodes: updatedNodes }
    })
  },
  batchUpdateNodes: (nodeIds, updater) => {
    if (get().activeSnapshotId !== null || nodeIds.length === 0) return
    get().pushHistory(true)
    const idSet = new Set(nodeIds)
    set((state) => ({
      nodes: state.nodes.map((n) => (idSet.has(n.id) ? updater(n) : n))
    }))
  },
  batchDeleteNodes: (nodeIds) => {
    if (get().activeSnapshotId !== null || nodeIds.length === 0) return
    const isPlayerEdition = get().campaignEdition === 'player'
    const currentNodes = get().nodes
    const deletableIds = new Set(
      nodeIds.filter((id) => {
        if (!isPlayerEdition) return true
        const target = currentNodes.find((n) => n.id === id)
        return !!target?.data?.isPlayerCreated
      })
    )
    if (deletableIds.size === 0) return
    get().pushHistory(true)
    set((state) => {
      const removedTargets = new Set<string>(deletableIds)
      let remainingEdges = state.edges
      let changed = true
      while (changed) {
        changed = false
        remainingEdges = remainingEdges.filter((e) => {
          if (removedTargets.has(e.source) || removedTargets.has(e.target)) {
            removedTargets.add(`proxy-${e.id}`)
            changed = true
            return false
          }
          return true
        })
      }
      return {
        nodes: state.nodes
          .filter((n) => !deletableIds.has(n.id))
          .map((n) =>
            n.data?.groupId && deletableIds.has(n.data.groupId)
              ? { ...n, data: { ...n.data, groupId: undefined } }
              : n
          ),
        edges: remainingEdges
      }
    })
  },
  setNodes: (nodes: DndNode[]) => {
    set({ nodes })
  },

  createGroupFromSelection: (options) => {
    if (get().activeSnapshotId !== null) return null
    const state = get()
    const isPlayerEdition = state.campaignEdition === 'player'
    const targetIdSet = options?.nodeIds ? new Set(options.nodeIds) : null

    const candidateMembers = state.nodes.filter((n) => {
      if (n.type === 'groupRegion' || n.data?.isGroup) return false
      if (isPlayerEdition && !n.data?.isPlayerCreated) return false
      return targetIdSet ? targetIdSet.has(n.id) : Boolean(n.selected)
    })

    if (candidateMembers.length === 0) return null
    const bounds = computeGroupBoundsForMembers(candidateMembers)
    if (!bounds) return null

    get().pushHistory(true)
    const groupId = `group-${crypto.randomUUID()}`
    const memberIds = new Set(candidateMembers.map((m) => m.id))
    const existingGroupCount = state.nodes.filter(
      (n) => n.type === 'groupRegion' || n.data?.isGroup
    ).length
    const groupLabel =
      options?.label?.trim() || `Group ${existingGroupCount + 1}`
    const customHex = normalizeHexColor(options?.customColor)
    const enableBackground = Boolean(options?.withBackground || customHex)

    const groupNode: DndNode = {
      id: groupId,
      type: 'groupRegion',
      position: { x: bounds.x, y: bounds.y },
      selected: true,
      data: {
        label: groupLabel,
        entityType: 'Group',
        isGroup: true,
        groupWidth: bounds.width,
        groupHeight: bounds.height,
        isLocked: Boolean(options?.lock),
        hasBackground: enableBackground,
        groupColor: options?.color || 'gold',
        ...(customHex ? { groupCustomColor: customHex } : {}),
        groupOpacity: 0.16,
        groupBorderStyle: enableBackground ? 'solid' : 'dashed',
        publicNotes: '',
        ...(isPlayerEdition ? { isPlayerCreated: true, isHidden: false } : {})
      }
    }

    set((prev) => ({
      nodes: [
        ...prev.nodes.map((n) =>
          memberIds.has(n.id)
            ? {
                ...n,
                selected: false,
                data: { ...n.data, groupId }
              }
            : { ...n, selected: false }
        ),
        groupNode
      ],
      edges: prev.edges.map((e) => ({ ...e, selected: false }))
    }))

    return groupId
  },

  ungroupNodes: (groupId: string) => {
    if (get().activeSnapshotId !== null) return
    const targetGroup = get().nodes.find((n) => n.id === groupId)
    if (!targetGroup) return
    if (get().campaignEdition === 'player' && !targetGroup.data?.isPlayerCreated) return

    get().pushHistory(true)
    set((state) => {
      const removedTargets = new Set<string>([groupId])
      let remainingEdges = state.edges
      let changed = true
      while (changed) {
        changed = false
        remainingEdges = remainingEdges.filter((e) => {
          if (removedTargets.has(e.source) || removedTargets.has(e.target)) {
            removedTargets.add(`proxy-${e.id}`)
            changed = true
            return false
          }
          return true
        })
      }

      return {
        nodes: state.nodes
          .filter((n) => n.id !== groupId)
          .map((n) =>
            n.data?.groupId === groupId
              ? { ...n, selected: true, data: { ...n.data, groupId: undefined } }
              : { ...n, selected: false }
          ),
        edges: remainingEdges
      }
    })
  },

  deleteGroupWithContents: (groupId: string) => {
    if (get().activeSnapshotId !== null) return
    const currentNodes = get().nodes
    const idsToDelete = currentNodes
      .filter((n) => n.id === groupId || n.data?.groupId === groupId)
      .map((n) => n.id)
    get().batchDeleteNodes(idsToDelete)
  },

  fitGroupToMembers: (groupId: string) => {
    if (get().activeSnapshotId !== null) return
    const state = get()
    const members = state.nodes.filter((n) => n.data?.groupId === groupId)
    const bounds = computeGroupBoundsForMembers(members)
    if (!bounds) return

    get().pushHistory(true)
    set((prev) => ({
      nodes: prev.nodes.map((n) =>
        n.id === groupId
          ? {
              ...n,
              position: { x: bounds.x, y: bounds.y },
              data: {
                ...n.data,
                groupWidth: bounds.width,
                groupHeight: bounds.height
              }
            }
          : n
      )
    }))
  },

  tidyGroupMembers: (groupId: string) => {
    if (get().activeSnapshotId !== null) return
    const state = get()
    const groupNode = state.nodes.find((n) => n.id === groupId)
    const members = state.nodes.filter(
      (n) => n.data?.groupId === groupId && n.type !== 'groupRegion' && !n.data?.isGroup
    )
    if (!groupNode || members.length === 0) return
    if (state.campaignEdition === 'player' && !groupNode.data?.isPlayerCreated) return

    const anchorX = Math.round((groupNode.position.x + 32) / 16) * 16
    const anchorY = Math.round((groupNode.position.y + 56) / 16) * 16

    const posUpdates = new Map<string, { x: number; y: number }>()
    if (members.length === 1) {
      posUpdates.set(members[0].id, { x: anchorX, y: anchorY })
    } else {
      const rawGrid = tidySelectedNodesGrid(members)
      let minX = Number.POSITIVE_INFINITY
      let minY = Number.POSITIVE_INFINITY
      rawGrid.forEach((pt) => {
        minX = Math.min(minX, pt.x)
        minY = Math.min(minY, pt.y)
      })
      const dx = Number.isFinite(minX) ? anchorX - minX : 0
      const dy = Number.isFinite(minY) ? anchorY - minY : 0
      rawGrid.forEach((pt, id) => {
        posUpdates.set(id, {
          x: Math.round((pt.x + dx) / 16) * 16,
          y: Math.round((pt.y + dy) / 16) * 16
        })
      })
    }

    const updatedMembers = members.map((m) => {
      const nextPt = posUpdates.get(m.id)
      return nextPt ? { ...m, position: nextPt } : m
    })
    const bounds = computeGroupBoundsForMembers(updatedMembers)

    get().pushHistory(true)
    set((prev) => ({
      nodes: prev.nodes.map((n) => {
        if (n.id === groupId && bounds) {
          return {
            ...n,
            position: { x: bounds.x, y: bounds.y },
            data: {
              ...n.data,
              groupWidth: bounds.width,
              groupHeight: bounds.height
            }
          }
        }
        const nextPt = posUpdates.get(n.id)
        return nextPt ? { ...n, position: nextPt } : n
      })
    }))
  },

  selectGroupMembers: (groupId: string) => {
    const state = get()
    const hideSecrets = state.isPlayerView || state.campaignEdition === 'player'
    const memberIds = new Set(
      state.nodes
        .filter(
          (n) =>
            n.data?.groupId === groupId &&
            n.type !== 'groupRegion' &&
            !n.data?.isGroup &&
            (!hideSecrets || !n.data?.isHidden)
        )
        .map((n) => n.id)
    )
    if (memberIds.size === 0) return
    set((prev) => ({
      nodes: prev.nodes.map((n) => ({ ...n, selected: memberIds.has(n.id) })),
      edges: prev.edges.map((e) => ({ ...e, selected: false }))
    }))
  },

  toggleNodeLock: (nodeIds: string[], forceLocked?: boolean) => {
    if (get().activeSnapshotId !== null || nodeIds.length === 0) return
    const idSet = new Set(nodeIds)
    const currentNodes = get().nodes
    const anyUnlocked = currentNodes.some((n) => idSet.has(n.id) && !n.data?.isLocked)
    const nextLocked = forceLocked !== undefined ? forceLocked : anyUnlocked

    get().pushHistory(true)
    set((state) => ({
      nodes: state.nodes.map((n) =>
        idSet.has(n.id) ? { ...n, data: { ...n.data, isLocked: nextLocked } } : n
      )
    }))
  },

  reorderNodes: (nodeIds: string[], direction: LayerReorderDirection) => {
    if (get().activeSnapshotId !== null || nodeIds.length === 0) return
    const state = get()
    const isPlayerEdition = state.campaignEdition === 'player'
    const movableIds = nodeIds.filter((id) => {
      if (!isPlayerEdition) return true
      const target = state.nodes.find((n) => n.id === id)
      return Boolean(target?.data?.isPlayerCreated)
    })
    if (movableIds.length === 0) return

    const nextNodes = reorderNodesByTier(state.nodes, movableIds, direction)
    const didChange = nextNodes.some((n, idx) => n.id !== state.nodes[idx]?.id)
    if (!didChange) return

    get().pushHistory(true)
    set({ nodes: nextNodes })
  },

  resizeEntityNode: (nodeId, patch, recordHistory = false) => {
    if (get().activeSnapshotId !== null) return
    const state = get()
    const nodeById = new Map(state.nodes.map((n) => [n.id, n]))
    const target = nodeById.get(nodeId)
    if (!target || target.type === 'groupRegion' || target.data?.isGroup) return
    if (isNodeEffectivelyLocked(target, nodeById)) return
    if (state.campaignEdition === 'player' && !target.data?.isPlayerCreated) return

    const nextRawW =
      patch.width === null
        ? undefined
        : patch.width !== undefined
          ? patch.width
          : target.data?.entityWidth
    const nextRawH =
      patch.height === null
        ? undefined
        : patch.height !== undefined
          ? patch.height
          : target.data?.entityHeight

    const { width: clampedW, height: clampedH } = resolveEntityExplicitSize({
      ...target.data,
      entityWidth: nextRawW,
      entityHeight: nextRawH
    })

    if (recordHistory) get().pushHistory(true)
    set((prev) => ({
      nodes: prev.nodes.map((n) => {
        if (n.id !== nodeId) return n
        const nextStyle: Record<string, any> = { ...(n.style || {}) }
        if (clampedW !== undefined) nextStyle.width = clampedW
        else delete nextStyle.width
        if (clampedH !== undefined) nextStyle.height = clampedH
        else delete nextStyle.height

        return {
          ...n,
          width: clampedW,
          height: clampedH,
          ...(patch.position
            ? {
                position: {
                  x: Math.round(patch.position.x),
                  y: Math.round(patch.position.y)
                }
              }
            : {}),
          style: nextStyle,
          data: {
            ...n.data,
            entityWidth: clampedW,
            entityHeight: clampedH
          }
        }
      })
    }))
  },

  resetEntitySize: (nodeIds: string[]) => {
    if (get().activeSnapshotId !== null || nodeIds.length === 0) return
    const state = get()
    const isPlayerEdition = state.campaignEdition === 'player'
    const nodeById = new Map(state.nodes.map((n) => [n.id, n]))
    const targetIds = new Set(
      nodeIds.filter((id) => {
        const target = nodeById.get(id)
        if (!target || target.type === 'groupRegion' || target.data?.isGroup) return false
        if (isNodeEffectivelyLocked(target, nodeById)) return false
        if (isPlayerEdition && !target.data?.isPlayerCreated) return false
        return (
          target.data?.entityWidth !== undefined ||
          target.data?.entityHeight !== undefined ||
          target.width !== undefined ||
          target.height !== undefined
        )
      })
    )
    if (targetIds.size === 0) return

    get().pushHistory(true)
    set((prev) => ({
      nodes: prev.nodes.map((n) => {
        if (!targetIds.has(n.id)) return n
        const nextStyle: Record<string, any> = { ...(n.style || {}) }
        delete nextStyle.width
        delete nextStyle.height
        return {
          ...n,
          width: undefined,
          height: undefined,
          style: nextStyle,
          data: {
            ...n.data,
            entityWidth: undefined,
            entityHeight: undefined
          }
        }
      })
    }))
  },

  matchSelectedEntitySizes: (nodeIds: string[], mode: 'width' | 'size') => {
    if (get().activeSnapshotId !== null || nodeIds.length < 2) return
    const state = get()
    const isPlayerEdition = state.campaignEdition === 'player'
    const nodeById = new Map(state.nodes.map((n) => [n.id, n]))
    const selectedEntities = nodeIds
      .map((id) => nodeById.get(id))
      .filter((n): n is DndNode => Boolean(n && n.type !== 'groupRegion' && !n.data?.isGroup))
    if (selectedEntities.length < 2) return

    const editableIds = new Set(
      selectedEntities
        .filter(
          (n) =>
            !isNodeEffectivelyLocked(n, nodeById) &&
            (!isPlayerEdition || Boolean(n.data?.isPlayerCreated))
        )
        .map((n) => n.id)
    )
    if (editableIds.size === 0) return

    let maxUnscaledW = 0
    let maxUnscaledH = 0
    for (const n of selectedEntities) {
      const scale = n.data?.baseScale || 1
      const { w, h } = resolveNodeSize(n)
      maxUnscaledW = Math.max(maxUnscaledW, Math.round(w / scale))
      maxUnscaledH = Math.max(maxUnscaledH, Math.round(h / scale))
    }

    get().pushHistory(true)
    set((prev) => ({
      nodes: prev.nodes.map((n) => {
        if (!editableIds.has(n.id)) return n
        const { width: nextW, height: nextH } = resolveEntityExplicitSize({
          ...n.data,
          entityWidth: maxUnscaledW,
          entityHeight: mode === 'size' ? maxUnscaledH : n.data?.entityHeight
        })
        const nextStyle: Record<string, any> = { ...(n.style || {}) }
        if (nextW !== undefined) nextStyle.width = nextW
        if (nextH !== undefined) nextStyle.height = nextH
        return {
          ...n,
          width: nextW,
          height: nextH,
          style: nextStyle,
          data: {
            ...n.data,
            entityWidth: nextW,
            ...(mode === 'size' ? { entityHeight: nextH } : {})
          }
        }
      })
    }))
  },

  assignNodesToGroup: (nodeIds: string[], groupId: string | undefined) => {
    if (get().activeSnapshotId !== null || nodeIds.length === 0) return
    const idSet = new Set(nodeIds)
    get().pushHistory(true)
    set((state) => ({
      nodes: state.nodes.map((n) =>
        idSet.has(n.id) && n.type !== 'groupRegion' && !n.data?.isGroup
          ? { ...n, data: { ...n.data, groupId } }
          : n
      )
    }))
  },
  deleteEdge: (id: string) => {
    if (get().activeSnapshotId !== null) return
    if (get().campaignEdition === 'player') {
      const target = get().edges.find((e) => e.id === id)
      if (!target?.data?.isPlayerCreated) return
    }
    get().pushHistory(true)
    const proxyId = `proxy-${id}`
    set((state) => ({
      edges: state.edges.filter((e) => e.id !== id && e.source !== proxyId && e.target !== proxyId)
    }))
  },
  setEdges: (edges: DndEdge[]) => {
    set({ edges })
  },
  updateEdgeData: (edgeId: string, data: Partial<DndEdgeData>, recordHistory = false) => {
    if (get().activeSnapshotId !== null) return
    if (recordHistory) get().pushHistory(true)
    set((state) => ({
      edges: state.edges.map((e) =>
        e.id === edgeId ? { ...e, data: { ...e.data, ...data } } : e
      )
    }))
  },
  reverseEdgeDirection: (edgeId: string) => {
    if (get().activeSnapshotId !== null) return
    get().pushHistory(true)
    set((state) => ({
      edges: state.edges.map((e) => {
        if (e.id !== edgeId) return e
        const reversedWaypoints = e.data?.waypoints ? [...e.data.waypoints].reverse() : undefined
        return {
          ...e,
          source: e.target,
          target: e.source,
          sourceHandle: e.targetHandle ?? null,
          targetHandle: e.sourceHandle ?? null,
          data: {
            ...e.data,
            waypoints: reversedWaypoints
          }
        }
      })
    }))
  },
  addWaypoint: (edgeId: string, x: number, y: number) => {
    if (get().activeSnapshotId !== null) return
    get().pushHistory(true)
    set((state) => ({
      edges: state.edges.map((e) => {
        if (e.id === edgeId) {
          const waypoints = e.data?.waypoints || []
          const sourceCenter = resolveEdgeEndpointCenter(e.source, state.nodes, state.edges)
          const targetCenter = resolveEdgeEndpointCenter(e.target, state.nodes, state.edges)
          const nextWaypoints = insertWaypointInNearestSegment(
            waypoints,
            sourceCenter,
            targetCenter,
            x,
            y
          )
          return {
            ...e,
            data: {
              ...e.data,
              waypoints: nextWaypoints
            }
          }
        }
        return e
      })
    }))
  },
  updateWaypoint: (edgeId: string, waypointId: string, x: number, y: number) => {
    if (get().activeSnapshotId !== null) return
    set((state) => ({
      edges: state.edges.map((e) => {
        if (e.id === edgeId && e.data?.waypoints) {
          return {
            ...e,
            data: {
              ...e.data,
              waypoints: e.data.waypoints.map((w) => (w.id === waypointId ? { ...w, x, y } : w))
            }
          }
        }
        return e
      })
    }))
  },
  removeWaypoint: (edgeId: string, waypointId: string) => {
    if (get().activeSnapshotId !== null) return
    get().pushHistory(true)
    set((state) => ({
      edges: state.edges.map((e) => {
        if (e.id === edgeId && e.data?.waypoints) {
          const remaining = e.data.waypoints.filter((w) => w.id !== waypointId)
          return {
            ...e,
            data: {
              ...e.data,
              waypoints: remaining.length > 0 ? remaining : undefined
            }
          }
        }
        return e
      })
    }))
  },
  clearWaypoints: (edgeId: string) => {
    if (get().activeSnapshotId !== null) return
    get().pushHistory(true)
    set((state) => ({
      edges: state.edges.map((e) =>
        e.id === edgeId ? { ...e, data: { ...e.data, waypoints: undefined } } : e
      )
    }))
  },

  // Clipboard & Duplication
  clipboard: null,
  copySelection: (overrideNodeId?: string) => {
    const { nodes, edges } = get()
    const baseSelected = overrideNodeId
      ? nodes.filter((n) => n.id === overrideNodeId)
      : nodes.filter((n) => n.selected)
    if (baseSelected.length === 0) return

    const selectedGroupIds = new Set(
      baseSelected
        .filter((n) => n.type === 'groupRegion' || n.data?.isGroup)
        .map((n) => n.id)
    )
    const expandedNodes =
      selectedGroupIds.size > 0
        ? nodes.filter(
            (n) =>
              baseSelected.some((b) => b.id === n.id) ||
              (n.data?.groupId !== undefined && selectedGroupIds.has(n.data.groupId))
          )
        : baseSelected

    const selectedIds = new Set(expandedNodes.map((n) => n.id))
    const internalEdges = edges.filter(
      (e) => selectedIds.has(e.source) && selectedIds.has(e.target)
    )
    set({
      clipboard: {
        nodes: expandedNodes.map(cleanNodeForPersistence),
        edges: internalEdges.map(cleanEdgeForPersistence)
      }
    })
  },
  pasteClipboard: (targetPosition?: { x: number; y: number }) => {
    const { clipboard, activeSnapshotId } = get()
    if (!clipboard || clipboard.nodes.length === 0 || activeSnapshotId !== null) return

    get().pushHistory(true)
    const minX = Math.min(...clipboard.nodes.map((n) => n.position.x))
    const minY = Math.min(...clipboard.nodes.map((n) => n.position.y))
    const dx = targetPosition ? targetPosition.x - minX : 48
    const dy = targetPosition ? targetPosition.y - minY : 48

    const isPlayerEdition = get().campaignEdition === 'player'
    const idMap = new Map<string, string>()
    for (const n of clipboard.nodes) {
      const isGroup = n.type === 'groupRegion' || Boolean(n.data?.isGroup)
      idMap.set(n.id, isGroup ? `group-${crypto.randomUUID()}` : crypto.randomUUID())
    }

    const newNodes: DndNode[] = clipboard.nodes.map((n) => {
      const newId = idMap.get(n.id)!
      const remappedGroupId = n.data.groupId ? idMap.get(n.data.groupId) : undefined
      return {
        ...n,
        id: newId,
        position: { x: n.position.x + dx, y: n.position.y + dy },
        selected: true,
        data: {
          ...n.data,
          groupId: remappedGroupId,
          label: clipboard.nodes.length === 1 ? `${n.data.label} (Copy)` : n.data.label,
          ...(isPlayerEdition ? { isPlayerCreated: true, isHidden: false } : {})
        }
      }
    })

    const newEdges: DndEdge[] = clipboard.edges.map((e) => ({
      ...e,
      id: `edge-${crypto.randomUUID()}`,
      source: idMap.get(e.source) || e.source,
      target: idMap.get(e.target) || e.target,
      selected: false,
      data: {
        ...e.data,
        ...(isPlayerEdition ? { isPlayerCreated: true, isHidden: false } : {}),
        waypoints: e.data?.waypoints?.map((w) => ({
          id: crypto.randomUUID(),
          x: w.x + dx,
          y: w.y + dy
        }))
      }
    }))

    set((state) => ({
      nodes: [...state.nodes.map((n) => ({ ...n, selected: false })), ...newNodes],
      edges: [...state.edges.map((e) => ({ ...e, selected: false })), ...newEdges]
    }))
  },
  duplicateSelection: (overrideNodeId?: string) => {
    get().copySelection(overrideNodeId)
    get().pasteClipboard()
  },

  isPlayerView: false,
  togglePlayerView: () => {
    set((state) => ({ isPlayerView: !state.isPlayerView }))
  },
  isDarkMode: getInitialDarkMode(),
  setDarkModeFromSystem: (isDark: boolean) => {
    document.documentElement.classList.toggle('dark', isDark)
    set({ isDarkMode: isDark })
  },
  toggleDarkMode: () => {
    set((state) => {
      const nextDark = !state.isDarkMode
      const targetScheme = nextDark ? 'dark' : 'light'
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const systemScheme = systemPrefersDark ? 'dark' : 'light'

      try {
        const meta = document.querySelector('meta[name="color-scheme"]') as HTMLMetaElement | null
        if (targetScheme === systemScheme) {
          localStorage.removeItem('color-scheme')
          if (meta) meta.content = 'light dark'
        } else {
          localStorage.setItem('color-scheme', targetScheme)
          if (meta) meta.content = targetScheme
        }
      } catch {
        // Ignore storage error
      }

      document.documentElement.classList.toggle('dark', nextDark)
      return { isDarkMode: nextDark }
    })
  },

  visibleTypes: {
    PC: true,
    NPC: true,
    Location: true,
    Item: true,
    Organization: true,
    Event: true,
    Group: true,
    ...STARTER_CUSTOM_ENTITY_TYPES.reduce((acc, t) => ({ ...acc, [t.label]: true }), {})
  },
  toggleTypeVisibility: (type: string) => {
    set((state) => ({
      visibleTypes: {
        ...state.visibleTypes,
        [type]: state.visibleTypes[type] === false ? true : false
      }
    }))
  },
  setAllEntityVisibility: (visible: boolean) => {
    set((state) => {
      const nextTypes: Record<string, boolean> = {
        PC: visible,
        NPC: visible,
        Location: visible,
        Item: visible,
        Organization: visible,
        Event: visible,
        Group: state.visibleTypes.Group !== false
      }
      state.customEntityTypes.forEach((t) => {
        nextTypes[t.label] = visible
      })
      return { visibleTypes: nextTypes }
    })
  },
  setAllEdgeVisibility: (visible: boolean) => {
    set((state) => {
      const nextEdges: Record<string, boolean> = {
        [OTHER_EDGE_FILTER_KEY]: visible
      }
      state.connectionPresets.forEach((p) => {
        nextEdges[p.label] = visible
      })
      return { visibleEdgeTypes: nextEdges }
    })
  },
  setAllTypesVisibility: (visible: boolean) => {
    set((state) => {
      const nextTypes: Record<string, boolean> = {
        PC: visible,
        NPC: visible,
        Location: visible,
        Item: visible,
        Organization: visible,
        Event: visible,
        Group: visible
      }
      state.customEntityTypes.forEach((t) => {
        nextTypes[t.label] = visible
      })
      const nextEdges: Record<string, boolean> = {
        [OTHER_EDGE_FILTER_KEY]: visible
      }
      state.connectionPresets.forEach((p) => {
        nextEdges[p.label] = visible
      })
      return { visibleTypes: nextTypes, visibleEdgeTypes: nextEdges }
    })
  },
  connectionPresets: STARTER_CONNECTION_PRESETS,
  saveConnectionPreset: (preset: ConnectionPreset) => {
    set((state) => {
      const exists = state.connectionPresets.find((p) => p.label === preset.label)
      if (exists) {
        return {
          connectionPresets: state.connectionPresets.map((p) =>
            p.label === preset.label ? preset : p
          )
        }
      }
      return {
        connectionPresets: [...state.connectionPresets, preset],
        visibleEdgeTypes: { ...state.visibleEdgeTypes, [preset.label]: true }
      }
    })
  },
  deleteConnectionPreset: (label: string) => {
    set((state) => {
      const nextVisible = { ...state.visibleEdgeTypes }
      delete nextVisible[label]
      return {
        connectionPresets: state.connectionPresets.filter((p) => p.label !== label),
        visibleEdgeTypes: nextVisible
      }
    })
  },
  visibleEdgeTypes: {},
  toggleEdgeTypeVisibility: (label: string) => {
    set((state) => ({
      visibleEdgeTypes: {
        ...state.visibleEdgeTypes,
        [label]: state.visibleEdgeTypes[label] === false ? true : false
      }
    }))
  },
  customEntityTypes: STARTER_CUSTOM_ENTITY_TYPES,
  addCustomEntityType: (type: CustomEntityType) => {
    set((state) => ({
      customEntityTypes: [...state.customEntityTypes, type],
      visibleTypes: { ...state.visibleTypes, [type.label]: true }
    }))
  },
  updateCustomEntityType: (oldLabel: string, updated: CustomEntityType) => {
    const trimmedNext = updated.label.trim()
    if (!trimmedNext) return
    const nextType: CustomEntityType = { ...updated, label: trimmedNext }
    if (oldLabel !== trimmedNext && get().nodes.some((n) => n.data.entityType === oldLabel)) {
      get().pushHistory(true)
    }
    set((state) => {
      const nextCustom = state.customEntityTypes.map((t) =>
        t.label === oldLabel ? nextType : t
      )
      const nextVisible = { ...state.visibleTypes }
      const wasVisible = nextVisible[oldLabel] !== false
      if (oldLabel !== trimmedNext) {
        delete nextVisible[oldLabel]
      }
      nextVisible[trimmedNext] = wasVisible
      const nextNodes =
        oldLabel !== trimmedNext
          ? state.nodes.map((n) =>
              n.data.entityType === oldLabel
                ? { ...n, data: { ...n.data, entityType: trimmedNext } }
                : n
            )
          : state.nodes
      return {
        customEntityTypes: nextCustom,
        visibleTypes: nextVisible,
        nodes: nextNodes
      }
    })
  },
  removeCustomEntityType: (label: string) => {
    set((state) => ({
      customEntityTypes: state.customEntityTypes.filter((t) => t.label !== label)
    }))
  },

  // Camera Bookmarks
  cameraBookmarks: STARTER_CAMERA_BOOKMARKS,
  addCameraBookmark: (bookmark) => {
    const created: CameraBookmark = {
      id: bookmark.id || `bm-${crypto.randomUUID()}`,
      label: bookmark.label.trim() || `View ${get().cameraBookmarks.length + 1}`,
      centerX: Math.round(bookmark.centerX),
      centerY: Math.round(bookmark.centerY),
      zoom: Number(bookmark.zoom.toFixed(2)),
      playerVisible: bookmark.playerVisible !== false
    }
    set((state) => ({
      cameraBookmarks: [...state.cameraBookmarks, created]
    }))
    return created
  },
  updateCameraBookmark: (id, patch) => {
    set((state) => ({
      cameraBookmarks: state.cameraBookmarks.map((b) =>
        b.id === id
          ? {
              ...b,
              ...patch,
              label: patch.label !== undefined ? patch.label.trim() || b.label : b.label
            }
          : b
      )
    }))
  },
  deleteCameraBookmark: (id) => {
    set((state) => ({
      cameraBookmarks: state.cameraBookmarks.filter((b) => b.id !== id)
    }))
  },

  // Session Timeline Snapshots
  snapshots: STARTER_SNAPSHOTS,
  activeSnapshotId: null,
  showSnapshotDiff: false,
  diffTargetSnapshotId: 'live',
  setDiffTargetSnapshotId: (id) => {
    set({ diffTargetSnapshotId: id })
  },
  createSnapshot: ({ title, sessionNumber, summary, playerVisible = true }) => {
    set((state) => {
      const newSnap: CampaignSnapshot = {
        id: `snap-${crypto.randomUUID()}`,
        title: title.trim() || `Snapshot ${state.snapshots.length + 1}`,
        sessionNumber,
        createdAt: new Date().toISOString(),
        summary: summary?.trim() || '',
        playerVisible,
        nodes: state.nodes.map(cleanNodeForPersistence),
        edges: state.edges.map(cleanEdgeForPersistence)
      }
      const nextSnaps = [...state.snapshots, newSnap].sort((a, b) => {
        if (a.sessionNumber !== undefined && b.sessionNumber !== undefined) {
          return a.sessionNumber - b.sessionNumber
        }
        return a.createdAt.localeCompare(b.createdAt)
      })
      return { snapshots: nextSnaps }
    })
  },
  updateSnapshotMeta: (id, patch) => {
    set((state) => {
      const nextSnaps = state.snapshots
        .map((s) => {
          if (s.id !== id) return s
          return {
            ...s,
            ...(patch.title !== undefined ? { title: patch.title.trim() || s.title } : {}),
            ...(patch.sessionNumber !== undefined ? { sessionNumber: patch.sessionNumber } : {}),
            ...(patch.summary !== undefined ? { summary: patch.summary.trim() } : {}),
            ...(patch.playerVisible !== undefined ? { playerVisible: patch.playerVisible } : {})
          }
        })
        .sort((a, b) => {
          if (a.sessionNumber !== undefined && b.sessionNumber !== undefined) {
            return a.sessionNumber - b.sessionNumber
          }
          return a.createdAt.localeCompare(b.createdAt)
        })
      return { snapshots: nextSnaps }
    })
  },
  deleteSnapshot: (id: string) => {
    set((state) => ({
      snapshots: state.snapshots.filter((s) => s.id !== id),
      activeSnapshotId: state.activeSnapshotId === id ? null : state.activeSnapshotId,
      diffTargetSnapshotId: state.diffTargetSnapshotId === id ? 'live' : state.diffTargetSnapshotId
    }))
  },
  setActiveSnapshot: (id: string | null) => {
    set((state) => ({
      activeSnapshotId: id,
      diffTargetSnapshotId:
        id !== null && state.diffTargetSnapshotId === id ? 'live' : state.diffTargetSnapshotId
    }))
  },
  toggleSnapshotDiff: () => {
    set((state) => ({ showSnapshotDiff: !state.showSnapshotDiff }))
  },
  restoreSnapshotToLive: (id: string) => {
    const snap = get().snapshots.find((s) => s.id === id)
    if (!snap) return
    // Temporarily exit preview so pushHistory captures Live state cleanly
    set({ activeSnapshotId: null, showSnapshotDiff: false, diffTargetSnapshotId: 'live' })
    get().pushHistory(true)
    set({
      nodes: snap.nodes.map(cleanNodeForPersistence),
      edges: snap.edges.map(cleanEdgeForPersistence)
    })
  },

  resetBlankMap: () => {
    lastHistoryPushAt = 0
    set({
      past: [],
      future: [],
      campaignEdition: 'dm',
      isPlayerView: false,
      campaignTitle: 'Untitled Campaign',
      nodes: [],
      edges: [],
      customEntityTypes: [],
      cameraBookmarks: [],
      snapshots: [],
      activeSnapshotId: null,
      showSnapshotDiff: false,
      diffTargetSnapshotId: 'live',
      visibleTypes: {
        PC: true,
        NPC: true,
        Location: true,
        Item: true,
        Organization: true,
        Event: true
      },
      visibleEdgeTypes: {}
    })
  },
  loadStarterDemo: () => {
    lastHistoryPushAt = 0
    set({
      past: [],
      future: [],
      campaignEdition: 'dm',
      isPlayerView: false,
      campaignTitle: STARTER_CAMPAIGN_TITLE,
      canvasTheme: STARTER_CANVAS_THEME,
      nodes: STARTER_NODES,
      edges: STARTER_EDGES,
      connectionPresets: STARTER_CONNECTION_PRESETS,
      customEntityTypes: STARTER_CUSTOM_ENTITY_TYPES,
      cameraBookmarks: STARTER_CAMERA_BOOKMARKS,
      snapshots: STARTER_SNAPSHOTS,
      activeSnapshotId: null,
      showSnapshotDiff: false,
      diffTargetSnapshotId: 'live',
      visibleTypes: {
        PC: true,
        NPC: true,
        Location: true,
        Item: true,
        Organization: true,
        Event: true,
        'Army / Host': true
      },
      visibleEdgeTypes: {}
    })
  },
  loadCampaignState: (raw: any) => {
    lastHistoryPushAt = 0
    const migrated = migrateLoadedCampaign(raw)
    set((state) => {
      const customVisibility = migrated.customEntityTypes.reduce(
        (acc, t) => ({ ...acc, [t.label]: true }),
        {}
      )
      return {
        past: [],
        future: [],
        campaignEdition: migrated.edition,
        isPlayerView: false,
        campaignTitle: migrated.campaignTitle,
        canvasTheme: migrated.canvasTheme,
        nodes: migrated.nodes,
        edges: migrated.edges,
        connectionPresets: migrated.connectionPresets,
        customEntityTypes: migrated.customEntityTypes,
        cameraBookmarks: migrated.cameraBookmarks || [],
        snapshots: migrated.snapshots,
        activeSnapshotId: null,
        showSnapshotDiff: false,
        diffTargetSnapshotId: 'live',
        visibleTypes: { ...state.visibleTypes, ...customVisibility }
      }
    })
  },
  importPartyNotes: (raw: any) => {
    const current = get()
    const result = mergePartyNotesIntoCampaign(
      { nodes: current.nodes, edges: current.edges },
      raw
    )
    const anyChanges =
      result.stats.updatedEntityNotes > 0 ||
      result.stats.updatedEdgeNotes > 0 ||
      result.stats.addedTheoryNodes > 0 ||
      result.stats.addedTheoryEdges > 0

    if (anyChanges) {
      get().pushHistory(true)
      set({
        nodes: result.nodes,
        edges: result.edges
      })
    }
    return result.stats
  }
}))
