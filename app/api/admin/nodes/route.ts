import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { uploadNodeImage } from '@/lib/azure-blob';

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
  description?: string | null;
}

interface CreateNodeBody {
  nodeData: NodeData;
  connections?: ConnectionData[];
  photoFile?: File | null;
}

function parseJsonField<T>(value: FormDataEntryValue | null, fallback: T): T {
  if (typeof value !== 'string') return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

async function readCreateNodeBody(request: Request): Promise<CreateNodeBody> {
  const contentType = request.headers.get('content-type') || '';

  if (!contentType.includes('multipart/form-data')) {
    return (await request.json()) as CreateNodeBody;
  }

  const formData = await request.formData();
  const photo = formData.get('photo');

  return {
    nodeData: parseJsonField(formData.get('nodeData'), {} as NodeData),
    connections: parseJsonField(formData.get('connections'), undefined),
    photoFile: photo instanceof File ? photo : null,
  };
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

    const { nodeData, connections, photoFile } = await readCreateNodeBody(request);

    if (!nodeData?.name) {
      return NextResponse.json({ error: 'O nome do nó é obrigatório.' }, { status: 400 });
    }

    if ((connections?.length ?? 0) > 5) {
      return NextResponse.json({ error: 'Máximo de 5 conexões simultâneas permitido.' }, { status: 400 });
    }

    const photoUrl = await uploadNodeImage({
      file: photoFile ?? null,
      folder: 'global-nodes',
    });

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
          photoUrl,
          createdById: userId,
        },
      });

      // Se o admin escolheu conectar a nós existentes, cria as arestas
      if (connections && connections.length > 0) {
        const edgesToCreate = connections.map((conn: ConnectionData) => ({
          fromId: conn.newNodeIsFrom ? newGlobalNode.id : conn.targetNodeId,
          toId: conn.newNodeIsFrom ? conn.targetNodeId : newGlobalNode.id,
          relation: conn.relation,
          description: conn.description?.trim() || null,
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
