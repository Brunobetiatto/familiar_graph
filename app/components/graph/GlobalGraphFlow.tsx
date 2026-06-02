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
  MarkerType,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from '@xyflow/react';

import PersonNode, { type PersonNodeData } from './nodes/PersonNode';
import NodeDetailPanel from './NodeDetailPanel';
import RequestNodeModal from './RequestNodeModal';
import ElkEdge from './edges/ElkEdge';
import { applyElkLayout } from '@/lib/graph-layout'; // ← NOVO IMPORT

const NODE_TYPES = { personNode: PersonNode };
const EDGE_TYPES = { elk: ElkEdge };

const EDGE_BASE_STYLE = {
  stroke: '#8a7856',
  strokeWidth: 2,
};

const EDGE_LABEL_STYLE = {
  fill: '#f0e6d3',
  fontSize: 12,
  fontWeight: 600,
  fontFamily: 'sans-serif',
};

const EDGE_LABEL_BG_STYLE = {
  fill: '#111009',
  stroke: '#3a3020',
  strokeWidth: 1,
};

type Props = {
  initialNodes: Node[];
  initialEdges: Edge[];
};

export default function GlobalGraphFlow({ initialNodes, initialEdges }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const [selectedNodeData, setSelectedNodeData] = useState<
    (PersonNodeData & { id: string }) | null
  >(null);

  const [layoutReady, setLayoutReady] = useState(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestPreset, setRequestPreset] = useState<{ id: string; name: string } | null>(null);

  // ← AGORA É ASYNC por causa do ELK
  useEffect(() => {
    if (initialNodes.length === 0) {
      setLayoutReady(true);
      return;
    }

    applyElkLayout(initialNodes, initialEdges, 'TB')
      .then(({ nodes: laidOutNodes, edges: laidOutEdges }) => {
        setNodes(laidOutNodes);
        setEdges(laidOutEdges);
        setLayoutReady(true);
      })
      .catch((err) => {
        console.error('ELK layout error:', err);
        // Fallback: usa os nós sem layout
        setNodes(initialNodes);
        setEdges(initialEdges);
        setLayoutReady(true);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const styledEdges = useMemo(
    () =>
      edges.map((e) => ({
        ...e,
        type: 'elk',
        style: EDGE_BASE_STYLE,

        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
          color: '#c49a2a',
        },

        labelStyle: EDGE_LABEL_STYLE,
        labelShowBg: true,
        labelBgStyle: EDGE_LABEL_BG_STYLE,
        labelBgPadding: [8, 4] as [number, number],
        labelBgBorderRadius: 4,
      })),
    [edges]
  );

  const onNodeClick: NodeMouseHandler<Node> = useCallback(
    (_event, node) => {
      setSelectedNodeData({ id: node.id, ...(node.data as PersonNodeData) });
    },
    []
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodeData(null);
  }, []);

  const handleRequestConnection = useCallback((node: { id: string; name: string }) => {
    setRequestPreset(node);
    setIsRequestModalOpen(true);
  }, []);

  const handleOpenRequestModal = useCallback(() => {
    setRequestPreset(null);
    setIsRequestModalOpen(true);
  }, []);

  const handleCloseRequestModal = useCallback(() => {
    setIsRequestModalOpen(false);
    setRequestPreset(null);
  }, []);

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
            O grafo ainda esta vazio
          </p>
          <p style={{ color: '#4a3e2a', fontSize: 13, marginBottom: 18 }}>
            Aguardando nos adicionados pelo administrador.
          </p>
          <button
            onClick={handleOpenRequestModal}
            style={{
              padding: '10px 16px',
              background: '#c49a2a',
              color: '#111009',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
              fontFamily: 'inherit',
            }}
          >
            Solicitar novo no
          </button>
        </div>

        <RequestNodeModal
          isOpen={isRequestModalOpen}
          onClose={handleCloseRequestModal}
          initialConnection={requestPreset}
        />
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', width: '100%', background: '#0f0d0b', position: 'relative' }}>

      {/* Header */}
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
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
        <div style={{ pointerEvents: 'auto' }}>
          <button
            onClick={handleOpenRequestModal}
            style={{
              padding: '8px 14px',
              background: '#c49a2a',
              color: '#111009',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
              fontFamily: 'inherit',
              boxShadow: '0 6px 16px rgba(0,0,0,0.35)',
            }}
          >
            Solicitar novo no
          </button>
        </div>
      </div>

      {/* Loading overlay enquanto o ELK calcula */}
      {!layoutReady && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0f0d0b',
            zIndex: 20,
            fontFamily: '"DM Serif Display", Georgia, serif',
            color: '#8a7856',
            fontSize: 16,
          }}
        >
          Calculando layout...
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={styledEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        fitView
        fitViewOptions={{ padding: 0.2 }}
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

      <NodeDetailPanel
        node={selectedNodeData}
        onClose={() => setSelectedNodeData(null)}
        onRequestConnection={handleRequestConnection}
      />

      <RequestNodeModal
        isOpen={isRequestModalOpen}
        onClose={handleCloseRequestModal}
        initialConnection={requestPreset}
      />
    </div>
  );
}