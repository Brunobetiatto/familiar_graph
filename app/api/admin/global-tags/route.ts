import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import {
  createGlobalTag,
  listGlobalTags,
  updateGlobalTag,
  type GlobalTagInput,
} from '@/lib/global-tags-server';

async function requireAdmin() {
  const cookieStore = await cookies();
  const userId = cookieStore.get('provisional_user_id')?.value;

  if (!userId) return false;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  return user?.role === 'ADMIN';
}

export async function GET() {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
    }

    const tags = await listGlobalTags();
    return NextResponse.json(tags, { status: 200 });
  } catch (error) {
    console.error('Erro ao listar tags:', error);
    return NextResponse.json({ error: 'Erro interno ao listar tags.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
    }

    const body = (await request.json()) as GlobalTagInput;
    const tag = await createGlobalTag(body);
    return NextResponse.json(tag, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno ao criar tag.';
    console.error('Erro ao criar tag:', error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
    }

    const body = (await request.json()) as GlobalTagInput & { currentSlug?: string };
    if (!body.currentSlug) {
      return NextResponse.json({ error: 'Slug atual e obrigatorio.' }, { status: 400 });
    }

    const tag = await updateGlobalTag(body.currentSlug, body);
    return NextResponse.json(tag, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno ao atualizar tag.';
    console.error('Erro ao atualizar tag:', error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
