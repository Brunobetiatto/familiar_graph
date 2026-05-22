import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Prisma, GlobalNode, NodeRequest, NodeRequestConn, GlobalEdge } from '@prisma/client';

interface ApproveRequestBody {
  requestId: string;
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body: ApproveRequestBody = await request.json();
    const { requestId }: ApproveRequestBody = body;

    // 1. Validação básica
    if (!requestId) {
      return NextResponse.json(
        { error: 'O ID da requisição (requestId) é obrigatório.' },
        { status: 400 }
      );
    }

    // 2. Busca a solicitação provisória junto com a conexão pretendida
    const nodeRequest = (await prisma.nodeRequest.findUnique({
      where: { id: requestId },
      include: { connections: true },
    })) as (NodeRequest & { connections: NodeRequestConn[] }) | null;

    if (!nodeRequest) {
      return NextResponse.json(
        { error: 'Solicitação de nó não encontrada.' },
        { status: 404 }
      );
    }

    const connection: NodeRequestConn | undefined = nodeRequest.connections[0]; // Pega a primeira conexão atrelada
    if (!connection) {
      return NextResponse.json(
        { error: 'A solicitação não possui dados de conexão válidos.' },
        { status: 400 }
      );
    }

    // 3. Executa a transferência de tabelas dentro de uma Transação Segura
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      
      // Passo A: Cria o nó oficial na tabela GLOBAL_NODE
      const officialNode: GlobalNode = await tx.globalNode.create({
        data: {
          name: nodeRequest.nodeName,
          gender: nodeRequest.nodeGender,
          birthDate: nodeRequest.nodeBirthDate,
          deathDate: nodeRequest.nodeDeathDate,
          bio: nodeRequest.nodeBio,
          photoUrl: null, // Pode ser expandido futuramente
          createdById: nodeRequest.userId, // O usuário que solicitou vira o criador oficial
        },
      });

      // Passo B: Descobre a direção correta da linha (Aresta)
      // newNodeIsFrom define se o novo nó é o 'from' (origem) ou 'to' (destino)
      const fromId = connection.newNodeIsFrom ? officialNode.id : connection.globalNodeId;
      const toId = connection.newNodeIsFrom ? connection.globalNodeId : officialNode.id;

      // Passo C: Cria a linha oficial na tabela GLOBAL_EDGE
      const officialEdge = await tx.globalEdge.create({
        data: {
          fromId: fromId,
          toId: toId,
          relation: connection.relation,
          createdById: nodeRequest.userId,
        },
      });

      // Passo D: Retira/Deleta o registro da tabela provisória (NODE_REQUEST)
      // Se o seu banco tiver Cascade Delete, deletar o NodeRequest já limpa o NodeRequestConn automaticamente.
      // Por segurança, vamos deletar a conexão explicitamente primeiro.
      await tx.nodeRequestConn.delete({
        where: { id: connection.id }
      });

      await tx.nodeRequest.delete({
        where: { id: nodeRequest.id },
      });

      return { officialNode, officialEdge };
    });

    // 4. Retorna sucesso com os dados oficiais criados
    return NextResponse.json({
      message: 'Solicitação aprovada e inserida no grafo global com sucesso!',
      node: result.officialNode,
      edge: result.officialEdge
    }, { status: 200 });

  } catch (error) {
    console.error('Erro ao aprovar requisição de nó:', error);
    return NextResponse.json(
      { error: 'Erro interno ao processar a aprovação.' },
      { status: 500 }
    );
  }
}