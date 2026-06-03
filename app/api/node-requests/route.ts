import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    // 1. Captura o cookie definido pelo login provisório
    const cookieStore = await cookies();
    const userId = cookieStore.get('provisional_user_id')?.value;

    // Se o usuário não passou pela página de login, bloqueia o acesso imediatamente
    if (!userId) {
      return NextResponse.json(
        { error: 'Não autorizado. Faça login na página provisória primeiro.' },
        { status: 401 }
      );
    }

    // 2. Lê o corpo da requisição uma única vez
    const body = await request.json();
    const { nodeData, connectionData, connections } = body as {
      nodeData?: {
        name?: string;
        gender?: string | null;
        birthDate?: string | null;
        deathDate?: string | null;
        bio?: string | null;
        userNote?: string | null;
      };
      connectionData?: {
        globalNodeId?: string;
        relation?: string;
        newNodeIsFrom?: boolean;
        description?: string | null;
      };
      connections?: Array<{
        targetNodeId: string;
        relation: string;
        newNodeIsFrom?: boolean;
        description?: string | null;
      }>;
    };

    // 3. Validação básica dos dados do formulário
    if (!nodeData?.name) {
      return NextResponse.json(
        { error: 'Dados incompletos. O nome do nó é obrigatório.' },
        { status: 400 }
      );
    }

    const normalizedConnections = Array.isArray(connections)
      ? connections
      : connectionData?.globalNodeId && connectionData?.relation
        ? [
            {
              targetNodeId: connectionData.globalNodeId,
              relation: connectionData.relation,
              newNodeIsFrom: connectionData.newNodeIsFrom ?? false,
              description: connectionData.description ?? null,
            },
          ]
        : [];

    if (normalizedConnections.length > 10) {
      return NextResponse.json(
        { error: 'Máximo de 10 conexões permitidas por solicitação.' },
        { status: 400 }
      );
    }

    const hasInvalidConnection = normalizedConnections.some(
      (conn) => !conn.targetNodeId || !conn.relation
    );

    if (hasInvalidConnection) {
      return NextResponse.json(
        { error: 'Dados incompletos nas conexões selecionadas.' },
        { status: 400 }
      );
    }

    // 4. Transação única com Prisma (Nested Write) usando o userId do Cookie
    const newRequest = await prisma.nodeRequest.create({
      data: {
        userId: userId, // ID extraído com segurança do cookie
        nodeName: nodeData.name,
        nodeGender: nodeData.gender || null,
        nodeBirthDate: nodeData.birthDate ? new Date(nodeData.birthDate) : null,
        nodeDeathDate: nodeData.deathDate ? new Date(nodeData.deathDate) : null,
        nodeBio: nodeData.bio || null,
        userNote: nodeData.userNote || null,
        connections: normalizedConnections.length
          ? {
              create: normalizedConnections.map((conn) => ({
                globalNodeId: conn.targetNodeId,
                relation: conn.relation,
                newNodeIsFrom: conn.newNodeIsFrom ?? false,
                description: conn.description?.trim() || null,
              })),
            }
          : undefined,
      },
      include: {
        connections: true, 
      }
    });

    return NextResponse.json(newRequest, { status: 201 });

  } catch (error) {
    console.error("Erro ao criar requisição de nó:", error);
    return NextResponse.json(
      { error: 'Erro interno ao salvar a solicitação.' },
      { status: 500 }
    );
  }
}

// Adicione isso no final do arquivo: app/api/node-requests/route.ts

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('provisional_user_id')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    }

    // Verifica se o usuário é realmente um Administrador
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado. Área restrita para administradores.' },
        { status: 403 }
      );
    }

    // Busca todas as requisições pendentes e inclui os nomes de quem pediu e de qual nó será conectado
    const pendingRequests = await prisma.nodeRequest.findMany({
      where: { status: 'PENDING' },
      include: {
        requester: { select: { name: true, email: true } },
        connections: {
          include: {
            globalNode: { select: { name: true } } // Pega o nome do nó alvo
          }
        }
      },
      orderBy: { reviewedAt: 'asc' } // Os mais antigos primeiro
    });

    return NextResponse.json(pendingRequests, { status: 200 });

  } catch (error) {
    console.error("Erro ao buscar requisições pendentes:", error);
    return NextResponse.json({ error: 'Erro interno no servidor.' }, { status: 500 });
  }
}
