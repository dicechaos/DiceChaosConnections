import { useMemo, useState } from 'react'
import {
  User,
  Users,
  MapPin,
  Sword,
  Shield,
  Calendar,
  FolderKanban,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { availableIcons } from '../utils/icons'
import { OTHER_EDGE_FILTER_KEY, resolveEdgeFilterKey } from '../utils/edgeFilters'

function useLegendItems() {
  const { customEntityTypes, connectionPresets } = useStore()

  const defaultItems: Array<{
    type: string
    label: string
    color: string
    lightColor: string
    darkColor: string
    Icon: any
    isCustom: boolean
    borderStyle?: string
  }> = [
    {
      type: 'PC',
      label: 'Player Character',
      color:
        'bg-blue-100 border-blue-600 text-blue-800 dark:bg-blue-950 dark:border-blue-400 dark:text-blue-200',
      lightColor: 'bg-blue-100 border-blue-600 text-blue-800',
      darkColor: 'bg-blue-950 border-blue-400 text-blue-200',
      Icon: User,
      isCustom: false
    },
    {
      type: 'NPC',
      label: 'NPC',
      color:
        'bg-emerald-100 border-emerald-600 text-emerald-800 dark:bg-emerald-950 dark:border-emerald-400 dark:text-emerald-200',
      lightColor: 'bg-emerald-100 border-emerald-600 text-emerald-800',
      darkColor: 'bg-emerald-950 border-emerald-400 text-emerald-200',
      Icon: Users,
      isCustom: false
    },
    {
      type: 'Location',
      label: 'Location',
      color:
        'bg-amber-100 border-amber-600 text-amber-900 dark:bg-amber-950 dark:border-amber-400 dark:text-amber-200',
      lightColor: 'bg-amber-100 border-amber-600 text-amber-900',
      darkColor: 'bg-amber-950 border-amber-400 text-amber-200',
      Icon: MapPin,
      isCustom: false
    },
    {
      type: 'Item',
      label: 'Item',
      color:
        'bg-purple-100 border-purple-600 text-purple-800 dark:bg-purple-950 dark:border-purple-400 dark:text-purple-200',
      lightColor: 'bg-purple-100 border-purple-600 text-purple-800',
      darkColor: 'bg-purple-950 border-purple-400 text-purple-200',
      Icon: Sword,
      isCustom: false
    },
    {
      type: 'Organization',
      label: 'Organization / Faction',
      color:
        'bg-rose-100 border-rose-600 text-rose-800 dark:bg-rose-950 dark:border-rose-400 dark:text-rose-200',
      lightColor: 'bg-rose-100 border-rose-600 text-rose-800',
      darkColor: 'bg-rose-950 border-rose-400 text-rose-200',
      Icon: Shield,
      isCustom: false
    },
    {
      type: 'Event',
      label: 'Event / Quest',
      color:
        'bg-slate-200 border-slate-600 text-slate-800 dark:bg-slate-800 dark:border-slate-400 dark:text-slate-200',
      lightColor: 'bg-slate-200 border-slate-600 text-slate-800',
      darkColor: 'bg-slate-800 border-slate-400 text-slate-200',
      Icon: Calendar,
      isCustom: false
    }
  ]

  const customItems = customEntityTypes.map((t) => ({
    type: t.label,
    label: t.label,
    isCustom: true,
    color: t.color,
    lightColor: '',
    darkColor: '',
    borderStyle: t.borderStyle || 'solid',
    Icon: availableIcons[t.icon] || availableIcons.Component
  }))

  return { items: [...defaultItems, ...customItems], connectionPresets }
}

export default function Legend() {
  const {
    nodes,
    edges,
    snapshots,
    activeSnapshotId,
    isPlayerView,
    isDarkMode,
    visibleTypes,
    toggleTypeVisibility,
    setAllEntityVisibility,
    visibleEdgeTypes,
    toggleEdgeTypeVisibility,
    setAllEdgeVisibility,
    setAllTypesVisibility
  } = useStore()
  const { items, connectionPresets } = useLegendItems()
  const [collapsed, setCollapsed] = useState(false)

  const activeGraph = useMemo(() => {
    if (activeSnapshotId) {
      const snap = snapshots.find((s) => s.id === activeSnapshotId)
      if (snap) return { nodes: snap.nodes, edges: snap.edges }
    }
    return { nodes, edges }
  }, [activeSnapshotId, snapshots, nodes, edges])

  const { entityCounts, edgeCounts, groupCount } = useMemo(() => {
    const entCounts: Record<string, number> = {}
    let grpCount = 0
    for (const n of activeGraph.nodes) {
      if (isPlayerView && n.data?.isHidden) continue
      if (n.type === 'groupRegion' || n.data?.isGroup) {
        grpCount++
        continue
      }
      const t = n.data?.entityType || 'NPC'
      entCounts[t] = (entCounts[t] || 0) + 1
    }

    const edCounts: Record<string, number> = {}
    for (const e of activeGraph.edges) {
      if (isPlayerView && e.data?.isHidden) continue
      const key = resolveEdgeFilterKey(e, connectionPresets)
      edCounts[key] = (edCounts[key] || 0) + 1
    }

    return { entityCounts: entCounts, edgeCounts: edCounts, groupCount: grpCount }
  }, [activeGraph, isPlayerView, connectionPresets])

  const hasOtherEdges = (edgeCounts[OTHER_EDGE_FILTER_KEY] || 0) > 0
  const showGroupsRow = groupCount > 0 || visibleTypes['Group'] === false

  const hiddenFilterCount =
    items.filter((i) => visibleTypes[i.type] === false).length +
    (visibleTypes['Group'] === false ? 1 : 0) +
    connectionPresets.filter((p) => visibleEdgeTypes[p.label] === false).length +
    (visibleEdgeTypes[OTHER_EDGE_FILTER_KEY] === false ? 1 : 0)
  const hasHiddenFilter = hiddenFilterCount > 0

  const allEntitiesChecked = items.every((i) => visibleTypes[i.type] !== false)
  const allEdgesChecked =
    connectionPresets.every((p) => visibleEdgeTypes[p.label] !== false) &&
    (!hasOtherEdges || visibleEdgeTypes[OTHER_EDGE_FILTER_KEY] !== false)

  return (
    <div className="dcc-surface-panel backdrop-blur-md shadow-lg rounded-xl border min-w-[214px] max-w-[238px] overflow-hidden overflow-clip min-h-0 flex flex-col max-h-full">
      <div className="shrink-0 flex items-center justify-between gap-2 px-2.5 py-1.5 border-b border-slate-200/80 dark:border-slate-700/60 bg-slate-50/75 dark:bg-[#0c1326]/75">
        <button
          type="button"
          aria-expanded={!collapsed}
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider hover:text-slate-950 dark:hover:text-white cursor-pointer"
        >
          {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
          <span>Legend &amp; Filters</span>
          {collapsed && hasHiddenFilter && (
            <span className="px-1.5 py-0.2 rounded-full bg-sky-500/20 text-sky-700 dark:text-sky-300 text-[9px] font-bold normal-case tracking-normal">
              {hiddenFilterCount} hidden
            </span>
          )}
        </button>
        {hasHiddenFilter && (
          <button
            type="button"
            onClick={() => setAllTypesVisibility(true)}
            className="text-[10px] font-bold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer shrink-0"
          >
            Reset
          </button>
        )}
      </div>

      {!collapsed && (
        <div className="dcc-scroll-y dcc-scroll-shadow px-2.5 py-2 overflow-y-auto overscroll-contain [scrollbar-gutter:stable] min-h-0 flex-1">
          <div className="flex items-center justify-between mb-1.5">
            <h4 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Entities
            </h4>
            <button
              type="button"
              onClick={() => setAllEntityVisibility(!allEntitiesChecked)}
              className="text-[10px] font-semibold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
            >
              {allEntitiesChecked ? 'Hide All' : 'Show All'}
            </button>
          </div>

          <div className="flex flex-col gap-1.5 mb-2.5">
            {items.map((item) => {
              const count = entityCounts[item.type] || 0
              return (
                <label
                  key={item.type}
                  className="flex items-center justify-between gap-2 cursor-pointer group py-0.2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={`w-5 h-5 rounded border-[1.75px] flex items-center justify-center shrink-0 ${
                        !item.isCustom ? item.color : ''
                      }`}
                      style={
                        item.isCustom
                          ? {
                              borderColor: item.color,
                              backgroundColor: isDarkMode
                                ? `color-mix(in oklab, ${item.color} 26%, #0f172a)`
                                : `color-mix(in oklab, ${item.color} 16%, #ffffff)`,
                              color: isDarkMode
                                ? `color-mix(in oklab, ${item.color} 55%, #ffffff)`
                                : `color-mix(in oklab, ${item.color} 65%, #0f172a)`,
                              borderStyle: item.borderStyle as string
                            }
                          : {}
                      }
                    >
                      <item.Icon size={11} strokeWidth={2.25} />
                    </div>
                    <span className="text-[11.5px] font-medium text-slate-700 dark:text-slate-200 select-none group-hover:text-slate-950 dark:group-hover:text-white truncate">
                      {item.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {count > 0 && (
                      <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                        {count}
                      </span>
                    )}
                    <input
                      type="checkbox"
                      className="rounded text-sky-600 cursor-pointer w-3.5 h-3.5 shrink-0"
                      checked={visibleTypes[item.type] !== false}
                      onChange={() => toggleTypeVisibility(item.type)}
                    />
                  </div>
                </label>
              )
            })}

            {showGroupsRow && (
              <label
                title="Show or hide group boundary frames (entities inside groups stay visible)"
                className="flex items-center justify-between gap-2 pt-1.5 mt-0.5 border-t border-slate-200/70 dark:border-slate-700/60 cursor-pointer group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-5 h-5 rounded border-[1.75px] border-dashed border-amber-600 bg-amber-50 text-amber-800 dark:bg-amber-950/70 dark:border-amber-400 dark:text-amber-200 flex items-center justify-center shrink-0">
                    <FolderKanban size={11} strokeWidth={2.25} />
                  </div>
                  <span className="text-[11.5px] font-medium text-slate-700 dark:text-slate-200 select-none group-hover:text-slate-950 dark:group-hover:text-white truncate">
                    Groups / Regions
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {groupCount > 0 && (
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                      {groupCount}
                    </span>
                  )}
                  <input
                    type="checkbox"
                    className="rounded text-sky-600 cursor-pointer w-3.5 h-3.5 shrink-0"
                    checked={visibleTypes['Group'] !== false}
                    onChange={() => toggleTypeVisibility('Group')}
                  />
                </div>
              </label>
            )}
          </div>

          {(connectionPresets.length > 0 || hasOtherEdges) && (
            <>
              <div className="flex items-center justify-between mb-1.5 pt-2 border-t border-slate-200/80 dark:border-slate-700/60">
                <h4 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Connections
                </h4>
                <button
                  type="button"
                  onClick={() => setAllEdgeVisibility(!allEdgesChecked)}
                  className="text-[10px] font-semibold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                >
                  {allEdgesChecked ? 'Hide All' : 'Show All'}
                </button>
              </div>

              <div className="flex flex-col gap-1.5">
                {connectionPresets.map((preset) => {
                  const dirSymbol =
                    preset.direction === 'forward'
                      ? '→'
                      : preset.direction === 'reverse'
                        ? '←'
                        : preset.direction === 'bidirectional'
                          ? '↔'
                          : ''
                  const count = edgeCounts[preset.label] || 0
                  return (
                    <label
                      key={preset.label}
                      className="flex items-center justify-between gap-2 cursor-pointer group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-4 rounded bg-slate-100/80 dark:bg-[#0a1022]/80 px-1 flex items-center justify-center shrink-0">
                          <div
                            className="w-full"
                            style={{
                              borderTopWidth:
                                preset.lineStyle === 'dotted'
                                  ? Math.max(3, Math.min(preset.thickness || 3, 5))
                                  : Math.max(2, Math.min(preset.thickness || 2, 5)),
                              borderTopStyle: preset.lineStyle,
                              borderTopColor: preset.color
                            }}
                          />
                        </div>
                        <span className="text-[11.5px] font-medium text-slate-700 dark:text-slate-200 select-none group-hover:text-slate-950 dark:group-hover:text-white truncate">
                          {preset.label}
                          {dirSymbol && (
                            <span className="ml-1 text-[10px] font-bold text-slate-500 dark:text-slate-300">
                              {dirSymbol}
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {count > 0 && (
                          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                            {count}
                          </span>
                        )}
                        <input
                          type="checkbox"
                          className="rounded text-sky-600 cursor-pointer w-3.5 h-3.5 shrink-0"
                          checked={visibleEdgeTypes[preset.label] !== false}
                          onChange={() => toggleEdgeTypeVisibility(preset.label)}
                        />
                      </div>
                    </label>
                  )
                })}

                {hasOtherEdges && (
                  <label className="flex items-center justify-between gap-2 cursor-pointer group">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-4 rounded bg-slate-100/80 dark:bg-[#0a1022]/80 px-1 flex items-center justify-center shrink-0">
                        <div
                          className="w-full"
                          style={{
                            borderTopWidth: 2,
                            borderTopStyle: 'solid',
                            borderTopColor: '#94a3b8'
                          }}
                        />
                      </div>
                      <span className="text-[11.5px] font-medium text-slate-700 dark:text-slate-200 select-none group-hover:text-slate-950 dark:group-hover:text-white truncate">
                        Other / Custom
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                        {edgeCounts[OTHER_EDGE_FILTER_KEY]}
                      </span>
                      <input
                        type="checkbox"
                        className="rounded text-sky-600 cursor-pointer w-3.5 h-3.5 shrink-0"
                        checked={visibleEdgeTypes[OTHER_EDGE_FILTER_KEY] !== false}
                        onChange={() => toggleEdgeTypeVisibility(OTHER_EDGE_FILTER_KEY)}
                      />
                    </div>
                  </label>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Clean, non-scrolling Legend stamp rendered inside exported PNG images when requested.
 * Matches the active canvasTheme (Parchment, Corkboard, Arcane, or Modern) rather than UI chrome dark-mode.
 */
export function LegendExportStamp() {
  const {
    nodes,
    edges,
    snapshots,
    activeSnapshotId,
    isPlayerView,
    campaignEdition,
    canvasTheme,
    isDarkMode,
    visibleTypes,
    visibleEdgeTypes
  } = useStore()
  const { items, connectionPresets } = useLegendItems()

  const activeItems = items.filter((i) => visibleTypes[i.type] !== false)
  const activePresets = connectionPresets.filter((p) => visibleEdgeTypes[p.label] !== false)

  const hideSecrets = isPlayerView || campaignEdition === 'player'

  const entityCounts = useMemo(() => {
    const sourceNodes = activeSnapshotId
      ? snapshots.find((s) => s.id === activeSnapshotId)?.nodes || nodes
      : nodes
    const counts: Record<string, number> = {}
    for (const n of sourceNodes) {
      if (hideSecrets && n.data?.isHidden) continue
      const t = n.data?.entityType || 'NPC'
      counts[t] = (counts[t] || 0) + 1
    }
    return counts
  }, [activeSnapshotId, snapshots, nodes, hideSecrets])

  const isStampDark =
    canvasTheme === 'arcane' || (canvasTheme === 'modern' && isDarkMode)

  const containerClasses =
    canvasTheme === 'parchment'
      ? 'bg-[#fbf6ea]/95 border-[#9c7a4c] text-[#2c1d0e] shadow-md'
      : canvasTheme === 'corkboard'
        ? 'bg-[#fffdf7]/95 border-[#8b6b4a] text-slate-900 shadow-md'
        : canvasTheme === 'arcane'
          ? 'bg-[#0f162e]/95 border-indigo-500/50 text-slate-100 shadow-lg'
          : isDarkMode
            ? 'bg-slate-800/95 border-slate-700 text-slate-100 shadow-lg'
            : 'bg-white/95 border-slate-300 text-slate-800 shadow-lg'

  const headerClasses =
    canvasTheme === 'parchment'
      ? 'text-[#5c4023] border-[#cbb28c]'
      : canvasTheme === 'corkboard'
        ? 'text-[#5b422a] border-[#d6c5b3]'
        : canvasTheme === 'arcane'
          ? 'text-indigo-200 border-indigo-500/30'
          : isDarkMode
            ? 'text-slate-300 border-slate-700'
            : 'text-slate-600 border-slate-200'

  const labelClasses =
    canvasTheme === 'parchment'
      ? 'text-[#2c1d0e]'
      : canvasTheme === 'corkboard'
        ? 'text-slate-800'
        : isStampDark
          ? 'text-slate-200'
          : 'text-slate-700'

  const countClasses =
    canvasTheme === 'parchment'
      ? 'text-[#6e4f2d]'
      : canvasTheme === 'corkboard'
        ? 'text-[#6b5035]'
        : isStampDark
          ? 'text-slate-400'
          : 'text-slate-500'

  const swatchPillClasses =
    canvasTheme === 'parchment'
      ? 'bg-[#efe4cc]/90 border border-[#d6c09d]'
      : canvasTheme === 'corkboard'
        ? 'bg-[#f3ece1] border border-[#dfd2c0]'
        : isStampDark
          ? 'bg-slate-900/80 border border-slate-700/70'
          : 'bg-slate-100 border border-slate-200/80'

  // unused variable edges kept in sync if needed
  void edges

  return (
    <div className={`p-3.5 rounded-lg border-2 min-w-[210px] pointer-events-none ${containerClasses}`}>
      <h4 className={`text-[10px] font-bold uppercase tracking-wider mb-2 border-b pb-1 ${headerClasses}`}>
        Map Legend
      </h4>
      <div className="flex flex-col gap-1.5 mb-2.5">
        {activeItems.map((item) => {
          const count = entityCounts[item.type] || 0
          return (
            <div key={item.type} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                    !item.isCustom ? (isStampDark ? item.darkColor : item.lightColor) : ''
                  }`}
                  style={
                    item.isCustom
                      ? {
                          borderColor: item.color,
                          backgroundColor: isStampDark
                            ? `color-mix(in oklab, ${item.color} 26%, #0f172a)`
                            : `color-mix(in oklab, ${item.color} 16%, #ffffff)`,
                          color: isStampDark
                            ? `color-mix(in oklab, ${item.color} 55%, #ffffff)`
                            : `color-mix(in oklab, ${item.color} 68%, #0f172a)`,
                          borderStyle: item.borderStyle as string
                        }
                      : {}
                  }
                >
                  <item.Icon size={11} strokeWidth={2.25} />
                </div>
                <span className={`text-[11px] font-medium ${labelClasses}`}>{item.label}</span>
              </div>
              {count > 0 && (
                <span className={`text-[10px] font-bold tabular-nums ${countClasses}`}>
                  {count}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {activePresets.length > 0 && (
        <>
          <h4 className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 border-t pt-1.5 ${headerClasses}`}>
            Relationships
          </h4>
          <div className="flex flex-col gap-1.5">
            {activePresets.map((preset) => {
              const dirSymbol =
                preset.direction === 'forward'
                  ? '→'
                  : preset.direction === 'reverse'
                    ? '←'
                    : preset.direction === 'bidirectional'
                      ? '↔'
                      : ''
              return (
                <div key={preset.label} className="flex items-center gap-2">
                  <div className={`w-7 h-4 rounded px-1 flex items-center justify-center shrink-0 ${swatchPillClasses}`}>
                    <div
                      className="w-full"
                      style={{
                        borderTopWidth:
                          preset.lineStyle === 'dotted'
                            ? Math.max(3, Math.min(preset.thickness || 3, 5))
                            : Math.max(2, Math.min(preset.thickness || 2, 4)),
                        borderTopStyle: preset.lineStyle,
                        borderTopColor: preset.color
                      }}
                    />
                  </div>
                  <span className={`text-[11px] font-medium ${labelClasses}`}>
                    {preset.label}
                    {dirSymbol && <span className="ml-1 font-bold">{dirSymbol}</span>}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
