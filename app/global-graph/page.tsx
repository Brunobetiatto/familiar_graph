import GlobalGraphFlow from '@/app/components/graph/GlobalGraphFlow';
import { getCurrentUser } from '@/lib/current-user';
import { getGlobalGraphWindow } from '@/lib/global-graph-window';
import { listGlobalTags } from '@/lib/global-tags-server';
import { prisma } from '@/lib/prisma';

// Garante que a página sempre retorna dados frescos (sem cache estático)
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Grafo Global',
  description: 'Visualização do grafo genealógico global',
};

type SearchParams = Record<string, string | string[] | undefined>;

function readParam(searchParams: SearchParams, key: string) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function GlobalGraphPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = searchParams ? await searchParams : {};
  const tagSlug = readParam(params, 'tagSlug');
  const nodeId = readParam(params, 'nodeId');
  const edgeId = readParam(params, 'edgeId');
  const citationEdge = edgeId
    ? await prisma.globalEdge.findUnique({
        where: { id: edgeId },
        select: {
          id: true,
          fromId: true,
          fromNode: {
            select: {
              tagSlug: true,
            },
          },
        },
      })
    : null;
  const seedNodeId = nodeId ?? citationEdge?.fromId ?? null;
  const effectiveTagSlug = tagSlug ?? citationEdge?.fromNode.tagSlug;
  const [graphWindow, globalTags, currentUser] = await Promise.all([
    getGlobalGraphWindow({ seedNodeId, tagSlug: effectiveTagSlug }),
    listGlobalTags(),
    getCurrentUser(),
  ]);

  return (
    <GlobalGraphFlow
      initialNodes={graphWindow.nodes}
      initialEdges={graphWindow.edges}
      initialRootNode={graphWindow.rootNode}
      graphLimit={graphWindow.limit}
      initialActiveTag={graphWindow.activeTag}
      officialTags={globalTags}
      currentUser={currentUser}
      initialFocusNodeId={nodeId}
      initialFocusEdgeId={citationEdge?.id ?? null}
    />
  );
}
