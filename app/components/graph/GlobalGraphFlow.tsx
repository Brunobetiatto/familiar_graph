'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

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
import ConnectionDocumentModal, { type ConnectionDocument } from './ConnectionDocumentModal';
import ElkEdge from './edges/ElkEdge';
import { applyElkLayout } from '@/lib/graph-layout'; // ← NOVO IMPORT
import type { GlobalTag } from '@/lib/global-tags';
import styles from './GlobalGraphFlow.module.css';

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
  initialRootNode?: { id: string; name: string } | null;
  graphLimit?: number;
  initialActiveTag: GlobalTag;
  officialTags: GlobalTag[];
  currentUser?: {
    id: string;
    email: string;
    name: string | null;
    role: string;
  } | null;
};

type EdgeData = {
  relation?: string;
  description?: string | null;
  documentTitle?: string | null;
  documentContent?: string | null;
  documentImageUrl?: string | null;
  elkPoints?: Array<{ x: number; y: number }>;
};

type NodeConnection = ConnectionDocument & {
  edgeId: string;
  otherNodeName: string;
  directionLabel: string;
  relation: string;
  description: string | null;
};

type SearchResult = {
  id: string;
  name: string;
  gender?: string | null;
};

type GraphWindowResponse = {
  nodes: Node[];
  edges: Edge[];
  rootNode: { id: string; name: string } | null;
  limit: number;
  activeTag: GlobalTag;
};

const NODE_WIDTH = 200;
const NODE_HEIGHT = 80;
const GRAPH_MIN_ZOOM = 0.12;

function getGraphFitPadding(nodeCount: number): number {
  if (nodeCount <= 1) return 0.42;
  if (nodeCount <= 8) return 0.34;
  if (nodeCount <= 40) return 0.24;
  return 0.18;
}

function getGraphFitMaxZoom(nodeCount: number): number {
  if (nodeCount <= 1) return 1.05;
  if (nodeCount <= 8) return 0.95;
  if (nodeCount <= 40) return 0.82;
  return 0.68;
}

export default function GlobalGraphFlow({
  initialNodes,
  initialEdges,
  initialRootNode = null,
  graphLimit = 200,
  initialActiveTag,
  officialTags,
  currentUser = null,
}: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const flowInstanceRef = useRef<ReactFlowInstance<Node, Edge> | null>(null);
  const pendingFitRef = useRef<{ nodeIds: string[]; nodeCount: number; duration: number } | null>(
    null
  );

  const [selectedNodeData, setSelectedNodeData] = useState<
    (PersonNodeData & { id: string }) | null
  >(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [documentConnection, setDocumentConnection] = useState<ConnectionDocument | null>(null);

  const [layoutReady, setLayoutReady] = useState(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestPreset, setRequestPreset] = useState<{ id: string; name: string } | null>(null);
  const [rootNode, setRootNode] = useState(initialRootNode);
  const [activeTag, setActiveTag] = useState(initialActiveTag);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isGraphLoading, setIsGraphLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [themeAnimationKey, setThemeAnimationKey] = useState(0);
  const tagTheme = activeTag.theme;
  const searchCloseTimerRef = useRef<number | null>(null);

  const clearSearchCloseTimer = useCallback(() => {
    if (!searchCloseTimerRef.current) return;
    window.clearTimeout(searchCloseTimerRef.current);
    searchCloseTimerRef.current = null;
  }, []);

  const closeSearchArea = useCallback(() => {
    clearSearchCloseTimer();
    setIsFilterOpen(false);
    setIsSearchOpen(false);
    setIsSearchExpanded(false);
  }, [clearSearchCloseTimer]);

  const scheduleSearchClose = useCallback(() => {
    clearSearchCloseTimer();
    searchCloseTimerRef.current = window.setTimeout(() => {
      closeSearchArea();
    }, 260);
  }, [clearSearchCloseTimer, closeSearchArea]);

  const fitGraphContent = useCallback((graphNodes: Node[], duration = 520) => {
    const nodeIds = graphNodes.map((node) => node.id);
    const nodeCount = nodeIds.length;

    if (nodeCount === 0) return;

    const runFit = () => {
      const flow = flowInstanceRef.current;

      if (!flow) {
        pendingFitRef.current = { nodeIds, nodeCount, duration };
        return;
      }

      void flow.fitView({
        nodes: nodeIds.map((id) => ({ id })),
        padding: getGraphFitPadding(nodeCount),
        minZoom: GRAPH_MIN_ZOOM,
        maxZoom: getGraphFitMaxZoom(nodeCount),
        duration,
        interpolate: 'smooth',
      });
    };

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(runFit);
    });
  }, []);

  const applyGraphWindow = useCallback(
    async (
      graphNodes: Node[],
      graphEdges: Edge[],
      nextRootNode: { id: string; name: string } | null,
      selectedNodeId?: string | null
    ) => {
      setLayoutReady(false);
      setSelectedNodeData(null);
      setSelectedEdgeId(null);
      setDocumentConnection(null);
      setRootNode(nextRootNode);

      if (graphNodes.length === 0) {
        setNodes([]);
        setEdges([]);
        setLayoutReady(true);
        return;
      }

      try {
        const { nodes: laidOutNodes, edges: laidOutEdges } = await applyElkLayout(
          graphNodes,
          graphEdges,
          'TB'
        );
        const nextNodes = selectedNodeId
          ? laidOutNodes.map((node) => ({
              ...node,
              selected: node.id === selectedNodeId,
            }))
          : laidOutNodes;

        setNodes(nextNodes);
        setEdges(laidOutEdges);
        fitGraphContent(nextNodes, selectedNodeId ? 560 : 420);

        if (selectedNodeId) {
          const selectedNode = nextNodes.find((node) => node.id === selectedNodeId);
          if (selectedNode) {
            setSelectedNodeData({
              id: selectedNode.id,
              ...(selectedNode.data as PersonNodeData),
            });
          }
        }
      } catch (err) {
        console.error('ELK layout error:', err);
        const nextNodes = selectedNodeId
          ? graphNodes.map((node) => ({
              ...node,
              selected: node.id === selectedNodeId,
            }))
          : graphNodes;

        setNodes(nextNodes);
        setEdges(graphEdges);
        fitGraphContent(nextNodes, selectedNodeId ? 560 : 420);

        if (selectedNodeId) {
          const selectedNode = nextNodes.find((node) => node.id === selectedNodeId);
          if (selectedNode) {
            setSelectedNodeData({
              id: selectedNode.id,
              ...(selectedNode.data as PersonNodeData),
            });
          }
        }
      } finally {
        setLayoutReady(true);
      }
    },
    [fitGraphContent, setEdges, setNodes]
  );

  useEffect(() => {
    void applyGraphWindow(initialNodes, initialEdges, initialRootNode);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setThemeAnimationKey((current) => current + 1);
  }, [activeTag.slug]);

  useEffect(() => () => clearSearchCloseTimer(), [clearSearchCloseTimer]);

  useEffect(() => {
    const handleResize = () => {
      fitGraphContent(nodes, 280);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [fitGraphContent, nodes]);

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const delay = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          q: searchQuery.trim(),
          tagSlug: activeTag.slug,
        });
        const res = await fetch(`/api/nodes/search?${params.toString()}`);
        if (!res.ok) return;

        const results = (await res.json()) as SearchResult[];
        setSearchResults(results);
        setIsSearchOpen(true);
      } catch (err) {
        console.error('Erro na busca de nos:', err);
      }
    }, 250);

    return () => clearTimeout(delay);
  }, [activeTag.slug, searchQuery]);

  const loadGraphAroundNode = useCallback(
    async (node: { id: string; name: string }) => {
      setIsGraphLoading(true);
      setSearchError('');
      setIsSearchOpen(false);
      setIsFilterOpen(false);
      setSearchQuery(node.name);

      try {
        const params = new URLSearchParams({
          seedNodeId: node.id,
          tagSlug: activeTag.slug,
        });
        const res = await fetch(`/api/global-graph?${params.toString()}`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Erro ao carregar recorte do grafo.');
        }

        const graphWindow = (await res.json()) as GraphWindowResponse;
        setActiveTag(graphWindow.activeTag);
        await applyGraphWindow(graphWindow.nodes, graphWindow.edges, graphWindow.rootNode, node.id);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Erro ao carregar recorte do grafo.';
        setSearchError(message);
      } finally {
        setIsGraphLoading(false);
      }
    },
    [activeTag.slug, applyGraphWindow]
  );

  const loadGraphForTag = useCallback(
    async (tag: GlobalTag) => {
      setIsGraphLoading(true);
      setSearchError('');
      setSearchQuery('');
      setSearchResults([]);
      setIsSearchOpen(false);
      setIsFilterOpen(false);
      setIsSearchExpanded(true);
      setActiveTag(tag);

      try {
        const params = new URLSearchParams({ tagSlug: tag.slug });
        const res = await fetch(`/api/global-graph?${params.toString()}`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Erro ao carregar tema do grafo.');
        }

        const graphWindow = (await res.json()) as GraphWindowResponse;
        setActiveTag(graphWindow.activeTag);
        await applyGraphWindow(graphWindow.nodes, graphWindow.edges, graphWindow.rootNode);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Erro ao carregar tema do grafo.';
        setSearchError(message);
      } finally {
        setIsGraphLoading(false);
      }
    },
    [applyGraphWindow]
  );

  const styledEdges = useMemo<Edge[]>(
    () =>
      edges.map((e) => {
        const selected = e.id === selectedEdgeId;
        const showLabel = edges.length <= 120 || selected;

        return {
          ...e,
          label: showLabel ? e.label : undefined,
          selected,
          type: 'elk',
          data: {
            ...e.data,
            isSelected: selected,
          },
          style: selected
            ? { ...EDGE_BASE_STYLE, stroke: tagTheme.edgeSelected, strokeWidth: 4 }
            : { ...EDGE_BASE_STYLE, stroke: tagTheme.edge },

          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 20,
            height: 20,
            color: selected ? tagTheme.edgeSelected : tagTheme.primary,
          },

          labelStyle: EDGE_LABEL_STYLE,
          labelShowBg: showLabel,
          labelBgStyle: EDGE_LABEL_BG_STYLE,
          labelBgPadding: [8, 4] as [number, number],
          labelBgBorderRadius: 4,
        };
      }),
    [edges, selectedEdgeId, tagTheme.edge, tagTheme.edgeSelected, tagTheme.primary]
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
          documentTitle: edgeData?.documentTitle ?? null,
          documentContent: edgeData?.documentContent ?? null,
          documentImageUrl: edgeData?.documentImageUrl ?? null,
        };
      });
  }, [edges, nodeNameById, selectedNodeData]);

  const buildConnectionDocument = useCallback(
    (edge: Edge, selectedNodeId?: string | null): ConnectionDocument => {
      const edgeData = edge.data as EdgeData | undefined;
      const sourceName = nodeNameById.get(edge.source) ?? edge.source;
      const targetName = nodeNameById.get(edge.target) ?? edge.target;
      const isOutgoingFromSelected = selectedNodeId ? edge.source === selectedNodeId : true;
      const otherNodeName = selectedNodeId
        ? isOutgoingFromSelected
          ? targetName
          : sourceName
        : `${sourceName} -> ${targetName}`;

      return {
        edgeId: edge.id,
        otherNodeName,
        directionLabel: selectedNodeId
          ? isOutgoingFromSelected
            ? 'Sai deste no'
            : 'Chega neste no'
          : 'Ligacao selecionada',
        relation: edgeData?.relation ?? String(edge.label ?? 'Conexao'),
        description: edgeData?.description ?? null,
        documentTitle: edgeData?.documentTitle ?? null,
        documentContent: edgeData?.documentContent ?? null,
        documentImageUrl: edgeData?.documentImageUrl ?? null,
      };
    },
    [nodeNameById]
  );

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

  const openConnectionDocument = useCallback(
    (edgeId: string) => {
      focusEdge(edgeId);

      const fromPanel = selectedNodeConnections.find((connection) => connection.edgeId === edgeId);
      if (fromPanel) {
        setDocumentConnection(fromPanel);
        return;
      }

      const edge = edges.find((item) => item.id === edgeId);
      if (edge) setDocumentConnection(buildConnectionDocument(edge, selectedNodeData?.id));
    },
    [buildConnectionDocument, edges, focusEdge, selectedNodeConnections, selectedNodeData]
  );

  const onNodeClick: NodeMouseHandler<Node> = useCallback(
    (_event, node) => {
      setNodes((currentNodes) =>
        currentNodes.map((item) => ({
          ...item,
          selected: item.id === node.id,
        }))
      );
      setSelectedNodeData({ id: node.id, ...(node.data as PersonNodeData) });
      setSelectedEdgeId(null);
    },
    [setNodes]
  );

  const onEdgeClick: EdgeMouseHandler<Edge> = useCallback(
    (_event, edge) => {
      const sourceNode = nodes.find((node) => node.id === edge.source);
      if (sourceNode) {
        setNodes((currentNodes) =>
          currentNodes.map((item) => ({
            ...item,
            selected: item.id === sourceNode.id,
          }))
        );
        setSelectedNodeData({ id: sourceNode.id, ...(sourceNode.data as PersonNodeData) });
      }
      focusEdge(edge.id);
      setDocumentConnection(buildConnectionDocument(edge, sourceNode?.id));
    },
    [buildConnectionDocument, focusEdge, nodes, setNodes]
  );

  const onPaneClick = useCallback(() => {
    setNodes((currentNodes) =>
      currentNodes.map((node) => ({
        ...node,
        selected: false,
      }))
    );
    setSelectedNodeData(null);
    setSelectedEdgeId(null);
    setDocumentConnection(null);
  }, [setNodes]);

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

  const currentUserLabel = currentUser?.name?.trim() || currentUser?.email || '';
  const isCurrentUserAdmin = currentUser?.role === 'ADMIN';

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
          initialTagSlug={activeTag.slug}
        />
      </div>
    );
  }

  return (
    <div
      className={styles.graphRoot}
      style={
        {
          '--graph-bg': tagTheme.background,
          '--graph-primary': tagTheme.primary,
          '--graph-border': tagTheme.border,
        } as CSSProperties
      }
    >
      {themeAnimationKey > 1 && (
        <div key={themeAnimationKey} className={styles.themeWash} />
      )}

      {/* Header */}
      <div
        className={styles.graphHeader}
        style={
          {
            '--graph-header-bg': `${tagTheme.background}e8`,
          } as CSSProperties
        }
      >
        <div className={styles.graphTitleBlock}>
          <h1
            className={styles.graphTitle}
            style={{ color: tagTheme.secondary }}
          >
            Grafo Global
          </h1>
          {layoutReady && (
            <p className={styles.graphMeta} style={{ color: tagTheme.muted }}>
              {nodes.length}/{graphLimit} membros · {edges.length} conexões
              {rootNode ? ` · origem: ${rootNode.name}` : ''}
              {` · tema: ${activeTag.label}`}
            </p>
          )}
        </div>

        <div
          className={`${styles.searchShell} ${isSearchExpanded ? styles.searchShellOpen : ''}`}
          style={
            {
              '--search-bg': tagTheme.surface,
              '--search-border': tagTheme.border,
              '--search-primary': tagTheme.primary,
              '--search-secondary': tagTheme.secondary,
              '--search-muted': tagTheme.muted,
              '--search-page-bg': tagTheme.background,
            } as CSSProperties
          }
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return;
            closeSearchArea();
          }}
          onMouseEnter={() => {
            clearSearchCloseTimer();
            setIsSearchExpanded(true);
            if (searchResults.length > 0 && !isFilterOpen) setIsSearchOpen(true);
          }}
          onMouseLeave={scheduleSearchClose}
        >
          <div
            className={`${styles.searchBar} ${isSearchExpanded ? styles.searchBarOpen : ''}`}
            onClick={() => setIsSearchExpanded(true)}
          >
            <span className={styles.searchIcon} aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M10.8 18.1a7.3 7.3 0 1 1 0-14.6 7.3 7.3 0 0 1 0 14.6Z"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path d="m16.2 16.2 4.3 4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>

            <input
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setSearchError('');
                setIsFilterOpen(false);
              }}
              onFocus={() => {
                setIsSearchExpanded(true);
                setIsSearchOpen(searchResults.length > 0);
              }}
              placeholder={isSearchExpanded ? `Buscar em ${activeTag.label}...` : 'Buscar no grafo...'}
              className={styles.searchInput}
            />

            <div className={styles.tagTray} aria-hidden={!isSearchExpanded}>
              <button
                type="button"
                className={styles.tagButton}
                onClick={(event) => {
                  event.stopPropagation();
                  setIsSearchExpanded(true);
                  setIsFilterOpen((current) => !current);
                  setIsSearchOpen(false);
                }}
                tabIndex={isSearchExpanded ? 0 : -1}
              >
                <span className={styles.tagDot} />
                <span>{activeTag.label}</span>
                <svg
                  className={`${styles.chevron} ${isFilterOpen ? styles.chevronOpen : ''}`}
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>

          {isFilterOpen && isSearchExpanded && (
            <div className={styles.dropdown}>
              {officialTags.map((tag) => {
                const selected = activeTag.slug === tag.slug;

                return (
                  <button
                    key={tag.slug}
                    type="button"
                    onClick={() => void loadGraphForTag(tag)}
                    className={`${styles.tagOption} ${selected ? styles.tagOptionSelected : ''}`}
                  >
                    <span
                      className={styles.tagOptionDot}
                      style={{ background: tag.theme.primary }}
                    />
                    <span className={styles.tagOptionText}>
                      <span className={styles.tagOptionTitle}>{tag.label}</span>
                      <span className={styles.tagOptionDescription}>{tag.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {!isFilterOpen && isSearchOpen && isSearchExpanded && searchResults.length > 0 && (
            <div className={styles.dropdown}>
              {searchResults.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  onClick={() => void loadGraphAroundNode(result)}
                  className={styles.searchOption}
                >
                  {result.name}
                </button>
              ))}
            </div>
          )}

          {searchError && <p className={styles.searchError}>{searchError}</p>}
        </div>

        <div
          className={styles.headerActions}
        >
          {currentUser && (
            <aside
              aria-label="Sessao do usuario"
              className={styles.sessionMenu}
              tabIndex={0}
              style={{
                '--session-bg': `${tagTheme.surface}e8`,
                '--session-border': tagTheme.border,
                '--session-primary': tagTheme.primary,
                '--session-secondary': tagTheme.secondary,
                '--session-muted': tagTheme.muted,
                '--session-page-bg': tagTheme.background,
              } as CSSProperties}
            >
              <span
                title={currentUser.email}
                className={`${styles.sessionName} ${
                  isCurrentUserAdmin ? styles.sessionNameAdmin : ''
                }`}
              >
                {currentUserLabel}
              </span>

              <div className={styles.sessionActions}>
                {isCurrentUserAdmin && (
                  <a href="/admin" className={styles.sessionActionButton}>
                    Admin
                  </a>
                )}
                <form action="/api/auth/logout" method="post">
                  <button
                    type="submit"
                    className={`${styles.sessionActionButton} ${styles.sessionLogoutButton}`}
                  >
                    Sair
                  </button>
                </form>
              </div>
            </aside>
          )}
          <button
            onClick={handleOpenRequestModal}
            className={styles.requestButton}
            style={
              {
                '--request-bg': tagTheme.primary,
                '--request-color': tagTheme.background,
              } as CSSProperties
            }
          >
            <span className={styles.requestButtonFull}>Solicitar novo no</span>
            <span className={styles.requestButtonShort}>Novo no</span>
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
            background: tagTheme.background,
            zIndex: 20,
            fontFamily: '"DM Serif Display", Georgia, serif',
            color: tagTheme.muted,
            fontSize: 16,
          }}
        >
          {isGraphLoading ? 'Carregando recorte do grafo...' : 'Calculando layout...'}
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
          const pendingFit = pendingFitRef.current;

          if (pendingFit) {
            pendingFitRef.current = null;
            window.requestAnimationFrame(() => {
              void instance.fitView({
                nodes: pendingFit.nodeIds.map((id) => ({ id })),
                padding: getGraphFitPadding(pendingFit.nodeCount),
                minZoom: GRAPH_MIN_ZOOM,
                maxZoom: getGraphFitMaxZoom(pendingFit.nodeCount),
                duration: pendingFit.duration,
                interpolate: 'smooth',
              });
            });
          }
        }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        minZoom={GRAPH_MIN_ZOOM}
        maxZoom={2.5}
        onlyRenderVisibleElements
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          color={tagTheme.border}
          gap={28}
          size={1.2}
        />

        <Controls
          showInteractive={false}
          style={{
            background: tagTheme.surface,
            border: `1px solid ${tagTheme.border}`,
            borderRadius: 8,
            overflow: 'hidden',
          }}
        />

        {nodes.length <= 120 && (
          <MiniMap
            style={{
              background: tagTheme.surface,
              border: `1px solid ${tagTheme.border}`,
              borderRadius: 8,
            }}
            nodeColor={tagTheme.border}
            nodeStrokeColor={tagTheme.primary}
            maskColor="rgba(10, 9, 7, 0.82)"
          />
        )}
      </ReactFlow>

      <NodeDetailPanel
        node={selectedNodeData}
        connections={selectedNodeConnections}
        selectedEdgeId={selectedEdgeId}
        onClose={() => {
          setSelectedNodeData(null);
          setSelectedEdgeId(null);
          setDocumentConnection(null);
        }}
        onSelectConnection={openConnectionDocument}
        onRequestConnection={handleRequestConnection}
      />

      <ConnectionDocumentModal
        connection={documentConnection}
        onClose={() => setDocumentConnection(null)}
      />

      <RequestNodeModal
        isOpen={isRequestModalOpen}
        onClose={handleCloseRequestModal}
        initialConnection={requestPreset}
        initialTagSlug={activeTag.slug}
      />
    </div>
  );
}
