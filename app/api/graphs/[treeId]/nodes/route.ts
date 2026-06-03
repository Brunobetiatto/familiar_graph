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
    const name = typeof body.name === 'string' ? body.name.trim() : '';

    if (!name) {
      return NextResponse.json({ error: 'O nome do nó é obrigatório.' }, { status: 400 });
    }

    const node = await prisma.personNode.create({
      data: {
        treeId,
        name,
        gender: body.gender || null,
        birthDate: body.birthDate ? new Date(body.birthDate) : null,
        deathDate: body.deathDate ? new Date(body.deathDate) : null,
        bio: body.bio || null,
        photoUrl: body.photoUrl || null,
      },
    });

    return NextResponse.json(node, { status: 201 });
  } catch (error: unknown) {
    console.error('Erro ao criar nó privado:', error);
    return NextResponse.json({ error: getErrorMessage(error, 'Erro interno ao criar nó.') }, { status: 500 });
  }
}
