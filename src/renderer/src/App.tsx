import { useMemo, useEffect, useState, useRef, useCallback } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  ConnectionMode,
  ReactFlowProvider,
  useReactFlow,
  Handle,
  Position,
  OnConnectStart,
  OnConnectEnd
} from '@xyflow/react'
import { useStore } from './store/useStore'
import { STARTER_CAMPAIGN_TITLE } from './store/starterMap'
import {
  CameraBookmark,
  CanvasTheme,
  DragSnapOption,
  FieldDiffEntry,
  PlayerWindowCommand
} from './types'
import EntityNode from './components/nodes/EntityNode'
import GroupNode, { resolveGroupTint } from './components/nodes/GroupNode'
import CustomEdge from './components/edges/CustomEdge'
import Legend, { LegendExportStamp } from './components/Legend'
import Sidebar from './components/Sidebar'
import PlayerInspector from './components/PlayerInspector'
import ContextMenu, { ContextMenuState } from './components/ContextMenu'
import TimelineBar from './components/TimelineBar'
import BookmarksBar from './components/BookmarksBar'
import CommandPaletteModal, { QuickCommandAction } from './components/CommandPaletteModal'
import ShareExportModal, { ShareTabId } from './components/ShareExportModal'
import FeatureTourCard from './components/FeatureTourCard'
import { AppLogoIcon } from './components/AppLogoIcon'
import { NativeModal, ConfirmModal } from './components/NativeModal'
import {
  capturePersistentCampaignSlice,
  computeEdgeDiffFields,
  computeNodeDiffFields,
  computeSnapshotDiff,
  hasPersistentCampaignDiff,
  PersistentCampaignSlice,
  serializeCampaign
} from './utils/campaignSerializer'
import { sanitizeCampaignForPlayers } from './utils/playerSanitizer'
import { normalizeHexColor } from './utils/colorUtils'
import {
  computeHarmonizedBackgroundGap,
  computeVisibleGraph,
  DRAG_SNAP_LABELS,
  DRAG_SNAP_OPTIONS,
  resolveNodeSize
} from './utils/graphPipeline'
import { toPng } from 'html-to-image'
import {
  Search,
  X,
  Moon,
  Sun,
  Undo,
  Redo,
  Palette,
  HelpCircle,
  Share2,
  FolderOpen,
  Save,
  SaveAll,
  FilePlus2,
  Sparkles,
  MonitorPlay,
  LocateFixed,
  Pause,
  Play,
  Compass,
  Map as MapIcon,
  Grid3x3,
  ChevronUp,
  ChevronDown,
  Eye
} from 'lucide-react'

const AUTO_SAVE_STORAGE_KEY = 'dcc:auto-save-enabled'
const AUTO_SAVE_DEBOUNCE_MS = 2000

function formatSavedClock(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function EdgeProxyNode({ data }: { data: any }) {
  const isVisible = !!data?.selected
  const opacityClass = isVisible ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
  return (
    <div className="w-full h-full pointer-events-none relative group">
      <Handle
        type="target"
        position={Position.Left}
        id="target"
        className={`edge-proxy-handle-left !w-2.5 !h-2.5 !bg-blue-500 !border-white pointer-events-auto ${opacityClass}`}
        style={{ left: -10 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="source"
        className={`edge-proxy-handle-right !w-2.5 !h-2.5 !bg-blue-500 !border-white pointer-events-auto ${opacityClass}`}
        style={{ right: -10 }}
      />
    </div>
  )
}

const nodeTypes = {
  entity: EntityNode,
  groupRegion: GroupNode,
  edgeProxy: EdgeProxyNode
}

const edgeTypes = {
  dndEdge: CustomEdge
}

const THEME_LABELS: Record<CanvasTheme, string> = {
  modern: 'Modern Studio',
  arcane: 'Dark Arcane',
  parchment: 'Parchment & Ink',
  corkboard: 'Detective Corkboard'
}

function FlowCanvas() {
  const { screenToFlowPosition, fitView, setCenter, getViewport, setViewport } = useReactFlow()
  const {
    campaignEdition,
    campaignTitle,
    setCampaignTitle,
    canvasTheme,
    setCanvasTheme,
    nodes,
    edges,
    snapshots,
    cameraBookmarks,
    activeSnapshotId,
    showSnapshotDiff,
    diffTargetSnapshotId,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onReconnect,
    addNode,
    updateNodeData,
    updateEdgeData,
    deleteNode,
    batchDeleteNodes,
    deleteEdge,
    createGroupFromSelection,
    ungroupNodes,
    deleteGroupWithContents,
    reorderNodes,
    resetEntitySize,
    matchSelectedEntitySizes,
    isPlayerView,
    togglePlayerView,
    visibleTypes,
    visibleEdgeTypes,
    connectionPresets,
    customEntityTypes,
    isDarkMode,
    setDarkModeFromSystem,
    toggleDarkMode,
    dragSnapEnabled,
    dragSnapSize,
    toggleDragSnap,
    setDragSnapOption,
    undo,
    redo,
    past,
    future,
    copySelection,
    pasteClipboard,
    duplicateSelection
  } = useStore()

  const isPlayerEdition = campaignEdition === 'player'
  const isSnapshotPreview = activeSnapshotId !== null
  const isReadOnlyCanvas = (!isPlayerEdition && isPlayerView) || isSnapshotPreview
  const hideSecrets = isPlayerView || isPlayerEdition

  // Auto-save & UI states
  const [autoSaveEnabled, setAutoSaveEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(AUTO_SAVE_STORAGE_KEY) !== 'false'
    } catch {
      return true
    }
  })
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState<boolean>(false)
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<string>('')
  const [politeSaveAnnouncement, setPoliteSaveAnnouncement] = useState<string>('')
  const [degrees, setDegrees] = useState<number | ''>('')
  const [degreeMode, setDegreeMode] = useState<'fade' | 'hide'>('fade')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchMatchIndex, setSearchMatchIndex] = useState(0)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [showMiniMap, setShowMiniMap] = useState(false)
  const [isAltPressed, setIsAltPressed] = useState(false)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [previewSelection, setPreviewSelection] = useState<{
    nodeId?: string
    edgeId?: string
  } | null>(null)

  // Unified Share & Export Modal + PNG state
  const [showShareModal, setShowShareModal] = useState(false)
  const [shareModalTab, setShareModalTab] = useState<ShareTabId | undefined>(undefined)
  const [exportScale, setExportScale] = useState(2)
  const [exportArea, setExportArea] = useState<'full' | 'current'>('full')
  const [exportIncludeLegend, setExportIncludeLegend] = useState(true)
  const [exportIncludeTitle, setExportIncludeTitle] = useState(true)
  const [isExportingRender, setIsExportingRender] = useState(false)

  // 2nd-Screen Player Window & Spotlight state (DM Edition)
  const [isPlayerScreenOpen, setIsPlayerScreenOpen] = useState(false)
  const [isPlayerSyncPaused, setIsPlayerSyncPaused] = useState(false)
  const [hasActiveSpotlight, setHasActiveSpotlight] = useState(false)
  const [mysterySpotlightNodeId, setMysterySpotlightNodeId] = useState<string | null>(null)
  const [pendingSpotlightReveal, setPendingSpotlightReveal] = useState<{
    targetType: 'node' | 'edge'
    id: string
    title: string
    message: string
    unhideNodeIds: string[]
    unhideEdgeIds: string[]
  } | null>(null)
  const queuedPlayerCommandRef = useRef<PlayerWindowCommand | null>(null)

  const [showHelpModal, setShowHelpModal] = useState(false)
  const [showTour, setShowTour] = useState(false)
  const [showLoadDemoConfirm, setShowLoadDemoConfirm] = useState(false)
  const [pendingDeleteNodeId, setPendingDeleteNodeId] = useState<string | null>(null)
  const [pendingDeleteEdgeId, setPendingDeleteEdgeId] = useState<string | null>(null)
  const [pendingDeleteGroupId, setPendingDeleteGroupId] = useState<string | null>(null)
  const [pendingDeleteSelectionIds, setPendingDeleteSelectionIds] = useState<string[] | null>(null)

  const tourTriggerRef = useRef<HTMLButtonElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastSavedSliceRef = useRef<PersistentCampaignSlice | null>(null)
  const autoSaveEnabledRef = useRef<boolean>(autoSaveEnabled)
  const activeFilePathRef = useRef<string | null>(activeFilePath)
  autoSaveEnabledRef.current = autoSaveEnabled
  activeFilePathRef.current = activeFilePath

  if (!lastSavedSliceRef.current) {
    lastSavedSliceRef.current = capturePersistentCampaignSlice(useStore.getState())
  }

  const activeFileName = useMemo(
    () => (activeFilePath ? activeFilePath.split(/[\\/]/).pop() || activeFilePath : null),
    [activeFilePath]
  )
  const connectingFromRef = useRef<{
    nodeId: string
    handleId?: string | null
    isFromTargetHandle?: boolean
  } | null>(null)

  // Reset snapshot preview selection when switching snapshots
  useEffect(() => {
    setPreviewSelection(null)
  }, [activeSnapshotId])

  // Track Alt modifier key so holding Alt mid-drag temporarily inverts grid snap without UI jitter
  useEffect(() => {
    const onKeyChange = (e: KeyboardEvent) => {
      setIsAltPressed(e.altKey)
    }
    const onWindowBlur = () => setIsAltPressed(false)
    window.addEventListener('keydown', onKeyChange)
    window.addEventListener('keyup', onKeyChange)
    window.addEventListener('blur', onWindowBlur)
    return () => {
      window.removeEventListener('keydown', onKeyChange)
      window.removeEventListener('keyup', onKeyChange)
      window.removeEventListener('blur', onWindowBlur)
    }
  }, [])

  // Listen for CustomEdge HTML label clicks during Snapshot Preview
  useEffect(() => {
    if (!isSnapshotPreview) return
    const onSelectEdgeEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ edgeId?: string }>).detail
      if (detail?.edgeId) {
        setPreviewSelection({ edgeId: detail.edgeId })
      }
    }
    window.addEventListener('dcc:select-edge', onSelectEdgeEvent)
    return () => window.removeEventListener('dcc:select-edge', onSelectEdgeEvent)
  }, [isSnapshotPreview])

  // Open dedicated Connection Point style menu when right-clicking a custom perimeter port
  useEffect(() => {
    if (isReadOnlyCanvas) return
    const onPortContextMenu = (e: Event) => {
      const detail = (
        e as CustomEvent<{ nodeId?: string; portId?: string; screenX?: number; screenY?: number }>
      ).detail
      if (
        !detail?.nodeId ||
        !detail?.portId ||
        typeof detail.screenX !== 'number' ||
        typeof detail.screenY !== 'number'
      ) {
        return
      }
      const st = useStore.getState()
      st.setNodes(st.nodes.map((n) => ({ ...n, selected: n.id === detail.nodeId })))
      st.setEdges(st.edges.map((ed) => ({ ...ed, selected: false })))
      setContextMenu({
        mode: 'custom-port',
        nodeId: detail.nodeId,
        portId: detail.portId,
        screenX: detail.screenX,
        screenY: detail.screenY
      })
    }
    window.addEventListener('dcc:port-context-menu', onPortContextMenu)
    return () => window.removeEventListener('dcc:port-context-menu', onPortContextMenu)
  }, [isReadOnlyCanvas])

  // Follow system color-scheme changes when no explicit override is pinned in localStorage
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const onSystemChange = (e: MediaQueryListEvent) => {
      try {
        const override = localStorage.getItem('color-scheme')
        if (!override) {
          setDarkModeFromSystem(e.matches)
        }
      } catch {
        setDarkModeFromSystem(e.matches)
      }
    }
    mql.addEventListener('change', onSystemChange)
    return () => mql.removeEventListener('change', onSystemChange)
  }, [setDarkModeFromSystem])

  const pushSanitizedStateToPlayerWindow = useCallback(() => {
    if (!window.api?.pushPlayerWindowState) return
    const st = useStore.getState()
    if (st.campaignEdition === 'player') return
    const payload = sanitizeCampaignForPlayers({
      campaignTitle: st.campaignTitle,
      canvasTheme: st.canvasTheme,
      nodes: st.nodes,
      edges: st.edges,
      connectionPresets: st.connectionPresets,
      customEntityTypes: st.customEntityTypes,
      snapshots: st.snapshots,
      cameraBookmarks: st.cameraBookmarks
    })
    window.api.pushPlayerWindowState(payload)
  }, [])

  // Subscribe to 2nd-Screen Player Window lifecycle events
  useEffect(() => {
    if (!window.api?.onPlayerWindowReady) return

    window.api.isPlayerWindowOpen?.().then((open) => {
      if (open) setIsPlayerScreenOpen(true)
    })

    const offReady = window.api.onPlayerWindowReady(() => {
      setIsPlayerScreenOpen(true)
      pushSanitizedStateToPlayerWindow()
      if (queuedPlayerCommandRef.current) {
        window.api.pushPlayerWindowCommand?.(queuedPlayerCommandRef.current)
        queuedPlayerCommandRef.current = null
      }
    })

    const offClosed = window.api.onPlayerWindowClosed(() => {
      setIsPlayerScreenOpen(false)
      setHasActiveSpotlight(false)
      setMysterySpotlightNodeId(null)
    })

    return () => {
      offReady()
      offClosed()
    }
  }, [pushSanitizedStateToPlayerWindow])

  // Route canvas & custom-handle accessibility announcements into the centralized polite live region
  useEffect(() => {
    const onAnnounce = (e: Event) => {
      const msg = (e as CustomEvent<{ message?: string }>).detail?.message
      if (msg) setPoliteSaveAnnouncement(msg)
    }
    window.addEventListener('dcc:announce', onAnnounce)
    return () => window.removeEventListener('dcc:announce', onAnnounce)
  }, [])

  // Live-sync public graph changes to Player Screen unless paused or in Player Edition
  useEffect(() => {
    if (isPlayerEdition) {
      if (isPlayerScreenOpen) {
        window.api?.closePlayerWindow?.()
        setIsPlayerScreenOpen(false)
        setHasActiveSpotlight(false)
        setMysterySpotlightNodeId(null)
      }
      return
    }
    if (!isPlayerScreenOpen || isPlayerSyncPaused) return
    pushSanitizedStateToPlayerWindow()
  }, [
    isPlayerEdition,
    isPlayerScreenOpen,
    isPlayerSyncPaused,
    nodes,
    edges,
    connectionPresets,
    customEntityTypes,
    snapshots,
    cameraBookmarks,
    campaignTitle,
    canvasTheme,
    pushSanitizedStateToPlayerWindow
  ])

  const handleOpenPlayerScreen = useCallback(async () => {
    const res = await window.api?.openPlayerWindow?.()
    if (res?.isOpen) {
      setIsPlayerScreenOpen(true)
      if (res.alreadyLoaded) {
        pushSanitizedStateToPlayerWindow()
      }
    }
  }, [pushSanitizedStateToPlayerWindow])

  const handleClosePlayerScreen = useCallback(async () => {
    await window.api?.closePlayerWindow?.()
    setIsPlayerScreenOpen(false)
    setHasActiveSpotlight(false)
    setMysterySpotlightNodeId(null)
  }, [])

  const handleSyncCameraToPlayers = useCallback(async () => {
    const wrapper = document.getElementById('map-export-wrapper')
    const rect = wrapper?.getBoundingClientRect()
    const screenCenterX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
    const screenCenterY = rect ? rect.top + rect.height / 2 : window.innerHeight / 2
    const worldCenter = screenToFlowPosition({ x: screenCenterX, y: screenCenterY })
    const cmd: PlayerWindowCommand = {
      type: 'syncCenter',
      centerX: worldCenter.x,
      centerY: worldCenter.y,
      zoom: getViewport().zoom
    }
    if (!isPlayerScreenOpen) {
      queuedPlayerCommandRef.current = cmd
      await handleOpenPlayerScreen()
      return
    }
    pushSanitizedStateToPlayerWindow()
    window.api?.pushPlayerWindowCommand?.(cmd)
  }, [
    getViewport,
    handleOpenPlayerScreen,
    isPlayerScreenOpen,
    pushSanitizedStateToPlayerWindow,
    screenToFlowPosition
  ])

  const handleSyncBookmarkToPlayers = useCallback(
    async (bookmark: CameraBookmark) => {
      const cmd: PlayerWindowCommand = {
        type: 'syncCenter',
        centerX: bookmark.centerX,
        centerY: bookmark.centerY,
        zoom: bookmark.zoom
      }
      if (!isPlayerScreenOpen) {
        queuedPlayerCommandRef.current = cmd
        await handleOpenPlayerScreen()
        return
      }
      pushSanitizedStateToPlayerWindow()
      window.api?.pushPlayerWindowCommand?.(cmd)
    },
    [handleOpenPlayerScreen, isPlayerScreenOpen, pushSanitizedStateToPlayerWindow]
  )

  const executeSpotlight = useCallback(
    async (targetType: 'node' | 'edge', id: string) => {
      const cmd: PlayerWindowCommand = { type: 'spotlight', targetType, id }
      setHasActiveSpotlight(true)
      setMysterySpotlightNodeId(null)
      if (!isPlayerScreenOpen) {
        queuedPlayerCommandRef.current = cmd
        const res = await window.api?.openPlayerWindow?.()
        if (res?.isOpen) {
          setIsPlayerScreenOpen(true)
          if (res.alreadyLoaded) {
            pushSanitizedStateToPlayerWindow()
            window.api?.pushPlayerWindowCommand?.(cmd)
            queuedPlayerCommandRef.current = null
          }
        }
        return
      }
      pushSanitizedStateToPlayerWindow()
      window.api?.pushPlayerWindowCommand?.(cmd)
    },
    [isPlayerScreenOpen, pushSanitizedStateToPlayerWindow]
  )

  const handleSpotlightNode = useCallback(
    (nodeId: string) => {
      const st = useStore.getState()
      const target = st.nodes.find((n) => n.id === nodeId)
      if (!target) return
      if (target.data.isHidden) {
        setPendingSpotlightReveal({
          targetType: 'node',
          id: nodeId,
          title: 'Reveal & Spotlight Hidden Entity?',
          message: `"${target.data.label || 'Unnamed Entity'}" is currently hidden from players. Revealing it will make its public lore and portrait visible on the Player Map (your DM Secret Notes stay completely private).`,
          unhideNodeIds: [nodeId],
          unhideEdgeIds: []
        })
        return
      }
      executeSpotlight('node', nodeId)
    },
    [executeSpotlight]
  )

  // Mystery Portrait ("???") Spotlight — reveals ONLY portrait art without unhiding or leaking name/stats!
  const handleMysterySpotlightNode = useCallback(
    async (nodeId: string) => {
      const st = useStore.getState()
      const target = st.nodes.find((n) => n.id === nodeId)
      if (!target?.data.portrait) return
      const isGroupTarget = target.type === 'groupRegion' || Boolean(target.data.isGroup)
      const cmd: PlayerWindowCommand = {
        type: 'mysteryPortrait',
        portrait: target.data.portrait,
        subtitle: isGroupTarget ? 'Unidentified Emblem / Region' : 'Unidentified Encounter'
      }
      setHasActiveSpotlight(true)
      setMysterySpotlightNodeId(nodeId)
      if (!isPlayerScreenOpen) {
        queuedPlayerCommandRef.current = cmd
        const res = await window.api?.openPlayerWindow?.()
        if (res?.isOpen) {
          setIsPlayerScreenOpen(true)
          if (res.alreadyLoaded) {
            pushSanitizedStateToPlayerWindow()
            window.api?.pushPlayerWindowCommand?.(cmd)
            queuedPlayerCommandRef.current = null
          }
        }
        return
      }
      pushSanitizedStateToPlayerWindow()
      window.api?.pushPlayerWindowCommand?.(cmd)
    },
    [isPlayerScreenOpen, pushSanitizedStateToPlayerWindow]
  )

  const handleSpotlightEdge = useCallback(
    (edgeId: string) => {
      const st = useStore.getState()
      const edge = st.edges.find((e) => e.id === edgeId)
      if (!edge) return
      const unhideEdgeIds = edge.data?.isHidden ? [edgeId] : []
      const unhideNodeIds: string[] = []
      const src = st.nodes.find((n) => n.id === edge.source)
      const tgt = st.nodes.find((n) => n.id === edge.target)
      if (src?.data.isHidden) unhideNodeIds.push(src.id)
      if (tgt?.data.isHidden) unhideNodeIds.push(tgt.id)

      if (unhideEdgeIds.length > 0 || unhideNodeIds.length > 0) {
        const extraNodesNote =
          unhideNodeIds.length > 0
            ? ` and ${unhideNodeIds.length} hidden endpoint entit${unhideNodeIds.length === 1 ? 'y' : 'ies'}`
            : ''
        setPendingSpotlightReveal({
          targetType: 'edge',
          id: edgeId,
          title: 'Reveal & Spotlight Hidden Relationship?',
          message: `"${edge.data?.label || 'Connection'}"${extraNodesNote} must be unhidden so players can see it on the Player Screen (DM Secret Notes stay private). Reveal and spotlight now?`,
          unhideNodeIds,
          unhideEdgeIds
        })
        return
      }
      executeSpotlight('edge', edgeId)
    },
    [executeSpotlight]
  )

  const handleClearSpotlight = useCallback(() => {
    setHasActiveSpotlight(false)
    setMysterySpotlightNodeId(null)
    window.api?.pushPlayerWindowCommand?.({ type: 'clearSpotlight' })
  }, [])

  const buildSerializedPayload = useCallback(() => {
    const st = useStore.getState()
    return serializeCampaign({
      edition: st.campaignEdition,
      campaignTitle: st.campaignTitle,
      canvasTheme: st.canvasTheme,
      nodes: st.nodes,
      edges: st.edges,
      connectionPresets: st.connectionPresets,
      customEntityTypes: st.customEntityTypes,
      snapshots: st.snapshots,
      cameraBookmarks: st.cameraBookmarks
    })
  }, [])

  const currentPersistentSlice = useMemo<PersistentCampaignSlice>(
    () => ({
      campaignEdition,
      campaignTitle,
      canvasTheme,
      nodes,
      edges,
      connectionPresets,
      customEntityTypes,
      snapshots,
      cameraBookmarks
    }),
    [
      campaignEdition,
      campaignTitle,
      canvasTheme,
      nodes,
      edges,
      connectionPresets,
      customEntityTypes,
      snapshots,
      cameraBookmarks
    ]
  )

  const isAnyNodeInteracting = useMemo(
    () => nodes.some((n) => Boolean(n.dragging || n.resizing)),
    [nodes]
  )

  // Sync dirty state to main process so window close only prompts when real changes are unsaved
  useEffect(() => {
    window.api?.setDirtyState?.(isDirty)
  }, [isDirty])

  const handleToggleAutoSave = useCallback(() => {
    setAutoSaveEnabled((prev) => {
      const next = !prev
      try {
        localStorage.setItem(AUTO_SAVE_STORAGE_KEY, String(next))
      } catch {
        // Ignore storage write errors
      }
      if (!next && timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      setPoliteSaveAnnouncement(next ? 'Auto-save enabled' : 'Auto-save disabled')
      return next
    })
  }, [])

  // Persistent-Content Dirty Tracking & Debounced Auto-Save
  useEffect(() => {
    const dirtyNow = hasPersistentCampaignDiff(lastSavedSliceRef.current, currentPersistentSlice)
    setIsDirty(dirtyNow)

    if (!dirtyNow) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      setSaveStatus((prev) =>
        prev === 'Unsaved' ||
        prev === 'Unsaved…' ||
        prev === 'Pick file (Ctrl+S)' ||
        prev === 'Unsaved changes...'
          ? lastSavedAt
            ? 'Saved'
            : ''
          : prev
      )
      return
    }

    if (!autoSaveEnabled) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      setSaveStatus('Unsaved')
      return
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    setSaveStatus(activeFilePath ? 'Unsaved…' : 'Pick file (Ctrl+S)')

    // Defer disk writes while a card or group is actively mid-drag or mid-resize
    if (isAnyNodeInteracting) {
      return
    }

    timeoutRef.current = setTimeout(async () => {
      timeoutRef.current = null
      if (!autoSaveEnabledRef.current) return

      const savingSlice = capturePersistentCampaignSlice(useStore.getState())
      if (!hasPersistentCampaignDiff(lastSavedSliceRef.current, savingSlice)) {
        setIsDirty(false)
        return
      }

      if (activeFilePathRef.current) {
        setIsSaving(true)
        setSaveStatus('Saving…')
      }

      const data = buildSerializedPayload()
      const res = await window.api?.autoSaveCampaign?.(data, useStore.getState().campaignTitle)
      setIsSaving(false)

      if (res?.success) {
        lastSavedSliceRef.current = savingSlice
        if (res.filePath) setActiveFilePath(res.filePath)
        setLastSavedAt(formatSavedClock())
        const stillDirty = hasPersistentCampaignDiff(
          savingSlice,
          capturePersistentCampaignSlice(useStore.getState())
        )
        setIsDirty(stillDirty)
        if (!stillDirty) {
          setSaveStatus('Auto-saved')
          setPoliteSaveAnnouncement('Campaign auto-saved')
        }
      } else if (res?.noActiveFile) {
        setSaveStatus('Pick file (Ctrl+S)')
      } else {
        setSaveStatus('Save failed')
        setPoliteSaveAnnouncement('Auto-save failed')
      }
    }, AUTO_SAVE_DEBOUNCE_MS)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [
    currentPersistentSlice,
    autoSaveEnabled,
    activeFilePath,
    isAnyNodeInteracting,
    lastSavedAt,
    buildSerializedPayload
  ])

  const performManualSave = useCallback(
    async (saveAs = false) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      const savingSlice = capturePersistentCampaignSlice(useStore.getState())
      const data = buildSerializedPayload()
      setIsSaving(true)
      setSaveStatus('Saving…')
      const res = await window.api?.saveCampaign?.(data, useStore.getState().campaignTitle, {
        saveAs
      })
      setIsSaving(false)

      if (res?.success) {
        lastSavedSliceRef.current = savingSlice
        if (res.filePath) setActiveFilePath(res.filePath)
        setLastSavedAt(formatSavedClock())
        const stillDirty = hasPersistentCampaignDiff(
          savingSlice,
          capturePersistentCampaignSlice(useStore.getState())
        )
        setIsDirty(stillDirty)
        if (!stillDirty) {
          setSaveStatus('Saved')
          setPoliteSaveAnnouncement('Campaign saved')
        }
        return true
      } else if (res?.canceled) {
        const nowDirty = hasPersistentCampaignDiff(
          lastSavedSliceRef.current,
          capturePersistentCampaignSlice(useStore.getState())
        )
        setIsDirty(nowDirty)
        setSaveStatus(
          nowDirty
            ? autoSaveEnabled && !activeFilePath
              ? 'Pick file (Ctrl+S)'
              : 'Unsaved'
            : lastSavedAt
              ? 'Saved'
              : ''
        )
        return false
      } else {
        setSaveStatus('Save failed')
        setPoliteSaveAnnouncement('Save failed')
        return false
      }
    },
    [buildSerializedPayload, autoSaveEnabled, activeFilePath, lastSavedAt]
  )

  const handleSave = useCallback(() => performManualSave(false), [performManualSave])
  const handleSaveAs = useCallback(() => performManualSave(true), [performManualSave])

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null
      const tag = activeEl?.tagName
      const isTyping =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        Boolean(activeEl?.isContentEditable)

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (e.shiftKey) {
          void handleSaveAs()
        } else {
          void handleSave()
        }
        return
      }

      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key.toLowerCase() === 'k' || e.key.toLowerCase() === 'f')
      ) {
        e.preventDefault()
        setShowCommandPalette(true)
        return
      }

      if (isTyping) return

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && !isReadOnlyCanvas) {
        copySelection()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v' && !isReadOnlyCanvas) {
        pasteClipboard()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && !isReadOnlyCanvas) {
        e.preventDefault()
        duplicateSelection()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g' && !isReadOnlyCanvas) {
        e.preventDefault()
        if (e.shiftKey) {
          const selGroup = useStore
            .getState()
            .nodes.find((n) => n.selected && (n.type === 'groupRegion' || n.data?.isGroup))
          if (selGroup) ungroupNodes(selGroup.id)
        } else {
          createGroupFromSelection()
        }
      } else if (
        !isReadOnlyCanvas &&
        !e.altKey &&
        (e.key === '[' ||
          e.key === ']' ||
          ((e.ctrlKey || e.metaKey) &&
            (e.code === 'BracketLeft' || e.code === 'BracketRight'))) &&
        !document.querySelector('dialog[open]')
      ) {
        const selectedIds = useStore
          .getState()
          .nodes.filter((n) => n.selected)
          .map((n) => n.id)
        if (selectedIds.length > 0) {
          e.preventDefault()
          const isRightBracket = e.key === ']' || e.code === 'BracketRight'
          if (e.ctrlKey || e.metaKey) {
            reorderNodes(selectedIds, isRightBracket ? 'front' : 'back')
          } else {
            reorderNodes(selectedIds, isRightBracket ? 'forward' : 'backward')
          }
        }
      } else if (
        e.key.toLowerCase() === 'm' &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        setShowMiniMap((v) => !v)
      } else if (
        !isReadOnlyCanvas &&
        e.key.toLowerCase() === 'g' &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !document.querySelector('dialog[open]')
      ) {
        e.preventDefault()
        const st = useStore.getState()
        const nextEnabled = !st.dragSnapEnabled
        st.toggleDragSnap(nextEnabled)
        setPoliteSaveAnnouncement(
          nextEnabled
            ? `Grid snap enabled (${st.dragSnapSize}px)`
            : 'Grid snap off (Free 1px)'
        )
      } else if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        setShowHelpModal(true)
      } else if (e.key === 'Escape' && !showCommandPalette) {
        if (isSnapshotPreview) {
          useStore.getState().setActiveSnapshot(null)
        } else if (searchQuery) {
          setSearchQuery('')
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    undo,
    redo,
    copySelection,
    pasteClipboard,
    duplicateSelection,
    createGroupFromSelection,
    ungroupNodes,
    reorderNodes,
    handleSave,
    handleSaveAs,
    isReadOnlyCanvas,
    isSnapshotPreview,
    showCommandPalette,
    searchQuery
  ])

  const memoizedNodeTypes = useMemo(() => nodeTypes, [])
  const memoizedEdgeTypes = useMemo(() => edgeTypes, [])

  const spawnNodeAt = useCallback(
    (flowX: number, flowY: number, focusName = false) => {
      const isPlayerEd = useStore.getState().campaignEdition === 'player'
      addNode({
        id: crypto.randomUUID(),
        type: 'entity',
        position: { x: flowX - 95, y: flowY - 25 },
        data: { label: isPlayerEd ? 'New Theory' : 'New Entity', entityType: 'NPC' }
      })
      if (focusName) {
        requestAnimationFrame(() => {
          const input = document.getElementById('sidebar-node-name-input') as HTMLInputElement | null
          input?.focus()
          input?.select()
        })
      }
    },
    [addNode]
  )

  const handleAddNodeToolbar = useCallback(() => {
    const center = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2
    })
    spawnNodeAt(center.x, center.y, true)
  }, [screenToFlowPosition, spawnNodeAt])

  const navigateToNode = useCallback(
    (nodeId: string) => {
      const sourceList =
        activeSnapshotId !== null
          ? snapshots.find((s) => s.id === activeSnapshotId)?.nodes || nodes
          : nodes
      const target = sourceList.find((n) => n.id === nodeId)
      if (!target) return

      const { w, h } = resolveNodeSize(target)
      const isGroup = target.type === 'groupRegion' || Boolean(target.data?.isGroup)
      setCenter(target.position.x + w / 2, target.position.y + h / 2, {
        zoom: isGroup ? 0.92 : 1.15,
        duration: 420
      })

      if (activeSnapshotId !== null) {
        setPreviewSelection({ nodeId })
      } else {
        useStore
          .getState()
          .setNodes(useStore.getState().nodes.map((n) => ({ ...n, selected: n.id === nodeId })))
        useStore
          .getState()
          .setEdges(useStore.getState().edges.map((e) => ({ ...e, selected: false })))
      }
    },
    [activeSnapshotId, snapshots, nodes, setCenter]
  )

  const navigateToEdge = useCallback(
    (edgeId: string) => {
      const sourceEdges =
        activeSnapshotId !== null
          ? snapshots.find((s) => s.id === activeSnapshotId)?.edges || edges
          : edges
      const sourceNodes =
        activeSnapshotId !== null
          ? snapshots.find((s) => s.id === activeSnapshotId)?.nodes || nodes
          : nodes
      const edge = sourceEdges.find((e) => e.id === edgeId)
      if (!edge) return

      const s = sourceNodes.find((n) => n.id === edge.source)
      const t = sourceNodes.find((n) => n.id === edge.target)
      if (s && t) {
        const { w: sw, h: sh } = resolveNodeSize(s)
        const { w: tw, h: th } = resolveNodeSize(t)
        const sx = s.position.x + sw / 2
        const sy = s.position.y + sh / 2
        const tx = t.position.x + tw / 2
        const ty = t.position.y + th / 2
        setCenter((sx + tx) / 2, (sy + ty) / 2, { zoom: 1.05, duration: 420 })
      }

      if (activeSnapshotId !== null) {
        setPreviewSelection({ edgeId })
      } else {
        useStore.getState().setNodes(useStore.getState().nodes.map((n) => ({ ...n, selected: false })))
        useStore
          .getState()
          .setEdges(useStore.getState().edges.map((e) => ({ ...e, selected: e.id === edgeId })))
      }
    },
    [activeSnapshotId, snapshots, edges, nodes, setCenter]
  )

  // Save & Quit IPC hook
  useEffect(() => {
    if (!window.api?.onSaveAndQuit) return
    const off = window.api.onSaveAndQuit(async () => {
      const saved = await handleSave()
      if (saved) {
        window.api.confirmQuit()
      }
    })
    return () => off()
  }, [handleSave])

  const handleNewMap = async () => {
    if (isDirty) {
      const response = await window.api.askSaveNewMap()
      if (response === 2) return // Cancelled

      if (response === 0) {
        const saved = await handleSave()
        if (!saved) return
      }
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    await window.api.clearActiveCampaign?.('Untitled Campaign')
    useStore.getState().resetBlankMap()
    lastSavedSliceRef.current = capturePersistentCampaignSlice(useStore.getState())
    setActiveFilePath(null)
    setIsDirty(false)
    setLastSavedAt(null)
    setSaveStatus('New map')
    setPoliteSaveAnnouncement('Started new blank campaign map')
  }

  const handleLoad = async () => {
    const res = await window.api.loadCampaign()
    if (res?.success && res.data) {
      try {
        const parsed = JSON.parse(res.data)
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
        useStore.getState().loadCampaignState(parsed)
        lastSavedSliceRef.current = capturePersistentCampaignSlice(useStore.getState())
        setActiveFilePath(res.filePath || null)
        setIsDirty(false)
        setLastSavedAt(formatSavedClock())
        setSaveStatus('Loaded')
        setPoliteSaveAnnouncement('Campaign loaded')
        requestAnimationFrame(() => {
          fitView({ padding: 0.16, duration: 350 })
        })
      } catch (e) {
        console.error('Failed to parse campaign file', e)
        setSaveStatus('Invalid file format')
        setPoliteSaveAnnouncement('Invalid campaign file format')
      }
    }
  }

  // Full-Bounds or Viewport PNG Export with Optional Legend & Title Stamp
  const executeExport = async () => {
    setShowShareModal(false)
    const wrapper = document.getElementById('map-export-wrapper') as HTMLElement | null
    if (!wrapper) return

    const previousViewport = getViewport()
    setIsExportingRender(true)

    try {
      if (exportArea === 'full') {
        await fitView({ padding: 0.16, duration: 0 })
      }
      // Allow DOM & Stamp layout to settle
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

      const bgColor =
        canvasTheme === 'arcane'
          ? '#090d1e'
          : canvasTheme === 'parchment'
            ? '#f4ebd9'
            : canvasTheme === 'corkboard'
              ? '#7c5638'
              : isDarkMode
                ? '#0f172a'
                : '#f8fafc'

      const dataUrl = await toPng(wrapper, {
        backgroundColor: bgColor,
        pixelRatio: exportScale,
        filter: (domNode) => {
          if (domNode.nodeType === 3) return true
          if (domNode instanceof HTMLElement && domNode.classList.contains('no-export')) {
            return false
          }
          return true
        }
      })

      if (window.api?.savePng) {
        await window.api.savePng(dataUrl, campaignTitle || 'campaign-map')
      } else {
        const a = document.createElement('a')
        a.setAttribute('download', `${campaignTitle || 'campaign-map'}.png`)
        a.setAttribute('href', dataUrl)
        a.click()
      }
    } catch (err) {
      console.error('Export failed', err)
    } finally {
      if (exportArea === 'full') {
        setViewport(previousViewport, { duration: 0 })
      }
      setIsExportingRender(false)
    }
  }

  // Rapid creation when dragging a connection into empty space
  const handleConnectStart: OnConnectStart = useCallback((_, params) => {
    if (!params.nodeId) return
    connectingFromRef.current = {
      nodeId: params.nodeId,
      handleId: params.handleId,
      isFromTargetHandle: params.handleType === 'target'
    }
  }, [])

  const handleConnectEnd: OnConnectEnd = useCallback(
    (event, connectionState) => {
      const from = connectingFromRef.current
      connectingFromRef.current = null
      if (isReadOnlyCanvas || !from || connectionState.isValid) return

      const targetEl = event.target as HTMLElement | null
      if (!targetEl?.classList.contains('react-flow__pane')) return

      const clientX =
        'changedTouches' in event ? event.changedTouches[0].clientX : event.clientX
      const clientY =
        'changedTouches' in event ? event.changedTouches[0].clientY : event.clientY
      const flowPos = screenToFlowPosition({ x: clientX, y: clientY })

      setContextMenu({
        mode: 'connect-end',
        screenX: clientX,
        screenY: clientY,
        flowX: flowPos.x,
        flowY: flowPos.y,
        sourceNodeId: from.nodeId,
        sourceHandleId: from.handleId,
        isFromTargetHandle: from.isFromTargetHandle
      })
    },
    [isReadOnlyCanvas, screenToFlowPosition]
  )

  // ==================== GRAPH COMPUTATION PIPELINE ====================
  const activeSnapshot = useMemo(
    () => (activeSnapshotId ? snapshots.find((s) => s.id === activeSnapshotId) || null : null),
    [activeSnapshotId, snapshots]
  )

  const diffCompareTarget = useMemo(() => {
    if (diffTargetSnapshotId !== 'live') {
      const targetSnap = snapshots.find(
        (s) => s.id === diffTargetSnapshotId && (!hideSecrets || s.playerVisible !== false)
      )
      if (targetSnap && targetSnap.id !== activeSnapshotId) {
        return {
          nodes: targetSnap.nodes,
          edges: targetSnap.edges,
          label: targetSnap.sessionNumber
            ? `Session ${targetSnap.sessionNumber}: ${targetSnap.title}`
            : targetSnap.title
        }
      }
    }
    return {
      nodes,
      edges,
      label: 'Current Live Map'
    }
  }, [diffTargetSnapshotId, snapshots, hideSecrets, activeSnapshotId, nodes, edges])

  const { baseNodes, baseEdges, diffStats } = useMemo(() => {
    if (!activeSnapshot) {
      return { baseNodes: nodes, baseEdges: edges, diffStats: null }
    }
    if (showSnapshotDiff) {
      const diff = computeSnapshotDiff(
        activeSnapshot,
        diffCompareTarget.nodes,
        diffCompareTarget.edges,
        hideSecrets
      )
      return {
        baseNodes: diff.nodes.map((n) => ({
          ...n,
          selected: previewSelection?.nodeId === n.id
        })),
        baseEdges: diff.edges.map((e) => ({
          ...e,
          selected: previewSelection?.edgeId === e.id
        })),
        diffStats: diff.stats
      }
    }
    return {
      baseNodes: activeSnapshot.nodes.map((n) => ({
        ...n,
        selected: previewSelection?.nodeId === n.id
      })),
      baseEdges: activeSnapshot.edges.map((e) => ({
        ...e,
        selected: previewSelection?.edgeId === e.id
      })),
      diffStats: null
    }
  }, [activeSnapshot, showSnapshotDiff, diffCompareTarget, hideSecrets, nodes, edges, previewSelection])

  const {
    finalEdges,
    renderedNodes,
    selectedNode,
    selectedEdge,
    selectedNodes,
    matchedNodeIds
  } = useMemo(
    () =>
      computeVisibleGraph({
        baseNodes,
        baseEdges,
        hideSecrets,
        visibleTypes,
        visibleEdgeTypes,
        connectionPresets,
        degrees,
        degreeMode,
        searchQuery
      }),
    [
      baseNodes,
      baseEdges,
      hideSecrets,
      visibleTypes,
      visibleEdgeTypes,
      connectionPresets,
      degrees,
      degreeMode,
      searchQuery
    ]
  )

  const selectedDiffEntries = useMemo<FieldDiffEntry[]>(() => {
    if (!activeSnapshot || !showSnapshotDiff) return []
    if (selectedNode && selectedNode.data.diffStatus === 'modified') {
      const before = activeSnapshot.nodes.find((n) => n.id === selectedNode.id)
      const after = diffCompareTarget.nodes.find((n) => n.id === selectedNode.id)
      return computeNodeDiffFields(before, after, hideSecrets)
    }
    if (selectedEdge && selectedEdge.data?.diffStatus === 'modified') {
      const before = activeSnapshot.edges.find((e) => e.id === selectedEdge.id)
      const after = diffCompareTarget.edges.find((e) => e.id === selectedEdge.id)
      return computeEdgeDiffFields(before, after, hideSecrets)
    }
    return []
  }, [activeSnapshot, showSnapshotDiff, selectedNode, selectedEdge, diffCompareTarget, hideSecrets])

  const applyPinnedFilter = useCallback((nextQuery: string) => {
    setSearchMatchIndex(0)
    setSearchQuery(nextQuery)
  }, [])

  const stepSearchMatch = useCallback(
    (delta: 1 | -1) => {
      if (matchedNodeIds.length === 0) return
      const nextIdx = (searchMatchIndex + delta + matchedNodeIds.length) % matchedNodeIds.length
      setSearchMatchIndex(nextIdx)
      navigateToNode(matchedNodeIds[nextIdx])
    },
    [matchedNodeIds, searchMatchIndex, navigateToNode]
  )

  const quickActions = useMemo<QuickCommandAction[]>(() => {
    const actions: QuickCommandAction[] = []
    if (!isReadOnlyCanvas) {
      actions.push({
        id: 'add-entity',
        label: isPlayerEdition ? 'Create New Theory Pin' : 'Create New Entity at Center',
        category: 'Create',
        onRun: handleAddNodeToolbar
      })
      if (selectedNodes.some((n) => n.type !== 'groupRegion' && !n.data?.isGroup)) {
        actions.push({
          id: 'group-selection',
          label: 'Group Selected Entities',
          shortcut: 'Ctrl+G',
          category: 'Group',
          onRun: () => createGroupFromSelection()
        })
        actions.push({
          id: 'group-lock-selection',
          label: 'Group & Lock Selected Entities',
          category: 'Group',
          onRun: () => createGroupFromSelection({ lock: true })
        })
      }
      if (
        selectedNodes.length === 1 &&
        (selectedNodes[0].type === 'groupRegion' || selectedNodes[0].data?.isGroup)
      ) {
        actions.push({
          id: 'ungroup-selected',
          label: `Ungroup "${selectedNodes[0].data.label}" (Keep Entities)`,
          shortcut: 'Ctrl+Shift+G',
          category: 'Group',
          onRun: () => ungroupNodes(selectedNodes[0].id)
        })
      }
      if (
        selectedNodes.length >= 1 &&
        (!isPlayerEdition || selectedNodes.every((n) => Boolean(n.data?.isPlayerCreated)))
      ) {
        const selIds = selectedNodes.map((n) => n.id)
        actions.push(
          {
            id: 'bring-to-front',
            label: 'Bring Selected to Front',
            shortcut: 'Ctrl+]',
            category: 'Arrange',
            onRun: () => reorderNodes(selIds, 'front')
          },
          {
            id: 'bring-forward',
            label: 'Bring Selected Forward',
            shortcut: ']',
            category: 'Arrange',
            onRun: () => reorderNodes(selIds, 'forward')
          },
          {
            id: 'send-backward',
            label: 'Send Selected Backward',
            shortcut: '[',
            category: 'Arrange',
            onRun: () => reorderNodes(selIds, 'backward')
          },
          {
            id: 'send-to-back',
            label: 'Send Selected to Back',
            shortcut: 'Ctrl+[',
            category: 'Arrange',
            onRun: () => reorderNodes(selIds, 'back')
          }
        )
        const selectedEntityCards = selectedNodes.filter(
          (n) => n.type !== 'groupRegion' && !n.data?.isGroup
        )
        if (selectedEntityCards.length >= 2) {
          actions.push({
            id: 'match-selected-widths',
            label: 'Match Selected Card Widths',
            category: 'Arrange',
            onRun: () => matchSelectedEntitySizes(selIds, 'width')
          })
        }
        if (
          selectedEntityCards.some(
            (n) => n.data?.entityWidth !== undefined || n.data?.entityHeight !== undefined
          )
        ) {
          actions.push({
            id: 'reset-card-size',
            label: 'Reset Selected Card Size to Auto',
            category: 'Arrange',
            onRun: () => resetEntitySize(selIds)
          })
        }
      }
      actions.push({
        id: 'toggle-grid-snap',
        label: dragSnapEnabled
          ? `Disable Grid Snap (Currently ${dragSnapSize}px)`
          : `Enable Grid Snap (${dragSnapSize}px)`,
        shortcut: 'G',
        category: 'Arrange',
        onRun: () => toggleDragSnap()
      })
      for (const opt of DRAG_SNAP_OPTIONS) {
        const isCurrent = (dragSnapEnabled ? dragSnapSize : 0) === opt
        actions.push({
          id: `set-drag-snap-${opt}`,
          label: `Set Drag Snap Distance: ${DRAG_SNAP_LABELS[opt].full}${isCurrent ? ' (Active)' : ''}`,
          category: 'Arrange',
          onRun: () => setDragSnapOption(opt)
        })
      }
    }
    actions.push({
      id: 'fit-view',
      label: 'Fit Entire Map in View',
      category: 'Navigation',
      onRun: () => fitView({ padding: 0.16, duration: 350 })
    })
    actions.push({
      id: 'toggle-minimap',
      label: showMiniMap ? 'Hide MiniMap Radar' : 'Show MiniMap Radar',
      shortcut: 'M',
      category: 'Navigation',
      onRun: () => setShowMiniMap((v) => !v)
    })
    if (!isReadOnlyCanvas && !isPlayerEdition) {
      actions.push({
        id: 'save-bookmark',
        label: 'Save Current Camera View as Bookmark',
        category: 'Navigation',
        onRun: () => {
          const wrapper = document.getElementById('map-export-wrapper')
          const rect = wrapper?.getBoundingClientRect()
          const cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
          const cy = rect ? rect.top + rect.height / 2 : window.innerHeight / 2
          const world = screenToFlowPosition({ x: cx, y: cy })
          const st = useStore.getState()
          st.addCameraBookmark({
            label: `Region ${st.cameraBookmarks.length + 1}`,
            centerX: world.x,
            centerY: world.y,
            zoom: getViewport().zoom,
            playerVisible: true
          })
        }
      })
    }
    if (!isPlayerEdition) {
      actions.push({
        id: 'toggle-player-view',
        label: isPlayerView ? 'Switch to Viewing: DM' : 'Switch to Viewing: Player',
        category: 'Tabletop',
        onRun: togglePlayerView
      })
      actions.push({
        id: 'player-screen',
        label: isPlayerScreenOpen
          ? 'Sync Camera to 2nd-Screen Player Window'
          : 'Open 2nd-Screen Player Window',
        category: 'Tabletop',
        onRun: () => {
          if (isPlayerScreenOpen) handleSyncCameraToPlayers()
          else handleOpenPlayerScreen()
        }
      })
    }
    actions.push(
      {
        id: 'save-campaign',
        label: activeFileName ? `Save Campaign (${activeFileName})` : 'Save Campaign',
        shortcut: 'Ctrl+S',
        category: 'File',
        onRun: () => {
          void handleSave()
        }
      },
      {
        id: 'save-campaign-as',
        label: 'Save Campaign As New .json File…',
        shortcut: 'Ctrl+Shift+S',
        category: 'File',
        onRun: () => {
          void handleSaveAs()
        }
      },
      {
        id: 'toggle-auto-save',
        label: autoSaveEnabled
          ? 'Disable Auto-Save (Currently ON)'
          : 'Enable Auto-Save (Currently OFF)',
        category: 'File',
        onRun: handleToggleAutoSave
      }
    )
    actions.push({
      id: 'share-export',
      label: 'Open Share, Sync & Export Dossiers (.json / .md / Obsidian / .pdf)',
      category: 'Export',
      onRun: () => {
        setShareModalTab(undefined)
        setShowShareModal(true)
      }
    })
    actions.push({
      id: 'toggle-dark',
      label: isDarkMode ? 'Switch to Light Studio UI' : 'Switch to Dark Studio UI',
      category: 'Appearance',
      onRun: toggleDarkMode
    })
    actions.push({
      id: 'open-tour',
      label: 'Launch Interactive 5-Step Feature Tour',
      category: 'Help',
      onRun: () => setShowTour(true)
    })
    return actions
  }, [
    isReadOnlyCanvas,
    isPlayerEdition,
    selectedNodes,
    createGroupFromSelection,
    ungroupNodes,
    reorderNodes,
    resetEntitySize,
    matchSelectedEntitySizes,
    handleAddNodeToolbar,
    fitView,
    showMiniMap,
    screenToFlowPosition,
    getViewport,
    isPlayerView,
    togglePlayerView,
    isPlayerScreenOpen,
    handleSyncCameraToPlayers,
    handleOpenPlayerScreen,
    activeFileName,
    handleSave,
    handleSaveAs,
    autoSaveEnabled,
    handleToggleAutoSave,
    isDarkMode,
    toggleDarkMode,
    dragSnapEnabled,
    dragSnapSize,
    toggleDragSnap,
    setDragSnapOption
  ])

  const effectiveSnapToGrid = isAltPressed ? !dragSnapEnabled : dragSnapEnabled
  const harmonizedGap = computeHarmonizedBackgroundGap(canvasTheme, dragSnapEnabled, dragSnapSize)

  const bgConfig =
    canvasTheme === 'arcane'
      ? { variant: BackgroundVariant.Dots, color: '#4f46e5', size: 1.2, gap: harmonizedGap }
      : canvasTheme === 'parchment'
        ? {
            variant: BackgroundVariant.Lines,
            color: 'rgba(120, 88, 42, 0.14)',
            size: 1,
            gap: harmonizedGap
          }
        : canvasTheme === 'corkboard'
          ? {
              variant: BackgroundVariant.Dots,
              color: 'rgba(42, 24, 10, 0.25)',
              size: 1,
              gap: harmonizedGap
            }
          : {
              variant: BackgroundVariant.Dots,
              color: isDarkMode ? '#475569' : '#cbd5e1',
              size: 1.2,
              gap: harmonizedGap
            }

  const showSidebarInspector =
    !isSnapshotPreview &&
    (!isPlayerEdition
      ? !isPlayerView
      : Boolean(
          (selectedNodes.length >= 2 && selectedNodes.every((n) => n.data?.isPlayerCreated)) ||
            (selectedNodes.length === 1 && selectedNode?.data.isPlayerCreated) ||
            (selectedNodes.length === 0 && selectedEdge && selectedEdge.data?.isPlayerCreated)
        ))

  const isUndoDisabled = isReadOnlyCanvas || past.length === 0
  const isRedoDisabled = isReadOnlyCanvas || future.length === 0
  const hasVisibleBookmarks =
    (!isReadOnlyCanvas && !isPlayerEdition) ||
    cameraBookmarks.some((b) => !hideSecrets || b.playerVisible !== false)
  const hasVisibleTimeline =
    Boolean(activeSnapshotId) ||
    (!isPlayerView && !isPlayerEdition) ||
    snapshots.some((s) => s.playerVisible !== false)
  const showBottomStudioBar = hasVisibleBookmarks || hasVisibleTimeline
  const hasInspectorOpen = showSidebarInspector
    ? selectedNodes.length > 0 || Boolean(selectedEdge)
    : (selectedNodes.length === 1 && Boolean(selectedNode)) ||
      (selectedNodes.length === 0 && Boolean(selectedEdge))

  return (
    <div className="w-full h-screen flex relative overflow-hidden bg-slate-50 dark:bg-slate-900">
      <div className="flex-1 min-w-0 h-full flex flex-col relative overflow-hidden">
        <div
          id="map-export-wrapper"
          className={`flex-1 min-h-0 relative canvas-theme-${canvasTheme}`}
        >
        <ReactFlow
          nodes={renderedNodes}
          edges={finalEdges}
          onNodesChange={(changes) => {
            if (isSnapshotPreview) {
              const sel = changes.find((c) => c.type === 'select' && c.selected)
              if (sel && 'id' in sel) setPreviewSelection({ nodeId: sel.id })
              return
            }
            onNodesChange(changes)
          }}
          onEdgesChange={(changes) => {
            if (isSnapshotPreview) {
              const sel = changes.find((c) => c.type === 'select' && c.selected)
              if (sel && 'id' in sel) setPreviewSelection({ edgeId: sel.id })
              return
            }
            onEdgesChange(changes)
          }}
          onNodeDragStart={() => {
            if (!isReadOnlyCanvas) useStore.getState().pushHistory(true)
          }}
          onSelectionDragStart={() => {
            if (!isReadOnlyCanvas) useStore.getState().pushHistory(true)
          }}
          onConnect={onConnect}
          onReconnect={onReconnect}
          onConnectStart={handleConnectStart}
          onConnectEnd={handleConnectEnd}
          onPaneClick={(e) => {
            setContextMenu(null)
            if (isSnapshotPreview) setPreviewSelection(null)
            // Double-click empty canvas in DM View / Player Edition spawns a new node right at cursor
            if (!isReadOnlyCanvas && e.detail === 2) {
              const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
              spawnNodeAt(pos.x, pos.y, true)
            }
          }}
          onSelectionContextMenu={(e, selectionNodes) => {
            if (isReadOnlyCanvas) return
            e.preventDefault()
            const ids = selectionNodes
              .filter((n) => n.type !== 'edgeProxy')
              .map((n) => n.id)
            if (ids.length === 0) return
            if (ids.length === 1) {
              const single = useStore.getState().nodes.find((n) => n.id === ids[0])
              if (single && (single.type === 'groupRegion' || single.data?.isGroup)) {
                const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
                setContextMenu({
                  mode: 'group',
                  screenX: e.clientX,
                  screenY: e.clientY,
                  flowX: flowPos.x,
                  flowY: flowPos.y,
                  groupId: single.id
                })
                return
              }
            }
            setContextMenu({
              mode: 'selection',
              screenX: e.clientX,
              screenY: e.clientY,
              nodeIds: ids
            })
          }}
          onNodeContextMenu={(e, node) => {
            if (isReadOnlyCanvas || node.type === 'edgeProxy') return
            e.preventDefault()
            const st = useStore.getState()
            const currentlySelected = st.nodes.filter((n) => n.selected)
            if (
              currentlySelected.length >= 2 &&
              currentlySelected.some((n) => n.id === node.id)
            ) {
              setContextMenu({
                mode: 'selection',
                screenX: e.clientX,
                screenY: e.clientY,
                nodeIds: currentlySelected.map((n) => n.id)
              })
              return
            }

            if (!node.selected) {
              st.setNodes(st.nodes.map((n) => ({ ...n, selected: n.id === node.id })))
              st.setEdges(st.edges.map((ed) => ({ ...ed, selected: false })))
            }

            const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY })

            if (node.type === 'groupRegion' || node.data?.isGroup) {
              setContextMenu({
                mode: 'group',
                screenX: e.clientX,
                screenY: e.clientY,
                flowX: flowPos.x,
                flowY: flowPos.y,
                groupId: node.id
              })
              return
            }

            setContextMenu({
              mode: 'node',
              screenX: e.clientX,
              screenY: e.clientY,
              flowX: flowPos.x,
              flowY: flowPos.y,
              nodeId: node.id
            })
          }}
          onEdgeContextMenu={(e, edge) => {
            if (isReadOnlyCanvas) return
            e.preventDefault()
            const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
            setContextMenu({
              mode: 'edge',
              screenX: e.clientX,
              screenY: e.clientY,
              flowX: flowPos.x,
              flowY: flowPos.y,
              edgeId: edge.id
            })
          }}
          onPaneContextMenu={(e) => {
            if (isReadOnlyCanvas) return
            e.preventDefault()
            const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
            setContextMenu({
              mode: 'pane',
              screenX: e.clientX,
              screenY: e.clientY,
              flowX: flowPos.x,
              flowY: flowPos.y
            })
          }}
          nodeTypes={memoizedNodeTypes}
          edgeTypes={memoizedEdgeTypes}
          connectionMode={ConnectionMode.Loose}
          elevateNodesOnSelect={false}
          elevateEdgesOnSelect={false}
          edgesReconnectable={false}
          nodesDraggable={!isReadOnlyCanvas}
          nodesConnectable={!isReadOnlyCanvas}
          zoomOnDoubleClick={isReadOnlyCanvas}
          selectionOnDrag={!isReadOnlyCanvas}
          panOnDrag={[1, 2]}
          minZoom={0.05}
          maxZoom={4}
          snapToGrid={effectiveSnapToGrid}
          snapGrid={[dragSnapSize, dragSnapSize]}
          fitView
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{
            type: 'dndEdge'
          }}
        >
          <Background
            variant={bgConfig.variant}
            gap={bgConfig.gap}
            size={bgConfig.size}
            color={bgConfig.color}
          />
          <Controls
            position="bottom-left"
            className="no-export"
            style={{ marginLeft: showMiniMap ? 220 : 16, marginBottom: 16 }}
          />
          {showMiniMap && (
            <MiniMap
              position="bottom-left"
              style={{ width: 196, height: 136, margin: 16 }}
              className="no-export !bg-white/95 dark:!bg-slate-800/95 !border !border-slate-200 dark:!border-slate-700 !rounded-lg !shadow-lg"
              bgColor={
                canvasTheme === 'arcane'
                  ? 'rgba(13, 20, 40, 0.96)'
                  : isDarkMode
                    ? 'rgba(30, 41, 59, 0.96)'
                    : canvasTheme === 'parchment'
                      ? 'rgba(251, 246, 234, 0.96)'
                      : 'rgba(255, 255, 255, 0.96)'
              }
              maskColor={
                canvasTheme === 'arcane'
                  ? 'rgba(4, 7, 18, 0.62)'
                  : isDarkMode
                    ? 'rgba(15, 23, 42, 0.58)'
                    : canvasTheme === 'parchment'
                      ? 'rgba(168, 138, 92, 0.26)'
                      : 'rgba(203, 213, 225, 0.55)'
              }
              maskStrokeColor={
                canvasTheme === 'arcane'
                  ? '#818cf8'
                  : isDarkMode
                    ? '#60a5fa'
                    : canvasTheme === 'parchment'
                      ? '#9c5d16'
                      : '#3b82f6'
              }
              maskStrokeWidth={1.5}
              pannable
              zoomable
              nodeColor={(n) => {
                if (n.type === 'edgeProxy') return 'transparent'
                if (n.type === 'groupRegion' || n.data?.isGroup) {
                  if (!n.data?.hasBackground) return 'transparent'
                  const tint = resolveGroupTint(
                    n.data?.groupColor as any,
                    n.data?.groupCustomColor as string | undefined
                  )
                  return `rgba(${tint.fillRgbLight}, 0.24)`
                }
                const customBg = normalizeHexColor(n.data?.bgColor as string | undefined)
                if (customBg) return customBg
                const et = n.data?.entityType
                if (et === 'PC') return '#2563eb'
                if (et === 'NPC') return '#059669'
                if (et === 'Location') return '#d97706'
                if (et === 'Item') return '#7c3aed'
                if (et === 'Organization') return '#dc2626'
                if (et === 'Event') return '#475569'
                const ct = customEntityTypes.find((c) => c.label === et)
                return ct?.color || '#6366f1'
              }}
            />
          )}
        </ReactFlow>

        {/* Export-Only Overlays (Mounted strictly during PNG capture, matched to canvasTheme!) */}
        {isExportingRender && exportIncludeTitle && campaignTitle.trim() && (
          <div
            className={`absolute top-5 left-5 z-30 px-4 py-2 rounded-lg border-2 pointer-events-none ${
              canvasTheme === 'parchment'
                ? 'bg-[#fbf6ea]/95 border-[#9c7a4c] text-[#2c1d0e] shadow-md'
                : canvasTheme === 'corkboard'
                  ? 'bg-[#fffdf7]/95 border-[#8b6b4a] text-slate-900 shadow-md'
                  : canvasTheme === 'arcane'
                    ? 'bg-[#0f162e]/95 border-indigo-500/50 text-slate-100 shadow-lg'
                    : isDarkMode
                      ? 'bg-slate-900/95 border-slate-700 text-slate-100 shadow-lg'
                      : 'bg-white/95 border-slate-300 text-slate-800 shadow-lg'
            }`}
          >
            <div className="text-sm font-bold">{campaignTitle}</div>
            {activeSnapshot && (
              <div
                className={`text-[11px] font-medium ${
                  canvasTheme === 'parchment'
                    ? 'text-[#6e4f2d]'
                    : canvasTheme === 'corkboard'
                      ? 'text-[#6b5035]'
                      : canvasTheme === 'arcane'
                        ? 'text-indigo-200/80'
                        : isDarkMode
                          ? 'text-slate-400'
                          : 'text-slate-500'
                }`}
              >
                {activeSnapshot.sessionNumber
                  ? `Session ${activeSnapshot.sessionNumber}: ${activeSnapshot.title}`
                  : activeSnapshot.title}
              </div>
            )}
          </div>
        )}

        {isExportingRender && exportIncludeLegend && (
          <div className="absolute bottom-5 left-5 z-30 pointer-events-none">
            <LegendExportStamp />
          </div>
        )}

        {/* Unified Non-Overlapping Top-Left Studio Stack: Header -> Pinned Filter -> Legend */}
        <div
          className={`absolute top-3 left-4 z-10 flex flex-col items-start gap-2 ${
            showMiniMap ? 'max-h-[calc(100%-176px)]' : 'max-h-[calc(100%-148px)]'
          } pointer-events-none no-export max-w-[calc(100%-32px)]`}
        >
          {/* Top Studio Bar */}
          <header className="pointer-events-auto shrink-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur shadow-lg rounded-xl px-2.5 py-1.5 flex flex-wrap items-center gap-1.5 border border-slate-200 dark:border-slate-700 max-w-full">
            <AppLogoIcon size={22} />

            {/* Editable Campaign Title */}
            <input
              type="text"
              value={campaignTitle}
              disabled={isReadOnlyCanvas || isPlayerEdition}
              onChange={(e) => setCampaignTitle(e.target.value)}
              aria-label="Campaign Title"
              placeholder="Campaign Title"
              className="px-2 py-1 rounded text-sm font-bold text-slate-800 dark:text-slate-100 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-700/60 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500 outline-none w-42 truncate disabled:hover:bg-transparent"
            />

            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5" />

            {isPlayerEdition ? (
              <span
                title="Spoiler-Free Player Conspiracy Edition — Add Party Notes & Theory Pins"
                className="inline-flex items-center gap-1 px-2.5 py-1 min-h-6 rounded-md bg-emerald-600/15 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 border border-emerald-500/40 text-xs font-bold select-none"
              >
                <Compass size={13} aria-hidden="true" />
                Player Edition
              </span>
            ) : (
              <>
                <button
                  type="button"
                  aria-pressed={isPlayerView}
                  onClick={togglePlayerView}
                  title={
                    isPlayerView
                      ? 'Viewing Spoiler-Free Player View — click to switch to Viewing: DM'
                      : 'Viewing Full DM View — click to switch to Viewing: Player'
                  }
                  className={`px-2.5 py-1 min-h-6 rounded-md text-xs font-semibold border transition-colors cursor-pointer inline-grid items-center justify-items-center ${
                    isPlayerView
                      ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-transparent hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  <span className="col-start-1 row-start-1">
                    {isPlayerView ? 'Viewing: Player' : 'Viewing: DM'}
                  </span>
                  <span
                    aria-hidden="true"
                    className="col-start-1 row-start-1 invisible pointer-events-none select-none"
                  >
                    Viewing: Player
                  </span>
                </button>

                {/* 2nd-Screen Player Window Pill */}
                {!isPlayerScreenOpen ? (
                  <button
                    type="button"
                    onClick={handleOpenPlayerScreen}
                    title="Open 2nd-Screen Player Window for TV / Projector / VTT"
                    className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <MonitorPlay size={13} aria-hidden="true" />
                    <span>Player Screen</span>
                  </button>
                ) : (
                  <div className="inline-flex items-center rounded-md border border-emerald-500/50 bg-emerald-50/70 dark:bg-emerald-950/40 overflow-hidden text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setIsPlayerSyncPaused((p) => !p)}
                      title={
                        isPlayerSyncPaused
                          ? 'Resume live sync to Player Screen'
                          : 'Pause live sync while rearranging nodes'
                      }
                      className={`px-2 py-1 flex items-center gap-1 transition-colors cursor-pointer ${
                        isPlayerSyncPaused
                          ? 'bg-amber-500/20 text-amber-800 dark:text-amber-200 hover:bg-amber-500/30'
                          : 'text-emerald-800 dark:text-emerald-200 hover:bg-emerald-500/15'
                      }`}
                    >
                      {isPlayerSyncPaused ? (
                        <>
                          <Play size={12} aria-hidden="true" />
                          <span>Paused</span>
                        </>
                      ) : (
                        <>
                          <Pause size={12} aria-hidden="true" />
                          <span>Live</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleSyncCameraToPlayers}
                      title="Pan & zoom Player Screen camera to match your current view"
                      className="px-2 py-1 border-l border-emerald-500/30 text-slate-700 dark:text-slate-200 hover:bg-emerald-500/15 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <LocateFixed size={12} aria-hidden="true" />
                      <span>Sync View</span>
                    </button>
                    {mysterySpotlightNodeId && (
                      <button
                        type="button"
                        onClick={() => handleSpotlightNode(mysterySpotlightNodeId)}
                        title="Reveal full public name & lore for the currently teased Mystery Portrait"
                        className="px-2 py-1 border-l border-emerald-500/30 bg-purple-600 text-white hover:bg-purple-700 flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Eye size={12} aria-hidden="true" />
                        <span>Reveal True Identity</span>
                      </button>
                    )}
                    {hasActiveSpotlight && (
                      <button
                        type="button"
                        onClick={handleClearSpotlight}
                        title="Clear active Spotlight on Player Screen"
                        className="px-2 py-1 border-l border-emerald-500/30 bg-amber-500/25 text-amber-900 dark:text-amber-200 hover:bg-amber-500/35 flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Sparkles size={12} aria-hidden="true" />
                        <span>Clear Spotlight</span>
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label="Close Player Screen window"
                      title="Close 2nd-Screen Player Window"
                      onClick={handleClosePlayerScreen}
                      className="px-1.5 py-1 border-l border-emerald-500/30 text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                    >
                      <X size={13} />
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Undo / Redo (Stationary across DM / Player View for uniform header geometry) */}
            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5" />
            <div className="flex gap-1">
              <button
                type="button"
                aria-disabled={isUndoDisabled}
                onClick={() => {
                  if (!isUndoDisabled) undo()
                }}
                title="Undo (Ctrl+Z)"
                aria-label="Undo"
                className={`p-1.5 min-w-6 min-h-6 bg-slate-100 dark:bg-slate-700 rounded-md transition-colors ${
                  isUndoDisabled
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:bg-slate-200 dark:hover:bg-slate-600 cursor-pointer'
                }`}
              >
                <Undo size={15} className="text-slate-700 dark:text-slate-200" />
              </button>
              <button
                type="button"
                aria-disabled={isRedoDisabled}
                onClick={() => {
                  if (!isRedoDisabled) redo()
                }}
                title="Redo (Ctrl+Y)"
                aria-label="Redo"
                className={`p-1.5 min-w-6 min-h-6 bg-slate-100 dark:bg-slate-700 rounded-md transition-colors ${
                  isRedoDisabled
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:bg-slate-200 dark:hover:bg-slate-600 cursor-pointer'
                }`}
              >
                <Redo size={15} className="text-slate-700 dark:text-slate-200" />
              </button>
            </div>

            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5" />

            {/* Unified Command & Search Palette Trigger */}
            <button
              type="button"
              onClick={() => setShowCommandPalette(true)}
              title="Open Search, #Tags & Studio Command Palette (Ctrl+K / Ctrl+F)"
              className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                searchQuery
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              <Search size={13} aria-hidden="true" />
              <span className="truncate max-w-28">
                {searchQuery ? `Filter: ${searchQuery}` : 'Search / Commands'}
              </span>
              <kbd
                className={`text-[10px] font-bold px-1 py-0.2 rounded ${
                  searchQuery
                    ? 'bg-blue-700/80 text-blue-100'
                    : 'bg-white dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-600'
                }`}
              >
                Ctrl+K
              </kbd>
            </button>

            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5" />

            {/* Canvas Theme Selector + Dark Mode + MiniMap Toggle */}
            <div className="flex items-center gap-1">
              <div className="relative flex items-center">
                <Palette
                  size={13}
                  className="absolute left-2 text-slate-400 pointer-events-none"
                />
                <select
                  aria-label="Canvas Theme"
                  value={canvasTheme}
                  onChange={(e) => setCanvasTheme(e.target.value as CanvasTheme)}
                  className="pl-6 pr-2 py-1 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium outline-none hover:bg-slate-200 dark:hover:bg-slate-600 cursor-pointer"
                >
                  {(Object.keys(THEME_LABELS) as CanvasTheme[]).map((k) => (
                    <option key={k} value={k}>
                      {THEME_LABELS[k]}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={toggleDarkMode}
                className="p-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-md text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                title="Toggle Light / Dark Studio UI"
                aria-label="Toggle Light or Dark Studio UI"
              >
                {isDarkMode ? <Sun size={15} /> : <Moon size={15} />}
              </button>

              <button
                type="button"
                aria-pressed={showMiniMap}
                onClick={() => setShowMiniMap((v) => !v)}
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                  showMiniMap
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200'
                }`}
                title="Toggle MiniMap Radar (M)"
                aria-label="Toggle MiniMap Radar"
              >
                <MapIcon size={15} />
              </button>

              {!isReadOnlyCanvas && (
                <div className="inline-flex items-center rounded-md overflow-hidden border border-slate-200/80 dark:border-slate-600/80 bg-slate-100 dark:bg-slate-700">
                  <button
                    type="button"
                    aria-pressed={dragSnapEnabled}
                    aria-label="Toggle Grid Snap"
                    onClick={() => toggleDragSnap()}
                    title={
                      dragSnapEnabled
                        ? `Grid Snap ON (${dragSnapSize}px) · Click or press G for Free drag · Hold Alt while dragging to bypass`
                        : `Grid Snap OFF (Free 1px) · Click or press G to restore ${dragSnapSize}px snap · Hold Alt while dragging to snap`
                    }
                    className={`p-1.5 min-w-6 min-h-6 flex items-center justify-center transition-colors cursor-pointer ${
                      dragSnapEnabled
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                    }`}
                  >
                    <Grid3x3 size={14} aria-hidden="true" />
                  </button>
                  <select
                    aria-label="Drag Snap Distance"
                    value={dragSnapEnabled ? dragSnapSize : 0}
                    onChange={(e) => setDragSnapOption(Number(e.target.value) as DragSnapOption)}
                    title="Drag jump & snap distance (Hold Alt while dragging to temporarily invert)"
                    className="px-1.5 py-1 min-h-6 border-l border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"
                  >
                    {DRAG_SNAP_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {DRAG_SNAP_LABELS[opt].short}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5" />

            {/* File & Share/Export Actions */}
            <div className="flex items-center gap-1.5">
              <div className="inline-flex items-center rounded-md overflow-hidden border border-slate-200/80 dark:border-slate-600/80 bg-slate-100 dark:bg-slate-700">
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  title={
                    activeFileName
                      ? `Save to ${activeFileName} (Ctrl+S)`
                      : 'Save Campaign to .json File (Ctrl+S)'
                  }
                  className="px-2.5 py-1 min-h-6 hover:bg-slate-200 dark:hover:bg-slate-600 text-xs font-semibold transition-colors text-slate-700 dark:text-slate-200 flex items-center gap-1 cursor-pointer"
                >
                  <Save size={13} aria-hidden="true" />
                  <span>Save</span>
                  {isDirty && (
                    <span
                      aria-hidden="true"
                      className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"
                    />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveAs()}
                  title="Save Campaign As New .json File… (Ctrl+Shift+S)"
                  aria-label="Save Campaign As"
                  className="px-1.5 py-1 min-h-6 border-l border-slate-200 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition-colors flex items-center justify-center cursor-pointer"
                >
                  <SaveAll size={13} aria-hidden="true" />
                </button>
              </div>
              <button
                type="button"
                onClick={handleLoad}
                className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-md text-xs font-semibold transition-colors text-slate-700 dark:text-slate-200 flex items-center gap-1 cursor-pointer"
              >
                <FolderOpen size={13} aria-hidden="true" /> Load
              </button>
              {!isPlayerEdition && (
                <button
                  type="button"
                  aria-disabled={isReadOnlyCanvas}
                  onClick={() => {
                    if (!isReadOnlyCanvas) handleNewMap()
                  }}
                  title={
                    isReadOnlyCanvas
                      ? 'Switch to Viewing: DM to start a new map'
                      : 'Start a new blank campaign map'
                  }
                  className={`px-2.5 py-1 min-h-6 bg-slate-100 dark:bg-slate-700 rounded-md text-xs font-semibold transition-colors text-slate-700 dark:text-slate-200 flex items-center gap-1 ${
                    isReadOnlyCanvas
                      ? 'opacity-40 cursor-not-allowed'
                      : 'hover:bg-slate-200 dark:hover:bg-slate-600 cursor-pointer'
                  }`}
                >
                  <FilePlus2 size={13} aria-hidden="true" /> New
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setShareModalTab(undefined)
                  setShowShareModal(true)
                }}
                title="Export Player .json, Merge Party Notes, Export Dossiers (.md / Obsidian / .pdf) or Map PNG"
                className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-md text-xs font-semibold transition-colors text-slate-700 dark:text-slate-200 flex items-center gap-1 cursor-pointer"
              >
                <Share2 size={13} aria-hidden="true" /> Share &amp; Export
              </button>
              <button
                ref={tourTriggerRef}
                type="button"
                onClick={() => setShowTour((v) => !v)}
                title="Interactive 5-Step Studio Feature Tour"
                aria-expanded={showTour}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer ${
                  showTour
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-700/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60'
                }`}
              >
                <Sparkles size={13} aria-hidden="true" /> Tour
              </button>
              <button
                type="button"
                onClick={() => setShowHelpModal(true)}
                title="Shortcuts & Tips (?)"
                aria-label="Shortcuts and Help"
                className="p-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-md text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              >
                <HelpCircle size={15} />
              </button>

              <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5" />

              {/* Persistent Auto-Save Toggle & Live Save Status */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-pressed={autoSaveEnabled}
                  aria-label="Auto-Save"
                  onClick={handleToggleAutoSave}
                  title={
                    autoSaveEnabled
                      ? activeFileName
                        ? `Auto-Save is ON · Saving automatically to ${activeFileName}${lastSavedAt ? ` (last saved ${lastSavedAt})` : ''} · Click to turn off`
                        : 'Auto-Save is ON · Save once (Ctrl+S) to link a .json file · Click to turn off'
                      : 'Auto-Save is OFF · Click to enable automatic saving'
                  }
                  className="dcc-autosave-toggle px-2 py-0.5 rounded-md text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <span>Auto-Save</span>
                  <span aria-hidden="true" className="dcc-autosave-track">
                    <span className="dcc-autosave-thumb" />
                  </span>
                </button>

                {isDirty && (!autoSaveEnabled || !activeFilePath) && !isSaving ? (
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    title={
                      !activeFilePath && autoSaveEnabled
                        ? 'Local crash backup saved · Click or press Ctrl+S once to pick a .json file for Auto-Save'
                        : 'You have unsaved changes · Click or press Ctrl+S to save now'
                    }
                    className="px-2 py-0.5 min-h-6 rounded-md text-[11px] font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-500/40 whitespace-nowrap cursor-pointer transition-colors"
                  >
                    {!activeFilePath && autoSaveEnabled ? 'Pick file (Ctrl+S)' : 'Unsaved'}
                  </button>
                ) : saveStatus ? (
                  <span
                    title={
                      activeFileName
                        ? `${activeFileName}${lastSavedAt ? ` · Last saved ${lastSavedAt}` : ''}`
                        : undefined
                    }
                    className={`text-[11px] font-medium whitespace-nowrap px-1 ${
                      saveStatus === 'Save failed' || saveStatus === 'Invalid file format'
                        ? 'text-red-600 dark:text-red-400 font-semibold'
                        : saveStatus === 'Unsaved…' || saveStatus === 'Saving…'
                          ? 'text-amber-700 dark:text-amber-300'
                          : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {saveStatus}
                  </span>
                ) : null}

                <span role="status" aria-live="polite" className="sr-only">
                  {politeSaveAnnouncement}
                </span>
              </div>
            </div>
          </header>

          {/* Optional Pinned Search Filter Pill */}
          {searchQuery.trim() && (
            <div className="shrink-0 pointer-events-auto bg-blue-600 text-white shadow-md rounded-lg px-2.5 py-1 flex items-center gap-1.5 text-xs font-semibold">
              <Search size={12} aria-hidden="true" />
              <span className="max-w-44 truncate">Filter: {searchQuery}</span>
              <span className="px-1.5 py-0.2 rounded bg-blue-800/80 text-[10px] font-bold">
                {matchedNodeIds.length > 0
                  ? `${(searchMatchIndex % matchedNodeIds.length) + 1} / ${matchedNodeIds.length}`
                  : '0 nodes'}
              </span>
              {matchedNodeIds.length > 0 && (
                <div className="inline-flex items-center border-l border-blue-400/40 pl-1 gap-0.5">
                  <button
                    type="button"
                    onClick={() => stepSearchMatch(-1)}
                    title="Previous matching entity"
                    aria-label="Previous matching entity"
                    className="p-0.5 rounded hover:bg-blue-500 cursor-pointer"
                  >
                    <ChevronUp size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => stepSearchMatch(1)}
                    title="Next matching entity"
                    aria-label="Next matching entity"
                    className="p-0.5 rounded hover:bg-blue-500 cursor-pointer"
                  >
                    <ChevronDown size={13} />
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => applyPinnedFilter('')}
                title="Clear canvas filter (Esc)"
                aria-label="Clear canvas filter"
                className="p-0.5 rounded hover:bg-blue-500 ml-0.5 cursor-pointer"
              >
                <X size={13} />
              </button>
            </div>
          )}

          {/* Collapsible Legend & Filters */}
          <div className="pointer-events-auto min-h-0 flex flex-col">
            <Legend />
          </div>
        </div>

        {/* Bottom-Left Focus Web — Docked Immediately Right of Zoom Controls */}
        {selectedNodes.length === 1 && selectedNode && (
          <div
            style={{ left: showMiniMap ? 258 : 54, bottom: 16 }}
            className="no-export absolute z-10 bg-white/95 dark:bg-slate-800/95 backdrop-blur shadow-lg rounded-lg px-3 py-2.5 border border-slate-200 dark:border-slate-700 w-60 flex flex-col gap-2 pointer-events-auto"
          >
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-1.5">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-200">
                Focus Web
              </h3>
              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded truncate max-w-28">
                {selectedNode.data.label}
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Degrees of Separation
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={degrees}
                  onChange={(e) =>
                    setDegrees(e.target.value === '' ? '' : parseInt(e.target.value, 10))
                  }
                  className="border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-slate-200 rounded px-2 py-1 text-xs w-16 outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="All"
                />
                <div className="flex rounded border border-slate-300 dark:border-slate-600 overflow-hidden text-[11px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setDegreeMode('fade')}
                    className={`px-2 py-1 cursor-pointer ${
                      degreeMode === 'fade'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    Fade
                  </button>
                  <button
                    type="button"
                    onClick={() => setDegreeMode('hide')}
                    className={`px-2 py-1 cursor-pointer ${
                      degreeMode === 'hide'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    Hide
                  </button>
                </div>
                {degrees !== '' && (
                  <button
                    type="button"
                    onClick={() => setDegrees('')}
                    className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Right-Click & Drag-to-Create Context Menu */}
        <ContextMenu
          menu={contextMenu}
          onClose={() => setContextMenu(null)}
          onRequestDeleteNode={(id) => setPendingDeleteNodeId(id)}
          onRequestDeleteEdge={(id) => setPendingDeleteEdgeId(id)}
          onRequestDeleteGroupWithContents={(gId) => setPendingDeleteGroupId(gId)}
          onRequestBatchDeleteNodes={(ids) => setPendingDeleteSelectionIds(ids)}
          onSelectNode={navigateToNode}
          onSpotlightNode={!isPlayerEdition ? handleSpotlightNode : undefined}
          onMysterySpotlightNode={!isPlayerEdition ? handleMysterySpotlightNode : undefined}
          onSpotlightEdge={!isPlayerEdition ? handleSpotlightEdge : undefined}
          onFocusDegrees={(nodeId, deg) => {
            useStore
              .getState()
              .setNodes(useStore.getState().nodes.map((n) => ({ ...n, selected: n.id === nodeId })))
            useStore
              .getState()
              .setEdges(useStore.getState().edges.map((e) => ({ ...e, selected: false })))
            setDegrees(deg)
          }}
          activeFocusDegrees={degrees}
          onFitView={() => fitView({ padding: 0.16, duration: 350 })}
        />
        </div>

        {/* Dedicated Very-Bottom Studio Bar: Campaign Timeline (Left) + Views / BookmarksBar (Right) */}
        {showBottomStudioBar && (
          <footer
            aria-label="Campaign Timeline and Views"
            style={{
              paddingRight: hasInspectorOpen
                ? showSidebarInspector
                  ? '22.75rem'
                  : '21.75rem'
                : undefined
            }}
            className="no-export shrink-0 z-20 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 px-3 py-1.5 flex items-center gap-3 min-w-0 motion-safe:transition-[padding-right] motion-safe:duration-150"
          >
            <TimelineBar diffStats={diffStats} />
            <BookmarksBar
              readOnly={isReadOnlyCanvas || isPlayerEdition}
              isPlayerScreenOpen={isPlayerScreenOpen}
              onSyncBookmarkToPlayerScreen={
                !isPlayerEdition ? handleSyncBookmarkToPlayers : undefined
              }
            />
          </footer>
        )}
      </div>

      {/* Right-Hand Inspector Routing:
          - Snapshot Preview or DM's Player View: Read-Only PlayerInspector
          - Player Edition on canonical DM items: PlayerInspector with editable Party Notes
          - Player Edition on Theory Pins/Links OR DM Live View (incl. Multi-Select!): Sidebar */}
      {showSidebarInspector ? (
        <Sidebar
          className="no-export"
          onNavigateToNode={navigateToNode}
          onSpotlightNode={!isPlayerEdition ? handleSpotlightNode : undefined}
          onMysterySpotlightNode={!isPlayerEdition ? handleMysterySpotlightNode : undefined}
          onSpotlightEdge={!isPlayerEdition ? handleSpotlightEdge : undefined}
          onFilterByTag={(tag) => applyPinnedFilter(`#${tag}`)}
          onRequestDeleteGroupWithContents={(gId) => setPendingDeleteGroupId(gId)}
        />
      ) : (
        <PlayerInspector
          selectedNode={selectedNodes.length === 1 ? selectedNode : undefined}
          selectedEdge={selectedNodes.length === 0 ? selectedEdge : undefined}
          allNodes={baseNodes}
          allEdges={baseEdges}
          isPlayerView={hideSecrets}
          isSnapshotPreview={isSnapshotPreview}
          diffEntries={selectedDiffEntries}
          diffCompareLabel={diffCompareTarget.label}
          editablePartyNotes={isPlayerEdition && !isSnapshotPreview}
          onCommitPartyNotesStart={() => useStore.getState().pushHistory(false)}
          onUpdateNodePartyNotes={(id, partyNotes) => updateNodeData(id, { partyNotes })}
          onUpdateEdgePartyNotes={(id, partyNotes) => updateEdgeData(id, { partyNotes })}
          onFilterByTag={(tag) => applyPinnedFilter(`#${tag}`)}
          onSelectEdge={navigateToEdge}
          onNavigateToNode={navigateToNode}
          onClose={() => {
            if (isSnapshotPreview) {
              setPreviewSelection(null)
            } else {
              if (selectedNode) {
                onNodesChange([{ id: selectedNode.id, type: 'select', selected: false }])
              }
              if (selectedEdge) {
                onEdgesChange([{ id: selectedEdge.id, type: 'select', selected: false }])
              }
            }
          }}
        />
      )}

      {/* Unified Command & Search Palette (Ctrl+K / Ctrl+F) */}
      <CommandPaletteModal
        open={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        nodes={baseNodes}
        edges={baseEdges}
        bookmarks={cameraBookmarks}
        hideSecrets={hideSecrets}
        pinnedCanvasQuery={searchQuery}
        onPinCanvasQuery={applyPinnedFilter}
        onSelectNode={navigateToNode}
        onSelectEdge={navigateToEdge}
        onJumpBookmark={(bm) =>
          setCenter(bm.centerX, bm.centerY, { zoom: bm.zoom, duration: 480 })
        }
        quickActions={quickActions}
      />

      {/* Unified Share, Sync & Export Modal */}
      <ShareExportModal
        open={showShareModal}
        onClose={() => setShowShareModal(false)}
        initialTab={shareModalTab}
        exportScale={exportScale}
        setExportScale={setExportScale}
        exportArea={exportArea}
        setExportArea={setExportArea}
        exportIncludeLegend={exportIncludeLegend}
        setExportIncludeLegend={setExportIncludeLegend}
        exportIncludeTitle={exportIncludeTitle}
        setExportIncludeTitle={setExportIncludeTitle}
        isExportingPng={isExportingRender}
        onTriggerExportPng={executeExport}
      />

      {/* Shortcuts & Quick-Tips Modal */}
      <NativeModal
        open={showHelpModal}
        onClose={() => setShowHelpModal(false)}
        title="Studio Shortcuts & Tips"
      >
        <div className="flex flex-col gap-3 text-xs text-slate-700 dark:text-slate-300">
          <div className="flex flex-wrap items-center justify-between gap-2.5 px-3 py-2 rounded-lg bg-slate-900 text-slate-100 border border-slate-700">
            <div className="flex items-center gap-2.5">
              <AppLogoIcon size={28} />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold tracking-tight">Dice Chaos Connections</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    v1.0.0
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">
                  TTRPG Campaign Mind-Map, Conspiracy Board &amp; Live Player Table
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <a
                href="https://dicechaos.com"
                target="_blank"
                rel="noreferrer"
                className="text-amber-300 hover:text-amber-200 underline underline-offset-2 font-semibold"
              >
                dicechaos.com
              </a>
              <span className="text-slate-600" aria-hidden="true">
                •
              </span>
              <a
                href="https://github.com/dicechaos/DiceChaosDisplay"
                target="_blank"
                rel="noreferrer"
                className="text-emerald-300 hover:text-emerald-200 underline underline-offset-2"
              >
                Dice Chaos Display
              </a>
              <span className="text-slate-600" aria-hidden="true">
                •
              </span>
              <a
                href="https://github.com/dicechaos/DiceChaosMasters"
                target="_blank"
                rel="noreferrer"
                className="text-violet-300 hover:text-violet-200 underline underline-offset-2"
              >
                Dice Chaos Masters
              </a>
              <span className="text-slate-600" aria-hidden="true">
                •
              </span>
              <a
                href="https://github.com/dicechaos/DiceChaosConnections/issues"
                target="_blank"
                rel="noreferrer"
                className="text-slate-300 hover:text-white underline underline-offset-2"
              >
                Report Bug
              </a>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-900/70 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
            <div>
              <strong className="text-slate-900 dark:text-white">Ctrl+K / Ctrl+F</strong>
              <p className="text-slate-500 dark:text-slate-400">
                Search entities, #tags, aliases &amp; studio commands
              </p>
            </div>
            <div>
              <strong className="text-slate-900 dark:text-white">Alt+1 .. Alt+9</strong>
              <p className="text-slate-500 dark:text-slate-400">
                Fly camera to saved region bookmarks
              </p>
            </div>
            <div>
              <strong className="text-slate-900 dark:text-white">Drag-Select / Right-Click Group</strong>
              <p className="text-slate-500 dark:text-slate-400">
                Ctrl+G group, lock, add backdrop, align &amp; batch edit
              </p>
            </div>
            <div>
              <strong className="text-slate-900 dark:text-white">Type [[ in Notes</strong>
              <p className="text-slate-500 dark:text-slate-400">
                Link entities, [[Aliases]] &amp; [[Target|Text]]
              </p>
            </div>
            <div>
              <strong className="text-slate-900 dark:text-white">Double-Click / Drag Line</strong>
              <p className="text-slate-500 dark:text-slate-400">
                {isPlayerEdition ? 'Create & link Theory Pins' : 'Spawn & link entities in 1 step'}
              </p>
            </div>
            <div>
              <strong className="text-slate-900 dark:text-white">[ / ] • Ctrl+[ / Ctrl+]</strong>
              <p className="text-slate-500 dark:text-slate-400">
                Step backward / forward • Send to back / Bring to front
              </p>
            </div>
            <div>
              <strong className="text-slate-900 dark:text-white">G • Hold Alt + Drag</strong>
              <p className="text-slate-500 dark:text-slate-400">
                Toggle grid snap (Free–48px in top bar) • Smooth override mid-drag
              </p>
            </div>
            <div>
              <strong className="text-slate-900 dark:text-white">Edit / Add Connection Points</strong>
              <p className="text-slate-500 dark:text-slate-400">
                Right-click any point to style or move • Alt+Drag to slide • Drag selected line ends
              </p>
            </div>
            <div>
              <strong className="text-slate-900 dark:text-white">M / Ctrl+Z / Ctrl+Y</strong>
              <p className="text-slate-500 dark:text-slate-400">
                Toggle MiniMap radar • Undo / Redo (50 steps)
              </p>
            </div>
            <div>
              <strong className="text-slate-900 dark:text-white">Ctrl+S / Ctrl+Shift+S</strong>
              <p className="text-slate-500 dark:text-slate-400">
                Save active file • Save As copy (toggle Auto-Save in top bar)
              </p>
            </div>
          </div>

          {!isPlayerView && !isPlayerEdition && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <span className="text-slate-500 dark:text-slate-400">
                Explore The Hobbit: Eve of Five Armies starter map or launch the guided tour:
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowHelpModal(false)
                    setShowTour(true)
                  }}
                  className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles size={12} /> Interactive Tour
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowHelpModal(false)
                    setShowLoadDemoConfirm(true)
                  }}
                  className="px-2.5 py-1 rounded bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  Load Starter Demo
                </button>
              </div>
            </div>
          )}
        </div>
      </NativeModal>

      {/* Non-Blocking Opt-In Interactive Feature Tour (Top-Layer Popover) */}
      <FeatureTourCard
        open={showTour}
        onClose={() => setShowTour(false)}
        triggerRef={tourTriggerRef}
        hasInspectorOpen={hasInspectorOpen}
        isHobbitStarter={nodes.some((n) => n.id === 'node-bilbo')}
        isPlayerEdition={isPlayerEdition}
        isPlayerView={isPlayerView}
        isSnapshotDiffActive={activeSnapshotId !== null && showSnapshotDiff}
        isFocusDemoActive={degrees !== ''}
        onToggleSpoilerShield={() => {
          if (activeSnapshotId !== null) {
            useStore.getState().setActiveSnapshot(null)
          }
          setDegrees('')
          togglePlayerView()
          requestAnimationFrame(() => fitView({ padding: 0.14, duration: 420 }))
        }}
        onToggleTimelineDiff={() => {
          const st = useStore.getState()
          if (st.activeSnapshotId !== null) {
            st.setActiveSnapshot(null)
            requestAnimationFrame(() => fitView({ padding: 0.14, duration: 420 }))
            return
          }
          const targetSnap =
            st.snapshots.find((s) => s.id === 'snap-session-3') ||
            st.snapshots[Math.max(0, st.snapshots.length - 2)] ||
            st.snapshots[0]
          if (!targetSnap) return
          st.setActiveSnapshot(targetSnap.id)
          if (!st.showSnapshotDiff) {
            st.toggleSnapshotDiff()
          }
          requestAnimationFrame(() => fitView({ padding: 0.14, duration: 420 }))
        }}
        onInspectSpotlightEntity={() => {
          const st = useStore.getState()
          if (st.activeSnapshotId !== null) {
            st.setActiveSnapshot(null)
          }
          if (st.isPlayerView) {
            st.togglePlayerView()
          }
          setDegrees('')
          const targetNode = st.nodes.find((n) => n.id === 'node-bilbo') || st.nodes[0]
          if (!targetNode) return
          requestAnimationFrame(() => {
            const w = targetNode.measured?.width || 210
            const h = targetNode.measured?.height || 85
            setCenter(targetNode.position.x + w / 2, targetNode.position.y + h / 2, {
              zoom: 1.12,
              duration: 450
            })
            useStore
              .getState()
              .setNodes(
                useStore.getState().nodes.map((n) => ({ ...n, selected: n.id === targetNode.id }))
              )
            useStore
              .getState()
              .setEdges(useStore.getState().edges.map((e) => ({ ...e, selected: false })))
          })
        }}
        onToggleFocusWeb={() => {
          const st = useStore.getState()
          if (degrees !== '') {
            setDegrees('')
            st.setNodes(st.nodes.map((n) => ({ ...n, selected: false })))
            requestAnimationFrame(() => fitView({ padding: 0.14, duration: 420 }))
            return
          }
          if (st.activeSnapshotId !== null) {
            st.setActiveSnapshot(null)
          }
          const targetNode =
            st.nodes.find((n) => n.id === 'node-arkenstone' && !n.data?.isHidden) ||
            st.nodes.find((n) => !n.data?.isHidden) ||
            st.nodes[0]
          if (!targetNode) return
          st.setNodes(st.nodes.map((n) => ({ ...n, selected: n.id === targetNode.id })))
          st.setEdges(st.edges.map((e) => ({ ...e, selected: false })))
          setDegreeMode('fade')
          setDegrees(2)
          requestAnimationFrame(() => {
            const w = targetNode.measured?.width || 210
            const h = targetNode.measured?.height || 85
            setCenter(targetNode.position.x + w / 2, targetNode.position.y + h / 2, {
              zoom: 0.72,
              duration: 450
            })
          })
        }}
        onOpenShareDossiers={() => {
          setShareModalTab('dossier')
          setShowShareModal(true)
        }}
        onOpenPlayerScreen={handleOpenPlayerScreen}
        onRequestLoadStarterDemo={() => setShowLoadDemoConfirm(true)}
      />

      {/* Spoiler Guard Confirmation before Spotlighting Hidden Items */}
      <ConfirmModal
        open={pendingSpotlightReveal !== null}
        title={pendingSpotlightReveal?.title || 'Reveal & Spotlight?'}
        message={pendingSpotlightReveal?.message || ''}
        confirmLabel="Unhide & Spotlight"
        destructive={false}
        onConfirm={() => {
          if (!pendingSpotlightReveal) return
          const { targetType, id, unhideNodeIds, unhideEdgeIds } = pendingSpotlightReveal
          useStore.getState().pushHistory(true)
          unhideNodeIds.forEach((nId) => updateNodeData(nId, { isHidden: false }))
          unhideEdgeIds.forEach((eId) => updateEdgeData(eId, { isHidden: false }))
          setPendingSpotlightReveal(null)
          requestAnimationFrame(() => {
            executeSpotlight(targetType, id)
          })
        }}
        onCancel={() => setPendingSpotlightReveal(null)}
      />

      {/* Context Menu Delete Confirmations */}
      <ConfirmModal
        open={pendingDeleteNodeId !== null}
        title="Delete Entity?"
        message="Are you sure you want to delete this entity and its attached connections?"
        confirmLabel="Delete Entity"
        onConfirm={() => {
          if (pendingDeleteNodeId) deleteNode(pendingDeleteNodeId)
        }}
        onCancel={() => setPendingDeleteNodeId(null)}
      />

      <ConfirmModal
        open={pendingDeleteEdgeId !== null}
        title="Delete Connection?"
        message="Are you sure you want to delete this connection?"
        confirmLabel="Delete Connection"
        onConfirm={() => {
          if (pendingDeleteEdgeId) deleteEdge(pendingDeleteEdgeId)
        }}
        onCancel={() => setPendingDeleteEdgeId(null)}
      />

      <ConfirmModal
        open={pendingDeleteGroupId !== null}
        title="Delete Group & Contents?"
        message="This will delete both the group region frame and every entity inside it (plus their connections). Use 'Ungroup (Keep Entities)' instead if you only want to remove the frame."
        confirmLabel="Delete Group & Contents"
        onConfirm={() => {
          if (pendingDeleteGroupId) deleteGroupWithContents(pendingDeleteGroupId)
          setPendingDeleteGroupId(null)
        }}
        onCancel={() => setPendingDeleteGroupId(null)}
      />

      <ConfirmModal
        open={pendingDeleteSelectionIds !== null}
        title="Delete Selected Items?"
        message={`Are you sure you want to delete all ${pendingDeleteSelectionIds?.length || 0} selected items and their connections?`}
        confirmLabel="Delete Selected"
        onConfirm={() => {
          if (pendingDeleteSelectionIds) batchDeleteNodes(pendingDeleteSelectionIds)
          setPendingDeleteSelectionIds(null)
        }}
        onCancel={() => setPendingDeleteSelectionIds(null)}
      />

      <ConfirmModal
        open={showLoadDemoConfirm}
        title="Load The Hobbit Starter Demo?"
        message="This will replace the current unsaved workspace with the 36-node The Hobbit: Eve of Five Armies starter campaign (including custom Army / Host categories, saved camera views, aliases, #tags, embedded art, and 4 session timeline checkpoints)."
        confirmLabel="Load Demo"
        destructive={false}
        onConfirm={async () => {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
            timeoutRef.current = null
          }
          await window.api.clearActiveCampaign?.(STARTER_CAMPAIGN_TITLE)
          useStore.getState().loadStarterDemo()
          lastSavedSliceRef.current = capturePersistentCampaignSlice(useStore.getState())
          setActiveFilePath(null)
          setIsDirty(false)
          setLastSavedAt(null)
          setSaveStatus('Starter loaded')
          setPoliteSaveAnnouncement('Loaded The Hobbit starter campaign')
          setShowLoadDemoConfirm(false)
          requestAnimationFrame(() => fitView({ padding: 0.16, duration: 350 }))
        }}
        onCancel={() => setShowLoadDemoConfirm(false)}
      />
    </div>
  )
}

export default function App() {
  return (
    <ReactFlowProvider>
      <FlowCanvas />
    </ReactFlowProvider>
  )
}
