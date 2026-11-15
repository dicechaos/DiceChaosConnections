import { useEffect, useLayoutEffect, useRef } from 'react'
import { useStore } from '../store/useStore'
import {
  BuiltinPortId,
  CustomPortSize,
  CustomPortVisibility,
  DragSnapOption,
  PartyDisposition,
  PerimeterSide
} from '../types'
import { GROUP_TINT_PALETTE, resolveGroupTint } from './nodes/GroupNode'
import { PortShapePreviewGlyph } from './nodes/CustomPerimeterHandles'
import {
  CUSTOM_PORT_SWATCHES,
  ENTITY_BG_SWATCHES,
  isHexColorDark,
  normalizeHexColor,
  resolveDefaultNodePortAccent
} from '../utils/colorUtils'
import {
  buildNodeBorderGeometry,
  CUSTOM_PORT_SHAPES,
  CUSTOM_PORT_SHAPE_LABELS,
  CUSTOM_PORT_SIZES,
  CUSTOM_PORT_SIZE_LABELS,
  CUSTOM_PORT_VISIBILITIES,
  CUSTOM_PORT_VISIBILITY_LABELS,
  DRAG_SNAP_LABELS,
  DRAG_SNAP_OPTIONS,
  formatPerimeterAnchorDescription,
  getDefaultPortStyleForId,
  getNodeStackBounds,
  hasModifiedBuiltinPorts,
  isBuiltinPerimeterPortId,
  isBuiltinPortModified,
  isNodeEffectivelyLocked,
  PERIMETER_SIDES,
  PERIMETER_SIDE_LABELS,
  projectPointToNodePerimeter,
  resolveActivePerimeterPorts,
  resolvePortDisplayName,
  sanitizeCustomPortShape,
  sanitizeCustomPortSize,
  sanitizeCustomPortVisibility,
  tidySelectedNodesGrid
} from '../utils/graphPipeline'
import {
  Plus,
  CircleDot,
  Copy,
  ClipboardPaste,
  Files,
  EyeOff,
  Eye,
  ArrowLeftRight,
  GitCommitHorizontal,
  RotateCcw,
  Trash2,
  Maximize2,
  Sparkles,
  HelpCircle,
  Network,
  FolderKanban,
  FolderMinus,
  Lock,
  Unlock,
  PaintBucket,
  LayoutGrid,
  MousePointerClick,
  Shrink,
  Check,
  BringToFront,
  SendToBack,
  ArrowUp,
  ArrowDown
} from 'lucide-react'

export type ContextMenuState =
  | {
      mode: 'node'
      screenX: number
      screenY: number
      flowX?: number
      flowY?: number
      nodeId: string
    }
  | {
      mode: 'selection'
      screenX: number
      screenY: number
      nodeIds: string[]
    }
  | {
      mode: 'group'
      screenX: number
      screenY: number
      flowX?: number
      flowY?: number
      groupId: string
    }
  | {
      mode: 'edge'
      screenX: number
      screenY: number
      flowX: number
      flowY: number
      edgeId: string
    }
  | {
      mode: 'pane'
      screenX: number
      screenY: number
      flowX: number
      flowY: number
    }
  | {
      mode: 'connect-end'
      screenX: number
      screenY: number
      flowX: number
      flowY: number
      sourceNodeId: string
      sourceHandleId?: string | null
      isFromTargetHandle?: boolean
    }
  | {
      mode: 'custom-port'
      screenX: number
      screenY: number
      nodeId: string
      portId: string
    }

interface ContextMenuProps {
  menu: ContextMenuState | null
  onClose: () => void
  onRequestDeleteNode: (nodeId: string) => void
  onRequestDeleteEdge: (edgeId: string) => void
  onRequestDeleteGroupWithContents?: (groupId: string) => void
  onRequestBatchDeleteNodes?: (nodeIds: string[]) => void
  onSelectNode?: (nodeId: string) => void
  onSpotlightNode?: (nodeId: string) => void
  onMysterySpotlightNode?: (nodeId: string) => void
  onSpotlightEdge?: (edgeId: string) => void
  onFocusDegrees?: (nodeId: string, degrees: number | '') => void
  activeFocusDegrees?: number | ''
  onFitView: () => void
}

const QUICK_ENTITY_TYPES = [
  { type: 'NPC', label: 'NPC' },
  { type: 'Location', label: 'Location' },
  { type: 'Organization', label: 'Organization' },
  { type: 'Item', label: 'Item' },
  { type: 'Event', label: 'Event / Quest' },
  { type: 'PC', label: 'Player Character' }
]

const QUICK_CARD_BG_SWATCHES = ENTITY_BG_SWATCHES.filter((s) =>
  ['parchment', 'sage', 'frost', 'rose', 'slate', 'arcane'].includes(s.key)
)

export default function ContextMenu({
  menu,
  onClose,
  onRequestDeleteNode,
  onRequestDeleteEdge,
  onRequestDeleteGroupWithContents,
  onRequestBatchDeleteNodes,
  onSelectNode,
  onSpotlightNode,
  onMysterySpotlightNode,
  onSpotlightEdge,
  onFocusDegrees,
  activeFocusDegrees = '',
  onFitView
}: ContextMenuProps) {
  const anchorRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const groupRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const suppressToggleCloseRef = useRef(false)

  const {
    campaignEdition,
    canvasTheme,
    isDarkMode,
    nodes,
    edges,
    clipboard,
    customEntityTypes,
    connectionPresets,
    addNode,
    addConnectedNode,
    updateNodeData,
    batchUpdateNodes,
    setNodes,
    pushHistory,
    createGroupFromSelection,
    ungroupNodes,
    fitGroupToMembers,
    tidyGroupMembers,
    selectGroupMembers,
    toggleNodeLock,
    reorderNodes,
    resetEntitySize,
    matchSelectedEntitySizes,
    assignNodesToGroup,
    updateEdgeData,
    reverseEdgeDirection,
    addCustomPort,
    updateCustomPort,
    removeCustomPort,
    resetBuiltinPorts,
    applyPortStyleToAllNodePorts,
    resetEdgeEndpointAnchors,
    addWaypoint,
    clearWaypoints,
    copySelection,
    pasteClipboard,
    duplicateSelection,
    dragSnapEnabled,
    dragSnapSize,
    setDragSnapOption
  } = useStore()

  // Sync popover open/close with `menu` state and position against zero-size anchor
  useLayoutEffect(() => {
    const popover = popoverRef.current
    const anchor = anchorRef.current
    if (!popover || !anchor) return

    if (!menu) {
      if (popover.matches(':popover-open')) {
        suppressToggleCloseRef.current = true
        popover.hidePopover()
        suppressToggleCloseRef.current = false
      }
      if (previousFocusRef.current && document.contains(previousFocusRef.current)) {
        try {
          ;(previousFocusRef.current as any).focus({ preventScroll: true, focusVisible: false })
        } catch {
          previousFocusRef.current.focus({ preventScroll: true })
        }
      }
      previousFocusRef.current = null
      return
    }

    if (
      document.activeElement instanceof HTMLElement &&
      !popover.contains(document.activeElement)
    ) {
      previousFocusRef.current = document.activeElement
    }

    anchor.style.left = `${menu.screenX}px`
    anchor.style.top = `${menu.screenY}px`

    if (popover.matches(':popover-open')) {
      suppressToggleCloseRef.current = true
      popover.hidePopover()
      suppressToggleCloseRef.current = false
    }

    try {
      ;(popover as any).showPopover({ source: anchor })
    } catch {
      popover.showPopover?.()
    }

    // Fallback flip + viewport clamping where CSS Anchor Positioning (`position-area`) is unsupported
    if (typeof CSS === 'undefined' || !CSS.supports('position-area: block-end')) {
      const rect = popover.getBoundingClientRect()
      const w = rect.width || 240
      const h = rect.height || 300
      const flippedX =
        menu.screenX + w > window.innerWidth - 8 && menu.screenX - w >= 8
          ? menu.screenX - w
          : menu.screenX
      const flippedY =
        menu.screenY + h > window.innerHeight - 8 && menu.screenY - h >= 8
          ? menu.screenY - h
          : menu.screenY
      const clampedX = Math.min(Math.max(8, flippedX), Math.max(8, window.innerWidth - w - 8))
      const clampedY = Math.min(Math.max(8, flippedY), Math.max(8, window.innerHeight - h - 8))
      popover.style.left = `${clampedX}px`
      popover.style.top = `${clampedY}px`
    } else {
      popover.style.left = ''
      popover.style.top = ''
    }

    const firstBtn = groupRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')
    firstBtn?.focus({ preventScroll: true })
  }, [menu])

  // Sync native light-dismiss (`Escape` or outside click) back into React state
  useEffect(() => {
    const popover = popoverRef.current
    if (!popover) return
    const handleToggle = (event: Event) => {
      if (suppressToggleCloseRef.current) return
      const nextState = (event as ToggleEvent).newState
      if (nextState === 'closed') {
        onClose()
      }
    }
    popover.addEventListener('toggle', handleToggle)
    return () => popover.removeEventListener('toggle', handleToggle)
  }, [onClose])

  // Keyboard navigation & role fallback (`ArrowDown` / `ArrowUp` / `Home` / `End` + hover focus sync)
  useEffect(() => {
    const group = groupRef.current
    if (!group || !menu) return
    if ('focusGroup' in HTMLElement.prototype) return

    group.setAttribute('role', 'menu')
    group.querySelectorAll('button:not([role])').forEach((item) => {
      item.setAttribute('role', 'menuitem')
    })

    const getItems = () =>
      Array.from(group.querySelectorAll<HTMLButtonElement>('button')).filter(
        (item) =>
          item.closest('[focusgroup]') === group &&
          !item.disabled &&
          item.getAttribute('aria-disabled') !== 'true'
      )

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopImmediatePropagation()
        onClose()
        return
      }

      const items = getItems()
      if (items.length === 0) return
      const current = items.indexOf(document.activeElement as HTMLButtonElement)
      let next = current

      if (event.key === 'ArrowDown') {
        next = current < 0 ? 0 : (current + 1) % items.length
      } else if (event.key === 'ArrowUp') {
        next = current <= 0 ? items.length - 1 : current - 1
      } else if (event.key === 'Home') {
        next = 0
      } else if (event.key === 'End') {
        next = items.length - 1
      } else {
        return
      }

      event.preventDefault()
      event.stopImmediatePropagation()
      items[next].focus({ preventScroll: true })
    }

    const handlePointerMove = (event: PointerEvent) => {
      const btn = (event.target as HTMLElement | null)?.closest('button')
      if (btn && group.contains(btn) && !btn.disabled && document.activeElement !== btn) {
        try {
          ;(btn as any).focus({ preventScroll: true, focusVisible: false })
        } catch {
          btn.focus({ preventScroll: true })
        }
      }
    }

    group.addEventListener('keydown', handleKeyDown, true)
    group.addEventListener('pointermove', handlePointerMove)
    return () => {
      group.removeEventListener('keydown', handleKeyDown, true)
      group.removeEventListener('pointermove', handlePointerMove)
    }
  }, [menu, onClose])

  const itemClass =
    'w-full px-3 py-1.5 text-left text-xs font-medium flex items-center justify-between gap-3 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/70 focus-visible:bg-slate-100 dark:focus-visible:bg-slate-700/70 outline-none transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'

  const renderStackingMenuItems = (
    targetIds: string[],
    scope: 'entity' | 'selection' | 'group'
  ) => {
    const { canBringFront, canSendBack } = getNodeStackBounds(nodes, targetIds)
    const nounPrefix =
      scope === 'group' ? 'Group ' : scope === 'selection' ? 'Selected ' : ''
    const groupHint =
      scope === 'group'
        ? 'Reorders overlapping group frames while keeping connection lines and entities on top'
        : undefined

    return (
      <>
        <button
          type="button"
          disabled={!canBringFront}
          title={groupHint}
          onClick={() => {
            reorderNodes(targetIds, 'front')
            onClose()
          }}
          className={itemClass}
        >
          <span className="flex items-center gap-2">
            <BringToFront size={13} className="text-blue-500" />
            {`Bring ${nounPrefix}to Front`}
          </span>
          <span className="text-[10px] text-slate-400" aria-hidden="true">
            Ctrl+]
          </span>
        </button>
        <button
          type="button"
          disabled={!canBringFront}
          title={groupHint}
          onClick={() => {
            reorderNodes(targetIds, 'forward')
            onClose()
          }}
          className={itemClass}
        >
          <span className="flex items-center gap-2">
            <ArrowUp size={13} />
            {`Bring ${nounPrefix}Forward`}
          </span>
          <span className="text-[10px] text-slate-400" aria-hidden="true">
            ]
          </span>
        </button>
        <button
          type="button"
          disabled={!canSendBack}
          title={groupHint}
          onClick={() => {
            reorderNodes(targetIds, 'backward')
            onClose()
          }}
          className={itemClass}
        >
          <span className="flex items-center gap-2">
            <ArrowDown size={13} />
            {`Send ${nounPrefix}Backward`}
          </span>
          <span className="text-[10px] text-slate-400" aria-hidden="true">
            [
          </span>
        </button>
        <button
          type="button"
          disabled={!canSendBack}
          title={groupHint}
          onClick={() => {
            reorderNodes(targetIds, 'back')
            onClose()
          }}
          className={itemClass}
        >
          <span className="flex items-center gap-2">
            <SendToBack size={13} className="text-slate-500 dark:text-slate-400" />
            {`Send ${nounPrefix}to Back`}
          </span>
          <span className="text-[10px] text-slate-400" aria-hidden="true">
            Ctrl+[
          </span>
        </button>
      </>
    )
  }

  const isPlayerEdition = campaignEdition === 'player'
  const existingGroups = nodes.filter((n) => n.type === 'groupRegion' || n.data?.isGroup)
  let menuLabel = 'Canvas Actions'
  let widthClass = 'w-56'
  let bodyContent: React.ReactNode = null

  if (menu?.mode === 'custom-port') {
    const targetNode = nodes.find((n) => n.id === menu.nodeId)
    const isGroupTarget = Boolean(
      targetNode && (targetNode.type === 'groupRegion' || targetNode.data?.isGroup)
    )
    const activePorts = targetNode
      ? resolveActivePerimeterPorts(targetNode.data, isGroupTarget)
      : []
    const port = activePorts.find((p) => p.id === menu.portId)
    if (targetNode && port) {
      menuLabel = 'Connection Point Options'
      widthClass = 'w-64'
      const nodeById = new Map(nodes.map((n) => [n.id, n]))
      const canEditPort =
        !isNodeEffectivelyLocked(targetNode, nodeById) &&
        (!isPlayerEdition || Boolean(targetNode.data?.isPlayerCreated))
      const isDarkSurface =
        canvasTheme === 'arcane' || (canvasTheme === 'modern' && isDarkMode)
      const customCategory = customEntityTypes.find((c) => c.label === targetNode.data?.entityType)
      const defaultPortAccent = isGroupTarget
        ? resolveGroupTint(targetNode.data?.groupColor, targetNode.data?.groupCustomColor).swatchHex
        : resolveDefaultNodePortAccent({
            entityType: targetNode.data?.entityType,
            customCategoryColor: customCategory?.color,
            isDarkSurface: targetNode.data?.bgColor
              ? isHexColorDark(targetNode.data.bgColor)
              : isDarkSurface
          })
      const defaults = getDefaultPortStyleForId(port.id, isGroupTarget)
      const portShape = sanitizeCustomPortShape(port.shape, defaults.shape)
      const portSize = sanitizeCustomPortSize(port.size, defaults.size)
      const portVis = sanitizeCustomPortVisibility(port.visibility, defaults.visibility)
      const customPortHex = normalizeHexColor(port.color)
      const resolvedPortColor = customPortHex || defaultPortAccent
      const displayName = resolvePortDisplayName(port)
      const pct = Math.round(port.offset * 100)
      const isBuiltin = isBuiltinPerimeterPortId(port.id)
      const canResetBuiltin = isBuiltin && isBuiltinPortModified(port, isGroupTarget)

      bodyContent = (
        <>
          <div className="px-3 py-1.5 flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700/70">
            <span className="flex items-center gap-1.5 min-w-0">
              <PortShapePreviewGlyph
                shape={portShape}
                color={resolvedPortColor}
                isDark={isDarkMode}
              />
              <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100 truncate">
                {displayName}
              </span>
              {isBuiltin && (
                <span className="px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-[9px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                  Default
                </span>
              )}
            </span>
            <span className="text-[10px] font-mono text-slate-400 shrink-0">
              {PERIMETER_SIDE_LABELS[port.side]} {pct}%
            </span>
          </div>

          {/* Side & Position Controls */}
          <div className="px-3 py-1.5 flex flex-col gap-1.5 border-b border-slate-100 dark:border-slate-700/70">
            <div className="grid grid-cols-4 gap-1">
              {PERIMETER_SIDES.map((s: PerimeterSide) => {
                const activeSide = port.side === s
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={!canEditPort}
                    aria-pressed={activeSide}
                    onClick={() => updateCustomPort(targetNode.id, port.id, { side: s }, true)}
                    className={`py-0.5 min-h-6 rounded border text-[10px] font-semibold transition-colors cursor-pointer disabled:opacity-40 ${
                      activeSide
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-slate-50 dark:bg-slate-900/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {PERIMETER_SIDE_LABELS[s]}
                  </button>
                )
              })}
            </div>
            <div className="flex items-center gap-2">
              <label
                htmlFor="dcc-ctx-port-pos"
                className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 shrink-0"
              >
                Pos
              </label>
              <input
                id="dcc-ctx-port-pos"
                type="range"
                min="5"
                max="95"
                step="1"
                disabled={!canEditPort}
                value={pct}
                style={{ accentColor: resolvedPortColor }}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  useStore.getState().pushHistory(true)
                }}
                onChange={(e) =>
                  updateCustomPort(
                    targetNode.id,
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
          </div>

          {/* Shape Grid */}
          <div className="px-3 py-1.5 flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Shape
            </span>
            <div className="grid grid-cols-3 gap-1">
              {CUSTOM_PORT_SHAPES.map((sh) => {
                const active = portShape === sh
                return (
                  <button
                    key={sh}
                    type="button"
                    disabled={!canEditPort}
                    aria-pressed={active}
                    onClick={() => updateCustomPort(targetNode.id, port.id, { shape: sh }, true)}
                    className={`px-1.5 py-1 min-h-6 rounded border text-[10px] font-semibold inline-flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-40 ${
                      active
                        ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500 text-blue-700 dark:text-blue-200'
                        : 'bg-slate-50 dark:bg-slate-900/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
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
          <div className="px-3 py-1.5 flex flex-col gap-1.5 border-t border-slate-100 dark:border-slate-700/70">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Size
              </span>
              <div className="inline-flex items-center gap-1">
                {CUSTOM_PORT_SIZES.map((sz: CustomPortSize) => {
                  const active = portSize === sz
                  return (
                    <button
                      key={sz}
                      type="button"
                      disabled={!canEditPort}
                      aria-pressed={active}
                      onClick={() => updateCustomPort(targetNode.id, port.id, { size: sz }, true)}
                      className={`px-2 py-0.5 min-h-6 rounded border text-[10px] font-bold transition-colors cursor-pointer disabled:opacity-40 ${
                        active
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-slate-50 dark:bg-slate-900/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      {CUSTOM_PORT_SIZE_LABELS[sz]}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Visibility
              </span>
              <div className="grid grid-cols-3 gap-1">
                {CUSTOM_PORT_VISIBILITIES.map((vis: CustomPortVisibility) => {
                  const active = portVis === vis
                  return (
                    <button
                      key={vis}
                      type="button"
                      disabled={!canEditPort}
                      aria-pressed={active}
                      title={CUSTOM_PORT_VISIBILITY_LABELS[vis]}
                      onClick={() =>
                        updateCustomPort(targetNode.id, port.id, { visibility: vis }, true)
                      }
                      className={`px-1.5 py-1 min-h-6 rounded border text-[10px] font-semibold transition-colors cursor-pointer disabled:opacity-40 ${
                        active
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-slate-50 dark:bg-slate-900/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      {vis === 'dm' ? 'DM Only' : vis === 'hover' ? 'On Hover' : 'Public'}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Color Swatches */}
          <div className="px-3 py-1.5 flex flex-col gap-1.5 border-t border-slate-100 dark:border-slate-700/70">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Color
              </span>
              <button
                type="button"
                disabled={!canEditPort}
                aria-pressed={!customPortHex}
                onClick={() =>
                  updateCustomPort(targetNode.id, port.id, { color: undefined }, true)
                }
                className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-40 ${
                  !customPortHex
                    ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500 text-blue-700 dark:text-blue-200'
                    : 'bg-slate-50 dark:bg-slate-900/80 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
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
            <div className="flex items-center gap-1.5 flex-wrap">
              {CUSTOM_PORT_SWATCHES.map((sw) => {
                const selectedSwatch = customPortHex === sw.hex
                return (
                  <button
                    key={sw.key}
                    type="button"
                    disabled={!canEditPort}
                    aria-label={sw.label}
                    aria-pressed={selectedSwatch}
                    title={sw.label}
                    onClick={() =>
                      updateCustomPort(targetNode.id, port.id, { color: sw.hex }, true)
                    }
                    style={{ backgroundColor: sw.hex }}
                    className={`dcc-color-swatch w-5 h-5 rounded-full border inline-flex items-center justify-center transition-transform cursor-pointer disabled:opacity-40 ${
                      selectedSwatch
                        ? 'border-slate-900 dark:border-white scale-110 ring-2 ring-blue-500/60'
                        : 'border-slate-400/70 dark:border-slate-600 hover:scale-105'
                    }`}
                  >
                    {selectedSwatch && (
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
            </div>
          </div>

          <hr className="my-1 border-slate-200 dark:border-slate-700" />
          <button
            type="button"
            disabled={!canEditPort}
            aria-pressed={Boolean(port.showLabel)}
            onClick={() =>
              updateCustomPort(
                targetNode.id,
                port.id,
                { showLabel: !port.showLabel },
                true
              )
            }
            className={itemClass}
          >
            <span className="flex items-center gap-2">
              <Eye size={13} className="text-blue-500" />
              <span>Show Label Badge on Border</span>
            </span>
            {port.showLabel && <Check size={12} className="text-blue-600 dark:text-blue-400" />}
          </button>

          {activePorts.length > 1 && (
            <button
              type="button"
              disabled={!canEditPort}
              onClick={() => {
                applyPortStyleToAllNodePorts(targetNode.id, port.id)
                onClose()
              }}
              className={itemClass}
            >
              <span className="flex items-center gap-2">
                <Sparkles size={13} className="text-amber-500" />
                <span>Apply Style to All Points</span>
              </span>
            </button>
          )}

          {canResetBuiltin && (
            <button
              type="button"
              disabled={!canEditPort}
              onClick={() => {
                resetBuiltinPorts(targetNode.id, port.id as BuiltinPortId)
                onClose()
              }}
              className={itemClass}
            >
              <span className="flex items-center gap-2">
                <RotateCcw size={13} className="text-amber-500" />
                <span>Reset Point to Default</span>
              </span>
            </button>
          )}

          <button
            type="button"
            disabled={!canEditPort}
            onClick={() => {
              removeCustomPort(targetNode.id, port.id)
              onClose()
            }}
            className="w-full px-3 py-1.5 text-left text-xs font-semibold flex items-center justify-between gap-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 focus-visible:bg-red-50 dark:focus-visible:bg-red-950/40 outline-none transition-colors cursor-pointer disabled:opacity-40"
          >
            <span className="flex items-center gap-2">
              <Trash2 size={13} />
              <span>Remove Connection Point</span>
            </span>
            <span className="text-[10px] opacity-75" aria-hidden="true">
              Alt+Click
            </span>
          </button>
        </>
      )
    }
  } else if (menu?.mode === 'connect-end') {
    menuLabel = 'Create and Connect Entity'
    const allTypes = [
      ...QUICK_ENTITY_TYPES,
      ...customEntityTypes.map((c) => ({ type: c.label, label: c.label }))
    ]
    bodyContent = (
      <>
        <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 border-b border-slate-100 dark:border-slate-700/70 mb-1">
          Create &amp; Connect Entity
        </div>
        {allTypes.map((item) => (
          <button
            key={item.type}
            type="button"
            onClick={() => {
              addConnectedNode(
                {
                  id: crypto.randomUUID(),
                  type: 'entity',
                  position: { x: menu.flowX - 95, y: menu.flowY - 24 },
                  data: { label: `New ${item.type}`, entityType: item.type }
                },
                {
                  source: menu.sourceNodeId,
                  sourceHandle: menu.sourceHandleId,
                  isFromTargetHandle: menu.isFromTargetHandle
                }
              )
              onClose()
            }}
            className={itemClass}
          >
            <span className="flex items-center gap-2">
              <Plus size={13} className="text-blue-500" />
              <span>{item.label}</span>
            </span>
          </button>
        ))}
      </>
    )
  } else if (menu?.mode === 'selection') {
    widthClass = 'w-60'
    const selIdSet = new Set(menu.nodeIds)
    const selNodes = nodes.filter((n) => selIdSet.has(n.id))
    const entityTargets = selNodes.filter((n) => n.type !== 'groupRegion' && !n.data?.isGroup)
    const entityIds = entityTargets.map((n) => n.id)
    const anyUnlocked = selNodes.some((n) => !n.data?.isLocked)
    const allHidden = selNodes.length > 0 && selNodes.every((n) => n.data?.isHidden)
    const canModifySelection =
      !isPlayerEdition || selNodes.every((n) => Boolean(n.data?.isPlayerCreated))

    menuLabel = `Selection Actions (${selNodes.length} items)`
    bodyContent = (
      <>
        <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 border-b border-slate-100 dark:border-slate-700/70 mb-1">
          {selNodes.length} Selected
        </div>

        {canModifySelection && entityIds.length >= 1 && (
          <>
            <button
              type="button"
              onClick={() => {
                createGroupFromSelection({ nodeIds: entityIds })
                onClose()
              }}
              className={itemClass}
            >
              <span className="flex items-center gap-2 font-semibold text-blue-700 dark:text-blue-300">
                <FolderKanban size={13} /> Group Selected
              </span>
              <span className="text-[10px] text-slate-400" aria-hidden="true">
                Ctrl+G
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                createGroupFromSelection({ nodeIds: entityIds, lock: true })
                onClose()
              }}
              className={itemClass}
            >
              <span className="flex items-center gap-2 font-semibold text-amber-700 dark:text-amber-300">
                <Lock size={13} /> Group &amp; Lock
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                createGroupFromSelection({
                  nodeIds: entityIds,
                  withBackground: true,
                  color: 'gold'
                })
                onClose()
              }}
              className={itemClass}
            >
              <span className="flex items-center gap-2">
                <PaintBucket size={13} className="text-amber-600 dark:text-amber-400" />
                Add Background &amp; Group
              </span>
            </button>

            <div className="px-3 py-1.5 flex items-center justify-between gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Group Tint
              </span>
              <div className="flex items-center gap-1">
                {GROUP_TINT_PALETTE.map((swatch) => (
                  <button
                    key={swatch.key}
                    type="button"
                    title={`Group with ${swatch.label} background`}
                    aria-label={`Group with ${swatch.label} background`}
                    onClick={() => {
                      createGroupFromSelection({
                        nodeIds: entityIds,
                        withBackground: true,
                        color: swatch.key
                      })
                      onClose()
                    }}
                    style={{ backgroundColor: swatch.swatchHex }}
                    className="dcc-color-swatch w-4 h-4 rounded-full border border-slate-400/80 dark:border-slate-500 shadow-sm hover:scale-110 transition-transform cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500 outline-none"
                  />
                ))}
                <input
                  type="color"
                  title="Group with custom background color"
                  aria-label="Group with custom background color"
                  defaultValue="#d97706"
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    createGroupFromSelection({
                      nodeIds: entityIds,
                      withBackground: true,
                      customColor: e.target.value
                    })
                    onClose()
                  }}
                  className="dcc-color-swatch w-4.5 h-4.5 rounded border border-slate-300 dark:border-slate-600 cursor-pointer bg-transparent p-0"
                />
              </div>
            </div>

            <div className="px-3 py-1 flex items-center justify-between gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Card Fill
              </span>
              <div className="flex items-center gap-1">
                {QUICK_CARD_BG_SWATCHES.map((swatch) => (
                  <button
                    key={swatch.key}
                    type="button"
                    title={`Set selected cards to ${swatch.label}`}
                    aria-label={`Set selected cards to ${swatch.label}`}
                    onClick={() => {
                      batchUpdateNodes(entityIds, (n) => ({
                        ...n,
                        data: { ...n.data, bgColor: swatch.hex }
                      }))
                      onClose()
                    }}
                    style={{ backgroundColor: swatch.hex }}
                    className="dcc-color-swatch w-4 h-4 rounded-full border border-slate-400/80 dark:border-slate-500 shadow-sm hover:scale-110 transition-transform cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500 outline-none"
                  />
                ))}
                <input
                  type="color"
                  title="Custom background color for selected cards"
                  aria-label="Custom background color for selected cards"
                  defaultValue="#fef3c7"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={() => pushHistory(true)}
                  onChange={(e) => {
                    const nextHex = e.target.value
                    const idSet = new Set(entityIds)
                    setNodes(
                      useStore
                        .getState()
                        .nodes.map((n) =>
                          idSet.has(n.id) ? { ...n, data: { ...n.data, bgColor: nextHex } } : n
                        )
                    )
                  }}
                  className="dcc-color-swatch w-4.5 h-4.5 rounded border border-slate-300 dark:border-slate-600 cursor-pointer bg-transparent p-0"
                />
                {entityTargets.some((n) => Boolean(n.data?.bgColor)) && (
                  <button
                    type="button"
                    title="Reset selected cards to default background"
                    aria-label="Reset selected cards to default background"
                    onClick={() => {
                      batchUpdateNodes(entityIds, (n) => ({
                        ...n,
                        data: { ...n.data, bgColor: undefined }
                      }))
                      onClose()
                    }}
                    className="p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <RotateCcw size={12} />
                  </button>
                )}
              </div>
            </div>
            <hr className="my-1 border-slate-200 dark:border-slate-700" />
          </>
        )}

        {canModifySelection && (
          <>
            {renderStackingMenuItems(menu.nodeIds, 'selection')}
            <hr className="my-1 border-slate-200 dark:border-slate-700" />
            <button
              type="button"
              onClick={() => {
                toggleNodeLock(menu.nodeIds, anyUnlocked)
                onClose()
              }}
              className={itemClass}
            >
              <span className="flex items-center gap-2">
                {anyUnlocked ? <Lock size={13} /> : <Unlock size={13} />}
                {anyUnlocked ? 'Lock Selected Positions' : 'Unlock Selected Positions'}
              </span>
            </button>
            {entityTargets.length >= 2 && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const updates = tidySelectedNodesGrid(entityTargets)
                    if (updates.size > 0) {
                      pushHistory(true)
                      setNodes(
                        nodes.map((n) => {
                          const pos = updates.get(n.id)
                          return pos ? { ...n, position: pos } : n
                        })
                      )
                    }
                    onClose()
                  }}
                  className={itemClass}
                >
                  <span className="flex items-center gap-2">
                    <LayoutGrid size={13} /> Tidy Selected in Grid
                  </span>
                </button>
                {anyUnlocked && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        matchSelectedEntitySizes(menu.nodeIds, 'width')
                        onClose()
                      }}
                      className={itemClass}
                    >
                      <span className="flex items-center gap-2">
                        <ArrowLeftRight size={13} /> Match Selected Widths
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        matchSelectedEntitySizes(menu.nodeIds, 'size')
                        onClose()
                      }}
                      className={itemClass}
                    >
                      <span className="flex items-center gap-2">
                        <Maximize2 size={13} /> Match Selected Card Sizes
                      </span>
                    </button>
                  </>
                )}
              </>
            )}
            {anyUnlocked &&
              entityTargets.some(
                (n) => n.data?.entityWidth !== undefined || n.data?.entityHeight !== undefined
              ) && (
                <button
                  type="button"
                  onClick={() => {
                    resetEntitySize(menu.nodeIds)
                    onClose()
                  }}
                  className={itemClass}
                >
                  <span className="flex items-center gap-2">
                    <RotateCcw size={13} /> Reset Card Sizes (Auto)
                  </span>
                </button>
              )}
          </>
        )}

        {!isPlayerEdition && (
          <button
            type="button"
            onClick={() => {
              batchUpdateNodes(menu.nodeIds, (n) => ({
                ...n,
                data: { ...n.data, isHidden: !allHidden }
              }))
              onClose()
            }}
            className={itemClass}
          >
            <span className="flex items-center gap-2">
              {allHidden ? <Eye size={13} /> : <EyeOff size={13} />}
              {allHidden ? 'Reveal Selected to Players' : 'Hide Selected from Players'}
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            duplicateSelection()
            onClose()
          }}
          className={itemClass}
        >
          <span className="flex items-center gap-2">
            <Files size={13} /> Duplicate Selected
          </span>
          <span className="text-[10px] text-slate-400" aria-hidden="true">
            Ctrl+D
          </span>
        </button>
        <button
          type="button"
          onClick={() => {
            copySelection()
            onClose()
          }}
          className={itemClass}
        >
          <span className="flex items-center gap-2">
            <Copy size={13} /> Copy Selected
          </span>
          <span className="text-[10px] text-slate-400" aria-hidden="true">
            Ctrl+C
          </span>
        </button>

        {canModifySelection && onRequestBatchDeleteNodes && (
          <>
            <hr className="my-1 border-slate-200 dark:border-slate-700" />
            <button
              type="button"
              onClick={() => {
                onRequestBatchDeleteNodes(menu.nodeIds)
                onClose()
              }}
              className="w-full px-3 py-1.5 text-left text-xs font-semibold flex items-center gap-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 focus-visible:bg-red-50 dark:focus-visible:bg-red-900/30 outline-none transition-colors cursor-pointer"
            >
              <Trash2 size={13} /> Delete Selected ({selNodes.length})
            </button>
          </>
        )}
      </>
    )
  } else if (menu?.mode === 'group') {
    widthClass = 'w-60'
    const groupNode = nodes.find((n) => n.id === menu.groupId)
    if (groupNode) {
      menuLabel = `Group Actions for ${groupNode.data.label}`
      const isLocked = Boolean(groupNode.data?.isLocked)
      const hasBackground = Boolean(groupNode.data?.hasBackground)
      const isHidden = Boolean(groupNode.data?.isHidden)
      const memberCount = nodes.filter((n) => n.data?.groupId === menu.groupId).length
      const canModifyGroup = !isPlayerEdition || Boolean(groupNode.data?.isPlayerCreated)

      bodyContent = (
        <>
          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 truncate border-b border-slate-100 dark:border-slate-700/70 mb-1">
            {groupNode.data.label} · {memberCount} {memberCount === 1 ? 'entity' : 'entities'}
          </div>

          {canModifyGroup && (
            <>
              <button
                type="button"
                onClick={() => {
                  toggleNodeLock([menu.groupId], !isLocked)
                  onClose()
                }}
                className={itemClass}
              >
                <span className="flex items-center gap-2 font-semibold">
                  {isLocked ? (
                    <Unlock size={13} className="text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Lock size={13} className="text-amber-600 dark:text-amber-400" />
                  )}
                  {isLocked ? 'Unlock Group & Members' : 'Lock Group & Members'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  updateNodeData(
                    menu.groupId,
                    {
                      hasBackground: !hasBackground,
                      groupBorderStyle: !hasBackground ? 'solid' : 'dashed'
                    },
                    true
                  )
                  onClose()
                }}
                className={itemClass}
              >
                <span className="flex items-center gap-2">
                  <PaintBucket size={13} className="text-blue-500" />
                  {hasBackground ? 'Remove Group Background' : 'Add Background to Group'}
                </span>
              </button>

              <div className="px-3 py-1.5 flex items-center justify-between gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Backdrop
                </span>
                <div className="flex items-center gap-1">
                  {GROUP_TINT_PALETTE.map((swatch) => {
                    const isActive =
                      hasBackground &&
                      !normalizeHexColor(groupNode.data.groupCustomColor) &&
                      (groupNode.data.groupColor || 'gold') === swatch.key
                    return (
                      <button
                        key={swatch.key}
                        type="button"
                        title={`Set ${swatch.label} background`}
                        aria-label={`Set ${swatch.label} background`}
                        aria-pressed={isActive}
                        onClick={() => {
                          updateNodeData(
                            menu.groupId,
                            {
                              hasBackground: true,
                              groupColor: swatch.key,
                              groupCustomColor: undefined,
                              groupBorderStyle: groupNode.data.groupBorderStyle || 'solid'
                            },
                            true
                          )
                          onClose()
                        }}
                        style={{ backgroundColor: swatch.swatchHex }}
                        className={`dcc-color-swatch w-4 h-4 rounded-full border shadow-sm inline-flex items-center justify-center transition-transform cursor-pointer outline-none ${
                          isActive
                            ? 'ring-2 ring-blue-500 border-white scale-110'
                            : 'border-slate-400/80 dark:border-slate-500 hover:scale-110'
                        }`}
                      >
                        {isActive && <Check size={9} strokeWidth={3} className="text-white" />}
                      </button>
                    )
                  })}
                  <input
                    type="color"
                    title="Custom group background color"
                    aria-label="Custom group background color"
                    value={
                      resolveGroupTint(groupNode.data.groupColor, groupNode.data.groupCustomColor)
                        .swatchHex
                    }
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={() => pushHistory(true)}
                    onChange={(e) =>
                      updateNodeData(
                        menu.groupId,
                        {
                          hasBackground: true,
                          groupCustomColor: e.target.value,
                          groupBorderStyle: groupNode.data.groupBorderStyle || 'solid'
                        },
                        false
                      )
                    }
                    className="dcc-color-swatch w-4.5 h-4.5 rounded border border-slate-300 dark:border-slate-600 cursor-pointer bg-transparent p-0"
                  />
                </div>
              </div>

              {/* Quick Group Standing Picker */}
              <div className="px-3 py-1.5 flex items-center justify-between gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Standing
                </span>
                <div className="flex items-center gap-1">
                  {(
                    [
                      { key: 'Allied', symbol: '★', cls: 'text-emerald-700 dark:text-emerald-300 border-emerald-400/80' },
                      { key: 'Friendly', symbol: '☺', cls: 'text-teal-700 dark:text-teal-300 border-teal-400/80' },
                      { key: 'Neutral', symbol: '•', cls: 'text-slate-700 dark:text-slate-300 border-slate-400/80' },
                      { key: 'Suspicious', symbol: '?', cls: 'text-amber-700 dark:text-amber-300 border-amber-400/80' },
                      { key: 'Hostile', symbol: '⚔', cls: 'text-red-700 dark:text-red-300 border-red-400/80' }
                    ] as Array<{ key: PartyDisposition; symbol: string; cls: string }>
                  ).map((st) => {
                    const currentDisp = groupNode.data.dndFields?.disposition || ''
                    const active = currentDisp === st.key
                    return (
                      <button
                        key={st.key}
                        type="button"
                        title={`Set group standing: ${st.key}`}
                        aria-label={`Set group standing to ${st.key}`}
                        aria-pressed={active}
                        onClick={() => {
                          updateNodeData(
                            menu.groupId,
                            {
                              dndFields: {
                                ...(groupNode.data.dndFields || {}),
                                disposition: active ? '' : st.key
                              }
                            },
                            true
                          )
                          onClose()
                        }}
                        className={`w-5 h-5 rounded border text-[10px] font-bold inline-flex items-center justify-center transition-colors cursor-pointer ${
                          active
                            ? `bg-blue-600 text-white border-blue-600`
                            : `bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 ${st.cls}`
                        }`}
                      >
                        {st.symbol}
                      </button>
                    )
                  })}
                </div>
              </div>

              {memberCount > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      tidyGroupMembers(menu.groupId)
                      onClose()
                    }}
                    className={itemClass}
                  >
                    <span className="flex items-center gap-2">
                      <LayoutGrid size={13} className="text-indigo-500" /> Tidy Members in Grid
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      fitGroupToMembers(menu.groupId)
                      onClose()
                    }}
                    className={itemClass}
                  >
                    <span className="flex items-center gap-2">
                      <Shrink size={13} /> Fit Group Frame to Members
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      selectGroupMembers(menu.groupId)
                      onClose()
                    }}
                    className={itemClass}
                  >
                    <span className="flex items-center gap-2">
                      <MousePointerClick size={13} /> Select All Members ({memberCount})
                    </span>
                  </button>
                </>
              )}
              {existingGroups.length >= 2 && (
                <>
                  <hr className="my-1 border-slate-200 dark:border-slate-700" />
                  {renderStackingMenuItems([menu.groupId], 'group')}
                </>
              )}
              {!isLocked && (
                <button
                  type="button"
                  onClick={() => {
                    const geom = buildNodeBorderGeometry(groupNode, edges)
                    const created =
                      menu.flowX !== undefined && menu.flowY !== undefined
                        ? (() => {
                            const proj = projectPointToNodePerimeter(
                              menu.flowX,
                              menu.flowY,
                              geom,
                              {
                                magneticSnap: false
                              }
                            )
                            return addCustomPort(menu.groupId, {
                              side: proj.side,
                              offset: proj.offset
                            })
                          })()
                        : addCustomPort(menu.groupId)
                    if (created) {
                      window.dispatchEvent(
                        new CustomEvent('dcc:announce', {
                          detail: {
                            message: `Added connection point on ${formatPerimeterAnchorDescription(created)}`
                          }
                        })
                      )
                    }
                    onClose()
                  }}
                  className={itemClass}
                >
                  <span className="flex items-center gap-2">
                    <CircleDot size={13} className="text-amber-500" /> Add Connection Point on Edge
                  </span>
                </button>
              )}
              {!isLocked && hasModifiedBuiltinPorts(groupNode.data, true) && (
                <button
                  type="button"
                  onClick={() => {
                    resetBuiltinPorts(menu.groupId)
                    onClose()
                  }}
                  className={itemClass}
                >
                  <span className="flex items-center gap-2">
                    <RotateCcw size={13} className="text-amber-500" /> Restore Default Connection Points
                  </span>
                </button>
              )}
              <hr className="my-1 border-slate-200 dark:border-slate-700" />
            </>
          )}

          {!isPlayerEdition && onMysterySpotlightNode && Boolean(groupNode.data.portrait) && (
            <button
              type="button"
              onClick={() => {
                onMysterySpotlightNode(menu.groupId)
                onClose()
              }}
              className={itemClass}
            >
              <span className="flex items-center gap-2 text-purple-700 dark:text-purple-300 font-semibold">
                <HelpCircle size={13} /> Mystery Crest Spotlight (???)
              </span>
            </button>
          )}

          {!isPlayerEdition && onSpotlightNode && (
            <button
              type="button"
              onClick={() => {
                onSpotlightNode(menu.groupId)
                onClose()
              }}
              className={itemClass}
            >
              <span className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-semibold">
                <Sparkles size={13} /> Spotlight Group on Player Screen
              </span>
            </button>
          )}

          {onFocusDegrees && (
            <button
              type="button"
              onClick={() => {
                onFocusDegrees(menu.groupId, 1)
                onClose()
              }}
              className={itemClass}
            >
              <span className="flex items-center gap-2">
                <Network size={13} className="text-blue-500" /> Focus Group Web (1 Hop)
              </span>
            </button>
          )}

          {!isPlayerEdition && (
            <button
              type="button"
              onClick={() => {
                updateNodeData(menu.groupId, { isHidden: !isHidden }, true)
                onClose()
              }}
              className={itemClass}
            >
              <span className="flex items-center gap-2">
                {isHidden ? <Eye size={13} /> : <EyeOff size={13} />}
                {isHidden ? 'Reveal Group Frame to Players' : 'Hide Group Frame from Players'}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              duplicateSelection(menu.groupId)
              onClose()
            }}
            className={itemClass}
          >
            <span className="flex items-center gap-2">
              <Files size={13} /> Duplicate Group &amp; Members
            </span>
            <span className="text-[10px] text-slate-400" aria-hidden="true">
              Ctrl+D
            </span>
          </button>

          {canModifyGroup && (
            <>
              <hr className="my-1 border-slate-200 dark:border-slate-700" />
              <button
                type="button"
                onClick={() => {
                  ungroupNodes(menu.groupId)
                  onClose()
                }}
                className={itemClass}
              >
                <span className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
                  <FolderMinus size={13} /> Ungroup (Keep Entities)
                </span>
                <span className="text-[10px] text-slate-400" aria-hidden="true">
                  Ctrl+Shift+G
                </span>
              </button>
              {onRequestDeleteGroupWithContents && (
                <button
                  type="button"
                  onClick={() => {
                    onRequestDeleteGroupWithContents(menu.groupId)
                    onClose()
                  }}
                  className="w-full px-3 py-1.5 text-left text-xs font-semibold flex items-center gap-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 focus-visible:bg-red-50 dark:focus-visible:bg-red-900/30 outline-none transition-colors cursor-pointer"
                >
                  <Trash2 size={13} /> Delete Group &amp; Contents
                </button>
              )}
            </>
          )}
        </>
      )
    }
  } else if (menu?.mode === 'node') {
    widthClass = 'w-60'
    const targetNode = nodes.find((n) => n.id === menu.nodeId)
    if (targetNode) {
      menuLabel = `Actions for ${targetNode.data.label}`
      const isHidden = Boolean(targetNode.data?.isHidden)
      const isLocked = Boolean(targetNode.data?.isLocked)
      const activeEntityBg = normalizeHexColor(targetNode.data?.bgColor)
      const parentGroup = targetNode.data?.groupId
        ? nodes.find((g) => g.id === targetNode.data.groupId)
        : undefined
      const canDeleteNode = !isPlayerEdition || Boolean(targetNode.data?.isPlayerCreated)
      bodyContent = (
        <>
          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate border-b border-slate-100 dark:border-slate-700/70 mb-1">
            {targetNode.data.label}
          </div>
          {canDeleteNode && (
            <div className="px-3 py-1.5 flex items-center justify-between gap-1 border-b border-slate-100 dark:border-slate-700/70 mb-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Card Fill
              </span>
              <div className="flex items-center gap-1">
                {QUICK_CARD_BG_SWATCHES.map((swatch) => {
                  const isActive = activeEntityBg === swatch.hex.toLowerCase()
                  const darkSwatch = isHexColorDark(swatch.hex)
                  return (
                    <button
                      key={swatch.key}
                      type="button"
                      title={`Set ${swatch.label} card background`}
                      aria-label={`Set ${swatch.label} card background`}
                      aria-pressed={isActive}
                      onClick={() => {
                        updateNodeData(menu.nodeId, { bgColor: swatch.hex }, true)
                        onClose()
                      }}
                      style={{ backgroundColor: swatch.hex }}
                      className={`dcc-color-swatch w-4 h-4 rounded-full border shadow-sm inline-flex items-center justify-center transition-transform cursor-pointer outline-none ${
                        isActive
                          ? 'ring-2 ring-blue-500 border-blue-600 scale-110'
                          : 'border-slate-400/80 dark:border-slate-500 hover:scale-110'
                      }`}
                    >
                      {isActive && (
                        <Check
                          size={9}
                          strokeWidth={3}
                          className={darkSwatch ? 'text-white' : 'text-slate-900'}
                        />
                      )}
                    </button>
                  )
                })}
                <input
                  type="color"
                  title="Custom card background color"
                  aria-label="Custom card background color"
                  value={activeEntityBg || '#fef3c7'}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={() => pushHistory(true)}
                  onChange={(e) =>
                    updateNodeData(menu.nodeId, { bgColor: e.target.value }, false)
                  }
                  className="dcc-color-swatch w-4.5 h-4.5 rounded border border-slate-300 dark:border-slate-600 cursor-pointer bg-transparent p-0"
                />
                {activeEntityBg && (
                  <button
                    type="button"
                    title="Reset card background to default"
                    aria-label="Reset card background to default"
                    onClick={() => {
                      updateNodeData(menu.nodeId, { bgColor: undefined }, true)
                      onClose()
                    }}
                    className="p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <RotateCcw size={12} />
                  </button>
                )}
              </div>
            </div>
          )}
          {!isPlayerEdition && onSpotlightNode && (
            <button
              type="button"
              onClick={() => {
                onSpotlightNode(menu.nodeId)
                onClose()
              }}
              className={itemClass}
            >
              <span className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-semibold">
                <Sparkles size={13} /> Spotlight on Player Screen
              </span>
            </button>
          )}
          {!isPlayerEdition && onMysterySpotlightNode && Boolean(targetNode.data?.portrait) && (
            <button
              type="button"
              onClick={() => {
                onMysterySpotlightNode(menu.nodeId)
                onClose()
              }}
              className={itemClass}
            >
              <span className="flex items-center gap-2 text-purple-700 dark:text-purple-300 font-semibold">
                <HelpCircle size={13} /> Mystery Spotlight (??? Art Only)
              </span>
            </button>
          )}
          {onFocusDegrees && (
            <>
              <button
                type="button"
                onClick={() => {
                  onFocusDegrees(menu.nodeId, 1)
                  onClose()
                }}
                className={itemClass}
              >
                <span className="flex items-center gap-2">
                  <Network size={13} className="text-blue-500" /> Focus Web (1 Hop)
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onFocusDegrees(menu.nodeId, 2)
                  onClose()
                }}
                className={itemClass}
              >
                <span className="flex items-center gap-2">
                  <Network size={13} className="text-indigo-500" /> Focus Web (2 Hops)
                </span>
              </button>
              {activeFocusDegrees !== '' && (
                <button
                  type="button"
                  onClick={() => {
                    onFocusDegrees(menu.nodeId, '')
                    onClose()
                  }}
                  className={itemClass}
                >
                  <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                    <RotateCcw size={13} /> Clear Focus Web
                  </span>
                </button>
              )}
            </>
          )}

          {canDeleteNode && (
            <>
              <hr className="my-1 border-slate-200 dark:border-slate-700" />
              {renderStackingMenuItems([menu.nodeId], 'entity')}
              <hr className="my-1 border-slate-200 dark:border-slate-700" />
              {!isLocked && !parentGroup?.data?.isLocked && (
                <button
                  type="button"
                  onClick={() => {
                    const geom = buildNodeBorderGeometry(targetNode, edges)
                    const created =
                      menu.flowX !== undefined && menu.flowY !== undefined
                        ? (() => {
                            const proj = projectPointToNodePerimeter(
                              menu.flowX,
                              menu.flowY,
                              geom,
                              {
                                magneticSnap: false
                              }
                            )
                            return addCustomPort(menu.nodeId, {
                              side: proj.side,
                              offset: proj.offset
                            })
                          })()
                        : addCustomPort(menu.nodeId)
                    if (created) {
                      window.dispatchEvent(
                        new CustomEvent('dcc:announce', {
                          detail: {
                            message: `Added connection point on ${formatPerimeterAnchorDescription(created)}`
                          }
                        })
                      )
                    }
                    onClose()
                  }}
                  className={itemClass}
                >
                  <span className="flex items-center gap-2">
                    <CircleDot size={13} className="text-amber-500" /> Add Connection Point on Edge
                  </span>
                </button>
              )}
              {!isLocked &&
                !parentGroup?.data?.isLocked &&
                hasModifiedBuiltinPorts(targetNode.data, false) && (
                  <button
                    type="button"
                    onClick={() => {
                      resetBuiltinPorts(menu.nodeId)
                      onClose()
                    }}
                    className={itemClass}
                  >
                    <span className="flex items-center gap-2">
                      <RotateCcw size={13} className="text-amber-500" /> Restore Default Connection Points
                    </span>
                  </button>
                )}
              <button
                type="button"
                onClick={() => {
                  toggleNodeLock([menu.nodeId], !isLocked)
                  onClose()
                }}
                className={itemClass}
              >
                <span className="flex items-center gap-2">
                  {isLocked ? <Unlock size={13} /> : <Lock size={13} />}
                  {isLocked ? 'Unlock Position' : 'Lock Position'}
                </span>
              </button>
              {!isLocked &&
                !parentGroup?.data?.isLocked &&
                (targetNode.data?.entityWidth !== undefined ||
                  targetNode.data?.entityHeight !== undefined) && (
                  <button
                    type="button"
                    onClick={() => {
                      resetEntitySize([menu.nodeId])
                      onClose()
                    }}
                    className={itemClass}
                  >
                    <span className="flex items-center gap-2">
                      <RotateCcw size={13} /> Reset Card Size (Auto)
                    </span>
                  </button>
                )}
            </>
          )}

          {parentGroup ? (
            <>
              {onSelectNode && (
                <button
                  type="button"
                  onClick={() => {
                    onSelectNode(parentGroup.id)
                    onClose()
                  }}
                  className={itemClass}
                >
                  <span className="flex items-center gap-2 truncate">
                    <FolderKanban size={13} className="text-amber-600 shrink-0" />
                    <span className="truncate">Select Group &ldquo;{parentGroup.data.label}&rdquo;</span>
                  </span>
                </button>
              )}
              {canDeleteNode && (
                <button
                  type="button"
                  onClick={() => {
                    assignNodesToGroup([menu.nodeId], undefined)
                    onClose()
                  }}
                  className={itemClass}
                >
                  <span className="flex items-center gap-2">
                    <FolderMinus size={13} /> Remove from Group
                  </span>
                </button>
              )}
            </>
          ) : (
            canDeleteNode &&
            existingGroups.length > 0 && (
              <>
                {existingGroups.slice(0, 3).map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      assignNodesToGroup([menu.nodeId], g.id)
                      onClose()
                    }}
                    className={itemClass}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <FolderKanban size={13} className="text-amber-600 shrink-0" />
                      <span className="truncate">Add to &ldquo;{g.data.label}&rdquo;</span>
                    </span>
                  </button>
                ))}
              </>
            )
          )}

          <button
            type="button"
            onClick={() => {
              duplicateSelection(menu.nodeId)
              onClose()
            }}
            className={itemClass}
          >
            <span className="flex items-center gap-2">
              <Files size={13} /> {isPlayerEdition ? 'Duplicate as Theory Pin' : 'Duplicate'}
            </span>
            <span className="text-[10px] text-slate-400" aria-hidden="true">
              Ctrl+D
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              copySelection(menu.nodeId)
              onClose()
            }}
            className={itemClass}
          >
            <span className="flex items-center gap-2">
              <Copy size={13} /> Copy
            </span>
            <span className="text-[10px] text-slate-400" aria-hidden="true">
              Ctrl+C
            </span>
          </button>
          {!isPlayerEdition && (
            <button
              type="button"
              onClick={() => {
                updateNodeData(menu.nodeId, { isHidden: !isHidden }, true)
                onClose()
              }}
              className={itemClass}
            >
              <span className="flex items-center gap-2">
                {isHidden ? <Eye size={13} /> : <EyeOff size={13} />}
                {isHidden ? 'Reveal to Players' : 'Hide from Players'}
              </span>
            </button>
          )}
          {canDeleteNode && (
            <>
              <hr className="my-1 border-slate-200 dark:border-slate-700" />
              <button
                type="button"
                onClick={() => {
                  onRequestDeleteNode(menu.nodeId)
                  onClose()
                }}
                className="w-full px-3 py-1.5 text-left text-xs font-semibold flex items-center gap-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 focus-visible:bg-red-50 dark:focus-visible:bg-red-900/30 outline-none transition-colors cursor-pointer"
              >
                <Trash2 size={13} /> {isPlayerEdition ? 'Delete Theory Pin' : 'Delete Entity'}
              </button>
            </>
          )}
        </>
      )
    }
  } else if (menu?.mode === 'edge') {
    const targetEdge = edges.find((e) => e.id === menu.edgeId)
    if (targetEdge) {
      widthClass = 'w-56'
      menuLabel = `Actions for ${targetEdge.data?.label || 'Connection'}`
      const isHidden = Boolean(targetEdge.data?.isHidden)
      const hasWaypoints = Boolean(targetEdge.data?.waypoints?.length)
      const hasCustomEndpoints = Boolean(
        targetEdge.data?.sourceAnchor ||
          targetEdge.data?.targetAnchor ||
          targetEdge.sourceHandle?.startsWith('cp-') ||
          targetEdge.targetHandle?.startsWith('cp-')
      )
      const canModifyEdge = !isPlayerEdition || Boolean(targetEdge.data?.isPlayerCreated)
      bodyContent = (
        <>
          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate border-b border-slate-100 dark:border-slate-700/70 mb-1">
            {targetEdge.data?.label || 'Connection'}
          </div>
          {!isPlayerEdition && onSpotlightEdge && (
            <button
              type="button"
              onClick={() => {
                onSpotlightEdge(menu.edgeId)
                onClose()
              }}
              className={itemClass}
            >
              <span className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-semibold">
                <Sparkles size={13} /> Spotlight on Player Screen
              </span>
            </button>
          )}
          {canModifyEdge && (
            <>
              <button
                type="button"
                onClick={() => {
                  reverseEdgeDirection(menu.edgeId)
                  onClose()
                }}
                className={itemClass}
              >
                <span className="flex items-center gap-2">
                  <ArrowLeftRight size={13} /> Reverse Direction
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  addWaypoint(menu.edgeId, menu.flowX, menu.flowY)
                  onClose()
                }}
                className={itemClass}
              >
                <span className="flex items-center gap-2">
                  <GitCommitHorizontal size={13} /> Add Anchor Point Here
                </span>
              </button>
              {hasWaypoints && (
                <button
                  type="button"
                  onClick={() => {
                    clearWaypoints(menu.edgeId)
                    onClose()
                  }}
                  className={itemClass}
                >
                  <span className="flex items-center gap-2">
                    <RotateCcw size={13} /> Reset Curve Routing
                  </span>
                </button>
              )}
              {hasCustomEndpoints && (
                <button
                  type="button"
                  onClick={() => {
                    resetEdgeEndpointAnchors(menu.edgeId)
                    onClose()
                  }}
                  className={itemClass}
                >
                  <span className="flex items-center gap-2">
                    <RotateCcw size={13} /> Reset Endpoint Positions
                  </span>
                </button>
              )}
            </>
          )}
          {!isPlayerEdition && (
            <button
              type="button"
              onClick={() => {
                updateEdgeData(menu.edgeId, { isHidden: !isHidden }, true)
                onClose()
              }}
              className={itemClass}
            >
              <span className="flex items-center gap-2">
                {isHidden ? <Eye size={13} /> : <EyeOff size={13} />}
                {isHidden ? 'Reveal to Players' : 'Hide from Players'}
              </span>
            </button>
          )}

          {canModifyEdge && connectionPresets.length > 0 && (
            <>
              <hr className="my-1 border-slate-200 dark:border-slate-700" />
              <div className="px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Apply Preset
              </div>
              {connectionPresets.slice(0, 6).map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    const currentTrimmed = (targetEdge.data?.label || '').trim()
                    const shouldReplaceLabel =
                      !currentTrimmed ||
                      connectionPresets.some(
                        (p) => p.label.toLowerCase() === currentTrimmed.toLowerCase()
                      )
                    updateEdgeData(
                      menu.edgeId,
                      {
                        label: shouldReplaceLabel ? preset.label : targetEdge.data?.label,
                        preset: preset.label,
                        color: preset.color,
                        lineStyle: preset.lineStyle,
                        thickness: preset.thickness,
                        direction: preset.direction || 'none'
                      },
                      true
                    )
                    onClose()
                  }}
                  className={itemClass}
                >
                  <span className="flex items-center gap-2 truncate">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: preset.color }}
                    />
                    <span className="truncate">{preset.label}</span>
                  </span>
                </button>
              ))}
            </>
          )}

          {canModifyEdge && (
            <>
              <hr className="my-1 border-slate-200 dark:border-slate-700" />
              <button
                type="button"
                onClick={() => {
                  onRequestDeleteEdge(menu.edgeId)
                  onClose()
                }}
                className="w-full px-3 py-1.5 text-left text-xs font-semibold flex items-center gap-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 focus-visible:bg-red-50 dark:focus-visible:bg-red-900/30 outline-none transition-colors cursor-pointer"
              >
                <Trash2 size={13} /> {isPlayerEdition ? 'Delete Theory Link' : 'Delete Connection'}
              </button>
            </>
          )}
          {!canModifyEdge && (
            <div className="px-3 py-2 text-[11px] text-slate-500 dark:text-slate-400">
              Select connection to add Party Notes in the right panel.
            </div>
          )}
        </>
      )
    }
  } else if (menu?.mode === 'pane') {
    menuLabel = 'Canvas Actions'
    const paneTypes = [
      ...QUICK_ENTITY_TYPES.slice(0, 4),
      ...customEntityTypes.map((c) => ({ type: c.label, label: c.label }))
    ]
    bodyContent = (
      <>
        <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-700/70 mb-1">
          Canvas Actions
        </div>
        {paneTypes.map((t) => (
          <button
            key={t.type}
            type="button"
            onClick={() => {
              addNode({
                id: crypto.randomUUID(),
                type: 'entity',
                position: { x: menu.flowX - 95, y: menu.flowY - 24 },
                data: { label: `New ${t.type}`, entityType: t.type }
              })
              onClose()
            }}
            className={itemClass}
          >
            <span className="flex items-center gap-2 truncate">
              <Plus size={13} className="text-blue-500 shrink-0" />
              <span className="truncate">Add {t.label} Here</span>
            </span>
          </button>
        ))}
        <hr className="my-1 border-slate-200 dark:border-slate-700" />
        <button
          type="button"
          disabled={!clipboard || clipboard.nodes.length === 0}
          onClick={() => {
            pasteClipboard({ x: menu.flowX, y: menu.flowY })
            onClose()
          }}
          className={itemClass}
        >
          <span className="flex items-center gap-2">
            <ClipboardPaste size={13} /> Paste Here
          </span>
          <span className="text-[10px] text-slate-400" aria-hidden="true">
            Ctrl+V
          </span>
        </button>
        <button
          type="button"
          onClick={() => {
            onFitView()
            onClose()
          }}
          className={itemClass}
        >
          <span className="flex items-center gap-2">
            <Maximize2 size={13} /> Fit Entire Map
          </span>
        </button>
        <hr className="my-1 border-slate-200 dark:border-slate-700" />
        <div className="px-3 py-1.5 flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Drag Snap
            </span>
            <span className="text-[10px] text-slate-400" aria-hidden="true">
              G · Alt-Drag
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {DRAG_SNAP_OPTIONS.map((opt: DragSnapOption) => {
              const activeOpt: DragSnapOption = dragSnapEnabled ? dragSnapSize : 0
              const isSelected = activeOpt === opt
              return (
                <button
                  key={opt}
                  type="button"
                  aria-pressed={isSelected}
                  title={`Set drag jump distance to ${DRAG_SNAP_LABELS[opt].full}`}
                  onClick={() => {
                    setDragSnapOption(opt)
                    onClose()
                  }}
                  className={`px-1.5 py-1 min-h-6 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-700/80 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {DRAG_SNAP_LABELS[opt].short}
                </button>
              )
            })}
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      {/* Zero-size fixed placeholder directly before popover for point-anchored context menus */}
      <div
        ref={anchorRef}
        aria-hidden="true"
        className="no-export"
        style={{ position: 'fixed', left: 0, top: 0, width: 0, height: 0, pointerEvents: 'none' }}
      />
      <div
        ref={popoverRef}
        {...({ popover: 'auto' } as any)}
        className={`context-menu-popover no-export ${widthClass} rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xl py-1.5 p-0`}
      >
        <div
          ref={groupRef}
          {...({ focusgroup: 'menu nomemory' } as any)}
          aria-label={menuLabel}
          className="py-1.5"
        >
          {bodyContent}
        </div>
      </div>
    </>
  )
}
