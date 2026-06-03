import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/current-user';

type RouteParams = {
  params: Promise<{ treeId: string }>;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const { treeId } = await params;
    const tree = await prisma.personTree.findFirst({
      where: { id: treeId, userId: user.id },
      select: { id: true },
    });

    if (!tree) return NextResponse.json({ error: 'Grafo não encontrado.' }, { status: 404 });

    const body = await request.json();
    const fromId = typeof body.fromId === 'string' ? body.fromId : '';
    const toId = typeof body.toId === 'string' ? body.toId : '';
    const relationLabelName = typeof body.relationLabelName === 'string' ? body.relationLabelName.trim() : '';
    let relationLabelId = typeof body.relationLabelId === 'string' ? body.relationLabelId : '';

    if (!fromId || !toId) {
      return NextResponse.json({ error: 'fromId e toId são obrigatórios.' }, { status: 400 });
    }

    if (!relationLabelId && !relationLabelName) {
      return NextResponse.json({ error: 'Informe relationLabelId ou relationLabelName.' }, { status: 400 });
    }

    const nodesCount = await prisma.personNode.count({
      where: {
        treeId,
        id: { in: [fromId, toId] },
      },
    });

    if (nodesCount !== 2) {
      return NextResponse.json({ error: 'Os nós da ligação precisam pertencer a este grafo.' }, { status: 400 });
    }

    if (relationLabelName) {
      const label = await prisma.personRelationLabel.upsert({
        where: { treeId_name: { treeId, name: relationLabelName } },
        create: { treeId, name: relationLabelName },
        update: {},
      });
      relationLabelId = label.id;
    } else {
      const label = await prisma.personRelationLabel.findFirst({
        where: { id: relationLabelId, treeId },
        select: { id: true },
      });

      if (!label) {
        return NextResponse.json({ error: 'Categoria de ligação não encontrada neste grafo.' }, { status: 400 });
      }
    }

    const edge = await prisma.personEdge.create({
      data: {
        treeId,
        fromId,
        toId,
        relationLabelId,
      },
      include: { relationLabel: true },
    });

    return NextResponse.json(edge, { status: 201 });
  } catch (error: unknown) {
    console.error('Erro ao criar ligação privada:', error);
    return NextResponse.json({ error: getErrorMessage(error, 'Erro interno ao criar ligação.') }, { status: 500 });
  }
}
