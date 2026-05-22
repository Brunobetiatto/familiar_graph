// app/api/global-graph/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'; // Ajuste o caminho se necessário

type DbNode = Awaited<ReturnType<typeof prisma.globalNode.findMany>>[number];
type DbEdge = Awaited<ReturnType<typeof prisma.globalEdge.findMany>>[number];

interface ReactFlowNodeData {
  label: string;
  birthDate: DbNode['birthDate'];
  deathDate: DbNode['deathDate'];
  gender: DbNode['gender'];
  bio: DbNode['bio'];
  photoUrl: DbNode['photoUrl'];
  createdById: DbNode['createdById'];
}

interface ReactFlowNode {
  id: string;
  position: {
    x: number;
    y: number;
  };
  data: ReactFlowNodeData;
}

interface ReactFlowEdge {
  id: string;
  source: string;
  target: string;
  label: DbEdge['relation'];
}

interface PostBody {
  action: 'create_node' | 'create_edge';
  payload: Record<string, unknown>;
}

export async function GET() {
  try {
    // 1. Busca todos os nós globais no banco
    const dbNodes = await prisma.globalNode.findMany();
    
    // 2. Busca todas as arestas (relacionamentos) globais no banco
    const dbEdges = await prisma.globalEdge.findMany();

    // 3. Formata os Nós para o padrão do React Flow
    const reactFlowNodes: ReactFlowNode[] = dbNodes.map((node: DbNode) => ({
      id: node.id,
      // Posição inicial (você provavelmente usará uma lib como 'dagre' no frontend para organizar isso)
      position: { x: 0, y: 0 }, 
      data: {
        label: node.name, // O React Flow usa 'label' por padrão para exibir texto básico
        birthDate: node.birthDate,
        deathDate: node.deathDate,
        gender: node.gender,
        bio: node.bio,
        photoUrl: node.photoUrl,
        createdById: node.createdById,
      },
    }));

    // 4. Formata as Arestas para o padrão do React Flow
    const reactFlowEdges: ReactFlowEdge[] = dbEdges.map((edge: DbEdge) => ({
      id: edge.id,
      source: edge.fromId, // React Flow exige 'source' (de onde sai)
      target: edge.toId,   // React Flow exige 'target' (para onde vai)
      label: edge.relation, // Exibe o tipo de relação na linha (PARENT, SPOUSE, etc)
      // data: { relation: edge.relation } // Opcional, se quiser passar dados extras na aresta
    }));

    // 5. Retorna o objeto completo pronto para o frontend consumir
    return NextResponse.json({
      nodes: reactFlowNodes,
      edges: reactFlowEdges,
    }, { status: 200 });

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