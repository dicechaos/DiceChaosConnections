import { useEffect, useRef, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useStore } from '../store/useStore'
import { CameraBookmark } from '../types'
import {
  Bookmark,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Crosshair,
  Tv,
  Check,
  X
} from 'lucide-react'

interface BookmarksBarProps {
  readOnly?: boolean
  onSyncBookmarkToPlayerScreen?: (bookmark: CameraBookmark) => void
  isPlayerScreenOpen?: boolean
}

export default function BookmarksBar({
  readOnly = false,
  onSyncBookmarkToPlayerScreen,
  isPlayerScreenOpen = false
}: BookmarksBarProps) {
  const { setCenter, getZoom, screenToFlowPosition } = useReactFlow()
  const {
    campaignEdition,
    isPlayerView,
    activeSnapshotId,
    cameraBookmarks,
    addCameraBookmark,
    updateCameraBookmark,
    deleteCameraBookmark
  } = useStore()

  const hideSecrets = readOnly || isPlayerView || campaignEdition === 'player'
  const canEdit = !readOnly && !isPlayerView && campaignEdition !== 'player' && activeSnapshotId === null

  const visibleBookmarks = cameraBookmarks.filter(
    (b) => !hideSecrets || b.playerVisible !== false
  )

  const [isAdding, setIsAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newPlayerVisible, setNewPlayerVisible] = useState(true)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isAdding && editingId === null) return
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsAdding(false)
        setEditingId(null)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [isAdding, editingId])

  const flyToBookmark = (bookmark: CameraBookmark) => {
    setCenter(bookmark.centerX, bookmark.centerY, {
      zoom: bookmark.zoom,
      duration: 480
    })
  }

  // Keyboard shortcuts: Alt+1 through Alt+9 jump directly to bookmarks 1..9
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return
      }
      const digit = Number(e.key)
      if (Number.isInteger(digit) && digit >= 1 && digit <= 9) {
        const bm = visibleBookmarks[digit - 1]
        if (bm) {
          e.preventDefault()
          flyToBookmark(bm)
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [visibleBookmarks])

  const captureCurrentViewport = () => {
    const wrapper = document.getElementById('map-export-wrapper')
    const rect = wrapper?.getBoundingClientRect()
    const cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
    const cy = rect ? rect.top + rect.height / 2 : window.innerHeight / 2
    const flowCenter = screenToFlowPosition({ x: cx, y: cy })
    return {
      centerX: flowCenter.x,
      centerY: flowCenter.y,
      zoom: getZoom()
    }
  }

  const handleSaveNew = () => {
    const clean = newLabel.trim() || `Region ${cameraBookmarks.length + 1}`
    const vp = captureCurrentViewport()
    addCameraBookmark({
      label: clean,
      centerX: vp.centerX,
      centerY: vp.centerY,
      zoom: vp.zoom,
      playerVisible: newPlayerVisible
    })
    setNewLabel('')
    setIsAdding(false)
  }

  if (visibleBookmarks.length === 0 && !canEdit) {
    return null
  }

  const editingBookmark = editingId
    ? cameraBookmarks.find((b) => b.id === editingId) || null
    : null

  return (
    <div
      ref={containerRef}
      className="no-export relative ms-auto flex items-center justify-end gap-1.5 min-w-0 pointer-events-auto"
    >
      <span
        className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1 shrink-0 select-none"
        title="Saved Camera Views (Alt+1..9)"
      >
        <Bookmark size={12} className="text-amber-500 shrink-0" aria-hidden="true" />
        <span>Views</span>
      </span>

      <div className="dcc-scroll-fade-x flex items-center gap-1 min-w-0 [scroll-snap-type:inline_proximity]">
        {visibleBookmarks.map((bm, idx) => {
          const isSelectedForEdit = editingId === bm.id
          return (
            <div
              key={bm.id}
              className={`shrink-0 [scroll-snap-align:start] inline-flex items-center rounded-md border text-xs transition-colors ${
                isSelectedForEdit
                  ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-200'
                  : 'border-slate-200/90 dark:border-slate-700/70 bg-slate-50/90 dark:bg-[#172342]/80 hover:bg-slate-100 dark:hover:bg-[#1f2e54] text-slate-700 dark:text-slate-200'
              }`}
            >
              <button
                type="button"
                onClick={() => flyToBookmark(bm)}
                title={`Jump to "${bm.label}"${idx < 9 ? ` (Alt+${idx + 1})` : ''}`}
                className="px-2 py-0.5 min-h-6 font-semibold flex items-center gap-1.5 cursor-pointer truncate max-w-44"
              >
                {idx < 9 && (
                  <span className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500">
                    {idx + 1}
                  </span>
                )}
                <span className="truncate">{bm.label}</span>
                {canEdit && bm.playerVisible === false && (
                  <EyeOff
                    size={10}
                    className="text-amber-600 dark:text-amber-400 shrink-0"
                    aria-label="Hidden from players"
                  />
                )}
              </button>

              {canEdit && (
                <button
                  type="button"
                  aria-label={`Manage bookmark ${bm.label}`}
                  aria-expanded={isSelectedForEdit}
                  title="Edit or sync bookmark"
                  onClick={() => {
                    if (editingId === bm.id) {
                      setEditingId(null)
                    } else {
                      setEditingId(bm.id)
                      setEditLabel(bm.label)
                      setIsAdding(false)
                    }
                  }}
                  className="px-1.5 py-0.5 min-h-6 border-l border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 flex items-center cursor-pointer"
                >
                  <Pencil size={10} />
                </button>
              )}
            </div>
          )
        })}
      </div>

      {canEdit && (
        <button
          type="button"
          aria-expanded={isAdding}
          onClick={() => {
            if (isAdding) {
              setIsAdding(false)
            } else {
              setIsAdding(true)
              setEditingId(null)
              setNewLabel('')
              setNewPlayerVisible(true)
            }
          }}
          title="Save current camera position & zoom as a named bookmark"
          className={`shrink-0 px-2 py-0.5 min-h-6 rounded-md border text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
            isAdding
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-200'
              : 'border-dashed border-slate-300 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-500 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-300'
          }`}
        >
          <Plus size={12} aria-hidden="true" /> Save View
        </button>
      )}

      {/* Upward Add View Popover Card */}
      {canEdit && isAdding && (
        <div className="absolute bottom-full right-0 mb-2 z-30 dcc-surface-panel shadow-2xl rounded-xl p-2.5 border flex flex-wrap items-center gap-2 text-xs w-max max-w-[calc(100dvw-2rem)]">
          <input
            type="text"
            autoFocus
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveNew()
              if (e.key === 'Escape') setIsAdding(false)
            }}
            placeholder={`e.g. Region ${cameraBookmarks.length + 1}...`}
            className="dcc-surface-input border rounded-md px-2 py-1 text-xs w-44"
          />
          <label className="inline-flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={newPlayerVisible}
              onChange={(e) => setNewPlayerVisible(e.target.checked)}
              className="rounded text-blue-600"
            />
            Player Visible
          </label>
          <button
            type="button"
            onClick={handleSaveNew}
            className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-1 cursor-pointer"
          >
            <Check size={12} /> Save
          </button>
          <button
            type="button"
            onClick={() => setIsAdding(false)}
            aria-label="Cancel new bookmark"
            className="p-1 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Upward Manage Bookmark Popover Card */}
      {canEdit && editingBookmark && (
        <div className="absolute bottom-full right-0 mb-2 z-30 dcc-surface-panel shadow-2xl rounded-xl p-2.5 border flex flex-wrap items-center gap-2 text-xs w-max max-w-[calc(100dvw-2rem)]">
          <input
            type="text"
            value={editLabel}
            onChange={(e) => setEditLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                updateCameraBookmark(editingBookmark.id, { label: editLabel })
                setEditingId(null)
              }
              if (e.key === 'Escape') setEditingId(null)
            }}
            className="dcc-surface-input border rounded-md px-2 py-1 text-xs w-40"
          />
          <button
            type="button"
            onClick={() => {
              updateCameraBookmark(editingBookmark.id, { label: editLabel })
              setEditingId(null)
            }}
            title="Save bookmark name"
            className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-1 cursor-pointer"
          >
            <Check size={12} /> Rename
          </button>
          <button
            type="button"
            onClick={() => {
              const vp = captureCurrentViewport()
              updateCameraBookmark(editingBookmark.id, {
                centerX: vp.centerX,
                centerY: vp.centerY,
                zoom: vp.zoom
              })
              setEditingId(null)
            }}
            title="Overwrite bookmark coordinates with current camera position"
            className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-semibold flex items-center gap-1 cursor-pointer"
          >
            <Crosshair size={12} /> Recapture Camera
          </button>
          <button
            type="button"
            onClick={() =>
              updateCameraBookmark(editingBookmark.id, {
                playerVisible: editingBookmark.playerVisible === false ? true : false
              })
            }
            title="Toggle whether players see this bookmark in Player View & Handouts"
            className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-semibold flex items-center gap-1 cursor-pointer"
          >
            {editingBookmark.playerVisible === false ? <EyeOff size={12} /> : <Eye size={12} />}
            {editingBookmark.playerVisible === false ? 'DM Only' : 'Players See'}
          </button>
          {isPlayerScreenOpen && onSyncBookmarkToPlayerScreen && (
            <button
              type="button"
              onClick={() => {
                onSyncBookmarkToPlayerScreen(editingBookmark)
                setEditingId(null)
              }}
              title="Fly 2nd-Screen Tabletop TV to this bookmark"
              className="px-2 py-1 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900/80 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Tv size={12} /> Sync to TV
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              deleteCameraBookmark(editingBookmark.id)
              setEditingId(null)
            }}
            title="Delete bookmark"
            className="px-2 py-1 rounded bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-300 font-semibold flex items-center gap-1 cursor-pointer"
          >
            <Trash2 size={12} />
          </button>
          <button
            type="button"
            onClick={() => setEditingId(null)}
            aria-label="Close bookmark editor"
            className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
          >
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  )
}
