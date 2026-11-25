import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import { DndNode, PartyDisposition } from '../types'
import {
  alignSelectedNodes,
  distributeSelectedNodes,
  getNodeStackBounds,
  isNodeEffectivelyLocked,
  tidySelectedNodesGrid
} from '../utils/graphPipeline'
import { availableIcons, getIconColor } from '../utils/icons'
import { ConfirmModal } from './NativeModal'
import {
  X,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  ArrowLeftRight,
  ArrowUpDown,
  LayoutGrid,
  Eye,
  EyeOff,
  Trash2,
  Files,
  Tag,
  Layers,
  FolderKanban,
  Lock,
  PaintBucket,
  RotateCcw,
  BringToFront,
  SendToBack,
  ArrowUp,
  ArrowDown,
  Maximize2
} from 'lucide-react'
import { ENTITY_BG_SWATCHES, normalizeHexColor } from '../utils/colorUtils'

interface MultiSelectPanelProps {
  selectedNodes: DndNode[]
  className?: string
  onClose: () => void
  onNavigateToNode: (nodeId: string) => void
}

const STANDARD_ENTITY_TYPES = ['PC', 'NPC', 'Location', 'Item', 'Organization', 'Event']

export default function MultiSelectPanel({
  selectedNodes,
  className = '',
  onClose,
  onNavigateToNode
}: MultiSelectPanelProps) {
  const toolbarRef = useRef<HTMLDivElement>(null)
  const {
    campaignEdition,
    nodes,
    setNodes,
    customEntityTypes,
    batchUpdateNodes,
    batchDeleteNodes,
    duplicateSelection,
    createGroupFromSelection,
    toggleNodeLock,
    reorderNodes,
    resetEntitySize,
    matchSelectedEntitySizes,
    pushHistory
  } = useStore()

  const isPlayerEdition = campaignEdition === 'player'
  const selectedIds = selectedNodes.map((n) => n.id)
  const canDistribute = selectedNodes.length >= 3
  const stackBounds = getNodeStackBounds(nodes, selectedIds)

  const [tagInput, setTagInput] = useState('')
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  // Roving tabindex fallback when native `HTMLElement.prototype.focusGroup` is unsupported
  useEffect(() => {
    const toolbar = toolbarRef.current
    if (!toolbar) return
    if ('focusGroup' in HTMLElement.prototype) return

    const items = Array.from(toolbar.querySelectorAll<HTMLButtonElement>('button'))
    if (items.length === 0) return
    if (!items.some((el) => el.tabIndex === 0)) {
      items.forEach((el, idx) => {
        el.tabIndex = idx === 0 ? 0 : -1
      })
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const currentItems = Array.from(toolbar.querySelectorAll<HTMLButtonElement>('button'))
      const idx = currentItems.indexOf(document.activeElement as HTMLButtonElement)
      if (idx === -1) return

      let nextIdx = -1
      if (event.key === 'ArrowRight') {
        nextIdx = (idx + 1) % currentItems.length
      } else if (event.key === 'ArrowLeft') {
        nextIdx = (idx - 1 + currentItems.length) % currentItems.length
      } else if (event.key === 'Home') {
        nextIdx = 0
      } else if (event.key === 'End') {
        nextIdx = currentItems.length - 1
      }

      if (nextIdx !== -1) {
        event.preventDefault()
        currentItems[idx].tabIndex = -1
        currentItems[nextIdx].tabIndex = 0
        currentItems[nextIdx].focus()
      }
    }

    toolbar.addEventListener('keydown', onKeyDown)
    return () => toolbar.removeEventListener('keydown', onKeyDown)
  }, [])

  const applyPositionUpdates = (updates: Map<string, { x: number; y: number }>) => {
    if (updates.size === 0) return
    pushHistory(true)
    setNodes(
      nodes.map((n) => {
        const nextPos = updates.get(n.id)
        return nextPos ? { ...n, position: nextPos } : n
      })
    )
  }

  const applyAlignment = (
    axis: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'
  ) => {
    const mode =
      axis === 'center' ? 'centerX' : axis === 'middle' ? 'middleY' : axis
    applyPositionUpdates(alignSelectedNodes(selectedNodes, mode))
  }

  const applyDistribution = (direction: 'horizontal' | 'vertical') => {
    if (!canDistribute) return
    applyPositionUpdates(distributeSelectedNodes(selectedNodes, direction))
  }

  const applyTidyGrid = () => {
    applyPositionUpdates(tidySelectedNodesGrid(selectedNodes))
  }

  const handleAddBatchTag = () => {
    const clean = tagInput
      .trim()
      .replace(/^#+/, '')
      .toLowerCase()
      .replace(/\s+/g, '-')
    if (!clean) return
    batchUpdateNodes(selectedIds, (node) => {
      const existing = node.data.tags || []
      if (existing.some((t) => t.toLowerCase() === clean)) return node
      return {
        ...node,
        data: {
          ...node.data,
          tags: [...existing, clean]
        }
      }
    })
    setTagInput('')
  }

  const handleRemoveSharedTag = (tagToRemove: string) => {
    batchUpdateNodes(selectedIds, (node) => ({
      ...node,
      data: {
        ...node.data,
        tags: (node.data.tags || []).filter((t) => t.toLowerCase() !== tagToRemove.toLowerCase())
      }
    }))
  }

  // Compute tags present on at least one selected node
  const tagCounts = new Map<string, number>()
  selectedNodes.forEach((n) => {
    ;(n.data.tags || []).forEach((t) => {
      const norm = t.toLowerCase()
      tagCounts.set(norm, (tagCounts.get(norm) || 0) + 1)
    })
  })

  const allCategoryOptions = [
    ...STANDARD_ENTITY_TYPES,
    ...customEntityTypes.map((c) => c.label)
  ]

  const hiddenCount = selectedNodes.filter((n) => n.data?.isHidden).length
  const revealedCount = selectedNodes.length - hiddenCount

  const toolBtnClass =
    'p-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-900/40 hover:border-blue-300 dark:hover:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500 outline-none transition-colors cursor-pointer aria-disabled:opacity-40 aria-disabled:cursor-not-allowed aria-disabled:hover:bg-white dark:aria-disabled:hover:bg-slate-900'

  return (
    <aside
      className={`dcc-scroll-y dcc-scroll-shadow h-full w-[352px] shrink-0 dcc-surface-panel border-l p-4 flex flex-col gap-4 shadow-xl z-20 overflow-y-auto overscroll-contain ${className}`}
    >
      <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <Layers size={16} className="text-blue-600 dark:text-blue-400 shrink-0" aria-hidden="true" />
          <div>
            <h2 className="font-bold text-base text-slate-800 dark:text-slate-100 leading-tight">
              Batch Studio
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {selectedNodes.length} entities selected
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Clear multi-selection"
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1"
        >
          <X size={18} />
        </button>
      </div>

      {/* Group Region & Position Lock Quick Actions */}
      {selectedNodes.some((n) => n.type !== 'groupRegion' && !n.data?.isGroup) && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Group &amp; Lock Selection
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => createGroupFromSelection({ nodeIds: selectedIds })}
              className="px-2.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <FolderKanban size={13} /> Group (Ctrl+G)
            </button>
            <button
              type="button"
              onClick={() => createGroupFromSelection({ nodeIds: selectedIds, lock: true })}
              className="px-2.5 py-1.5 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Lock size={13} /> Group &amp; Lock
            </button>
            <button
              type="button"
              onClick={() =>
                createGroupFromSelection({
                  nodeIds: selectedIds,
                  withBackground: true,
                  color: 'gold'
                })
              }
              className="px-2.5 py-1.5 rounded-md bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <PaintBucket size={13} /> Group + Backdrop
            </button>
            <button
              type="button"
              onClick={() => toggleNodeLock(selectedIds)}
              className="px-2.5 py-1.5 rounded-md bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Lock size={13} /> Lock / Unlock
            </button>
          </div>
        </div>
      )}

      {/* Stacking Order Quick Controls */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          <Layers size={12} aria-hidden="true" /> Stacking Order
        </span>
        <div
          role="group"
          aria-label="Stacking order for selected items"
          className="grid grid-cols-4 gap-1"
        >
          <button
            type="button"
            disabled={!stackBounds.canSendBack}
            onClick={() => reorderNodes(selectedIds, 'back')}
            title="Send Selected to Back (Ctrl+[)"
            className="px-2 py-1.5 rounded-md bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <SendToBack size={12} aria-hidden="true" />
            <span>Back</span>
          </button>
          <button
            type="button"
            disabled={!stackBounds.canSendBack}
            onClick={() => reorderNodes(selectedIds, 'backward')}
            title="Send Selected Backward ([)"
            className="px-2 py-1.5 rounded-md bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowDown size={12} aria-hidden="true" />
            <span>-1</span>
          </button>
          <button
            type="button"
            disabled={!stackBounds.canBringFront}
            onClick={() => reorderNodes(selectedIds, 'forward')}
            title="Bring Selected Forward (])"
            className="px-2 py-1.5 rounded-md bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowUp size={12} aria-hidden="true" />
            <span>+1</span>
          </button>
          <button
            type="button"
            disabled={!stackBounds.canBringFront}
            onClick={() => reorderNodes(selectedIds, 'front')}
            title="Bring Selected to Front (Ctrl+])"
            className="px-2 py-1.5 rounded-md bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <BringToFront size={12} aria-hidden="true" />
            <span>Front</span>
          </button>
        </div>
      </div>

      {/* Layout Alignment, Distribution & Tidy Grid Toolbar */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Align &amp; Distribute Layout
        </span>
        <div
          ref={toolbarRef}
          role="toolbar"
          {...({ focusgroup: 'toolbar wrap' } as any)}
          aria-label="Align and distribute selected entities"
          className="flex flex-wrap items-center gap-1 p-1.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700"
        >
          <div role="group" aria-label="Horizontal alignment" className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => applyAlignment('left')}
              aria-label="Align left edges"
              title="Align Left Edges"
              className={toolBtnClass}
            >
              <AlignStartVertical size={14} />
            </button>
            <button
              type="button"
              onClick={() => applyAlignment('center')}
              aria-label="Align horizontal centers"
              title="Align Horizontal Centers"
              className={toolBtnClass}
            >
              <AlignCenterVertical size={14} />
            </button>
            <button
              type="button"
              onClick={() => applyAlignment('right')}
              aria-label="Align right edges"
              title="Align Right Edges"
              className={toolBtnClass}
            >
              <AlignEndVertical size={14} />
            </button>
          </div>

          <div
            role="separator"
            aria-orientation="vertical"
            className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5 shrink-0"
          />

          <div role="group" aria-label="Vertical alignment" className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => applyAlignment('top')}
              aria-label="Align top edges"
              title="Align Top Edges"
              className={toolBtnClass}
            >
              <AlignStartHorizontal size={14} />
            </button>
            <button
              type="button"
              onClick={() => applyAlignment('middle')}
              aria-label="Align vertical centers"
              title="Align Vertical Centers"
              className={toolBtnClass}
            >
              <AlignCenterHorizontal size={14} />
            </button>
            <button
              type="button"
              onClick={() => applyAlignment('bottom')}
              aria-label="Align bottom edges"
              title="Align Bottom Edges"
              className={toolBtnClass}
            >
              <AlignEndHorizontal size={14} />
            </button>
          </div>

          <div
            role="separator"
            aria-orientation="vertical"
            className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5 shrink-0"
          />

          <div role="group" aria-label="Distribute and grid" className="flex items-center gap-1">
            <button
              type="button"
              aria-disabled={!canDistribute ? 'true' : undefined}
              onClick={() => applyDistribution('horizontal')}
              aria-label="Distribute horizontally"
              title={
                canDistribute
                  ? 'Distribute Horizontally'
                  : 'Select 3 or more entities to distribute horizontally'
              }
              className={toolBtnClass}
            >
              <ArrowLeftRight size={14} />
            </button>
            <button
              type="button"
              aria-disabled={!canDistribute ? 'true' : undefined}
              onClick={() => applyDistribution('vertical')}
              aria-label="Distribute vertically"
              title={
                canDistribute
                  ? 'Distribute Vertically'
                  : 'Select 3 or more entities to distribute vertically'
              }
              className={toolBtnClass}
            >
              <ArrowUpDown size={14} />
            </button>
            <button
              type="button"
              onClick={applyTidyGrid}
              aria-label="Arrange in tidy grid"
              title="Arrange Selected Cards in Tidy Grid"
              className={toolBtnClass}
            >
              <LayoutGrid size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Batch Card Sizing (Match Width / Match Size / Reset Auto) */}
      {(() => {
        const entitySelection = selectedNodes.filter(
          (n) => n.type !== 'groupRegion' && !n.data?.isGroup
        )
        if (entitySelection.length === 0) return null
        const editableUnlockedEntities = entitySelection.filter(
          (n) =>
            !isNodeEffectivelyLocked(n, nodes) &&
            (!isPlayerEdition || Boolean(n.data?.isPlayerCreated))
        )
        const canMatch = entitySelection.length >= 2 && editableUnlockedEntities.length > 0
        const canResetAuto = editableUnlockedEntities.some(
          (n) => n.data?.entityWidth !== undefined || n.data?.entityHeight !== undefined
        )

        return (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Maximize2 size={12} aria-hidden="true" /> Card Sizing
            </span>
            <div role="group" aria-label="Batch entity card sizing" className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                disabled={!canMatch}
                onClick={() => matchSelectedEntitySizes(selectedIds, 'width')}
                title="Match widths of selected entities to the widest card"
                className="px-2 py-1.5 rounded-md bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ArrowLeftRight size={12} aria-hidden="true" />
                <span>Match W</span>
              </button>
              <button
                type="button"
                disabled={!canMatch}
                onClick={() => matchSelectedEntitySizes(selectedIds, 'size')}
                title="Match both width and height across selected entities"
                className="px-2 py-1.5 rounded-md bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Maximize2 size={12} aria-hidden="true" />
                <span>Match W×H</span>
              </button>
              <button
                type="button"
                disabled={!canResetAuto}
                onClick={() => resetEntitySize(selectedIds)}
                title="Reset selected entities back to automatic content size"
                className="px-2 py-1.5 rounded-md bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <RotateCcw size={12} aria-hidden="true" />
                <span>Auto Size</span>
              </button>
            </div>
          </div>
        )
      })()}

      {/* Batch Spoiler Visibility (DM Mode Only) */}
      {!isPlayerEdition && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Player Visibility ({revealedCount} Visible · {hiddenCount} Hidden)
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() =>
                batchUpdateNodes(selectedIds, (n) => ({
                  ...n,
                  data: { ...n.data, isHidden: false }
                }))
              }
              className="px-2.5 py-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-700/70 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Eye size={13} /> Reveal All
            </button>
            <button
              type="button"
              onClick={() =>
                batchUpdateNodes(selectedIds, (n) => ({
                  ...n,
                  data: { ...n.data, isHidden: true }
                }))
              }
              className="px-2.5 py-1.5 rounded-md bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-300 dark:border-amber-700/70 text-amber-800 dark:text-amber-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <EyeOff size={13} /> Hide All
            </button>
          </div>
        </div>
      )}

      {/* Batch Category, Standing, Shape & Scale */}
      <div className="flex flex-col gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-700">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Entity Category
            </label>
            <select
              defaultValue=""
              onChange={(e) => {
                if (!e.target.value) return
                const nextCat = e.target.value
                batchUpdateNodes(selectedIds, (n) =>
                  n.type === 'groupRegion' || n.data?.isGroup
                    ? n
                    : { ...n, data: { ...n.data, entityType: nextCat } }
                )
                e.target.value = ''
              }}
              className="border border-slate-300 dark:border-slate-700 rounded-md p-1.5 text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="" disabled>
                Choose category...
              </option>
              {allCategoryOptions.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Party Standing
            </label>
            <select
              defaultValue=""
              onChange={(e) => {
                const rawVal = e.target.value
                if (!rawVal) return
                const nextStanding = (rawVal === '__clear__' ? '' : rawVal) as PartyDisposition | ''
                batchUpdateNodes(selectedIds, (n) => ({
                  ...n,
                  data: {
                    ...n.data,
                    dndFields: { ...(n.data.dndFields || {}), disposition: nextStanding }
                  }
                }))
                e.target.value = ''
              }}
              className="border border-slate-300 dark:border-slate-700 rounded-md p-1.5 text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="" disabled>
                Set standing...
              </option>
              <option value="Allied">★ Allied</option>
              <option value="Friendly">☺ Friendly</option>
              <option value="Neutral">• Neutral</option>
              <option value="Suspicious">? Suspicious</option>
              <option value="Hostile">⚔ Hostile</option>
              <option value="Unknown">◌ Unknown</option>
              <option value="Deceased">☠ Deceased / Fallen</option>
              <option value="__clear__">— Clear Standing —</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Card Shape
            </label>
            <select
              defaultValue=""
              onChange={(e) => {
                if (!e.target.value) return
                const nextShape = e.target.value as any
                batchUpdateNodes(selectedIds, (n) => ({
                  ...n,
                  data: { ...n.data, shape: nextShape }
                }))
                e.target.value = ''
              }}
              className="border border-slate-300 dark:border-slate-700 rounded-md p-1.5 text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="" disabled>
                Keep mixed...
              </option>
              <option value="default">Rounded Card</option>
              <option value="box">Sharp Box</option>
              <option value="pill">Pill</option>
              <option value="leaf">Leaf</option>
              <option value="arch">Archway</option>
              <option value="oval">Oval</option>
              <option value="sticky">Sticky Note</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Card Scale
            </label>
            <select
              defaultValue=""
              onChange={(e) => {
                if (!e.target.value) return
                const nextScale = Number(e.target.value)
                batchUpdateNodes(selectedIds, (n) => ({
                  ...n,
                  data: { ...n.data, baseScale: nextScale }
                }))
                e.target.value = ''
              }}
              className="border border-slate-300 dark:border-slate-700 rounded-md p-1.5 text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="" disabled>
                Keep mixed...
              </option>
              <option value="0.85">Compact (0.85×)</option>
              <option value="1">Standard (1.0×)</option>
              <option value="1.15">Featured (1.15×)</option>
              <option value="1.3">Hub / Boss (1.3×)</option>
            </select>
          </div>
        </div>

        {/* Batch Background Color (Entities & Groups) */}
        <div className="flex flex-col gap-1.5 pt-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <PaintBucket size={12} className="text-blue-500" aria-hidden="true" />
              Background Color
            </span>
            {selectedNodes.some((n) =>
              Boolean(normalizeHexColor(n.data?.bgColor) || normalizeHexColor(n.data?.groupCustomColor))
            ) && (
              <button
                type="button"
                onClick={() =>
                  batchUpdateNodes(selectedIds, (n) =>
                    n.type === 'groupRegion' || n.data?.isGroup
                      ? { ...n, data: { ...n.data, groupCustomColor: undefined } }
                      : { ...n, data: { ...n.data, bgColor: undefined } }
                  )
                }
                className="text-[11px] font-semibold text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 inline-flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw size={11} aria-hidden="true" />
                <span>Reset Default</span>
              </button>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
            <div
              className="flex flex-wrap items-center gap-1.5"
              role="group"
              aria-label="Batch preset background colors"
            >
              {ENTITY_BG_SWATCHES.map((swatch) => (
                <button
                  key={swatch.key}
                  type="button"
                  title={`Apply ${swatch.label} (${swatch.hex.toUpperCase()})`}
                  aria-label={`Apply ${swatch.label} background to selected`}
                  onClick={() =>
                    batchUpdateNodes(selectedIds, (n) =>
                      n.type === 'groupRegion' || n.data?.isGroup
                        ? {
                            ...n,
                            data: {
                              ...n.data,
                              groupCustomColor: swatch.hex,
                              hasBackground: true
                            }
                          }
                        : { ...n, data: { ...n.data, bgColor: swatch.hex } }
                    )
                  }
                  style={{ backgroundColor: swatch.hex }}
                  className="dcc-color-swatch w-5 h-5 rounded-full border border-slate-400/80 dark:border-slate-500 hover:scale-110 transition-transform cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500 outline-none"
                />
              ))}
            </div>
            <input
              type="color"
              aria-label="Apply custom background color to selected items"
              title="Pick custom background color for all selected items"
              defaultValue="#fef3c7"
              onPointerDown={() => pushHistory(true)}
              onChange={(e) => {
                const nextHex = e.target.value
                const idSet = new Set(selectedIds)
                setNodes(
                  useStore.getState().nodes.map((n) => {
                    if (!idSet.has(n.id)) return n
                    return n.type === 'groupRegion' || n.data?.isGroup
                      ? {
                          ...n,
                          data: {
                            ...n.data,
                            groupCustomColor: nextHex,
                            hasBackground: true
                          }
                        }
                      : { ...n, data: { ...n.data, bgColor: nextHex } }
                  })
                )
              }}
              className="dcc-color-swatch w-7 h-7 shrink-0 rounded border border-slate-300 dark:border-slate-600 cursor-pointer bg-transparent p-0.5"
            />
          </div>
        </div>

        {/* Batch Status Markers (Entities & Groups) */}
        <div className="flex flex-col gap-1.5 pt-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Batch Status Markers
            </span>
            {selectedNodes.some((n) => (n.data?.statusIcons || []).length > 0) && (
              <button
                type="button"
                onClick={() =>
                  batchUpdateNodes(selectedIds, (n) => ({
                    ...n,
                    data: { ...n.data, statusIcons: [] }
                  }))
                }
                className="text-[11px] font-semibold text-slate-500 hover:text-red-500 dark:text-slate-400 cursor-pointer"
              >
                Clear All
              </button>
            )}
          </div>
          <div
            className="flex flex-wrap gap-1 max-h-28 overflow-y-auto p-1.5 border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900"
            role="group"
            aria-label="Batch status markers"
          >
            {Object.keys(availableIcons).map((name) => {
              const IconComponent = availableIcons[name]
              const allHave = selectedNodes.every((n) =>
                (n.data?.statusIcons || []).includes(name)
              )
              const someHave =
                !allHave &&
                selectedNodes.some((n) => (n.data?.statusIcons || []).includes(name))
              return (
                <button
                  key={name}
                  type="button"
                  aria-label={`Toggle ${name} marker on selected`}
                  aria-pressed={allHave}
                  title={allHave ? `Remove ${name} from all` : `Add ${name} to all`}
                  onClick={() =>
                    batchUpdateNodes(selectedIds, (n) => {
                      const cur = n.data?.statusIcons || []
                      const next = allHave
                        ? cur.filter((x) => x !== name)
                        : cur.includes(name)
                          ? cur
                          : [...cur, name]
                      return { ...n, data: { ...n.data, statusIcons: next } }
                    })
                  }
                  className={`p-1.5 rounded border transition-colors cursor-pointer ${
                    allHave
                      ? 'bg-blue-100 dark:bg-blue-900/50 border-blue-400 dark:border-blue-500'
                      : someHave
                        ? 'bg-amber-50 dark:bg-amber-950/35 border-amber-300 dark:border-amber-700'
                        : 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <IconComponent size={13} aria-hidden="true" className={getIconColor(name)} />
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Batch #Tags */}
      {!isPlayerEdition && (
        <div className="flex flex-col gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Tag size={12} className="text-blue-500" aria-hidden="true" /> Batch Campaign #Tags
          </label>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddBatchTag()
                }
              }}
              placeholder="Add #tag to all..."
              className="flex-1 border border-slate-300 dark:border-slate-700 rounded-md px-2 py-1 text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={handleAddBatchTag}
              className="px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
            >
              Add
            </button>
          </div>
          {tagCounts.size > 0 && (
            <div className="flex flex-wrap gap-1">
              {Array.from(tagCounts.entries()).map(([tag, count]) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-medium"
                >
                  <span>
                    #{tag} ({count})
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove #${tag} from selected entities`}
                    onClick={() => handleRemoveSharedTag(tag)}
                    className="text-slate-400 hover:text-red-500 cursor-pointer"
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Selected Entities Roster */}
      <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-200 dark:border-slate-700">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Selected Roster
        </span>
        <div className="flex flex-col gap-1 max-h-44 overflow-y-auto pr-1">
          {selectedNodes.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => onNavigateToNode(n.id)}
              className="px-2.5 py-1.5 rounded-md bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-700/60 border border-slate-200 dark:border-slate-700 text-left text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer"
            >
              <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                {n.data.label}
              </span>
              <span className="text-[10px] text-slate-400 shrink-0">{n.data.entityType}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Batch Duplicate & Batch Delete */}
      <div className="flex flex-col gap-2 pt-2 border-t border-slate-200 dark:border-slate-700 mt-auto">
        <button
          type="button"
          onClick={() => duplicateSelection()}
          className="w-full py-1.5 rounded-md bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <Files size={13} /> Duplicate {selectedNodes.length} Selected
        </button>
        <button
          type="button"
          onClick={() => setConfirmDeleteOpen(true)}
          className="w-full py-1.5 rounded-md bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-800/60 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <Trash2 size={13} /> Delete {selectedNodes.length} Selected
        </button>
      </div>

      <ConfirmModal
        open={confirmDeleteOpen}
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={() => batchDeleteNodes(selectedIds)}
        title={`Delete ${selectedNodes.length} Entities?`}
        message={`Remove all ${selectedNodes.length} selected entities and their connected lines? You can Undo with Ctrl+Z.`}
        confirmLabel={`Delete ${selectedNodes.length} Entities`}
        destructive
      />
    </aside>
  )
}
