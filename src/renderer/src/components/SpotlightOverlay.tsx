import { useEffect, useId, useRef } from 'react'
import { DndEdge, DndNode } from '../types'
import { RichLoreView } from './RichLoreView'
import { availableIcons, getIconColor } from '../utils/icons'
import {
  X,
  Sparkles,
  ArrowRight,
  Globe,
  MessageSquareText,
  Compass,
  FolderKanban,
  HelpCircle
} from 'lucide-react'

interface SpotlightOverlayProps {
  node?: DndNode | null
  edge?: DndEdge | null
  mysteryPortrait?: { portrait: string; subtitle?: string } | null
  allNodes: DndNode[]
  onDismiss: () => void
  onNavigateToNode: (nodeId: string) => void
}

export default function SpotlightOverlay({
  node,
  edge,
  mysteryPortrait,
  allNodes,
  onDismiss,
  onNavigateToNode
}: SpotlightOverlayProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const isOpen = Boolean(mysteryPortrait || node || edge)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (isOpen && !dialog.open) {
      dialog.showModal()
    } else if (!isOpen && dialog.open) {
      dialog.close()
    }
  }, [isOpen])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const handleClose = () => {
      dialog.returnValue = ''
      onDismiss()
    }
    dialog.addEventListener('close', handleClose)
    return () => dialog.removeEventListener('close', handleClose)
  }, [onDismiss])

  // Fallback for light-dismiss (`closedby="any"`) when `HTMLDialogElement.prototype.closedBy` is unsupported
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || !isOpen) return
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
  }, [isOpen])

  if (!mysteryPortrait && !node && !edge) return null

  const handleNavigate = (targetId: string) => {
    onDismiss()
    onNavigateToNode(targetId)
  }

  if (mysteryPortrait) {
    return (
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        {...({ closedby: 'any' } as any)}
        className="m-auto w-[92vw] max-w-xl rounded-2xl border-2 border-purple-500/80 bg-slate-950 text-slate-100 shadow-[0_24px_72px_rgba(0,0,0,0.8)] p-0 open:flex open:flex-col overflow-hidden"
      >
        <div className="px-5 py-3.5 bg-gradient-to-r from-purple-600/25 via-indigo-500/15 to-transparent border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <HelpCircle size={18} className="text-purple-400 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-purple-300">
                {mysteryPortrait.subtitle || 'Unidentified Encounter'}
              </div>
              <h2 id={titleId} className="text-xl font-extrabold tracking-widest text-white">
                ???
              </h2>
            </div>
          </div>
          <button
            type="button"
            aria-label="Dismiss mystery portrait"
            onClick={() => dialogRef.current?.close()}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4 max-h-[82vh] overflow-y-auto overscroll-contain dcc-scroll-y [scrollbar-gutter:stable] [&>*]:shrink-0">
          <div className="w-full rounded-xl overflow-clip shrink-0 border border-slate-800 bg-black max-h-[62vh] flex items-center justify-center shadow-inner">
            <img
              src={mysteryPortrait.portrait}
              alt="Unidentified encounter portrait"
              className="w-full max-h-[62vh] object-contain"
            />
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs italic text-slate-400">
              Identity not yet revealed to the party.
            </span>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="px-4 py-1.5 rounded-lg bg-slate-100 text-slate-900 text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer"
            >
              Dismiss Handout
            </button>
          </div>
        </div>
      </dialog>
    )
  }

  if (edge) {
    const d = edge.data || {}
    const sourceNode = allNodes.find((n) => n.id === edge.source)
    const targetNode = allNodes.find((n) => n.id === edge.target)

    return (
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        {...({ closedby: 'any' } as any)}
        className="m-auto w-[92vw] max-w-lg rounded-2xl border-2 border-amber-400/80 dcc-surface-panel text-slate-900 dark:text-slate-100 shadow-[0_24px_64px_rgba(0,0,0,0.55)] p-0 open:flex open:flex-col overflow-hidden"
      >
        <div className="px-5 py-3.5 bg-gradient-to-r from-amber-500/15 via-amber-400/10 to-transparent border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles size={16} className="text-amber-500 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                Spotlight • Relationship Reveal
              </div>
              <h2 id={titleId} className="text-lg font-bold truncate">
                {d.label || 'Connection'}
              </h2>
            </div>
          </div>
          <button
            type="button"
            aria-label="Dismiss spotlight"
            onClick={() => dialogRef.current?.close()}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4 max-h-[78vh] overflow-y-auto overscroll-contain dcc-scroll-y dcc-scroll-shadow [scrollbar-gutter:stable] [&>*]:shrink-0">
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold">
            <span className="truncate">{sourceNode?.data.label || 'Entity'}</span>
            <ArrowRight size={16} className="text-amber-500 shrink-0" aria-hidden="true" />
            <span className="truncate">{targetNode?.data.label || 'Entity'}</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Globe size={13} aria-hidden="true" /> Known Details
            </span>
            <RichLoreView
              text={d.publicNotes || ''}
              nodes={allNodes}
              isPlayerView={true}
              onNavigateToNode={handleNavigate}
              emptyText="No additional details known yet."
            />
          </div>

          {d.partyNotes?.trim() && (
            <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/35 border border-indigo-200 dark:border-indigo-800/60 flex flex-col gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-800 dark:text-indigo-300 flex items-center gap-1.5">
                <MessageSquareText size={13} aria-hidden="true" /> Party Notes
              </span>
              <RichLoreView
                text={d.partyNotes}
                nodes={allNodes}
                isPlayerView={true}
                onNavigateToNode={handleNavigate}
              />
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="px-4 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer"
            >
              Dismiss Handout
            </button>
          </div>
        </div>
      </dialog>
    )
  }

  const d = node!.data
  const f = d.dndFields || {}
  const publicLore = d.publicNotes ?? d.description ?? ''
  const isGroupSpotlight = node!.type === 'groupRegion' || Boolean(d.isGroup)
  const groupMembers = isGroupSpotlight
    ? allNodes.filter(
        (m) =>
          m.data?.groupId === node!.id &&
          m.type !== 'groupRegion' &&
          !m.data?.isGroup &&
          !m.data?.isHidden
      )
    : []
  const legacyStatusIconMap: Record<string, string> = {
    skull: 'Skull',
    flame: 'Flame',
    crown: 'Crown',
    shield: 'Shield'
  }

  const chips: Array<{ label: string; value: string }> = []
  if (f.ancestry) chips.push({ label: 'Ancestry', value: f.ancestry })
  if (f.classOrRole) chips.push({ label: 'Role', value: f.classOrRole })
  if (f.faction) chips.push({ label: 'Faction', value: f.faction })
  if (f.disposition) chips.push({ label: 'Standing', value: f.disposition })
  if (f.region) chips.push({ label: 'Region', value: f.region })
  if (f.locationType) chips.push({ label: 'Type', value: f.locationType })
  if (f.rarity) chips.push({ label: 'Rarity', value: f.rarity })
  if (f.attunement) chips.push({ label: 'Attunement', value: 'Required' })
  if (f.holder) chips.push({ label: 'Held By', value: f.holder })
  if (f.influence) chips.push({ label: 'Influence', value: f.influence })
  if (f.headquarters) chips.push({ label: 'HQ', value: f.headquarters })
  if (f.goal) chips.push({ label: 'Objective', value: f.goal })
  if (f.questStatus) chips.push({ label: 'Status', value: f.questStatus })
  if (f.sessionDate) chips.push({ label: 'Session', value: f.sessionDate })

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      {...({ closedby: 'any' } as any)}
      className="m-auto w-[92vw] max-w-xl rounded-2xl border-2 border-amber-400/85 dcc-surface-panel text-slate-900 dark:text-slate-100 shadow-[0_24px_64px_rgba(0,0,0,0.6)] p-0 open:flex open:flex-col overflow-hidden"
    >
      <div className="px-5 py-3.5 bg-gradient-to-r from-amber-500/15 via-amber-400/10 to-transparent border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Sparkles size={18} className="text-amber-500 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                {isGroupSpotlight ? 'Group / Region' : d.entityType}
              </span>
              {d.isPlayerCreated && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-indigo-600 text-white text-[9px] font-bold uppercase tracking-wider">
                  <Compass size={9} aria-hidden="true" /> Theory
                </span>
              )}
            </div>
            <h2 id={titleId} className="text-xl font-extrabold leading-tight truncate">
              {d.label || 'Unnamed Entity'}
            </h2>
            {d.groupSubtitle && (
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate">
                {d.groupSubtitle}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          aria-label="Dismiss spotlight"
          onClick={() => dialogRef.current?.close()}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>
      </div>

      <div className="p-5 flex flex-col gap-4 max-h-[80vh] overflow-y-auto overscroll-contain dcc-scroll-y dcc-scroll-shadow [scrollbar-gutter:stable] [&>*]:shrink-0">
        {(d.statusIcons || []).length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {(d.statusIcons || []).map((s) => {
              const mapped = legacyStatusIconMap[s] || s
              const SIcon = availableIcons[mapped] || availableIcons.Component
              return (
                <span
                  key={s}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200"
                >
                  <SIcon size={13} className={getIconColor(mapped)} />
                  <span>{mapped}</span>
                </span>
              )
            })}
          </div>
        )}

        {d.portrait && (
          <div className="w-full rounded-xl overflow-clip shrink-0 border border-slate-200 dark:border-slate-700 bg-slate-950/5 dark:bg-slate-950 max-h-72 flex items-center justify-center">
            <img
              src={d.portrait}
              alt={d.label || 'Spotlighted entity portrait'}
              className="w-full max-h-72 object-contain"
            />
          </div>
        )}

        {chips.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
            {chips.map((c) => (
              <div key={c.label} className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {c.label}
                </span>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 break-words">
                  {c.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {isGroupSpotlight && groupMembers.length > 0 && (
          <div className="flex flex-col gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <FolderKanban size={12} className="text-amber-500" aria-hidden="true" />
              <span>Entities in Group ({groupMembers.length})</span>
            </span>
            <div className="flex flex-wrap gap-1.5">
              {groupMembers.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleNavigate(m.id)}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-blue-950/50 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline transition-colors cursor-pointer"
                >
                  {m.data.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Globe size={13} aria-hidden="true" /> Lore & Details
          </span>
          <RichLoreView
            text={publicLore}
            nodes={allNodes}
            isPlayerView={true}
            onNavigateToNode={handleNavigate}
            emptyText="No public lore revealed yet."
          />
        </div>

        {d.partyNotes?.trim() && (
          <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/35 border border-indigo-200 dark:border-indigo-800/60 flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-800 dark:text-indigo-300 flex items-center gap-1.5">
              <MessageSquareText size={13} aria-hidden="true" /> Party Notes & Theories
            </span>
            <RichLoreView
              text={d.partyNotes}
              nodes={allNodes}
              isPlayerView={true}
              onNavigateToNode={handleNavigate}
            />
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="px-4 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer"
          >
            Dismiss Handout
          </button>
        </div>
      </div>
    </dialog>
  )
}
