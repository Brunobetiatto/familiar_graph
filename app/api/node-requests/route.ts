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

type ConnectionDocumentInput = {
  documentTitle?: string | null;
  documentContent?: string | null;
  documentImageUrl?: string | null;
  documentImages?: DocumentImageMeta[];
};

type NodeRequestPayload = {
  nodeData?: {
    name?: string;
    gender?: string | null;
    birthDate?: string | null;
    deathDate?: string | null;
    bio?: string | null;
    tagSlug?: string | null;
    userNote?: string | null;
  };
  connectionData?: {
    globalNodeId?: string;
    relation?: string;
    newNodeIsFrom?: boolean;
    description?: string | null;
  } & ConnectionDocumentInput;
  connections?: Array<{
    targetNodeId: string;
    relation: string;
    newNodeIsFrom?: boolean;
    description?: string | null;
  } & ConnectionDocumentInput>;
  photoFile?: File | null;
  connectionDocumentFiles?: Array<File | null>;
  connectionInlineDocumentFiles?: Array<Record<string, File>>;
};

function parseJsonField<T>(value: FormDataEntryValue | null, fallback: T): T {
  if (typeof value !== 'string') return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

async function readNodeRequestPayload(request: Request): Promise<NodeRequestPayload> {
  const contentType = request.headers.get('content-type') || '';

  if (!contentType.includes('multipart/form-data')) {
    return (await request.json()) as NodeRequestPayload;
  }

  const formData = await request.formData();
  const photo = formData.get('photo');
  const connections = parseJsonField<NodeRequestPayload['connections']>(
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
    nodeData: parseJsonField(formData.get('nodeData'), undefined),
    connectionData: parseJsonField(formData.get('connectionData'), undefined),
    connections,
    photoFile: photo instanceof File ? photo : null,
    connectionDocumentFiles,
    connectionInlineDocumentFiles,
  };
}

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

    // 2. Le o corpo da requisicao uma unica vez
    const {
      nodeData,
      connectionData,
      connections,
      photoFile,
      connectionDocumentFiles,
      connectionInlineDocumentFiles,
    } =
      await readNodeRequestPayload(request);

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
              documentTitle: connectionData.documentTitle ?? null,
              documentContent: connectionData.documentContent ?? null,
              documentImageUrl: connectionData.documentImageUrl ?? null,
              documentImages: connectionData.documentImages ?? [],
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

    const nodeTagSlug = await resolveGlobalTagSlug(nodeData.tagSlug);
    let allowedRelationKeys: string[] = [];

    try {
      allowedRelationKeys = await normalizeAllowedRelationsForTag(
        nodeTagSlug,
        normalizedConnections.map((conn) => conn.relation)
      );
    } catch (relationError) {
      const message = relationError instanceof Error ? relationError.message : 'Relacao invalida para esta tag.';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const connectionsWithAllowedRelations = normalizedConnections.map((conn, index) => ({
      ...conn,
      relation: allowedRelationKeys[index],
    }));

    const nodePhotoUrl = await uploadNodeImage({
      file: photoFile ?? null,
      folder: 'node-requests',
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

    // 4. Transação única com Prisma (Nested Write) usando o userId do Cookie
    const newRequest = await prisma.nodeRequest.create({
      data: {
        userId: userId, // ID extraído com segurança do cookie
        nodeName: nodeData.name,
        nodeGender: nodeData.gender || null,
        nodeBirthDate: nodeData.birthDate ? new Date(nodeData.birthDate) : null,
        nodeDeathDate: nodeData.deathDate ? new Date(nodeData.deathDate) : null,
        nodeBio: nodeData.bio || null,
        nodePhotoUrl,
        nodeTagSlug,
        userNote: nodeData.userNote || null,
        connections: connectionsWithAllowedRelations.length
          ? {
              create: connectionsWithAllowedRelations.map((conn, index) => ({
                globalNodeId: conn.targetNodeId,
                relation: conn.relation,
                newNodeIsFrom: conn.newNodeIsFrom ?? false,
                description: conn.description?.trim() || null,
                documentTitle: conn.documentTitle?.trim() || null,
                documentContent: sanitizeRichText(connectionDocumentContents[index]),
                documentImageUrl: connectionDocumentImageUrls[index],
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
