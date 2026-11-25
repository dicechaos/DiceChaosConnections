import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { CameraBookmark, DndEdge, DndNode } from '../types'
import {
  matchEdgeAgainstQuery,
  matchNodeAgainstQuery,
  SearchMatchBadge
} from '../utils/graphPipeline'
import {
  Search,
  X,
  CornerDownLeft,
  Pin,
  Bookmark,
  Tag,
  Sparkles,
  GitBranch,
  FolderKanban,
  EyeOff
} from 'lucide-react'
import { availableIcons, getIconColor } from '../utils/icons'

export interface QuickCommandAction {
  id: string
  label: string
  shortcut?: string
  category: string
  onRun: () => void
}

interface CommandPaletteModalProps {
  open: boolean
  onClose: () => void
  nodes: DndNode[]
  edges: DndEdge[]
  bookmarks: CameraBookmark[]
  hideSecrets: boolean
  pinnedCanvasQuery: string
  onPinCanvasQuery: (query: string) => void
  onSelectNode: (nodeId: string) => void
  onSelectEdge: (edgeId: string) => void
  onJumpBookmark: (bookmark: CameraBookmark) => void
  quickActions: QuickCommandAction[]
}

type PaletteEntry =
  | {
      kind: 'node'
      key: string
      node: DndNode
      badges: SearchMatchBadge[]
      snippet?: string
    }
  | {
      kind: 'edge'
      key: string
      edge: DndEdge
      endpointSummary: string
      badges: SearchMatchBadge[]
      snippet?: string
    }
  | {
      kind: 'tag'
      key: string
      tag: string
      count: number
    }
  | {
      kind: 'bookmark'
      key: string
      bookmark: CameraBookmark
    }
  | {
      kind: 'action'
      key: string
      action: QuickCommandAction
    }

const BADGE_STYLE: Record<SearchMatchBadge, string> = {
  Name: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-200',
  Alias: 'bg-cyan-100 dark:bg-cyan-900/50 text-cyan-800 dark:text-cyan-200',
  '#Tag': 'bg-violet-100 dark:bg-violet-900/50 text-violet-800 dark:text-violet-200',
  Type: 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200',
  Sheet: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200',
  Lore: 'bg-sky-100 dark:bg-sky-900/50 text-sky-800 dark:text-sky-200',
  'Party Note': 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-200',
  'DM Secret': 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200'
}

const SECTION_LABELS: Record<PaletteEntry['kind'], string> = {
  tag: 'Quick #Tags',
  bookmark: 'Saved Views',
  action: 'Studio Commands',
  node: 'Entities & Groups',
  edge: 'Connections'
}

export default function CommandPaletteModal({
  open,
  onClose,
  nodes,
  edges,
  bookmarks,
  hideSecrets,
  pinnedCanvasQuery,
  onPinCanvasQuery,
  onSelectNode,
  onSelectEdge,
  onJumpBookmark,
  quickActions
}: CommandPaletteModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const titleId = useId()

  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      setQuery(pinnedCanvasQuery || '')
      setActiveIndex(0)
      dialog.showModal()
      requestAnimationFrame(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      })
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open, pinnedCanvasQuery])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const handleClose = () => {
      dialog.returnValue = ''
      onClose()
    }
    dialog.addEventListener('close', handleClose)
    return () => dialog.removeEventListener('close', handleClose)
  }, [onClose])

  // Fallback for `closedby="any"` when `HTMLDialogElement.prototype.closedBy` is unsupported
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || !open) return
    if ('closedBy' in HTMLDialogElement.prototype) return

    const handleBackdropClick = (event: MouseEvent) => {
      if (event.target !== dialog) return
      const rect = dialog.getBoundingClientRect()
      const clickedOutside =
        event.clientY < rect.top ||
        event.clientY > rect.bottom ||
        event.clientX < rect.left ||
        event.clientX > rect.right
      if (clickedOutside) {
        dialog.close()
      }
    }
    dialog.addEventListener('click', handleBackdropClick)
    return () => dialog.removeEventListener('click', handleBackdropClick)
  }, [open])

  const visibleNodes = useMemo(
    () => (hideSecrets ? nodes.filter((n) => !n.data?.isHidden) : nodes),
    [nodes, hideSecrets]
  )

  const nodeById = useMemo(() => new Map(visibleNodes.map((n) => [n.id, n])), [visibleNodes])

  const visibleBookmarks = useMemo(
    () => bookmarks.filter((b) => !hideSecrets || b.playerVisible !== false),
    [bookmarks, hideSecrets]
  )

  const allTagCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const n of visibleNodes) {
      for (const rawTag of n.data?.tags || []) {
        const clean = rawTag.replace(/^#+/, '').trim().toLowerCase()
        if (clean) counts.set(clean, (counts.get(clean) || 0) + 1)
      }
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [visibleNodes])

  const entries = useMemo<PaletteEntry[]>(() => {
    const trimmed = query.trim()
    const qLower = trimmed.toLowerCase()
    const list: PaletteEntry[] = []

    if (!trimmed) {
      // Empty query overview: #Tags, Camera Bookmarks, Quick Actions, and featured entities
      for (const [tag, count] of allTagCounts.slice(0, 8)) {
        list.push({ kind: 'tag', key: `tag-${tag}`, tag, count })
      }
      for (const bm of visibleBookmarks) {
        list.push({ kind: 'bookmark', key: `bm-${bm.id}`, bookmark: bm })
      }
      for (const act of quickActions) {
        list.push({ kind: 'action', key: `act-${act.id}`, action: act })
      }
      for (const n of visibleNodes.slice(0, 8)) {
        list.push({ kind: 'node', key: `node-${n.id}`, node: n, badges: [] })
      }
      return list
    }

    // Matching Tags
    const tagNeedle = qLower.replace(/^#+/, '')
    if (tagNeedle) {
      for (const [tag, count] of allTagCounts) {
        if (tag.includes(tagNeedle)) {
          list.push({ kind: 'tag', key: `tag-${tag}`, tag, count })
        }
      }
    }

    // Matching Entities
    for (const n of visibleNodes) {
      const hit = matchNodeAgainstQuery(n, trimmed, hideSecrets)
      if (hit) {
        list.push({
          kind: 'node',
          key: `node-${n.id}`,
          node: n,
          badges: hit.badges,
          snippet: hit.snippet
        })
      }
    }

    // Matching Connections
    if (!trimmed.startsWith('#')) {
      for (const e of edges) {
        if (hideSecrets && e.data?.isHidden) continue
        const s = nodeById.get(e.source)
        const t = nodeById.get(e.target)
        if (hideSecrets && (!s || !t)) continue
        const hit = matchEdgeAgainstQuery(e, trimmed, hideSecrets)
        if (hit) {
          list.push({
            kind: 'edge',
            key: `edge-${e.id}`,
            edge: e,
            endpointSummary: `${s?.data.label || 'Link'} → ${t?.data.label || 'Link'}`,
            badges: hit.badges,
            snippet: hit.snippet
          })
        }
      }
    }

    // Matching Camera Bookmarks
    for (const bm of visibleBookmarks) {
      if (bm.label.toLowerCase().includes(qLower)) {
        list.push({ kind: 'bookmark', key: `bm-${bm.id}`, bookmark: bm })
      }
    }

    // Matching Quick Studio Actions
    for (const act of quickActions) {
      if (
        act.label.toLowerCase().includes(qLower) ||
        act.category.toLowerCase().includes(qLower)
      ) {
        list.push({ kind: 'action', key: `act-${act.id}`, action: act })
      }
    }

    return list.slice(0, 40)
  }, [query, allTagCounts, visibleBookmarks, quickActions, visibleNodes, edges, hideSecrets, nodeById])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  const executeEntry = (entry: PaletteEntry | undefined) => {
    if (!entry) return
    if (entry.kind === 'node') {
      onSelectNode(entry.node.id)
      dialogRef.current?.close()
    } else if (entry.kind === 'edge') {
      onSelectEdge(entry.edge.id)
      dialogRef.current?.close()
    } else if (entry.kind === 'tag') {
      onPinCanvasQuery(`#${entry.tag}`)
      dialogRef.current?.close()
    } else if (entry.kind === 'bookmark') {
      onJumpBookmark(entry.bookmark)
      dialogRef.current?.close()
    } else if (entry.kind === 'action') {
      dialogRef.current?.close()
      entry.action.onRun()
    }
  }

  const handlePinFilter = () => {
    onPinCanvasQuery(query.trim())
    dialogRef.current?.close()
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      {...({ closedby: 'any' } as any)}
      className="m-auto mt-[10vh] w-[94vw] max-w-2xl rounded-2xl border dcc-surface-panel text-slate-900 dark:text-slate-100 shadow-2xl p-0 open:flex open:flex-col overflow-hidden"
    >
      <h2 id={titleId} className="sr-only">
        Search Campaign and Studio Commands
      </h2>

      {/* Search Input Header */}
      <div className="px-4 py-3 border-b flex items-center gap-2.5 dcc-chrome-bar">
        <Search size={17} className="text-blue-500 shrink-0" aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              if (entries.length > 0) {
                setActiveIndex((prev) => (prev + 1) % entries.length)
              }
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              if (entries.length > 0) {
                setActiveIndex((prev) => (prev - 1 + entries.length) % entries.length)
              }
            } else if (e.key === 'Enter' && e.shiftKey && query.trim()) {
              e.preventDefault()
              handlePinFilter()
            } else if (e.key === 'Enter') {
              e.preventDefault()
              if (entries[activeIndex]) {
                executeEntry(entries[activeIndex])
              } else if (query.trim()) {
                handlePinFilter()
              }
            } else if (e.key === 'Escape' && query) {
              e.preventDefault()
              e.stopPropagation()
              setQuery('')
            }
          }}
          placeholder="Search entities, aliases, #tags, lore, connections, or commands..."
          className="flex-1 bg-transparent text-sm font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none"
        />

        {query.trim() && (
          <button
            type="button"
            onClick={handlePinFilter}
            title="Keep canvas filtered to this search query (Shift+Enter)"
            className="px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <Pin size={11} /> Pin Filter
          </button>
        )}

        <button
          type="button"
          aria-label="Close command palette"
          onClick={() => dialogRef.current?.close()}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      {/* Quick #Tag Filter Strip when tags exist */}
      {allTagCounts.length > 0 && !query.trim() && (
        <div className="px-4 py-2 border-b border-slate-200/70 dark:border-slate-800 flex items-center gap-2 bg-slate-50/40 dark:bg-slate-900/40">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 shrink-0 flex items-center gap-1">
            <Tag size={11} /> #Tags:
          </span>
          <div className="flex-1 min-w-0 flex items-center gap-1.5 dcc-scroll-fade-x py-0.5">
            {allTagCounts.map(([tag, count]) => (
              <button
                key={tag}
                type="button"
                onClick={() => {
                  onPinCanvasQuery(`#${tag}`)
                  dialogRef.current?.close()
                }}
                className="px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-950/60 hover:bg-violet-100 dark:hover:bg-violet-900/70 border border-violet-200 dark:border-violet-800/60 text-violet-700 dark:text-violet-300 text-[11px] font-semibold shrink-0 cursor-pointer transition-colors"
              >
                #{tag} <span className="opacity-70">({count})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results List */}
      <div className="max-h-[58vh] overflow-y-auto overscroll-contain dcc-scroll-y dcc-scroll-shadow scroll-py-2 p-2 flex flex-col gap-0.5">
        {entries.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No matching entities, connections, bookmarks, or commands for &ldquo;{query}&rdquo;.
          </div>
        ) : (
          entries.map((entry, idx) => {
            const prevKind = idx > 0 ? entries[idx - 1].kind : null
            const showSectionHeader = prevKind !== entry.kind
            const isActive = idx === activeIndex
            const activeRowClass = isActive
              ? 'bg-blue-50 dark:bg-blue-900/35 border-blue-200 dark:border-blue-700/70'
              : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60'

            const sectionHeader = showSectionHeader ? (
              <div
                className={`px-3 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 select-none ${
                  idx > 0 ? 'mt-1.5 border-t border-slate-200/70 dark:border-slate-800/80 pt-2' : ''
                }`}
              >
                {SECTION_LABELS[entry.kind]}
              </div>
            ) : null

            if (entry.kind === 'node') {
              const d = entry.node.data
              const isGroupRow = entry.node.type === 'groupRegion' || Boolean(d.isGroup)
              const GroupRowIcon =
                isGroupRow && d.groupIcon && availableIcons[d.groupIcon]
                  ? availableIcons[d.groupIcon]
                  : FolderKanban
              return (
                <div key={entry.key} className="contents">
                  {sectionHeader}
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => executeEntry(entry)}
                    className={`w-full px-3 py-2 rounded-lg border text-left flex flex-col gap-1 transition-colors cursor-pointer ${activeRowClass}`}
                  >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {isGroupRow && (
                        <GroupRowIcon
                          size={13}
                          aria-hidden="true"
                          className={`shrink-0 ${
                            d.groupIcon ? getIconColor(d.groupIcon) : 'text-amber-600 dark:text-amber-400'
                          }`}
                        />
                      )}
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        {d.label}
                      </span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shrink-0">
                        {isGroupRow ? 'Group' : d.entityType}
                      </span>
                      {d.dndFields?.disposition && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                          {d.dndFields.disposition}
                        </span>
                      )}
                      {!hideSecrets && d.isHidden && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 shrink-0">
                          <EyeOff size={10} /> Secret
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {entry.badges.map((b) => (
                        <span
                          key={b}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${BADGE_STYLE[b]}`}
                        >
                          {b}
                        </span>
                      ))}
                    </div>
                  </div>
                  {entry.snippet && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {entry.snippet}
                    </p>
                  )}
                  </button>
                </div>
              )
            }

            if (entry.kind === 'edge') {
              return (
                <div key={entry.key} className="contents">
                  {sectionHeader}
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => executeEntry(entry)}
                    className={`w-full px-3 py-2 rounded-lg border text-left flex flex-col gap-1 transition-colors cursor-pointer ${activeRowClass}`}
                  >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <GitBranch size={13} className="text-slate-400 shrink-0" />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                        {entry.edge.data?.label || 'Connection'}
                      </span>
                      <span className="text-[11px] text-slate-400 truncate">
                        ({entry.endpointSummary})
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {entry.badges.map((b) => (
                        <span
                          key={b}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${BADGE_STYLE[b]}`}
                        >
                          {b}
                        </span>
                      ))}
                    </div>
                  </div>
                  {entry.snippet && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {entry.snippet}
                    </p>
                  )}
                  </button>
                </div>
              )
            }

            if (entry.kind === 'tag') {
              return (
                <div key={entry.key} className="contents">
                  {sectionHeader}
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => executeEntry(entry)}
                    className={`w-full px-3 py-2 rounded-lg border text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${activeRowClass}`}
                  >
                    <span className="flex items-center gap-2 text-xs font-bold text-violet-700 dark:text-violet-300">
                      <Tag size={13} /> Pin Canvas Filter: #{entry.tag}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400">
                      {entry.count} {entry.count === 1 ? 'entity' : 'entities'}
                    </span>
                  </button>
                </div>
              )
            }

            if (entry.kind === 'bookmark') {
              return (
                <div key={entry.key} className="contents">
                  {sectionHeader}
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => executeEntry(entry)}
                    className={`w-full px-3 py-2 rounded-lg border text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${activeRowClass}`}
                  >
                    <span className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-300">
                      <Bookmark size={13} /> Fly Camera: {entry.bookmark.label}
                    </span>
                    <span className="text-[10px] text-slate-400">Camera Bookmark</span>
                  </button>
                </div>
              )
            }

            return (
              <div key={entry.key} className="contents">
                {sectionHeader}
                <button
                  type="button"
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => executeEntry(entry)}
                  className={`w-full px-3 py-2 rounded-lg border text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${activeRowClass}`}
                >
                  <span className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                    <Sparkles size={13} className="text-indigo-500 shrink-0" />
                    <span>{entry.action.label}</span>
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-slate-400">{entry.action.category}</span>
                    {entry.action.shortcut && (
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-mono text-slate-500">
                        {entry.action.shortcut}
                      </kbd>
                    )}
                  </div>
                </button>
              </div>
            )
          })
        )}
      </div>

      {/* Footer Hints */}
      <div className="px-4 py-2 dcc-chrome-bar border-t flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <CornerDownLeft size={11} /> Jump / Run
          </span>
          <span>Shift+Enter Pin Filter to Canvas</span>
          <span>Type #tag to filter by tag</span>
        </div>
        <span>Esc Clear / Close</span>
      </div>
    </dialog>
  )
}
