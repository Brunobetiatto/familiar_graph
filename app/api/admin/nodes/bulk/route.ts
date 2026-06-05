import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import type { Prisma } from '@prisma/client';
import {
  normalizeAllowedRelationForTag,
  resolveGlobalTagSlug,
} from '@/lib/global-tags-server';

export async function POST(request: Request) {
  try {
    // 1. Verificação de segurança (Apenas Admins)
    const cookieStore = await cookies();
    const userId = cookieStore.get('provisional_user_id')?.value;

    if (!userId) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
    }

    const body = await request.json();
    const { nodes, edges } = body;

    if (!nodes || !Array.isArray(nodes)) {
      return NextResponse.json({ error: 'É necessário enviar um array de "nodes".' }, { status: 400 });
    }

    // 2. Transação: Garante que tudo é salvo ou tudo é cancelado se der erro
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      
      const idMap = new Map<string, string>(); // Mapeia o tempId para o ID real do banco
      const tagById = new Map<string, string>();
      const createdNodes = [];

      // Passo A: Criar todos os nós um por um para capturar os IDs gerados
      for (const node of nodes) {
        if (!node.tempId || !node.name) {
          throw new Error('Todos os nós precisam de "tempId" e "name".');
        }

        const tagSlug = await resolveGlobalTagSlug(node.tagSlug);
        const created = await tx.globalNode.create({
          data: {
            name: node.name,
            gender: node.gender || null,
            birthDate: node.birthDate ? new Date(node.birthDate) : null,
            bio: node.bio || null,
            tagSlug,
            createdById: userId,
          }
        });
        
        // Salva a relação: "node1" -> "550e8400-e29b-41d4-a716-446655440000"
        idMap.set(node.tempId, created.id);
        tagById.set(created.id, tagSlug);
        tagById.set(node.tempId, tagSlug);
        createdNodes.push(created);
      }

      // Passo B: Criar as arestas (relacionamentos) substituindo os IDs temporários
      let createdEdgesCount = 0;
      if (edges && Array.isArray(edges) && edges.length > 0) {
        const edgesToCreate: Prisma.GlobalEdgeCreateManyInput[] = [];

        for (const edge of edges) {
          
          // Traduz os IDs temporários para os IDs reais do banco
          // Ou usa o ID real direto, caso você esteja conectando a alguém que JÁ existia antes do teste
          const fromId = idMap.get(edge.fromTempId) || edge.fromTempId; 
          const toId = idMap.get(edge.toTempId) || edge.toTempId;

          if (!fromId || !toId) {
            throw new Error(`Referência inválida na aresta: ${edge.fromTempId} -> ${edge.toTempId}. Certifique-se de que o nó existe.`);
          }

          let tagSlug = tagById.get(fromId) ?? tagById.get(edge.fromTempId);

          if (!tagSlug) {
            const fromNode = await tx.globalNode.findUnique({
              where: { id: fromId },
              select: { tagSlug: true },
            });
            tagSlug = fromNode?.tagSlug;
          }

          if (!tagSlug) {
            throw new Error(`Nó de origem não encontrado para validar a relação: ${edge.fromTempId}.`);
          }

          const relation = await normalizeAllowedRelationForTag(tagSlug, edge.relation);

          edgesToCreate.push({
            fromId,
            toId,
            relation,
            description: edge.description?.trim() || null,
            createdById: userId,
          });
        }

        const edgesResult = await tx.globalEdge.createMany({
          data: edgesToCreate
        });
        createdEdgesCount = edgesResult.count;
      }

      return { nodesCount: createdNodes.length, edgesCount: createdEdgesCount };
    });

    return NextResponse.json({ 
      message: 'Lote inserido com sucesso!', 
      inseridos: result 
    }, { status: 201 });

  } catch (error: any) {
    console.error('Erro na inserção em lote:', error);
    return NextResponse.json({ error: error.message || 'Erro interno ao processar lote.' }, { status: 500 });
  }
}
