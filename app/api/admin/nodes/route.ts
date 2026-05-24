import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

interface NodeData {
  name: string;
  gender?: string | null;
  birthDate?: string | null;
  deathDate?: string | null;
  bio?: string | null;
}

interface ConnectionData {
  newNodeIsFrom: boolean;
  targetNodeId: string;
  relation: string;
}

interface CreateNodeBody {
  nodeData: NodeData;
  connections?: ConnectionData[];
}

export async function POST(request: Request) {
  try {
    // 1. Verificação rígida de Administrador
    const cookieStore = await cookies();
    const userId = cookieStore.get('provisional_user_id')?.value;

    if (!userId) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
    }

    const body: CreateNodeBody = await request.json();
    const { nodeData, connections } = body;

    if (!nodeData?.name) {
      return NextResponse.json({ error: 'O nome do nó é obrigatório.' }, { status: 400 });
    }

    if ((connections?.length ?? 0) > 5) {
      return NextResponse.json({ error: 'Máximo de 5 conexões simultâneas permitido.' }, { status: 400 });
    }

    // 2. Transação para criar o Nó e as Arestas de uma só vez
    const result = await prisma.$transaction(async (tx: typeof prisma) => {
      // Cria o nó global
      const newGlobalNode = await tx.globalNode.create({
        data: {
          name: nodeData.name,
          gender: nodeData.gender || null,
          birthDate: nodeData.birthDate ? new Date(nodeData.birthDate) : null,
          deathDate: nodeData.deathDate ? new Date(nodeData.deathDate) : null,
          bio: nodeData.bio || null,
          createdById: userId,
        },
      });

      // Se o admin escolheu conectar a nós existentes, cria as arestas
      if (connections && connections.length > 0) {
        const edgesToCreate = connections.map((conn: ConnectionData) => ({
          fromId: conn.newNodeIsFrom ? newGlobalNode.id : conn.targetNodeId,
          toId: conn.newNodeIsFrom ? conn.targetNodeId : newGlobalNode.id,
          relation: conn.relation,
          createdById: userId,
        }));

        await tx.globalEdge.createMany({ data: edgesToCreate });
      }

      return newGlobalNode;
    });

    return NextResponse.json({ message: 'Nó criado com sucesso!', node: result }, { status: 201 });

  } catch (error) {
    console.error('Erro ao criar nó direto:', error);
    return NextResponse.json({ error: 'Erro interno ao criar o nó.' }, { status: 500 });
  }
}