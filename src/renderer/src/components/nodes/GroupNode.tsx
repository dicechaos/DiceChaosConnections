import { memo, useEffect } from 'react'
import {
  NodeProps,
  NodeResizer,
  useUpdateNodeInternals
} from '@xyflow/react'
import {
  DndNode,
  GroupHeaderAlign,
  GroupPortraitMode,
  GroupShape,
  GroupTintKey,
  PartyDisposition,
  QuestStatus
} from '../../types'
import { useStore } from '../../store/useStore'
import { hexToRgb, normalizeHexColor } from '../../utils/colorUtils'
import { availableIcons, getIconColor } from '../../utils/icons'
import { resolveNodePerimeterPorts, resolveNodeShapeKey } from '../../utils/graphPipeline'
import { CustomPerimeterHandles } from './CustomPerimeterHandles'
import {
  Compass,
  EyeOff,
  FileText,
  FolderKanban,
  Lock,
  MessageSquareText,
  Unlock
} from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface GroupTintOption {
  key: GroupTintKey
  label: string
  swatchHex: string
  borderHexLight: string
  borderHexDark: string
  fillRgbLight: string
  fillRgbDark: string
  headerBgLight: string
  headerBgDark: string
  headerTextLight: string
  headerTextDark: string
}

export const GROUP_TINT_PALETTE: GroupTintOption[] = [
  {
    key: 'gold',
    label: 'Royal Gold',
    swatchHex: '#d97706',
    borderHexLight: '#b45309',
    borderHexDark: '#f59e0b',
    fillRgbLight: '217, 119, 6',
    fillRgbDark: '245, 158, 11',
    headerBgLight: 'rgba(254, 243, 199, 0.96)',
    headerBgDark: 'rgba(69, 26, 3, 0.94)',
    headerTextLight: '#78350f',
    headerTextDark: '#fde68a'
  },
  {
    key: 'emerald',
    label: 'Woodland Emerald',
    swatchHex: '#059669',
    borderHexLight: '#047857',
    borderHexDark: '#34d399',
    fillRgbLight: '5, 150, 105',
    fillRgbDark: '52, 211, 153',
    headerBgLight: 'rgba(209, 250, 229, 0.96)',
    headerBgDark: 'rgba(6, 46, 36, 0.94)',
    headerTextLight: '#064e3b',
    headerTextDark: '#a7f3d0'
  },
  {
    key: 'blue',
    label: 'Astral Sapphire',
    swatchHex: '#2563eb',
    borderHexLight: '#1d4ed8',
    borderHexDark: '#60a5fa',
    fillRgbLight: '37, 99, 235',
    fillRgbDark: '96, 165, 250',
    headerBgLight: 'rgba(219, 234, 254, 0.96)',
    headerBgDark: 'rgba(15, 32, 68, 0.94)',
    headerTextLight: '#1e3a8a',
    headerTextDark: '#bfdbfe'
  },
  {
    key: 'rose',
    label: 'Warhost Crimson',
    swatchHex: '#e11d48',
    borderHexLight: '#be123c',
    borderHexDark: '#fb7185',
    fillRgbLight: '225, 29, 72',
    fillRgbDark: '251, 113, 133',
    headerBgLight: 'rgba(255, 228, 230, 0.96)',
    headerBgDark: 'rgba(76, 5, 25, 0.94)',
    headerTextLight: '#881337',
    headerTextDark: '#fecdd3'
  },
  {
    key: 'purple',
    label: 'Arcane Amethyst',
    swatchHex: '#7c3aed',
    borderHexLight: '#6d28d9',
    borderHexDark: '#a78bfa',
    fillRgbLight: '124, 58, 237',
    fillRgbDark: '167, 139, 250',
    headerBgLight: 'rgba(237, 233, 254, 0.96)',
    headerBgDark: 'rgba(46, 16, 101, 0.94)',
    headerTextLight: '#4c1d95',
    headerTextDark: '#ddd6fe'
  },
  {
    key: 'amber',
    label: 'Hearth Copper',
    swatchHex: '#ea580c',
    borderHexLight: '#c2410c',
    borderHexDark: '#fb923c',
    fillRgbLight: '234, 88, 12',
    fillRgbDark: '251, 146, 60',
    headerBgLight: 'rgba(255, 237, 213, 0.96)',
    headerBgDark: 'rgba(67, 20, 7, 0.94)',
    headerTextLight: '#7c2d12',
    headerTextDark: '#fed7aa'
  },
  {
    key: 'slate',
    label: 'Stone Bastion',
    swatchHex: '#475569',
    borderHexLight: '#334155',
    borderHexDark: '#94a3b8',
    fillRgbLight: '71, 85, 105',
    fillRgbDark: '148, 163, 184',
    headerBgLight: 'rgba(241, 245, 249, 0.96)',
    headerBgDark: 'rgba(15, 23, 42, 0.94)',
    headerTextLight: '#0f172a',
    headerTextDark: '#e2e8f0'
  }
]

export interface ResolvedGroupTint extends Omit<GroupTintOption, 'key'> {
  key: GroupTintKey | 'custom'
  isCustom: boolean
}

export function getGroupTintMeta(key?: GroupTintKey): GroupTintOption {
  return GROUP_TINT_PALETTE.find((t) => t.key === key) || GROUP_TINT_PALETTE[0]
}

export function resolveGroupTint(
  key?: GroupTintKey,
  customHex?: string
): ResolvedGroupTint {
  const validCustom = normalizeHexColor(customHex)
  const rgb = validCustom ? hexToRgb(validCustom) : null
  if (validCustom && rgb) {
    const rgbStr = `${rgb.r}, ${rgb.g}, ${rgb.b}`
    return {
      key: 'custom',
      isCustom: true,
      label: `Custom (${validCustom.toUpperCase()})`,
      swatchHex: validCustom,
      borderHexLight: `color-mix(in oklab, ${validCustom} 80%, #0f172a)`,
      borderHexDark: `color-mix(in oklab, ${validCustom} 78%, #ffffff)`,
      fillRgbLight: rgbStr,
      fillRgbDark: rgbStr,
      headerBgLight: `color-mix(in oklab, ${validCustom} 20%, #ffffff)`,
      headerBgDark: `color-mix(in oklab, ${validCustom} 30%, #0f172a)`,
      headerTextLight: '#0f172a',
      headerTextDark: '#f8fafc'
    }
  }
  return {
    ...getGroupTintMeta(key),
    isCustom: false
  }
}

const legacyStatusIconMap: Record<string, string> = {
  skull: 'Skull',
  flame: 'Flame',
  crown: 'Crown',
  shield: 'Shield'
}

const groupDispositionMeta: Record<
  PartyDisposition,
  { symbol: string; light: string; dark: string }
> = {
  Allied: {
    symbol: '★',
    light: 'bg-emerald-100/95 text-emerald-900 border-emerald-400',
    dark: 'bg-emerald-950/95 text-emerald-200 border-emerald-500/70'
  },
  Friendly: {
    symbol: '☺',
    light: 'bg-teal-100/95 text-teal-900 border-teal-400',
    dark: 'bg-teal-950/95 text-teal-200 border-teal-500/70'
  },
  Neutral: {
    symbol: '•',
    light: 'bg-slate-200/95 text-slate-800 border-slate-400',
    dark: 'bg-slate-800/95 text-slate-200 border-slate-500'
  },
  Suspicious: {
    symbol: '?',
    light: 'bg-amber-100/95 text-amber-950 border-amber-400',
    dark: 'bg-amber-950/95 text-amber-200 border-amber-500/70'
  },
  Hostile: {
    symbol: '⚔',
    light: 'bg-red-100/95 text-red-900 border-red-400',
    dark: 'bg-red-950/95 text-red-200 border-red-500/70'
  },
  Unknown: {
    symbol: '◌',
    light: 'bg-indigo-100/95 text-indigo-900 border-indigo-400',
    dark: 'bg-indigo-950/95 text-indigo-200 border-indigo-500/70'
  },
  Deceased: {
    symbol: '☠',
    light: 'bg-stone-200/95 text-stone-900 border-stone-400',
    dark: 'bg-stone-800/95 text-stone-200 border-stone-500'
  }
}

const groupQuestMeta: Record<QuestStatus, { light: string; dark: string }> = {
  Rumor: {
    light: 'bg-purple-100/95 text-purple-900 border-purple-400',
    dark: 'bg-purple-950/95 text-purple-200 border-purple-500/70'
  },
  Active: {
    light: 'bg-sky-100/95 text-sky-900 border-sky-400',
    dark: 'bg-sky-950/95 text-sky-200 border-sky-500/70'
  },
  Completed: {
    light: 'bg-emerald-100/95 text-emerald-900 border-emerald-400',
    dark: 'bg-emerald-950/95 text-emerald-200 border-emerald-500/70'
  },
  Failed: {
    light: 'bg-rose-100/95 text-rose-900 border-rose-400',
    dark: 'bg-rose-950/95 text-rose-200 border-rose-500/70'
  }
}

const groupShapeRadiusClass: Record<GroupShape, string> = {
  rounded: 'rounded-2xl',
  sharp: 'rounded-md',
  beveled: 'rounded-tl-2xl rounded-br-2xl rounded-tr-sm rounded-bl-sm',
  arch: 'rounded-t-[40px] rounded-b-xl'
}

function GroupNode({ id, data, selected }: NodeProps<DndNode>) {
  const {
    nodes,
    isPlayerView,
    campaignEdition,
    canvasTheme,
    isDarkMode,
    activeSnapshotId,
    toggleNodeLock,
    updateNodeData,
    setNodes
  } = useStore()
  const updateNodeInternals = useUpdateNodeInternals()

  const width = Math.max(220, data.groupWidth || 360)
  const height = Math.max(150, data.groupHeight || 240)

  useEffect(() => {
    updateNodeInternals(id)
  }, [id, width, height, updateNodeInternals])

  const hideSecrets = isPlayerView || campaignEdition === 'player'
  if (hideSecrets && data.isHidden) return null

  const isSnapshotPreview = activeSnapshotId !== null
  const isReadOnly =
    isPlayerView || isSnapshotPreview || (campaignEdition === 'player' && !data.isPlayerCreated)

  const isDarkCanvas =
    canvasTheme === 'arcane' || (canvasTheme === 'modern' && isDarkMode)

  const tint = resolveGroupTint(data.groupColor, data.groupCustomColor)
  const hasBackground = Boolean(data.hasBackground)
  const opacity = Math.min(0.55, Math.max(0.06, data.groupOpacity ?? 0.16))
  const borderStyle = data.groupBorderStyle || (hasBackground ? 'solid' : 'dashed')
  const borderColor = isDarkCanvas ? tint.borderHexDark : tint.borderHexLight
  const fillColor = hasBackground
    ? `rgba(${isDarkCanvas ? tint.fillRgbDark : tint.fillRgbLight}, ${opacity})`
    : 'transparent'

  const memberCount = nodes.filter(
    (n) => n.data?.groupId === id && (!hideSecrets || !n.data?.isHidden)
  ).length

  const f = data.dndFields || {}
  const disposition = f.disposition as PartyDisposition | undefined
  const questStatus = f.questStatus as QuestStatus | undefined
  const scopeBadge = (f.influence || f.region || '').trim()
  const dmQuickStats = !hideSecrets ? (data.stats || '').trim() : ''

  const groupShape: GroupShape = data.groupShape || 'rounded'
  const radiusClass = groupShapeRadiusClass[groupShape] || groupShapeRadiusClass.rounded
  const headerAlign: GroupHeaderAlign = data.groupHeaderAlign || 'left'
  const portraitMode: GroupPortraitMode = data.groupPortraitMode || 'badge'
  const HeaderIcon = (data.groupIcon && availableIcons[data.groupIcon]) || FolderKanban

  const hasPublicNotes = Boolean((data.publicNotes ?? data.description)?.trim())
  const hasPartyNotes = Boolean(data.partyNotes?.trim())
  const hasDmSecrets =
    !hideSecrets && Boolean(data.dmNotes?.trim() || f.dangerTier?.trim())
  const isTheoryGroup = Boolean(data.isPlayerCreated)
  const isFaded = Boolean(data.isSearchFaded || data.isDegreeFaded)
  const hasSubBadges = Boolean(disposition || questStatus || scopeBadge || dmQuickStats)

  const canResize = selected && !isReadOnly && !data.isLocked

  return (
    <div
      style={{
        width,
        height,
        opacity: data.diffStatus === 'removed' ? 0.4 : isFaded ? 0.18 : data.isHidden ? 0.78 : 1
      }}
      className={cn('group relative select-none', radiusClass)}
    >
      {/* Interactive Resizer (when selected & unlocked in edit mode) */}
      <NodeResizer
        isVisible={canResize}
        minWidth={220}
        minHeight={150}
        lineClassName="dcc-group-interactive !border-blue-500/70"
        handleClassName="dcc-group-interactive !w-3 !h-3 !rounded-sm !bg-blue-500 !border-2 !border-white shadow"
        onResizeStart={() => {
          useStore.getState().pushHistory(true)
        }}
        onResize={(_evt, params) => {
          const current = useStore.getState().nodes
          setNodes(
            current.map((n) =>
              n.id === id
                ? {
                    ...n,
                    position: { x: Math.round(params.x), y: Math.round(params.y) },
                    data: {
                      ...n.data,
                      groupWidth: Math.round(params.width),
                      groupHeight: Math.round(params.height)
                    }
                  }
                : n
            )
          )
        }}
        onResizeEnd={(_evt, params) => {
          updateNodeData(
            id,
            {
              groupWidth: Math.round(params.width),
              groupHeight: Math.round(params.height)
            },
            false
          )
        }}
      />

      {/* Visual Frame & Optional Translucent Region Backdrop (always sits at zIndex: 1 below connection lines!) */}
      <div
        style={{
          backgroundColor: fillColor,
          borderColor,
          borderStyle: borderStyle === 'double' ? 'double' : borderStyle,
          borderWidth: borderStyle === 'double' ? 4 : 2,
          boxShadow: data.isSpotlighted
            ? `0 0 0 4px rgba(251, 191, 36, 0.85), 0 0 28px rgba(251, 191, 36, 0.45)`
            : selected
              ? `0 0 0 3px rgba(59, 130, 246, 0.55)`
              : undefined
        }}
        className={cn(
          'w-full h-full overflow-hidden transition-shadow',
          radiusClass,
          hasBackground && 'dcc-group-interactive'
        )}
      >
        {data.portrait && portraitMode === 'banner' && (
          <img
            src={data.portrait}
            alt=""
            aria-hidden="true"
            style={{
              maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.65) 15%, transparent 100%)',
              WebkitMaskImage:
                'linear-gradient(to bottom, rgba(0,0,0,0.65) 15%, transparent 100%)'
            }}
            className="w-full h-16 object-cover pointer-events-none select-none opacity-55"
          />
        )}
      </div>

      {/* Perimeter Grab & Right-Click Hit Rails (active even when background fill is turned off) */}
      {!hasBackground && (
        <>
          <div className="dcc-group-interactive absolute inset-x-0 -top-1.5 h-3.5 cursor-grab active:cursor-grabbing" />
          <div className="dcc-group-interactive absolute inset-x-0 -bottom-1.5 h-3.5 cursor-grab active:cursor-grabbing" />
          <div className="dcc-group-interactive absolute inset-y-0 -left-1.5 w-3.5 cursor-grab active:cursor-grabbing" />
          <div className="dcc-group-interactive absolute inset-y-0 -right-1.5 w-3.5 cursor-grab active:cursor-grabbing" />
        </>
      )}

      {/* Status Markers Pill (Top-Right — clear of corner resize handle) */}
      {data.statusIcons && data.statusIcons.length > 0 && (
        <div
          title={`Status Markers: ${data.statusIcons.join(', ')}`}
          className={cn(
            'dcc-group-interactive absolute -top-3 right-3.5 flex items-center gap-1 border shadow-sm px-2 py-1 rounded-full z-20',
            isDarkCanvas ? 'bg-slate-900/95 border-slate-600' : 'bg-white/95 border-slate-300'
          )}
        >
          {data.statusIcons.map((s) => {
            const mappedName = legacyStatusIconMap[s] || s
            const SIcon = availableIcons[mappedName] || availableIcons.Component
            return (
              <SIcon
                key={s}
                size={13}
                strokeWidth={2.25}
                className={getIconColor(mappedName, isDarkCanvas)}
              />
            )
          })}
        </div>
      )}

      {/* Group Title Header Stack (Main Pill + Optional Standing / Quest / Quick Stat Sub-Badges) */}
      <div
        className={cn(
          'absolute top-2.5 flex flex-col gap-1 max-w-[calc(100%-24px)] z-10',
          headerAlign === 'center'
            ? 'left-1/2 -translate-x-1/2 items-center'
            : 'left-3 items-start'
        )}
      >
        <div
          style={{
            backgroundColor: isDarkCanvas ? tint.headerBgDark : tint.headerBgLight,
            borderColor,
            color: isDarkCanvas ? tint.headerTextDark : tint.headerTextLight
          }}
          className={cn(
            'dcc-group-interactive max-w-full px-2.5 py-1 rounded-lg border shadow-sm flex items-center gap-2',
            !isReadOnly && !data.isLocked ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
          )}
        >
          {data.portrait && portraitMode === 'badge' ? (
            <img
              src={data.portrait}
              alt=""
              aria-hidden="true"
              className="w-5 h-5 rounded-full object-cover border border-black/15 dark:border-white/25 shrink-0"
            />
          ) : (
            <HeaderIcon
              size={13}
              className={cn(
                'shrink-0',
                data.groupIcon ? getIconColor(data.groupIcon, isDarkCanvas) : 'opacity-85'
              )}
            />
          )}
          <div className="min-w-0 flex items-baseline gap-1.5">
            <span className="font-bold text-xs tracking-tight truncate">
              {data.label || 'Unnamed Group'}
            </span>
            {data.groupSubtitle ? (
              <span className="text-[10px] font-medium opacity-80 truncate">
                · {data.groupSubtitle}
              </span>
            ) : memberCount > 0 ? (
              <span className="text-[10px] font-semibold opacity-70 shrink-0">
                ({memberCount})
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-0.5">
            {isTheoryGroup && (
              <span
                title="Player Theory Group"
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-indigo-600 text-white text-[9px] font-bold uppercase tracking-wider"
              >
                <Compass size={9} /> Theory
              </span>
            )}
            {data.isHidden && !hideSecrets && (
              <span
                title="Group hidden from Players"
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-900/85 text-white text-[9px] font-bold uppercase tracking-wider"
              >
                <EyeOff size={9} /> Hidden
              </span>
            )}
            {hasPublicNotes && (
              <span title="Has Group Lore" className="opacity-80">
                <FileText size={11} />
              </span>
            )}
            {hasPartyNotes && (
              <span title="Has Party Notes" className="text-indigo-600 dark:text-indigo-300">
                <MessageSquareText size={11} />
              </span>
            )}
            {hasDmSecrets && (
              <span
                title="Has Private DM Secrets"
                className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-400 text-slate-950"
              >
                <Lock size={9} strokeWidth={2.5} />
              </span>
            )}
            {!isReadOnly && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  toggleNodeLock([id])
                }}
                title={
                  data.isLocked
                    ? 'Group & members locked (click to unlock)'
                    : 'Lock group & member positions'
                }
                aria-label={data.isLocked ? 'Unlock group' : 'Lock group'}
                aria-pressed={Boolean(data.isLocked)}
                className={cn(
                  'nodrag nopan p-1 rounded transition-colors cursor-pointer',
                  data.isLocked
                    ? 'bg-amber-500/25 text-amber-800 dark:text-amber-200 hover:bg-amber-500/40'
                    : 'opacity-65 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10'
                )}
              >
                {data.isLocked ? <Lock size={11} /> : <Unlock size={11} />}
              </button>
            )}
          </div>
        </div>

        {hasSubBadges && (
          <div
            className={cn(
              'dcc-group-interactive flex flex-wrap items-center gap-1 max-w-full',
              headerAlign === 'center' ? 'justify-center' : 'justify-start'
            )}
          >
            {disposition && groupDispositionMeta[disposition] && (
              <span
                className={cn(
                  'px-1.5 py-0.5 rounded border text-[10px] font-bold leading-none shadow-xs inline-flex items-center gap-1',
                  isDarkCanvas
                    ? groupDispositionMeta[disposition].dark
                    : groupDispositionMeta[disposition].light
                )}
              >
                <span>{groupDispositionMeta[disposition].symbol}</span>
                <span>{disposition}</span>
              </span>
            )}
            {questStatus && groupQuestMeta[questStatus] && (
              <span
                className={cn(
                  'px-1.5 py-0.5 rounded border text-[10px] font-bold leading-none shadow-xs',
                  isDarkCanvas ? groupQuestMeta[questStatus].dark : groupQuestMeta[questStatus].light
                )}
              >
                {questStatus}
              </span>
            )}
            {scopeBadge && (
              <span
                className={cn(
                  'px-1.5 py-0.5 rounded border text-[10px] font-medium leading-none shadow-xs truncate max-w-[150px]',
                  isDarkCanvas
                    ? 'bg-slate-900/90 text-slate-200 border-slate-600'
                    : 'bg-white/90 text-slate-700 border-slate-300'
                )}
              >
                {scopeBadge}
              </span>
            )}
            {dmQuickStats && (
              <span
                title="DM Quick Stat / Force Summary (hidden in Player View)"
                className={cn(
                  'px-1.5 py-0.5 rounded border text-[10px] font-semibold leading-none shadow-xs truncate max-w-[180px]',
                  isDarkCanvas
                    ? 'bg-amber-950/90 text-amber-200 border-amber-600/70'
                    : 'bg-amber-50/95 text-amber-900 border-amber-400'
                )}
              >
                {dmQuickStats}
              </span>
            )}
          </div>
        )}
      </div>

      {/* 8 Perimeter Connection Handles so connections attach cleanly to the Group as a whole */}
      <CustomPerimeterHandles
        nodeId={id}
        ports={resolveNodePerimeterPorts(data, true)}
        localWidth={width}
        localHeight={height}
        shapeKey={resolveNodeShapeKey(data, true)}
        defaultAccentColor={tint.swatchHex}
        isDarkSurface={isDarkCanvas}
        selected={selected}
        isReadOnly={isReadOnly}
        isLocked={Boolean(data.isLocked)}
        isGroup
      />
    </div>
  )
}

export default memo(GroupNode)
