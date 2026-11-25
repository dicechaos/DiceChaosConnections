import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  Position
} from '@xyflow/react'
import { useStore } from '../store/useStore'
import {
  CanvasTheme,
  FieldDiffEntry,
  PlayerWindowCommand,
  PlayerWindowStatePayload
} from '../types'
import EntityNode from './nodes/EntityNode'
import GroupNode, { resolveGroupTint } from './nodes/GroupNode'
import CustomEdge from './edges/CustomEdge'
import Legend from './Legend'
import PlayerInspector from './PlayerInspector'
import TimelineBar, { SessionTimelineTray } from './TimelineBar'
import BookmarksBar from './BookmarksBar'
import CommandPaletteModal, { QuickCommandAction } from './CommandPaletteModal'
import SpotlightOverlay from './SpotlightOverlay'
import { AppLogoIcon } from './AppLogoIcon'
import {
  computeEdgeDiffFields,
  computeNodeDiffFields,
  computeSnapshotDiff
} from '../utils/campaignSerializer'
import { OTHER_EDGE_FILTER_KEY } from '../utils/edgeFilters'
import { normalizeHexColor } from '../utils/colorUtils'
import { computeVisibleGraph, resolveNodeSize } from '../utils/graphPipeline'
import {
  Search,
  X,
  Moon,
  Sun,
  Palette,
  Maximize2,
  Minimize2,
  LocateFixed,
  Sparkles,
  MonitorPlay,
  Map as MapIcon,
  ChevronUp,
  ChevronDown
} from 'lucide-react'

function EdgeProxyNode({ data }: { data: any }) {
  const isVisible = !!data?.selected
  const opacityClass = isVisible ? 'opacity-100' : 'opacity-0'
  return (
    <div className="w-full h-full pointer-events-none relative">
      <Handle
        type="target"
        position={Position.Left}
        id="target"
        className={`!w-2 !h-2 !bg-blue-500 !border-white pointer-events-none ${opacityClass}`}
        style={{ left: -10 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="source"
        className={`!w-2 !h-2 !bg-blue-500 !border-white pointer-events-none ${opacityClass}`}
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

function PlayerScreenCanvas() {
  const { fitView, setCenter } = useReactFlow()
  const {
    campaignTitle,
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
    visibleTypes,
    visibleEdgeTypes,
    connectionPresets,
    customEntityTypes,
    isDarkMode,
    setDarkModeFromSystem,
    toggleDarkMode
  } = useStore()

  const [hasReceivedSync, setHasReceivedSync] = useState(false)
  const [degrees, setDegrees] = useState<number | ''>('')
  const [degreeMode, setDegreeMode] = useState<'fade' | 'hide'>('fade')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchMatchIndex, setSearchMatchIndex] = useState(0)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [showMiniMap, setShowMiniMap] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [timelineExpanded, setTimelineExpanded] = useState(false)
  const [previewSelection, setPreviewSelection] = useState<{
    nodeId?: string
    edgeId?: string
  } | null>(null)

  const [spotlightTarget, setSpotlightTarget] = useState<{
    targetType: 'node' | 'edge'
    id: string
  } | null>(null)
  const [mysterySpotlight, setMysterySpotlight] = useState<{
    portrait: string
    subtitle?: string
  } | null>(null)
  const [showSpotlightCard, setShowSpotlightCard] = useState(false)

  const hasFittedInitialRef = useRef(false)
  const localThemeOverrideRef = useRef(false)

  const isSnapshotPreview = activeSnapshotId !== null

  // Immediately wipe any starter DM state before first paint/sync
  useEffect(() => {
    useStore.setState({
      past: [],
      future: [],
      campaignEdition: 'player',
      isPlayerView: true,
      campaignTitle: 'Waiting for DM Screen...',
      nodes: [],
      edges: [],
      snapshots: [],
      cameraBookmarks: [],
      activeSnapshotId: null,
      showSnapshotDiff: false,
      diffTargetSnapshotId: 'live'
    })
  }, [])

  // Reset snapshot preview selection when switching checkpoints
  useEffect(() => {
    setPreviewSelection(null)
  }, [activeSnapshotId])

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

  // Follow system color-scheme if not manually pinned
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const onSystemChange = (e: MediaQueryListEvent) => {
      try {
        const override = localStorage.getItem('color-scheme')
        if (!override) setDarkModeFromSystem(e.matches)
      } catch {
        setDarkModeFromSystem(e.matches)
      }
    }
    mql.addEventListener('change', onSystemChange)
    return () => mql.removeEventListener('change', onSystemChange)
  }, [setDarkModeFromSystem])

  const centerOnSpotlight = useCallback(
    (targetType: 'node' | 'edge', id: string) => {
      const st = useStore.getState()
      if (targetType === 'node') {
        const target = st.nodes.find((n) => n.id === id)
        if (!target) return
        const { w, h } = resolveNodeSize(target)
        const isGroup = target.type === 'groupRegion' || Boolean(target.data?.isGroup)
        setCenter(target.position.x + w / 2, target.position.y + h / 2, {
          zoom: isGroup ? 0.92 : 1.2,
          duration: 480
        })
      } else {
        const edge = st.edges.find((e) => e.id === id)
        if (!edge) return
        const s = st.nodes.find((n) => n.id === edge.source)
        const t = st.nodes.find((n) => n.id === edge.target)
        if (s && t) {
          const { w: sw, h: sh } = resolveNodeSize(s)
          const { w: tw, h: th } = resolveNodeSize(t)
          const sx = s.position.x + sw / 2
          const sy = s.position.y + sh / 2
          const tx = t.position.x + tw / 2
          const ty = t.position.y + th / 2
          setCenter((sx + tx) / 2, (sy + ty) / 2, {
            zoom: 1.12,
            duration: 480
          })
        }
      }
    },
    [setCenter]
  )

  // Subscribe to sanitized DM state & camera/spotlight commands, then signal mounted
  useEffect(() => {
    if (!window.api?.onPlayerWindowState) return

    const offState = window.api.onPlayerWindowState((payload: PlayerWindowStatePayload) => {
      if (!payload) return
      useStore.setState((prev) => {
        const selectedNodeIds = new Set(prev.nodes.filter((n) => n.selected).map((n) => n.id))
        const selectedEdgeIds = new Set(prev.edges.filter((e) => e.selected).map((e) => e.id))

        const nextVisibleTypes = { ...prev.visibleTypes }
        ;(payload.customEntityTypes || []).forEach((ct) => {
          if (nextVisibleTypes[ct.label] === undefined) {
            nextVisibleTypes[ct.label] = true
          }
        })

        const nextVisibleEdges: Record<string, boolean> = {
          [OTHER_EDGE_FILTER_KEY]: prev.visibleEdgeTypes[OTHER_EDGE_FILTER_KEY] ?? true,
          ...prev.visibleEdgeTypes
        }
        ;(payload.connectionPresets || []).forEach((p) => {
          if (nextVisibleEdges[p.label] === undefined) {
            nextVisibleEdges[p.label] = true
          }
        })

        const keepSnapshotId =
          prev.activeSnapshotId &&
          (payload.snapshots || []).some((s) => s.id === prev.activeSnapshotId)
            ? prev.activeSnapshotId
            : null

        return {
          campaignEdition: 'player',
          isPlayerView: true,
          campaignTitle: payload.campaignTitle || 'Campaign Map',
          canvasTheme: localThemeOverrideRef.current ? prev.canvasTheme : payload.canvasTheme,
          nodes: (payload.nodes || []).map((n) => ({
            ...n,
            selected: selectedNodeIds.has(n.id)
          })),
          edges: (payload.edges || []).map((e) => ({
            ...e,
            selected: selectedEdgeIds.has(e.id)
          })),
          connectionPresets: payload.connectionPresets || [],
          customEntityTypes: payload.customEntityTypes || [],
          snapshots: payload.snapshots || [],
          cameraBookmarks: payload.cameraBookmarks || [],
          activeSnapshotId: keepSnapshotId,
          visibleTypes: nextVisibleTypes,
          visibleEdgeTypes: nextVisibleEdges
        }
      })

      setHasReceivedSync(true)
      if (!hasFittedInitialRef.current && (payload.nodes?.length || 0) > 0) {
        hasFittedInitialRef.current = true
        requestAnimationFrame(() => {
          fitView({ padding: 0.16, duration: 350 })
        })
      }
    })

    const offCommand = window.api.onPlayerWindowCommand((cmd: PlayerWindowCommand) => {
      if (!cmd) return
      if (cmd.type === 'syncCenter') {
        useStore.getState().setActiveSnapshot(null)
        setCenter(cmd.centerX, cmd.centerY, { zoom: cmd.zoom, duration: 450 })
      } else if (cmd.type === 'spotlight') {
        useStore.getState().setActiveSnapshot(null)
        setMysterySpotlight(null)
        setSpotlightTarget({ targetType: cmd.targetType, id: cmd.id })
        setShowSpotlightCard(true)
        requestAnimationFrame(() => {
          centerOnSpotlight(cmd.targetType, cmd.id)
        })
      } else if (cmd.type === 'mysteryPortrait') {
        useStore.getState().setActiveSnapshot(null)
        setSpotlightTarget(null)
        setMysterySpotlight({ portrait: cmd.portrait, subtitle: cmd.subtitle })
        setShowSpotlightCard(true)
      } else if (cmd.type === 'clearSpotlight') {
        setSpotlightTarget(null)
        setMysterySpotlight(null)
        setShowSpotlightCard(false)
      }
    })

    window.api.notifyPlayerWindowMounted?.()

    return () => {
      offState()
      offCommand()
    }
  }, [fitView, setCenter, centerOnSpotlight])

  // Keyboard shortcuts on Player Screen (Ctrl+K/Ctrl+F search, M MiniMap, F11 fullscreen, Esc exit)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'

      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key.toLowerCase() === 'k' || e.key.toLowerCase() === 'f')
      ) {
        e.preventDefault()
        setShowCommandPalette(true)
        return
      }
      if (e.key === 'F11') {
        e.preventDefault()
        window.api.toggleWindowFullscreen?.().then((r) => setIsFullscreen(Boolean(r?.isFullScreen)))
        return
      }
      if (isTyping) return

      if (e.key.toLowerCase() === 'm' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setShowMiniMap((v) => !v)
      } else if (e.key === 'Escape' && !showCommandPalette && !showSpotlightCard) {
        if (isSnapshotPreview) {
          useStore.getState().setActiveSnapshot(null)
        } else if (searchQuery) {
          setSearchQuery('')
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isSnapshotPreview, showSpotlightCard, showCommandPalette, searchQuery])

  const navigateToNode = useCallback(
    (nodeId: string) => {
      const sourceList =
        activeSnapshotId !== null
          ? snapshots.find((s) => s.id === activeSnapshotId)?.nodes || nodes
          : nodes
      const target = sourceList.find((n) => n.id === nodeId)
      if (!target) return

      const w = target.measured?.width || 210
      const h = target.measured?.height || 64
      setCenter(target.position.x + w / 2, target.position.y + h / 2, {
        zoom: 1.15,
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
        const sx = s.position.x + (s.measured?.width || 205) / 2
        const sy = s.position.y + (s.measured?.height || 60) / 2
        const tx = t.position.x + (t.measured?.width || 205) / 2
        const ty = t.position.y + (t.measured?.height || 60) / 2
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

  const memoizedNodeTypes = useMemo(() => nodeTypes, [])
  const memoizedEdgeTypes = useMemo(() => edgeTypes, [])

  const activeSnapshot = useMemo(
    () => (activeSnapshotId ? snapshots.find((s) => s.id === activeSnapshotId) || null : null),
    [activeSnapshotId, snapshots]
  )

  const diffCompareTarget = useMemo(() => {
    if (diffTargetSnapshotId !== 'live') {
      const targetSnap = snapshots.find(
        (s) => s.id === diffTargetSnapshotId && s.playerVisible !== false
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
  }, [diffTargetSnapshotId, snapshots, activeSnapshotId, nodes, edges])

  const { baseNodes, baseEdges, diffStats } = useMemo(() => {
    if (!activeSnapshot) {
      return { baseNodes: nodes, baseEdges: edges, diffStats: null }
    }
    if (showSnapshotDiff) {
      const diff = computeSnapshotDiff(
        activeSnapshot,
        diffCompareTarget.nodes,
        diffCompareTarget.edges,
        true
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
  }, [activeSnapshot, showSnapshotDiff, diffCompareTarget, nodes, edges, previewSelection])

  const decoratedBaseNodes = useMemo(
    () =>
      baseNodes.map((n) => ({
        ...n,
        data: {
          ...n.data,
          isSpotlighted:
            !isSnapshotPreview &&
            spotlightTarget?.targetType === 'node' &&
            spotlightTarget.id === n.id
        }
      })),
    [baseNodes, isSnapshotPreview, spotlightTarget]
  )

  const {
    finalEdges,
    renderedNodes,
    selectedNode,
    selectedEdge,
    matchedNodeIds
  } = useMemo(
    () =>
      computeVisibleGraph({
        baseNodes: decoratedBaseNodes,
        baseEdges,
        hideSecrets: true,
        visibleTypes,
        visibleEdgeTypes,
        connectionPresets,
        degrees,
        degreeMode,
        searchQuery
      }),
    [
      decoratedBaseNodes,
      baseEdges,
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
      return computeNodeDiffFields(before, after, true)
    }
    if (selectedEdge && selectedEdge.data?.diffStatus === 'modified') {
      const before = activeSnapshot.edges.find((e) => e.id === selectedEdge.id)
      const after = diffCompareTarget.edges.find((e) => e.id === selectedEdge.id)
      return computeEdgeDiffFields(before, after, true)
    }
    return []
  }, [activeSnapshot, showSnapshotDiff, selectedNode, selectedEdge, diffCompareTarget])

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

  const quickActions = useMemo<QuickCommandAction[]>(
    () => [
      {
        id: 'fit-view',
        label: 'Fit Entire Map in View',
        category: 'Navigation',
        onRun: () => fitView({ padding: 0.16, duration: 350 })
      },
      {
        id: 'toggle-minimap',
        label: showMiniMap ? 'Hide MiniMap Radar' : 'Show MiniMap Radar',
        shortcut: 'M',
        category: 'Navigation',
        onRun: () => setShowMiniMap((v) => !v)
      },
      {
        id: 'toggle-dark',
        label: isDarkMode ? 'Switch to Light UI' : 'Switch to Dark UI',
        category: 'Appearance',
        onRun: toggleDarkMode
      }
    ],
    [fitView, showMiniMap, isDarkMode, toggleDarkMode]
  )

  const spotlightNode =
    showSpotlightCard && spotlightTarget?.targetType === 'node'
      ? nodes.find((n) => n.id === spotlightTarget.id) || null
      : null
  const spotlightEdge =
    showSpotlightCard && spotlightTarget?.targetType === 'edge'
      ? edges.find((e) => e.id === spotlightTarget.id) || null
      : null

  const bgConfig =
    canvasTheme === 'arcane'
      ? { variant: BackgroundVariant.Dots, color: '#4f46e5', size: 1.2, gap: 22 }
      : canvasTheme === 'parchment'
        ? { variant: BackgroundVariant.Lines, color: 'rgba(120, 88, 42, 0.14)', size: 1, gap: 32 }
        : canvasTheme === 'corkboard'
          ? { variant: BackgroundVariant.Dots, color: 'rgba(42, 24, 10, 0.25)', size: 1, gap: 24 }
          : {
              variant: BackgroundVariant.Dots,
              color: isDarkMode ? '#475569' : '#cbd5e1',
              size: 1.2,
              gap: 16
            }

  const hasVisibleBookmarks = cameraBookmarks.some((b) => b.playerVisible !== false)
  const hasVisibleTimeline =
    Boolean(activeSnapshotId) || snapshots.some((s) => s.playerVisible !== false)
  const showBottomPlayerBar = hasVisibleBookmarks || hasVisibleTimeline

  return (
    <div className="w-full h-screen flex flex-col overflow-hidden bg-[var(--dcc-void)]">
      {/* Row 1: Docked 44px Single-Row Player TV Header */}
      <header
        role="toolbar"
        aria-label="Player Screen controls"
        className="shrink-0 min-h-11 dcc-chrome-bar border-b px-3 py-1 flex items-center gap-2 z-30 select-none"
      >
        <AppLogoIcon size={22} />

        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-wider shrink-0">
          <MonitorPlay size={11} aria-hidden="true" />
          Player Screen
        </span>

        <h1 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate max-w-64 px-1">
          {hasReceivedSync ? campaignTitle : 'Connecting to DM Table...'}
        </h1>

        {(spotlightTarget || mysterySpotlight) && !showSpotlightCard && (
          <button
            type="button"
            onClick={() => {
              setShowSpotlightCard(true)
              if (spotlightTarget) {
                centerOnSpotlight(spotlightTarget.targetType, spotlightTarget.id)
              }
            }}
            className="px-2.5 py-1 min-h-7 rounded-md bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
          >
            <Sparkles size={13} aria-hidden="true" />
            <span>Show Spotlight</span>
          </button>
        )}

        <div className="ms-auto flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowCommandPalette(true)}
            title="Search known lore, aliases & #tags (Ctrl+K / Ctrl+F)"
            className={`px-2.5 py-1 min-h-7 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
              searchQuery
                ? 'bg-sky-600 text-white hover:bg-sky-700'
                : 'bg-slate-200/70 dark:bg-[#172342] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#1f2e54]'
            }`}
          >
            <Search size={13} aria-hidden="true" />
            <span className="truncate max-w-32">
              {searchQuery ? `Filter: ${searchQuery}` : 'Search Lore'}
            </span>
            <kbd
              className={`text-[10px] font-bold px-1 py-0.2 rounded ${
                searchQuery
                  ? 'bg-sky-700/80 text-sky-100'
                  : 'bg-white/90 dark:bg-[#0a1022] text-slate-500 dark:text-slate-400 border border-slate-300/70 dark:border-slate-700'
              }`}
            >
              Ctrl+K
            </kbd>
          </button>

          <span
            role="separator"
            aria-orientation="vertical"
            className="w-px h-5 bg-slate-300/80 dark:bg-slate-700/70 mx-0.5"
          />

          <div className="relative flex items-center">
            <Palette
              size={13}
              aria-hidden="true"
              className="absolute left-2 text-slate-500 dark:text-slate-400 pointer-events-none"
            />
            <select
              aria-label="Canvas Theme"
              value={canvasTheme}
              onChange={(e) => {
                localThemeOverrideRef.current = true
                setCanvasTheme(e.target.value as CanvasTheme)
              }}
              className="pl-6 pr-2 py-1 min-h-7 rounded-md bg-slate-200/70 dark:bg-[#172342] text-slate-700 dark:text-slate-200 text-xs font-medium hover:bg-slate-200 dark:hover:bg-[#1f2e54] cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"
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
            title="Toggle Light / Dark UI"
            aria-label="Toggle Light or Dark UI"
            className="p-1.5 min-w-7 min-h-7 bg-slate-200/70 dark:bg-[#172342] hover:bg-slate-200 dark:hover:bg-[#1f2e54] rounded-md text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
          >
            {isDarkMode ? <Sun size={14} aria-hidden="true" /> : <Moon size={14} aria-hidden="true" />}
          </button>

          <button
            type="button"
            aria-pressed={showMiniMap}
            onClick={() => setShowMiniMap((v) => !v)}
            title="Toggle MiniMap Radar (M)"
            aria-label="Toggle MiniMap Radar"
            className={`p-1.5 min-w-7 min-h-7 rounded-md transition-colors cursor-pointer ${
              showMiniMap
                ? 'bg-sky-600 text-white hover:bg-sky-700'
                : 'bg-slate-200/70 dark:bg-[#172342] hover:bg-slate-200 dark:hover:bg-[#1f2e54] text-slate-700 dark:text-slate-200'
            }`}
          >
            <MapIcon size={14} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => fitView({ padding: 0.14, maxZoom: 1.15, duration: 350 })}
            title="Fit Entire Map"
            className="px-2 py-1 min-h-7 bg-slate-200/70 dark:bg-[#172342] hover:bg-slate-200 dark:hover:bg-[#1f2e54] rounded-md text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <LocateFixed size={13} aria-hidden="true" /> Fit
          </button>

          <button
            type="button"
            onClick={async () => {
              const res = await window.api.toggleWindowFullscreen?.()
              if (res) setIsFullscreen(res.isFullScreen)
            }}
            title="Toggle Fullscreen (F11)"
            className="px-2 py-1 min-h-7 bg-slate-200/70 dark:bg-[#172342] hover:bg-slate-200 dark:hover:bg-[#1f2e54] rounded-md text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1 transition-colors cursor-pointer"
          >
            {isFullscreen ? (
              <>
                <Minimize2 size={13} aria-hidden="true" /> Exit
              </>
            ) : (
              <>
                <Maximize2 size={13} aria-hidden="true" /> Fullscreen
              </>
            )}
          </button>
        </div>
      </header>

      {/* Row 2: Main Canvas + Optional Timeline Tray + Docked Right Player Inspector */}
      <div className="flex-1 min-h-0 flex relative overflow-hidden">
        <div className="flex-1 min-w-0 h-full flex flex-col relative overflow-hidden">
          <div className={`flex-1 min-h-0 relative canvas-theme-${canvasTheme}`}>
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
              onPaneClick={() => {
                if (isSnapshotPreview) setPreviewSelection(null)
              }}
              nodeTypes={memoizedNodeTypes}
              edgeTypes={memoizedEdgeTypes}
              connectionMode={ConnectionMode.Loose}
              elevateNodesOnSelect={false}
              elevateEdgesOnSelect={false}
              edgesReconnectable={false}
              nodesDraggable={false}
              nodesConnectable={false}
              zoomOnDoubleClick={true}
              selectionOnDrag={false}
              panOnDrag={[1, 2]}
              minZoom={0.05}
              maxZoom={4}
              fitViewOptions={{ padding: 0.14, maxZoom: 1.15 }}
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
            showInteractive={false}
            style={{ marginLeft: showMiniMap ? 220 : 16, marginBottom: 16 }}
          />
          {showMiniMap && (
            <MiniMap
              position="bottom-left"
              style={{ width: 196, height: 136, margin: 16 }}
              className="!bg-white/95 dark:!bg-slate-800/95 !border !border-slate-200 dark:!border-slate-700 !rounded-lg !shadow-lg"
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

        {/* Non-Overlapping Top-Left Canvas Stack: Pinned Filter -> Compact Legend */}
        <div
          className={`absolute top-3 left-3 z-10 flex flex-col items-start gap-2 ${
            showMiniMap ? 'max-h-[calc(100%-176px)]' : 'max-h-[calc(100%-144px)]'
          } pointer-events-none max-w-[calc(100%-24px)]`}
        >
          {/* Optional Pinned Filter Pill */}
          {searchQuery.trim() && (
            <div className="shrink-0 pointer-events-auto bg-sky-600 text-white shadow-md rounded-lg px-2.5 py-1 flex items-center gap-1.5 text-xs font-semibold">
              <Search size={12} aria-hidden="true" />
              <span className="max-w-44 truncate">Filter: {searchQuery}</span>
              <span className="px-1.5 py-0.2 rounded bg-sky-800/80 text-[10px] font-bold">
                {matchedNodeIds.length > 0
                  ? `${(searchMatchIndex % matchedNodeIds.length) + 1} / ${matchedNodeIds.length}`
                  : '0 nodes'}
              </span>
              {matchedNodeIds.length > 0 && (
                <div className="inline-flex items-center border-l border-sky-400/40 pl-1 gap-0.5">
                  <button
                    type="button"
                    onClick={() => stepSearchMatch(-1)}
                    aria-label="Previous matching entity"
                    className="p-0.5 rounded hover:bg-sky-500 cursor-pointer"
                  >
                    <ChevronUp size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => stepSearchMatch(1)}
                    aria-label="Next matching entity"
                    className="p-0.5 rounded hover:bg-sky-500 cursor-pointer"
                  >
                    <ChevronDown size={13} />
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => applyPinnedFilter('')}
                aria-label="Clear canvas filter"
                className="p-0.5 rounded hover:bg-sky-500 ml-0.5 cursor-pointer"
              >
                <X size={13} />
              </button>
            </div>
          )}

          {/* Collapsible Legend */}
          <div className="pointer-events-auto min-h-0 flex flex-col">
            <Legend />
          </div>
        </div>

        {/* Bottom-Left Focus Web — 1-Click Hop Pills Docked Beside Zoom Controls */}
        {selectedNode && (
          <div
            style={{ left: showMiniMap ? 258 : 54, bottom: 16 }}
            className="absolute z-10 dcc-surface-panel backdrop-blur-md shadow-xl rounded-xl px-3 py-2.5 border w-64 flex flex-col gap-2 pointer-events-auto"
          >
            <div className="flex justify-between items-center gap-2 border-b border-slate-200/80 dark:border-slate-700/60 pb-1.5">
              <h3 className="font-bold text-[11px] uppercase tracking-wider text-slate-600 dark:text-slate-300 shrink-0">
                Focus Web
              </h3>
              <span
                title={selectedNode.data.label}
                className="text-[10px] font-bold text-sky-700 dark:text-sky-300 bg-sky-500/12 dark:bg-sky-500/20 px-1.5 py-0.5 rounded truncate max-w-32"
              >
                {selectedNode.data.label}
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-1.5">
                <div
                  role="group"
                  aria-label="Focus Web hop distance"
                  className="inline-flex rounded-md border border-slate-300/80 dark:border-slate-700 overflow-hidden text-[11px] font-semibold"
                >
                  {([1, 2, 3, ''] as Array<number | ''>).map((hop) => {
                    const active = degrees === hop
                    return (
                      <button
                        key={String(hop || 'all')}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setDegrees(hop)}
                        className={`px-2 py-1 min-h-6 transition-colors cursor-pointer ${
                          active
                            ? 'bg-sky-600 text-white'
                            : 'bg-white dark:bg-[#172342] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1f2e54]'
                        }`}
                      >
                        {hop === '' ? 'All' : `${hop}`}
                      </button>
                    )
                  })}
                </div>
                <input
                  type="number"
                  min="0"
                  max="10"
                  title="Custom hop distance (0–10)"
                  aria-label="Custom degrees of separation"
                  value={degrees}
                  onChange={(e) =>
                    setDegrees(e.target.value === '' ? '' : parseInt(e.target.value, 10))
                  }
                  className="dcc-surface-input border rounded-md px-1.5 py-1 text-[11px] w-14 text-center tabular-nums placeholder-slate-400"
                  placeholder="0–10"
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <div
                  role="group"
                  aria-label="Non-matching card visibility"
                  className="inline-flex rounded-md border border-slate-300/80 dark:border-slate-700 overflow-hidden text-[11px] font-semibold"
                >
                  <button
                    type="button"
                    aria-pressed={degreeMode === 'fade'}
                    onClick={() => setDegreeMode('fade')}
                    className={`px-2.5 py-0.5 min-h-6 cursor-pointer transition-colors ${
                      degreeMode === 'fade'
                        ? 'bg-sky-600 text-white'
                        : 'bg-white dark:bg-[#172342] text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    Fade Others
                  </button>
                  <button
                    type="button"
                    aria-pressed={degreeMode === 'hide'}
                    onClick={() => setDegreeMode('hide')}
                    className={`px-2.5 py-0.5 min-h-6 border-l border-slate-300/80 dark:border-slate-700 cursor-pointer transition-colors ${
                      degreeMode === 'hide'
                        ? 'bg-sky-600 text-white'
                        : 'bg-white dark:bg-[#172342] text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    Hide
                  </button>
                </div>
                {degrees !== '' && (
                  <button
                    type="button"
                    onClick={() => setDegrees('')}
                    className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
          </div>

          {/* Row 2.5: Docked Non-Colliding Session Timeline Tray */}
          <SessionTimelineTray open={timelineExpanded} onClose={() => setTimelineExpanded(false)} />
        </div>

        {/* Docked Right-Hand Read-Only Player Inspector */}
        <PlayerInspector
          selectedNode={selectedNode}
          selectedEdge={selectedEdge}
          allNodes={baseNodes}
          allEdges={baseEdges}
          isPlayerView={true}
          isSnapshotPreview={isSnapshotPreview}
          diffEntries={selectedDiffEntries}
          diffCompareLabel={diffCompareTarget.label}
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
      </div>

      {/* Row 3: Dedicated Full-Width 36px Bottom Player Bar */}
      {showBottomPlayerBar && (
        <footer
          aria-label="Campaign Timeline and Views"
          className="shrink-0 h-9 z-20 dcc-chrome-bar border-t px-3 flex items-center gap-3 min-w-0"
        >
          <TimelineBar
            diffStats={diffStats}
            expanded={timelineExpanded}
            onExpandedChange={setTimelineExpanded}
            hideInlineDrawer
          />
          <BookmarksBar readOnly />
        </footer>
      )}

      {/* Lore Search & Navigation Palette */}
      <CommandPaletteModal
        open={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        nodes={baseNodes}
        edges={baseEdges}
        bookmarks={cameraBookmarks}
        hideSecrets={true}
        pinnedCanvasQuery={searchQuery}
        onPinCanvasQuery={applyPinnedFilter}
        onSelectNode={navigateToNode}
        onSelectEdge={navigateToEdge}
        onJumpBookmark={(bm) =>
          setCenter(bm.centerX, bm.centerY, { zoom: bm.zoom, duration: 480 })
        }
        quickActions={quickActions}
      />

      {/* Spotlight Handout Card Overlay (or Mystery Portrait "???") */}
      <SpotlightOverlay
        node={spotlightNode}
        edge={spotlightEdge}
        mysteryPortrait={showSpotlightCard ? mysterySpotlight : null}
        allNodes={nodes}
        onDismiss={() => setShowSpotlightCard(false)}
        onNavigateToNode={navigateToNode}
      />
    </div>
  )
}

export default function PlayerScreenApp() {
  return (
    <ReactFlowProvider>
      <PlayerScreenCanvas />
    </ReactFlowProvider>
  )
}
