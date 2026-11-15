import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import { DossierScope } from '../types'
import { NativeModal } from './NativeModal'
import {
  computeSanitizeStats,
  serializePlayerHandoutCampaign
} from '../utils/playerSanitizer'
import {
  generateMarkdownDossier,
  generateObsidianVaultEntries,
  generatePdfDossierHtml
} from '../utils/dossierExporter'
import {
  ShieldCheck,
  GitMerge,
  BookOpen,
  Image as ImageIcon,
  FileText,
  FolderGit2,
  Printer,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'

export type ShareTabId = 'playerJson' | 'mergeNotes' | 'dossier' | 'png'

interface ShareExportModalProps {
  open: boolean
  onClose: () => void
  initialTab?: ShareTabId
  // PNG export props delegated back to FlowCanvas (needs ReactFlow viewport access)
  exportScale: number
  setExportScale: (scale: number) => void
  exportArea: 'full' | 'current'
  setExportArea: (area: 'full' | 'current') => void
  exportIncludeLegend: boolean
  setExportIncludeLegend: (v: boolean) => void
  exportIncludeTitle: boolean
  setExportIncludeTitle: (v: boolean) => void
  isExportingPng: boolean
  onTriggerExportPng: () => void
}

export default function ShareExportModal({
  open,
  onClose,
  initialTab,
  exportScale,
  setExportScale,
  exportArea,
  setExportArea,
  exportIncludeLegend,
  setExportIncludeLegend,
  exportIncludeTitle,
  setExportIncludeTitle,
  isExportingPng,
  onTriggerExportPng
}: ShareExportModalProps) {
  const {
    campaignEdition,
    campaignTitle,
    canvasTheme,
    nodes,
    edges,
    connectionPresets,
    customEntityTypes,
    snapshots,
    cameraBookmarks,
    importPartyNotes
  } = useStore()

  const isPlayerEdition = campaignEdition === 'player'
  const baseId = useId()

  const availableTabs = useMemo(() => {
    const list: Array<{ id: ShareTabId; label: string; Icon: any }> = []
    if (!isPlayerEdition) {
      list.push({ id: 'playerJson', label: 'Player .json', Icon: ShieldCheck })
    }
    list.push(
      { id: 'mergeNotes', label: 'Import Party Notes', Icon: GitMerge },
      { id: 'dossier', label: 'Campaign Dossier', Icon: BookOpen },
      { id: 'png', label: 'Map PNG', Icon: ImageIcon }
    )
    return list
  }, [isPlayerEdition])

  const [activeTab, setActiveTab] = useState<ShareTabId>(
    initialTab || (isPlayerEdition ? 'dossier' : 'playerJson')
  )
  const [dossierScope, setDossierScope] = useState<DossierScope>(
    isPlayerEdition ? 'player' : 'player'
  )
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(
    null
  )

  const tablistRef = useRef<HTMLDivElement>(null)
  const panelRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // Keep activeTab valid when edition or initialTab changes
  useEffect(() => {
    if (!open) return
    setFeedback(null)
    if (initialTab && availableTabs.some((t) => t.id === initialTab)) {
      setActiveTab(initialTab)
    } else if (!availableTabs.some((t) => t.id === activeTab)) {
      setActiveTab(availableTabs[0].id)
    }
  }, [open, initialTab, availableTabs])

  useEffect(() => {
    if (isPlayerEdition && dossierScope !== 'player') {
      setDossierScope('player')
    }
  }, [isPlayerEdition, dossierScope])

  // Scroll selected tab into view inside horizontal tablist & wire focusgroup fallback
  useEffect(() => {
    const tablist = tablistRef.current
    if (!tablist || !open) return

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
      const targetTab = availableTabs[nextIdx]
      if (targetTab) {
        setActiveTab(targetTab.id)
        buttons[nextIdx]?.focus()
      }
    }

    tablist.addEventListener('keydown', onKeyDown)
    return () => tablist.removeEventListener('keydown', onKeyDown)
  }, [activeTab, availableTabs, open])

  // Sync hidden="until-found" beforematch events so Find-in-Page switches to the matched tab
  useEffect(() => {
    const cleanups: Array<() => void> = []
    for (const tab of availableTabs) {
      const el = panelRefs.current[tab.id]
      if (!el) continue
      const onBeforeMatch = () => setActiveTab(tab.id)
      el.addEventListener('beforematch', onBeforeMatch)
      cleanups.push(() => el.removeEventListener('beforematch', onBeforeMatch))
    }
    return () => cleanups.forEach((fn) => fn())
  }, [availableTabs])

  const sanitizeStats = useMemo(
    () => computeSanitizeStats({ nodes, edges, snapshots }),
    [nodes, edges, snapshots]
  )

  const buildDossierSource = () => ({
    campaignTitle,
    canvasTheme,
    nodes,
    edges,
    connectionPresets,
    customEntityTypes,
    snapshots,
    cameraBookmarks
  })

  const handleExportPlayerJson = async () => {
    setBusyAction('playerJson')
    setFeedback(null)
    try {
      const json = serializePlayerHandoutCampaign(buildDossierSource())
      const res = await window.api.savePlayerJson(json, campaignTitle)
      if (res.success) {
        setFeedback({
          kind: 'success',
          text: `Saved Spoiler-Free Player .json (${sanitizeStats.publicNodes} entities, ${sanitizeStats.publicEdges} connections). Your active DM file path is unchanged.`
        })
      } else if (res.error) {
        setFeedback({ kind: 'error', text: `Export failed: ${res.error}` })
      }
    } catch (err: any) {
      setFeedback({ kind: 'error', text: err?.message || 'Export failed.' })
    } finally {
      setBusyAction(null)
    }
  }

  const handleMergePartyNotes = async () => {
    setBusyAction('mergeNotes')
    setFeedback(null)
    try {
      const res = await window.api.importPartyNotesFile()
      if (res.canceled || !res.data) {
        setBusyAction(null)
        return
      }
      const parsed = JSON.parse(res.data)
      const stats = importPartyNotes(parsed)
      const totalChanges =
        stats.updatedEntityNotes +
        stats.updatedEdgeNotes +
        stats.addedTheoryNodes +
        stats.addedTheoryEdges

      if (totalChanges === 0) {
        setFeedback({
          kind: 'success',
          text: 'No new Party Notes or Theory Pins were found to merge (everything is already up to date).'
        })
      } else {
        setFeedback({
          kind: 'success',
          text: `Merged ${stats.updatedEntityNotes} entity note(s), ${stats.updatedEdgeNotes} connection note(s), ${stats.addedTheoryNodes} Theory Pin(s), and ${stats.addedTheoryEdges} Theory Link(s). (Press Ctrl+Z anytime to undo.)`
        })
      }
    } catch (err: any) {
      setFeedback({
        kind: 'error',
        text: `Could not read campaign JSON: ${err?.message || 'Invalid file format'}`
      })
    } finally {
      setBusyAction(null)
    }
  }

  const effectiveScope: DossierScope = isPlayerEdition ? 'player' : dossierScope

  const handleExportMarkdown = async () => {
    setBusyAction('md')
    setFeedback(null)
    try {
      const md = generateMarkdownDossier(buildDossierSource(), effectiveScope)
      const suffix = effectiveScope === 'player' ? 'Player Dossier' : 'DM Campaign Bible'
      const res = await window.api.saveMarkdownDossier(md, `${campaignTitle || 'Campaign'} - ${suffix}`)
      if (res.success) {
        setFeedback({ kind: 'success', text: 'Saved Markdown Campaign Dossier (.md).' })
      } else if (res.error) {
        setFeedback({ kind: 'error', text: `Markdown export failed: ${res.error}` })
      }
    } catch (err: any) {
      setFeedback({ kind: 'error', text: err?.message || 'Markdown export failed.' })
    } finally {
      setBusyAction(null)
    }
  }

  const handleExportObsidian = async () => {
    setBusyAction('obsidian')
    setFeedback(null)
    try {
      const entries = generateObsidianVaultEntries(buildDossierSource(), effectiveScope)
      const suffix = effectiveScope === 'player' ? 'Player Vault' : 'DM Vault'
      const res = await window.api.exportObsidianVault(
        `${campaignTitle || 'Campaign'} - ${suffix}`,
        entries
      )
      if (res.success) {
        setFeedback({
          kind: 'success',
          text: `Exported Obsidian Vault (${res.fileCount} files including _Campaign Index.md & assets) to ${res.folderPath}`
        })
      } else if (res.error) {
        setFeedback({ kind: 'error', text: `Obsidian export failed: ${res.error}` })
      }
    } catch (err: any) {
      setFeedback({ kind: 'error', text: err?.message || 'Obsidian export failed.' })
    } finally {
      setBusyAction(null)
    }
  }

  const handleExportPdf = async () => {
    setBusyAction('pdf')
    setFeedback(null)
    try {
      const html = generatePdfDossierHtml(buildDossierSource(), effectiveScope)
      const suffix = effectiveScope === 'player' ? 'Player Handout' : 'DM Campaign Bible'
      const res = await window.api.savePdfDossier(html, `${campaignTitle || 'Campaign'} - ${suffix}`)
      if (res.success) {
        setFeedback({ kind: 'success', text: 'Saved formatted PDF Campaign Handout (.pdf).' })
      } else if (res.error) {
        setFeedback({ kind: 'error', text: `PDF export failed: ${res.error}` })
      }
    } catch (err: any) {
      setFeedback({ kind: 'error', text: err?.message || 'PDF export failed.' })
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <NativeModal
      open={open}
      onClose={onClose}
      title="Share, Sync & Export Campaign"
      maxWidthClass="max-w-xl"
    >
      <div className="flex flex-col gap-4">
        {/* Single-row accessible tablist */}
        <div
          ref={tablistRef}
          {...({ focusgroup: 'tablist nomemory' } as any)}
          aria-label="Share and export sections"
          className="share-tablist border-b border-slate-200 dark:border-slate-700 gap-1"
        >
          {availableTabs.map((tab) => {
            const isSelected = activeTab === tab.id
            const Icon = tab.Icon
            return (
              <button
                key={tab.id}
                type="button"
                id={`${baseId}-tab-${tab.id}`}
                aria-selected={isSelected}
                {...(isSelected ? ({ focusgroupstart: '' } as any) : {})}
                onClick={() => {
                  setActiveTab(tab.id)
                  setFeedback(null)
                }}
                className="share-tab px-3 py-2.5 text-xs font-semibold flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-t"
              >
                <Icon size={14} aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* Polite status banner */}
        <div aria-live="polite" className=" empty:hidden">
          {feedback && (
            <div
              className={`p-3 rounded-lg border text-xs font-medium flex items-start gap-2 ${
                feedback.kind === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                  : 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200'
              }`}
            >
              {feedback.kind === 'success' ? (
                <CheckCircle2 size={15} className="shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              ) : (
                <AlertCircle size={15} className="shrink-0 mt-0.5 text-red-600 dark:text-red-400" aria-hidden="true" />
              )}
              <span className="leading-relaxed break-words">{feedback.text}</span>
            </div>
          )}
        </div>

        {/* Tab Panels (grid-stacked; padding lives on child wrappers so hidden="until-found" leaves zero layout footprint) */}
        <div className="share-tabpanels">
          {!isPlayerEdition && (
            <div
              ref={(el) => {
                panelRefs.current.playerJson = el
              }}
              role="tabpanel"
              aria-labelledby={`${baseId}-tab-playerJson`}
              hidden={activeTab !== 'playerJson' ? ('until-found' as any) : undefined}
            >
              <div className="flex flex-col gap-4 pt-1">
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Export a <strong>Spoiler-Free Player Conspiracy Edition (.json)</strong> file to
                  send to your group. Players can explore known lore, add their own{' '}
                  <strong>Party Notes</strong>, and pin <strong>Theory Cards</strong> — with zero DM
                  secrets inside the file.
                </p>

                <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 text-xs">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                      Included for Players
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">
                      • {sanitizeStats.publicNodes} Public Entities
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">
                      • {sanitizeStats.publicEdges} Public Connections
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">
                      • {sanitizeStats.publicSnapshots} Public Session Checkpoints
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                      Physically Stripped
                    </span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      • {sanitizeStats.strippedNodes} Hidden Entities
                    </span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      • {sanitizeStats.strippedEdges} Hidden Connections
                    </span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      • {sanitizeStats.strippedSecretNotes} DM Secret / Voice Notes &amp; Stats
                    </span>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={handleExportPlayerJson}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <ShieldCheck size={15} aria-hidden="true" />
                    <span>
                      {busyAction === 'playerJson'
                        ? 'Exporting...'
                        : 'Export Spoiler-Free Player .json'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Import / Merge Party Notes */}
          <div
            ref={(el) => {
              panelRefs.current.mergeNotes = el
            }}
            role="tabpanel"
            aria-labelledby={`${baseId}-tab-mergeNotes`}
            hidden={activeTab !== 'mergeNotes' ? ('until-found' as any) : undefined}
          >
            <div className="flex flex-col gap-4 pt-1">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Keep player conspiracy notes alive across weekly sessions! Select any previous{' '}
                <strong>Player .json</strong> file to merge its <strong>Party Notes</strong>,{' '}
                <strong>Theory Pins</strong>, and <strong>Theory Links</strong> into your currently
                open map.
              </p>

              <div className="p-3 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 text-xs text-indigo-950 dark:text-indigo-200 flex flex-col gap-1.5">
                <div className="font-bold">Works in both directions:</div>
                <div>
                  • <strong>Players:</strong> Open the DM&apos;s newly posted weekly map, then import
                  your previous session&apos;s file so none of your notes or theories are lost.
                </div>
                <div>
                  • <strong>DMs:</strong> Import a player&apos;s file into your master campaign map to
                  view their theories without touching your hidden entities or DM secrets.
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={handleMergePartyNotes}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <GitMerge size={15} aria-hidden="true" />
                  <span>
                    {busyAction === 'mergeNotes'
                      ? 'Merging...'
                      : 'Select .json to Merge Party Notes'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Tab 3: Campaign Dossier (.md / Obsidian / .pdf) */}
          <div
            ref={(el) => {
              panelRefs.current.dossier = el
            }}
            role="tabpanel"
            aria-labelledby={`${baseId}-tab-dossier`}
            hidden={activeTab !== 'dossier' ? ('until-found' as any) : undefined}
          >
            <div className="flex flex-col gap-4 pt-1">
              {!isPlayerEdition ? (
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Audience Scope
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDossierScope('player')}
                      className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                        dossierScope === 'player'
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/35 text-emerald-900 dark:text-emerald-200'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/40'
                      }`}
                    >
                      <div className="text-xs font-bold">Player Handout (Spoiler-Free)</div>
                      <div className="text-[11px] opacity-80">
                        Public lore, tags, relationships &amp; party notes only
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDossierScope('dm')}
                      className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                        dossierScope === 'dm'
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/35 text-amber-900 dark:text-amber-200'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/40'
                      }`}
                    >
                      <div className="text-xs font-bold">Full DM Campaign Bible</div>
                      <div className="text-[11px] opacity-80">
                        Includes hidden entities, DM secrets, voice cues &amp; stats
                      </div>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                  Exporting in Spoiler-Free Player Edition (includes Public Lore &amp; Party Notes).
                </div>
              )}

              <div className="grid grid-cols-1 gap-2.5">
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={handleExportMarkdown}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-slate-50 dark:hover:bg-slate-700/40 flex items-center justify-between gap-3 text-left transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                      <FileText size={18} aria-hidden="true" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        Single-File Markdown Dossier (.md)
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Clean summary grouped by entity type with relationships &amp; session recaps
                        for Discord, Notion, or Docs.
                      </div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-blue-600 text-white text-[11px] font-bold shrink-0">
                    {busyAction === 'md' ? 'Saving...' : 'Export .md'}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={handleExportObsidian}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-purple-400 dark:hover:border-purple-500 hover:bg-slate-50 dark:hover:bg-slate-700/40 flex items-center justify-between gap-3 text-left transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                      <FolderGit2 size={18} aria-hidden="true" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        Obsidian Vault Folder (*.md + YAML + assets/)
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        One note per entity with YAML frontmatter, portrait images, and{' '}
                        <code>[[Wiki-Links]]</code> ready for Obsidian Graph View.
                      </div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-purple-600 text-white text-[11px] font-bold shrink-0">
                    {busyAction === 'obsidian' ? 'Exporting...' : 'Export Vault'}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={handleExportPdf}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-amber-400 dark:hover:border-amber-500 hover:bg-slate-50 dark:hover:bg-slate-700/40 flex items-center justify-between gap-3 text-left transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300">
                      <Printer size={18} aria-hidden="true" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        Formatted Tabletop Handout (.pdf)
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Print-ready packet with portraits, standing chips, and relationship tables
                        generated offline.
                      </div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-amber-600 text-white text-[11px] font-bold shrink-0">
                    {busyAction === 'pdf' ? 'Rendering...' : 'Export .pdf'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Tab 4: Map Image (.png) */}
          <div
            ref={(el) => {
              panelRefs.current.png = el
            }}
            role="tabpanel"
            aria-labelledby={`${baseId}-tab-png`}
            hidden={activeTab !== 'png' ? ('until-found' as any) : undefined}
          >
            <div className="flex flex-col gap-4 pt-1">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Framing Area
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setExportArea('full')}
                    className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                      exportArea === 'full'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    <div className="text-xs font-bold">Entire Map</div>
                    <div className="text-[11px] opacity-75">Auto-fits all visible entities</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportArea('current')}
                    className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                      exportArea === 'current'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    <div className="text-xs font-bold">Current View</div>
                    <div className="text-[11px] opacity-75">Exact zoom &amp; crop on screen</div>
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={exportIncludeLegend}
                    onChange={(e) => setExportIncludeLegend(e.target.checked)}
                    className="rounded accent-blue-600"
                  />
                  Include Map Legend in corner
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={exportIncludeTitle}
                    onChange={(e) => setExportIncludeTitle(e.target.checked)}
                    className="rounded accent-blue-600"
                  />
                  Include Campaign Title header
                </label>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between">
                  <label
                    htmlFor={`${baseId}-png-dpi`}
                    className="text-xs font-semibold text-slate-600 dark:text-slate-300"
                  >
                    Resolution / DPI Multiplier
                  </label>
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                    {exportScale}x
                  </span>
                </div>
                <input
                  id={`${baseId}-png-dpi`}
                  type="range"
                  min="1"
                  max="4"
                  step="1"
                  value={exportScale}
                  onChange={(e) => setExportScale(parseInt(e.target.value, 10))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>1x (Standard)</span>
                  <span>2x (Sharp)</span>
                  <span>3x (Print)</span>
                  <span>4x (Ultra)</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-1.5 rounded-md text-xs font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={isExportingPng}
                  onClick={() => {
                    onClose()
                    onTriggerExportPng()
                  }}
                  className="px-4 py-1.5 rounded-md text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 cursor-pointer"
                >
                  {isExportingPng ? 'Rendering...' : 'Save Map PNG'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </NativeModal>
  )
}
