import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { resolveGlobalTagSlug } from '@/lib/global-tags-server';

export async function GET(request: Request) {
  try {
    // 1. Verificação de segurança (Apenas logados)
    const cookieStore = await cookies();
    const userId = cookieStore.get('provisional_user_id')?.value;
    if (!userId) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    // 2. Captura o termo pesquisado na URL
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const tagSlug = searchParams.get('tagSlug');

    // Se a pesquisa for muito curta, retorna vazio para não sobrecarregar o banco
    if (!query || query.length < 2) {
      return NextResponse.json([], { status: 200 });
    }

    // 3. Busca no banco de dados usando ILIKE (insensitive)
    const nodes = await prisma.globalNode.findMany({
      where: {
        ...(tagSlug ? { tagSlug: await resolveGlobalTagSlug(tagSlug) } : {}),
        name: {
          contains: query,
          mode: 'insensitive',
        },
      },
      take: 10, // Limita a 10 resultados para a lista não ficar gigante
      select: {
        id: true,
        name: true,
        gender: true,
        tagSlug: true,
      },
    });

    return NextResponse.json(nodes, { status: 200 });
  } catch (error) {
    console.error('Erro ao pesquisar nós:', error);
    return NextResponse.json({ error: 'Erro na busca.' }, { status: 500 });
  }
}
