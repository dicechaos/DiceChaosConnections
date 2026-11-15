import { Fragment, useEffect, useRef, useState } from 'react'
import { Handle, Position, useReactFlow, useUpdateNodeInternals } from '@xyflow/react'
import {
  CustomPerimeterPort,
  CustomPortShape,
  CustomPortSize,
  PerimeterSide
} from '../../types'
import { useStore } from '../../store/useStore'
import { normalizeHexColor } from '../../utils/colorUtils'
import {
  buildNodeBorderGeometry,
  formatPerimeterAnchorDescription,
  getDefaultPortStyleForId,
  projectPointToNodePerimeter,
  resolveActivePerimeterPorts,
  resolveNodeLocalCustomPortStyle,
  resolvePortDisplayName,
  sanitizeCustomPortShape,
  sanitizeCustomPortSize,
  sanitizeCustomPortVisibility
} from '../../utils/graphPipeline'

function sideToFlowPosition(side: PerimeterSide): Position {
  switch (side) {
    case 'top':
      return Position.Top
    case 'right':
      return Position.Right
    case 'bottom':
      return Position.Bottom
    case 'left':
      return Position.Left
  }
}

function resolvePortDimensions(
  shape: CustomPortShape,
  size: CustomPortSize,
  side: PerimeterSide
): { width: number; height: number } {
  if (shape === 'pill') {
    const length = size === 'sm' ? 13 : size === 'lg' ? 23 : 18
    const thickness = size === 'sm' ? 5.5 : size === 'lg' ? 8.5 : 7
    const isHorizontalEdge = side === 'top' || side === 'bottom'
    return isHorizontalEdge
      ? { width: length, height: thickness }
      : { width: thickness, height: length }
  }
  const px = size === 'sm' ? 10 : size === 'lg' ? 15.5 : 12
  return { width: px, height: px }
}

function resolvePortLabelTransform(side: PerimeterSide, size: CustomPortSize): string {
  const gap = size === 'lg' ? 11 : size === 'sm' ? 7 : 9
  switch (side) {
    case 'top':
      return `translate(-50%, calc(-100% - ${gap}px))`
    case 'bottom':
      return `translate(-50%, ${gap}px)`
    case 'left':
      return `translate(calc(-100% - ${gap}px), -50%)`
    case 'right':
      return `translate(${gap}px, -50%)`
  }
}

/**
 * Shared miniature preview glyph for Sidebar and Context Menu custom port pickers.
 */
export function PortShapePreviewGlyph({
  shape,
  color,
  isDark = false
}: {
  shape: CustomPortShape
  color: string
  isDark?: boolean
}) {
  if (shape === 'none') {
    return (
      <span
        aria-hidden="true"
        style={{ borderColor: color }}
        className="inline-block w-2.5 h-2.5 rounded-full border-[1.5px] border-dashed opacity-85 shrink-0"
      />
    )
  }
  if (shape === 'ring') {
    return (
      <span
        aria-hidden="true"
        style={{
          borderColor: color,
          backgroundColor: isDark ? '#0f172a' : '#ffffff'
        }}
        className="dcc-color-swatch inline-block w-2.5 h-2.5 rounded-full border-[2.5px] shrink-0"
      />
    )
  }
  if (shape === 'pill') {
    return (
      <span
        aria-hidden="true"
        style={{ backgroundColor: color }}
        className="dcc-color-swatch inline-block w-3.5 h-1.5 rounded-full border border-white/80 shadow-2xs shrink-0"
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      style={{
        backgroundColor: color,
        transform: shape === 'diamond' ? 'rotate(45deg)' : undefined,
        borderRadius: shape === 'circle' ? '9999px' : '2px'
      }}
      className="dcc-color-swatch inline-block w-2.5 h-2.5 border border-white/85 shadow-2xs shrink-0"
    />
  )
}

interface CustomPerimeterHandlesProps {
  nodeId: string
  ports?: CustomPerimeterPort[]
  localWidth: number
  localHeight: number
  shapeKey: string
  defaultAccentColor: string
  isDarkSurface?: boolean
  selected?: boolean
  isReadOnly: boolean
  isLocked: boolean
  isGroup?: boolean
}

export function CustomPerimeterHandles({
  nodeId,
  ports,
  localWidth,
  localHeight,
  shapeKey,
  defaultAccentColor,
  isDarkSurface = false,
  selected,
  isReadOnly,
  isLocked,
  isGroup = false
}: CustomPerimeterHandlesProps) {
  const { screenToFlowPosition } = useReactFlow()
  const updateNodeInternals = useUpdateNodeInternals()
  const [draggingPortId, setDraggingPortId] = useState<string | null>(null)
  const isDraggingRef = useRef(false)

  const portsSignature =
    ports && ports.length > 0
      ? ports
          .map(
            (p) =>
              `${p.id}:${p.side}:${p.offset}:${p.shape || ''}:${p.size || ''}:${p.disabled ? 1 : 0}`
          )
          .join('|')
      : ''

  // Refresh React Flow handle bounds when perimeter ports are added, removed, resized, or committed
  useEffect(() => {
    if (isDraggingRef.current) return
    updateNodeInternals(nodeId)
  }, [nodeId, portsSignature, localWidth, localHeight, shapeKey, updateNodeInternals])

  if (!ports || ports.length === 0) return null

  const handleAltPointerDownCapture = (
    e: React.PointerEvent<HTMLDivElement>,
    port: CustomPerimeterPort
  ) => {
    if (!e.altKey || e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()

    if (isReadOnly || isLocked) return

    const startClientX = e.clientX
    const startClientY = e.clientY
    let hasMoved = false
    let latestSide: PerimeterSide = port.side
    let latestOffset = port.offset
    isDraggingRef.current = true
    setDraggingPortId(port.id)

    const onPointerMove = (moveEvent: PointerEvent) => {
      const distPx = Math.hypot(
        moveEvent.clientX - startClientX,
        moveEvent.clientY - startClientY
      )
      if (!hasMoved && distPx < 3) return

      const st = useStore.getState()
      const currentNode = st.nodes.find((n) => n.id === nodeId)
      if (!currentNode) return

      if (!hasMoved) {
        hasMoved = true
        st.pushHistory(true)
      }

      const flowPos = screenToFlowPosition({
        x: moveEvent.clientX,
        y: moveEvent.clientY
      })
      const currentIsGroup =
        currentNode.type === 'groupRegion' || Boolean(currentNode.data?.isGroup)
      const geom = buildNodeBorderGeometry(currentNode, st.edges)
      const proj = projectPointToNodePerimeter(flowPos.x, flowPos.y, geom, {
        customPorts: resolveActivePerimeterPorts(currentNode.data, currentIsGroup),
        excludePortId: port.id,
        magneticSnap: !moveEvent.shiftKey
      })
      latestSide = proj.side
      latestOffset = proj.offset
      st.updateCustomPort(nodeId, port.id, { side: proj.side, offset: proj.offset }, false)
    }

    const finishInteraction = (cancelled: boolean) => {
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerup', onPointerUp)
      document.removeEventListener('pointercancel', onPointerCancel)
      isDraggingRef.current = false
      setDraggingPortId(null)

      if (cancelled) return

      const displayLabel = resolvePortDisplayName(port)
      if (!hasMoved) {
        useStore.getState().removeCustomPort(nodeId, port.id)
        requestAnimationFrame(() => updateNodeInternals(nodeId))
        window.dispatchEvent(
          new CustomEvent('dcc:announce', {
            detail: { message: `Removed connection point ${displayLabel}` }
          })
        )
      } else {
        requestAnimationFrame(() => updateNodeInternals(nodeId))
        const desc = formatPerimeterAnchorDescription(
          { side: latestSide, offset: latestOffset },
          displayLabel
        )
        window.dispatchEvent(
          new CustomEvent('dcc:announce', {
            detail: { message: `Connection point moved to ${desc}` }
          })
        )
      }
    }

    const onPointerUp = () => finishInteraction(false)
    const onPointerCancel = () => finishInteraction(true)

    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)
    document.addEventListener('pointercancel', onPointerCancel)
  }

  let customIdxCounter = 0

  return (
    <>
      {ports.map((port) => {
        const posStyle = resolveNodeLocalCustomPortStyle(
          port,
          localWidth,
          localHeight,
          shapeKey
        )

        // Inert hidden carrier handle when a pre-populated built-in port has been removed by the user
        if (port.disabled) {
          return (
            <Handle
              key={port.id}
              type="source"
              id={port.id}
              isConnectable={false}
              position={sideToFlowPosition(port.side)}
              style={{
                ...posStyle,
                width: '1px',
                height: '1px',
                minWidth: 0,
                minHeight: 0,
                border: 0,
                opacity: 0,
                pointerEvents: 'none'
              }}
              tabIndex={-1}
              aria-hidden="true"
              className="!opacity-0 !pointer-events-none no-export"
            />
          )
        }

        const portIdx = port.id.startsWith('cp-') ? customIdxCounter++ : undefined
        const displayName = resolvePortDisplayName(port, portIdx)
        const desc = formatPerimeterAnchorDescription(port, displayName)
        const isBeingDragged = draggingPortId === port.id
        const defaults = getDefaultPortStyleForId(port.id, isGroup)
        const shape = sanitizeCustomPortShape(port.shape, defaults.shape)
        const size = sanitizeCustomPortSize(port.size, defaults.size)
        const visibility = sanitizeCustomPortVisibility(port.visibility, defaults.visibility)
        const resolvedColor = normalizeHexColor(port.color) || defaultAccentColor
        const dims = resolvePortDimensions(shape, size, port.side)
        const isPublicMarker = visibility === 'public' && shape !== 'none'
        const isPublicLabel = visibility === 'public' && Boolean(port.showLabel && displayName)

        const shapeStyle: React.CSSProperties =
          shape === 'none'
            ? {
                width: `${dims.width}px`,
                height: `${dims.height}px`,
                backgroundColor: 'transparent',
                borderColor: resolvedColor,
                borderWidth: '2px',
                borderStyle: 'dashed',
                borderRadius: '9999px',
                transform: 'translate(-50%, -50%)'
              }
            : shape === 'ring'
              ? {
                  width: `${dims.width}px`,
                  height: `${dims.height}px`,
                  backgroundColor: isDarkSurface ? '#0f172a' : '#ffffff',
                  borderColor: resolvedColor,
                  borderWidth: size === 'sm' ? '2.25px' : size === 'lg' ? '3.5px' : '3px',
                  borderStyle: 'solid',
                  borderRadius: '9999px',
                  transform: 'translate(-50%, -50%)'
                }
              : {
                  width: `${dims.width}px`,
                  height: `${dims.height}px`,
                  backgroundColor: resolvedColor,
                  borderColor: '#ffffff',
                  borderWidth: size === 'sm' ? '1.5px' : '2px',
                  borderStyle: 'solid',
                  borderRadius:
                    shape === 'circle' || shape === 'pill'
                      ? '9999px'
                      : size === 'sm'
                        ? '2px'
                        : '3px',
                  transform:
                    shape === 'diamond'
                      ? 'translate(-50%, -50%) rotate(45deg)'
                      : 'translate(-50%, -50%)'
                }

        const visibilityClasses = isReadOnly
          ? isPublicMarker
            ? '!opacity-100 pointer-events-none'
            : '!opacity-0 pointer-events-none no-export'
          : isBeingDragged
            ? '!opacity-100 scale-120 cursor-grabbing ring-2 ring-amber-400/70'
            : shape === 'none'
              ? '!opacity-0 hover:!opacity-95'
              : visibility === 'hover'
                ? selected
                  ? '!opacity-95 hover:!opacity-100'
                  : '!opacity-0 group-hover:!opacity-100 hover:!opacity-100'
                : selected
                  ? '!opacity-100'
                  : '!opacity-85 group-hover:!opacity-100 hover:!opacity-100'

        const shouldRenderLabelBadge =
          Boolean(port.showLabel && displayName) && (!isReadOnly || visibility === 'public')

        return (
          <Fragment key={port.id}>
            <Handle
              type="source"
              id={port.id}
              position={sideToFlowPosition(port.side)}
              style={{
                ...posStyle,
                ...shapeStyle
              }}
              onPointerDownCapture={(e) => handleAltPointerDownCapture(e, port)}
              onMouseDownCapture={(e) => {
                if (e.altKey && e.button === 0) {
                  e.stopPropagation()
                  e.preventDefault()
                }
              }}
              onContextMenu={(e) => {
                if (isReadOnly) return
                e.preventDefault()
                e.stopPropagation()
                window.dispatchEvent(
                  new CustomEvent('dcc:port-context-menu', {
                    detail: {
                      nodeId,
                      portId: port.id,
                      screenX: e.clientX,
                      screenY: e.clientY
                    }
                  })
                )
              }}
              title={
                isReadOnly
                  ? port.label || undefined
                  : isLocked
                    ? `Connection point: ${desc} (Drag to connect)`
                    : `Connection point: ${desc} — Drag to connect • Right-click to style • Alt+Drag to move • Alt+Click to remove`
              }
              className={[
                'dcc-custom-port transition-opacity z-35',
                shape === 'none' ? 'dcc-custom-port-flush' : '',
                !isPublicMarker ? 'no-export' : '',
                isGroup ? 'dcc-group-interactive' : '',
                visibilityClasses
              ]
                .filter(Boolean)
                .join(' ')}
            />
            {shouldRenderLabelBadge && (
              <span
                aria-hidden="true"
                style={{
                  left: posStyle.left,
                  top: posStyle.top,
                  transform: resolvePortLabelTransform(port.side, size),
                  borderColor: `color-mix(in oklab, ${resolvedColor} 65%, ${isDarkSurface ? '#475569' : '#cbd5e1'})`,
                  backgroundColor: isDarkSurface
                    ? `color-mix(in oklab, ${resolvedColor} 20%, #0f172a)`
                    : `color-mix(in oklab, ${resolvedColor} 12%, #ffffff)`,
                  color: isDarkSurface
                    ? `color-mix(in oklab, ${resolvedColor} 45%, #f8fafc)`
                    : `color-mix(in oklab, ${resolvedColor} 68%, #0f172a)`
                }}
                className={[
                  'absolute z-35 pointer-events-none select-none whitespace-nowrap px-1.5 py-0.5 rounded text-[9px] font-bold leading-none border shadow-2xs transition-opacity',
                  !isPublicLabel ? 'no-export' : '',
                  !isReadOnly && visibility === 'hover' && !selected && !isBeingDragged
                    ? 'opacity-0 group-hover:opacity-100'
                    : 'opacity-95'
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {displayName}
              </span>
            )}
          </Fragment>
        )
      })}
    </>
  )
}
