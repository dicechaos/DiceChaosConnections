import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import { CampaignSnapshot } from '../types'
import { NativeModal, ConfirmModal } from './NativeModal'
import {
  History,
  Plus,
  GitCompareArrows,
  RotateCcw,
  Trash2,
  ChevronDown,
  ChevronUp,
  Radio,
  Pencil
} from 'lucide-react'

interface TimelineBarProps {
  diffStats?: { added: number; modified: number; removed: number } | null
  expanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
  hideInlineDrawer?: boolean
  createRequestTick?: number
}

export function SessionTimelineTray({
  open,
  onClose,
  onRequestCreateSnapshot
}: {
  open: boolean
  onClose: () => void
  onRequestCreateSnapshot?: () => void
}) {
  const {
    campaignEdition,
    snapshots,
    activeSnapshotId,
    isPlayerView,
    setActiveSnapshot
  } = useStore()

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const isPlayerRestricted = isPlayerView || campaignEdition === 'player'
  const visibleSnapshots = isPlayerRestricted
    ? snapshots.filter((s) => s.playerVisible !== false)
    : snapshots

  return (
    <section
      aria-label="Session Timeline Checkpoints"
      className="no-export shrink-0 dcc-surface-panel border-t px-3.5 py-2 flex flex-col gap-2 z-20"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          <History size={13} className="text-sky-500" aria-hidden="true" />
          <span>Session Timeline</span>
          <span className="px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
            {visibleSnapshots.length}
          </span>
        </span>
        <div className="flex items-center gap-2">
          {!isPlayerRestricted && activeSnapshotId === null && onRequestCreateSnapshot && (
            <button
              type="button"
              onClick={onRequestCreateSnapshot}
              className="px-2.5 py-1 rounded-md bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Plus size={12} aria-hidden="true" />
              <span>Save Session Snapshot</span>
            </button>
          )}
          <button
            type="button"
            aria-label="Collapse timeline"
            title="Collapse Session Timeline (Esc)"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <ChevronDown size={15} />
          </button>
        </div>
      </div>

      <div className="dcc-scroll-fade-x flex items-center gap-2 pb-0.5 min-w-0">
        {visibleSnapshots.map((snap) => {
          const isActive = snap.id === activeSnapshotId
          return (
            <button
              key={snap.id}
              type="button"
              onClick={() => setActiveSnapshot(isActive ? null : snap.id)}
              title={snap.summary ? `${snap.title} — ${snap.summary}` : snap.title}
              className={`px-3 py-1.5 rounded-lg border text-left shrink-0 [scroll-snap-align:start] transition-colors cursor-pointer ${
                isActive
                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-md'
                  : 'bg-slate-100/90 dark:bg-[#172342] hover:bg-slate-200/80 dark:hover:bg-[#1f2e54] text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700/70'
              }`}
            >
              <div className="text-[10px] opacity-80 font-semibold">
                {snap.sessionNumber ? `Session ${snap.sessionNumber}` : 'Checkpoint'}
              </div>
              <div className="text-xs font-semibold truncate max-w-[180px]">{snap.title}</div>
            </button>
          )
        })}

        <button
          type="button"
          onClick={() => setActiveSnapshot(null)}
          className={`px-3.5 py-1.5 rounded-lg border shrink-0 [scroll-snap-align:start] flex items-center gap-1.5 transition-colors cursor-pointer ${
            activeSnapshotId === null
              ? 'bg-emerald-600 text-white border-emerald-500 font-bold shadow-md'
              : 'bg-slate-100/90 dark:bg-[#172342] hover:bg-slate-200/80 dark:hover:bg-[#1f2e54] text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700/70'
          }`}
        >
          <Radio size={13} aria-hidden="true" />
          <div className="text-left">
            <div className="text-[10px] opacity-85 font-semibold">Current</div>
            <div className="text-xs font-semibold">Live Map</div>
          </div>
        </button>
      </div>
    </section>
  )
}

export default function TimelineBar({
  diffStats,
  expanded: controlledExpanded,
  onExpandedChange,
  hideInlineDrawer = false,
  createRequestTick
}: TimelineBarProps) {
  const {
    campaignEdition,
    snapshots,
    activeSnapshotId,
    showSnapshotDiff,
    diffTargetSnapshotId,
    setDiffTargetSnapshotId,
    isPlayerView,
    createSnapshot,
    updateSnapshotMeta,
    deleteSnapshot,
    setActiveSnapshot,
    toggleSnapshotDiff,
    restoreSnapshotToLive
  } = useStore()

  const isPlayerRestricted = isPlayerView || campaignEdition === 'player'

  const [internalExpanded, setInternalExpanded] = useState(false)
  const expanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded
  const setExpanded = (next: boolean | ((prev: boolean) => boolean)) => {
    const resolved = typeof next === 'function' ? next(expanded) : next
    if (onExpandedChange) {
      onExpandedChange(resolved)
    } else {
      setInternalExpanded(resolved)
    }
  }
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingSnapshotId, setEditingSnapshotId] = useState<string | null>(null)

  const [sessionTitle, setSessionTitle] = useState('')
  const [sessionNum, setSessionNum] = useState<string>('')
  const [sessionSummary, setSessionSummary] = useState('')
  const [playerVisible, setPlayerVisible] = useState(true)

  const [pendingRestoreId, setPendingRestoreId] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const lastCreateTickRef = useRef<number | undefined>(createRequestTick)

  useEffect(() => {
    if (createRequestTick !== undefined && createRequestTick !== lastCreateTickRef.current) {
      lastCreateTickRef.current = createRequestTick
      if (createRequestTick > 0) {
        const maxSession = snapshots.reduce(
          (max, s) => (s.sessionNumber && s.sessionNumber > max ? s.sessionNumber : max),
          0
        )
        setSessionNum(String(maxSession + 1))
        setSessionTitle('')
        setSessionSummary('')
        setPlayerVisible(true)
        setEditingSnapshotId(null)
        setShowCreateModal(true)
      }
    }
  }, [createRequestTick, snapshots])

  useEffect(() => {
    if (
      hideInlineDrawer ||
      !expanded ||
      showCreateModal ||
      pendingRestoreId !== null ||
      pendingDeleteId !== null
    ) {
      return
    }
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpanded(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setExpanded(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [hideInlineDrawer, expanded, showCreateModal, pendingRestoreId, pendingDeleteId])

  const visibleSnapshots = isPlayerRestricted
    ? snapshots.filter((s) => s.playerVisible !== false)
    : snapshots

  const activeSnapshot = snapshots.find((s) => s.id === activeSnapshotId) || null

  const openCreateSnapshot = () => {
    const maxSession = snapshots.reduce(
      (max, s) => (s.sessionNumber && s.sessionNumber > max ? s.sessionNumber : max),
      0
    )
    setSessionNum(String(maxSession + 1))
    setSessionTitle('')
    setSessionSummary('')
    setPlayerVisible(true)
    setEditingSnapshotId(null)
    setShowCreateModal(true)
  }

  const openEditSnapshot = (snap: CampaignSnapshot) => {
    setSessionNum(snap.sessionNumber !== undefined ? String(snap.sessionNumber) : '')
    setSessionTitle(snap.title)
    setSessionSummary(snap.summary || '')
    setPlayerVisible(snap.playerVisible !== false)
    setEditingSnapshotId(snap.id)
    setShowCreateModal(true)
  }

  const handleSaveSnapshot = (e: React.FormEvent) => {
    e.preventDefault()
    const parsedNum = sessionNum.trim() ? parseInt(sessionNum.trim(), 10) : undefined
    const cleanNum = parsedNum !== undefined && !Number.isNaN(parsedNum) ? parsedNum : undefined

    if (editingSnapshotId) {
      updateSnapshotMeta(editingSnapshotId, {
        title: sessionTitle.trim() || (cleanNum ? `Session ${cleanNum}` : 'Campaign Checkpoint'),
        sessionNumber: cleanNum,
        summary: sessionSummary,
        playerVisible
      })
      setEditingSnapshotId(null)
      setShowCreateModal(false)
      return
    }

    createSnapshot({
      title: sessionTitle.trim() || (cleanNum ? `Session ${cleanNum}` : 'Campaign Checkpoint'),
      sessionNumber: cleanNum,
      summary: sessionSummary,
      playerVisible
    })
    setShowCreateModal(false)
    setExpanded(true)
  }

  const otherComparableSnapshots = activeSnapshot
    ? visibleSnapshots.filter((s) => s.id !== activeSnapshot.id)
    : []

  return (
    <>
      {/* Top Time-Machine Banner when viewing a historical snapshot */}
      {activeSnapshot && (
        <div className="no-export fixed top-[52px] left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1.5 max-w-3xl w-[92%] pointer-events-auto">
          <div className="w-full rounded-xl border border-amber-400/70 bg-amber-950/95 text-amber-50 shadow-2xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 backdrop-blur">
            <div className="flex items-center gap-2.5 min-w-0">
              <History size={18} className="text-amber-400 shrink-0" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                    Time Machine (Read-Only)
                  </span>
                  <span className="text-sm font-bold truncate">
                    {activeSnapshot.sessionNumber
                      ? `Session ${activeSnapshot.sessionNumber}: ${activeSnapshot.title}`
                      : activeSnapshot.title}
                  </span>
                </div>
                {activeSnapshot.summary && (
                  <p className="text-xs text-amber-200/85 truncate">{activeSnapshot.summary}</p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={toggleSnapshotDiff}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 border transition-colors cursor-pointer ${
                  showSnapshotDiff
                    ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                    : 'bg-amber-900/60 hover:bg-amber-800/80 text-amber-100 border-amber-600/60'
                }`}
                title="Highlight how another session or the Live Map changed relative to this checkpoint"
              >
                <GitCompareArrows size={13} />
                <span>{showSnapshotDiff ? 'Comparing vs.' : 'Compare Changes'}</span>
              </button>

              {showSnapshotDiff && (
                <select
                  aria-label="Compare checkpoint against"
                  value={diffTargetSnapshotId}
                  onChange={(e) => setDiffTargetSnapshotId(e.target.value)}
                  className="rounded-md bg-slate-900 text-amber-100 border border-amber-500/70 px-2 py-1 text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer max-w-44"
                >
                  <option value="live">Current Live Map</option>
                  {otherComparableSnapshots.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.sessionNumber ? `Session ${s.sessionNumber}: ${s.title}` : s.title}
                    </option>
                  ))}
                </select>
              )}

              {!isPlayerRestricted && (
                <>
                  <button
                    type="button"
                    onClick={() => openEditSnapshot(activeSnapshot)}
                    className="px-2 py-1 rounded-md text-xs font-semibold bg-amber-800/70 hover:bg-amber-700 text-amber-100 border border-amber-600/50 flex items-center gap-1 transition-colors cursor-pointer"
                    title="Edit checkpoint title, session #, summary, or player visibility"
                  >
                    <Pencil size={12} /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingRestoreId(activeSnapshot.id)}
                    className="px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-800/70 hover:bg-amber-700 text-amber-100 border border-amber-600/50 flex items-center gap-1 transition-colors cursor-pointer"
                    title="Overwrite Live Map with this snapshot (Undoable)"
                  >
                    <RotateCcw size={12} /> Restore
                  </button>
                  <button
                    type="button"
                    aria-label="Delete snapshot"
                    onClick={() => setPendingDeleteId(activeSnapshot.id)}
                    className="p-1.5 rounded-md bg-red-900/60 hover:bg-red-800 text-red-200 border border-red-700/50 transition-colors cursor-pointer"
                    title="Delete this snapshot"
                  >
                    <Trash2 size={13} />
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => setActiveSnapshot(null)}
                className="px-3 py-1 rounded-md text-xs font-bold bg-white text-slate-900 hover:bg-amber-100 transition-colors cursor-pointer"
              >
                Return to Live
              </button>
            </div>
          </div>

          {showSnapshotDiff && diffStats && (
            <div className="px-3 py-1 rounded-full bg-slate-900/90 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-3 shadow-lg">
              <span className="text-emerald-400">+ {diffStats.added} Added</span>
              <span className="text-amber-400">~ {diffStats.modified} Changed</span>
              <span className="text-rose-400">- {diffStats.removed} Removed</span>
              <span className="text-[11px] text-slate-400">
                (Click any ~ Changed item to inspect field diffs)
              </span>
            </div>
          )}
        </div>
      )}

      {/* Bottom-Bar Timeline Trigger & Upward Session Checkpoint Drawer (Left-Docked) */}
      {(visibleSnapshots.length > 0 || !isPlayerRestricted || Boolean(activeSnapshot)) && (
        <div
          ref={containerRef}
          className="no-export relative shrink-0 flex items-center pointer-events-auto"
        >
          <div className="flex items-center gap-1.5 rounded-md border border-slate-200/90 dark:border-slate-700/70 bg-slate-50/90 dark:bg-[#172342]/80 px-2.5 py-0.5 min-h-6">
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-sky-600 dark:hover:text-sky-400 cursor-pointer"
            >
              <History size={13} className="text-sky-500 shrink-0" aria-hidden="true" />
              <span className="whitespace-nowrap">
                Campaign Timeline ({visibleSnapshots.length}{' '}
                {visibleSnapshots.length === 1 ? 'Session' : 'Sessions'})
              </span>
              {expanded ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
            </button>
            {!isPlayerRestricted && activeSnapshotId === null && (
              <>
                <span className="w-px h-3.5 bg-slate-300 dark:bg-slate-600 mx-0.5" />
                <button
                  type="button"
                  onClick={openCreateSnapshot}
                  className="flex items-center gap-1 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline whitespace-nowrap cursor-pointer"
                >
                  <Plus size={12} /> Snapshot
                </button>
              </>
            )}
          </div>

          {!hideInlineDrawer && expanded && (
            <div className="absolute bottom-full left-0 mb-2 z-30 bg-white/95 dark:bg-slate-800/95 backdrop-blur border border-slate-200 dark:border-slate-700 shadow-2xl rounded-xl px-3.5 py-2.5 flex flex-col gap-2 w-max max-w-[min(88dvw,760px)]">
              <div className="flex items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-700 pb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <History size={13} className="text-blue-500" /> Session Timeline
                </span>
                <div className="flex items-center gap-2">
                  {!isPlayerRestricted && activeSnapshotId === null && (
                    <button
                      type="button"
                      onClick={openCreateSnapshot}
                      className="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Plus size={12} /> Save Session Snapshot
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label="Collapse timeline"
                    onClick={() => setExpanded(false)}
                    className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <ChevronDown size={15} />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {visibleSnapshots.map((snap) => {
                  const isActive = snap.id === activeSnapshotId
                  return (
                    <button
                      key={snap.id}
                      type="button"
                      onClick={() => setActiveSnapshot(isActive ? null : snap.id)}
                      className={`px-2.5 py-1.5 rounded-lg border text-left shrink-0 transition-all cursor-pointer ${
                        isActive
                          ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-md'
                          : 'bg-slate-100 dark:bg-slate-700/70 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600'
                      }`}
                    >
                      <div className="text-[10px] opacity-75 font-semibold">
                        {snap.sessionNumber ? `Session ${snap.sessionNumber}` : 'Checkpoint'}
                      </div>
                      <div className="text-xs truncate max-w-[140px]">{snap.title}</div>
                    </button>
                  )
                })}

                <button
                  type="button"
                  onClick={() => setActiveSnapshot(null)}
                  className={`px-3 py-1.5 rounded-lg border shrink-0 flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeSnapshotId === null
                      ? 'bg-emerald-600 text-white border-emerald-500 font-bold shadow-md'
                      : 'bg-slate-100 dark:bg-slate-700/70 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600'
                  }`}
                >
                  <Radio size={13} />
                  <div className="text-left">
                    <div className="text-[10px] opacity-80 font-semibold">Current</div>
                    <div className="text-xs">Live Map</div>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Save or Edit Session Snapshot Modal */}
      <NativeModal
        open={showCreateModal}
        onClose={() => {
          setShowCreateModal(false)
          setEditingSnapshotId(null)
        }}
        title={editingSnapshotId ? 'Edit Session Checkpoint' : 'Save Session Snapshot'}
      >
        <form onSubmit={handleSaveSnapshot} className="flex flex-col gap-3.5">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {editingSnapshotId
              ? 'Update this checkpoint’s session number, title, summary, or player visibility.'
              : 'Capture the current campaign web so you and your players can scrub back later or compare how relationships evolved.'}
          </p>
          <div className="flex gap-3">
            <div className="w-24 flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Session #
              </label>
              <input
                type="number"
                min="0"
                value={sessionNum}
                onChange={(e) => setSessionNum(e.target.value)}
                className="border border-slate-300 dark:border-slate-600 rounded-md px-2.5 py-1.5 text-sm bg-white dark:bg-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Checkpoint Title
              </label>
              <input
                type="text"
                autoFocus
                placeholder="e.g. Fall of Smaug over Lake-town"
                value={sessionTitle}
                onChange={(e) => setSessionTitle(e.target.value)}
                className="border border-slate-300 dark:border-slate-600 rounded-md px-2.5 py-1.5 text-sm bg-white dark:bg-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Recap / Summary (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Key faction shifts or discoveries from this session..."
              value={sessionSummary}
              onChange={(e) => setSessionSummary(e.target.value)}
              className="border border-slate-300 dark:border-slate-600 rounded-md p-2 text-sm bg-white dark:bg-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={playerVisible}
              onChange={(e) => setPlayerVisible(e.target.checked)}
              className="rounded accent-blue-600"
            />
            Allow browsing this checkpoint in Player View (DM-hidden items stay hidden)
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setShowCreateModal(false)
                setEditingSnapshotId(null)
              }}
              className="px-3.5 py-1.5 rounded-md text-sm font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-md text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white"
            >
              {editingSnapshotId ? 'Save Changes' : 'Save Snapshot'}
            </button>
          </div>
        </form>
      </NativeModal>

      {/* Restore Confirmation */}
      <ConfirmModal
        open={pendingRestoreId !== null}
        title="Restore Snapshot to Live Map?"
        message="This will replace your current Live Map nodes and connections with this historical snapshot. You can still press Ctrl+Z right afterward to undo."
        confirmLabel="Restore Snapshot"
        destructive={false}
        onConfirm={() => {
          if (pendingRestoreId) restoreSnapshotToLive(pendingRestoreId)
        }}
        onCancel={() => setPendingRestoreId(null)}
      />

      {/* Delete Snapshot Confirmation */}
      <ConfirmModal
        open={pendingDeleteId !== null}
        title="Delete Session Snapshot?"
        message="This checkpoint will be permanently removed from the campaign timeline."
        confirmLabel="Delete Snapshot"
        destructive={true}
        onConfirm={() => {
          if (pendingDeleteId) deleteSnapshot(pendingDeleteId)
        }}
        onCancel={() => setPendingDeleteId(null)}
      />
    </>
  )
}
