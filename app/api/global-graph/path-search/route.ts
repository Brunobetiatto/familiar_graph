import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveGlobalTagSlug } from '@/lib/global-tags-server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim() ?? '';
    const tagSlug = await resolveGlobalTagSlug(searchParams.get('tagSlug'));

    if (query.length < 2) {
      return NextResponse.json([], { status: 200 });
    }

    const nodes = await prisma.globalNode.findMany({
      where: {
        tagSlug,
        name: {
          contains: query,
          mode: 'insensitive',
        },
      },
      orderBy: { name: 'asc' },
      take: 12,
      select: {
        id: true,
        name: true,
        photoUrl: true,
        tagSlug: true,
      },
    });

    return NextResponse.json(nodes, { status: 200 });
  } catch (error) {
    console.error('Erro ao buscar nos para caminho:', error);
    return NextResponse.json({ error: 'Erro na busca.' }, { status: 500 });
  }
}
