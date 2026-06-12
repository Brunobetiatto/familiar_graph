import { prisma } from '@/lib/prisma';
import { findRelationLabel } from '@/lib/global-relations';
import { getGlobalTagFromDb, listGlobalTags, resolveGlobalTagSlug } from '@/lib/global-tags-server';
import { getGlobalTag, type GlobalTag } from '@/lib/global-tags';

type PathNodeRecord = {
  id: string;
  name: string;
  birthDate: Date | null;
  deathDate: Date | null;
  gender: string | null;
  bio: string | null;
  photoUrl: string | null;
  tagSlug: string;
};

type PathEdgeRecord = {
  id: string;
  fromId: string;
  toId: string;
  relation: string;
  description: string | null;
  documentTitle: string | null;
  documentContent: string | null;
  documentImageUrl: string | null;
};

export type GlobalGraphPathNode = {
  id: string;
  name: string;
  birthDate: string | null;
  deathDate: string | null;
  gender: string | null;
  bio: string | null;
  photoUrl: string | null;
  tagSlug: string;
  tagLabel: string;
  tagColor: string;
};

export type GlobalGraphPathEdge = {
  id: string;
  fromId: string;
  toId: string;
  relation: string;
  directionLabel: string;
  description: string | null;
  documentTitle: string | null;
  documentContent: string | null;
  documentImageUrl: string | null;
};

export type GlobalGraphPathStep = {
  node: GlobalGraphPathNode;
  edgeToNext: GlobalGraphPathEdge | null;
  nextNode: GlobalGraphPathNode | null;
};

export type GlobalGraphPathResult = {
  fromNode: GlobalGraphPathNode | null;
  toNode: GlobalGraphPathNode | null;
  steps: GlobalGraphPathStep[];
  activeTag: GlobalTag;
  found: boolean;
};

function addNeighbor(
  adjacency: Map<string, Array<{ nodeId: string; edgeId: string }>>,
  fromId: string,
  toId: string,
  edgeId: string
) {
  const neighbors = adjacency.get(fromId) ?? [];
  neighbors.push({ nodeId: toId, edgeId });
  adjacency.set(fromId, neighbors);
}

function findShortestPath(
  fromId: string,
  toId: string,
  edges: PathEdgeRecord[]
): { nodeIds: string[]; edgeIds: string[] } | null {
  if (fromId === toId) return { nodeIds: [fromId], edgeIds: [] };

  const adjacency = new Map<string, Array<{ nodeId: string; edgeId: string }>>();
  edges.forEach((edge) => {
    addNeighbor(adjacency, edge.fromId, edge.toId, edge.id);
    addNeighbor(adjacency, edge.toId, edge.fromId, edge.id);
  });

  const visited = new Set<string>([fromId]);
  const previous = new Map<string, { nodeId: string; edgeId: string }>();
  const queue = [fromId];

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const currentId = queue[cursor];
    const neighbors = adjacency.get(currentId) ?? [];

    for (const neighbor of neighbors) {
      if (visited.has(neighbor.nodeId)) continue;

      visited.add(neighbor.nodeId);
      previous.set(neighbor.nodeId, { nodeId: currentId, edgeId: neighbor.edgeId });

      if (neighbor.nodeId === toId) {
        const nodeIds = [toId];
        const edgeIds: string[] = [];
        let walker = toId;

        while (walker !== fromId) {
          const prev = previous.get(walker);
          if (!prev) return null;
          edgeIds.unshift(prev.edgeId);
          nodeIds.unshift(prev.nodeId);
          walker = prev.nodeId;
        }

        return { nodeIds, edgeIds };
      }

      queue.push(neighbor.nodeId);
    }
  }

  return null;
}

function formatNode(node: PathNodeRecord, tagBySlug: Map<string, GlobalTag>): GlobalGraphPathNode {
  const tag = tagBySlug.get(node.tagSlug) ?? getGlobalTag(node.tagSlug);

  return {
    id: node.id,
    name: node.name,
    birthDate: node.birthDate?.toISOString() ?? null,
    deathDate: node.deathDate?.toISOString() ?? null,
    gender: node.gender,
    bio: node.bio,
    photoUrl: node.photoUrl,
    tagSlug: tag.slug,
    tagLabel: tag.label,
    tagColor: tag.theme.primary,
  };
}

function formatEdge(
  edge: PathEdgeRecord,
  fromNode: GlobalGraphPathNode,
  tagBySlug: Map<string, GlobalTag>,
  traversedFromId: string
): GlobalGraphPathEdge {
  const sourceTag = tagBySlug.get(fromNode.tagSlug) ?? getGlobalTag(fromNode.tagSlug);
  const relation = findRelationLabel(sourceTag.relations, edge.relation);
  const isForward = edge.fromId === traversedFromId;

  return {
    id: edge.id,
    fromId: edge.fromId,
    toId: edge.toId,
    relation,
    directionLabel: isForward ? 'sentido original' : 'sentido inverso',
    description: edge.description,
    documentTitle: edge.documentTitle,
    documentContent: edge.documentContent,
    documentImageUrl: edge.documentImageUrl,
  };
}

export async function getGlobalGraphPath({
  fromId,
  toId,
  tagSlug,
}: {
  fromId?: string | null;
  toId?: string | null;
  tagSlug?: string | null;
}): Promise<GlobalGraphPathResult> {
  const normalizedTagSlug = await resolveGlobalTagSlug(tagSlug);
  const activeTag = await getGlobalTagFromDb(normalizedTagSlug);
  const allTags = await listGlobalTags();
  const tagBySlug = new Map(allTags.map((tag) => [tag.slug, tag]));

  if (!fromId || !toId) {
    return { fromNode: null, toNode: null, steps: [], activeTag, found: false };
  }

  const selectedNodes = await prisma.globalNode.findMany({
    where: {
      id: { in: [fromId, toId] },
      tagSlug: normalizedTagSlug,
    },
    select: {
      id: true,
      name: true,
      birthDate: true,
      deathDate: true,
      gender: true,
      bio: true,
      photoUrl: true,
      tagSlug: true,
    },
  }) as PathNodeRecord[];

  const selectedById = new Map(selectedNodes.map((node) => [node.id, formatNode(node, tagBySlug)]));
  const fromNode = selectedById.get(fromId) ?? null;
  const toNode = selectedById.get(toId) ?? null;

  if (!fromNode || !toNode) {
    return { fromNode, toNode, steps: [], activeTag, found: false };
  }

  const taggedNodes = await prisma.globalNode.findMany({
    where: { tagSlug: normalizedTagSlug },
    select: { id: true },
  }) as Array<{ id: string }>;
  const taggedIds = new Set(taggedNodes.map((node) => node.id));

  const allEdgesRaw = await prisma.globalEdge.findMany({
    select: {
      id: true,
      fromId: true,
      toId: true,
      relation: true,
      description: true,
      documentTitle: true,
      documentContent: true,
      documentImageUrl: true,
    },
  }) as PathEdgeRecord[];
  const allEdges = allEdgesRaw.filter(
    (edge) => taggedIds.has(edge.fromId) && taggedIds.has(edge.toId)
  );
  const shortestPath = findShortestPath(fromId, toId, allEdges);

  if (!shortestPath) {
    return { fromNode, toNode, steps: [], activeTag, found: false };
  }

  const pathNodesRaw = await prisma.globalNode.findMany({
    where: { id: { in: shortestPath.nodeIds } },
    select: {
      id: true,
      name: true,
      birthDate: true,
      deathDate: true,
      gender: true,
      bio: true,
      photoUrl: true,
      tagSlug: true,
    },
  }) as PathNodeRecord[];
  const pathNodeById = new Map(pathNodesRaw.map((node) => [node.id, formatNode(node, tagBySlug)]));
  const edgeById = new Map(allEdges.map((edge) => [edge.id, edge]));

  const steps: GlobalGraphPathStep[] = shortestPath.nodeIds.map((nodeId, index) => {
    const node = pathNodeById.get(nodeId);
    if (!node) throw new Error('No do caminho nao encontrado.');

    const edgeId = shortestPath.edgeIds[index];
    const edge = edgeId ? edgeById.get(edgeId) : null;
    const nextNodeId = shortestPath.nodeIds[index + 1];
    const nextNode = nextNodeId ? pathNodeById.get(nextNodeId) ?? null : null;

    return {
      node,
      edgeToNext: edge && nextNode ? formatEdge(edge, node, tagBySlug, node.id) : null,
      nextNode,
    };
  });

  return { fromNode, toNode, steps, activeTag, found: true };
}
