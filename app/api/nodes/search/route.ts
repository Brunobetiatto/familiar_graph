import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('provisional_user_id')?.value;
    if (!userId) return NextResponse.json({ error: 'Nao autorizado.' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query || query.length < 2) {
      return NextResponse.json([], { status: 200 });
    }

    const nodes = await prisma.globalNode.findMany({
      where: {
        name: {
          contains: query,
          mode: 'insensitive',
        },
      },
      take: 10,
      select: {
        id: true,
        name: true,
        gender: true,
      },
    });

    return NextResponse.json(nodes, { status: 200 });
  } catch (error) {
    console.error('Erro ao pesquisar nos:', error);
    return NextResponse.json({ error: 'Erro na busca.' }, { status: 500 });
  }
}
