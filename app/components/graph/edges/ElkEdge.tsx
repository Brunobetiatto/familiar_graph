'use client';

import { BaseEdge, getBezierPath, type EdgeProps, type XYPosition } from '@xyflow/react';

type ElkEdgeData = {
  elkPoints?: XYPosition[];
};

function buildPath(points: XYPosition[]): string {
  const [first, ...rest] = points;
  let svgPathString = `M ${String(first.x)}, ${String(first.y)} `;

  rest.forEach((point) => {
    svgPathString += `L ${String(point.x)}, ${String(point.y)} `;
  });

  return svgPathString;
}

function getLabelPoint(points: XYPosition[]): XYPosition {
  if (points.length === 0) return { x: 0, y: 0 };

  let totalLength = 0;
  for (let i = 1; i < points.length; i += 1) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    totalLength += Math.hypot(dx, dy);
  }

  if (totalLength === 0) return points[0];

  const targetLength = totalLength / 2;
  let traveled = 0;

  for (let i = 1; i < points.length; i += 1) {
    const start = points[i - 1];
    const end = points[i];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const segmentLength = Math.hypot(dx, dy);

    if (segmentLength === 0) continue;

    if (traveled + segmentLength >= targetLength) {
      const t = (targetLength - traveled) / segmentLength;
      return {
        x: start.x + dx * t,
        y: start.y + dy * t,
      };
    }

    traveled += segmentLength;
  }

  return points[points.length - 1];
}

export default function ElkEdge(edgeProps: EdgeProps) {
  const {
    data,
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    style,
    label,
    labelStyle,
    labelShowBg,
    labelBgStyle,
    labelBgPadding,
    labelBgBorderRadius,
    markerEnd,
    markerStart,
    interactionWidth,
  } = edgeProps;

  const points = (data as ElkEdgeData | undefined)?.elkPoints;

  if (points && points.length >= 2) {
    const path = buildPath(points);
    const labelPoint = getLabelPoint(points);

    return (
      <BaseEdge
        path={path}
        labelX={labelPoint.x}
        labelY={labelPoint.y}
        label={label}
        labelStyle={labelStyle}
        labelShowBg={labelShowBg}
        labelBgStyle={labelBgStyle}
        labelBgPadding={labelBgPadding}
        labelBgBorderRadius={labelBgBorderRadius}
        style={style}
        markerStart={markerStart}
        markerEnd={markerEnd}
        interactionWidth={interactionWidth}
      />
    );
  }

  const [fallbackPath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <BaseEdge
      path={fallbackPath}
      labelX={labelX}
      labelY={labelY}
      label={label}
      labelStyle={labelStyle}
      labelShowBg={labelShowBg}
      labelBgStyle={labelBgStyle}
      labelBgPadding={labelBgPadding}
      labelBgBorderRadius={labelBgBorderRadius}
      style={style}
      markerStart={markerStart}
      markerEnd={markerEnd}
      interactionWidth={interactionWidth}
    />
  );
}
