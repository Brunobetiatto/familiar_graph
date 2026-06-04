import ELK from 'elkjs/lib/elk.bundled.js';
import type { Node, Edge } from '@xyflow/react';
import { Position } from '@xyflow/react';

const elk = new ELK();

const NODE_WIDTH = 200;
const NODE_HEIGHT = 80;

type ElkPoint = {
  x: number;
  y: number;
};

type ElkLayoutEdgeSection = {
  startPoint?: ElkPoint;
  endPoint?: ElkPoint;
  bendPoints?: ElkPoint[];
};

type ElkLayoutEdge = {
  id: string;
  sections?: ElkLayoutEdgeSection[];
};

type ElkLayoutGraph = {
  children?: Array<{ id: string; x?: number; y?: number }>;
  edges?: ElkLayoutEdge[];
};

export async function applyElkLayout(
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'TB'
): Promise<{ nodes: Node[]; edges: Edge[] }> {
  if (nodes.length === 0) return { nodes, edges };

  const isDenseGraph = nodes.length > 120 || edges.length > 320;

  const elkGraph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': direction === 'TB' ? 'DOWN' : 'RIGHT',
      
      // ─── Roteamento de arestas ORTOGONAL (90°, sem diagonais) ───────────
      'elk.edgeRouting': isDenseGraph ? 'POLYLINE' : 'ORTHOGONAL',
      
      // ─── Evita que arestas passem por cima de nós ────────────────────────
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      
      // ─── Espaçamentos ────────────────────────────────────────────────────
      'elk.spacing.nodeNode': isDenseGraph ? '58' : '120',
      'elk.layered.spacing.nodeNodeBetweenLayers': isDenseGraph ? '105' : '200',
      'elk.spacing.edgeNode': isDenseGraph ? '28' : '80',
      'elk.spacing.edgeEdge': isDenseGraph ? '16' : '60',
      'elk.padding': '[top=80, left=80, bottom=80, right=80]',
    },
    children: nodes.map((node) => ({
      id: node.id,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    })),
    edges: edges
      .filter((e) => nodes.find((n) => n.id === e.source) && nodes.find((n) => n.id === e.target))
      .map((e) => ({
        id: e.id,
        sources: [e.source],
        targets: [e.target],
      })),
  };

  const layout = (await elk.layout(elkGraph)) as ElkLayoutGraph;

  const edgePointMap = new Map<string, ElkPoint[]>();
  layout.edges?.forEach((edge) => {
    const points: ElkPoint[] = [];

    edge.sections?.forEach((section) => {
      if (section.startPoint) points.push(section.startPoint);
      if (section.bendPoints?.length) points.push(...section.bendPoints);
      if (section.endPoint) points.push(section.endPoint);
    });

    if (points.length > 0) {
      edgePointMap.set(edge.id, points);
    }
  });

  const laidOutNodes = nodes.map((node) => {
    const elkNode = layout.children?.find((n) => n.id === node.id);
    if (!elkNode || elkNode.x === undefined || elkNode.y === undefined) return node;

    return {
      ...node,
      sourcePosition: direction === 'TB' ? Position.Bottom : Position.Right,
      targetPosition: direction === 'TB' ? Position.Top : Position.Left,
      position: {
        x: elkNode.x,
        y: elkNode.y,
      },
    };
  });

  const laidOutEdges = edges.map((edge) => {
    const points = edgePointMap.get(edge.id);
    if (!points) return edge;

    return {
      ...edge,
      data: { ...(edge.data ?? {}), elkPoints: points },
    };
  });

  return { nodes: laidOutNodes, edges: laidOutEdges };
}
