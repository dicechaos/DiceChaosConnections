import { useState } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  Position,
  ViewportPortal,
  getBezierPath,
  useInternalNode,
  useReactFlow
} from '@xyflow/react'
import { DndEdge, EntityNodeData, PerimeterSide } from '../../types'
import { useStore } from '../../store/useStore'
import {
  buildNodeBorderGeometry,
  computeEntityVisualScale,
  findConnectableNodeAtPoint,
  formatPerimeterAnchorDescription,
  projectPointToNodePerimeter,
  resolveActivePerimeterPorts,
  resolveEffectiveEdgePerimeterAnchor,
  resolveEntityExplicitSize,
  resolveNodeShapeKey,
  resolvePerimeterAnchorPoint,
  resolvePortDisplayName,
  snapCoordinateToStep,
  snapEndpointToNodeBorder,
  stepPerimeterAnchor
} from '../../utils/graphPipeline'
import { line, curveCatmullRom, curveLinear } from 'd3-shape'
import { EyeOff, FileText, Lock, MessageSquareText } from 'lucide-react'

function toBorderSide(pos: Position): PerimeterSide {
  if (pos === Position.Top) return 'top'
  if (pos === Position.Left) return 'left'
  if (pos === Position.Right) return 'right'
  return 'bottom'
}

function fromBorderSide(side: PerimeterSide): Position {
  if (side === 'top') return Position.Top
  if (side === 'left') return Position.Left
  if (side === 'right') return Position.Right
  return Position.Bottom
}

interface EndpointDragPreview {
  which: 'source' | 'target'
  nodeId: string
  nodeLabel: string
  side: PerimeterSide
  offset: number
  x: number
  y: number
  matchedPortId?: string
  matchedPortLabel?: string
  isCrossNodeReconnect: boolean
}

export default function CustomEdge({
  id,
  source,
  target,
  sourceHandleId,
  targetHandleId,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected
}: EdgeProps<DndEdge>) {
  const {
    nodes,
    edges,
    campaignEdition,
    isPlayerView,
    updateWaypoint,
    removeWaypoint,
    updateEdgeData,
    updateEdgeEndpointAnchor,
    reconnectEdgeEndpoint,
    canvasTheme,
    isDarkMode,
    activeSnapshotId,
    dragSnapEnabled,
    dragSnapSize
  } = useStore()
  const { screenToFlowPosition } = useReactFlow()
  const [dragPreview, setDragPreview] = useState<EndpointDragPreview | null>(null)
  const sourceInternalNode = useInternalNode(source)
  const targetInternalNode = useInternalNode(target)

  const hideSecrets = isPlayerView || campaignEdition === 'player'
  const isSnapshotPreview = activeSnapshotId !== null
  const isReadOnly =
    isPlayerView || isSnapshotPreview || (campaignEdition === 'player' && !data?.isPlayerCreated)
  const isHidden = hideSecrets && data?.isHidden
  if (isHidden) return null

  const direction = data?.direction || 'none'
  const showMarkerEnd = direction === 'forward' || direction === 'bidirectional'
  const showMarkerStart = direction === 'reverse' || direction === 'bidirectional'

  const baseThickness = data?.thickness || 2
  const effectiveStrokeWidth = selected ? baseThickness + 1.5 : baseThickness
  const markerSizePx = Math.max(10.5, 7.5 + effectiveStrokeWidth * 1.5)
  // Marker tip sits at x=11.2 in a 12-unit viewBox while refX=9.0 hides the stroke inside the triangle body;
  // pull back the path endpoint by that exact lead (minus 0.35px overlap) so the razor-sharp tip kisses the outer border flush!
  const arrowOutsetPx = (2.2 * markerSizePx) / 12 - 0.35

  const sourceData = sourceInternalNode?.data as EntityNodeData | undefined
  const isSourceGroup =
    sourceInternalNode?.type === 'groupRegion' || Boolean(sourceData?.isGroup)
  const sourceExplicit = isSourceGroup ? undefined : resolveEntityExplicitSize(sourceData)
  const sourceW = isSourceGroup
    ? Math.max(220, sourceData?.groupWidth || sourceInternalNode?.measured?.width || 360)
    : sourceExplicit?.width || sourceInternalNode?.measured?.width
  const sourceH = isSourceGroup
    ? Math.max(150, sourceData?.groupHeight || sourceInternalNode?.measured?.height || 240)
    : sourceExplicit?.height || sourceInternalNode?.measured?.height

  const sourceGeom =
    sourceInternalNode &&
    (sourceInternalNode.type === 'entity' || isSourceGroup) &&
    sourceW &&
    sourceH
      ? {
          positionAbsolute: sourceInternalNode.internals.positionAbsolute,
          width: sourceW,
          height: sourceH,
          shape: isSourceGroup ? resolveNodeShapeKey(sourceData, true) : sourceData?.shape,
          scaleFactor: isSourceGroup
            ? 1
            : computeEntityVisualScale(
                sourceInternalNode.id,
                sourceData,
                sourceInternalNode.selected,
                edges
              )
        }
      : null

  const targetData = targetInternalNode?.data as EntityNodeData | undefined
  const isTargetGroup =
    targetInternalNode?.type === 'groupRegion' || Boolean(targetData?.isGroup)
  const targetExplicit = isTargetGroup ? undefined : resolveEntityExplicitSize(targetData)
  const targetW = isTargetGroup
    ? Math.max(220, targetData?.groupWidth || targetInternalNode?.measured?.width || 360)
    : targetExplicit?.width || targetInternalNode?.measured?.width
  const targetH = isTargetGroup
    ? Math.max(150, targetData?.groupHeight || targetInternalNode?.measured?.height || 240)
    : targetExplicit?.height || targetInternalNode?.measured?.height

  const targetGeom =
    targetInternalNode &&
    (targetInternalNode.type === 'entity' || isTargetGroup) &&
    targetW &&
    targetH
      ? {
          positionAbsolute: targetInternalNode.internals.positionAbsolute,
          width: targetW,
          height: targetH,
          shape: isTargetGroup ? resolveNodeShapeKey(targetData, true) : targetData?.shape,
          scaleFactor: isTargetGroup
            ? 1
            : computeEntityVisualScale(
                targetInternalNode.id,
                targetData,
                targetInternalNode.selected,
                edges
              )
        }
      : null

  const sourceResolved = resolveEffectiveEdgePerimeterAnchor({
    handleId: sourceHandleId,
    explicitAnchor: data?.sourceAnchor,
    nodeData: sourceData,
    fallbackSide: toBorderSide(sourcePosition)
  })

  const targetResolved = resolveEffectiveEdgePerimeterAnchor({
    handleId: targetHandleId,
    explicitAnchor: data?.targetAnchor,
    nodeData: targetData,
    fallbackSide: toBorderSide(targetPosition)
  })

  const sourceOutset = showMarkerStart ? arrowOutsetPx : -1.2
  const targetOutset = showMarkerEnd ? arrowOutsetPx : -1.2

  let effectiveSourcePosition = sourcePosition
  let snappedSource = { x: sourceX, y: sourceY }
  let sourceBorderDot = { x: sourceX, y: sourceY }

  if (dragPreview?.which === 'source') {
    const previewNode = nodes.find((n) => n.id === dragPreview.nodeId)
    effectiveSourcePosition = fromBorderSide(dragPreview.side)
    sourceBorderDot = { x: dragPreview.x, y: dragPreview.y }
    snappedSource = previewNode
      ? resolvePerimeterAnchorPoint(
          { side: dragPreview.side, offset: dragPreview.offset },
          buildNodeBorderGeometry(previewNode, edges),
          sourceOutset
        )
      : sourceBorderDot
  } else if (sourceGeom && sourceResolved.isExplicitOrCustom) {
    effectiveSourcePosition = fromBorderSide(sourceResolved.anchor.side)
    snappedSource = resolvePerimeterAnchorPoint(sourceResolved.anchor, sourceGeom, sourceOutset)
    sourceBorderDot = resolvePerimeterAnchorPoint(sourceResolved.anchor, sourceGeom, 0)
  } else if (sourceGeom) {
    snappedSource = snapEndpointToNodeBorder(
      sourceX,
      sourceY,
      toBorderSide(sourcePosition),
      sourceGeom,
      sourceOutset
    )
    sourceBorderDot = snapEndpointToNodeBorder(
      sourceX,
      sourceY,
      toBorderSide(sourcePosition),
      sourceGeom,
      0
    )
  }

  let effectiveTargetPosition = targetPosition
  let snappedTarget = { x: targetX, y: targetY }
  let targetBorderDot = { x: targetX, y: targetY }

  if (dragPreview?.which === 'target') {
    const previewNode = nodes.find((n) => n.id === dragPreview.nodeId)
    effectiveTargetPosition = fromBorderSide(dragPreview.side)
    targetBorderDot = { x: dragPreview.x, y: dragPreview.y }
    snappedTarget = previewNode
      ? resolvePerimeterAnchorPoint(
          { side: dragPreview.side, offset: dragPreview.offset },
          buildNodeBorderGeometry(previewNode, edges),
          targetOutset
        )
      : targetBorderDot
  } else if (targetGeom && targetResolved.isExplicitOrCustom) {
    effectiveTargetPosition = fromBorderSide(targetResolved.anchor.side)
    snappedTarget = resolvePerimeterAnchorPoint(targetResolved.anchor, targetGeom, targetOutset)
    targetBorderDot = resolvePerimeterAnchorPoint(targetResolved.anchor, targetGeom, 0)
  } else if (targetGeom) {
    snappedTarget = snapEndpointToNodeBorder(
      targetX,
      targetY,
      toBorderSide(targetPosition),
      targetGeom,
      targetOutset
    )
    targetBorderDot = snapEndpointToNodeBorder(
      targetX,
      targetY,
      toBorderSide(targetPosition),
      targetGeom,
      0
    )
  }

  const waypoints = data?.waypoints || []
  let edgePath = ''
  let labelX = 0
  let labelY = 0

  if (waypoints.length > 0) {
    const points = [
      [snappedSource.x, snappedSource.y],
      ...waypoints.map((w) => [w.x, w.y]),
      [snappedTarget.x, snappedTarget.y]
    ]

    const generator = line()
      .x((d) => d[0])
      .y((d) => d[1])
      .curve(data?.pathStyle === 'straight' ? curveLinear : curveCatmullRom.alpha(0.5))

    edgePath = generator(points as [number, number][]) || ''

    const midIndex = Math.floor(points.length / 2)
    if (points.length % 2 === 0) {
      labelX = (points[midIndex - 1][0] + points[midIndex][0]) / 2
      labelY = (points[midIndex - 1][1] + points[midIndex][1]) / 2
    } else {
      labelX = points[midIndex][0]
      labelY = points[midIndex][1]
    }
  } else {
    const [path, lx, ly] = getBezierPath({
      sourceX: snappedSource.x,
      sourceY: snappedSource.y,
      sourcePosition: effectiveSourcePosition,
      targetX: snappedTarget.x,
      targetY: snappedTarget.y,
      targetPosition: effectiveTargetPosition
    })
    edgePath = path
    labelX = lx
    labelY = ly
  }

  const finalLabelX = labelX + (data?.labelPos?.x || 0)
  const finalLabelY = labelY + (data?.labelPos?.y || 0)

  const color = data?.color || '#94a3b8'
  const strokeDasharray =
    data?.diffStatus === 'removed'
      ? '4,4'
      : data?.lineStyle === 'dashed'
        ? '6,5'
        : data?.lineStyle === 'dotted'
          ? '2,4'
          : 'none'

  const isFaded = Boolean(data?.isSearchFaded || data?.isDegreeFaded)
  const strokeBaseOpacity = data?.diffStatus === 'removed' ? 0.35 : data?.isHidden ? 0.58 : 1
  const finalStrokeOpacity = isFaded ? strokeBaseOpacity * 0.15 : strokeBaseOpacity

  // Keep DM-hidden connection labels crisp and readable in DM View instead of fading to 0.35
  const labelBaseOpacity = data?.diffStatus === 'removed' ? 0.45 : 0.96
  const finalLabelOpacity = isFaded ? labelBaseOpacity * 0.15 : labelBaseOpacity

  const markerEndId = `edge-arrow-end-${id}`
  const markerStartId = `edge-arrow-start-${id}`

  const handleAnchorPointerDown = (
    e: React.PointerEvent<HTMLButtonElement>,
    waypoint: { id: string; x: number; y: number }
  ) => {
    if (isReadOnly || e.button !== 0) return
    e.stopPropagation()

    if (e.altKey) {
      e.preventDefault()
      removeWaypoint(id, waypoint.id)
      return
    }

    const el = e.currentTarget
    const startFlowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    const offsetX = startFlowPos.x - waypoint.x
    const offsetY = startFlowPos.y - waypoint.y
    const initialX = waypoint.x
    const initialY = waypoint.y
    let hasMoved = false

    el.setPointerCapture(e.pointerId)

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (!el.hasPointerCapture(moveEvent.pointerId)) return
      const flowPos = screenToFlowPosition({ x: moveEvent.clientX, y: moveEvent.clientY })
      const effectiveSnap = moveEvent.altKey ? !dragSnapEnabled : dragSnapEnabled
      const nextX = snapCoordinateToStep(flowPos.x - offsetX, effectiveSnap, dragSnapSize)
      const nextY = snapCoordinateToStep(flowPos.y - offsetY, effectiveSnap, dragSnapSize)

      if (!hasMoved && (Math.abs(nextX - initialX) > 1 || Math.abs(nextY - initialY) > 1)) {
        hasMoved = true
        el.classList.add('dragging')
        useStore.getState().pushHistory(true)
      }

      if (hasMoved) {
        updateWaypoint(id, waypoint.id, nextX, nextY)
      }
    }

    const onPointerUp = (upEvent: PointerEvent) => {
      if (el.hasPointerCapture(upEvent.pointerId)) {
        el.releasePointerCapture(upEvent.pointerId)
      }
    }

    const cleanup = () => {
      el.classList.remove('dragging')
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('lostpointercapture', cleanup)
    }

    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('lostpointercapture', cleanup)
  }

  const handleAnchorKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    waypoint: { id: string; x: number; y: number }
  ) => {
    if (isReadOnly) return

    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      e.stopPropagation()
      removeWaypoint(id, waypoint.id)
      return
    }

    const step = e.shiftKey ? 1 : dragSnapEnabled ? dragSnapSize : 8
    let dx = 0
    let dy = 0
    if (e.key === 'ArrowLeft') dx = -step
    else if (e.key === 'ArrowRight') dx = step
    else if (e.key === 'ArrowUp') dy = -step
    else if (e.key === 'ArrowDown') dy = step
    else return

    e.preventDefault()
    e.stopPropagation()
    useStore.getState().pushHistory(false)
    updateWaypoint(id, waypoint.id, waypoint.x + dx, waypoint.y + dy)
  }

  const handleEndpointPointerDown = (
    e: React.PointerEvent<HTMLButtonElement>,
    which: 'source' | 'target'
  ) => {
    if (isReadOnly || e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()

    const el = e.currentTarget
    const startClientX = e.clientX
    const startClientY = e.clientY
    const originalNodeId = which === 'source' ? source : target
    const otherNodeId = which === 'source' ? target : source
    const startedWithAlt = e.altKey

    let hasMoved = false
    let latestPreview: EndpointDragPreview | null = null

    const onPointerMove = (moveEvent: PointerEvent) => {
      const distPx = Math.hypot(
        moveEvent.clientX - startClientX,
        moveEvent.clientY - startClientY
      )
      if (!hasMoved && distPx < 3) return

      if (!hasMoved) {
        hasMoved = true
        el.classList.add('dragging')
      }

      const st = useStore.getState()
      const flowPos = screenToFlowPosition({
        x: moveEvent.clientX,
        y: moveEvent.clientY
      })
      const candidateNode = findConnectableNodeAtPoint(
        flowPos.x,
        flowPos.y,
        st.nodes,
        st.edges,
        {
          currentAttachmentNodeId: originalNodeId.startsWith('proxy-')
            ? undefined
            : originalNodeId,
          disallowNodeId: otherNodeId,
          hideSecrets
        }
      )
      if (!candidateNode) return

      const candidateIsGroup =
        candidateNode.type === 'groupRegion' || Boolean(candidateNode.data?.isGroup)
      const activePorts = resolveActivePerimeterPorts(candidateNode.data, candidateIsGroup)
      const candidateGeom = buildNodeBorderGeometry(candidateNode, st.edges)
      const proj = projectPointToNodePerimeter(flowPos.x, flowPos.y, candidateGeom, {
        customPorts: activePorts,
        magneticSnap: !moveEvent.altKey
      })
      const matchedPort = proj.matchedPortId
        ? activePorts.find((p) => p.id === proj.matchedPortId)
        : undefined

      const nextPreview: EndpointDragPreview = {
        which,
        nodeId: candidateNode.id,
        nodeLabel: candidateNode.data?.label || 'Entity',
        side: proj.side,
        offset: proj.offset,
        x: proj.x,
        y: proj.y,
        matchedPortId: proj.matchedPortId,
        matchedPortLabel: matchedPort ? resolvePortDisplayName(matchedPort) : undefined,
        isCrossNodeReconnect: candidateNode.id !== originalNodeId
      }
      latestPreview = nextPreview
      setDragPreview(nextPreview)
    }

    const finishDrag = (cancelled: boolean) => {
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerup', onPointerUp)
      document.removeEventListener('pointercancel', onPointerCancel)
      el.classList.remove('dragging')
      setDragPreview(null)

      if (cancelled) return

      if (!hasMoved) {
        if (startedWithAlt) {
          updateEdgeEndpointAnchor(id, which, { anchor: null }, true)
          window.dispatchEvent(
            new CustomEvent('dcc:announce', {
              detail: {
                message: `Reset ${which} attachment point to default`
              }
            })
          )
        }
        return
      }

      if (!latestPreview) return

      const desc = formatPerimeterAnchorDescription(
        { side: latestPreview.side, offset: latestPreview.offset },
        latestPreview.matchedPortLabel
      )

      if (latestPreview.isCrossNodeReconnect) {
        reconnectEdgeEndpoint(
          id,
          which,
          latestPreview.nodeId,
          {
            anchor: { side: latestPreview.side, offset: latestPreview.offset },
            customPortId: latestPreview.matchedPortId
          },
          true
        )
        window.dispatchEvent(
          new CustomEvent('dcc:announce', {
            detail: {
              message: `Reconnected ${which} endpoint to ${latestPreview.nodeLabel} (${desc})`
            }
          })
        )
      } else {
        updateEdgeEndpointAnchor(
          id,
          which,
          {
            anchor: { side: latestPreview.side, offset: latestPreview.offset },
            customPortId: latestPreview.matchedPortId
          },
          true
        )
        window.dispatchEvent(
          new CustomEvent('dcc:announce', {
            detail: {
              message: `Moved ${which} endpoint to ${desc}`
            }
          })
        )
      }
    }

    const onPointerUp = () => finishDrag(false)
    const onPointerCancel = () => finishDrag(true)

    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)
    document.addEventListener('pointercancel', onPointerCancel)
  }

  const handleEndpointKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    which: 'source' | 'target'
  ) => {
    if (isReadOnly) return
    const endpointId = which === 'source' ? source : target
    if (endpointId.startsWith('proxy-')) return

    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      e.stopPropagation()
      updateEdgeEndpointAnchor(id, which, { anchor: null }, true)
      window.dispatchEvent(
        new CustomEvent('dcc:announce', {
          detail: { message: `Reset ${which} attachment point to default` }
        })
      )
      return
    }

    if (
      e.key !== 'ArrowLeft' &&
      e.key !== 'ArrowRight' &&
      e.key !== 'ArrowUp' &&
      e.key !== 'ArrowDown'
    ) {
      return
    }

    e.preventDefault()
    e.stopPropagation()

    const currentResolved = which === 'source' ? sourceResolved : targetResolved
    const curSide = currentResolved.anchor.side
    const stepMag = e.shiftKey ? 0.01 : 0.05

    // Map arrow keys to spatially natural screen direction on the active edge
    let clockwiseDelta = 0
    if (curSide === 'top') {
      clockwiseDelta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? stepMag : -stepMag
    } else if (curSide === 'bottom') {
      clockwiseDelta = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? -stepMag : stepMag
    } else if (curSide === 'right') {
      clockwiseDelta = e.key === 'ArrowDown' || e.key === 'ArrowLeft' ? stepMag : -stepMag
    } else {
      clockwiseDelta = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? -stepMag : stepMag
    }

    const nextAnchor = stepPerimeterAnchor(currentResolved.anchor, clockwiseDelta)
    useStore.getState().pushHistory(false)
    updateEdgeEndpointAnchor(id, which, { anchor: nextAnchor }, false)
    const desc = formatPerimeterAnchorDescription(nextAnchor)
    window.dispatchEvent(
      new CustomEvent('dcc:announce', {
        detail: { message: `${which === 'source' ? 'Source' : 'Target'} endpoint at ${desc}` }
      })
    )
  }

  const handleLabelPointerDown = (e: React.PointerEvent) => {
    if (isReadOnly) return
    e.stopPropagation()
    const el = e.currentTarget as HTMLDivElement
    el.setPointerCapture(e.pointerId)

    const startFlowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    const startOffsetX = data?.labelPos?.x || 0
    const startOffsetY = data?.labelPos?.y || 0
    let hasMoved = false

    const onPointerMove = (moveEvent: PointerEvent) => {
      const currentFlowPos = screenToFlowPosition({ x: moveEvent.clientX, y: moveEvent.clientY })
      const dx = currentFlowPos.x - startFlowPos.x
      const dy = currentFlowPos.y - startFlowPos.y
      if (!hasMoved && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
        hasMoved = true
        useStore.getState().pushHistory(true)
      }
      if (hasMoved) {
        updateEdgeData(id, { labelPos: { x: startOffsetX + dx, y: startOffsetY + dy } }, false)
      }
    }

    const onPointerUp = (upEvent: PointerEvent) => {
      el.releasePointerCapture(upEvent.pointerId)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', onPointerUp)
      if (!hasMoved) {
        const st = useStore.getState()
        st.setNodes(st.nodes.map((n) => ({ ...n, selected: false })))
        st.setEdges(st.edges.map((ed) => ({ ...ed, selected: ed.id === id })))
      }
    }

    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', onPointerUp)
  }

  const activateReadOnlySelection = () => {
    if (isSnapshotPreview) {
      window.dispatchEvent(new CustomEvent('dcc:select-edge', { detail: { edgeId: id } }))
      return
    }
    const st = useStore.getState()
    st.setNodes(st.nodes.map((n) => ({ ...n, selected: false })))
    st.setEdges(st.edges.map((ed) => ({ ...ed, selected: ed.id === id })))
  }

  const selectEdgeReadOnly = (e: React.MouseEvent) => {
    if (!isReadOnly) return
    e.stopPropagation()
    activateReadOnlySelection()
  }

  const handleLabelKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isReadOnly) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      e.stopPropagation()
      activateReadOnlySelection()
    }
  }

  const isDarkPillSurface = canvasTheme === 'arcane' || (canvasTheme === 'modern' && isDarkMode)

  const labelSurfaceClass =
    canvasTheme === 'arcane'
      ? 'bg-[#0f172a]'
      : canvasTheme === 'parchment'
        ? 'bg-[#fdfaf2]'
        : canvasTheme === 'corkboard'
          ? 'bg-[#fffef9] shadow-md'
          : isDarkMode
            ? 'bg-slate-800'
            : 'bg-white'

  // Guarantee WCAG AA contrast for any stroke color (including bright yellow #eab308 & light slate #94a3b8)
  const labelTextColor = isDarkPillSurface
    ? `color-mix(in oklab, ${color} 55%, #ffffff)`
    : `color-mix(in oklab, ${color} 46%, #0f172a)`

  const labelBorderColor = isDarkPillSurface
    ? `color-mix(in oklab, ${color} 78%, #ffffff)`
    : `color-mix(in oklab, ${color} 80%, #334155)`

  const hasPublicNotes = Boolean(data?.publicNotes?.trim())
  const hasPartyNotes = Boolean(data?.partyNotes?.trim())
  const hasDmNotes = !hideSecrets && Boolean(data?.dmNotes?.trim())
  const showDmHiddenBadge = !hideSecrets && Boolean(data?.isHidden)

  return (
    <>
      <defs>
        {showMarkerEnd && (
          <marker
            id={markerEndId}
            viewBox="0 0 12 12"
            refX="9"
            refY="6"
            markerUnits="userSpaceOnUse"
            markerWidth={markerSizePx}
            markerHeight={markerSizePx}
            orient="auto-start-reverse"
          >
            <path d="M 0.6 1.2 L 11.2 6 L 0.6 10.8 z" fill={color} />
          </marker>
        )}
        {showMarkerStart && (
          <marker
            id={markerStartId}
            viewBox="0 0 12 12"
            refX="9"
            refY="6"
            markerUnits="userSpaceOnUse"
            markerWidth={markerSizePx}
            markerHeight={markerSizePx}
            orient="auto-start-reverse"
          >
            <path d="M 0.6 1.2 L 11.2 6 L 0.6 10.8 z" fill={color} />
          </marker>
        )}
      </defs>

      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={showMarkerEnd ? `url(#${markerEndId})` : undefined}
        markerStart={showMarkerStart ? `url(#${markerStartId})` : undefined}
        style={{
          stroke: color,
          strokeWidth: effectiveStrokeWidth,
          strokeDasharray,
          strokeLinecap:
            showMarkerStart || showMarkerEnd || data?.lineStyle === 'dashed' ? 'butt' : 'round',
          opacity: finalStrokeOpacity,
          transition: 'opacity 250ms ease'
        }}
      />

      {/* Invisible wider interaction target */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={Math.max(20, baseThickness + 12)}
        className="react-flow__edge-interaction"
      />

      {data?.label && (
        <EdgeLabelRenderer>
          <div
            role={isReadOnly ? 'button' : undefined}
            tabIndex={isReadOnly ? 0 : undefined}
            aria-label={isReadOnly ? `Inspect relationship: ${data.label}` : undefined}
            onPointerDown={handleLabelPointerDown}
            onClick={selectEdgeReadOnly}
            onKeyDown={handleLabelKeyDown}
            className={`edge-label-pill nodrag nopan absolute px-2 py-0.5 border rounded-md text-xs font-bold whitespace-nowrap shadow-sm flex items-center gap-1.5 pointer-events-auto ${labelSurfaceClass} ${
              showDmHiddenBadge ? 'border-dashed' : 'border-solid'
            } ${
              isReadOnly
                ? 'edge-label-pill-readonly cursor-pointer'
                : 'cursor-grab active:cursor-grabbing'
            } ${selected ? 'ring-2 ring-blue-500' : ''}`}
            style={
              {
                translate: `calc(${finalLabelX}px - 50%) calc(${finalLabelY}px - 50%)`,
                '--label-x': `${finalLabelX}px`,
                '--label-y': `${finalLabelY}px`,
                color: labelTextColor,
                borderColor: labelBorderColor,
                opacity: finalLabelOpacity
              } as React.CSSProperties
            }
          >
            <span
              aria-hidden="true"
              className="w-2 h-2 rounded-full shrink-0 border border-black/15"
              style={{ backgroundColor: color }}
            />
            <span>{data.label}</span>
            {data.diffStatus && (
              <span
                title={`Snapshot Diff: ${data.diffStatus}`}
                className={`px-1 rounded text-[9px] font-extrabold uppercase tracking-wider ${
                  data.diffStatus === 'added'
                    ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                    : data.diffStatus === 'modified'
                      ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                      : 'bg-rose-500/20 text-rose-700 dark:text-rose-300'
                }`}
              >
                {data.diffStatus === 'added' ? '+' : data.diffStatus === 'modified' ? '~' : '−'}
              </span>
            )}
            {showDmHiddenBadge && (
              <span title="Hidden from Players" className="inline-flex items-center opacity-85">
                <EyeOff size={11} className="shrink-0" />
              </span>
            )}
            {hasPublicNotes && (
              <span title="Has Public Relationship Lore" className="inline-flex items-center">
                <FileText size={10} className="opacity-80 shrink-0" />
              </span>
            )}
            {hasPartyNotes && (
              <span title="Has Party Notes" className="inline-flex items-center">
                <MessageSquareText
                  size={10}
                  className={
                    isDarkPillSurface ? 'text-indigo-300 shrink-0' : 'text-indigo-600 shrink-0'
                  }
                />
              </span>
            )}
            {hasDmNotes && (
              <Lock
                size={10}
                className={
                  isDarkPillSurface ? 'text-amber-400 shrink-0' : 'text-amber-600 shrink-0'
                }
              />
            )}
          </div>
        </EdgeLabelRenderer>
      )}

      {selected && !isReadOnly && waypoints.length > 0 && (
        <ViewportPortal>
          {waypoints.map((w, idx) => (
            <button
              key={w.id}
              type="button"
              aria-label={`Curve anchor ${idx + 1} of ${waypoints.length} on ${
                data?.label || 'connection'
              }. Drag or use arrow keys to move, Delete or double-click to remove.`}
              title={`Anchor ${idx + 1} — Drag anywhere on dot to bend line • Arrow keys to nudge • Double-click, Alt+click, or Delete to remove`}
              className="edge-anchor-handle nodrag nopan no-export"
              style={{
                left: 0,
                top: 0,
                transform: `translate(${w.x}px, ${w.y}px) translate(-50%, -50%)`,
                zIndex: 40
              }}
              onPointerDown={(e) => handleAnchorPointerDown(e, w)}
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                removeWaypoint(id, w.id)
              }}
              onKeyDown={(e) => handleAnchorKeyDown(e, w)}
            />
          ))}
        </ViewportPortal>
      )}

      {selected && !isReadOnly && (
        <ViewportPortal>
          <button
            type="button"
            aria-label={`Source attachment point on ${
              sourceData?.label || 'connection start'
            } (${formatPerimeterAnchorDescription(
              sourceResolved.anchor,
              sourceResolved.customPort?.label
            )}). Drag along border or onto another entity, or use arrow keys to move.`}
            title={`Source endpoint (${formatPerimeterAnchorDescription(
              sourceResolved.anchor,
              sourceResolved.customPort?.label
            )}) — Drag around edge or onto another entity • Hold Alt for smooth free slide • Arrow keys to nudge • Double-click or Alt+Click to reset`}
            className={`edge-endpoint-handle nodrag nopan no-export ${
              sourceResolved.customPort ? 'is-custom-port' : ''
            }`}
            style={{
              left: 0,
              top: 0,
              transform: `translate(${sourceBorderDot.x}px, ${sourceBorderDot.y}px) translate(-50%, -50%)`,
              zIndex: 3500
            }}
            onPointerDown={(e) => handleEndpointPointerDown(e, 'source')}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              updateEdgeEndpointAnchor(id, 'source', { anchor: null }, true)
            }}
            onKeyDown={(e) => handleEndpointKeyDown(e, 'source')}
          />
          <button
            type="button"
            aria-label={`Target attachment point on ${
              targetData?.label || 'connection end'
            } (${formatPerimeterAnchorDescription(
              targetResolved.anchor,
              targetResolved.customPort?.label
            )}). Drag along border or onto another entity, or use arrow keys to move.`}
            title={`Target endpoint (${formatPerimeterAnchorDescription(
              targetResolved.anchor,
              targetResolved.customPort?.label
            )}) — Drag around edge or onto another entity • Hold Alt for smooth free slide • Arrow keys to nudge • Double-click or Alt+Click to reset`}
            className={`edge-endpoint-handle nodrag nopan no-export ${
              targetResolved.customPort ? 'is-custom-port' : ''
            }`}
            style={{
              left: 0,
              top: 0,
              transform: `translate(${targetBorderDot.x}px, ${targetBorderDot.y}px) translate(-50%, -50%)`,
              zIndex: 3500
            }}
            onPointerDown={(e) => handleEndpointPointerDown(e, 'target')}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              updateEdgeEndpointAnchor(id, 'target', { anchor: null }, true)
            }}
            onKeyDown={(e) => handleEndpointKeyDown(e, 'target')}
          />
          {dragPreview && (dragPreview.isCrossNodeReconnect || dragPreview.matchedPortId) && (
            <div
              aria-hidden="true"
              className={`pointer-events-none no-export absolute rounded-full border-2 ${
                dragPreview.matchedPortId
                  ? 'w-6 h-6 border-amber-500 bg-amber-400/20'
                  : 'w-7 h-7 border-emerald-500 bg-emerald-400/15'
              }`}
              style={{
                left: 0,
                top: 0,
                transform: `translate(${dragPreview.x}px, ${dragPreview.y}px) translate(-50%, -50%)`,
                zIndex: 3499
              }}
            />
          )}
        </ViewportPortal>
      )}
    </>
  )
}
