import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Prisma, GlobalNode, NodeRequest, NodeRequestConn } from '@prisma/client';
import { DEFAULT_GLOBAL_TAG_SLUG } from '@/lib/global-tags';

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

    const connections = nodeRequest.connections;

    // 3. Executa a transferência de tabelas dentro de uma Transação Segura
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      
      const normalizedName = nodeRequest.nodeName.trim();
      const existingNode = await tx.globalNode.findFirst({
        where: {
          name: {
            equals: normalizedName,
            mode: 'insensitive',
          },
        },
      });

      // Passo A: Cria o nó oficial na tabela GLOBAL_NODE (se nao existir)
      const officialNode: GlobalNode = existingNode
        ? (existingNode.photoUrl || !nodeRequest.nodePhotoUrl) &&
          (existingNode.tagSlug !== DEFAULT_GLOBAL_TAG_SLUG ||
            nodeRequest.nodeTagSlug === DEFAULT_GLOBAL_TAG_SLUG)
          ? existingNode
          : await tx.globalNode.update({
              where: { id: existingNode.id },
              data: {
                photoUrl: existingNode.photoUrl || !nodeRequest.nodePhotoUrl
                  ? existingNode.photoUrl
                  : nodeRequest.nodePhotoUrl,
                tagSlug:
                  existingNode.tagSlug === DEFAULT_GLOBAL_TAG_SLUG
                    ? nodeRequest.nodeTagSlug
                    : existingNode.tagSlug,
              },
            })
        : await tx.globalNode.create({
            data: {
              name: normalizedName,
              gender: nodeRequest.nodeGender,
              birthDate: nodeRequest.nodeBirthDate,
              deathDate: nodeRequest.nodeDeathDate,
              bio: nodeRequest.nodeBio,
              photoUrl: nodeRequest.nodePhotoUrl,
              tagSlug: nodeRequest.nodeTagSlug,
              createdById: nodeRequest.userId, // O usuario que solicitou vira o criador oficial
            },
          });

      if (connections.length > 0) {
        const edgesToCreate = connections.map((connection) => ({
          fromId: connection.newNodeIsFrom ? officialNode.id : connection.globalNodeId,
          toId: connection.newNodeIsFrom ? connection.globalNodeId : officialNode.id,
          relation: connection.relation,
          description: connection.description,
          documentTitle: connection.documentTitle,
          documentContent: connection.documentContent,
          documentImageUrl: connection.documentImageUrl,
          createdById: nodeRequest.userId,
        }));

        const existingEdges = await tx.globalEdge.findMany({
          where: {
            OR: edgesToCreate.map((edge) => ({
              fromId: edge.fromId,
              toId: edge.toId,
              relation: edge.relation,
              description: edge.description,
              documentTitle: edge.documentTitle,
              documentContent: edge.documentContent,
              documentImageUrl: edge.documentImageUrl,
            })),
          },
          select: {
            fromId: true,
            toId: true,
            relation: true,
            description: true,
            documentTitle: true,
            documentContent: true,
            documentImageUrl: true,
          },
        });

        const existingKey = new Set(
          existingEdges.map(
            (edge) =>
              `${edge.fromId}-${edge.toId}-${edge.relation}-${edge.description ?? ''}-${edge.documentTitle ?? ''}-${edge.documentContent ?? ''}-${edge.documentImageUrl ?? ''}`
          )
        );

        const newEdges = edgesToCreate.filter(
          (edge) =>
            !existingKey.has(
              `${edge.fromId}-${edge.toId}-${edge.relation}-${edge.description ?? ''}-${edge.documentTitle ?? ''}-${edge.documentContent ?? ''}-${edge.documentImageUrl ?? ''}`
            )
        );

        if (newEdges.length > 0) {
          await tx.globalEdge.createMany({ data: newEdges });
        }
      }

      await tx.nodeRequestConn.deleteMany({
        where: { requestId: nodeRequest.id },
      });

      // Passo D: Retira/Deleta o registro da tabela provisória (NODE_REQUEST)
      await tx.nodeRequest.delete({
        where: { id: nodeRequest.id },
      });

      return { officialNode, reusedNode: Boolean(existingNode) };
    });

    // 4. Retorna sucesso com os dados oficiais criados
    return NextResponse.json({
      message: 'Solicitação aprovada e inserida no grafo global com sucesso!',
      node: result.officialNode,
      reusedNode: result.reusedNode,
    }, { status: 200 });

  } catch (error) {
    console.error('Erro ao aprovar requisição de nó:', error);
    return NextResponse.json(
      { error: 'Erro interno ao processar a aprovação.' },
      { status: 500 }
    );
  }
}
