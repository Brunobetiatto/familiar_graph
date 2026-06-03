// app/global-graph/page.tsx
// Server Component — busca os dados diretamente no banco e passa ao cliente.
// Nenhum fetch HTTP adicional; Prisma roda no servidor.

import type { Node, Edge } from '@xyflow/react';
import GlobalGraphFlow from '@/app/components/graph/GlobalGraphFlow';
import { prisma } from '@/lib/prisma';

interface GlobalNodeData extends Record<string, unknown> {
  name: string;
  label: string;
  birthDate: string | null;
  deathDate: string | null;
  gender: string | null;
  bio: string | null;
  photoUrl: string | null;
}

interface GlobalEdgeData extends Record<string, unknown> {
  relation: string;
  description: string | null;
}

interface GlobalGraphNode {
  id: string;
  name: string;
  birthDate: Date | null;
  deathDate: Date | null;
  gender: string | null;
  bio: string | null;
  photoUrl: string | null;
}

interface GlobalGraphEdge {
  id: string;
  fromId: string;
  toId: string;
  relation: string;
  description: string | null;
}

// Garante que a página sempre retorna dados frescos (sem cache estático)
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Grafo Global',
  description: 'Visualização do grafo genealógico global',
};

export default async function GlobalGraphPage() {
  // Busca em paralelo para reduzir latência
  // Busca em paralelo para reduzir latência
  const [dbNodes, dbEdges] = await Promise.all([
    prisma.globalNode.findMany(), // Apenas removemos a ordenação
    prisma.globalEdge.findMany(),
  ]);

  // ── Formata nós para o React Flow ──────────────────────────────────────────
  const nodes: Node<GlobalNodeData>[] = dbNodes.map((node: GlobalGraphNode) => ({
    id: node.id,
    type: 'personNode', // Deve corresponder à chave em NODE_TYPES do GlobalGraphFlow
    position: { x: 0, y: 0 }, // O layout Dagre vai sobrescrever isso no cliente
    data: {
      name: node.name,
      label: node.name, // React Flow usa 'label' internamente como fallback
      birthDate: node.birthDate?.toISOString() ?? null,
      deathDate: node.deathDate?.toISOString() ?? null,
      gender: node.gender,
      bio: node.bio,
      photoUrl: node.photoUrl,
    },
  }));

  // ── Formata arestas para o React Flow ──────────────────────────────────────
  const edges: Edge<GlobalEdgeData>[] = dbEdges.map((edge: GlobalGraphEdge) => ({
    id: edge.id,
    source: edge.fromId,  // React Flow: de onde sai
    target: edge.toId,    // React Flow: para onde vai
    label: edge.relation, // Exibe PARENT, SPOUSE, etc. sobre a aresta
    type: 'smoothstep', 
    data: {
      relation: edge.relation,
      description: edge.description,
    },
  }));

  return <GlobalGraphFlow initialNodes={nodes} initialEdges={edges} />;
}
