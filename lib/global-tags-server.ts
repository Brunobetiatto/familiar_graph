import type {
  GlobalTag as DbGlobalTag,
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
  sanitizeGlobalTagTheme,
  type GlobalTag,
  type GlobalTagTheme,
} from '@/lib/global-tags';

export type GlobalTagInput = {
  slug?: string | null;
  label?: string | null;
  description?: string | null;
  theme?: Partial<GlobalTagTheme> | null;
  relations?: Array<Partial<GlobalTagRelation>> | null;
};

type DbGlobalTagWithRelations = DbGlobalTag & {
  relations?: DbGlobalTagRelation[];
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
    relations: normalizeTagRelations(
      tag.relations?.map((relation) => ({ key: relation.key, label: relation.label })),
      getDefaultRelationsForTag(tag.slug)
    ),
  };
}

export async function listGlobalTags(): Promise<GlobalTag[]> {
  const tags = await prisma.globalTag.findMany({
    include: { relations: { orderBy: { label: 'asc' } } },
    orderBy: [{ label: 'asc' }],
  });

  return tags.length > 0 ? tags.map(formatDbGlobalTag) : OFFICIAL_GLOBAL_TAGS;
}

export async function getGlobalTagFromDb(slug?: string | null): Promise<GlobalTag> {
  const normalizedSlug = normalizeGlobalTagSlug(slug);
  const tag = await prisma.globalTag.findUnique({
    where: { slug: normalizedSlug },
    include: { relations: { orderBy: { label: 'asc' } } },
  });

  if (tag) return formatDbGlobalTag(tag);

  const defaultTag = await prisma.globalTag.findUnique({
    where: { slug: DEFAULT_GLOBAL_TAG_SLUG },
    include: { relations: { orderBy: { label: 'asc' } } },
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
  const relations = normalizeTagRelations(input.relations, getDefaultRelationsForTag(slug));
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
      relations: {
        create: relations.map((relation) => ({
          key: relation.key,
          label: relation.label,
        })),
      },
    },
    include: { relations: { orderBy: { label: 'asc' } } },
  });

  return formatDbGlobalTag(created);
}

export async function updateGlobalTag(slug: string, input: GlobalTagInput): Promise<GlobalTag> {
  const normalizedSlug = normalizeGlobalTagSlug(slug);
  const nextSlug = input.slug ? normalizeGlobalTagSlug(input.slug) : normalizedSlug;
  const theme = sanitizeGlobalTagTheme(input.theme ?? {});
  const label = input.label?.trim();
  const relations = normalizeTagRelations(input.relations, getDefaultRelationsForTag(nextSlug));

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

    await tx.globalTagRelation.deleteMany({ where: { tagSlug: nextSlug } });
    await tx.globalTagRelation.createMany({
      data: relations.map((relation) => ({
        tagSlug: nextSlug,
        key: relation.key,
        label: relation.label,
      })),
    });

    return tx.globalTag.findUniqueOrThrow({
      where: { slug: tag.slug },
      include: { relations: { orderBy: { label: 'asc' } } },
    });
  });

  return formatDbGlobalTag(updated);
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
