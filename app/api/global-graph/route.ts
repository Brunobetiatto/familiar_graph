// app/api/global-graph/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'; // Ajuste o caminho se necessário
import { getGlobalGraphWindow } from '@/lib/global-graph-window';

interface PostBody {
  action: 'create_node' | 'create_edge';
  payload: Record<string, unknown>;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const graphWindow = await getGlobalGraphWindow({
      seedNodeId: searchParams.get('seedNodeId'),
    });

    return NextResponse.json(graphWindow, { status: 200 });

  } catch (error) {
    console.error("Erro ao buscar o grafo global:", error);
    return NextResponse.json(
      { error: 'Falha ao carregar os dados do grafo.' },
      { status: 500 }
    );
  }
}

// Adicione isso no final do arquivo app/api/global-graph/route.ts
export async function POST(request: Request) {
  try {
    const body: PostBody = await request.json();
    const { action, payload } = body;

    if (action === 'create_node') {
      const newNode = await prisma.globalNode.create({ data: payload });
      return NextResponse.json(newNode, { status: 201 });
    }

    if (action === 'create_edge') {
      const newEdge = await prisma.globalEdge.create({ data: payload });
      return NextResponse.json(newEdge, { status: 201 });
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao salvar' }, { status: 500 });
  }
}
