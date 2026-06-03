'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
  type EdgeMouseHandler,
  type NodeMouseHandler,
  type ReactFlowInstance,
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

type EdgeData = {
  relation?: string;
  description?: string | null;
  elkPoints?: Array<{ x: number; y: number }>;
};

type NodeConnection = {
  edgeId: string;
  otherNodeName: string;
  directionLabel: string;
  relation: string;
  description: string | null;
};

const NODE_WIDTH = 200;
const NODE_HEIGHT = 80;

export default function GlobalGraphFlow({ initialNodes, initialEdges }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const flowInstanceRef = useRef<ReactFlowInstance<Node, Edge> | null>(null);

  const [selectedNodeData, setSelectedNodeData] = useState<
    (PersonNodeData & { id: string }) | null
  >(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

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

  const styledEdges = useMemo<Edge[]>(
    () =>
      edges.map((e) => ({
        ...e,
        selected: e.id === selectedEdgeId,
        type: 'elk',
        style:
          e.id === selectedEdgeId
            ? { ...EDGE_BASE_STYLE, stroke: '#f2c94c', strokeWidth: 4 }
            : EDGE_BASE_STYLE,

        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
          color: e.id === selectedEdgeId ? '#f2c94c' : '#c49a2a',
        },

        labelStyle: EDGE_LABEL_STYLE,
        labelShowBg: true,
        labelBgStyle: EDGE_LABEL_BG_STYLE,
        labelBgPadding: [8, 4] as [number, number],
        labelBgBorderRadius: 4,
      })),
    [edges, selectedEdgeId]
  );

  const nodeNameById = useMemo(() => {
    const map = new Map<string, string>();
    nodes.forEach((node) => {
      const data = node.data as Partial<PersonNodeData> & { label?: unknown };
      map.set(node.id, data.name ?? String(data.label ?? node.id));
    });
    return map;
  }, [nodes]);

  const selectedNodeConnections = useMemo<NodeConnection[]>(() => {
    if (!selectedNodeData) return [];

    return edges
      .filter((edge) => edge.source === selectedNodeData.id || edge.target === selectedNodeData.id)
      .map((edge) => {
        const edgeData = edge.data as EdgeData | undefined;
        const isOutgoing = edge.source === selectedNodeData.id;
        const otherNodeId = isOutgoing ? edge.target : edge.source;

        return {
          edgeId: edge.id,
          otherNodeName: nodeNameById.get(otherNodeId) ?? otherNodeId,
          directionLabel: isOutgoing ? 'Sai deste no' : 'Chega neste no',
          relation: edgeData?.relation ?? String(edge.label ?? 'Conexao'),
          description: edgeData?.description ?? null,
        };
      });
  }, [edges, nodeNameById, selectedNodeData]);

  const focusEdge = useCallback(
    (edgeId: string) => {
      setSelectedEdgeId(edgeId);

      const edge = edges.find((item) => item.id === edgeId);
      const flow = flowInstanceRef.current;
      if (!edge || !flow) return;

      const points = (edge.data as EdgeData | undefined)?.elkPoints;
      if (points && points.length > 0) {
        const xs = points.map((point) => point.x);
        const ys = points.map((point) => point.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);

        flow.fitBounds(
          {
            x: minX - 80,
            y: minY - 80,
            width: Math.max(maxX - minX + 160, 220),
            height: Math.max(maxY - minY + 160, 160),
          },
          { padding: 0.2, duration: 450 }
        );
        return;
      }

      const sourceNode = nodes.find((node) => node.id === edge.source);
      const targetNode = nodes.find((node) => node.id === edge.target);
      if (!sourceNode || !targetNode) return;

      const sourceCenter = {
        x: sourceNode.position.x + NODE_WIDTH / 2,
        y: sourceNode.position.y + NODE_HEIGHT / 2,
      };
      const targetCenter = {
        x: targetNode.position.x + NODE_WIDTH / 2,
        y: targetNode.position.y + NODE_HEIGHT / 2,
      };

      flow.setCenter(
        (sourceCenter.x + targetCenter.x) / 2,
        (sourceCenter.y + targetCenter.y) / 2,
        { zoom: 1.1, duration: 450 }
      );
    },
    [edges, nodes]
  );

  const onNodeClick: NodeMouseHandler<Node> = useCallback(
    (_event, node) => {
      setSelectedNodeData({ id: node.id, ...(node.data as PersonNodeData) });
      setSelectedEdgeId(null);
    },
    []
  );

  const onEdgeClick: EdgeMouseHandler<Edge> = useCallback(
    (_event, edge) => {
      const sourceNode = nodes.find((node) => node.id === edge.source);
      if (sourceNode) {
        setSelectedNodeData({ id: sourceNode.id, ...(sourceNode.data as PersonNodeData) });
      }
      focusEdge(edge.id);
    },
    [focusEdge, nodes]
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodeData(null);
    setSelectedEdgeId(null);
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
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        onInit={(instance) => {
          flowInstanceRef.current = instance;
        }}
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
        connections={selectedNodeConnections}
        selectedEdgeId={selectedEdgeId}
        onClose={() => {
          setSelectedNodeData(null);
          setSelectedEdgeId(null);
        }}
        onSelectConnection={focusEdge}
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
