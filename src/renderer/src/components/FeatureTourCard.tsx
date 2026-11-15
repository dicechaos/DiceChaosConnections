import { useEffect, useId, useRef, useState } from 'react'
import {
  Sparkles,
  X,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  History,
  BookOpen,
  Network,
  Share2,
  MonitorPlay,
  RotateCcw
} from 'lucide-react'

export interface FeatureTourCardProps {
  open: boolean
  onClose: () => void
  triggerRef: React.RefObject<HTMLButtonElement | null>
  hasInspectorOpen: boolean
  isHobbitStarter: boolean
  isPlayerEdition: boolean
  isPlayerView: boolean
  isSnapshotDiffActive: boolean
  isFocusDemoActive: boolean
  onToggleSpoilerShield: () => void
  onToggleTimelineDiff: () => void
  onInspectSpotlightEntity: () => void
  onToggleFocusWeb: () => void
  onOpenShareDossiers: () => void
  onOpenPlayerScreen: () => void
  onRequestLoadStarterDemo: () => void
}

export default function FeatureTourCard({
  open,
  onClose,
  triggerRef,
  hasInspectorOpen,
  isHobbitStarter,
  isPlayerEdition,
  isPlayerView,
  isSnapshotDiffActive,
  isFocusDemoActive,
  onToggleSpoilerShield,
  onToggleTimelineDiff,
  onInspectSpotlightEntity,
  onToggleFocusWeb,
  onOpenShareDossiers,
  onOpenPlayerScreen,
  onRequestLoadStarterDemo
}: FeatureTourCardProps) {
  const headingId = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const primaryActionRef = useRef<HTMLButtonElement>(null)
  const wasOpenRef = useRef(false)
  const [stepIndex, setStepIndex] = useState(0)

  const supportsPopover =
    typeof HTMLElement !== 'undefined' && 'popover' in HTMLElement.prototype

  const handleDismiss = () => {
    onClose()
    requestAnimationFrame(() => {
      triggerRef.current?.focus()
    })
  }

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return

    if (open) {
      if (supportsPopover) {
        try {
          if (!el.matches(':popover-open')) {
            el.showPopover()
          }
        } catch {
          // Ignore if already open
        }
      }
      if (!wasOpenRef.current) {
        requestAnimationFrame(() => {
          primaryActionRef.current?.focus()
        })
      }
      wasOpenRef.current = true
    } else {
      if (supportsPopover) {
        try {
          if (el.matches(':popover-open')) {
            el.hidePopover()
          }
        } catch {
          // Ignore if already closed
        }
      }
      wasOpenRef.current = false
    }
  }, [open, supportsPopover])

  const steps = [
    {
      badge: 'Spoiler Shield',
      title: '1. DM Secrets & Viewing: DM / Player',
      Icon: ShieldAlert,
      description: isHobbitStarter
        ? 'Keep one master conspiracy map while hiding plot twists from your table. Toggle Viewing: Player to watch Bolg, the Goblin & Warg hosts, the Necromancer, and Bilbo’s Ring & Arkenstone secrets vanish—dropping Army / Host from 5 to 3 in the Legend.'
        : 'Keep one master conspiracy map while hiding plot twists from your table. Toggle Viewing: Player at any time to preview the exact spoiler-scrubbed graph your players see.',
      actionLabel: isPlayerView ? 'Switch to Viewing: DM' : 'Switch to Viewing: Player',
      isActiveState: isPlayerView,
      onAction: onToggleSpoilerShield
    },
    {
      badge: 'Time Machine',
      title: '2. Session Checkpoints & Visual Diffs',
      Icon: History,
      description: isHobbitStarter
        ? 'Record campaign history in the bottom-left Campaign Timeline. Compare Session 3 (Doorstep of Erebor) against today’s Eve of Five Armies map to highlight +9 new arrivals and ~Changed rings where Smaug fell and Lake-town burned.'
        : 'Capture end-of-session snapshots in the bottom-left Campaign Timeline, then toggle Diff vs. Live to highlight newly discovered entities (+ New) and status changes (~ Changed).',
      actionLabel: isSnapshotDiffActive
        ? 'Return to Live Campaign'
        : isHobbitStarter
          ? 'Compare Session 3 vs. Live Diff'
          : 'Preview Timeline Diff',
      isActiveState: isSnapshotDiffActive,
      onAction: onToggleTimelineDiff
    },
    {
      badge: 'Rich Lore & Art',
      title: '3. Portraits, Stats & [[Wiki-Links]]',
      Icon: BookOpen,
      description: isHobbitStarter
        ? 'Cards support Banner or Token portraits (like Erebor, Smaug, and Bilbo), D&D stats, Public Lore, Party Conspiracy Notes, and DM Secrets. Click any [[Entity Name]] link inside a note to pan straight to that card.'
        : 'Every entity supports Banner or Token portraits, D&D stat pills, Public Lore, Party Notes, and DM Secrets. Type [[ in any note to autocomplete clickable entity cross-links.',
      actionLabel: isHobbitStarter ? 'Inspect Bilbo Baggins Sheet' : 'Inspect Entity Sheet',
      isActiveState: false,
      onAction: onInspectSpotlightEntity
    },
    {
      badge: 'Graph Clarity',
      title: '4. Focus Web & Custom Categories',
      Icon: Network,
      description: isHobbitStarter
        ? 'Untangle sprawling intrigue with custom categories (like Army / Host) and Focus Web beside the bottom-left zoom controls. Isolate The Arkenstone within 2 hops to spotlight the siege standoff while fading distant Shire & Mirkwood threads.'
        : 'Create custom color-coded categories in the Sidebar and use Focus Web (beside the bottom-left zoom controls) to isolate a single character or mystery within 1–3 hops.',
      actionLabel: isFocusDemoActive
        ? 'Reset Full Map View'
        : isHobbitStarter
          ? 'Isolate Arkenstone (2 Hops)'
          : 'Demo 2-Hop Focus Web',
      isActiveState: isFocusDemoActive,
      onAction: onToggleFocusWeb
    },
    {
      badge: 'Tabletop & Vaults',
      title: '5. 2nd-Screen TV & Campaign Dossiers',
      Icon: Share2,
      description:
        'Pop out a live Player Screen for a second monitor or TV (right-click any card to Spotlight it), sync player Theory Pins via Player .json, or export an Obsidian Vault, PDF Campaign Bible, or theme-stamped PNG.',
      actionLabel: 'Open Share & Dossiers',
      isActiveState: false,
      onAction: onOpenShareDossiers
    }
  ]

  const current = steps[stepIndex]
  const StepIcon = current.Icon

  if (!open && !supportsPopover) return null

  return (
    <dialog
      ref={dialogRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={headingId}
      {...({ popover: 'manual' } as Record<string, unknown>)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          handleDismiss()
        } else if (e.key === 'ArrowRight') {
          setStepIndex((i) => (i + 1) % steps.length)
        } else if (e.key === 'ArrowLeft') {
          setStepIndex((i) => (i - 1 + steps.length) % steps.length)
        }
      }}
      style={{
        position: 'fixed',
        inset: 'auto',
        right: hasInspectorOpen ? '23.25rem' : '1.25rem',
        bottom: '3.5rem',
        margin: 0
      }}
      className={`no-export z-40 w-[22.5rem] max-w-[calc(100vw-2.5rem)] rounded-xl border border-indigo-200/90 dark:border-indigo-500/40 bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-100 shadow-2xl backdrop-blur-md p-0 transition-[right] duration-200 ${
        !open ? 'hidden' : 'block'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-200/80 dark:border-slate-700/80 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-t-xl">
        <div className="flex items-center gap-1.5">
          <Sparkles size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-800 dark:text-indigo-300">
            Interactive Studio Tour
          </span>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/70 text-indigo-700 dark:text-indigo-300 tabular-nums">
            {stepIndex + 1} / {steps.length}
          </span>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Close Interactive Tour"
          title="Close Tour (Esc)"
          className="p-1 rounded-md text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>

      {/* Body */}
      <div className="p-3.5 flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center shrink-0">
            <StepIcon size={15} />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              {current.badge}
            </div>
            <h3 id={headingId} className="text-xs font-bold text-slate-900 dark:text-white">
              {current.title}
            </h3>
          </div>
        </div>

        <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300 text-pretty">
          {current.description}
        </p>

        {/* Primary Live Demo Action(s) */}
        {!isPlayerEdition && (
          <div className="flex items-center gap-2 pt-0.5">
            <button
              ref={primaryActionRef}
              type="button"
              onClick={current.onAction}
              className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                current.isActiveState
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {current.isActiveState && <RotateCcw size={12} />}
              <span>{current.actionLabel}</span>
            </button>

            {stepIndex === 4 && (
              <button
                type="button"
                onClick={onOpenPlayerScreen}
                title="Open 2nd-Screen Player Window"
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 flex items-center gap-1 cursor-pointer shrink-0"
              >
                <MonitorPlay size={13} />
                <span>2nd Screen</span>
              </button>
            )}
          </div>
        )}

        {!isHobbitStarter && !isPlayerEdition && (
          <button
            type="button"
            onClick={onRequestLoadStarterDemo}
            className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline text-left cursor-pointer"
          >
            Load The Hobbit: Eve of Five Armies demo map to try every step with rich lore →
          </button>
        )}
      </div>

      {/* Stepper Footer */}
      <div className="flex items-center justify-between px-3.5 py-2 border-t border-slate-200/80 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-900/60 rounded-b-xl">
        <div className="flex items-center gap-1.5" role="tablist" aria-label="Tour Steps">
          {steps.map((s, idx) => (
            <button
              key={s.badge}
              type="button"
              role="tab"
              aria-selected={idx === stepIndex}
              aria-label={`Step ${idx + 1}: ${s.badge}`}
              title={`${idx + 1}. ${s.badge}`}
              onClick={() => setStepIndex(idx)}
              className={`h-2 rounded-full transition-all cursor-pointer ${
                idx === stepIndex
                  ? 'w-5 bg-indigo-600 dark:bg-indigo-400'
                  : 'w-2 bg-slate-300 dark:bg-slate-600 hover:bg-slate-400 dark:hover:bg-slate-500'
              }`}
            />
          ))}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
            disabled={stepIndex === 0}
            aria-label="Previous step"
            className="px-2 py-1 rounded text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed flex items-center gap-0.5"
          >
            <ChevronLeft size={13} />
            <span>Prev</span>
          </button>
          {stepIndex < steps.length - 1 ? (
            <button
              type="button"
              onClick={() => setStepIndex((i) => Math.min(steps.length - 1, i + 1))}
              className="px-2.5 py-1 rounded text-xs font-semibold bg-slate-200/80 dark:bg-slate-800 hover:bg-slate-300/80 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 cursor-pointer flex items-center gap-0.5"
            >
              <span>Next</span>
              <ChevronRight size={13} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleDismiss}
              className="px-2.5 py-1 rounded text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </dialog>
  )
}
