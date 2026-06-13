import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import type { Prisma } from '@prisma/client';
import {
  normalizeAllowedRelationForTag,
  resolveGlobalTagSlug,
} from '@/lib/global-tags-server';
import { sanitizeRichText } from '@/lib/sanitize-rich-text';

type BulkNodeInput = {
  tempId?: string;
  name?: string;
  gender?: string | null;
  birthDate?: string | null;
  deathDate?: string | null;
  bio?: string | null;
  photoUrl?: string | null;
  tagSlug?: string | null;
};

type BulkEdgeInput = {
  fromTempId?: string;
  toTempId?: string;
  relation?: string;
  description?: string | null;
  documentTitle?: string | null;
  documentContent?: string | null;
  documentImageUrl?: string | null;
};

type CitationTarget = {
  aliases: string[];
  displayLabel: string;
  href: string;
  id: string;
  subtitle: string;
  type: 'node' | 'edge';
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function citationAnchor(target: CitationTarget) {
  return `<a href="${escapeHtml(target.href)}" data-fg-citation-type="${target.type}" data-fg-citation-id="${escapeHtml(target.id)}" title="${escapeHtml(target.subtitle)}">@${escapeHtml(target.displayLabel)}</a>`;
}

function linkCitationMentions(value: string | null | undefined, targets: CitationTarget[]) {
  if (!value) return null;

  let linked = value;
  const matchers = targets
    .flatMap((target) =>
      target.aliases
        .map((alias) => alias.trim())
        .filter(Boolean)
        .map((alias) => ({ alias, target }))
    )
    .sort((a, b) => b.alias.length - a.alias.length);

  for (const { alias, target } of matchers) {
    const pattern = new RegExp(
      `(^|[\\s([{>])@${escapeRegExp(alias)}(?=\\s|[.,;:!?<)\\]}]|$)`,
      'gi'
    );
    linked = linked.replace(pattern, (_match, prefix: string) => `${prefix}${citationAnchor(target)}`);
  }

  return sanitizeRichText(linked);
}

function parseGender(value?: string | null) {
  if (value === 'MALE' || value === 'FEMALE' || value === 'OTHER') return value;
  return null;
}

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
    const nodes = body.nodes as BulkNodeInput[] | undefined;
    const edges = body.edges as BulkEdgeInput[] | undefined;

    if (!nodes || !Array.isArray(nodes)) {
      return NextResponse.json({ error: 'É necessário enviar um array de "nodes".' }, { status: 400 });
    }

    // 2. Transação: Garante que tudo é salvo ou tudo é cancelado se der erro
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      
      const idMap = new Map<string, string>(); // Mapeia o tempId para o ID real do banco
      const tagById = new Map<string, string>();
      const nameById = new Map<string, string>();
      const createdNodes = [];
      const normalizedNodes: Array<BulkNodeInput & { tempId: string; name: string; tagSlug: string }> = [];

      // Passo A: Criar todos os nós um por um para capturar os IDs gerados
      for (const node of nodes) {
        if (!node.tempId || !node.name) {
          throw new Error('Todos os nós precisam de "tempId" e "name".');
        }

        const tagSlug = await resolveGlobalTagSlug(node.tagSlug);
        normalizedNodes.push({ ...node, tempId: node.tempId, name: node.name, tagSlug });
        const created = await tx.globalNode.create({
          data: {
            name: node.name,
            gender: parseGender(node.gender),
            birthDate: node.birthDate ? new Date(node.birthDate) : null,
            deathDate: node.deathDate ? new Date(node.deathDate) : null,
            bio: null,
            photoUrl: node.photoUrl?.trim() || null,
            tagSlug,
            createdById: userId,
          }
        });
        
        // Salva a relação: "node1" -> "550e8400-e29b-41d4-a716-446655440000"
        idMap.set(node.tempId, created.id);
        tagById.set(created.id, tagSlug);
        tagById.set(node.tempId, tagSlug);
        nameById.set(created.id, node.name);
        nameById.set(node.tempId, node.name);
        createdNodes.push(created);
      }

      const usedTagSlugs = [...new Set(normalizedNodes.map((node) => node.tagSlug))];
      const existingNodes = await tx.globalNode.findMany({
        where: { tagSlug: { in: usedTagSlugs } },
        select: { id: true, name: true, tagSlug: true },
      });
      const nodeCitationTargets: CitationTarget[] = existingNodes.map((node) => ({
        aliases: [node.name],
        displayLabel: node.name,
        href: `/global-graph?nodeId=${encodeURIComponent(node.id)}&tagSlug=${encodeURIComponent(node.tagSlug)}`,
        id: node.id,
        subtitle: `No · ${node.tagSlug}`,
        type: 'node',
      }));

      normalizedNodes.forEach((node) => {
        const id = idMap.get(node.tempId);
        if (!id) return;

        nodeCitationTargets.unshift({
          aliases: [node.name, node.tempId],
          displayLabel: node.name,
          href: `/global-graph?nodeId=${encodeURIComponent(id)}&tagSlug=${encodeURIComponent(node.tagSlug)}`,
          id,
          subtitle: `No · ${node.tagSlug}`,
          type: 'node',
        });
      });

      for (const node of normalizedNodes) {
        const id = idMap.get(node.tempId);
        if (!id) continue;

        await tx.globalNode.update({
          where: { id },
          data: {
            bio: linkCitationMentions(node.bio, nodeCitationTargets),
          },
        });
      }

      // Passo B: Criar as arestas (relacionamentos) substituindo os IDs temporários
      let createdEdgesCount = 0;
      if (edges && Array.isArray(edges) && edges.length > 0) {
        for (const edge of edges) {
          if (!edge.fromTempId || !edge.toTempId) {
            throw new Error('Todas as arestas precisam de "fromTempId" e "toTempId".');
          }

          
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

          if (!edge.relation) {
            throw new Error(`Aresta sem relacao: ${edge.fromTempId} -> ${edge.toTempId}.`);
          }

          const relation = await normalizeAllowedRelationForTag(tagSlug, edge.relation);
          const createdEdge = await tx.globalEdge.create({
            data: {
              fromId,
              toId,
              relation,
              description: edge.description?.trim() || null,
              documentTitle: edge.documentTitle?.trim() || null,
              documentContent: linkCitationMentions(edge.documentContent, nodeCitationTargets),
              documentImageUrl: edge.documentImageUrl?.trim() || null,
              createdById: userId,
            },
          });
          nameById.set(createdEdge.id, edge.documentTitle || `${nameById.get(fromId) ?? fromId} -> ${nameById.get(toId) ?? toId}`);
          createdEdgesCount += 1;
        }
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
