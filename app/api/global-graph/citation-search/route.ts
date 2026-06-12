import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { findRelationLabel } from '@/lib/global-relations';
import { getGlobalTagFromDb, resolveGlobalTagSlug } from '@/lib/global-tags-server';

type CitationNode = {
  id: string;
  name: string;
  tagSlug: string;
};

type CitationEdge = {
  id: string;
  relation: string;
  documentTitle: string | null;
  fromNode: {
    id: string;
    name: string;
  };
  toNode: {
    id: string;
    name: string;
  };
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim() ?? '';
    const requestedType = searchParams.get('type');
    const tagSlug = await resolveGlobalTagSlug(searchParams.get('tagSlug'));

    if (query.length < 2) {
      return NextResponse.json({ nodes: [], edges: [] }, { status: 200 });
    }

    const includeNodes = requestedType !== 'edge';
    const includeEdges = requestedType !== 'node';

    const tag = await getGlobalTagFromDb(tagSlug);
    const nodes: CitationNode[] = includeNodes
      ? await prisma.globalNode.findMany({
          where: {
            tagSlug,
            name: {
              contains: query,
              mode: 'insensitive',
            },
          },
          orderBy: { name: 'asc' },
          take: 8,
          select: {
            id: true,
            name: true,
            tagSlug: true,
          },
        })
      : [];
    const edges: CitationEdge[] = includeEdges
      ? await prisma.globalEdge.findMany({
          where: {
            fromNode: { tagSlug },
            toNode: { tagSlug },
            OR: [
              { relation: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
              { documentTitle: { contains: query, mode: 'insensitive' } },
              { fromNode: { name: { contains: query, mode: 'insensitive' } } },
              { toNode: { name: { contains: query, mode: 'insensitive' } } },
            ],
          },
          orderBy: { id: 'asc' },
          take: 8,
          select: {
            id: true,
            relation: true,
            documentTitle: true,
            fromNode: {
              select: {
                id: true,
                name: true,
              },
            },
            toNode: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        })
      : [];

    return NextResponse.json(
      {
        nodes: nodes.map((node) => ({
          type: 'node',
          id: node.id,
          label: node.name,
          subtitle: tag.label,
          href: `/global-graph?nodeId=${encodeURIComponent(node.id)}&tagSlug=${encodeURIComponent(node.tagSlug)}`,
        })),
        edges: edges.map((edge) => {
          const relationLabel = findRelationLabel(tag.relations, edge.relation);

          return {
            type: 'edge',
            id: edge.id,
            label: edge.documentTitle || `${edge.fromNode.name} -> ${edge.toNode.name}`,
            subtitle: `${edge.fromNode.name} -> ${edge.toNode.name} · ${relationLabel}`,
            href: `/global-graph?edgeId=${encodeURIComponent(edge.id)}&tagSlug=${encodeURIComponent(tag.slug)}`,
          };
        }),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erro ao buscar citacoes internas:', error);
    return NextResponse.json({ error: 'Erro ao buscar citacoes.' }, { status: 500 });
  }
}
