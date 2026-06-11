import GlobalGraphFlow from '@/app/components/graph/GlobalGraphFlow';
import { getCurrentUser } from '@/lib/current-user';
import { getGlobalGraphWindow } from '@/lib/global-graph-window';
import { listGlobalTags } from '@/lib/global-tags-server';

// Garante que a página sempre retorna dados frescos (sem cache estático)
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Grafo Global',
  description: 'Visualização do grafo genealógico global',
};

export default async function GlobalGraphPage() {
  const [graphWindow, globalTags, currentUser] = await Promise.all([
    getGlobalGraphWindow(),
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
    />
  );
}
