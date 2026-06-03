import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/current-user';

function normalizeRelationLabels(labels: unknown) {
  if (!Array.isArray(labels)) return [];

  const names = labels
    .map((label: unknown) => {
      if (typeof label === 'string') return label.trim();
      if (label && typeof label === 'object' && 'name' in label && typeof label.name === 'string') {
        return label.name.trim();
      }
      return '';
    })
    .filter(Boolean);

  return Array.from(new Set(names));
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const graphs = await prisma.personTree.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        relationLabels: { orderBy: { name: 'asc' } },
        _count: { select: { nodes: true, edges: true } },
      },
    });

    return NextResponse.json({ graphs }, { status: 200 });
  } catch (error) {
    console.error('Erro ao listar grafos privados:', error);
    return NextResponse.json({ error: 'Erro interno ao listar grafos.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const relationLabels = normalizeRelationLabels(body.relationLabels);

    if (!name) {
      return NextResponse.json({ error: 'O nome do grafo é obrigatório.' }, { status: 400 });
    }

    if (relationLabels.length === 0) {
      return NextResponse.json(
        { error: 'Informe pelo menos uma categoria de ligação em "relationLabels".' },
        { status: 400 }
      );
    }

    const graph = await prisma.personTree.create({
      data: {
        name,
        userId: user.id,
        relationLabels: {
          create: relationLabels.map((labelName) => ({ name: labelName })),
        },
      },
      include: { relationLabels: { orderBy: { name: 'asc' } } },
    });

    return NextResponse.json(graph, { status: 201 });
  } catch (error: unknown) {
    console.error('Erro ao criar grafo privado:', error);
    return NextResponse.json({ error: getErrorMessage(error, 'Erro interno ao criar grafo.') }, { status: 500 });
  }
}
