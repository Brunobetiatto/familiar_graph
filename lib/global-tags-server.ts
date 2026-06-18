import type {
  GlobalTag as DbGlobalTag,
  GlobalTagGenderOption as DbGlobalTagGenderOption,
  GlobalTagRelation as DbGlobalTagRelation,
  Prisma,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  getDefaultRelationsForTag,
  normalizeRelationKey,
  normalizeTagRelations,
  type GlobalTagRelation,
} from '@/lib/global-relations';
import {
  DEFAULT_GLOBAL_TAG_SLUG,
  OFFICIAL_GLOBAL_TAGS,
  getGlobalTag,
  normalizeGlobalTagSlug,
  normalizeGlobalTagGenderOptions,
  sanitizeGlobalTagFieldLabels,
  sanitizeGlobalTagTheme,
  type GlobalTag,
  type GlobalTagFieldLabels,
  type GlobalTagGenderOption,
  type GlobalTagTheme,
} from '@/lib/global-tags';
import {
  deleteAzureBlobByUrl,
  extractAzureBlobUrlsFromHtml,
} from '@/lib/azure-blob';

export type GlobalTagInput = {
  slug?: string | null;
  label?: string | null;
  description?: string | null;
  theme?: Partial<GlobalTagTheme> | null;
  fieldLabels?: Partial<GlobalTagFieldLabels> | null;
  genderOptions?: Array<Partial<GlobalTagGenderOption>> | Record<string, string> | null;
  genderLabels?: Record<string, string> | null;
  relations?: Array<Partial<GlobalTagRelation>> | null;
};

type DbGlobalTagWithRelations = DbGlobalTag & {
  relations?: DbGlobalTagRelation[];
  genderOptions?: DbGlobalTagGenderOption[];
};

export function formatDbGlobalTag(tag: DbGlobalTagWithRelations): GlobalTag {
  return {
    slug: tag.slug,
    label: tag.label,
    description: tag.description,
    theme: {
      background: tag.background,
      surface: tag.surface,
      border: tag.border,
      primary: tag.primary,
      secondary: tag.secondary,
      muted: tag.muted,
      node: tag.node,
      nodeSelected: tag.nodeSelected,
      edge: tag.edge,
      edgeSelected: tag.edgeSelected,
    },
    fieldLabels: sanitizeGlobalTagFieldLabels({
      gender: tag.genderLabel,
      birthDate: tag.birthDateLabel,
      deathDate: tag.deathDateLabel,
      bio: tag.bioLabel,
    }),
    genderOptions: normalizeGlobalTagGenderOptions(
      tag.genderOptions?.map((option) => ({
        key: option.key,
        label: option.label,
        sortOrder: option.sortOrder,
      })),
      getGlobalTag(tag.slug).genderOptions
    ),
    relations: normalizeTagRelations(
      tag.relations?.map((relation) => ({
        key: relation.key,
        label: relation.label,
        sortOrder: relation.sortOrder,
      })),
      getDefaultRelationsForTag(tag.slug)
    ),
  };
}

export async function listGlobalTags(): Promise<GlobalTag[]> {
  const tags = await prisma.globalTag.findMany({
    include: {
      genderOptions: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }] },
      relations: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }] },
    },
    orderBy: [{ label: 'asc' }],
  });

  return tags.length > 0 ? tags.map(formatDbGlobalTag) : OFFICIAL_GLOBAL_TAGS;
}

export async function getGlobalTagFromDb(slug?: string | null): Promise<GlobalTag> {
  const normalizedSlug = normalizeGlobalTagSlug(slug);
  const tag = await prisma.globalTag.findUnique({
    where: { slug: normalizedSlug },
    include: {
      genderOptions: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }] },
      relations: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }] },
    },
  });

  if (tag) return formatDbGlobalTag(tag);

  const defaultTag = await prisma.globalTag.findUnique({
    where: { slug: DEFAULT_GLOBAL_TAG_SLUG },
    include: {
      genderOptions: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }] },
      relations: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }] },
    },
  });

  return defaultTag ? formatDbGlobalTag(defaultTag) : getGlobalTag(DEFAULT_GLOBAL_TAG_SLUG);
}

export async function resolveGlobalTagSlug(slug?: string | null): Promise<string> {
  const normalizedSlug = normalizeGlobalTagSlug(slug);
  const tag = await prisma.globalTag.findUnique({
    where: { slug: normalizedSlug },
    select: { slug: true },
  });

  return tag?.slug ?? DEFAULT_GLOBAL_TAG_SLUG;
}

export async function createGlobalTag(input: GlobalTagInput): Promise<GlobalTag> {
  const label = input.label?.trim();
  const slug = normalizeGlobalTagSlug(input.slug || label);

  if (!label) {
    throw new Error('Nome da tag e obrigatorio.');
  }

  const theme = sanitizeGlobalTagTheme(input.theme ?? {});
  const fieldLabels = sanitizeGlobalTagFieldLabels(input.fieldLabels ?? {});
  const genderOptions = normalizeGlobalTagGenderOptions(
    input.genderOptions ?? input.genderLabels,
    getGlobalTag(slug).genderOptions
  ).map(({ key, label }) => ({ key, label }));
  const relations = normalizeTagRelations(input.relations, getDefaultRelationsForTag(slug)).map(
    ({ key, label }) => ({ key, label })
  );
  const created = await prisma.globalTag.create({
    data: {
      slug,
      label,
      description: input.description?.trim() || '',
      background: theme.background,
      surface: theme.surface,
      border: theme.border,
      primary: theme.primary,
      secondary: theme.secondary,
      muted: theme.muted,
      node: theme.node,
      nodeSelected: theme.nodeSelected,
      edge: theme.edge,
      edgeSelected: theme.edgeSelected,
      genderLabel: fieldLabels.gender,
      birthDateLabel: fieldLabels.birthDate,
      deathDateLabel: fieldLabels.deathDate,
      bioLabel: fieldLabels.bio,
      genderOptions: {
        create: genderOptions.map((option, index) => ({
          key: option.key,
          label: option.label,
          sortOrder: index,
        })),
      },
      relations: {
        create: relations.map((relation, index) => ({
          key: relation.key,
          label: relation.label,
          sortOrder: index,
        })),
      },
    },
    include: {
      genderOptions: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }] },
      relations: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }] },
    },
  });

  return formatDbGlobalTag(created);
}

export async function updateGlobalTag(slug: string, input: GlobalTagInput): Promise<GlobalTag> {
  const normalizedSlug = normalizeGlobalTagSlug(slug);
  const nextSlug = input.slug ? normalizeGlobalTagSlug(input.slug) : normalizedSlug;
  const theme = sanitizeGlobalTagTheme(input.theme ?? {});
  const fieldLabels = sanitizeGlobalTagFieldLabels(input.fieldLabels ?? {});
  const genderOptions = normalizeGlobalTagGenderOptions(
    input.genderOptions ?? input.genderLabels,
    getGlobalTag(nextSlug).genderOptions
  ).map(({ key, label }) => ({ key, label }));
  const label = input.label?.trim();
  const relations = normalizeTagRelations(input.relations, getDefaultRelationsForTag(nextSlug)).map(
    ({ key, label }) => ({ key, label })
  );

  if (!label) {
    throw new Error('Nome da tag e obrigatorio.');
  }

  const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const tag = await tx.globalTag.update({
      where: { slug: normalizedSlug },
      data: {
        slug: nextSlug,
        label,
        description: input.description?.trim() || '',
        background: theme.background,
        surface: theme.surface,
        border: theme.border,
        primary: theme.primary,
        secondary: theme.secondary,
        muted: theme.muted,
        node: theme.node,
        nodeSelected: theme.nodeSelected,
        edge: theme.edge,
        edgeSelected: theme.edgeSelected,
        genderLabel: fieldLabels.gender,
        birthDateLabel: fieldLabels.birthDate,
        deathDateLabel: fieldLabels.deathDate,
        bioLabel: fieldLabels.bio,
      },
    });

    if (nextSlug !== normalizedSlug) {
      await tx.globalNode.updateMany({
        where: { tagSlug: normalizedSlug },
        data: { tagSlug: nextSlug },
      });
      await tx.nodeRequest.updateMany({
        where: { nodeTagSlug: normalizedSlug },
        data: { nodeTagSlug: nextSlug },
      });
    }

    await tx.globalTagGenderOption.deleteMany({ where: { tagSlug: nextSlug } });
    await tx.globalTagGenderOption.createMany({
      data: genderOptions.map((option, index) => ({
        tagSlug: nextSlug,
        key: option.key,
        label: option.label,
        sortOrder: index,
      })),
    });

    await tx.globalTagRelation.deleteMany({ where: { tagSlug: nextSlug } });
    await tx.globalTagRelation.createMany({
      data: relations.map((relation, index) => ({
        tagSlug: nextSlug,
        key: relation.key,
        label: relation.label,
        sortOrder: index,
      })),
    });

    return tx.globalTag.findUniqueOrThrow({
      where: { slug: tag.slug },
      include: {
        genderOptions: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }] },
        relations: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }] },
      },
    });
  });

  return formatDbGlobalTag(updated);
}

export type DeleteGlobalTagResult = {
  slug: string;
  deletedNodes: number;
  deletedEdges: number;
  deletedRequests: number;
  imageUrls: number;
  deletedImages: number;
  failedImages: number;
};

function addImageUrl(urls: Set<string>, value?: string | null) {
  if (value?.trim()) urls.add(value.trim());
}

function addHtmlImageUrls(urls: Set<string>, value?: string | null) {
  extractAzureBlobUrlsFromHtml(value).forEach((url) => addImageUrl(urls, url));
}

async function deleteAzureImages(urls: string[]) {
  const results = await Promise.allSettled(urls.map((url) => deleteAzureBlobByUrl(url)));
  let deletedImages = 0;
  let failedImages = 0;

  results.forEach((result) => {
    if (result.status === 'fulfilled' && result.value) {
      deletedImages += 1;
      return;
    }

    failedImages += 1;
  });

  return { deletedImages, failedImages };
}

export async function deleteGlobalTagWithContent(slug: string): Promise<DeleteGlobalTagResult> {
  const normalizedSlug = normalizeGlobalTagSlug(slug);

  if (normalizedSlug === DEFAULT_GLOBAL_TAG_SLUG) {
    throw new Error('A tag padrao nao pode ser deletada.');
  }

  const imageUrls = new Set<string>();

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const taggedNodes = await tx.globalNode.findMany({
      where: { tagSlug: normalizedSlug },
      select: {
        id: true,
        photoUrl: true,
        bio: true,
      },
    });
    const nodeIds = taggedNodes.map((node) => node.id);

    taggedNodes.forEach((node) => {
      addImageUrl(imageUrls, node.photoUrl);
      addHtmlImageUrls(imageUrls, node.bio);
    });

    const globalEdges = nodeIds.length
      ? await tx.globalEdge.findMany({
          where: {
            OR: [{ fromId: { in: nodeIds } }, { toId: { in: nodeIds } }],
          },
          select: {
            id: true,
            documentImageUrl: true,
            documentContent: true,
          },
        })
      : [];

    globalEdges.forEach((edge) => {
      addImageUrl(imageUrls, edge.documentImageUrl);
      addHtmlImageUrls(imageUrls, edge.documentContent);
    });

    const taggedRequests = await tx.nodeRequest.findMany({
      where: { nodeTagSlug: normalizedSlug },
      select: {
        id: true,
        nodePhotoUrl: true,
        nodeBio: true,
        connections: {
          select: {
            documentImageUrl: true,
            documentContent: true,
          },
        },
      },
    });
    const taggedRequestIds = taggedRequests.map((request) => request.id);

    taggedRequests.forEach((request) => {
      addImageUrl(imageUrls, request.nodePhotoUrl);
      addHtmlImageUrls(imageUrls, request.nodeBio);
      request.connections.forEach((connection) => {
        addImageUrl(imageUrls, connection.documentImageUrl);
        addHtmlImageUrls(imageUrls, connection.documentContent);
      });
    });

    const danglingRequestConnections = nodeIds.length
      ? await tx.nodeRequestConn.findMany({
          where: { globalNodeId: { in: nodeIds } },
          select: {
            documentImageUrl: true,
            documentContent: true,
          },
        })
      : [];

    danglingRequestConnections.forEach((connection) => {
      addImageUrl(imageUrls, connection.documentImageUrl);
      addHtmlImageUrls(imageUrls, connection.documentContent);
    });

    if (taggedRequestIds.length > 0) {
      await tx.nodeRequestConn.deleteMany({ where: { requestId: { in: taggedRequestIds } } });
    }

    if (nodeIds.length > 0) {
      await tx.nodeRequestConn.deleteMany({ where: { globalNodeId: { in: nodeIds } } });
    }

    const deletedEdges = nodeIds.length
      ? await tx.globalEdge.deleteMany({
          where: {
            OR: [{ fromId: { in: nodeIds } }, { toId: { in: nodeIds } }],
          },
        })
      : { count: 0 };

    const deletedRequests = await tx.nodeRequest.deleteMany({
      where: { nodeTagSlug: normalizedSlug },
    });

    const deletedNodes = await tx.globalNode.deleteMany({
      where: { tagSlug: normalizedSlug },
    });

    await tx.globalTagRelation.deleteMany({ where: { tagSlug: normalizedSlug } });
    await tx.globalTag.deleteMany({ where: { slug: normalizedSlug } });

    return {
      deletedEdges: deletedEdges.count,
      deletedNodes: deletedNodes.count,
      deletedRequests: deletedRequests.count,
    };
  });

  const azureResult = await deleteAzureImages([...imageUrls]);

  return {
    slug: normalizedSlug,
    ...result,
    imageUrls: imageUrls.size,
    ...azureResult,
  };
}

export async function getRelationsForTag(slug?: string | null): Promise<GlobalTagRelation[]> {
  const tag = await getGlobalTagFromDb(slug);
  return tag.relations.length > 0 ? tag.relations : getDefaultRelationsForTag(tag.slug);
}

export async function normalizeAllowedRelationForTag(
  tagSlug: string,
  relation: string
): Promise<string> {
  const key = normalizeRelationKey(relation);
  const allowedRelations = await getRelationsForTag(tagSlug);

  if (!key || !allowedRelations.some((item) => item.key === key)) {
    const label = allowedRelations.map((item) => item.label).join(', ');
    throw new Error(`A relacao "${relation}" nao e permitida para esta tag. Permitidas: ${label}.`);
  }

  return key;
}

export async function normalizeAllowedRelationsForTag(
  tagSlug: string,
  relations: string[]
): Promise<string[]> {
  const allowedRelations = await getRelationsForTag(tagSlug);
  const allowedKeys = new Set(allowedRelations.map((relation) => relation.key));

  return relations.map((relation) => {
    const key = normalizeRelationKey(relation);

    if (!key || !allowedKeys.has(key)) {
      const label = allowedRelations.map((item) => item.label).join(', ');
      throw new Error(`A relacao "${relation}" nao e permitida para esta tag. Permitidas: ${label}.`);
    }

    return key;
  });
}
