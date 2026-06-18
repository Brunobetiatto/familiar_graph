import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { resolveGlobalTagSlug } from '@/lib/global-tags-server';
import { fuzzySearchItems } from '@/lib/fuzzy-node-search';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('provisional_user_id')?.value;
    if (!userId) return NextResponse.json({ error: 'Nao autorizado.' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim() ?? '';
    const tagSlug = await resolveGlobalTagSlug(searchParams.get('tagSlug'));

    if (query.length < 2) {
      return NextResponse.json([], { status: 200 });
    }

    const candidates = await prisma.globalNode.findMany({
      where: {
        tagSlug,
      },
      orderBy: { name: 'asc' },
      take: 800,
      select: {
        id: true,
        name: true,
        gender: true,
        tagSlug: true,
      },
    });

    const nodes = fuzzySearchItems(candidates, query, 10);

    return NextResponse.json(nodes, { status: 200 });
  } catch (error) {
    console.error('Erro ao pesquisar nos:', error);
    return NextResponse.json({ error: 'Erro na busca.' }, { status: 500 });
  }
}
