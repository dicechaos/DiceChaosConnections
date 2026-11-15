import { useMemo } from 'react'
import { DndEdge, DndNode } from '../types'
import { computeEntityConnectionsAndBacklinks } from '../utils/wikiLinks'
import { ChevronRight, EyeOff, Link2, GitBranch, Lock, Globe, MessageSquareText } from 'lucide-react'

interface ConnectionsBacklinksSectionProps {
  nodeId: string
  nodes: DndNode[]
  edges: DndEdge[]
  hideSecrets: boolean
  hideTopBorder?: boolean
  defaultOpenEmpty?: boolean
  onNavigateToNode: (nodeId: string) => void
  onSelectEdge?: (edgeId: string) => void
}

export default function ConnectionsBacklinksSection({
  nodeId,
  nodes,
  edges,
  hideSecrets,
  hideTopBorder = false,
  defaultOpenEmpty = false,
  onNavigateToNode,
  onSelectEdge
}: ConnectionsBacklinksSectionProps) {
  const { connections, backlinks } = useMemo(
    () => computeEntityConnectionsAndBacklinks(nodeId, nodes, edges, hideSecrets),
    [nodeId, nodes, edges, hideSecrets]
  )

  return (
    <div
      className={`flex flex-col gap-2 ${
        hideTopBorder ? '' : 'pt-2 border-t border-slate-200 dark:border-slate-700'
      }`}
    >
      {/* Direct Graph Connections Accordion */}
      <details
        open={defaultOpenEmpty || connections.length > 0}
        className="group rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/50 overflow-clip shrink-0"
      >
        <summary className="list-none [&::-webkit-details-marker]:hidden px-3 py-2 flex items-center justify-between gap-2 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/70 cursor-pointer select-none">
          <span className="flex items-center gap-1.5">
            <ChevronRight
              size={14}
              aria-hidden="true"
              className="text-slate-400 transition-transform duration-150 motion-reduce:transition-none group-open:rotate-90 shrink-0"
            />
            <GitBranch size={12} className="text-blue-500 shrink-0" aria-hidden="true" />
            <span>Direct Connections</span>
          </span>
          <span className="px-1.5 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-700 text-[10px] font-extrabold text-slate-700 dark:text-slate-200">
            {connections.length}
          </span>
        </summary>

        <div className="px-2.5 pb-2.5 pt-1 flex flex-col gap-1.5 border-t border-slate-200/80 dark:border-slate-700/70">
          {connections.length === 0 ? (
            <p className="text-xs italic text-slate-400 dark:text-slate-500 px-1 py-1">
              No direct relationship lines yet.
            </p>
          ) : (
            connections.map((conn) => (
              <div
                key={conn.edgeId}
                className="flex items-center justify-between gap-1.5 p-1.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
              >
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span
                    aria-hidden="true"
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: conn.color }}
                  />
                  {onSelectEdge ? (
                    <button
                      type="button"
                      onClick={() => onSelectEdge(conn.edgeId)}
                      title="Inspect connection line"
                      className="font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-300 truncate max-w-28 cursor-pointer"
                    >
                      {conn.relationLabel}
                    </button>
                  ) : (
                    <span className="font-semibold text-slate-600 dark:text-slate-300 truncate max-w-28">
                      {conn.relationLabel}
                    </span>
                  )}
                  <span className="text-slate-400 font-bold shrink-0" aria-hidden="true">
                    {conn.directionBadge}
                  </span>
                  {conn.neighborNodeId ? (
                    <button
                      type="button"
                      onClick={() => onNavigateToNode(conn.neighborNodeId!)}
                      title={`Jump to ${conn.neighborLabel}`}
                      className="font-bold text-blue-600 dark:text-blue-400 hover:underline truncate cursor-pointer"
                    >
                      {conn.neighborLabel}
                    </button>
                  ) : (
                    <span className="font-semibold text-slate-700 dark:text-slate-200 truncate">
                      {conn.neighborLabel}
                    </span>
                  )}
                </div>
                {!hideSecrets && conn.isHidden && (
                  <span title="Hidden from players" className="text-amber-500 shrink-0">
                    <EyeOff size={11} />
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </details>

      {/* Incoming [[Wiki-Link]] Backlinks Accordion */}
      <details
        open={defaultOpenEmpty || backlinks.length > 0}
        className="group rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/50 overflow-clip shrink-0"
      >
        <summary className="list-none [&::-webkit-details-marker]:hidden px-3 py-2 flex items-center justify-between gap-2 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/70 cursor-pointer select-none">
          <span className="flex items-center gap-1.5">
            <ChevronRight
              size={14}
              aria-hidden="true"
              className="text-slate-400 transition-transform duration-150 motion-reduce:transition-none group-open:rotate-90 shrink-0"
            />
            <Link2 size={12} className="text-indigo-500 shrink-0" aria-hidden="true" />
            <span>Referenced In (Backlinks)</span>
          </span>
          <span className="px-1.5 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-700 text-[10px] font-extrabold text-slate-700 dark:text-slate-200">
            {backlinks.length}
          </span>
        </summary>

        <div className="px-2.5 pb-2.5 pt-1 flex flex-col gap-1.5 border-t border-slate-200/80 dark:border-slate-700/70">
          {backlinks.length === 0 ? (
            <p className="text-xs italic text-slate-400 dark:text-slate-500 px-1 py-1">
              No incoming [[Wiki-Links]] mention this entity yet.
            </p>
          ) : (
            backlinks.map((bl, idx) => (
              <button
                key={`${bl.sourceType}-${bl.id}-${bl.noteScope}-${idx}`}
                type="button"
                onClick={() => {
                  if (bl.sourceType === 'node') {
                    onNavigateToNode(bl.id)
                  } else {
                    onSelectEdge?.(bl.id)
                  }
                }}
                className="p-2 rounded-md bg-white dark:bg-slate-800 hover:bg-blue-50/60 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 text-left flex flex-col gap-1 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400 truncate">
                    {bl.title}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider shrink-0 ${
                      bl.noteScope === 'DM Secret'
                        ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200'
                        : bl.noteScope === 'Party Note'
                          ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-200'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {bl.noteScope === 'DM Secret' ? (
                      <Lock size={9} aria-hidden="true" />
                    ) : bl.noteScope === 'Party Note' ? (
                      <MessageSquareText size={9} aria-hidden="true" />
                    ) : (
                      <Globe size={9} aria-hidden="true" />
                    )}
                    {bl.noteScope}
                  </span>
                </div>
                {bl.subtitle && (
                  <span className="text-[10px] text-slate-400 truncate">{bl.subtitle}</span>
                )}
                <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 leading-snug">
                  {bl.snippet}
                </p>
              </button>
            ))
          )}
        </div>
      </details>
    </div>
  )
}
