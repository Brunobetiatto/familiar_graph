import GlobalGraphFlow from '@/app/components/graph/GlobalGraphFlow';
import { getGlobalGraphWindow } from '@/lib/global-graph-window';

// Garante que a página sempre retorna dados frescos (sem cache estático)
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Grafo Global',
  description: 'Visualização do grafo genealógico global',
};

export default async function GlobalGraphPage() {
  const graphWindow = await getGlobalGraphWindow();

  return (
    <GlobalGraphFlow
      initialNodes={graphWindow.nodes}
      initialEdges={graphWindow.edges}
      initialRootNode={graphWindow.rootNode}
      graphLimit={graphWindow.limit}
    />
  );
}
