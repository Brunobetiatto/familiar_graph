'use client';

import { useNodes, getBezierPath, type XYPosition } from '@xyflow/react';
import { 
  getSmartEdge, 
  pathfindingAStarDiagonal
} from '@tisoap/react-flow-smart-edge';
import type { EdgeProps } from '@xyflow/react';

export default function SmartEdge({
  id,
  sourcePosition,
  targetPosition,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style = {},
  markerEnd,
  label,
  labelStyle,
  labelBgStyle,
}: EdgeProps) {
  
  const nodes = useNodes();

  const drawStraightLinePath = (
    source: XYPosition,
    target: XYPosition,
    path: number[][]
  ): string => {
    let svgPathString = `M ${String(source.x)}, ${String(source.y)} `;

    path.forEach((point) => {
      const [x, y] = point;
      svgPathString += `L ${String(x)}, ${String(y)} `;
    });

    svgPathString += `L ${String(target.x)}, ${String(target.y)} `;

    return svgPathString;
  };

  const getSmartEdgeResponse = getSmartEdge({
    sourcePosition,
    targetPosition,
    sourceX,
    sourceY,
    targetX,
    targetY,
    nodes,
    options: {
      nodePadding: 12,
      gridRatio: 22,
      drawEdge: drawStraightLinePath,
      generatePath: pathfindingAStarDiagonal,
    },
  });

  if (getSmartEdgeResponse === null) {
    const [edgePath, labelX, labelY] = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    });

    return (
      <>
        <path
          id={id}
          style={style}
          className="react-flow__edge-path"
          d={edgePath}
          markerEnd={markerEnd}
          fill="none"
        />
        {label && !isNaN(labelX) && !isNaN(labelY) && (
          <>
            <rect
              x={labelX - 40}
              y={labelY - 12}
              width={80}
              height={24}
              rx={4}
              fill={labelBgStyle?.fill || '#111009'}
              stroke={labelBgStyle?.stroke || '#3a3020'}
              strokeWidth={1}
            />
            <text
              x={labelX}
              y={labelY + 1}
              style={{ ...labelStyle, dominantBaseline: 'middle', textAnchor: 'middle' }}
              className="react-flow__edge-text"
            >
              {label}
            </text>
          </>
        )}
      </>
    );
  }

  const { edgeCenterX, edgeCenterY, svgPathString } = getSmartEdgeResponse as any;

  return (
    <>
      <path
        id={id}
        style={style}
        className="react-flow__edge-path"
        d={svgPathString}
        markerEnd={markerEnd}
        fill="none"
      />
      
      {label && !isNaN(edgeCenterX) && !isNaN(edgeCenterY) && (
        <>
          <rect
            x={edgeCenterX - 40}
            y={edgeCenterY - 12}
            width={80}
            height={24}
            rx={4}
            fill={labelBgStyle?.fill || '#111009'}
            stroke={labelBgStyle?.stroke || '#3a3020'}
            strokeWidth={1}
          />
          <text
            x={edgeCenterX}
            y={edgeCenterY + 1}
            style={{ ...labelStyle, dominantBaseline: 'middle', textAnchor: 'middle' }}
            className="react-flow__edge-text"
          >
            {label}
          </text>
        </>
      )}
    </>
  );
}