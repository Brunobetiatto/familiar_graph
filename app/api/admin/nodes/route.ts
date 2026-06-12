import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { uploadNodeImage } from '@/lib/azure-blob';
import { sanitizeRichText } from '@/lib/sanitize-rich-text';
import {
  normalizeAllowedRelationsForTag,
  resolveGlobalTagSlug,
} from '@/lib/global-tags-server';
import { uploadInlineDocumentImages, type DocumentImageMeta } from '@/lib/edge-document-images';

interface NodeData {
  name: string;
  gender?: string | null;
  birthDate?: string | null;
  deathDate?: string | null;
  bio?: string | null;
  tagSlug?: string | null;
}

interface ConnectionData {
  newNodeIsFrom: boolean;
  targetNodeId: string;
  relation: string;
  description?: string | null;
  documentTitle?: string | null;
  documentContent?: string | null;
  documentImageUrl?: string | null;
  documentImages?: DocumentImageMeta[];
}

interface CreateNodeBody {
  nodeData: NodeData;
  connections?: ConnectionData[];
  photoFile?: File | null;
  connectionDocumentFiles?: Array<File | null>;
  connectionInlineDocumentFiles?: Array<Record<string, File>>;
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
  const connections = parseJsonField<CreateNodeBody['connections']>(
    formData.get('connections'),
    undefined
  );
  const connectionDocumentFiles =
    connections?.map((_, index) => {
      const file = formData.get(`connectionDocumentImage-${index}`);
      return file instanceof File ? file : null;
    }) ?? [];
  const connectionInlineDocumentFiles =
    connections?.map((connection, index) => {
      const filesByKey: Record<string, File> = {};

      connection.documentImages?.forEach((image) => {
        const file = formData.get(`connectionDocumentInlineImage-${index}-${image.key}`);
        if (file instanceof File) filesByKey[image.key] = file;
      });

      return filesByKey;
    }) ?? [];

  return {
    nodeData: parseJsonField(formData.get('nodeData'), {} as NodeData),
    connections,
    photoFile: photo instanceof File ? photo : null,
    connectionDocumentFiles,
    connectionInlineDocumentFiles,
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

    const {
      nodeData,
      connections,
      photoFile,
      connectionDocumentFiles,
      connectionInlineDocumentFiles,
    } = await readCreateNodeBody(request);

    if (!nodeData?.name) {
      return NextResponse.json({ error: 'O nome do nó é obrigatório.' }, { status: 400 });
    }

    if ((connections?.length ?? 0) > 5) {
      return NextResponse.json({ error: 'Máximo de 5 conexões simultâneas permitido.' }, { status: 400 });
    }

    const tagSlug = await resolveGlobalTagSlug(nodeData.tagSlug);
    let allowedRelationKeys: string[] = [];

    try {
      allowedRelationKeys = await normalizeAllowedRelationsForTag(
        tagSlug,
        (connections ?? []).map((conn) => conn.relation)
      );
    } catch (relationError) {
      const message = relationError instanceof Error ? relationError.message : 'Relação inválida para esta tag.';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const connectionsWithAllowedRelations =
      connections?.map((conn, index) => ({ ...conn, relation: allowedRelationKeys[index] })) ?? [];

    const photoUrl = await uploadNodeImage({
      file: photoFile ?? null,
      folder: 'global-nodes',
    });

    const connectionDocumentImageUrls = await Promise.all(
      connectionsWithAllowedRelations.map((conn, index) =>
        uploadNodeImage({
          file: connectionDocumentFiles?.[index] ?? null,
          folder: 'edge-documents',
        }).then((url) => url ?? conn.documentImageUrl ?? null)
      )
    );
    const connectionDocumentContents = await Promise.all(
      connectionsWithAllowedRelations.map((conn, index) =>
        uploadInlineDocumentImages({
          content: conn.documentContent,
          images: conn.documentImages,
          filesByKey: connectionInlineDocumentFiles?.[index] ?? {},
        })
      )
    );

    // 2. Transação para criar o Nó e as Arestas de uma só vez
    const result = await prisma.$transaction(async (tx: typeof prisma) => {
      // Cria o nó global
      const newGlobalNode = await tx.globalNode.create({
        data: {
          name: nodeData.name,
          gender: nodeData.gender || null,
          birthDate: nodeData.birthDate ? new Date(nodeData.birthDate) : null,
          deathDate: nodeData.deathDate ? new Date(nodeData.deathDate) : null,
          bio: sanitizeRichText(nodeData.bio),
          photoUrl,
          tagSlug,
          createdById: userId,
        },
      });

      // Se o admin escolheu conectar a nós existentes, cria as arestas
      if (connectionsWithAllowedRelations.length > 0) {
        const edgesToCreate = connectionsWithAllowedRelations.map((conn: ConnectionData, index) => ({
          fromId: conn.newNodeIsFrom ? newGlobalNode.id : conn.targetNodeId,
          toId: conn.newNodeIsFrom ? conn.targetNodeId : newGlobalNode.id,
          relation: conn.relation,
          description: conn.description?.trim() || null,
          documentTitle: conn.documentTitle?.trim() || null,
          documentContent: sanitizeRichText(connectionDocumentContents[index]),
          documentImageUrl: connectionDocumentImageUrls[index],
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
