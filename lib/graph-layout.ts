import dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';

const NODE_WIDTH = 350;  // Aumentamos para compensar o padding do CSS
const NODE_HEIGHT = 175;

/**
 * Aplica o algoritmo de layout Dagre sobre os nós e arestas do React Flow.
 * Retorna uma nova lista de nós com as posições calculadas.
 *
 * @param nodes  - Lista de nós do React Flow (position pode ser { x:0, y:0 })
 * @param edges  - Lista de arestas do React Flow
 * @param direction - 'TB' (top-bottom) para árvore genealógica; 'LR' para árvores horizontais
 */
export function applyDagreLayout(
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'TB'
): Node[] {
  if (nodes.length === 0) return nodes;

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    ranksep: 120, // Aumenta o espaço VERTICAL entre pais e filhos
    nodesep: 100, // Aumenta o espaço HORIZONTAL entre irmãos
    edgesep: 80,  // Força as arestas a manterem distância umas das outras
  });

  nodes.forEach((node) => {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    // dagre pode lançar erro se source ou target não existirem no grafo
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
      g.setEdge(edge.source, edge.target);
    }
  });

  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    // dagre retorna o centro do nó; React Flow usa o canto superior-esquerdo
    return {
      ...node,
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      },
    };
  });
}
