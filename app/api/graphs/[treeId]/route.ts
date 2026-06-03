import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/current-user';

type RouteParams = {
  params: Promise<{ treeId: string }>;
};

type PrivateGraphNode = {
  id: string;
  name: string;
  birthDate: Date | null;
  deathDate: Date | null;
  gender: string | null;
  bio: string | null;
  photoUrl: string | null;
};

type PrivateGraphEdge = {
  id: string;
  fromId: string;
  toId: string;
  relation: string | null;
  relationLabelId: string | null;
  relationLabel: { id: string; name: string } | null;
};

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const { treeId } = await params;
    const graph = await prisma.personTree.findFirst({
      where: { id: treeId, userId: user.id },
      include: {
        relationLabels: { orderBy: { name: 'asc' } },
        nodes: { orderBy: { name: 'asc' } },
        edges: {
          include: { relationLabel: true },
        },
      },
    });

    if (!graph) return NextResponse.json({ error: 'Grafo não encontrado.' }, { status: 404 });

    return NextResponse.json({
      id: graph.id,
      name: graph.name,
      createdAt: graph.createdAt,
      relationLabels: graph.relationLabels,
      nodes: (graph.nodes as PrivateGraphNode[]).map((node) => ({
        id: node.id,
        position: { x: 0, y: 0 },
        data: {
          label: node.name,
          birthDate: node.birthDate,
          deathDate: node.deathDate,
          gender: node.gender,
          bio: node.bio,
          photoUrl: node.photoUrl,
        },
      })),
      edges: (graph.edges as PrivateGraphEdge[]).map((edge) => ({
        id: edge.id,
        source: edge.fromId,
        target: edge.toId,
        label: edge.relationLabel?.name ?? edge.relation,
        data: {
          relationLabelId: edge.relationLabelId,
          relationLabel: edge.relationLabel,
          relation: edge.relation,
        },
      })),
    }, { status: 200 });
  } catch (error) {
    console.error('Erro ao buscar grafo privado:', error);
    return NextResponse.json({ error: 'Erro interno ao buscar grafo.' }, { status: 500 });
  }
}
