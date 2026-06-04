'use client';

import { BaseEdge, getBezierPath, type EdgeProps, type XYPosition } from '@xyflow/react';

type ElkEdgeData = {
  elkPoints?: XYPosition[];
  isSelected?: boolean;
};

const WAVE_DURATION_SECONDS = 12;
const WAVE_STOPS = [
  { offset: -0.28, opacity: 0 },
  { offset: -0.12, opacity: 0.18 },
  { offset: 0, opacity: 0.48 },
  { offset: 0.12, opacity: 0.18 },
  { offset: 0.28, opacity: 0 },
];

function sanitizeSvgId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '-');
}

function getDistance(start: XYPosition, end: XYPosition): number {
  return Math.hypot(end.x - start.x, end.y - start.y);
}

function EdgeWave({
  id,
  points,
}: {
  id: string;
  points: XYPosition[];
}) {
  const segments = points.slice(1).map((point, index) => {
    const start = points[index];
    const length = Math.max(getDistance(start, point), 1);

    return {
      start,
      end: point,
      length,
    };
  });

  const totalLength = Math.max(
    segments.reduce((total, segment) => total + segment.length, 0),
    1
  );
  const segmentsWithOffsets = segments.reduce<
    Array<(typeof segments)[number] & { segmentStart: number }>
  >((acc, segment) => {
    const previous = acc[acc.length - 1];
    const segmentStart = previous ? previous.segmentStart + previous.length : 0;

    return [...acc, { ...segment, segmentStart }];
  }, []);

  return (
    <>
      <defs>
        {segmentsWithOffsets.map((segment, index) => {
          const gradientId = `edge-wave-${sanitizeSvgId(id)}-${index}`;
          const from = -segment.segmentStart / segment.length;
          const to = (totalLength - segment.segmentStart) / segment.length;

          return (
            <linearGradient
              key={gradientId}
              id={gradientId}
              gradientUnits="userSpaceOnUse"
              x1={segment.start.x}
              y1={segment.start.y}
              x2={segment.end.x}
              y2={segment.end.y}
            >
              {WAVE_STOPS.map((stop) => (
                <stop
                  key={`${gradientId}-${stop.offset}`}
                  offset={from + stop.offset}
                  stopColor="#b28a35"
                  stopOpacity={stop.opacity}
                >
                  <animate
                    attributeName="offset"
                    values={`${from + stop.offset};${to + stop.offset}`}
                    dur={`${WAVE_DURATION_SECONDS}s`}
                    repeatCount="indefinite"
                    calcMode="spline"
                    keySplines="0.42 0 0.58 1"
                  />
                </stop>
              ))}
            </linearGradient>
          );
        })}
      </defs>

      {segmentsWithOffsets.map((segment, index) => {
        const gradientId = `edge-wave-${sanitizeSvgId(id)}-${index}`;

        return (
          <line
            key={`line-${gradientId}`}
            x1={segment.start.x}
            y1={segment.start.y}
            x2={segment.end.x}
            y2={segment.end.y}
            className="global-graph-edge-gradient-wave"
            stroke={`url(#${gradientId})`}
          />
        );
      })}
    </>
  );
}

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
    selected,
    id,
  } = edgeProps;

  const points = (data as ElkEdgeData | undefined)?.elkPoints;
  const isSelected = selected || Boolean((data as ElkEdgeData | undefined)?.isSelected);

  if (points && points.length >= 2) {
    const path = buildPath(points);
    const labelPoint = getLabelPoint(points);

    return (
      <>
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
        {isSelected && (
          <EdgeWave id={id} points={points} />
        )}
      </>
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
    <>
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
      {isSelected && (
        <EdgeWave
          id={id}
          points={[
            { x: sourceX, y: sourceY },
            { x: targetX, y: targetY },
          ]}
        />
      )}
    </>
  );
}
