import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/current-user';
import { sanitizeRichText } from '@/lib/sanitize-rich-text';

type RouteContext = {
  params: Promise<{ id: string }>;
};

type NodeUpdateBody = {
  name?: string;
  gender?: string | null;
  birthDate?: string | null;
  deathDate?: string | null;
  bio?: string | null;
  photoUrl?: string | null;
};

function parseDate(value?: string | null) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date;
}

function parseGender(value?: NodeUpdateBody['gender']) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 40) : null;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Nao autorizado.' }, { status: 401 });
    }

    if (currentUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
    }

    const { id } = await context.params;
    const body = (await request.json()) as NodeUpdateBody;
    const name = body.name?.trim();

    if (!name) {
      return NextResponse.json({ error: 'O nome do no e obrigatorio.' }, { status: 400 });
    }

    const updatedNode = await prisma.globalNode.update({
      where: { id },
      data: {
        name,
        gender: parseGender(body.gender),
        birthDate: parseDate(body.birthDate),
        deathDate: parseDate(body.deathDate),
        bio: sanitizeRichText(body.bio),
        photoUrl: body.photoUrl?.trim() || null,
      },
    });

    return NextResponse.json(
      {
        ...updatedNode,
        birthDate: updatedNode.birthDate?.toISOString() ?? null,
        deathDate: updatedNode.deathDate?.toISOString() ?? null,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erro ao atualizar no global:', error);
    return NextResponse.json({ error: 'Erro interno ao atualizar o no.' }, { status: 500 });
  }
}
