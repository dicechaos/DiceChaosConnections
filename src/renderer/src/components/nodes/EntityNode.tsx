import { memo, useEffect, useRef } from 'react'
import { Handle, NodeResizer, Position, NodeProps, useUpdateNodeInternals } from '@xyflow/react'
import { DndNode, PartyDisposition } from '../../types'
import {
  User,
  Users,
  MapPin,
  Sword,
  Shield,
  Calendar,
  EyeOff,
  Lock,
  Pin,
  Compass,
  MessageSquareText
} from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { setEntityResizing, useStore } from '../../store/useStore'
import { availableIcons, getIconColor } from '../../utils/icons'
import { isHexColorDark, normalizeHexColor } from '../../utils/colorUtils'
import { computeEntityVisualScale, resolveEntityExplicitSize } from '../../utils/graphPipeline'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const iconMap: Record<string, any> = {
  PC: User,
  NPC: Users,
  Location: MapPin,
  Item: Sword,
  Organization: Shield,
  Event: Calendar
}

const modernLightColorMap: Record<string, string> = {
  PC: 'bg-blue-50 border-blue-600 text-slate-900',
  NPC: 'bg-emerald-50 border-emerald-600 text-slate-900',
  Location: 'bg-amber-50 border-amber-600 text-slate-900',
  Item: 'bg-purple-50 border-purple-600 text-slate-900',
  Organization: 'bg-rose-50 border-rose-600 text-slate-900',
  Event: 'bg-slate-100 border-slate-600 text-slate-900'
}

const modernDarkColorMap: Record<string, string> = {
  PC: 'bg-slate-900 border-blue-400 text-slate-50',
  NPC: 'bg-slate-900 border-emerald-400 text-slate-50',
  Location: 'bg-slate-900 border-amber-400 text-slate-50',
  Item: 'bg-slate-900 border-purple-400 text-slate-50',
  Organization: 'bg-slate-900 border-rose-400 text-slate-50',
  Event: 'bg-slate-800 border-slate-400 text-slate-50'
}

const arcaneColorMap: Record<string, string> = {
  PC: 'bg-[#0d1428] border-sky-400 text-slate-50 shadow-[0_0_15px_rgba(56,189,248,0.2)]',
  NPC: 'bg-[#0d1428] border-emerald-400 text-slate-50 shadow-[0_0_15px_rgba(52,211,153,0.18)]',
  Location: 'bg-[#0d1428] border-amber-400 text-slate-50 shadow-[0_0_15px_rgba(251,191,36,0.18)]',
  Item: 'bg-[#0d1428] border-fuchsia-400 text-slate-50 shadow-[0_0_15px_rgba(232,121,249,0.2)]',
  Organization:
    'bg-[#0d1428] border-rose-400 text-slate-50 shadow-[0_0_15px_rgba(251,113,133,0.2)]',
  Event: 'bg-[#0d1428] border-indigo-300 text-slate-50 shadow-[0_0_15px_rgba(165,180,252,0.18)]'
}

const parchmentColorMap: Record<string, string> = {
  PC: 'bg-[#fbf6ea] border-[#2b547e] text-[#172b42]',
  NPC: 'bg-[#fbf6ea] border-[#2e6b4e] text-[#153826]',
  Location: 'bg-[#fbf6ea] border-[#9c5d16] text-[#452605]',
  Item: 'bg-[#fbf6ea] border-[#6b3fa0] text-[#331a50]',
  Organization: 'bg-[#fbf6ea] border-[#9e2a2b] text-[#4c1112]',
  Event: 'bg-[#fbf6ea] border-[#5c5346] text-[#26211b]'
}

const corkboardColorMap: Record<string, string> = {
  PC: 'bg-[#fffdf7] border-blue-600 text-slate-900 shadow-lg',
  NPC: 'bg-[#fffdf7] border-emerald-600 text-slate-900 shadow-lg',
  Location: 'bg-[#fffdf7] border-amber-600 text-slate-900 shadow-lg',
  Item: 'bg-[#fff9db] border-purple-600 text-slate-900 shadow-lg',
  Organization: 'bg-[#fffdf7] border-rose-600 text-slate-900 shadow-lg',
  Event: 'bg-[#fff9db] border-stone-600 text-slate-900 shadow-lg'
}

const lightIconChipMap: Record<string, string> = {
  PC: 'bg-blue-100 border-blue-300 text-blue-800',
  NPC: 'bg-emerald-100 border-emerald-300 text-emerald-800',
  Location: 'bg-amber-100 border-amber-300 text-amber-900',
  Item: 'bg-purple-100 border-purple-300 text-purple-800',
  Organization: 'bg-rose-100 border-rose-300 text-rose-800',
  Event: 'bg-slate-200 border-slate-300 text-slate-800'
}

const darkIconChipMap: Record<string, string> = {
  PC: 'bg-sky-950 border-sky-500/60 text-sky-200',
  NPC: 'bg-emerald-950 border-emerald-500/60 text-emerald-200',
  Location: 'bg-amber-950 border-amber-500/60 text-amber-200',
  Item: 'bg-purple-950 border-purple-500/60 text-purple-200',
  Organization: 'bg-rose-950 border-rose-500/60 text-rose-200',
  Event: 'bg-indigo-950 border-indigo-400/60 text-indigo-200'
}

const dispositionMeta: Record<
  PartyDisposition,
  { symbol: string; light: string; dark: string }
> = {
  Allied: {
    symbol: '★',
    light: 'bg-emerald-100 text-emerald-900 border-emerald-400',
    dark: 'bg-emerald-950 text-emerald-200 border-emerald-500/70'
  },
  Friendly: {
    symbol: '☺',
    light: 'bg-teal-100 text-teal-900 border-teal-400',
    dark: 'bg-teal-950 text-teal-200 border-teal-500/70'
  },
  Neutral: {
    symbol: '•',
    light: 'bg-slate-200 text-slate-800 border-slate-400',
    dark: 'bg-slate-800 text-slate-200 border-slate-500'
  },
  Suspicious: {
    symbol: '?',
    light: 'bg-amber-100 text-amber-950 border-amber-400',
    dark: 'bg-amber-950 text-amber-200 border-amber-500/70'
  },
  Hostile: {
    symbol: '⚔',
    light: 'bg-red-100 text-red-900 border-red-400',
    dark: 'bg-red-950 text-red-200 border-red-500/70'
  },
  Unknown: {
    symbol: '◌',
    light: 'bg-indigo-100 text-indigo-900 border-indigo-400',
    dark: 'bg-indigo-950 text-indigo-200 border-indigo-500/70'
  },
  Deceased: {
    symbol: '☠',
    light: 'bg-stone-200 text-stone-900 border-stone-400',
    dark: 'bg-stone-800 text-stone-200 border-stone-500'
  }
}

const legacyMap: Record<string, string> = {
  skull: 'Skull',
  flame: 'Flame',
  crown: 'Crown',
  shield: 'Shield'
}

function EntityNode({ id, data, selected }: NodeProps<DndNode>) {
  const {
    nodes,
    customEntityTypes,
    edges,
    canvasTheme,
    isDarkMode,
    isPlayerView,
    campaignEdition,
    activeSnapshotId,
    pushHistory,
    resizeEntityNode
  } = useStore()
  const updateNodeInternals = useUpdateNodeInternals()
  const resizeStartRef = useRef<{
    x: number
    y: number
    width: number
    height: number
    scale: number
    hadExplicitH: boolean
  } | null>(null)

  const isBuiltIn = Boolean(modernLightColorMap[data.entityType])
  const customType = customEntityTypes.find((t) => t.label === data.entityType)

  let Icon = iconMap[data.entityType]
  if (!Icon && customType?.icon) {
    Icon = availableIcons[customType.icon] || availableIcons.Component
  } else if (!Icon) {
    Icon = availableIcons.Component
  }

  // Card surface brightness adapts to a custom card `bgColor` when set, otherwise to the Canvas Theme
  const validBgColor = normalizeHexColor(data.bgColor)
  const isDarkCardSurface = validBgColor
    ? isHexColorDark(validBgColor)
    : canvasTheme === 'arcane' || (canvasTheme === 'modern' && isDarkMode)

  const themePalette =
    canvasTheme === 'arcane'
      ? arcaneColorMap
      : canvasTheme === 'parchment'
        ? parchmentColorMap
        : canvasTheme === 'corkboard'
          ? corkboardColorMap
          : isDarkMode
            ? modernDarkColorMap
            : modernLightColorMap

  const rawColorClass = themePalette[data.entityType] || ''
  const colorClass = validBgColor
    ? rawColorClass
        .split(' ')
        .filter((tok) => !tok.startsWith('bg-') && !tok.startsWith('text-'))
        .join(' ')
    : rawColorClass
  const baseCustomColor = customType?.color || '#64748b'

  const customStyle: React.CSSProperties = !isBuiltIn
    ? {
        borderColor: baseCustomColor,
        borderStyle: customType?.borderStyle || 'solid',
        ...(validBgColor
          ? ({
              '--entity-bg': validBgColor,
              '--entity-fg-fallback': isDarkCardSurface ? '#f8fafc' : '#0f172a'
            } as React.CSSProperties)
          : {
              color: isDarkCardSurface ? '#f8fafc' : '#0f172a',
              backgroundColor: isDarkCardSurface
                ? `color-mix(in oklab, ${baseCustomColor} 22%, #0f172a)`
                : canvasTheme === 'parchment'
                  ? `color-mix(in oklab, ${baseCustomColor} 14%, #fbf6ea)`
                  : `color-mix(in oklab, ${baseCustomColor} 14%, #ffffff)`
            })
      }
    : validBgColor
      ? ({
          '--entity-bg': validBgColor,
          '--entity-fg-fallback': isDarkCardSurface ? '#f8fafc' : '#0f172a'
        } as React.CSSProperties)
      : {}

  const iconChipClass = isBuiltIn
    ? isDarkCardSurface
      ? darkIconChipMap[data.entityType]
      : lightIconChipMap[data.entityType]
    : ''

  const customIconChipStyle: React.CSSProperties = !isBuiltIn
    ? {
        backgroundColor: isDarkCardSurface
          ? `color-mix(in oklab, ${baseCustomColor} 28%, #0f172a)`
          : `color-mix(in oklab, ${baseCustomColor} 18%, #ffffff)`,
        borderColor: isDarkCardSurface
          ? `color-mix(in oklab, ${baseCustomColor} 55%, #334155)`
          : `color-mix(in oklab, ${baseCustomColor} 45%, #cbd5e1)`,
        color: isDarkCardSurface
          ? `color-mix(in oklab, ${baseCustomColor} 55%, #ffffff)`
          : `color-mix(in oklab, ${baseCustomColor} 65%, #0f172a)`
      }
    : {}

  const shape = data.shape || 'default'
  const portraitMode = data.portrait ? data.portraitMode || 'token' : 'icon'
  const disposition = data.dndFields?.disposition
  const rarity = data.dndFields?.rarity
  const questStatus = data.dndFields?.questStatus
  const ovalSubRowCount =
    Number(Boolean(data.stats)) + Number(Boolean(disposition || rarity || questStatus))

  let shapeClass = 'rounded-lg'
  if (shape === 'box') shapeClass = 'rounded-none'
  if (shape === 'pill') shapeClass = portraitMode === 'card' ? 'rounded-full' : 'rounded-full px-6'
  if (shape === 'leaf') shapeClass = 'rounded-tl-3xl rounded-br-3xl rounded-tr-md rounded-bl-md'
  if (shape === 'arch') shapeClass = 'rounded-t-3xl rounded-b-md'
  if (shape === 'oval') {
    const ovalPaddingClass =
      portraitMode === 'card'
        ? ''
        : ovalSubRowCount >= 2
          ? 'pl-4 pr-7 py-4'
          : ovalSubRowCount === 1
            ? 'pl-4 pr-6 py-3.5'
            : 'pl-3.5 pr-2.5 py-3'
    shapeClass = cn('rounded-[50%]', ovalPaddingClass)
  }
  if (shape === 'sticky') shapeClass = 'rounded-none shadow-xl border-b-[8px]'

  const isFaded = Boolean(data.isSearchFaded || data.isDegreeFaded)
  const scaleFactor = computeEntityVisualScale(id, data, selected, edges)
  const explicitSize = resolveEntityExplicitSize(data)
  const hasExplicitW = explicitSize.width !== undefined
  const hasExplicitH = explicitSize.height !== undefined
  const isTallCard = (explicitSize.height ?? 0) >= 120

  const isReadOnly =
    isPlayerView || activeSnapshotId !== null || (campaignEdition === 'player' && !data.isPlayerCreated)
  const parentGroup = data.groupId ? nodes.find((n) => n.id === data.groupId) : undefined
  const effectivelyLocked = Boolean(data.isLocked || parentGroup?.data?.isLocked)
  const isSingleSelected = Boolean(selected && nodes.filter((n) => n.selected).length === 1)
  const canResize = Boolean(isSingleSelected && !isReadOnly && !effectivelyLocked)

  let transformStr = ''
  if (scaleFactor !== 1) transformStr += `scale(${scaleFactor}) `
  if (shape === 'sticky') transformStr += 'rotate(-1deg) '
  if (transformStr.trim()) {
    customStyle.transform = transformStr.trim()
  }

  const ovalLabelRef = useRef<HTMLDivElement | null>(null)

  // Refresh React Flow cached handle bounds whenever shape, scale, explicit dimensions, portrait layout, or oval text/rows change
  useEffect(() => {
    updateNodeInternals(id)
  }, [
    id,
    shape,
    scaleFactor,
    explicitSize.width,
    explicitSize.height,
    portraitMode,
    data.label,
    ovalSubRowCount,
    updateNodeInternals
  ])

  // Track overflow on single-line oval titles as the cross-browser fallback for CSS scroll-driven truncation detection
  useEffect(() => {
    if (shape !== 'oval') return
    const el = ovalLabelRef.current
    if (!el) return

    const syncTruncation = (): void => {
      const hiddenWidth = el.scrollWidth - el.clientWidth
      el.classList.toggle('is-truncated', hiddenWidth > 0)
      if (hiddenWidth > 0) {
        el.style.setProperty('--scroll-width', String(Math.max(hiddenWidth, 40)))
      } else {
        el.style.removeProperty('--scroll-width')
      }
    }

    syncTruncation()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => syncTruncation())
    observer.observe(el)
    return () => observer.disconnect()
  }, [shape, data.label, ovalSubRowCount, portraitMode, explicitSize.width, explicitSize.height])

  // Position corner handles along the actual rounded perimeter so hover dots & drag lines sit on the border
  const cornerHandleStyles: {
    tl: React.CSSProperties
    tr: React.CSSProperties
    bl: React.CSSProperties
    br: React.CSSProperties
  } =
    shape === 'oval'
      ? {
          tl: { left: '14.64%', top: '14.64%' },
          tr: { left: '85.36%', top: '14.64%' },
          bl: { left: '14.64%', bottom: '14.64%' },
          br: { left: '85.36%', bottom: '14.64%' }
        }
      : shape === 'pill'
        ? {
            tl: { left: '22px', top: '4px' },
            tr: { left: 'calc(100% - 22px)', top: '4px' },
            bl: { left: '22px', bottom: '4px' },
            br: { left: 'calc(100% - 22px)', bottom: '4px' }
          }
        : shape === 'arch'
          ? {
              tl: { left: '20px', top: '2px' },
              tr: { left: 'calc(100% - 20px)', top: '2px' },
              bl: { left: '14px', bottom: '0px' },
              br: { left: 'calc(100% - 14px)', bottom: '0px' }
            }
          : shape === 'leaf'
            ? {
                tl: { left: '20px', top: '2px' },
                tr: { left: 'calc(100% - 14px)', top: '0px' },
                bl: { left: '14px', bottom: '0px' },
                br: { left: 'calc(100% - 20px)', bottom: '2px' }
              }
            : shape === 'box' || shape === 'sticky'
              ? {
                  tl: { left: '14px', top: '0px' },
                  tr: { left: 'calc(100% - 14px)', top: '0px' },
                  bl: { left: '14px', bottom: '0px' },
                  br: { left: 'calc(100% - 14px)', bottom: '0px' }
                }
              : {
                  tl: { left: '16px', top: '0px' },
                  tr: { left: 'calc(100% - 16px)', top: '0px' },
                  bl: { left: '16px', bottom: '0px' },
                  br: { left: 'calc(100% - 16px)', bottom: '0px' }
                }
  const hasDmSecrets = !isPlayerView && Boolean(data.dmNotes?.trim())
  const hasPartyNotes = Boolean(data.partyNotes?.trim())
  const isTheoryPin = Boolean(data.isPlayerCreated)

  const diffRingClass =
    data.diffStatus === 'added'
      ? 'ring-2 ring-emerald-400 shadow-[0_0_16px_rgba(16,185,129,0.45)]'
      : data.diffStatus === 'modified'
        ? 'ring-2 ring-amber-400 shadow-[0_0_16px_rgba(245,158,11,0.4)]'
        : data.diffStatus === 'removed'
          ? 'opacity-45 border-dashed grayscale'
          : ''

  const spotlightRingClass = data.isSpotlighted
    ? 'ring-4 ring-amber-400 shadow-[0_0_30px_rgba(251,191,36,0.8)] animate-pulse motion-reduce:animate-none'
    : ''

  return (
    <div
      className={cn(
        'relative shadow-md border-2 group transition-[box-shadow,border-color,opacity] duration-200',
        hasExplicitW
          ? 'w-full min-w-0 max-w-none entity-size-container'
          : cn('min-w-[205px]', shape === 'oval' ? 'max-w-[285px]' : 'max-w-[270px]'),
        portraitMode === 'card'
          ? cn('p-0 flex flex-col overflow-visible', hasExplicitH && 'h-full')
          : cn(
              'px-4 py-3 flex',
              hasExplicitH
                ? shape === 'sticky'
                  ? 'h-full items-start pt-3.5'
                  : 'h-full items-center'
                : 'items-center'
            ),
        shapeClass,
        colorClass,
        validBgColor ? 'dcc-custom-card-bg' : '',
        selected ? 'ring-2 ring-blue-500 shadow-xl' : '',
        // Keep card background opaque so text stays 100% crisp; signal DM-hidden or Theory Pin via dashed border + badge
        data.isHidden || isTheoryPin ? 'border-dashed' : '',
        isFaded ? 'opacity-15 grayscale' : '',
        diffRingClass,
        spotlightRingClass
      )}
      style={customStyle}
    >
      {/* Interactive Manual Resize Grips (single-selected, unlocked, editable entities) */}
      <NodeResizer
        isVisible={canResize}
        minWidth={explicitSize.minWidth}
        minHeight={explicitSize.minHeight}
        maxWidth={explicitSize.maxWidth}
        maxHeight={explicitSize.maxHeight}
        lineClassName="!border-blue-500/45 !z-20 entity-resizer-line"
        handleClassName="!w-2.5 !h-2.5 !rounded-[2px] !bg-white !border-2 !border-blue-600 shadow-sm !z-[25] entity-resizer-handle"
        onResizeStart={(_evt, params) => {
          setEntityResizing(id, true)
          resizeStartRef.current = {
            x: params.x,
            y: params.y,
            width: params.width,
            height: params.height,
            scale: scaleFactor || 1,
            hadExplicitH: data.entityHeight !== undefined
          }
          pushHistory(true)
        }}
        onResize={(_evt, params) => {
          const start = resizeStartRef.current
          const s = start?.scale || 1
          const startW = start?.width ?? params.width
          const startH = start?.height ?? params.height
          const startX = start?.x ?? params.x
          const startY = start?.y ?? params.y

          const rawDeltaW = params.width - startW
          const rawDeltaH = params.height - startH
          const affectsX = params.x !== startX
          const affectsY = params.y !== startY

          const nextUnscaledW = Math.round(startW + rawDeltaW / s)
          const nextUnscaledH = Math.round(startH + rawDeltaH / s)
          const clamped = resolveEntityExplicitSize({
            ...data,
            entityWidth: nextUnscaledW,
            entityHeight: nextUnscaledH
          })
          const finalW = clamped.width ?? startW
          const finalH = clamped.height ?? startH
          const appliedDeltaW = finalW - startW
          const appliedDeltaH = finalH - startH

          const nextX = affectsX
            ? startX - (appliedDeltaW * (s + 1)) / 2
            : startX + (appliedDeltaW * (s - 1)) / 2
          const nextY = affectsY
            ? startY - (appliedDeltaH * (s + 1)) / 2
            : startY + (appliedDeltaH * (s - 1)) / 2

          const commitH = Boolean(start?.hadExplicitH || rawDeltaH !== 0)

          resizeEntityNode(
            id,
            {
              width: finalW,
              height: commitH ? finalH : undefined,
              position: { x: nextX, y: nextY }
            },
            false
          )
          updateNodeInternals(id)
        }}
        onResizeEnd={() => {
          resizeStartRef.current = null
          setEntityResizing(id, false)
          updateNodeInternals(id)
        }}
      />
      {/* Corkboard 3D Pushpin Accent (dims on hover so top connection handle stays clear) */}
      {canvasTheme === 'corkboard' && (
        <div
          aria-hidden="true"
          className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-gradient-to-br from-red-400 via-red-600 to-red-800 border border-red-950/50 shadow-[0_2px_4px_rgba(0,0,0,0.45)] z-20 pointer-events-none group-hover:opacity-30 transition-opacity"
        />
      )}

      {/* Timeline Visual Diff Pill */}
      {data.diffStatus && (
        <div
          className={cn(
            'absolute -bottom-3 left-3 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border shadow-sm z-20',
            data.diffStatus === 'added' && 'bg-emerald-600 text-white border-emerald-400',
            data.diffStatus === 'modified' && 'bg-amber-500 text-slate-950 border-amber-300',
            data.diffStatus === 'removed' && 'bg-rose-700 text-white border-rose-400'
          )}
        >
          {data.diffStatus === 'added'
            ? '+ New'
            : data.diffStatus === 'modified'
              ? '~ Changed'
              : 'Removed'}
        </div>
      )}

      {/* Top-Left Badges: DM Hidden / Locked / DM Secrets + Party Theory / Party Notes */}
      {(((data.isHidden || data.isLocked || hasDmSecrets) && !isPlayerView) ||
        isTheoryPin ||
        hasPartyNotes) && (
        <div className="absolute -top-3 -left-2.5 flex items-center gap-1 z-20">
          {data.isHidden && !isPlayerView && (
            <div
              title="Hidden from Players"
              className="bg-slate-800 text-white border border-slate-500 px-1.5 py-0.5 rounded-full shadow-sm flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider"
            >
              <EyeOff size={10} />
              <span>Hidden</span>
            </div>
          )}
          {data.isLocked && !isPlayerView && (
            <div
              title="Position Locked"
              className="bg-sky-700 text-white border border-sky-400 p-1 rounded-full shadow-sm"
            >
              <Pin size={10} strokeWidth={2.5} />
            </div>
          )}
          {hasDmSecrets && !isPlayerView && (
            <div
              title="Has Private DM Secrets"
              className="bg-amber-400 text-slate-950 border border-amber-600/50 p-1 rounded-full shadow-sm"
            >
              <Lock size={10} strokeWidth={2.5} />
            </div>
          )}
          {isTheoryPin && (
            <div
              title="Player Theory Pin"
              className="bg-indigo-600 text-white border border-indigo-400 px-1.5 py-0.5 rounded-full shadow-sm flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider"
            >
              <Compass size={10} />
              <span>Theory</span>
            </div>
          )}
          {hasPartyNotes && (
            <div
              title="Has Party Notes & Theories"
              className="bg-indigo-100 text-indigo-800 border border-indigo-400 p-1 rounded-full shadow-sm"
            >
              <MessageSquareText size={10} strokeWidth={2.5} />
            </div>
          )}
        </div>
      )}

      {/* Status Markers (Top-Right — surface matched to card brightness!) */}
      {data.statusIcons && data.statusIcons.length > 0 && (
        <div
          className={cn(
            'absolute -top-3 -right-2.5 flex gap-1 border shadow-sm px-1.5 py-1 rounded-full z-20',
            isDarkCardSurface ? 'bg-slate-900 border-slate-600' : 'bg-white border-slate-300'
          )}
        >
          {data.statusIcons.map((s) => {
            const mappedName = legacyMap[s] || s
            const SIcon = availableIcons[mappedName] || availableIcons.Component
            return (
              <SIcon
                key={s}
                size={14}
                strokeWidth={2.25}
                className={getIconColor(mappedName, isDarkCardSurface)}
              />
            )
          })}
        </div>
      )}

      {/* Connection Handles (8-point: sides + shape-aware corners) */}
      <Handle
        type="source"
        id="t"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !bg-blue-500 !border-white opacity-0 group-hover:opacity-100 transition-opacity z-30"
      />
      <Handle
        type="source"
        id="tl"
        position={Position.Top}
        style={cornerHandleStyles.tl}
        className="!w-2.5 !h-2.5 !bg-blue-500 !border-white opacity-0 group-hover:opacity-100 transition-opacity z-30"
      />
      <Handle
        type="source"
        id="tr"
        position={Position.Top}
        style={cornerHandleStyles.tr}
        className="!w-2.5 !h-2.5 !bg-blue-500 !border-white opacity-0 group-hover:opacity-100 transition-opacity z-30"
      />

      <Handle
        type="source"
        id="b"
        position={Position.Bottom}
        className="!w-2.5 !h-2.5 !bg-blue-500 !border-white opacity-0 group-hover:opacity-100 transition-opacity z-30"
      />
      <Handle
        type="source"
        id="bl"
        position={Position.Bottom}
        style={cornerHandleStyles.bl}
        className="!w-2.5 !h-2.5 !bg-blue-500 !border-white opacity-0 group-hover:opacity-100 transition-opacity z-30"
      />
      <Handle
        type="source"
        id="br"
        position={Position.Bottom}
        style={cornerHandleStyles.br}
        className="!w-2.5 !h-2.5 !bg-blue-500 !border-white opacity-0 group-hover:opacity-100 transition-opacity z-30"
      />

      <Handle
        type="source"
        id="l"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-blue-500 !border-white opacity-0 group-hover:opacity-100 transition-opacity z-30"
      />
      <Handle
        type="source"
        id="r"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-blue-500 !border-white opacity-0 group-hover:opacity-100 transition-opacity z-30"
      />

      {/* Card Banner Portrait Mode */}
      {portraitMode === 'card' && data.portrait && (
        <div
          className={cn(
            'w-full entity-card-banner rounded-t-[inherit] border-b',
            hasExplicitH ? 'min-h-20 flex-1' : 'h-28',
            isDarkCardSurface ? 'border-white/15' : 'border-black/10'
          )}
        >
          <img
            src={data.portrait}
            alt={data.label}
            className="w-full h-full object-cover object-top pointer-events-none select-none"
          />
        </div>
      )}

      {/* Body Content */}
      <div
        className={cn(
          'entity-card-body flex items-center w-full',
          shape === 'oval' && portraitMode !== 'card' ? 'gap-2' : 'gap-2.5',
          portraitMode === 'card' ? 'px-3.5 py-2.5 shrink-0' : ''
        )}
      >
        {portraitMode === 'token' && data.portrait ? (
          <img
            src={data.portrait}
            alt={data.label}
            className="entity-card-token w-10 h-10 rounded-full object-cover border-2 border-current/40 shrink-0 shadow-sm pointer-events-none select-none"
          />
        ) : (
          <div
            className={cn('entity-card-icon rounded-full border p-1.5 shrink-0', iconChipClass)}
            style={customIconChipStyle}
          >
            <Icon size={16} strokeWidth={2.25} />
          </div>
        )}

        <div className="flex flex-col min-w-0 flex-1">
          {shape === 'oval' ? (
            <div ref={ovalLabelRef} className="font-bold text-sm dcc-oval-label">
              <span>{data.label}</span>
            </div>
          ) : (
            <div
              className={cn(
                'font-bold text-sm leading-tight break-words',
                isTallCard ? 'line-clamp-4' : 'line-clamp-2'
              )}
            >
              {data.label}
            </div>
          )}
          {data.stats && (
            <div
              className={cn(
                'text-xs font-medium',
                isTallCard ? 'line-clamp-2 whitespace-normal break-words' : 'truncate',
                isDarkCardSurface ? 'text-slate-200' : 'text-slate-700'
              )}
            >
              {data.stats}
            </div>
          )}

          {/* Optional D&D Summary Pills (High-contrast on both light and dark card surfaces!) */}
          {(disposition || rarity || questStatus) && (
            <div className="flex flex-wrap gap-1 mt-1">
              {disposition && dispositionMeta[disposition] && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-bold leading-tight',
                    isDarkCardSurface
                      ? dispositionMeta[disposition].dark
                      : dispositionMeta[disposition].light
                  )}
                >
                  <span aria-hidden="true">{dispositionMeta[disposition].symbol}</span>
                  <span>{disposition}</span>
                </span>
              )}
              {rarity && (
                <span
                  className={cn(
                    'inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-bold leading-tight',
                    isDarkCardSurface
                      ? 'bg-purple-950 text-purple-200 border-purple-500/70'
                      : 'bg-purple-100 text-purple-900 border-purple-400'
                  )}
                >
                  {rarity}
                </span>
              )}
              {questStatus && (
                <span
                  className={cn(
                    'inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-bold leading-tight',
                    isDarkCardSurface
                      ? 'bg-amber-950 text-amber-200 border-amber-500/70'
                      : 'bg-amber-100 text-amber-950 border-amber-400'
                  )}
                >
                  {questStatus}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default memo(EntityNode)
