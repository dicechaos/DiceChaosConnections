import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import {
  BuiltinPortId,
  CustomPortSize,
  CustomPortVisibility,
  DndFields,
  EdgeDirection,
  EntityType,
  GroupBorderStyle,
  GroupHeaderAlign,
  GroupPortraitMode,
  GroupShape,
  ItemRarity,
  PartyDisposition,
  PerimeterSide,
  PortraitMode,
  QuestStatus
} from '../types'
import {
  X,
  Plus,
  CircleDot,
  ArrowRight,
  ArrowLeftRight,
  Upload,
  Trash2,
  Lock,
  Unlock,
  Globe,
  Eye,
  Edit3,
  ArrowDownToLine,
  Files,
  Sparkles,
  MessageSquareText,
  HelpCircle,
  Tag,
  Pencil,
  ChevronRight,
  ChevronDown,
  FileText,
  BookOpen,
  Palette,
  Link2,
  FolderKanban,
  FolderMinus,
  PaintBucket,
  Shrink,
  LayoutGrid,
  MousePointerClick,
  Check,
  RotateCcw,
  BringToFront,
  SendToBack,
  ArrowUp,
  ArrowDown,
  Layers,
  Maximize2
} from 'lucide-react'
import { availableIcons, getIconColor } from '../utils/icons'
import {
  CUSTOM_PORT_SWATCHES,
  ENTITY_BG_SWATCHES,
  isHexColorDark,
  normalizeHexColor,
  resolveDefaultNodePortAccent
} from '../utils/colorUtils'
import { OTHER_EDGE_FILTER_KEY, resolveEdgeFilterKey } from '../utils/edgeFilters'
import {
  computeNextDefaultWaypointPosition,
  CUSTOM_PORT_SHAPES,
  CUSTOM_PORT_SHAPE_LABELS,
  CUSTOM_PORT_SIZES,
  CUSTOM_PORT_SIZE_LABELS,
  CUSTOM_PORT_VISIBILITIES,
  CUSTOM_PORT_VISIBILITY_LABELS,
  getBuiltinPortSpec,
  getDefaultPortStyleForId,
  getNodeStackBounds,
  hasModifiedBuiltinPorts,
  isBuiltinPerimeterPortId,
  isBuiltinPortModified,
  isNodeEffectivelyLocked,
  PERIMETER_SIDES,
  PERIMETER_SIDE_LABELS,
  resolveActivePerimeterPorts,
  resolveEdgeEndpointPoint,
  resolveEffectiveEdgePerimeterAnchor,
  resolveEntityExplicitSize,
  resolvePortDisplayName,
  sanitizeCustomPortShape,
  sanitizeCustomPortSize,
  sanitizeCustomPortVisibility
} from '../utils/graphPipeline'
import { PortShapePreviewGlyph } from './nodes/CustomPerimeterHandles'
import { compressImageFile } from '../utils/imageCompressor'
import {
  computeEntityConnectionsAndBacklinks,
  resolveCategoryArchetype
} from '../utils/wikiLinks'
import { GROUP_TINT_PALETTE, resolveGroupTint } from './nodes/GroupNode'
import { RichLoreView, WikiLinkTextarea } from './RichLoreView'
import { ConfirmModal } from './NativeModal'
import MultiSelectPanel from './MultiSelectPanel'
import CustomCategoryManager from './CustomCategoryManager'
import ConnectionsBacklinksSection from './ConnectionsBacklinksSection'

export type EntityInspectorTabId = 'details' | 'lore' | 'style' | 'links'
export type GroupInspectorTabId = 'group' | 'lore' | 'style' | 'links'

const ENTITY_TABS: Array<{ id: EntityInspectorTabId; label: string; Icon: typeof FileText }> = [
  { id: 'details', label: 'Details', Icon: FileText },
  { id: 'lore', label: 'Lore', Icon: BookOpen },
  { id: 'style', label: 'Style', Icon: Palette },
  { id: 'links', label: 'Links', Icon: Link2 }
]

const GROUP_TABS: Array<{ id: GroupInspectorTabId; label: string; Icon: typeof FolderKanban }> = [
  { id: 'group', label: 'Group', Icon: FolderKanban },
  { id: 'lore', label: 'Lore', Icon: BookOpen },
  { id: 'style', label: 'Style', Icon: Palette },
  { id: 'links', label: 'Links', Icon: Link2 }
]

interface SidebarProps {
  className?: string
  onNavigateToNode: (nodeId: string) => void
  onSpotlightNode?: (nodeId: string) => void
  onMysterySpotlightNode?: (nodeId: string) => void
  onSpotlightEdge?: (edgeId: string) => void
  onFilterByTag?: (tag: string) => void
  onRequestDeleteGroupWithContents?: (groupId: string) => void
}

export default function Sidebar({
  className,
  onNavigateToNode,
  onSpotlightNode,
  onMysterySpotlightNode,
  onSpotlightEdge,
  onFilterByTag,
  onRequestDeleteGroupWithContents
}: SidebarProps) {
  const {
    campaignEdition,
    canvasTheme,
    isDarkMode,
    nodes,
    edges,
    updateNodeData,
    renameEntityLabel,
    updateEdgeData,
    reverseEdgeDirection,
    addCustomPort,
    updateCustomPort,
    removeCustomPort,
    resetBuiltinPorts,
    applyPortStyleToAllNodePorts,
    updateEdgeEndpointAnchor,
    resetEdgeEndpointAnchors,
    setEdges,
    setNodes,
    deleteNode,
    deleteEdge,
    duplicateSelection,
    ungroupNodes,
    deleteGroupWithContents,
    fitGroupToMembers,
    tidyGroupMembers,
    selectGroupMembers,
    toggleNodeLock,
    reorderNodes,
    resizeEntityNode,
    resetEntitySize,
    assignNodesToGroup,
    customEntityTypes,
    addCustomEntityType,
    updateCustomEntityType,
    removeCustomEntityType,
    connectionPresets,
    saveConnectionPreset,
    deleteConnectionPreset
  } = useStore()

  const baseId = useId()
  const [activeEntityTab, setActiveEntityTab] = useState<EntityInspectorTabId>('details')
  const [activeGroupTab, setActiveGroupTab] = useState<GroupInspectorTabId>('group')
  const [categoryEditorMode, setCategoryEditorMode] = useState<'closed' | 'create' | 'edit'>(
    'closed'
  )
  const [aliasInput, setAliasInput] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [previewLore, setPreviewLore] = useState(false)
  const [isUploadingPortrait, setIsUploadingPortrait] = useState(false)
  const [widthDraft, setWidthDraft] = useState('')
  const [heightDraft, setHeightDraft] = useState('')
  const [lastAddedPortId, setLastAddedPortId] = useState<string | null>(null)

  // Confirmation modal state
  const [confirmState, setConfirmState] = useState<{
    title: string
    message: string
    confirmLabel: string
    onConfirm: () => void
  } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const entityTablistRef = useRef<HTMLDivElement>(null)
  const groupTablistRef = useRef<HTMLDivElement>(null)
  const entityPanelsRef = useRef<HTMLDivElement>(null)
  const groupPanelsRef = useRef<HTMLDivElement>(null)
  const editedInFocusSession = useRef(false)
  const renameOriginRef = useRef<{ nodeId: string; label: string } | null>(null)

  const isPlayerEdition = campaignEdition === 'player'
  const selectedNodes = nodes.filter((n) => n.selected)
  const singleSelectedNode = selectedNodes.length === 1 ? selectedNodes[0] : undefined
  const selectedEdge = selectedNodes.length === 0 ? edges.find((e) => e.selected) : undefined
  const isGroupInspector = Boolean(
    singleSelectedNode &&
      (singleSelectedNode.type === 'groupRegion' || singleSelectedNode.data?.isGroup)
  )

  const linkSummary = useMemo(() => {
    if (!singleSelectedNode) {
      return { total: 0, connectionsCount: 0, backlinksCount: 0 }
    }
    const res = computeEntityConnectionsAndBacklinks(
      singleSelectedNode.id,
      nodes,
      edges,
      isPlayerEdition
    )
    return {
      total: res.connections.length + res.backlinks.length,
      connectionsCount: res.connections.length,
      backlinksCount: res.backlinks.length
    }
  }, [singleSelectedNode?.id, nodes, edges, isPlayerEdition])

  // Reset inline custom-category editor when switching nodes
  useEffect(() => {
    setCategoryEditorMode('closed')
  }, [singleSelectedNode?.id])

  // Sync manual entity dimension draft inputs when selection or canvas resize changes
  useEffect(() => {
    if (!singleSelectedNode || isGroupInspector) {
      setWidthDraft('')
      setHeightDraft('')
      return
    }
    const ew = singleSelectedNode.data?.entityWidth
    const eh = singleSelectedNode.data?.entityHeight
    setWidthDraft(typeof ew === 'number' && Number.isFinite(ew) ? String(Math.round(ew)) : '')
    setHeightDraft(typeof eh === 'number' && Number.isFinite(eh) ? String(Math.round(eh)) : '')
  }, [
    singleSelectedNode?.id,
    singleSelectedNode?.data?.entityWidth,
    singleSelectedNode?.data?.entityHeight,
    isGroupInspector
  ])

  // Accessible tablist synchronization & roving-tabindex fallback (Entity Inspector)
  useEffect(() => {
    const tablist = entityTablistRef.current
    if (!tablist || !singleSelectedNode || isGroupInspector) return

    const buttons = Array.from(tablist.querySelectorAll<HTMLButtonElement>('button'))
    const selectedBtn = buttons.find((b) => b.getAttribute('aria-selected') === 'true')
    if (selectedBtn) {
      try {
        ;(selectedBtn as any).scrollIntoView({
          block: 'nearest',
          inline: 'nearest',
          container: 'nearest'
        })
      } catch {
        selectedBtn.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      }
    }

    const hasNativeFocusGroup = Object.hasOwn(HTMLElement.prototype, 'focusGroup')
    if (!hasNativeFocusGroup) {
      tablist.setAttribute('role', 'tablist')
      buttons.forEach((btn) => {
        btn.setAttribute('role', 'tab')
        btn.tabIndex = btn.getAttribute('aria-selected') === 'true' ? 0 : -1
      })
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (hasNativeFocusGroup) return
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
      const idx = buttons.indexOf(document.activeElement as HTMLButtonElement)
      if (idx < 0) return

      const nextIdx =
        e.key === 'Home'
          ? 0
          : e.key === 'End'
            ? buttons.length - 1
            : (idx + (e.key === 'ArrowLeft' ? -1 : 1) + buttons.length) % buttons.length

      e.preventDefault()
      const targetTab = ENTITY_TABS[nextIdx]
      if (targetTab) {
        setActiveEntityTab(targetTab.id)
        buttons[nextIdx]?.focus()
      }
    }

    tablist.addEventListener('keydown', onKeyDown)
    return () => tablist.removeEventListener('keydown', onKeyDown)
  }, [activeEntityTab, singleSelectedNode?.id, isGroupInspector])

  // Accessible tablist synchronization & roving-tabindex fallback (Group Inspector)
  useEffect(() => {
    const tablist = groupTablistRef.current
    if (!tablist || !singleSelectedNode || !isGroupInspector) return

    const buttons = Array.from(tablist.querySelectorAll<HTMLButtonElement>('button'))
    const selectedBtn = buttons.find((b) => b.getAttribute('aria-selected') === 'true')
    if (selectedBtn) {
      try {
        ;(selectedBtn as any).scrollIntoView({
          block: 'nearest',
          inline: 'nearest',
          container: 'nearest'
        })
      } catch {
        selectedBtn.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      }
    }

    const hasNativeFocusGroup = Object.hasOwn(HTMLElement.prototype, 'focusGroup')
    if (!hasNativeFocusGroup) {
      tablist.setAttribute('role', 'tablist')
      buttons.forEach((btn) => {
        btn.setAttribute('role', 'tab')
        btn.tabIndex = btn.getAttribute('aria-selected') === 'true' ? 0 : -1
      })
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (hasNativeFocusGroup) return
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
      const idx = buttons.indexOf(document.activeElement as HTMLButtonElement)
      if (idx < 0) return

      const nextIdx =
        e.key === 'Home'
          ? 0
          : e.key === 'End'
            ? buttons.length - 1
            : (idx + (e.key === 'ArrowLeft' ? -1 : 1) + buttons.length) % buttons.length

      e.preventDefault()
      const targetTab = GROUP_TABS[nextIdx]
      if (targetTab) {
        setActiveGroupTab(targetTab.id)
        buttons[nextIdx]?.focus()
      }
    }

    tablist.addEventListener('keydown', onKeyDown)
    return () => tablist.removeEventListener('keydown', onKeyDown)
  }, [activeGroupTab, singleSelectedNode?.id, isGroupInspector])

  // Sync hidden="until-found" beforematch events via delegation so Find-in-Page activates matched tab
  useEffect(() => {
    const container = entityPanelsRef.current
    if (!container || !singleSelectedNode || isGroupInspector) return

    const onBeforeMatch = (e: Event) => {
      const panel = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-tab-id]')
      const tabId = panel?.dataset.tabId as EntityInspectorTabId | undefined
      if (tabId && ENTITY_TABS.some((t) => t.id === tabId)) {
        setActiveEntityTab(tabId)
      }
    }

    container.addEventListener('beforematch', onBeforeMatch)
    return () => container.removeEventListener('beforematch', onBeforeMatch)
  }, [singleSelectedNode?.id, isGroupInspector])

  useEffect(() => {
    const container = groupPanelsRef.current
    if (!container || !singleSelectedNode || !isGroupInspector) return

    const onBeforeMatch = (e: Event) => {
      const panel = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-tab-id]')
      const tabId = panel?.dataset.tabId as GroupInspectorTabId | undefined
      if (tabId && GROUP_TABS.some((t) => t.id === tabId)) {
        setActiveGroupTab(tabId)
      }
    }

    container.addEventListener('beforematch', onBeforeMatch)
    return () => container.removeEventListener('beforematch', onBeforeMatch)
  }, [singleSelectedNode?.id, isGroupInspector])

  const beginEditSession = () => {
    editedInFocusSession.current = false
  }
  const ensureHistoryOnce = () => {
    if (!editedInFocusSession.current) {
      editedInFocusSession.current = true
      useStore.getState().pushHistory(true)
    }
  }

  if (selectedNodes.length === 0 && !selectedEdge) {
    return null
  }

  const closeSidebar = () => {
    if (selectedNodes.length > 0) setNodes(nodes.map((n) => ({ ...n, selected: false })))
    if (selectedEdge) setEdges(edges.map((e) => ({ ...e, selected: false })))
  }

  if (selectedNodes.length >= 2) {
    return (
      <MultiSelectPanel
        selectedNodes={selectedNodes}
        className={className}
        onClose={closeSidebar}
        onNavigateToNode={onNavigateToNode}
      />
    )
  }

  // ==================== EDGE EDITOR ====================
  if (selectedEdge) {
    const data = selectedEdge.data || {}
    const sourceNode = nodes.find((n) => n.id === selectedEdge.source)
    const targetNode = nodes.find((n) => n.id === selectedEdge.target)

    const handleSavePreset = () => {
      if (!data.label?.trim()) return
      const cleanLabel = data.label.trim()
      saveConnectionPreset({
        label: cleanLabel,
        color: data.color || '#94a3b8',
        lineStyle: data.lineStyle || 'solid',
        thickness: data.thickness || 2,
        direction: data.direction || 'none'
      })
      updateEdgeData(selectedEdge.id, { preset: cleanLabel }, false)
    }

    const resolvedFilterKey = resolveEdgeFilterKey(selectedEdge, connectionPresets)
    const resolvedFilterName =
      resolvedFilterKey === OTHER_EDGE_FILTER_KEY ? 'Other / Custom' : resolvedFilterKey

    return (
      <>
        <aside
          aria-label={isPlayerEdition ? 'Theory link editor' : 'Connection editor'}
          className={`absolute right-0 top-0 h-full w-88 bg-white dark:bg-slate-800 shadow-2xl border-l border-slate-200 dark:border-slate-700 z-20 flex flex-col ${className || ''}`}
        >
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900 shrink-0">
            <h2 className="font-bold text-base text-slate-800 dark:text-slate-100">
              {isPlayerEdition ? 'Edit Theory Link' : 'Edit Connection'}
            </h2>
            <div className="flex items-center gap-1">
              {!isPlayerEdition && onSpotlightEdge && (
                <button
                  type="button"
                  onClick={() => onSpotlightEdge(selectedEdge.id)}
                  title="Spotlight this relationship on the 2nd-screen Player Window"
                  className="px-2 py-1 rounded bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/40 dark:hover:bg-amber-800/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700/70 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Sparkles size={12} aria-hidden="true" />
                  <span>Spotlight</span>
                </button>
              )}
              <button
                type="button"
                aria-label="Close connection editor"
                className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                onClick={closeSidebar}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="p-4 flex flex-col gap-4 overflow-y-auto overscroll-contain [scrollbar-gutter:stable] min-h-0 flex-1 [&>*]:shrink-0">
            {/* Source <-> Target Header + Reverse Button */}
            <div className="flex items-center justify-between gap-2 bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 p-2 rounded-lg text-xs text-slate-700 dark:text-slate-200">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <span className="font-semibold truncate max-w-[95px]">
                  {sourceNode?.data.label || 'Label Anchor'}
                </span>
                <ArrowRight size={13} className="shrink-0 text-slate-400" aria-hidden="true" />
                <span className="font-semibold truncate max-w-[95px]">
                  {targetNode?.data.label || 'Label Anchor'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => reverseEdgeDirection(selectedEdge.id)}
                title="Swap Source & Target"
                className="px-2 py-1 rounded bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-xs font-semibold flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
              >
                <ArrowLeftRight size={12} aria-hidden="true" /> Flip
              </button>
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor={`${baseId}-edge-label`}
                className="text-xs font-semibold text-slate-600 dark:text-slate-300"
              >
                Relationship Label
              </label>
              <input
                id={`${baseId}-edge-label`}
                type="text"
                placeholder="e.g. Allied with, Commands, Owes debt to"
                onFocus={beginEditSession}
                value={data.label || ''}
                onChange={(e) => {
                  ensureHistoryOnce()
                  updateEdgeData(selectedEdge.id, { label: e.target.value }, false)
                }}
                className="border border-slate-300 dark:border-slate-700 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 placeholder-slate-400 w-full"
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label
                  htmlFor={`${baseId}-edge-preset`}
                  className="text-xs font-semibold text-slate-600 dark:text-slate-300"
                >
                  Legend Filter Group
                </label>
                {!data.preset && (
                  <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                    Auto → {resolvedFilterName}
                  </span>
                )}
              </div>
              <select
                id={`${baseId}-edge-preset`}
                value={data.preset || ''}
                onChange={(e) =>
                  updateEdgeData(
                    selectedEdge.id,
                    { preset: e.target.value || undefined },
                    true
                  )
                }
                className="border border-slate-300 dark:border-slate-700 rounded-md p-1.5 text-xs outline-none w-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
              >
                <option value="">Auto (Match Style / Label)</option>
                {connectionPresets.map((p) => (
                  <option key={p.label} value={p.label}>
                    {p.label}
                  </option>
                ))}
                <option value={OTHER_EDGE_FILTER_KEY}>Other / Custom</option>
              </select>
            </div>

            {/* Arrow Direction */}
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Arrow Direction
              </span>
              <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Arrow direction">
                {(
                  [
                    { val: 'none', text: 'None —' },
                    { val: 'forward', text: 'A → B' },
                    { val: 'reverse', text: 'A ← B' },
                    { val: 'bidirectional', text: 'A ↔ B' }
                  ] as Array<{ val: EdgeDirection; text: string }>
                ).map((opt) => {
                  const active = (data.direction || 'none') === opt.val
                  return (
                    <button
                      key={opt.val}
                      type="button"
                      aria-pressed={active}
                      onClick={() => updateEdgeData(selectedEdge.id, { direction: opt.val }, true)}
                      className={`py-1.5 px-1 rounded border text-xs font-semibold transition-colors cursor-pointer ${
                        active
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      {opt.text}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex flex-col gap-1 flex-1">
                <label
                  htmlFor={`${baseId}-edge-color`}
                  className="text-xs font-semibold text-slate-600 dark:text-slate-300"
                >
                  Line Color
                </label>
                <input
                  id={`${baseId}-edge-color`}
                  type="color"
                  onPointerDown={() => useStore.getState().pushHistory(true)}
                  className="w-full h-8 cursor-pointer rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-0.5"
                  value={data.color || '#94a3b8'}
                  onChange={(e) =>
                    updateEdgeData(
                      selectedEdge.id,
                      { color: e.target.value, preset: undefined },
                      false
                    )
                  }
                />
              </div>

              <div className="flex flex-col gap-1 flex-1">
                <label
                  htmlFor={`${baseId}-edge-style`}
                  className="text-xs font-semibold text-slate-600 dark:text-slate-300"
                >
                  Line Style
                </label>
                <select
                  id={`${baseId}-edge-style`}
                  className="border border-slate-300 dark:border-slate-700 rounded-md p-1.5 text-sm outline-none w-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                  value={data.lineStyle || 'solid'}
                  onChange={(e) =>
                    updateEdgeData(
                      selectedEdge.id,
                      {
                        lineStyle: e.target.value as 'solid' | 'dashed' | 'dotted',
                        preset: undefined
                      },
                      true
                    )
                  }
                >
                  <option value="solid">Solid</option>
                  <option value="dashed">Dashed</option>
                  <option value="dotted">Dotted</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 items-end">
              <div className="flex flex-col gap-1 flex-1">
                <div className="flex justify-between">
                  <label
                    htmlFor={`${baseId}-edge-thickness`}
                    className="text-xs font-semibold text-slate-600 dark:text-slate-300"
                  >
                    Thickness
                  </label>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {data.thickness || 2}px
                  </span>
                </div>
                <input
                  id={`${baseId}-edge-thickness`}
                  type="range"
                  min="1"
                  max="10"
                  onPointerDown={() => useStore.getState().pushHistory(true)}
                  className="w-full cursor-pointer accent-blue-600"
                  value={data.thickness || 2}
                  onChange={(e) =>
                    updateEdgeData(
                      selectedEdge.id,
                      { thickness: parseInt(e.target.value, 10) },
                      false
                    )
                  }
                />
              </div>

              <div className="flex flex-col gap-1 flex-1">
                <label
                  htmlFor={`${baseId}-edge-curve`}
                  className="text-xs font-semibold text-slate-600 dark:text-slate-300"
                >
                  Curve Style
                </label>
                <select
                  id={`${baseId}-edge-curve`}
                  className="border border-slate-300 dark:border-slate-700 rounded-md p-1.5 text-sm outline-none w-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                  value={data.pathStyle || 'smooth'}
                  onChange={(e) =>
                    updateEdgeData(
                      selectedEdge.id,
                      { pathStyle: e.target.value as 'smooth' | 'straight' },
                      true
                    )
                  }
                >
                  <option value="smooth">Smooth Spline</option>
                  <option value="straight">Straight Segments</option>
                </select>
              </div>
            </div>

            {/* Perimeter Endpoint Attachment (Single-Pointer Accessible Control) */}
            {(() => {
              const sNode = nodes.find((n) => n.id === selectedEdge.source)
              const tNode = nodes.find((n) => n.id === selectedEdge.target)
              const hasCustomEndpoints = Boolean(
                data.sourceAnchor ||
                  data.targetAnchor ||
                  selectedEdge.sourceHandle?.startsWith('cp-') ||
                  selectedEdge.targetHandle?.startsWith('cp-')
              )

              const renderEndpointRow = (
                which: 'source' | 'target',
                endpointNode: typeof sNode
              ) => {
                if (!endpointNode) return null
                const handleId =
                  which === 'source' ? selectedEdge.sourceHandle : selectedEdge.targetHandle
                const explicitAnchor =
                  which === 'source' ? data.sourceAnchor : data.targetAnchor
                const fallbackSide: PerimeterSide = which === 'source' ? 'right' : 'left'
                const resolved = resolveEffectiveEdgePerimeterAnchor({
                  handleId,
                  explicitAnchor,
                  nodeData: endpointNode.data,
                  fallbackSide
                })
                const endpointIsGroup =
                  endpointNode.type === 'groupRegion' || Boolean(endpointNode.data?.isGroup)
                const activePorts = resolveActivePerimeterPorts(
                  endpointNode.data,
                  endpointIsGroup
                )
                const pct = Math.round(resolved.anchor.offset * 100)
                const selectId = `${baseId}-edge-${which}-side`
                const sliderId = `${baseId}-edge-${which}-offset`
                const selectVal = resolved.customPort
                  ? `port:${resolved.customPort.id}`
                  : resolved.anchor.side
                let customPortCounter = 0

                return (
                  <div className="flex flex-col gap-1.5 p-2 rounded-md bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700/80">
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor={selectId}
                        className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 truncate"
                      >
                        {which === 'source' ? 'From' : 'To'}: {endpointNode.data?.label || 'Entity'}
                      </label>
                      <select
                        id={selectId}
                        value={selectVal}
                        onChange={(e) => {
                          const raw = e.target.value
                          if (raw.startsWith('port:')) {
                            updateEdgeEndpointAnchor(
                              selectedEdge.id,
                              which,
                              { anchor: null, customPortId: raw.slice(5) },
                              true
                            )
                          } else {
                            updateEdgeEndpointAnchor(
                              selectedEdge.id,
                              which,
                              {
                                anchor: {
                                  side: raw as PerimeterSide,
                                  offset: resolved.anchor.offset
                                }
                              },
                              true
                            )
                          }
                        }}
                        className="max-w-40 border border-slate-300 dark:border-slate-700 rounded px-1.5 py-0.5 text-[11px] font-medium bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"
                      >
                        <optgroup label="Freeform Edge">
                          {PERIMETER_SIDES.map((s) => (
                            <option key={s} value={s}>
                              {PERIMETER_SIDE_LABELS[s]} Edge (Freeform)
                            </option>
                          ))}
                        </optgroup>
                        {activePorts.length > 0 && (
                          <optgroup label="Connection Points">
                            {activePorts.map((cp) => {
                              const cpIdx = cp.id.startsWith('cp-')
                                ? customPortCounter++
                                : undefined
                              return (
                                <option key={cp.id} value={`port:${cp.id}`}>
                                  {resolvePortDisplayName(cp, cpIdx)} (
                                  {PERIMETER_SIDE_LABELS[cp.side]} {Math.round(cp.offset * 100)}%)
                                </option>
                              )
                            })}
                          </optgroup>
                        )}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor={sliderId}
                        className="text-[10px] font-medium text-slate-500 dark:text-slate-400 shrink-0"
                      >
                        Edge Pos
                      </label>
                      <input
                        id={sliderId}
                        type="range"
                        min="5"
                        max="95"
                        step="1"
                        value={pct}
                        onPointerDown={() => useStore.getState().pushHistory(true)}
                        onChange={(e) => {
                          const nextPct = parseInt(e.target.value, 10)
                          updateEdgeEndpointAnchor(
                            selectedEdge.id,
                            which,
                            {
                              anchor: {
                                side: resolved.anchor.side,
                                offset: nextPct / 100
                              }
                            },
                            false
                          )
                        }}
                        className="flex-1 cursor-pointer accent-blue-600 h-1.5"
                      />
                      <span className="text-[10px] font-mono font-semibold text-slate-600 dark:text-slate-300 w-8 text-right">
                        {pct}%
                      </span>
                    </div>
                  </div>
                )
              }

              if (!sNode && !tNode) return null

              return (
                <div className="flex flex-col gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                      <CircleDot size={12} className="text-blue-500" aria-hidden="true" />
                      Endpoint Positions
                    </span>
                    {hasCustomEndpoints && (
                      <button
                        type="button"
                        onClick={() => resetEdgeEndpointAnchors(selectedEdge.id)}
                        className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-[10px] font-semibold border border-amber-200 dark:border-amber-800 cursor-pointer"
                      >
                        Reset Endpoints
                      </button>
                    )}
                  </div>
                  {renderEndpointRow('source', sNode)}
                  {renderEndpointRow('target', tNode)}
                </div>
              )
            })()}

            {/* Anchors & Routing */}
            <div className="flex flex-col gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Anchors &amp; Routing
                </span>
                {data.waypoints && data.waypoints.length > 0 && (
                  <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                    Double-click dot to remove
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const st = useStore.getState()
                    const sPt = resolveEdgeEndpointPoint(
                      selectedEdge,
                      'source',
                      st.nodes,
                      st.edges
                    )
                    const tPt = resolveEdgeEndpointPoint(
                      selectedEdge,
                      'target',
                      st.nodes,
                      st.edges
                    )
                    const nextPt = computeNextDefaultWaypointPosition(
                      data.waypoints || [],
                      sPt,
                      tPt
                    )
                    st.addWaypoint(selectedEdge.id, nextPt.x, nextPt.y)
                  }}
                  className="flex-1 py-1.5 px-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-xs font-semibold transition-colors border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  + Add Anchor
                </button>
                {data.waypoints && data.waypoints.length > 0 && (
                  <button
                    type="button"
                    onClick={() => useStore.getState().clearWaypoints(selectedEdge.id)}
                    className="py-1.5 px-2.5 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 rounded text-xs font-semibold border border-amber-200 dark:border-amber-800 cursor-pointer"
                  >
                    Reset Line
                  </button>
                )}
                {data.labelPos && (
                  <button
                    type="button"
                    onClick={() => updateEdgeData(selectedEdge.id, { labelPos: undefined }, true)}
                    className="py-1.5 px-2.5 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 rounded text-xs font-semibold border border-amber-200 dark:border-amber-800 cursor-pointer"
                  >
                    Reset Label
                  </button>
                )}
              </div>
              {data.waypoints && data.waypoints.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {data.waypoints.map((wp, idx) => (
                    <span
                      key={wp.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/70 text-blue-800 dark:text-blue-200 text-[11px] font-semibold"
                    >
                      <span>Anchor {idx + 1}</span>
                      <button
                        type="button"
                        aria-label={`Remove Anchor ${idx + 1}`}
                        title={`Remove Anchor ${idx + 1}`}
                        onClick={() =>
                          useStore.getState().removeWaypoint(selectedEdge.id, wp.id)
                        }
                        className="text-blue-500 hover:text-red-500 cursor-pointer inline-flex items-center"
                      >
                        <X size={11} aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Connection Lore (Public, Party Notes, & DM Secrets) */}
            <div className="flex flex-col gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <Globe size={12} className="text-blue-500" aria-hidden="true" />{' '}
                  {isPlayerEdition ? 'Theory Summary' : 'Public Relationship Notes'}
                </label>
                <WikiLinkTextarea
                  rows={2}
                  placeholder="Known history between these entities (use [[Name]] to link)..."
                  value={data.publicNotes || ''}
                  nodes={nodes}
                  hideSecrets={isPlayerEdition}
                  onCommitStart={() => useStore.getState().pushHistory(true)}
                  onChange={(val) => updateEdgeData(selectedEdge.id, { publicNotes: val }, false)}
                />
              </div>

              <div className="flex flex-col gap-1 p-2.5 rounded-lg bg-indigo-50/75 dark:bg-indigo-950/25 border border-indigo-200 dark:border-indigo-800/60">
                <label className="text-xs font-bold text-indigo-800 dark:text-indigo-300 flex items-center gap-1.5">
                  <MessageSquareText size={12} aria-hidden="true" /> Party Notes &amp; Theories
                </label>
                <WikiLinkTextarea
                  rows={2}
                  placeholder="Player clues, hypotheses, or questions about this link..."
                  value={data.partyNotes || ''}
                  nodes={nodes}
                  hideSecrets={isPlayerEdition}
                  onCommitStart={() => useStore.getState().pushHistory(true)}
                  onChange={(val) => updateEdgeData(selectedEdge.id, { partyNotes: val }, false)}
                />
              </div>

              {!isPlayerEdition && (
                <div className="flex flex-col gap-1 p-2.5 rounded-lg bg-amber-50/70 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-800/60">
                  <label className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <Lock size={12} aria-hidden="true" /> DM Secret Notes
                  </label>
                  <WikiLinkTextarea
                    rows={2}
                    placeholder="Hidden motives, blackmail, true allegiance..."
                    value={data.dmNotes || ''}
                    nodes={nodes}
                    onCommitStart={() => useStore.getState().pushHistory(true)}
                    onChange={(val) => updateEdgeData(selectedEdge.id, { dmNotes: val }, false)}
                  />
                </div>
              )}
            </div>

            {/* Presets */}
            <div className="flex flex-col gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={handleSavePreset}
                disabled={!data.label?.trim()}
                className="w-full py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 disabled:opacity-50 disabled:cursor-not-allowed rounded-md text-xs font-semibold transition-colors border border-blue-200 dark:border-blue-800 cursor-pointer"
              >
                Save Current Style as Preset
              </button>

              {connectionPresets.length > 0 && (
                <div className="flex flex-col gap-1.5 mt-1">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Saved Connection Types
                  </span>
                  {connectionPresets.map((preset) => (
                    <div key={preset.label} className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          const currentTrimmed = (data.label || '').trim()
                          const shouldReplaceLabel =
                            !currentTrimmed ||
                            connectionPresets.some(
                              (p) => p.label.toLowerCase() === currentTrimmed.toLowerCase()
                            )
                          updateEdgeData(
                            selectedEdge.id,
                            {
                              label: shouldReplaceLabel ? preset.label : data.label,
                              preset: preset.label,
                              color: preset.color,
                              lineStyle: preset.lineStyle,
                              thickness: preset.thickness,
                              direction: preset.direction || 'none'
                            },
                            true
                          )
                        }}
                        className="flex-1 flex items-center gap-3 px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors text-left min-w-0 cursor-pointer"
                      >
                        <div className="w-7 flex items-center justify-center shrink-0">
                          <div
                            className="w-full"
                            style={{
                              borderTopWidth: Math.min(preset.thickness || 2, 5),
                              borderTopStyle: preset.lineStyle,
                              borderTopColor: preset.color
                            }}
                          />
                        </div>
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                          {preset.label}
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${preset.label} preset`}
                        onClick={() =>
                          setConfirmState({
                            title: 'Delete Connection Preset?',
                            message: `Remove "${preset.label}" from your saved connection presets? Existing lines on the map will keep their styling.`,
                            confirmLabel: 'Delete Preset',
                            onConfirm: () => deleteConnectionPreset(preset.label)
                          })
                        }
                        className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                      >
                        <X size={14} aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {!isPlayerEdition && (
              <div className="flex items-center gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
                <input
                  type="checkbox"
                  id="edgeIsHidden"
                  className="rounded accent-blue-600 cursor-pointer"
                  checked={!!data.isHidden}
                  onChange={(e) =>
                    updateEdgeData(selectedEdge.id, { isHidden: e.target.checked }, true)
                  }
                />
                <label
                  htmlFor="edgeIsHidden"
                  className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none"
                >
                  Hidden from Players (DM Only)
                </label>
              </div>
            )}

            <button
              type="button"
              onClick={() =>
                setConfirmState({
                  title: isPlayerEdition ? 'Delete Theory Link?' : 'Delete Connection?',
                  message: `Are you sure you want to delete "${data.label || 'this connection'}"?`,
                  confirmLabel: isPlayerEdition ? 'Delete Theory Link' : 'Delete Connection',
                  onConfirm: () => deleteEdge(selectedEdge.id)
                })
              }
              className="w-full py-2 bg-red-50 dark:bg-red-900/25 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/45 rounded-md text-xs font-bold transition-colors border border-red-200 dark:border-red-800/60 cursor-pointer"
            >
              {isPlayerEdition ? 'Delete Theory Link' : 'Delete Connection'}
            </button>
          </div>
        </aside>

        <ConfirmModal
          open={confirmState !== null}
          title={confirmState?.title || ''}
          message={confirmState?.message || ''}
          confirmLabel={confirmState?.confirmLabel}
          onConfirm={() => confirmState?.onConfirm()}
          onCancel={() => setConfirmState(null)}
        />
      </>
    )
  }

  // ==================== SINGLE NODE / GROUP INSPECTOR ====================
  const node = singleSelectedNode!
  const data = node.data
  const f: DndFields = data.dndFields || {}
  const publicValue = data.publicNotes ?? data.description ?? ''
  const dmValue = data.dmNotes || ''
  const hasAnyLore = Boolean(
    publicValue.trim() || data.partyNotes?.trim() || (!isPlayerEdition && dmValue.trim())
  )

  const groupContainers = nodes.filter(
    (n) => (n.type === 'groupRegion' || n.data?.isGroup) && n.id !== node.id
  )
  const parentGroup = data.groupId
    ? nodes.find((n) => n.id === data.groupId && (n.type === 'groupRegion' || n.data?.isGroup))
    : undefined
  const effectivelyLocked = isNodeEffectivelyLocked(node, nodes)

  const handleAddAlias = () => {
    const clean = aliasInput.trim()
    if (!clean) return
    const existing = data.aliases || []
    if (!existing.some((a) => a.toLowerCase() === clean.toLowerCase())) {
      updateNodeData(node.id, { aliases: [...existing, clean] }, true)
    }
    setAliasInput('')
  }

  const handleAddTag = () => {
    const clean = tagInput
      .trim()
      .replace(/^#+/, '')
      .toLowerCase()
      .replace(/\s+/g, '-')
    if (!clean) return
    const existing = data.tags || []
    if (!existing.some((t) => t.toLowerCase() === clean)) {
      updateNodeData(node.id, { tags: [...existing, clean] }, true)
    }
    setTagInput('')
  }

  const renderCustomPortsSection = () => {
    const activePorts = resolveActivePerimeterPorts(data, isGroupInspector)
    const hasBuiltinEdits = hasModifiedBuiltinPorts(data, isGroupInspector)
    const canEditNode = !effectivelyLocked && (!isPlayerEdition || Boolean(data.isPlayerCreated))
    const isDarkCanvasSurface =
      canvasTheme === 'arcane' || (canvasTheme === 'modern' && isDarkMode)
    const customCategory = customEntityTypes.find((c) => c.label === data.entityType)
    const defaultPortAccent = isGroupInspector
      ? resolveGroupTint(data.groupColor, data.groupCustomColor).swatchHex
      : resolveDefaultNodePortAccent({
          entityType: data.entityType,
          customCategoryColor: customCategory?.color,
          isDarkSurface: data.bgColor ? isHexColorDark(data.bgColor) : isDarkCanvasSurface
        })

    let customIdxCounter = 0

    return (
      <div className="flex flex-col gap-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
            <CircleDot size={13} className="text-amber-500 shrink-0" aria-hidden="true" />
            <span>Connection Points</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-200/80 dark:bg-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
              {activePorts.length}
            </span>
          </span>
          {canEditNode && (
            <div className="flex items-center gap-1.5">
              {hasBuiltinEdits && (
                <button
                  type="button"
                  title="Restore all 8 pre-populated points to their default positions and styles"
                  onClick={() => resetBuiltinPorts(node.id)}
                  className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 text-[10px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <RotateCcw size={10} aria-hidden="true" />
                  <span>Restore Defaults</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  const created = addCustomPort(node.id)
                  if (created) setLastAddedPortId(created.id)
                }}
                className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700/80 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus size={11} aria-hidden="true" />
                <span>Add Point</span>
              </button>
            </div>
          )}
        </div>

        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
          Click any pre-populated or added point below (or right-click it on the card edge) to move,
          restyle, or remove it. Hold <kbd className="font-mono">Alt</kbd>+Drag on the canvas to
          slide attached lines together.
        </p>

        {activePorts.length === 0 ? (
          <div className="text-[11px] text-slate-500 dark:text-slate-400 italic py-1">
            All connection points hidden — click <strong>Restore Defaults</strong> or{' '}
            <strong>+ Add Point</strong> above.
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 mt-0.5">
            {activePorts.map((port) => {
              const isBuiltin = isBuiltinPerimeterPortId(port.id)
              const builtinSpec = getBuiltinPortSpec(port.id)
              const customIdx = !isBuiltin ? customIdxCounter++ : undefined
              const displayName = resolvePortDisplayName(port, customIdx)
              const defaults = getDefaultPortStyleForId(port.id, isGroupInspector)
              const pct = Math.round(port.offset * 100)
              const sideSelectId = `${baseId}-port-side-${port.id}`
              const offsetRangeId = `${baseId}-port-offset-${port.id}`
              const labelInputId = `${baseId}-port-label-${port.id}`
              const visSelectId = `${baseId}-port-vis-${port.id}`
              const colorPickerId = `${baseId}-port-color-${port.id}`
              const showLabelCheckboxId = `${baseId}-port-showlabel-${port.id}`
              const portShape = sanitizeCustomPortShape(port.shape, defaults.shape)
              const portSize = sanitizeCustomPortSize(port.size, defaults.size)
              const portVis = sanitizeCustomPortVisibility(port.visibility, defaults.visibility)
              const customPortHex = normalizeHexColor(port.color)
              const resolvedPortColor = customPortHex || defaultPortAccent
              const isModifiedBuiltin = isBuiltin && isBuiltinPortModified(port, isGroupInspector)
              const attachedCount = edges.filter(
                (e) =>
                  (e.source === node.id &&
                    e.sourceHandle === port.id &&
                    !e.data?.sourceAnchor) ||
                  (e.target === node.id && e.targetHandle === port.id && !e.data?.targetAnchor)
              ).length

              return (
                <details
                  key={port.id}
                  open={lastAddedPortId === port.id ? true : undefined}
                  className="dcc-disclosure group/portitem rounded bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700"
                >
                  <summary className="px-2 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded select-none">
                    <ChevronRight
                      size={12}
                      aria-hidden="true"
                      className="shrink-0 text-slate-400 transition-transform group-open/portitem:rotate-90"
                    />
                    <span
                      aria-hidden="true"
                      className="inline-flex items-center justify-center w-4.5 h-4.5 rounded bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 shrink-0"
                    >
                      <PortShapePreviewGlyph
                        shape={portShape}
                        color={resolvedPortColor}
                        isDark={isDarkMode}
                      />
                    </span>
                    <span className="truncate">{displayName}</span>
                    {isModifiedBuiltin && (
                      <span className="px-1 py-0.2 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[9px] font-bold shrink-0">
                        Edited
                      </span>
                    )}
                    {!isBuiltin && (
                      <span className="px-1 py-0.2 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[9px] font-bold shrink-0">
                        Added
                      </span>
                    )}
                    {attachedCount > 0 && (
                      <span className="text-[9px] font-normal text-slate-400 shrink-0">
                        ({attachedCount})
                      </span>
                    )}
                    <span className="ms-auto text-[10px] font-mono font-normal text-slate-400 shrink-0">
                      {PERIMETER_SIDE_LABELS[port.side]} {pct}% ·{' '}
                      {portVis === 'dm' ? 'DM' : portVis === 'hover' ? 'Hover' : 'Public'}
                    </span>
                  </summary>

                  <div className="px-2 pb-2 pt-1.5 border-t border-slate-100 dark:border-slate-700/70 flex flex-col gap-2">
                    {/* Name, Side, Reset & Remove */}
                    <div className="flex items-center justify-between gap-1.5">
                      <label
                        htmlFor={labelInputId}
                        className="sr-only"
                      >{`${displayName} custom label`}</label>
                      <input
                        id={labelInputId}
                        type="text"
                        disabled={!canEditNode}
                        placeholder={
                          builtinSpec
                            ? `${builtinSpec.defaultLabel} (default)`
                            : `Point ${(customIdx ?? 0) + 1}`
                        }
                        value={port.label || ''}
                        onFocus={beginEditSession}
                        onChange={(e) => {
                          ensureHistoryOnce()
                          updateCustomPort(node.id, port.id, { label: e.target.value }, false)
                        }}
                        className="flex-1 min-w-0 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-[11px] font-medium bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-none"
                      />
                      <label
                        htmlFor={sideSelectId}
                        className="sr-only"
                      >{`${displayName} edge side`}</label>
                      <select
                        id={sideSelectId}
                        disabled={!canEditNode}
                        value={port.side}
                        onChange={(e) =>
                          updateCustomPort(
                            node.id,
                            port.id,
                            { side: e.target.value as PerimeterSide },
                            true
                          )
                        }
                        className="border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-[11px] font-medium bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"
                      >
                        {PERIMETER_SIDES.map((s) => (
                          <option key={s} value={s}>
                            {PERIMETER_SIDE_LABELS[s]}
                          </option>
                        ))}
                      </select>
                      {canEditNode && isModifiedBuiltin && (
                        <button
                          type="button"
                          aria-label={`Reset ${displayName} to default`}
                          title="Reset this point to its default position and style"
                          onClick={() => resetBuiltinPorts(node.id, port.id as BuiltinPortId)}
                          className="p-1 rounded text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-pointer"
                        >
                          <RotateCcw size={12} aria-hidden="true" />
                        </button>
                      )}
                      {canEditNode && (
                        <button
                          type="button"
                          aria-label={`Remove ${displayName}`}
                          title="Remove connection point (attached lines stay in place)"
                          onClick={() => removeCustomPort(node.id, port.id)}
                          className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                        >
                          <Trash2 size={12} aria-hidden="true" />
                        </button>
                      )}
                    </div>

                    {/* Position Slider */}
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor={offsetRangeId}
                        className="text-[10px] font-medium text-slate-500 dark:text-slate-400 shrink-0"
                      >
                        Position
                      </label>
                      <input
                        id={offsetRangeId}
                        type="range"
                        min="5"
                        max="95"
                        step="1"
                        disabled={!canEditNode}
                        value={pct}
                        style={{ accentColor: resolvedPortColor }}
                        onPointerDown={() => useStore.getState().pushHistory(true)}
                        onChange={(e) =>
                          updateCustomPort(
                            node.id,
                            port.id,
                            { offset: parseInt(e.target.value, 10) / 100 },
                            false
                          )
                        }
                        className="flex-1 cursor-pointer h-1.5"
                      />
                      <span className="text-[10px] font-mono font-semibold text-slate-600 dark:text-slate-300 w-8 text-right">
                        {pct}%
                      </span>
                    </div>

                    {/* Visual Customization Controls */}
                    {canEditNode && (
                      <div className="pt-1 border-t border-slate-100 dark:border-slate-700/60 flex flex-col gap-2">
                        {/* Shape Picker */}
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                            Marker Shape
                          </span>
                          <div
                            role="group"
                            aria-label={`${displayName} marker shape`}
                            className="grid grid-cols-3 gap-1"
                          >
                            {CUSTOM_PORT_SHAPES.map((sh) => {
                              const activeShape = portShape === sh
                              return (
                                <button
                                  key={sh}
                                  type="button"
                                  aria-pressed={activeShape}
                                  onClick={() =>
                                    updateCustomPort(node.id, port.id, { shape: sh }, true)
                                  }
                                  className={`px-1.5 py-1 min-h-6 rounded border text-[10px] font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                                    activeShape
                                      ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500 text-blue-700 dark:text-blue-200'
                                      : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                  }`}
                                >
                                  <PortShapePreviewGlyph
                                    shape={sh}
                                    color={resolvedPortColor}
                                    isDark={isDarkMode}
                                  />
                                  <span>{CUSTOM_PORT_SHAPE_LABELS[sh]}</span>
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        {/* Size & Visibility */}
                        <div className="grid grid-cols-2 gap-1.5">
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                              Size
                            </span>
                            <div
                              role="group"
                              aria-label={`${displayName} size`}
                              className="grid grid-cols-3 gap-1"
                            >
                              {CUSTOM_PORT_SIZES.map((sz: CustomPortSize) => {
                                const activeSize = portSize === sz
                                return (
                                  <button
                                    key={sz}
                                    type="button"
                                    aria-pressed={activeSize}
                                    title={CUSTOM_PORT_SIZE_LABELS[sz]}
                                    onClick={() =>
                                      updateCustomPort(node.id, port.id, { size: sz }, true)
                                    }
                                    className={`py-1 min-h-6 rounded border text-[10px] font-bold transition-colors cursor-pointer ${
                                      activeSize
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                    }`}
                                  >
                                    {sz === 'sm' ? 'S' : sz === 'lg' ? 'L' : 'M'}
                                  </button>
                                )
                              })}
                            </div>
                          </div>

                          <div className="flex flex-col gap-1">
                            <label
                              htmlFor={visSelectId}
                              className="text-[10px] font-semibold text-slate-500 dark:text-slate-400"
                            >
                              Visibility
                            </label>
                            <select
                              id={visSelectId}
                              value={portVis}
                              onChange={(e) =>
                                updateCustomPort(
                                  node.id,
                                  port.id,
                                  { visibility: e.target.value as CustomPortVisibility },
                                  true
                                )
                              }
                              className="min-h-6 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"
                            >
                              {CUSTOM_PORT_VISIBILITIES.map((v) => (
                                <option key={v} value={v}>
                                  {CUSTOM_PORT_VISIBILITY_LABELS[v]}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Color Swatches + Match Border + Custom Color */}
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                              Color
                            </span>
                            <button
                              type="button"
                              aria-pressed={!customPortHex}
                              onClick={() =>
                                updateCustomPort(node.id, port.id, { color: undefined }, true)
                              }
                              className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer ${
                                !customPortHex
                                  ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500 text-blue-700 dark:text-blue-200'
                                  : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                              }`}
                            >
                              <span
                                aria-hidden="true"
                                style={{ backgroundColor: defaultPortAccent }}
                                className="dcc-color-swatch w-2.5 h-2.5 rounded-full border border-black/20 dark:border-white/30"
                              />
                              <span>Match Border</span>
                            </button>
                          </div>

                          <div
                            role="group"
                            aria-label={`${displayName} color`}
                            className="flex items-center gap-1.5 flex-wrap pt-0.5"
                          >
                            {CUSTOM_PORT_SWATCHES.map((sw) => {
                              const isSelectedColor = customPortHex === sw.hex
                              return (
                                <button
                                  key={sw.key}
                                  type="button"
                                  aria-label={sw.label}
                                  aria-pressed={isSelectedColor}
                                  title={sw.label}
                                  onClick={() =>
                                    updateCustomPort(node.id, port.id, { color: sw.hex }, true)
                                  }
                                  style={{ backgroundColor: sw.hex }}
                                  className={`dcc-color-swatch w-5 h-5 rounded-full border inline-flex items-center justify-center transition-transform cursor-pointer ${
                                    isSelectedColor
                                      ? 'border-slate-900 dark:border-white scale-110 ring-2 ring-blue-500/60'
                                      : 'border-slate-400/70 dark:border-slate-600 hover:scale-105'
                                  }`}
                                >
                                  {isSelectedColor && (
                                    <Check
                                      size={11}
                                      strokeWidth={3}
                                      aria-hidden="true"
                                      className="text-white drop-shadow"
                                    />
                                  )}
                                </button>
                              )
                            })}

                            <label
                              htmlFor={colorPickerId}
                              title="Pick custom port color"
                              className="inline-flex items-center gap-1 ms-auto text-[10px] font-medium text-slate-500 dark:text-slate-400 cursor-pointer"
                            >
                              <span className="sr-only">{`${displayName} custom hex color`}</span>
                              <input
                                id={colorPickerId}
                                type="color"
                                value={resolvedPortColor}
                                onPointerDown={() => useStore.getState().pushHistory(true)}
                                onChange={(e) =>
                                  updateCustomPort(
                                    node.id,
                                    port.id,
                                    { color: e.target.value },
                                    false
                                  )
                                }
                                className="dcc-color-swatch w-5 h-5 p-0 border border-slate-300 dark:border-slate-600 rounded bg-transparent cursor-pointer"
                              />
                            </label>
                          </div>
                        </div>

                        {/* Optional Border Label Tag + Apply Style to All */}
                        <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
                          <label
                            htmlFor={showLabelCheckboxId}
                            className="inline-flex items-center gap-1.5 text-[10px] font-medium text-slate-600 dark:text-slate-300 cursor-pointer select-none"
                          >
                            <input
                              id={showLabelCheckboxId}
                              type="checkbox"
                              checked={Boolean(port.showLabel)}
                              onChange={(e) =>
                                updateCustomPort(
                                  node.id,
                                  port.id,
                                  { showLabel: e.target.checked },
                                  true
                                )
                              }
                              className="rounded accent-blue-600 cursor-pointer"
                            />
                            <span>Show label badge on border</span>
                          </label>

                          {activePorts.length > 1 && (
                            <button
                              type="button"
                              title="Apply this point's shape, size, visibility, color, and badge setting to all active points on this item"
                              onClick={() => applyPortStyleToAllNodePorts(node.id, port.id)}
                              className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-blue-950/50 text-slate-600 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-300 border border-slate-200 dark:border-slate-700 text-[10px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <Sparkles size={10} className="text-amber-500" aria-hidden="true" />
                              <span>Apply to All</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </details>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  const renderAliasesAndTagsCard = () => (
    <div className="grid grid-cols-1 gap-2.5 p-2.5 rounded-lg bg-slate-50/80 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
      {/* Aliases */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor={`${baseId}-alias-input`}
          className="text-[11px] font-semibold text-slate-600 dark:text-slate-300"
        >
          Aliases / Epithets{' '}
          <span className="text-slate-400 font-normal">(for [[Links]] &amp; Search)</span>
        </label>
        <div className="flex items-center gap-1">
          <input
            id={`${baseId}-alias-input`}
            type="text"
            value={aliasInput}
            onChange={(e) => setAliasInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault()
                handleAddAlias()
              }
            }}
            placeholder="Add alias (e.g. Lonely Mountain)..."
            className="flex-1 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={handleAddAlias}
            aria-label="Add alias"
            className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
          >
            Add
          </button>
        </div>
        {(data.aliases || []).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {(data.aliases || []).map((al) => (
              <span
                key={al}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-800/60 text-cyan-800 dark:text-cyan-200 text-[11px] font-medium"
              >
                <span>{al}</span>
                <button
                  type="button"
                  aria-label={`Remove alias ${al}`}
                  onClick={() =>
                    updateNodeData(
                      node.id,
                      { aliases: (data.aliases || []).filter((x) => x !== al) },
                      true
                    )
                  }
                  className="text-cyan-500 hover:text-red-500 cursor-pointer"
                >
                  <X size={10} aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Campaign #Tags */}
      <div className="flex flex-col gap-1 pt-1.5 border-t border-slate-200/80 dark:border-slate-700/70">
        <label
          htmlFor={`${baseId}-tag-input`}
          className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1"
        >
          <Tag size={11} className="text-violet-500" aria-hidden="true" /> Campaign #Tags
        </label>
        <div className="flex items-center gap-1">
          <input
            id={`${baseId}-tag-input`}
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault()
                handleAddTag()
              }
            }}
            placeholder="Add #tag (e.g. five-armies)..."
            className="flex-1 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={handleAddTag}
            aria-label="Add campaign tag"
            className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
          >
            Add
          </button>
        </div>
        {(data.tags || []).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {(data.tags || []).map((tg) => (
              <span
                key={tg}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-950/60 border border-violet-200 dark:border-violet-800/60 text-violet-800 dark:text-violet-200 text-[11px] font-semibold"
              >
                <button
                  type="button"
                  onClick={() => onFilterByTag?.(tg)}
                  title={`Filter canvas by #${tg}`}
                  className="hover:underline cursor-pointer"
                >
                  #{tg}
                </button>
                <button
                  type="button"
                  aria-label={`Remove tag ${tg}`}
                  onClick={() =>
                    updateNodeData(
                      node.id,
                      { tags: (data.tags || []).filter((x) => x !== tg) },
                      true
                    )
                  }
                  className="text-violet-400 hover:text-red-500 cursor-pointer"
                >
                  <X size={10} aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  const renderLoreEditorSection = (publicLabel: string, rowsPublic = 5, rowsSecrets = 5) => (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {isPlayerEdition ? 'Clues & Party Notes' : 'Lore, Party Notes & Secrets'}
        </span>
        <button
          type="button"
          onClick={() => setPreviewLore(!previewLore)}
          className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
        >
          {previewLore ? (
            <Edit3 size={12} aria-hidden="true" />
          ) : (
            <Eye size={12} aria-hidden="true" />
          )}
          <span>{previewLore ? 'Edit Text' : 'Preview [[Links]]'}</span>
        </button>
      </div>

      {/* Public Lore */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
            <Globe size={12} className="text-blue-500" aria-hidden="true" /> {publicLabel}
          </label>
          {!isPlayerEdition && publicValue && !previewLore && (
            <button
              type="button"
              onClick={() => {
                const merged = dmValue ? `${dmValue}\n\n${publicValue}` : publicValue
                updateNodeData(
                  node.id,
                  { publicNotes: '', description: undefined, dmNotes: merged },
                  true
                )
              }}
              title="Move public text into private DM Secrets"
              className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              <ArrowDownToLine size={10} aria-hidden="true" /> Move to DM
            </button>
          )}
        </div>

        {previewLore ? (
          <div className="p-2.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60">
            <RichLoreView
              text={publicValue}
              nodes={nodes}
              isPlayerView={isPlayerEdition}
              onNavigateToNode={onNavigateToNode}
              emptyText="No summary recorded."
            />
          </div>
        ) : (
          <WikiLinkTextarea
            rows={rowsPublic}
            placeholder="Known to players! Type [[ to link other entities..."
            value={publicValue}
            nodes={nodes}
            hideSecrets={isPlayerEdition}
            onCommitStart={() => useStore.getState().pushHistory(true)}
            onChange={(val) =>
              updateNodeData(node.id, { publicNotes: val, description: undefined }, false)
            }
          />
        )}
      </div>

      {/* Party Notes & Theories */}
      <div className="flex flex-col gap-1 p-2.5 rounded-lg bg-indigo-50/75 dark:bg-indigo-950/25 border border-indigo-200 dark:border-indigo-800/60">
        <label className="text-xs font-bold text-indigo-800 dark:text-indigo-300 flex items-center gap-1.5">
          <MessageSquareText size={12} aria-hidden="true" /> Party Notes &amp; Theories
        </label>
        {previewLore ? (
          <RichLoreView
            text={data.partyNotes || ''}
            nodes={nodes}
            isPlayerView={isPlayerEdition}
            onNavigateToNode={onNavigateToNode}
            emptyText="No party notes recorded."
          />
        ) : (
          <WikiLinkTextarea
            rows={4}
            placeholder="Player deductions, suspicions, or [[Entity]] links..."
            value={data.partyNotes || ''}
            nodes={nodes}
            hideSecrets={isPlayerEdition}
            onCommitStart={() => useStore.getState().pushHistory(true)}
            onChange={(val) => updateNodeData(node.id, { partyNotes: val }, false)}
          />
        )}
      </div>

      {/* DM Secrets */}
      {!isPlayerEdition && (
        <div className="flex flex-col gap-1 p-2.5 rounded-lg bg-amber-50/75 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-800/60">
          <label className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
            <Lock size={12} aria-hidden="true" /> DM Secrets (Never Shown in Player View)
          </label>
          {previewLore ? (
            <RichLoreView
              text={dmValue}
              nodes={nodes}
              isPlayerView={false}
              onNavigateToNode={onNavigateToNode}
              emptyText="No private DM secrets."
            />
          ) : (
            <WikiLinkTextarea
              rows={rowsSecrets}
              placeholder="True motives, plot twists, loot, secret [[Faction]] ties..."
              value={dmValue}
              nodes={nodes}
              onCommitStart={() => useStore.getState().pushHistory(true)}
              onChange={(val) => updateNodeData(node.id, { dmNotes: val }, false)}
            />
          )}
        </div>
      )}
    </div>
  )

  const updateDndField = (patch: Partial<DndFields>, discrete = false) => {
    updateNodeData(node.id, { dndFields: { ...f, ...patch } }, discrete)
  }

  const handlePortraitUpload = async (file: File | undefined) => {
    if (!file) return
    setIsUploadingPortrait(true)
    try {
      const compressed = await compressImageFile(file, 320, 0.82)
      updateNodeData(
        node.id,
        isGroupInspector
          ? {
              portrait: compressed,
              groupPortraitMode: data.groupPortraitMode || 'badge'
            }
          : {
              portrait: compressed,
              portraitMode: data.portraitMode || 'token'
            },
        true
      )
    } catch (err) {
      console.error('Portrait upload failed:', err)
    } finally {
      setIsUploadingPortrait(false)
    }
  }

  const legacyMap: Record<string, string> = {
    skull: 'Skull',
    flame: 'Flame',
    crown: 'Crown',
    shield: 'Shield'
  }
  const rawUsed = Array.from(new Set(nodes.flatMap((n) => n.data?.statusIcons || [])))
  const usedStatusIcons = rawUsed.map((s) => legacyMap[s] || s)
  const allIconNames = Object.keys(availableIcons)
  const uniqueUsed = Array.from(
    new Set(usedStatusIcons.filter((name) => allIconNames.includes(name)))
  )
  const sortedStatusIcons = [
    ...uniqueUsed,
    ...allIconNames.filter((name) => !uniqueUsed.includes(name))
  ]

  const renderStatusMarkersPicker = () => (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          Status Markers
        </span>
        {(data.statusIcons || []).length > 0 && (
          <button
            type="button"
            onClick={() => updateNodeData(node.id, { statusIcons: [] }, true)}
            className="text-[11px] font-semibold text-slate-500 hover:text-red-500 dark:text-slate-400 cursor-pointer"
          >
            Clear ({(data.statusIcons || []).length})
          </button>
        )}
      </div>
      <div
        className="flex flex-wrap gap-1 max-h-56 overflow-y-auto p-2 border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900"
        role="group"
        aria-label="Status markers"
      >
        {sortedStatusIcons.map((name) => {
          const IconComponent = availableIcons[name]
          const currentStatus = data.statusIcons || []
          const isActive = currentStatus.some((s) => (legacyMap[s] || s) === name)

          return (
            <button
              key={name}
              type="button"
              aria-label={name}
              aria-pressed={isActive}
              onClick={() => {
                const current = data.statusIcons || []
                const next = isActive
                  ? current.filter((s) => (legacyMap[s] || s) !== name)
                  : [...current, name]
                updateNodeData(node.id, { statusIcons: next }, true)
              }}
              className={`p-1.5 rounded border transition-colors cursor-pointer ${
                isActive
                  ? 'bg-blue-100 dark:bg-blue-900/50 border-blue-400 dark:border-blue-500'
                  : 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700'
              }`}
              title={name}
            >
              <IconComponent
                size={14}
                aria-hidden="true"
                className={getIconColor(name)}
              />
            </button>
          )
        })}
      </div>
    </div>
  )

  const renderStackingOrderSection = (isGroupScope: boolean) => {
    const { canBringFront, canSendBack } = getNodeStackBounds(nodes, [node.id])
    return (
      <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
            <Layers size={13} className="text-blue-500" aria-hidden="true" />
            <span>Stacking Order</span>
          </span>
          <span className="text-[10px] font-medium text-slate-400">[ / ] • Ctrl+[ / ]</span>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug -mt-1">
          {isGroupScope
            ? 'Reorders overlapping group frames while keeping connection lines and entity cards strictly on top.'
            : 'Moves this card behind or in front of overlapping entities while staying above groups and connection lines.'}
        </p>
        <div
          role="group"
          aria-label={isGroupScope ? 'Group stacking order' : 'Entity stacking order'}
          className="grid grid-cols-4 gap-1"
        >
          <button
            type="button"
            disabled={!canSendBack}
            onClick={() => reorderNodes([node.id], 'back')}
            title="Send to Back (Ctrl+[)"
            className="px-2 py-1.5 rounded bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <SendToBack size={12} aria-hidden="true" />
            <span>Back</span>
          </button>
          <button
            type="button"
            disabled={!canSendBack}
            onClick={() => reorderNodes([node.id], 'backward')}
            title="Send Backward ([)"
            className="px-2 py-1.5 rounded bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowDown size={12} aria-hidden="true" />
            <span>-1</span>
          </button>
          <button
            type="button"
            disabled={!canBringFront}
            onClick={() => reorderNodes([node.id], 'forward')}
            title="Bring Forward (])"
            className="px-2 py-1.5 rounded bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowUp size={12} aria-hidden="true" />
            <span>+1</span>
          </button>
          <button
            type="button"
            disabled={!canBringFront}
            onClick={() => reorderNodes([node.id], 'front')}
            title="Bring to Front (Ctrl+])"
            className="px-2 py-1.5 rounded bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <BringToFront size={12} aria-hidden="true" />
            <span>Front</span>
          </button>
        </div>
      </div>
    )
  }

  // ==================== DEDICATED 4-TAB EDIT GROUP INSPECTOR ====================
  if (isGroupInspector) {
    const memberNodes = nodes.filter(
      (n) => n.data?.groupId === node.id && (!isPlayerEdition || !n.data?.isHidden)
    )
    const addableEntities = nodes.filter(
      (n) =>
        n.type !== 'groupRegion' &&
        !n.data?.isGroup &&
        n.id !== node.id &&
        n.data?.groupId !== node.id &&
        (!isPlayerEdition || !n.data?.isHidden)
    )
    const hasBackground = Boolean(data.hasBackground)
    const activeTint = data.groupColor || 'gold'
    const customGroupHex = normalizeHexColor(data.groupCustomColor)
    const resolvedGroupTint = resolveGroupTint(data.groupColor, data.groupCustomColor)
    const opacityPct = Math.round((data.groupOpacity ?? 0.16) * 100)
    const activeBorderStyle: GroupBorderStyle =
      data.groupBorderStyle || (hasBackground ? 'solid' : 'dashed')
    const activeGroupShape: GroupShape = data.groupShape || 'rounded'
    const activeHeaderAlign: GroupHeaderAlign = data.groupHeaderAlign || 'left'
    const activeGroupPortraitMode: GroupPortraitMode = data.groupPortraitMode || 'badge'
    const ActiveGroupHeaderIcon =
      (data.groupIcon && availableIcons[data.groupIcon]) || FolderKanban
    const hasAnyGroupSheetDetail = Boolean(
      f.region || f.influence || f.headquarters || f.goal || (!isPlayerEdition && f.dangerTier)
    )

    return (
      <>
        <aside
          aria-label="Group editor"
          className={`absolute right-0 top-0 h-full w-88 bg-white dark:bg-slate-800 shadow-2xl border-l border-slate-200 dark:border-slate-700 z-20 flex flex-col ${className || ''}`}
        >
          {/* Pinned Header Bar */}
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900 shrink-0">
            <h2 className="font-bold text-base text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <ActiveGroupHeaderIcon
                size={16}
                className={
                  data.groupIcon
                    ? getIconColor(data.groupIcon)
                    : 'text-amber-600 dark:text-amber-400'
                }
                aria-hidden="true"
              />
              <span>Edit Group</span>
            </h2>
            <div className="flex items-center gap-1">
              {!isPlayerEdition && (
                <button
                  type="button"
                  onClick={() => toggleNodeLock([node.id])}
                  aria-label="Lock group and member positions"
                  aria-pressed={Boolean(data.isLocked)}
                  title={
                    data.isLocked
                      ? 'Group & members locked (click to unlock)'
                      : 'Lock group & member positions'
                  }
                  className={`p-1.5 rounded border text-xs font-semibold transition-colors cursor-pointer ${
                    data.isLocked
                      ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700'
                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 border-transparent hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
                  }`}
                >
                  {data.isLocked ? (
                    <Lock size={14} aria-hidden="true" />
                  ) : (
                    <Unlock size={14} aria-hidden="true" />
                  )}
                </button>
              )}
              {!isPlayerEdition && onMysterySpotlightNode && Boolean(data.portrait) && (
                <button
                  type="button"
                  onClick={() => onMysterySpotlightNode(node.id)}
                  title="Mystery Spotlight: show ONLY group crest/banner art as '???' on Player Screen without revealing identity"
                  className="px-2 py-1 rounded bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/40 dark:hover:bg-purple-800/60 text-purple-900 dark:text-purple-200 border border-purple-300 dark:border-purple-700/70 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <HelpCircle size={12} aria-hidden="true" />
                  <span>???</span>
                </button>
              )}
              {!isPlayerEdition && onSpotlightNode && (
                <button
                  type="button"
                  onClick={() => onSpotlightNode(node.id)}
                  title="Spotlight this group on the 2nd-screen Player Window"
                  className="px-2 py-1 rounded bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/40 dark:hover:bg-amber-800/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700/70 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Sparkles size={12} aria-hidden="true" />
                  <span>Spotlight</span>
                </button>
              )}
              <button
                type="button"
                aria-label="Duplicate group and contents"
                onClick={() => duplicateSelection(node.id)}
                title="Duplicate Group & Members (Ctrl+D)"
                className="p-1.5 rounded text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 cursor-pointer"
              >
                <Files size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Close group editor"
                className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                onClick={closeSidebar}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Pinned Group Name Bar */}
          <div className="px-4 pt-3 pb-2.5 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shrink-0 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label
                htmlFor="sidebar-node-name-input"
                className="text-xs font-semibold text-slate-600 dark:text-slate-300"
              >
                Group Name
              </label>
              <span className="text-[10px] text-slate-400">
                {memberNodes.length} {memberNodes.length === 1 ? 'entity' : 'entities'}
              </span>
            </div>
            <input
              id="sidebar-node-name-input"
              type="text"
              onFocus={() => {
                beginEditSession()
                renameOriginRef.current = { nodeId: node.id, label: data.label }
              }}
              onBlur={(e) => {
                const origin = renameOriginRef.current
                if (origin && origin.nodeId === node.id) {
                  renameEntityLabel(node.id, e.currentTarget.value, {
                    fromLabel: origin.label,
                    recordHistory: false
                  })
                  renameOriginRef.current = null
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur()
                }
              }}
              className="border border-slate-300 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 w-full font-semibold"
              value={data.label}
              onChange={(e) => {
                ensureHistoryOnce()
                updateNodeData(node.id, { label: e.target.value }, false)
              }}
            />
          </div>

          {/* Single-Row Accessible 4-Tab Bar */}
          <div
            ref={groupTablistRef}
            {...({ focusgroup: 'tablist nomemory' } as any)}
            aria-label="Group editor sections"
            className="entity-tablist border-b border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-900/80 shrink-0 px-2"
          >
            {GROUP_TABS.map((tab) => {
              const isSelected = activeGroupTab === tab.id
              const Icon = tab.Icon
              return (
                <button
                  key={tab.id}
                  type="button"
                  id={`${baseId}-group-tab-${tab.id}`}
                  aria-selected={isSelected}
                  {...(isSelected ? ({ focusgroupstart: '' } as any) : {})}
                  onClick={() => setActiveGroupTab(tab.id)}
                  className="entity-tab py-2.5 px-2 text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
                >
                  <Icon size={13} aria-hidden="true" />
                  <span>{tab.label}</span>
                  {tab.id === 'links' && linkSummary.total > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-slate-200/85 dark:bg-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-200">
                      {linkSummary.total}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Scrollable Tab Panels */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]">
            <div ref={groupPanelsRef} className="share-tabpanels">
              {/* ==================== TAB 1: GROUP DETAILS & ROSTER ==================== */}
              <div
                role="tabpanel"
                data-tab-id="group"
                aria-labelledby={`${baseId}-group-tab-group`}
                hidden={activeGroupTab !== 'group' ? ('until-found' as any) : undefined}
              >
                <div className="p-4 flex flex-col gap-3.5 [&>*]:shrink-0">
                  {/* Subtitle */}
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor={`${baseId}-group-subtitle`}
                      className="text-xs font-semibold text-slate-600 dark:text-slate-300"
                    >
                      Subtitle / Region Tag
                    </label>
                    <input
                      id={`${baseId}-group-subtitle`}
                      type="text"
                      placeholder="e.g. Northern Alliance · Camp in Dale"
                      onFocus={beginEditSession}
                      value={data.groupSubtitle || ''}
                      onChange={(e) => {
                        ensureHistoryOnce()
                        updateNodeData(node.id, { groupSubtitle: e.target.value }, false)
                      }}
                      className="border border-slate-300 dark:border-slate-700 rounded-md p-1.5 text-xs outline-none bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 placeholder-slate-400"
                    />
                  </div>

                  {/* Party Standing & Quest / Arc Status */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor={`${baseId}-group-disposition`}
                        className="text-[11px] font-semibold text-slate-600 dark:text-slate-300"
                      >
                        Party Standing
                      </label>
                      <select
                        id={`${baseId}-group-disposition`}
                        value={f.disposition || ''}
                        onChange={(e) =>
                          updateDndField(
                            { disposition: (e.target.value as PartyDisposition) || '' },
                            true
                          )
                        }
                        className="border border-slate-300 dark:border-slate-700 rounded-md p-1.5 text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                      >
                        <option value="">— Unset —</option>
                        <option value="Allied">★ Allied</option>
                        <option value="Friendly">☺ Friendly</option>
                        <option value="Neutral">• Neutral</option>
                        <option value="Suspicious">? Suspicious</option>
                        <option value="Hostile">⚔ Hostile</option>
                        <option value="Unknown">◌ Unknown</option>
                        <option value="Deceased">☠ Fallen / Ruined</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor={`${baseId}-group-quest-status`}
                        className="text-[11px] font-semibold text-slate-600 dark:text-slate-300"
                      >
                        Quest / Arc Status
                      </label>
                      <select
                        id={`${baseId}-group-quest-status`}
                        value={f.questStatus || ''}
                        onChange={(e) =>
                          updateDndField(
                            { questStatus: (e.target.value as QuestStatus) || '' },
                            true
                          )
                        }
                        className="border border-slate-300 dark:border-slate-700 rounded-md p-1.5 text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                      >
                        <option value="">— Unset —</option>
                        <option value="Rumor">Rumor</option>
                        <option value="Active">Active</option>
                        <option value="Completed">Completed</option>
                        <option value="Failed">Failed</option>
                      </select>
                    </div>
                  </div>

                  {/* DM Quick Stat / Force Summary Line */}
                  {!isPlayerEdition && (
                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor={`${baseId}-group-stats`}
                        className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex items-center justify-between"
                      >
                        <span>Quick Stat / Force Summary</span>
                        <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400">
                          DM Only
                        </span>
                      </label>
                      <input
                        id={`${baseId}-group-stats`}
                        type="text"
                        placeholder="e.g. Garrison: 500 Spears | Recon DC 16"
                        onFocus={beginEditSession}
                        value={data.stats || ''}
                        onChange={(e) => {
                          ensureHistoryOnce()
                          updateNodeData(node.id, { stats: e.target.value }, false)
                        }}
                        className="border border-slate-300 dark:border-slate-700 rounded-md p-1.5 text-xs outline-none bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 placeholder-slate-400"
                      />
                    </div>
                  )}

                  {/* Collapsible Group Sheet Details */}
                  <details
                    open
                    className="dcc-disclosure rounded-lg bg-slate-50/90 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 overflow-clip shrink-0"
                  >
                    <summary className="px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 select-none hover:bg-slate-100/80 dark:hover:bg-slate-800/70 rounded-lg">
                      <ChevronDown
                        size={13}
                        aria-hidden="true"
                        className="dcc-disclosure-chevron text-slate-500 dark:text-slate-400 shrink-0"
                      />
                      <span>Group Sheet Details</span>
                      {hasAnyGroupSheetDetail && (
                        <span className="ml-auto px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-[10px] font-bold">
                          Active
                        </span>
                      )}
                    </summary>
                    <div className="px-3 pb-3 pt-1 grid grid-cols-2 gap-2 border-t border-slate-200/80 dark:border-slate-700/70">
                      <div className="flex flex-col gap-1">
                        <label
                          htmlFor={`${baseId}-group-region`}
                          className="text-[11px] font-medium text-slate-500 dark:text-slate-400"
                        >
                          Region / Realm
                        </label>
                        <input
                          id={`${baseId}-group-region`}
                          type="text"
                          placeholder="e.g. Wilderland"
                          onFocus={beginEditSession}
                          value={f.region || ''}
                          onChange={(e) => {
                            ensureHistoryOnce()
                            updateDndField({ region: e.target.value }, false)
                          }}
                          className="border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label
                          htmlFor={`${baseId}-group-influence`}
                          className="text-[11px] font-medium text-slate-500 dark:text-slate-400"
                        >
                          Influence / Scope
                        </label>
                        <input
                          id={`${baseId}-group-influence`}
                          type="text"
                          placeholder="e.g. Allied Warhost"
                          onFocus={beginEditSession}
                          value={f.influence || ''}
                          onChange={(e) => {
                            ensureHistoryOnce()
                            updateDndField({ influence: e.target.value }, false)
                          }}
                          className="border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                        />
                      </div>

                      <div className="flex flex-col gap-1 col-span-2">
                        <label
                          htmlFor={`${baseId}-group-hq`}
                          className="text-[11px] font-medium text-slate-500 dark:text-slate-400"
                        >
                          Headquarters / Seat
                        </label>
                        <input
                          id={`${baseId}-group-hq`}
                          type="text"
                          placeholder="e.g. Ruins of Dale"
                          onFocus={beginEditSession}
                          value={f.headquarters || ''}
                          onChange={(e) => {
                            ensureHistoryOnce()
                            updateDndField({ headquarters: e.target.value }, false)
                          }}
                          className="border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                        />
                      </div>

                      <div className="flex flex-col gap-1 col-span-2">
                        <label
                          htmlFor={`${baseId}-group-goal`}
                          className="text-[11px] font-medium text-slate-500 dark:text-slate-400"
                        >
                          Goal / Objective
                        </label>
                        <input
                          id={`${baseId}-group-goal`}
                          type="text"
                          placeholder="e.g. Claim share of the Dragon-hoard"
                          onFocus={beginEditSession}
                          value={f.goal || ''}
                          onChange={(e) => {
                            ensureHistoryOnce()
                            updateDndField({ goal: e.target.value }, false)
                          }}
                          className="border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                        />
                      </div>

                      {!isPlayerEdition && (
                        <div className="flex flex-col gap-1 col-span-2 pt-1 border-t border-amber-200/70 dark:border-amber-800/50">
                          <label
                            htmlFor={`${baseId}-group-danger`}
                            className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1"
                          >
                            <Lock size={10} aria-hidden="true" /> Danger / Threat Tier (DM Only)
                          </label>
                          <input
                            id={`${baseId}-group-danger`}
                            type="text"
                            placeholder="e.g. Tier 3 Siege Zone · Deadly Patrols"
                            onFocus={beginEditSession}
                            value={f.dangerTier || ''}
                            onChange={(e) => {
                              ensureHistoryOnce()
                              updateDndField({ dangerTier: e.target.value }, false)
                            }}
                            className="border border-amber-300 dark:border-amber-800/70 rounded p-1.5 text-xs bg-amber-50/50 dark:bg-amber-950/20 text-slate-800 dark:text-slate-200"
                          />
                        </div>
                      )}
                    </div>
                  </details>

                  {/* Lock Group & Members */}
                  {!isPlayerEdition && (
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 flex items-start justify-between gap-2">
                      <label
                        htmlFor={`${baseId}-group-lock`}
                        className="text-xs text-slate-700 dark:text-slate-200 cursor-pointer select-none flex flex-col gap-0.5"
                      >
                        <span className="font-bold flex items-center gap-1.5">
                          <Lock
                            size={12}
                            className="text-amber-600 dark:text-amber-400"
                            aria-hidden="true"
                          />
                          Lock Group &amp; Members
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          Prevents accidental dragging or resizing while still allowing connections.
                        </span>
                      </label>
                      <input
                        id={`${baseId}-group-lock`}
                        type="checkbox"
                        className="mt-0.5 rounded accent-blue-600 cursor-pointer"
                        checked={Boolean(data.isLocked)}
                        onChange={(e) => toggleNodeLock([node.id], e.target.checked)}
                      />
                    </div>
                  )}

                  {/* Members List, Layout Actions & Add Member */}
                  <div className="p-3 rounded-lg bg-slate-50/80 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                        Entities in Group ({memberNodes.length})
                      </span>
                    </div>

                    {memberNodes.length > 0 && (
                      <div className="grid grid-cols-3 gap-1">
                        <button
                          type="button"
                          onClick={() => tidyGroupMembers(node.id)}
                          title="Arrange member entities into a clean snapped grid and fit group frame"
                          className="py-1 px-1.5 rounded bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-[11px] font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center justify-center gap-1 transition-colors cursor-pointer"
                        >
                          <LayoutGrid size={11} aria-hidden="true" />
                          <span>Tidy Grid</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => fitGroupToMembers(node.id)}
                          title="Shrink or expand group frame snugly around current members"
                          className="py-1 px-1.5 rounded bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-[11px] font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center justify-center gap-1 transition-colors cursor-pointer"
                        >
                          <Shrink size={11} aria-hidden="true" />
                          <span>Fit Bounds</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => selectGroupMembers(node.id)}
                          title="Select all member entities in Batch Studio"
                          className="py-1 px-1.5 rounded bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-[11px] font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center justify-center gap-1 transition-colors cursor-pointer"
                        >
                          <MousePointerClick size={11} aria-hidden="true" />
                          <span>Select All</span>
                        </button>
                      </div>
                    )}

                    {memberNodes.length === 0 ? (
                      <p className="text-xs italic text-slate-400 dark:text-slate-500">
                        No member entities assigned yet. Add entities below or multi-select cards on
                        the canvas and right-click to group.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-1 max-h-44 overflow-y-auto pr-0.5">
                        {memberNodes.map((m) => (
                          <div
                            key={m.id}
                            className="flex items-center justify-between gap-2 px-2 py-1.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                          >
                            <button
                              type="button"
                              onClick={() => onNavigateToNode(m.id)}
                              title={`Inspect ${m.data.label}`}
                              className="font-semibold text-blue-600 dark:text-blue-400 hover:underline truncate text-left cursor-pointer"
                            >
                              {m.data.label}
                            </button>
                            <button
                              type="button"
                              aria-label={`Remove ${m.data.label} from group`}
                              title="Remove from group (keeps entity on canvas)"
                              onClick={() => assignNodesToGroup([m.id], undefined)}
                              className="text-[11px] font-semibold text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 shrink-0 cursor-pointer"
                            >
                              Detach
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {addableEntities.length > 0 && !isPlayerEdition && (
                      <div className="pt-1.5 border-t border-slate-200/80 dark:border-slate-700/70 flex flex-col gap-1">
                        <label
                          htmlFor={`${baseId}-group-add-member`}
                          className="text-[11px] font-semibold text-slate-500 dark:text-slate-400"
                        >
                          Add Existing Entity to Group
                        </label>
                        <select
                          id={`${baseId}-group-add-member`}
                          value=""
                          onChange={(e) => {
                            if (e.target.value) {
                              assignNodesToGroup([e.target.value], node.id)
                            }
                          }}
                          className="border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                        >
                          <option value="">+ Choose entity to include...</option>
                          {addableEntities.map((ent) => (
                            <option key={ent.id} value={ent.id}>
                              {ent.data.label} ({ent.data.entityType})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Aliases & Campaign #Tags */}
                  {renderAliasesAndTagsCard()}

                  {/* Player Visibility */}
                  {!isPlayerEdition && (
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                      <input
                        type="checkbox"
                        id={`${baseId}-group-hidden`}
                        className="rounded accent-blue-600 cursor-pointer"
                        checked={Boolean(data.isHidden)}
                        onChange={(e) =>
                          updateNodeData(node.id, { isHidden: e.target.checked }, true)
                        }
                      />
                      <label
                        htmlFor={`${baseId}-group-hidden`}
                        className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none"
                      >
                        Hide Group Frame in Player View
                      </label>
                    </div>
                  )}

                  {/* Ungroup vs Delete Group & Contents */}
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => ungroupNodes(node.id)}
                      className="w-full py-2 px-3 rounded-md bg-amber-50 dark:bg-amber-950/35 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/45 border border-amber-200 dark:border-amber-800/70 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <FolderMinus size={14} aria-hidden="true" />
                      <span>Ungroup (Keep Entities)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (onRequestDeleteGroupWithContents) {
                          onRequestDeleteGroupWithContents(node.id)
                        } else {
                          setConfirmState({
                            title: 'Delete Group & Contents?',
                            message: `Delete group "${data.label}" along with ${memberNodes.length} member ${memberNodes.length === 1 ? 'entity' : 'entities'}? Use "Ungroup (Keep Entities)" instead if you only want to remove the frame.`,
                            confirmLabel: 'Delete Group & Contents',
                            onConfirm: () => deleteGroupWithContents(node.id)
                          })
                        }
                      }}
                      className="w-full py-2 bg-red-50 dark:bg-red-900/25 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/45 rounded-md text-xs font-bold transition-colors border border-red-200 dark:border-red-800/60 cursor-pointer"
                    >
                      Delete Group &amp; Contents
                    </button>
                  </div>
                </div>
              </div>

              {/* ==================== TAB 2: GROUP LORE ==================== */}
              <div
                role="tabpanel"
                data-tab-id="lore"
                aria-labelledby={`${baseId}-group-tab-lore`}
                hidden={activeGroupTab !== 'lore' ? ('until-found' as any) : undefined}
              >
                <div className="p-4 flex flex-col gap-4 [&>*]:shrink-0">
                  {renderLoreEditorSection('Public Group Lore', 5, 5)}
                </div>
              </div>

              {/* ==================== TAB 3: GROUP STYLE & STATUS MARKERS ==================== */}
              <div
                role="tabpanel"
                data-tab-id="style"
                aria-labelledby={`${baseId}-group-tab-style`}
                hidden={activeGroupTab !== 'style' ? ('until-found' as any) : undefined}
              >
                <div className="p-4 flex flex-col gap-4 [&>*]:shrink-0">
                  {/* Group Background & Frame */}
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                        <PaintBucket size={13} className="text-blue-500" aria-hidden="true" />
                        Group Background &amp; Frame
                      </span>
                      <button
                        type="button"
                        aria-pressed={hasBackground}
                        onClick={() =>
                          updateNodeData(
                            node.id,
                            {
                              hasBackground: !hasBackground,
                              groupBorderStyle: !hasBackground
                                ? data.groupBorderStyle || 'solid'
                                : data.groupBorderStyle
                            },
                            true
                          )
                        }
                        className={`px-2.5 py-1 rounded text-[11px] font-bold border transition-colors cursor-pointer ${
                          hasBackground
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600 hover:border-blue-500'
                        }`}
                      >
                        {hasBackground ? 'Background On' : 'Add Background'}
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug -mt-1">
                      Connection lines to entities inside the group automatically render crisp on top
                      of the group background.
                    </p>

                    {/* 7 Preset Tint Swatches + Arbitrary Custom Color Picker */}
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                          Region Color Tint
                        </span>
                        {customGroupHex && (
                          <button
                            type="button"
                            onClick={() =>
                              updateNodeData(node.id, { groupCustomColor: undefined }, true)
                            }
                            className="text-[11px] font-semibold text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <RotateCcw size={11} aria-hidden="true" />
                            <span>Use Preset</span>
                          </button>
                        )}
                      </div>
                      <div
                        className="flex items-center gap-2 flex-wrap"
                        role="group"
                        aria-label="Region color tint"
                      >
                        {GROUP_TINT_PALETTE.map((tint) => {
                          const selectedSwatch = !customGroupHex && activeTint === tint.key
                          return (
                            <button
                              key={tint.key}
                              type="button"
                              aria-label={tint.label}
                              aria-pressed={selectedSwatch}
                              title={`${tint.label} (sets group tint)`}
                              onClick={() =>
                                updateNodeData(
                                  node.id,
                                  {
                                    groupColor: tint.key,
                                    groupCustomColor: undefined,
                                    hasBackground: true
                                  },
                                  true
                                )
                              }
                              style={{ backgroundColor: tint.swatchHex }}
                              className={`dcc-color-swatch w-6 h-6 rounded-full border-2 inline-flex items-center justify-center transition-transform cursor-pointer ${
                                selectedSwatch
                                  ? 'border-slate-900 dark:border-white scale-110 ring-2 ring-blue-500/60'
                                  : 'border-slate-400/70 dark:border-slate-600 hover:scale-105'
                              }`}
                            >
                              {selectedSwatch && (
                                <Check
                                  size={12}
                                  strokeWidth={3}
                                  aria-hidden="true"
                                  className="text-white drop-shadow"
                                />
                              )}
                            </button>
                          )
                        })}
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/70 dark:border-slate-700/70">
                        <label
                          htmlFor={`${baseId}-group-custom-color`}
                          className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
                        >
                          Custom Background Color
                        </label>
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-mono font-semibold text-slate-600 dark:text-slate-300">
                            {customGroupHex ? customGroupHex.toUpperCase() : resolvedGroupTint.label}
                          </span>
                          <input
                            id={`${baseId}-group-custom-color`}
                            type="color"
                            aria-label="Custom group background color"
                            value={resolvedGroupTint.swatchHex}
                            onPointerDown={() => useStore.getState().pushHistory(true)}
                            onChange={(e) =>
                              updateNodeData(
                                node.id,
                                { groupCustomColor: e.target.value, hasBackground: true },
                                false
                              )
                            }
                            className="dcc-color-swatch w-7 h-7 rounded border border-slate-300 dark:border-slate-600 cursor-pointer bg-transparent p-0.5"
                          />
                        </div>
                      </div>
                    </div>

                    {hasBackground && (
                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between">
                          <label
                            htmlFor={`${baseId}-group-opacity`}
                            className="text-[11px] font-semibold text-slate-600 dark:text-slate-300"
                          >
                            Backdrop Strength
                          </label>
                          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            {opacityPct}%
                          </span>
                        </div>
                        <input
                          id={`${baseId}-group-opacity`}
                          type="range"
                          min="0.08"
                          max="0.50"
                          step="0.02"
                          value={data.groupOpacity ?? 0.16}
                          onPointerDown={() => useStore.getState().pushHistory(true)}
                          onChange={(e) =>
                            updateNodeData(
                              node.id,
                              { groupOpacity: parseFloat(e.target.value) },
                              false
                            )
                          }
                          className="w-full cursor-pointer accent-blue-600"
                        />
                      </div>
                    )}

                    {/* Border Style */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        Perimeter Border
                      </span>
                      <div
                        className="grid grid-cols-3 gap-1.5"
                        role="group"
                        aria-label="Perimeter border style"
                      >
                        {(
                          [
                            { key: 'dashed', label: 'Dashed' },
                            { key: 'solid', label: 'Solid' },
                            { key: 'double', label: 'Double' }
                          ] as Array<{ key: GroupBorderStyle; label: string }>
                        ).map((opt) => {
                          const active = activeBorderStyle === opt.key
                          return (
                            <button
                              key={opt.key}
                              type="button"
                              aria-pressed={active}
                              onClick={() =>
                                updateNodeData(node.id, { groupBorderStyle: opt.key }, true)
                              }
                              className={`py-1 rounded text-xs font-semibold border transition-colors cursor-pointer ${
                                active
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                              }`}
                            >
                              {opt.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Frame Shape & Header Position */}
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/70 dark:border-slate-700/70">
                      <div className="flex flex-col gap-1">
                        <label
                          htmlFor={`${baseId}-group-shape`}
                          className="text-[11px] font-semibold text-slate-600 dark:text-slate-300"
                        >
                          Corner Shape
                        </label>
                        <select
                          id={`${baseId}-group-shape`}
                          value={activeGroupShape}
                          onChange={(e) =>
                            updateNodeData(
                              node.id,
                              { groupShape: e.target.value as GroupShape },
                              true
                            )
                          }
                          className="border border-slate-300 dark:border-slate-700 rounded-md p-1.5 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                        >
                          <option value="rounded">Rounded</option>
                          <option value="sharp">Sharp Box</option>
                          <option value="beveled">Beveled Banner</option>
                          <option value="arch">Sanctuary Arch</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                          Header Position
                        </span>
                        <div
                          className="grid grid-cols-2 gap-1"
                          role="group"
                          aria-label="Group header alignment"
                        >
                          {(
                            [
                              { key: 'left', label: 'Left' },
                              { key: 'center', label: 'Center' }
                            ] as Array<{ key: GroupHeaderAlign; label: string }>
                          ).map((opt) => {
                            const active = activeHeaderAlign === opt.key
                            return (
                              <button
                                key={opt.key}
                                type="button"
                                aria-pressed={active}
                                onClick={() =>
                                  updateNodeData(node.id, { groupHeaderAlign: opt.key }, true)
                                }
                                className={`py-1.5 rounded text-xs font-semibold border transition-colors cursor-pointer ${
                                  active
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                                }`}
                              >
                                {opt.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Group Header Icon & Crest / Banner Art */}
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                          Group Header Icon
                        </span>
                        {data.groupIcon && (
                          <button
                            type="button"
                            onClick={() => updateNodeData(node.id, { groupIcon: undefined }, true)}
                            className="text-[11px] font-semibold text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <RotateCcw size={11} aria-hidden="true" />
                            <span>Default</span>
                          </button>
                        )}
                      </div>
                      <div
                        className="flex flex-wrap gap-1 max-h-32 overflow-y-auto p-1.5 border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900"
                        role="group"
                        aria-label="Group header icon"
                      >
                        {sortedStatusIcons.map((name) => {
                          const IconComponent = availableIcons[name]
                          const isSelectedIcon = data.groupIcon === name
                          return (
                            <button
                              key={name}
                              type="button"
                              aria-label={`Set group icon to ${name}`}
                              aria-pressed={isSelectedIcon}
                              title={name}
                              onClick={() =>
                                updateNodeData(
                                  node.id,
                                  { groupIcon: isSelectedIcon ? undefined : name },
                                  true
                                )
                              }
                              className={`p-1.5 rounded border transition-colors cursor-pointer ${
                                isSelectedIcon
                                  ? 'bg-amber-100 dark:bg-amber-900/50 border-amber-500 ring-1 ring-amber-500/60'
                                  : 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              <IconComponent
                                size={14}
                                aria-hidden="true"
                                className={getIconColor(name)}
                              />
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Crest / Emblem / Banner Art */}
                    <div className="flex flex-col gap-2 pt-2 border-t border-slate-200/80 dark:border-slate-700/70">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                          Crest / Banner Art
                        </span>
                        {data.portrait && (
                          <button
                            type="button"
                            onClick={() => updateNodeData(node.id, { portrait: undefined }, true)}
                            className="text-[11px] text-red-500 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 size={11} aria-hidden="true" /> Remove
                          </button>
                        )}
                      </div>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        aria-label="Upload group crest or banner image"
                        className="hidden"
                        onChange={(e) => {
                          handlePortraitUpload(e.target.files?.[0])
                          e.target.value = ''
                        }}
                      />

                      <div
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault()
                          handlePortraitUpload(e.dataTransfer.files?.[0])
                        }}
                        className="flex items-center gap-2.5"
                      >
                        {data.portrait ? (
                          <img
                            src={data.portrait}
                            alt={`Emblem of ${data.label}`}
                            className="w-12 h-12 rounded-lg object-cover border border-slate-300 dark:border-slate-600 shrink-0"
                          />
                        ) : null}
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploadingPortrait}
                          className="flex-1 py-2 px-2.5 rounded-md border border-dashed border-slate-300 dark:border-slate-600 hover:border-blue-500 dark:hover:border-blue-400 text-xs font-medium text-slate-600 dark:text-slate-300 flex items-center justify-center gap-1.5 bg-white dark:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <Upload size={13} aria-hidden="true" />
                          <span>
                            {isUploadingPortrait
                              ? 'Compressing...'
                              : data.portrait
                                ? 'Replace Art'
                                : 'Upload Crest / Banner'}
                          </span>
                        </button>
                      </div>

                      {data.portrait && (
                        <div
                          className="grid grid-cols-3 gap-1"
                          role="group"
                          aria-label="Group emblem display mode"
                        >
                          {(
                            [
                              { mode: 'badge', label: 'Crest Badge' },
                              { mode: 'banner', label: 'Top Banner' },
                              { mode: 'hidden', label: 'Handout Only' }
                            ] as Array<{ mode: GroupPortraitMode; label: string }>
                          ).map((item) => {
                            const active = activeGroupPortraitMode === item.mode
                            return (
                              <button
                                key={item.mode}
                                type="button"
                                aria-pressed={active}
                                onClick={() =>
                                  updateNodeData(node.id, { groupPortraitMode: item.mode }, true)
                                }
                                className={`py-1 rounded text-[11px] font-semibold border transition-colors cursor-pointer ${
                                  active
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                                }`}
                              >
                                {item.label}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Stacking Order among Overlapping Groups */}
                  {renderStackingOrderSection(true)}

                  {/* Status Markers (40-icon grid shared with Entities) */}
                  {renderStatusMarkersPicker()}
                </div>
              </div>

              {/* ==================== TAB 4: GROUP LINKS & BACKLINKS ==================== */}
              <div
                role="tabpanel"
                data-tab-id="links"
                aria-labelledby={`${baseId}-group-tab-links`}
                hidden={activeGroupTab !== 'links' ? ('until-found' as any) : undefined}
              >
                <div className="p-4 flex flex-col gap-3 [&>*]:shrink-0">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Drag from any handle on the group perimeter to connect the group as a whole, or
                    mention{' '}
                    <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300">
                      [[{data.label || 'Group'}]]
                    </code>{' '}
                    in Lore notes to build automatic backlinks.
                  </p>
                  {renderCustomPortsSection()}
                  <ConnectionsBacklinksSection
                    nodeId={node.id}
                    nodes={nodes}
                    edges={edges}
                    hideSecrets={isPlayerEdition}
                    hideTopBorder
                    defaultOpenEmpty
                    onNavigateToNode={onNavigateToNode}
                    onSelectEdge={(edgeId) => {
                      setNodes(nodes.map((n) => ({ ...n, selected: false })))
                      setEdges(edges.map((e) => ({ ...e, selected: e.id === edgeId })))
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </aside>

        <ConfirmModal
          open={confirmState !== null}
          title={confirmState?.title || ''}
          message={confirmState?.message || ''}
          confirmLabel={confirmState?.confirmLabel}
          onConfirm={() => confirmState?.onConfirm()}
          onCancel={() => setConfirmState(null)}
        />
      </>
    )
  }

  // ==================== TABBED EDIT ENTITY INSPECTOR ====================

  const archetype = resolveCategoryArchetype(data.entityType, customEntityTypes)
  const isCharacter = archetype === 'character'
  const isLocation = archetype === 'location'
  const isItem = archetype === 'item'
  const isOrg = archetype === 'organization'
  const activeCustomCategory = customEntityTypes.find((t) => t.label === data.entityType)

  return (
    <>
      <aside
        aria-label={isPlayerEdition ? 'Theory pin editor' : 'Entity editor'}
        className={`absolute right-0 top-0 h-full w-88 bg-white dark:bg-slate-800 shadow-2xl border-l border-slate-200 dark:border-slate-700 z-20 flex flex-col ${className || ''}`}
      >
        {/* Pinned Header Bar */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900 shrink-0">
          <h2 className="font-bold text-base text-slate-800 dark:text-slate-100">
            {isPlayerEdition ? 'Edit Theory Pin' : 'Edit Entity'}
          </h2>
          <div className="flex items-center gap-1">
            {!isPlayerEdition && (
              <button
                type="button"
                onClick={() => toggleNodeLock([node.id])}
                aria-label="Lock entity position"
                aria-pressed={Boolean(data.isLocked)}
                title={
                  data.isLocked
                    ? 'Entity position locked (click to unlock)'
                    : parentGroup?.data?.isLocked
                      ? `Locked via group "${parentGroup.data.label}"`
                      : 'Lock entity position on canvas'
                }
                className={`p-1.5 rounded border text-xs font-semibold transition-colors cursor-pointer ${
                  effectivelyLocked
                    ? 'bg-sky-100 dark:bg-sky-900/45 text-sky-800 dark:text-sky-200 border-sky-300 dark:border-sky-700'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 border-transparent hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
                }`}
              >
                {effectivelyLocked ? (
                  <Lock size={14} aria-hidden="true" />
                ) : (
                  <Unlock size={14} aria-hidden="true" />
                )}
              </button>
            )}
            {!isPlayerEdition && onMysterySpotlightNode && Boolean(data.portrait) && (
              <button
                type="button"
                onClick={() => onMysterySpotlightNode(node.id)}
                title="Mystery Spotlight: show ONLY portrait art as '???' on Player Screen without revealing identity or unhiding secrets"
                className="px-2 py-1 rounded bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/40 dark:hover:bg-purple-800/60 text-purple-900 dark:text-purple-200 border border-purple-300 dark:border-purple-700/70 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <HelpCircle size={12} aria-hidden="true" />
                <span>???</span>
              </button>
            )}
            {!isPlayerEdition && onSpotlightNode && (
              <button
                type="button"
                onClick={() => onSpotlightNode(node.id)}
                title="Spotlight this entity on the 2nd-screen Player Window"
                className="px-2 py-1 rounded bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/40 dark:hover:bg-amber-800/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700/70 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer mr-0.5"
              >
                <Sparkles size={12} aria-hidden="true" />
                <span>Spotlight</span>
              </button>
            )}
            <button
              type="button"
              aria-label="Duplicate entity"
              onClick={() => duplicateSelection(node.id)}
              title="Duplicate Entity (Ctrl+D)"
              className="p-1.5 rounded text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 cursor-pointer"
            >
              <Files size={15} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Close entity editor"
              className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              onClick={closeSidebar}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Pinned Entity Name Bar (Always Visible Across All 4 Tabs) */}
        <div className="px-4 pt-3 pb-2.5 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shrink-0 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <label
              htmlFor="sidebar-node-name-input"
              className="text-xs font-semibold text-slate-600 dark:text-slate-300"
            >
              Name
            </label>
            <span id={`${baseId}-rename-hint`} className="text-[10px] text-slate-400">
              Auto-updates [[Wiki-Links]]
            </span>
          </div>
          <input
            id="sidebar-node-name-input"
            type="text"
            aria-describedby={`${baseId}-rename-hint`}
            onFocus={() => {
              beginEditSession()
              renameOriginRef.current = { nodeId: node.id, label: data.label }
            }}
            onBlur={(e) => {
              const origin = renameOriginRef.current
              if (origin && origin.nodeId === node.id) {
                renameEntityLabel(node.id, e.currentTarget.value, {
                  fromLabel: origin.label,
                  recordHistory: false
                })
                renameOriginRef.current = null
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur()
              }
            }}
            className="border border-slate-300 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 w-full font-semibold"
            value={data.label}
            onChange={(e) => {
              ensureHistoryOnce()
              updateNodeData(node.id, { label: e.target.value }, false)
            }}
          />
        </div>

        {/* Single-Row Accessible 4-Tab Bar (`Details` | `Lore` | `Style` | `Links`) */}
        <div
          ref={entityTablistRef}
          {...({ focusgroup: 'tablist nomemory' } as any)}
          aria-label="Entity editor sections"
          className="entity-tablist border-b border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-900/80 shrink-0 px-1.5"
        >
          {ENTITY_TABS.map((tab) => {
            const isSelected = activeEntityTab === tab.id
            const Icon = tab.Icon
            return (
              <button
                key={tab.id}
                type="button"
                id={`${baseId}-entity-tab-${tab.id}`}
                aria-selected={isSelected}
                {...(isSelected ? ({ focusgroupstart: '' } as any) : {})}
                onClick={() => setActiveEntityTab(tab.id)}
                className="entity-tab py-2.5 px-1.5 text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
              >
                <Icon size={13} aria-hidden="true" />
                <span>{tab.label}</span>
                {tab.id === 'lore' && hasAnyLore && (
                  <span
                    aria-hidden="true"
                    className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"
                  />
                )}
                {tab.id === 'links' && linkSummary.total > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-slate-200/85 dark:bg-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-200">
                    {linkSummary.total}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Scrollable Tab Panels Viewport */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]">
          <div ref={entityPanelsRef} className="share-tabpanels">
            {/* ==================== TAB 1: DETAILS ==================== */}
            <div
              role="tabpanel"
              data-tab-id="details"
              aria-labelledby={`${baseId}-entity-tab-details`}
              hidden={activeEntityTab !== 'details' ? ('until-found' as any) : undefined}
            >
              <div className="p-4 flex flex-col gap-4 [&>*]:shrink-0">
                {/* Entity Type & Custom Category Manager */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center">
                    <label
                      htmlFor={`${baseId}-entity-type`}
                      className="text-xs font-semibold text-slate-600 dark:text-slate-300"
                    >
                      Entity Type
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setCategoryEditorMode(
                          categoryEditorMode === 'create' ? 'closed' : 'create'
                        )
                      }
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
                    >
                      {categoryEditorMode === 'create' ? 'Cancel' : '+ Custom Type'}
                    </button>
                  </div>

                  {categoryEditorMode === 'create' ? (
                    <CustomCategoryManager
                      mode="create"
                      onCancel={() => setCategoryEditorMode('closed')}
                      onSave={(created) => {
                        addCustomEntityType(created)
                        updateNodeData(node.id, { entityType: created.label }, true)
                        setCategoryEditorMode('closed')
                      }}
                    />
                  ) : categoryEditorMode === 'edit' && activeCustomCategory ? (
                    <CustomCategoryManager
                      mode="edit"
                      initialValue={activeCustomCategory}
                      onCancel={() => setCategoryEditorMode('closed')}
                      onSave={(updated) => {
                        updateCustomEntityType(activeCustomCategory.label, updated)
                        setCategoryEditorMode('closed')
                      }}
                      onDelete={() => {
                        setCategoryEditorMode('closed')
                        setConfirmState({
                          title: `Delete "${activeCustomCategory.label}" Type?`,
                          message: `Remove custom entity type "${activeCustomCategory.label}"? This node will revert to NPC.`,
                          confirmLabel: 'Delete Type',
                          onConfirm: () => {
                            removeCustomEntityType(activeCustomCategory.label)
                            updateNodeData(node.id, { entityType: 'NPC' }, true)
                          }
                        })
                      }}
                    />
                  ) : (
                    <div className="flex flex-col gap-1">
                      <select
                        id={`${baseId}-entity-type`}
                        className="border border-slate-300 dark:border-slate-700 rounded-md p-2 text-sm outline-none bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 w-full"
                        value={data.entityType}
                        onChange={(e) =>
                          updateNodeData(
                            node.id,
                            { entityType: e.target.value as EntityType },
                            true
                          )
                        }
                      >
                        <option value="PC">Player Character (PC)</option>
                        <option value="NPC">Non-Player Character (NPC)</option>
                        <option value="Location">Location</option>
                        <option value="Item">Item / Artifact</option>
                        <option value="Organization">Organization / Faction</option>
                        <option value="Event">Event / Quest</option>
                        {customEntityTypes.map((t) => (
                          <option key={t.label} value={t.label}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                      {activeCustomCategory && (
                        <div className="flex items-center gap-3 mt-0.5">
                          <button
                            type="button"
                            onClick={() => setCategoryEditorMode('edit')}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium flex items-center gap-1 cursor-pointer"
                          >
                            <Pencil size={11} aria-hidden="true" /> Edit &lsquo;
                            {activeCustomCategory.label}&rsquo; Category
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmState({
                                title: `Delete "${data.entityType}" Type?`,
                                message: `Remove custom entity type "${data.entityType}"? This node will revert to NPC.`,
                                confirmLabel: 'Delete Type',
                                onConfirm: () => {
                                  removeCustomEntityType(data.entityType)
                                  updateNodeData(node.id, { entityType: 'NPC' }, true)
                                }
                              })
                            }
                            className="text-xs text-red-600 dark:text-red-400 hover:underline font-medium cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Promoted Top-of-Tab Status & Quick Stat Line */}
                {(isCharacter || !isPlayerEdition) && (
                  <div
                    className={
                      isCharacter && !isPlayerEdition
                        ? 'grid grid-cols-2 gap-2.5'
                        : 'flex flex-col gap-1'
                    }
                  >
                    {isCharacter && (
                      <div className="flex flex-col gap-1">
                        <label
                          htmlFor={`${baseId}-party-standing`}
                          className="text-xs font-semibold text-slate-600 dark:text-slate-300"
                        >
                          Party Standing / Status
                        </label>
                        <select
                          id={`${baseId}-party-standing`}
                          value={f.disposition || ''}
                          onChange={(e) =>
                            updateDndField(
                              { disposition: e.target.value as PartyDisposition | '' },
                              true
                            )
                          }
                          className="border border-slate-300 dark:border-slate-700 rounded-md p-1.5 text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                        >
                          <option value="">— Unset —</option>
                          <option value="Allied">★ Allied</option>
                          <option value="Friendly">☺ Friendly</option>
                          <option value="Neutral">• Neutral</option>
                          <option value="Suspicious">? Suspicious</option>
                          <option value="Hostile">⚔ Hostile</option>
                          <option value="Unknown">◌ Unknown</option>
                          <option value="Deceased">☠ Deceased</option>
                        </select>
                      </div>
                    )}

                    {!isPlayerEdition && (
                      <div className="flex flex-col gap-1">
                        <label
                          htmlFor={`${baseId}-quick-stats`}
                          className="text-xs font-semibold text-slate-600 dark:text-slate-300"
                        >
                          Quick Stat Line
                        </label>
                        <input
                          id={`${baseId}-quick-stats`}
                          type="text"
                          placeholder="AC 15 | HP 32"
                          onFocus={beginEditSession}
                          className="border border-slate-300 dark:border-slate-700 rounded-md p-1.5 text-xs outline-none bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 placeholder-slate-400"
                          value={data.stats || ''}
                          onChange={(e) => {
                            ensureHistoryOnce()
                            updateNodeData(node.id, { stats: e.target.value }, false)
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Contextual D&D Sheet Details (Native Collapsible Disclosure) */}
                <details
                  open
                  className="group rounded-lg border border-slate-200 dark:border-slate-700 overflow-clip shrink-0"
                >
                  <summary className="list-none [&::-webkit-details-marker]:hidden px-3 py-2 bg-slate-50 dark:bg-slate-900/80 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                    <ChevronRight
                      size={14}
                      aria-hidden="true"
                      className="text-slate-400 transition-transform duration-150 motion-reduce:transition-none group-open:rotate-90 shrink-0"
                    />
                    <span>D&amp;D Sheet Details ({data.entityType})</span>
                  </summary>

                  <div className="p-3 flex flex-col gap-2.5 bg-white dark:bg-slate-800/60 border-t border-slate-200/80 dark:border-slate-700/70">

                  {isCharacter && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-0.5">
                          <label
                            htmlFor={`${baseId}-dnd-ancestry`}
                            className="text-[11px] font-semibold text-slate-500 dark:text-slate-400"
                          >
                            Ancestry / Species
                          </label>
                          <input
                            id={`${baseId}-dnd-ancestry`}
                            type="text"
                            placeholder="e.g. Shield Dwarf"
                            onFocus={beginEditSession}
                            value={f.ancestry || ''}
                            onChange={(e) => {
                              ensureHistoryOnce()
                              updateDndField({ ancestry: e.target.value })
                            }}
                            className="border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                          />
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <label
                            htmlFor={`${baseId}-dnd-class`}
                            className="text-[11px] font-semibold text-slate-500 dark:text-slate-400"
                          >
                            Class / Role
                          </label>
                          <input
                            id={`${baseId}-dnd-class`}
                            type="text"
                            placeholder="e.g. Spymaster"
                            onFocus={beginEditSession}
                            value={f.classOrRole || ''}
                            onChange={(e) => {
                              ensureHistoryOnce()
                              updateDndField({ classOrRole: e.target.value })
                            }}
                            className="border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-0.5">
                        <label
                          htmlFor={`${baseId}-dnd-faction`}
                          className="text-[11px] font-semibold text-slate-500 dark:text-slate-400"
                        >
                          Faction / Allegiance
                        </label>
                        <input
                          id={`${baseId}-dnd-faction`}
                          type="text"
                          placeholder="e.g. Men of Dale"
                          onFocus={beginEditSession}
                          value={f.faction || ''}
                          onChange={(e) => {
                            ensureHistoryOnce()
                            updateDndField({ faction: e.target.value })
                          }}
                          className="border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                        />
                      </div>

                      {!isPlayerEdition && (
                        <div className="flex flex-col gap-0.5">
                          <label
                            htmlFor={`${baseId}-dnd-voice`}
                            className="text-[11px] font-semibold text-amber-700 dark:text-amber-300"
                          >
                            DM Voice / Roleplay Cue
                          </label>
                          <input
                            id={`${baseId}-dnd-voice`}
                            type="text"
                            placeholder="e.g. Grim baritone, taps bowstring"
                            onFocus={beginEditSession}
                            value={f.voiceCue || ''}
                            onChange={(e) => {
                              ensureHistoryOnce()
                              updateDndField({ voiceCue: e.target.value })
                            }}
                            className="border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                          />
                        </div>
                      )}
                    </>
                  )}

                  {isLocation && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-0.5">
                        <label
                          htmlFor={`${baseId}-dnd-region`}
                          className="text-[11px] font-semibold text-slate-500 dark:text-slate-400"
                        >
                          Region
                        </label>
                        <input
                          id={`${baseId}-dnd-region`}
                          type="text"
                          placeholder="e.g. Wilderland"
                          onFocus={beginEditSession}
                          value={f.region || ''}
                          onChange={(e) => {
                            ensureHistoryOnce()
                            updateDndField({ region: e.target.value })
                          }}
                          className="border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                        />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <label
                          htmlFor={`${baseId}-dnd-loctype`}
                          className="text-[11px] font-semibold text-slate-500 dark:text-slate-400"
                        >
                          Location Type
                        </label>
                        <input
                          id={`${baseId}-dnd-loctype`}
                          type="text"
                          placeholder="e.g. Fortress, Ruined City"
                          onFocus={beginEditSession}
                          value={f.locationType || ''}
                          onChange={(e) => {
                            ensureHistoryOnce()
                            updateDndField({ locationType: e.target.value })
                          }}
                          className="border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                        />
                      </div>
                      {!isPlayerEdition && (
                        <div className="col-span-2 flex flex-col gap-0.5">
                          <label
                            htmlFor={`${baseId}-dnd-danger`}
                            className="text-[11px] font-semibold text-amber-700 dark:text-amber-300"
                          >
                            DM Danger Tier
                          </label>
                          <input
                            id={`${baseId}-dnd-danger`}
                            type="text"
                            placeholder="e.g. High (Siege Zone)"
                            onFocus={beginEditSession}
                            value={f.dangerTier || ''}
                            onChange={(e) => {
                              ensureHistoryOnce()
                              updateDndField({ dangerTier: e.target.value })
                            }}
                            className="border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {isItem && (
                    <div className="flex flex-col gap-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-0.5">
                          <label
                            htmlFor={`${baseId}-dnd-rarity`}
                            className="text-[11px] font-semibold text-slate-500 dark:text-slate-400"
                          >
                            Rarity
                          </label>
                          <select
                            id={`${baseId}-dnd-rarity`}
                            value={f.rarity || ''}
                            onChange={(e) =>
                              updateDndField({ rarity: e.target.value as ItemRarity | '' }, true)
                            }
                            className="border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                          >
                            <option value="">— Unset —</option>
                            <option value="Common">Common</option>
                            <option value="Uncommon">Uncommon</option>
                            <option value="Rare">Rare</option>
                            <option value="Very Rare">Very Rare</option>
                            <option value="Legendary">Legendary</option>
                            <option value="Artifact">Artifact</option>
                          </select>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <label
                            htmlFor={`${baseId}-dnd-holder`}
                            className="text-[11px] font-semibold text-slate-500 dark:text-slate-400"
                          >
                            Current Holder
                          </label>
                          <input
                            id={`${baseId}-dnd-holder`}
                            type="text"
                            placeholder="e.g. Bilbo Baggins"
                            onFocus={beginEditSession}
                            value={f.holder || ''}
                            onChange={(e) => {
                              ensureHistoryOnce()
                              updateDndField({ holder: e.target.value })
                            }}
                            className="border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          id={`${baseId}-dnd-attune`}
                          type="checkbox"
                          checked={!!f.attunement}
                          onChange={(e) => updateDndField({ attunement: e.target.checked }, true)}
                          className="rounded accent-blue-600 cursor-pointer"
                        />
                        <label
                          htmlFor={`${baseId}-dnd-attune`}
                          className="text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none"
                        >
                          Requires Attunement
                        </label>
                      </div>
                    </div>
                  )}

                  {isOrg && (
                    <div className="flex flex-col gap-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-0.5">
                          <label
                            htmlFor={`${baseId}-dnd-influence`}
                            className="text-[11px] font-semibold text-slate-500 dark:text-slate-400"
                          >
                            Influence / Scope
                          </label>
                          <input
                            id={`${baseId}-dnd-influence`}
                            type="text"
                            placeholder="e.g. 500 Iron Hills Warriors"
                            onFocus={beginEditSession}
                            value={f.influence || ''}
                            onChange={(e) => {
                              ensureHistoryOnce()
                              updateDndField({ influence: e.target.value })
                            }}
                            className="border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                          />
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <label
                            htmlFor={`${baseId}-dnd-hq`}
                            className="text-[11px] font-semibold text-slate-500 dark:text-slate-400"
                          >
                            Headquarters / Camp
                          </label>
                          <input
                            id={`${baseId}-dnd-hq`}
                            type="text"
                            placeholder="e.g. Ruins of Dale"
                            onFocus={beginEditSession}
                            value={f.headquarters || ''}
                            onChange={(e) => {
                              ensureHistoryOnce()
                              updateDndField({ headquarters: e.target.value })
                            }}
                            className="border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <label
                          htmlFor={`${baseId}-dnd-goal`}
                          className="text-[11px] font-semibold text-slate-500 dark:text-slate-400"
                        >
                          Goal / Objective
                        </label>
                        <input
                          id={`${baseId}-dnd-goal`}
                          type="text"
                          placeholder="e.g. Claim share of the Dragon-hoard"
                          onFocus={beginEditSession}
                          value={f.goal || ''}
                          onChange={(e) => {
                            ensureHistoryOnce()
                            updateDndField({ goal: e.target.value })
                          }}
                          className="border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                        />
                      </div>
                    </div>
                  )}

                  {!isCharacter && !isLocation && !isItem && !isOrg && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-0.5">
                        <label
                          htmlFor={`${baseId}-dnd-queststatus`}
                          className="text-[11px] font-semibold text-slate-500 dark:text-slate-400"
                        >
                          Quest / Event Status
                        </label>
                        <select
                          id={`${baseId}-dnd-queststatus`}
                          value={f.questStatus || ''}
                          onChange={(e) =>
                            updateDndField(
                              { questStatus: e.target.value as QuestStatus | '' },
                              true
                            )
                          }
                          className="border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                        >
                          <option value="">— Unset —</option>
                          <option value="Rumor">Rumor</option>
                          <option value="Active">Active</option>
                          <option value="Completed">Completed</option>
                          <option value="Failed">Failed</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <label
                          htmlFor={`${baseId}-dnd-sessiondate`}
                          className="text-[11px] font-semibold text-slate-500 dark:text-slate-400"
                        >
                          Session / In-Game Date
                        </label>
                        <input
                          id={`${baseId}-dnd-sessiondate`}
                          type="text"
                          placeholder="e.g. Session 4 / Autumn"
                          onFocus={beginEditSession}
                          value={f.sessionDate || ''}
                          onChange={(e) => {
                            ensureHistoryOnce()
                            updateDndField({ sessionDate: e.target.value })
                          }}
                          className="border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                        />
                      </div>
                    </div>
                  )}
                  </div>
                </details>

                {/* Aliases & Campaign #Tags */}
                {renderAliasesAndTagsCard()}

                {/* Parent Group Membership (when groups exist on the canvas) */}
                {!isPlayerEdition && (groupContainers.length > 0 || parentGroup) && (
                  <div className="p-2.5 rounded-lg bg-slate-50/80 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor={`${baseId}-entity-group-select`}
                        className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5"
                      >
                        <FolderKanban
                          size={12}
                          className="text-amber-600 dark:text-amber-400"
                          aria-hidden="true"
                        />
                        <span>Group Container</span>
                      </label>
                      {parentGroup && (
                        <button
                          type="button"
                          onClick={() => onNavigateToNode(parentGroup.id)}
                          className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                        >
                          Inspect Group
                        </button>
                      )}
                    </div>
                    <select
                      id={`${baseId}-entity-group-select`}
                      value={data.groupId || ''}
                      onChange={(e) =>
                        assignNodesToGroup([node.id], e.target.value || undefined)
                      }
                      className="border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                    >
                      <option value="">— Not in a Group —</option>
                      {groupContainers.map((grp) => (
                        <option key={grp.id} value={grp.id}>
                          {grp.data.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Lock & Visibility Toggles */}
                {!isPlayerEdition && (
                  <div className="flex flex-col gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`${baseId}-entity-locked`}
                        className="rounded accent-blue-600 cursor-pointer"
                        checked={Boolean(data.isLocked)}
                        onChange={(e) => toggleNodeLock([node.id], e.target.checked)}
                      />
                      <label
                        htmlFor={`${baseId}-entity-locked`}
                        className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none"
                      >
                        Lock Position on Canvas
                      </label>
                    </div>
                    {parentGroup?.data?.isLocked && !data.isLocked && (
                      <p className="text-[11px] text-amber-700 dark:text-amber-300 pl-5 -mt-1">
                        Position is currently locked by parent group &ldquo;{parentGroup.data.label}
                        &rdquo;.
                      </p>
                    )}

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="isHidden"
                        className="rounded accent-blue-600 cursor-pointer"
                        checked={!!data.isHidden}
                        onChange={(e) =>
                          updateNodeData(node.id, { isHidden: e.target.checked }, true)
                        }
                      />
                      <label
                        htmlFor="isHidden"
                        className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none"
                      >
                        Hide Entire Entity in Player View
                      </label>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() =>
                    setConfirmState({
                      title: isPlayerEdition ? 'Delete Theory Pin?' : 'Delete Entity?',
                      message: `Are you sure you want to delete "${data.label}" and its attached connections?`,
                      confirmLabel: isPlayerEdition ? 'Delete Theory Pin' : 'Delete Entity',
                      onConfirm: () => deleteNode(node.id)
                    })
                  }
                  className="w-full py-2 bg-red-50 dark:bg-red-900/25 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/45 rounded-md text-xs font-bold transition-colors border border-red-200 dark:border-red-800/60 cursor-pointer"
                >
                  {isPlayerEdition ? 'Delete Theory Pin' : 'Delete Entity'}
                </button>
              </div>
            </div>

            {/* ==================== TAB 2: LORE ==================== */}
            <div
              role="tabpanel"
              data-tab-id="lore"
              aria-labelledby={`${baseId}-entity-tab-lore`}
              hidden={activeEntityTab !== 'lore' ? ('until-found' as any) : undefined}
            >
              <div className="p-4 flex flex-col gap-3.5 [&>*]:shrink-0">
                {renderLoreEditorSection(
                  isPlayerEdition ? 'Theory Pin Summary' : 'Public Player Lore',
                  5,
                  5
                )}
              </div>
            </div>

            {/* ==================== TAB 3: STYLE ==================== */}
            <div
              role="tabpanel"
              data-tab-id="style"
              aria-labelledby={`${baseId}-entity-tab-style`}
              hidden={activeEntityTab !== 'style' ? ('until-found' as any) : undefined}
            >
              <div className="p-4 flex flex-col gap-4 [&>*]:shrink-0">
                {/* Card Background Color */}
                {(() => {
                  const customEntityBgHex = normalizeHexColor(data.bgColor)
                  return (
                    <div className="flex flex-col gap-2.5 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                          <PaintBucket size={13} className="text-blue-500" aria-hidden="true" />
                          Card Background Color
                        </span>
                        {customEntityBgHex && (
                          <button
                            type="button"
                            onClick={() => updateNodeData(node.id, { bgColor: undefined }, true)}
                            title="Reset to theme & category default background"
                            className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-[11px] font-semibold text-slate-600 dark:text-slate-300 inline-flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <RotateCcw size={11} aria-hidden="true" />
                            <span>Default</span>
                          </button>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug -mt-1">
                        Recolors the entity card fill while preserving category borders and automatic
                        high-contrast text.
                      </p>

                      <div
                        className="flex flex-wrap items-center gap-1.5"
                        role="group"
                        aria-label="Preset card background colors"
                      >
                        {ENTITY_BG_SWATCHES.map((swatch) => {
                          const isSelected = customEntityBgHex === swatch.hex.toLowerCase()
                          const darkSwatch = isHexColorDark(swatch.hex)
                          return (
                            <button
                              key={swatch.key}
                              type="button"
                              aria-label={swatch.label}
                              aria-pressed={isSelected}
                              title={`${swatch.label} (${swatch.hex.toUpperCase()})`}
                              onClick={() =>
                                updateNodeData(node.id, { bgColor: swatch.hex }, true)
                              }
                              style={{ backgroundColor: swatch.hex }}
                              className={`dcc-color-swatch w-6 h-6 rounded-full border-2 inline-flex items-center justify-center transition-transform cursor-pointer ${
                                isSelected
                                  ? 'border-blue-600 dark:border-blue-400 scale-110 ring-2 ring-blue-500/50'
                                  : 'border-slate-400/80 dark:border-slate-500 hover:scale-105'
                              }`}
                            >
                              {isSelected && (
                                <Check
                                  size={12}
                                  strokeWidth={3}
                                  aria-hidden="true"
                                  className={darkSwatch ? 'text-white' : 'text-slate-900'}
                                />
                              )}
                            </button>
                          )
                        })}
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-200/70 dark:border-slate-700/70">
                        <label
                          htmlFor={`${baseId}-entity-bg-color`}
                          className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
                        >
                          Custom Color Picker
                        </label>
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-mono font-semibold text-slate-600 dark:text-slate-300">
                            {customEntityBgHex ? customEntityBgHex.toUpperCase() : 'Theme Default'}
                          </span>
                          <input
                            id={`${baseId}-entity-bg-color`}
                            type="color"
                            aria-label="Custom entity card background color"
                            value={customEntityBgHex || '#fef3c7'}
                            onPointerDown={() => useStore.getState().pushHistory(true)}
                            onChange={(e) =>
                              updateNodeData(node.id, { bgColor: e.target.value }, false)
                            }
                            className="dcc-color-swatch w-7 h-7 rounded border border-slate-300 dark:border-slate-600 cursor-pointer bg-transparent p-0.5"
                          />
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {/* Portrait & Display Mode */}
                <div className="flex flex-col gap-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Portrait / Token Art
                    </span>
                    {data.portrait && (
                      <button
                        type="button"
                        onClick={() => updateNodeData(node.id, { portrait: undefined }, true)}
                        className="text-[11px] text-red-500 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 size={11} aria-hidden="true" /> Remove
                      </button>
                    )}
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    aria-label="Upload portrait image"
                    className="hidden"
                    onChange={(e) => {
                      handlePortraitUpload(e.target.files?.[0])
                      e.target.value = ''
                    }}
                  />

                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault()
                      handlePortraitUpload(e.dataTransfer.files?.[0])
                    }}
                    className="flex items-center gap-3"
                  >
                    {data.portrait ? (
                      <img
                        src={data.portrait}
                        alt={`Portrait of ${data.label}`}
                        className="w-14 h-14 rounded-lg object-cover border border-slate-300 dark:border-slate-600 shrink-0"
                      />
                    ) : null}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingPortrait}
                      className="flex-1 py-2.5 px-3 rounded-md border border-dashed border-slate-300 dark:border-slate-600 hover:border-blue-500 dark:hover:border-blue-400 text-xs font-medium text-slate-600 dark:text-slate-300 flex items-center justify-center gap-1.5 bg-white dark:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <Upload size={13} aria-hidden="true" />
                      <span>
                        {isUploadingPortrait
                          ? 'Compressing...'
                          : data.portrait
                            ? 'Replace Portrait'
                            : 'Upload or Drop Image'}
                      </span>
                    </button>
                  </div>

                  {data.portrait && (
                    <div
                      className="grid grid-cols-3 gap-1 mt-1"
                      role="group"
                      aria-label="Portrait display mode"
                    >
                      {(
                        [
                          { mode: 'token', label: 'Token' },
                          { mode: 'card', label: 'Top Card' },
                          { mode: 'icon', label: 'Panel Only' }
                        ] as Array<{ mode: PortraitMode; label: string }>
                      ).map((item) => {
                        const active = (data.portraitMode || 'token') === item.mode
                        return (
                          <button
                            key={item.mode}
                            type="button"
                            aria-pressed={active}
                            onClick={() =>
                              updateNodeData(node.id, { portraitMode: item.mode }, true)
                            }
                            className={`py-1 rounded text-xs font-semibold border transition-colors cursor-pointer ${
                              active
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                            }`}
                          >
                            {item.label}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Card Shape */}
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor={`${baseId}-card-shape`}
                    className="text-xs font-semibold text-slate-600 dark:text-slate-300"
                  >
                    Card Shape
                  </label>
                  <select
                    id={`${baseId}-card-shape`}
                    className="border border-slate-300 dark:border-slate-700 rounded-md p-2 text-xs outline-none bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                    value={data.shape || 'default'}
                    onChange={(e) => updateNodeData(node.id, { shape: e.target.value }, true)}
                  >
                    <option value="default">Rounded Card</option>
                    <option value="box">Sharp Box</option>
                    <option value="pill">Pill</option>
                    <option value="leaf">Leaf</option>
                    <option value="arch">Archway</option>
                    <option value="oval">Oval</option>
                    <option value="sticky">Sticky Note</option>
                  </select>
                </div>

                {/* Card Dimensions (Manual Resize + Auto-Fit Reset) */}
                {(() => {
                  const explicitBounds = resolveEntityExplicitSize(data)
                  const hasCustomSize =
                    explicitBounds.width !== undefined || explicitBounds.height !== undefined
                  const measuredW = Math.round(node.measured?.width || 225)
                  const measuredH = Math.round(
                    node.measured?.height ||
                      (data.portraitMode === 'card' && data.portrait ? 195 : 88)
                  )
                  const sizeStatusLabel = !hasCustomSize
                    ? 'Auto'
                    : `${explicitBounds.width ?? 'Auto'} × ${explicitBounds.height ?? 'Auto'} px`

                  const commitWidthDraft = () => {
                    const trimmed = widthDraft.trim()
                    if (!trimmed) {
                      if (data.entityWidth !== undefined) {
                        resizeEntityNode(node.id, { width: null }, true)
                      }
                      return
                    }
                    const parsed = Number(trimmed)
                    if (!Number.isFinite(parsed) || parsed <= 0) {
                      setWidthDraft(
                        explicitBounds.width !== undefined ? String(explicitBounds.width) : ''
                      )
                      return
                    }
                    resizeEntityNode(node.id, { width: parsed }, true)
                  }

                  const commitHeightDraft = () => {
                    const trimmed = heightDraft.trim()
                    if (!trimmed) {
                      if (data.entityHeight !== undefined) {
                        resizeEntityNode(node.id, { height: null }, true)
                      }
                      return
                    }
                    const parsed = Number(trimmed)
                    if (!Number.isFinite(parsed) || parsed <= 0) {
                      setHeightDraft(
                        explicitBounds.height !== undefined ? String(explicitBounds.height) : ''
                      )
                      return
                    }
                    resizeEntityNode(node.id, { height: parsed }, true)
                  }

                  return (
                    <div className="flex flex-col gap-2.5 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                          <Maximize2 size={13} className="text-blue-500" aria-hidden="true" />
                          <span>Card Dimensions</span>
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-mono font-semibold text-slate-600 dark:text-slate-300">
                            {sizeStatusLabel}
                          </span>
                          {hasCustomSize && !effectivelyLocked && (
                            <button
                              type="button"
                              onClick={() => resetEntitySize([node.id])}
                              title="Reset card to automatic content-driven size"
                              className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-[11px] font-semibold text-slate-600 dark:text-slate-300 inline-flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <RotateCcw size={11} aria-hidden="true" />
                              <span>Auto</span>
                            </button>
                          )}
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug -mt-1">
                        {effectivelyLocked
                          ? 'Unlock this entity (or its parent group) to drag resize handles or edit dimensions.'
                          : 'Drag any corner or edge handle on the canvas, or enter exact pixel dimensions.'}
                      </p>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1">
                          <label
                            htmlFor={`${baseId}-entity-width`}
                            className="text-[11px] font-semibold text-slate-600 dark:text-slate-300"
                          >
                            Width (px)
                          </label>
                          <input
                            id={`${baseId}-entity-width`}
                            type="number"
                            min={explicitBounds.minWidth}
                            max={explicitBounds.maxWidth}
                            step={10}
                            disabled={effectivelyLocked}
                            placeholder={`Auto (~${measuredW})`}
                            value={widthDraft}
                            onChange={(e) => setWidthDraft(e.target.value)}
                            onBlur={commitWidthDraft}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') e.currentTarget.blur()
                            }}
                            className="border border-slate-300 dark:border-slate-700 rounded-md px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 disabled:opacity-50"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label
                            htmlFor={`${baseId}-entity-height`}
                            className="text-[11px] font-semibold text-slate-600 dark:text-slate-300"
                          >
                            Height (px)
                          </label>
                          <input
                            id={`${baseId}-entity-height`}
                            type="number"
                            min={explicitBounds.minHeight}
                            max={explicitBounds.maxHeight}
                            step={10}
                            disabled={effectivelyLocked}
                            placeholder={`Auto (~${measuredH})`}
                            value={heightDraft}
                            onChange={(e) => setHeightDraft(e.target.value)}
                            onBlur={commitHeightDraft}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') e.currentTarget.blur()
                            }}
                            className="border border-slate-300 dark:border-slate-700 rounded-md px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 disabled:opacity-50"
                          />
                        </div>
                      </div>

                      <div
                        className="grid grid-cols-4 gap-1"
                        role="group"
                        aria-label="Quick card size presets"
                      >
                        {(
                          [
                            { label: 'Compact', w: 180, h: null as number | null },
                            { label: 'Standard', w: 240, h: null as number | null },
                            { label: 'Wide', w: 340, h: null as number | null },
                            {
                              label: 'Feature',
                              w: 320,
                              h: data.portraitMode === 'card' && data.portrait ? 260 : 140
                            }
                          ] as const
                        ).map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            disabled={effectivelyLocked}
                            onClick={() =>
                              resizeEntityNode(
                                node.id,
                                { width: preset.w, height: preset.h },
                                true
                              )
                            }
                            className="py-1 px-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/35 hover:border-blue-300 dark:hover:border-blue-600 text-[11px] font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })()}

                {/* Base Scale & Auto-scale */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <label
                      htmlFor={`${baseId}-base-scale`}
                      className="text-xs font-semibold text-slate-600 dark:text-slate-300"
                    >
                      Base Scale
                    </label>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {(data.baseScale || 1).toFixed(1)}x
                    </span>
                  </div>
                  <input
                    id={`${baseId}-base-scale`}
                    type="range"
                    min="0.5"
                    max="3.0"
                    step="0.1"
                    value={data.baseScale || 1}
                    onPointerDown={() => useStore.getState().pushHistory(true)}
                    onChange={(e) =>
                      updateNodeData(node.id, { baseScale: parseFloat(e.target.value) }, false)
                    }
                    className="w-full cursor-pointer accent-blue-600"
                  />
                  <div className="flex items-center gap-2 mt-0.5">
                    <input
                      id={`${baseId}-auto-scale`}
                      type="checkbox"
                      className="rounded accent-blue-600 cursor-pointer"
                      checked={!!data.autoScale}
                      onChange={(e) =>
                        updateNodeData(node.id, { autoScale: e.target.checked }, true)
                      }
                    />
                    <label
                      htmlFor={`${baseId}-auto-scale`}
                      className="text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none"
                    >
                      Auto-scale larger with more connections
                    </label>
                  </div>
                </div>

                {/* Stacking Order among Overlapping Entities */}
                {renderStackingOrderSection(false)}

                {/* Status Markers */}
                {renderStatusMarkersPicker()}
              </div>
            </div>

            {/* ==================== TAB 4: LINKS ==================== */}
            <div
              role="tabpanel"
              data-tab-id="links"
              aria-labelledby={`${baseId}-entity-tab-links`}
              hidden={activeEntityTab !== 'links' ? ('until-found' as any) : undefined}
            >
              <div className="p-4 flex flex-col gap-3 [&>*]:shrink-0">
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Drag from any handle on the canvas to connect entities or groups, or mention{' '}
                  <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300">
                    [[Name]]
                  </code>{' '}
                  in Lore notes to build automatic backlinks.
                </p>
                {renderCustomPortsSection()}
                <ConnectionsBacklinksSection
                  nodeId={node.id}
                  nodes={nodes}
                  edges={edges}
                  hideSecrets={isPlayerEdition}
                  hideTopBorder
                  defaultOpenEmpty
                  onNavigateToNode={onNavigateToNode}
                  onSelectEdge={(edgeId) => {
                    setNodes(nodes.map((n) => ({ ...n, selected: false })))
                    setEdges(edges.map((e) => ({ ...e, selected: e.id === edgeId })))
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </aside>

      <ConfirmModal
        open={confirmState !== null}
        title={confirmState?.title || ''}
        message={confirmState?.message || ''}
        confirmLabel={confirmState?.confirmLabel}
        onConfirm={() => confirmState?.onConfirm()}
        onCancel={() => setConfirmState(null)}
      />
    </>
  )
}
