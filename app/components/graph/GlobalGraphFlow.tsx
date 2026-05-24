'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from '@xyflow/react';

import PersonNode, { type PersonNodeData } from './nodes/PersonNode';
import NodeDetailPanel from './NodeDetailPanel';
import ConnectionModal from './ConnectionModal'; // <-- IMPORT DO NOVO MODAL
import { applyDagreLayout } from '@/lib/graph-layout';

// ─── Tipos de nós registrados no React Flow ───────────────────────────────────

const NODE_TYPES = { personNode: PersonNode };

// ─── Estilos base das arestas ─────────────────────────────────────────────────

const EDGE_BASE_STYLE = {
  stroke: '#4a3820', // Voltei para a cor original elegante
  strokeWidth: 1.5,
};

const EDGE_LABEL_STYLE = {
  fill: '#7a6a4a',
  fontSize: 10,
  fontFamily: '"DM Serif Display", Georgia, serif',
};

const EDGE_LABEL_BG_STYLE = {
  fill: '#0f0d0b',
  fillOpacity: 0.85,
};

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  initialNodes: Node[];
  initialEdges: Edge[];
};

// ─── Componente ───────────────────────────────────────────────────────────────

export default function GlobalGraphFlow({ initialNodes, initialEdges }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);
  
  // Estado para saber qual nó foi clicado
  const [selectedNodeData, setSelectedNodeData] = useState<
    (PersonNodeData & { id: string }) | null
  >(null);
  
  const [layoutReady, setLayoutReady] = useState(false);
  
  // Estado que controla se o modal de formulário está aberto
  const [isModalOpen, setIsModalOpen] = useState(false);

  // ── Aplica o layout Dagre na primeira renderização ──────────────────────────
  useEffect(() => {
    if (initialNodes.length === 0) {
      setLayoutReady(true);
      return;
    }
    const laidOut = applyDagreLayout(initialNodes, initialEdges, 'TB');
    setNodes(laidOut);
    setLayoutReady(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Estiliza as arestas com label e cor ─────────────────────────────────────
  const styledEdges = useMemo(
    () =>
      edges.map((e) => ({
        ...e,
        type: 'smoothstep',
        style: EDGE_BASE_STYLE,
        labelStyle: EDGE_LABEL_STYLE,
        labelBgStyle: EDGE_LABEL_BG_STYLE,
        labelBgPadding: [4, 6] as [number, number],
        labelBgBorderRadius: 4,
      })),
    [edges]
  );

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const onNodeClick: NodeMouseHandler<Node> = useCallback(
    (_event, node) => {
      setSelectedNodeData({ id: node.id, ...(node.data as PersonNodeData) });
    },
    []
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodeData(null);
  }, []);

  // Quando clicar no botão do painel, apenas abre o modal
  const handleRequestConnection = useCallback((nodeId: string) => {
    setIsModalOpen(true);
  }, []);

  // ── Estado vazio ──────────────────────────────────────────────────────────────
  if (initialNodes.length === 0) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0f0d0b',
          fontFamily: '"DM Serif Display", Georgia, serif',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#8a7856', fontSize: 18, marginBottom: 8 }}>
            O grafo ainda está vazio
          </p>
          <p style={{ color: '#4a3e2a', fontSize: 13 }}>
            Aguardando nós adicionados pelo administrador.
          </p>
        </div>
      </div>
    );
  }
  
  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100vh', width: '100%', background: '#0f0d0b', position: 'relative' }}>

      {/* Header fixo sobre o grafo */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          padding: '18px 24px',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          pointerEvents: 'none',
          background: 'linear-gradient(to bottom, rgba(15,13,11,0.9) 0%, transparent 100%)',
        }}
      >
        <div>
          <h1
            style={{
              color: '#f0e6d3',
              fontSize: 22,
              fontWeight: 600,
              margin: 0,
              fontFamily: '"DM Serif Display", Georgia, serif',
              letterSpacing: '0.01em',
            }}
          >
            Grafo Global
          </h1>
          {layoutReady && (
            <p style={{ color: '#5a4e38', fontSize: 12, margin: '4px 0 0', fontFamily: 'inherit' }}>
              {nodes.length} membros · {edges.length} conexões
            </p>
          )}
        </div>
      </div>

      {/* React Flow */}
      <ReactFlow
        nodes={nodes}
        edges={styledEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={NODE_TYPES}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        fitView
        fitViewOptions={{ padding: 0.18 }}
        minZoom={0.1}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          color="#2a1e10"
          gap={28}
          size={1.2}
        />

        <Controls
          showInteractive={false}
          style={{
            background: '#1a1410',
            border: '1px solid #3a3020',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        />

        <MiniMap
          style={{
            background: '#141210',
            border: '1px solid #3a3020',
            borderRadius: 8,
          }}
          nodeColor="#3a3020"
          nodeStrokeColor="#5a4830"
          maskColor="rgba(10, 9, 7, 0.82)"
        />
      </ReactFlow>

      {/* Painel lateral de detalhes */}
      <NodeDetailPanel
        node={selectedNodeData}
        onClose={() => setSelectedNodeData(null)}
        onRequestConnection={handleRequestConnection}
      />

      {/* O Novo Formulário Modal */}
      {selectedNodeData && (
        <ConnectionModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          targetNodeId={selectedNodeData.id}
          targetNodeName={selectedNodeData.name}
        />
      )}
    </div>
  );
}