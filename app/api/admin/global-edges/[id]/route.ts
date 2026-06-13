import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/current-user';
import { sanitizeRichText } from '@/lib/sanitize-rich-text';
import { normalizeRelationKey } from '@/lib/global-relations';
import { getRelationsForTag } from '@/lib/global-tags-server';

type RouteContext = {
  params: Promise<{ id: string }>;
};

type EdgeUpdateBody = {
  relation?: string;
  description?: string | null;
  documentTitle?: string | null;
  documentContent?: string | null;
  documentImageUrl?: string | null;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Nao autorizado.' }, { status: 401 });
    }

    if (currentUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
    }

    const { id } = await context.params;
    const body = (await request.json()) as EdgeUpdateBody;
    const currentEdge = await prisma.globalEdge.findUnique({
      where: { id },
      include: {
        fromNode: { select: { tagSlug: true } },
      },
    });

    if (!currentEdge) {
      return NextResponse.json({ error: 'Ligacao nao encontrada.' }, { status: 404 });
    }

    const allowedRelations = await getRelationsForTag(currentEdge.fromNode.tagSlug);
    const relationInput = body.relation?.trim() || currentEdge.relation;
    const normalizedRelation = normalizeRelationKey(relationInput);
    const resolvedRelation = allowedRelations.find(
      (relation) =>
        relation.key === normalizedRelation || normalizeRelationKey(relation.label) === normalizedRelation
    );

    if (!resolvedRelation) {
      const labels = allowedRelations.map((relation) => relation.label).join(', ');
      return NextResponse.json(
        { error: `A relacao "${relationInput}" nao e permitida para esta tag. Permitidas: ${labels}.` },
        { status: 400 }
      );
    }

    const updatedEdge = await prisma.globalEdge.update({
      where: { id },
      data: {
        relation: resolvedRelation.key,
        description: body.description?.trim() || null,
        documentTitle: body.documentTitle?.trim() || null,
        documentContent: sanitizeRichText(body.documentContent),
        documentImageUrl: body.documentImageUrl?.trim() || null,
      },
    });

    return NextResponse.json(
      {
        ...updatedEdge,
        relationLabel: resolvedRelation.label,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erro ao atualizar ligacao global:', error);
    return NextResponse.json({ error: 'Erro interno ao atualizar a ligacao.' }, { status: 500 });
  }
}
