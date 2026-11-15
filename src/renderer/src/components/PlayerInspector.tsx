import { useState } from 'react'
import { DndEdge, DndNode, FieldDiffEntry } from '../types'
import { RichLoreView, WikiLinkTextarea } from './RichLoreView'
import ConnectionsBacklinksSection from './ConnectionsBacklinksSection'
import {
  X,
  ArrowRight,
  Lock,
  Globe,
  MessageSquareText,
  Eye,
  Edit3,
  GitCompareArrows,
  FolderKanban,
  Tag
} from 'lucide-react'
import { availableIcons, getIconColor } from '../utils/icons'

interface PlayerInspectorProps {
  selectedNode?: DndNode
  selectedEdge?: DndEdge
  allNodes: DndNode[]
  allEdges?: DndEdge[]
  isPlayerView: boolean
  isSnapshotPreview?: boolean
  diffEntries?: FieldDiffEntry[]
  diffCompareLabel?: string
  editablePartyNotes?: boolean
  onUpdateNodePartyNotes?: (nodeId: string, notes: string) => void
  onUpdateEdgePartyNotes?: (edgeId: string, notes: string) => void
  onCommitPartyNotesStart?: () => void
  onFilterByTag?: (tag: string) => void
  onSelectEdge?: (edgeId: string) => void
  onClose: () => void
  onNavigateToNode: (nodeId: string) => void
}

function DiffBreakdownCard({
  diffStatus,
  diffEntries = [],
  compareLabel = 'Live Map'
}: {
  diffStatus?: 'added' | 'modified' | 'removed' | null
  diffEntries?: FieldDiffEntry[]
  compareLabel?: string
}) {
  if (!diffStatus) return null

  if (diffStatus === 'added') {
    return (
      <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700/70 text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2 font-semibold">
        <GitCompareArrows size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span>New in {compareLabel} (did not exist in this checkpoint).</span>
      </div>
    )
  }

  if (diffStatus === 'removed') {
    return (
      <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-700/70 text-xs text-rose-900 dark:text-rose-200 flex items-center gap-2 font-semibold">
        <GitCompareArrows size={14} className="text-rose-600 dark:text-rose-400 shrink-0" />
        <span>Removed in {compareLabel} (present only in this earlier checkpoint).</span>
      </div>
    )
  }

  return (
    <div className="p-3 rounded-lg bg-amber-50/90 dark:bg-amber-950/35 border border-amber-300 dark:border-amber-700/70 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
          <GitCompareArrows size={13} className="text-amber-600 dark:text-amber-400 shrink-0" />
          Changes vs. {compareLabel}
        </span>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-200/70 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200">
          {diffEntries.length} {diffEntries.length === 1 ? 'field' : 'fields'}
        </span>
      </div>

      {diffEntries.length === 0 ? (
        <p className="text-xs text-amber-800 dark:text-amber-200/90">
          Updated since this checkpoint.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {diffEntries.map((entry, idx) => (
            <div
              key={`${entry.field}-${idx}`}
              className="p-2 rounded bg-white/85 dark:bg-slate-900/80 border border-amber-200/80 dark:border-amber-800/60 text-xs flex flex-col gap-0.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {entry.field}
                </span>
                {entry.isDmOnly && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-700 dark:text-amber-300">
                    <Lock size={9} /> DM
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="line-through text-rose-600 dark:text-rose-400 break-words">
                  {entry.before}
                </span>
                <ArrowRight size={11} className="text-slate-400 shrink-0" />
                <span className="font-semibold text-emerald-700 dark:text-emerald-300 break-words">
                  {entry.after}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function PlayerInspector({
  selectedNode,
  selectedEdge,
  allNodes,
  allEdges,
  isPlayerView,
  isSnapshotPreview = false,
  diffEntries,
  diffCompareLabel,
  editablePartyNotes = false,
  onUpdateNodePartyNotes,
  onUpdateEdgePartyNotes,
  onCommitPartyNotesStart,
  onFilterByTag,
  onSelectEdge,
  onClose,
  onNavigateToNode
}: PlayerInspectorProps) {
  const [previewPartyLinks, setPreviewPartyLinks] = useState(false)

  if (!selectedNode && !selectedEdge) return null

  if (selectedEdge) {
    const data = selectedEdge.data || {}
    const sourceNode = allNodes.find((n) => n.id === selectedEdge.source)
    const targetNode = allNodes.find((n) => n.id === selectedEdge.target)
    const publicText = data.publicNotes || ''
    const partyText = data.partyNotes || ''
    const dmText = !isPlayerView ? data.dmNotes || '' : ''

    return (
      <aside className="no-export absolute right-0 top-0 h-full w-84 bg-white dark:bg-slate-800 shadow-2xl border-l border-slate-200 dark:border-slate-700 z-20 flex flex-col pointer-events-auto">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              {isSnapshotPreview ? 'Snapshot Connection' : 'Relationship'}
            </span>
            <h2 className="font-bold text-base text-slate-800 dark:text-slate-100">
              {data.label || 'Connection'}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close inspector"
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-4 overflow-y-auto overscroll-contain [scrollbar-gutter:stable] min-h-0 flex-1 [&>*]:shrink-0">
          <DiffBreakdownCard
            diffStatus={data.diffStatus}
            diffEntries={diffEntries}
            compareLabel={diffCompareLabel}
          />

          <div className="text-xs text-slate-700 dark:text-slate-200 flex items-center justify-between gap-2 bg-slate-100 dark:bg-slate-700/70 p-2.5 rounded-md border border-slate-200 dark:border-slate-600">
            {sourceNode ? (
              <button
                type="button"
                onClick={() => onNavigateToNode(sourceNode.id)}
                className="font-semibold text-blue-600 dark:text-blue-400 hover:underline truncate cursor-pointer"
              >
                {sourceNode.data.label}
              </button>
            ) : (
              <span className="font-semibold truncate">Entity</span>
            )}
            <ArrowRight size={14} className="shrink-0 text-slate-400" />
            {targetNode ? (
              <button
                type="button"
                onClick={() => onNavigateToNode(targetNode.id)}
                className="font-semibold text-blue-600 dark:text-blue-400 hover:underline truncate cursor-pointer"
              >
                {targetNode.data.label}
              </button>
            ) : (
              <span className="font-semibold truncate">Entity</span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Globe size={12} /> Known Details
            </span>
            <RichLoreView
              text={publicText}
              nodes={allNodes}
              isPlayerView={isPlayerView}
              onNavigateToNode={onNavigateToNode}
              emptyText="No public details recorded for this relationship."
            />
          </div>

          {/* Party Notes & Theories */}
          {(editablePartyNotes || partyText.trim()) && (
            <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-indigo-800 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                  <MessageSquareText size={12} /> Party Notes & Theories
                </span>
                {editablePartyNotes && (
                  <button
                    type="button"
                    onClick={() => setPreviewPartyLinks((v) => !v)}
                    className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {previewPartyLinks ? <Edit3 size={11} /> : <Eye size={11} />}
                    <span>{previewPartyLinks ? 'Edit' : 'Preview [[Links]]'}</span>
                  </button>
                )}
              </div>
              {editablePartyNotes && !previewPartyLinks ? (
                <WikiLinkTextarea
                  rows={3}
                  placeholder="Add your party's clues, suspicions, or [[Entity]] links..."
                  value={partyText}
                  nodes={allNodes}
                  hideSecrets={isPlayerView}
                  onCommitStart={() => onCommitPartyNotesStart?.()}
                  onChange={(val) => onUpdateEdgePartyNotes?.(selectedEdge.id, val)}
                />
              ) : (
                <RichLoreView
                  text={partyText}
                  nodes={allNodes}
                  isPlayerView={isPlayerView}
                  onNavigateToNode={onNavigateToNode}
                  emptyText="No party notes recorded yet."
                />
              )}
            </div>
          )}

          {!isPlayerView && dmText && (
            <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60">
              <span className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                <Lock size={12} /> DM Secrets
              </span>
              <RichLoreView
                text={dmText}
                nodes={allNodes}
                isPlayerView={false}
                onNavigateToNode={onNavigateToNode}
              />
            </div>
          )}
        </div>
      </aside>
    )
  }

  const node = selectedNode!
  const data = node.data
  const f = data.dndFields || {}
  const publicText = data.publicNotes ?? data.description ?? ''
  const partyText = data.partyNotes || ''
  const dmText = !isPlayerView ? data.dmNotes || '' : ''
  const isGroupNode = node.type === 'groupRegion' || Boolean(data.isGroup)
  const groupMembers = isGroupNode
    ? allNodes.filter(
        (m) =>
          m.data?.groupId === node.id &&
          m.type !== 'groupRegion' &&
          !m.data?.isGroup &&
          (!isPlayerView || !m.data?.isHidden)
      )
    : []
  const parentGroup =
    !isGroupNode && data.groupId
      ? allNodes.find(
          (g) =>
            g.id === data.groupId &&
            (g.type === 'groupRegion' || g.data?.isGroup) &&
            (!isPlayerView || !g.data?.isHidden)
        )
      : undefined
  const legacyStatusIconMap: Record<string, string> = {
    skull: 'Skull',
    flame: 'Flame',
    crown: 'Crown',
    shield: 'Shield'
  }

  // Gather public-safe D&D chips
  const detailChips: Array<{ label: string; value: string }> = []
  if (f.ancestry) detailChips.push({ label: 'Ancestry', value: f.ancestry })
  if (f.classOrRole) detailChips.push({ label: 'Role', value: f.classOrRole })
  if (f.faction) detailChips.push({ label: 'Faction', value: f.faction })
  if (f.disposition) detailChips.push({ label: 'Standing', value: f.disposition })
  if (!isPlayerView && f.alignment) detailChips.push({ label: 'Alignment', value: f.alignment })
  if (f.region) detailChips.push({ label: 'Region', value: f.region })
  if (f.locationType) detailChips.push({ label: 'Type', value: f.locationType })
  if (!isPlayerView && f.dangerTier) detailChips.push({ label: 'Danger', value: f.dangerTier })
  if (f.rarity) detailChips.push({ label: 'Rarity', value: f.rarity })
  if (f.attunement) detailChips.push({ label: 'Attunement', value: 'Required' })
  if (f.holder) detailChips.push({ label: 'Holder', value: f.holder })
  if (f.influence) detailChips.push({ label: 'Influence', value: f.influence })
  if (f.headquarters) detailChips.push({ label: 'HQ', value: f.headquarters })
  if (f.goal) detailChips.push({ label: 'Objective', value: f.goal })
  if (f.questStatus) detailChips.push({ label: 'Status', value: f.questStatus })
  if (f.sessionDate) detailChips.push({ label: 'Session', value: f.sessionDate })

  return (
    <aside className="no-export absolute right-0 top-0 h-full w-84 bg-white dark:bg-slate-800 shadow-2xl border-l border-slate-200 dark:border-slate-700 z-20 flex flex-col pointer-events-auto">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-start bg-slate-50 dark:bg-slate-900">
        <div className="min-w-0 pr-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            {node.type === 'groupRegion' || data.isGroup ? 'Group / Region' : data.entityType}
            {isSnapshotPreview ? ' • Snapshot View' : ''}
          </span>
          <h2 className="font-bold text-lg text-slate-800 dark:text-slate-100 leading-tight break-words">
            {data.label || 'Unnamed Entity'}
          </h2>
          {data.groupSubtitle && (
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-0.5 break-words">
              {data.groupSubtitle}
            </p>
          )}
          {(data.aliases || []).length > 0 && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 break-words">
              Also known as: {(data.aliases || []).join(' · ')}
            </p>
          )}
        </div>
        <button
          type="button"
          aria-label="Close inspector"
          className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0 cursor-pointer"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>

      <div className="p-4 flex flex-col gap-4 overflow-y-auto overscroll-contain [scrollbar-gutter:stable] min-h-0 flex-1 [&>*]:shrink-0">
        <DiffBreakdownCard
          diffStatus={data.diffStatus}
          diffEntries={diffEntries}
          compareLabel={diffCompareLabel}
        />

        {parentGroup && (
          <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-xs">
            <span className="text-slate-600 dark:text-slate-300 flex items-center gap-1.5 font-medium">
              <FolderKanban size={12} className="text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Group:</span>
            </span>
            <button
              type="button"
              onClick={() => onNavigateToNode(parentGroup.id)}
              className="font-bold text-amber-800 dark:text-amber-200 hover:underline truncate cursor-pointer"
            >
              {parentGroup.data.label}
            </button>
          </div>
        )}

        {(data.statusIcons || []).length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {(data.statusIcons || []).map((s) => {
              const mapped = legacyStatusIconMap[s] || s
              const SIcon = availableIcons[mapped] || availableIcons.Component
              return (
                <span
                  key={s}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200"
                >
                  <SIcon size={12} className={getIconColor(mapped)} />
                  <span>{mapped}</span>
                </span>
              )
            })}
          </div>
        )}

        {(data.tags || []).length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            {(data.tags || []).map((tg) =>
              onFilterByTag ? (
                <button
                  key={tg}
                  type="button"
                  onClick={() => onFilterByTag(tg)}
                  title={`Filter canvas by #${tg}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-950/60 hover:bg-violet-100 dark:hover:bg-violet-900/70 border border-violet-200 dark:border-violet-800/60 text-violet-800 dark:text-violet-200 text-[11px] font-semibold cursor-pointer"
                >
                  <Tag size={10} /> #{tg}
                </button>
              ) : (
                <span
                  key={tg}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-950/60 border border-violet-200 dark:border-violet-800/60 text-violet-800 dark:text-violet-200 text-[11px] font-semibold"
                >
                  <Tag size={10} /> #{tg}
                </span>
              )
            )}
          </div>
        )}

        {data.portrait && (
          <div className="w-full rounded-lg overflow-clip shrink-0 border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 max-h-52 flex items-center justify-center">
            <img
              src={data.portrait}
              alt={data.label || 'Entity portrait'}
              className="w-full max-h-52 object-contain"
            />
          </div>
        )}

        {data.stats && !isPlayerView && (
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Quick Stats
            </span>
            <p className="text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700/70 px-2.5 py-2 rounded border border-slate-200 dark:border-slate-600">
              {data.stats}
            </p>
          </div>
        )}

        {detailChips.length > 0 && (
          <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
            {detailChips.map((chip) => (
              <div key={chip.label} className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  {chip.label}
                </span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 break-words">
                  {chip.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {isGroupNode && groupMembers.length > 0 && (
          <div className="flex flex-col gap-1.5 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <FolderKanban size={12} className="text-amber-600 dark:text-amber-400" />
              <span>Entities in Group ({groupMembers.length})</span>
            </span>
            <div className="flex flex-wrap gap-1.5">
              {groupMembers.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onNavigateToNode(m.id)}
                  title={`Inspect ${m.data.label}`}
                  className="px-2 py-1 rounded-md bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/35 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline transition-colors cursor-pointer"
                >
                  {m.data.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Globe size={12} /> Lore &amp; Notes
          </span>
          <RichLoreView
            text={publicText}
            nodes={allNodes}
            isPlayerView={isPlayerView}
            onNavigateToNode={onNavigateToNode}
            emptyText="No known lore available yet."
          />
        </div>

        {/* Party Notes & Theories */}
        {(editablePartyNotes || partyText.trim()) && (
          <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-indigo-800 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquareText size={12} /> Party Notes &amp; Theories
              </span>
              {editablePartyNotes && (
                <button
                  type="button"
                  onClick={() => setPreviewPartyLinks((v) => !v)}
                  className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {previewPartyLinks ? <Edit3 size={11} /> : <Eye size={11} />}
                  <span>{previewPartyLinks ? 'Edit' : 'Preview [[Links]]'}</span>
                </button>
              )}
            </div>
            {editablePartyNotes && !previewPartyLinks ? (
              <WikiLinkTextarea
                rows={4}
                placeholder="Write your party's notes, clues, or theories here (type [[ to link entities)..."
                value={partyText}
                nodes={allNodes}
                hideSecrets={isPlayerView}
                onCommitStart={() => onCommitPartyNotesStart?.()}
                onChange={(val) => onUpdateNodePartyNotes?.(node.id, val)}
              />
            ) : (
              <RichLoreView
                text={partyText}
                nodes={allNodes}
                isPlayerView={isPlayerView}
                onNavigateToNode={onNavigateToNode}
                emptyText="No party notes recorded yet."
              />
            )}
          </div>
        )}

        {!isPlayerView && (dmText || f.voiceCue) && (
          <div className="flex flex-col gap-2 p-3 rounded-lg bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60">
            <span className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
              <Lock size={12} /> DM Secrets (Hidden in Player View)
            </span>
            {f.voiceCue && (
              <p className="text-xs text-amber-900 dark:text-amber-200 bg-amber-100/70 dark:bg-amber-900/40 px-2 py-1 rounded">
                <strong>Voice / Mannerism:</strong> {f.voiceCue}
              </p>
            )}
            {dmText && (
              <RichLoreView
                text={dmText}
                nodes={allNodes}
                isPlayerView={false}
                onNavigateToNode={onNavigateToNode}
              />
            )}
          </div>
        )}

        {allEdges && (
          <ConnectionsBacklinksSection
            nodeId={node.id}
            nodes={allNodes}
            edges={allEdges}
            hideSecrets={isPlayerView}
            onNavigateToNode={onNavigateToNode}
            onSelectEdge={onSelectEdge}
          />
        )}
      </div>
    </aside>
  )
}
