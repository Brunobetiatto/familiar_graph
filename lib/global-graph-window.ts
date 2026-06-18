import type { Edge, Node } from '@xyflow/react';
import { prisma } from '@/lib/prisma';
import { findRelationLabel } from '@/lib/global-relations';
import { DEFAULT_GLOBAL_TAG_SLUG, getGlobalTag, type GlobalTag } from '@/lib/global-tags';
import {
  getGlobalTagFromDb,
  listGlobalTags,
  resolveGlobalTagSlug,
} from '@/lib/global-tags-server';

export const GLOBAL_GRAPH_NODE_LIMIT = 200;
const GLOBAL_GRAPH_EDGE_LIMIT = 260;
const MAX_EDGES_PER_NODE = 5;

type GlobalGraphWindowOptions = {
  seedNodeId?: string | null;
  limit?: number;
  tagSlug?: string | null;
};

type DbNode = Awaited<ReturnType<typeof prisma.globalNode.findMany>>[number];
type DbEdge = Awaited<ReturnType<typeof prisma.globalEdge.findMany>>[number];

type GlobalNodeData = {
  name: string;
  label: string;
  birthDate: string | null;
  deathDate: string | null;
  gender: string | null;
  bio: string | null;
  photoUrl: string | null;
  tagSlug: string;
  tagLabel: string;
  tagColor: string;
  fieldLabels: GlobalTag['fieldLabels'];
  genderOptions: GlobalTag['genderOptions'];
};

type GlobalEdgeData = {
  relation: string;
  relationKey: string;
  description: string | null;
  documentTitle: string | null;
  documentContent: string | null;
  documentImageUrl: string | null;
};

export type GlobalGraphWindow = {
  nodes: Node<GlobalNodeData>[];
  edges: Edge<GlobalEdgeData>[];
  rootNode: { id: string; name: string } | null;
  limit: number;
  activeTag: GlobalTag;
};

function addNeighbor(adjacency: Map<string, string[]>, nodeId: string, neighborId: string) {
  const neighbors = adjacency.get(nodeId) ?? [];
  neighbors.push(neighborId);
  adjacency.set(nodeId, neighbors);
}

function collectNodeWindow(seedNodeId: string, edges: DbEdge[], limit: number): Set<string> {
  const adjacency = new Map<string, string[]>();

  edges.forEach((edge) => {
    addNeighbor(adjacency, edge.fromId, edge.toId);
    addNeighbor(adjacency, edge.toId, edge.fromId);
  });

  const selectedIds = new Set<string>([seedNodeId]);
  const queue = [seedNodeId];

  for (let cursor = 0; cursor < queue.length && selectedIds.size < limit; cursor += 1) {
    const currentId = queue[cursor];
    const neighbors = adjacency.get(currentId) ?? [];

    for (const neighborId of neighbors) {
      if (selectedIds.has(neighborId)) continue;

      selectedIds.add(neighborId);
      queue.push(neighborId);

      if (selectedIds.size >= limit) break;
    }
  }

  return selectedIds;
}

function formatNode(node: DbNode, tagBySlug: Map<string, GlobalTag>): Node<GlobalNodeData> {
  const tag = tagBySlug.get(node.tagSlug) ?? getGlobalTag(node.tagSlug);

  return {
    id: node.id,
    type: 'personNode',
    position: { x: 0, y: 0 },
    data: {
      name: node.name,
      label: node.name,
      birthDate: node.birthDate?.toISOString() ?? null,
      deathDate: node.deathDate?.toISOString() ?? null,
      gender: node.gender,
      bio: node.bio,
      photoUrl: node.photoUrl,
      tagSlug: tag.slug,
      tagLabel: tag.label,
      tagColor: tag.theme.primary,
      fieldLabels: tag.fieldLabels,
      genderOptions: tag.genderOptions,
    },
  };
}

function formatEdge(
  edge: DbEdge,
  nodeTagById: Map<string, string>,
  tagBySlug: Map<string, GlobalTag>
): Edge<GlobalEdgeData> {
  const sourceTagSlug = nodeTagById.get(edge.fromId);
  const sourceTag = tagBySlug.get(sourceTagSlug ?? '') ?? getGlobalTag(sourceTagSlug);
  const relationLabel = findRelationLabel(sourceTag.relations, edge.relation);

  return {
    id: edge.id,
    source: edge.fromId,
    target: edge.toId,
    label: relationLabel,
    type: 'elk',
    data: {
      relation: relationLabel,
      relationKey: edge.relation,
      description: edge.description,
      documentTitle: edge.documentTitle,
      documentContent: edge.documentContent,
      documentImageUrl: edge.documentImageUrl,
    },
  };
}

function limitEdgesForWindow(edges: DbEdge[], rootNodeId: string): DbEdge[] {
  if (edges.length <= GLOBAL_GRAPH_EDGE_LIMIT) return edges;

  const sortedEdges = [...edges].sort((a, b) => {
    const aTouchesRoot = a.fromId === rootNodeId || a.toId === rootNodeId;
    const bTouchesRoot = b.fromId === rootNodeId || b.toId === rootNodeId;

    if (aTouchesRoot !== bTouchesRoot) return aTouchesRoot ? -1 : 1;
    return a.id.localeCompare(b.id);
  });

  const degreeByNodeId = new Map<string, number>();
  const selectedEdges: DbEdge[] = [];

  for (const edge of sortedEdges) {
    const fromDegree = degreeByNodeId.get(edge.fromId) ?? 0;
    const toDegree = degreeByNodeId.get(edge.toId) ?? 0;
    const touchesRoot = edge.fromId === rootNodeId || edge.toId === rootNodeId;

    if (!touchesRoot && (fromDegree >= MAX_EDGES_PER_NODE || toDegree >= MAX_EDGES_PER_NODE)) {
      continue;
    }

    selectedEdges.push(edge);
    degreeByNodeId.set(edge.fromId, fromDegree + 1);
    degreeByNodeId.set(edge.toId, toDegree + 1);

    if (selectedEdges.length >= GLOBAL_GRAPH_EDGE_LIMIT) break;
  }

  return selectedEdges;
}

export async function getGlobalGraphWindow({
  seedNodeId,
  limit = GLOBAL_GRAPH_NODE_LIMIT,
  tagSlug = DEFAULT_GLOBAL_TAG_SLUG,
}: GlobalGraphWindowOptions = {}): Promise<GlobalGraphWindow> {
  const safeLimit = Math.max(1, Math.min(limit, GLOBAL_GRAPH_NODE_LIMIT));
  const normalizedTagSlug = await resolveGlobalTagSlug(tagSlug);
  const activeTag = await getGlobalTagFromDb(normalizedTagSlug);
  const allTags = await listGlobalTags();
  const tagBySlug = new Map(allTags.map((tag) => [tag.slug, tag]));
  const tagFilter = { tagSlug: normalizedTagSlug };

  const seedNode = seedNodeId
    ? await prisma.globalNode.findUnique({
        where: { id: seedNodeId },
        select: { id: true, name: true },
      })
    : await prisma.globalNode.findFirst({
        where: tagFilter,
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      });

  if (!seedNode) {
    return {
      nodes: [],
      edges: [],
      rootNode: null,
      limit: safeLimit,
      activeTag,
    };
  }

  const seedMatchesTag = await prisma.globalNode.findFirst({
    where: { id: seedNode.id, ...tagFilter },
    select: { id: true },
  });

  const effectiveSeedNode = seedMatchesTag
    ? seedNode
    : await prisma.globalNode.findFirst({
        where: tagFilter,
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      });

  if (!effectiveSeedNode) {
    return {
      nodes: [],
      edges: [],
      rootNode: null,
      limit: safeLimit,
      activeTag,
    };
  }

  const taggedNodeIds: Array<{ id: string }> = await prisma.globalNode.findMany({
    where: tagFilter,
    select: { id: true },
  });
  const taggedIdSet = new Set(taggedNodeIds.map((node) => node.id));
  const allEdgesRaw: DbEdge[] = await prisma.globalEdge.findMany();
  const allEdges: DbEdge[] = allEdgesRaw.filter(
    (edge) => taggedIdSet.has(edge.fromId) && taggedIdSet.has(edge.toId)
  );
  const selectedIds = collectNodeWindow(effectiveSeedNode.id, allEdges, safeLimit);

  if (selectedIds.size < safeLimit) {
    const fillerNodes: Array<{ id: string }> = await prisma.globalNode.findMany({
      where: {
        ...tagFilter,
        id: {
          notIn: [...selectedIds],
        },
      },
      orderBy: { name: 'asc' },
      take: safeLimit - selectedIds.size,
      select: { id: true },
    });

    fillerNodes.forEach((node) => selectedIds.add(node.id));
  }

  const dbNodes: DbNode[] = await prisma.globalNode.findMany({
    where: {
      ...tagFilter,
      id: {
        in: [...selectedIds],
      },
    },
    orderBy: { name: 'asc' },
  });

  const validIds = new Set(dbNodes.map((node) => node.id));
  const nodeTagById = new Map(dbNodes.map((node) => [node.id, node.tagSlug]));
  const dbEdges = limitEdgesForWindow(
    allEdges.filter((edge) => validIds.has(edge.fromId) && validIds.has(edge.toId)),
    effectiveSeedNode.id
  );

  return {
    nodes: dbNodes.map((node) => formatNode(node, tagBySlug)),
    edges: dbEdges.map((edge) => formatEdge(edge, nodeTagById, tagBySlug)),
    rootNode: effectiveSeedNode,
    limit: safeLimit,
    activeTag,
  };
}
