'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

import {
  ReactFlow,
  Background,
  Controls,
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
import NodeDetailPanel, { type NodeEditData } from './NodeDetailPanel';
import RequestNodeModal from './RequestNodeModal';
import ConnectionDocumentModal, {
  type ConnectionDocument,
  type ConnectionEditData,
} from './ConnectionDocumentModal';
import ElkEdge from './edges/ElkEdge';
import { applyElkLayout } from '@/lib/graph-layout'; // ← NOVO IMPORT
import { normalizeSearchText } from '@/lib/fuzzy-node-search';
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
  initialFocusNodeId?: string | null;
  initialFocusEdgeId?: string | null;
  currentUser?: {
    id: string;
    email: string;
    name: string | null;
    role: string;
  } | null;
};

type EdgeData = {
  relation?: string;
  relationKey?: string;
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

type PathSearchResult = {
  id: string;
  name: string;
  photoUrl?: string | null;
  tagSlug?: string;
};

type GraphWindowResponse = {
  nodes: Node[];
  edges: Edge[];
  rootNode: { id: string; name: string } | null;
  limit: number;
  activeTag: GlobalTag;
};

type GraphFilters = {
  textQuery: string;
  dateField: 'any' | 'birthDate' | 'deathDate';
  datePresence: 'all' | 'withAnyDate' | 'withBirthDate' | 'withDeathDate' | 'withBothDates';
  dateFrom: string;
  dateTo: string;
  genderValues: string[];
  relationKeys: string[];
  onlyConnected: boolean;
  minConnections: number;
  nodeContent: 'all' | 'withPhoto' | 'withoutPhoto' | 'withBio';
  edgeDocumentOnly: boolean;
};

const NODE_WIDTH = 200;
const NODE_HEIGHT = 80;
const GRAPH_MIN_ZOOM = 0.12;
const CLEAN_EDGE_MAX_PER_NODE = 3;
const CLEAN_EDGE_MAX_TOTAL = 150;
const CLEAN_EDGE_ROOT_BONUS_LIMIT = 36;
const EMPTY_GRAPH_FILTERS: GraphFilters = {
  textQuery: '',
  dateField: 'any',
  datePresence: 'all',
  dateFrom: '',
  dateTo: '',
  genderValues: [],
  relationKeys: [],
  onlyConnected: false,
  minConnections: 0,
  nodeContent: 'all',
  edgeDocumentOnly: false,
};

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

function edgeHasDocument(edgeData?: EdgeData) {
  return Boolean(
    edgeData?.documentTitle ||
      edgeData?.documentContent ||
      edgeData?.documentImageUrl ||
      edgeData?.description
  );
}

function readNodeDateValue(data: Partial<PersonNodeData>, field: GraphFilters['dateField']) {
  if (field === 'birthDate') return data.birthDate ?? null;
  if (field === 'deathDate') return data.deathDate ?? null;
  return data.birthDate ?? data.deathDate ?? null;
}

function isIsoDateInRange(iso: string | null, from: string, to: string): boolean {
  if (!from && !to) return true;
  if (!iso) return false;

  const value = new Date(iso).getTime();
  if (Number.isNaN(value)) return false;

  if (from) {
    const fromTime = new Date(`${from}T00:00:00`).getTime();
    if (!Number.isNaN(fromTime) && value < fromTime) return false;
  }

  if (to) {
    const toTime = new Date(`${to}T23:59:59`).getTime();
    if (!Number.isNaN(toTime) && value > toTime) return false;
  }

  return true;
}

function getEdgeRelationKey(edge: Edge): string {
  const data = edge.data as EdgeData | undefined;
  return data?.relationKey ?? String(data?.relation ?? edge.label ?? '');
}

function countActiveFilters(filters: GraphFilters): number {
  return (
    (filters.textQuery.trim() ? 1 : 0) +
    (filters.dateFrom || filters.dateTo ? 1 : 0) +
    (filters.datePresence !== 'all' ? 1 : 0) +
    filters.genderValues.length +
    filters.relationKeys.length +
    (filters.onlyConnected ? 1 : 0) +
    (filters.minConnections > 0 ? 1 : 0) +
    (filters.nodeContent !== 'all' ? 1 : 0) +
    (filters.edgeDocumentOnly ? 1 : 0)
  );
}

function matchesDatePresence(
  data: Partial<PersonNodeData>,
  presence: GraphFilters['datePresence']
): boolean {
  if (presence === 'withAnyDate') return Boolean(data.birthDate || data.deathDate);
  if (presence === 'withBirthDate') return Boolean(data.birthDate);
  if (presence === 'withDeathDate') return Boolean(data.deathDate);
  if (presence === 'withBothDates') return Boolean(data.birthDate && data.deathDate);
  return true;
}

function matchesNodeContent(data: Partial<PersonNodeData>, content: GraphFilters['nodeContent']) {
  if (content === 'withPhoto') return Boolean(data.photoUrl);
  if (content === 'withoutPhoto') return !data.photoUrl;
  if (content === 'withBio') return Boolean(data.bio?.trim());
  return true;
}

function matchesTextFilter(data: Partial<PersonNodeData>, query: string) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  const searchableText = normalizeSearchText(
    [data.name, data.bio, data.gender, data.tagLabel].filter(Boolean).join(' ')
  );

  return searchableText.includes(normalizedQuery);
}

function selectCleanGraphEdges({
  edges,
  nodesLength,
  rootNodeId,
  selectedNodeId,
  selectedEdgeId,
}: {
  edges: Edge[];
  nodesLength: number;
  rootNodeId?: string | null;
  selectedNodeId?: string | null;
  selectedEdgeId?: string | null;
}) {
  if (edges.length <= CLEAN_EDGE_MAX_TOTAL && edges.length <= nodesLength * 2.2) {
    return edges;
  }

  const selectedEdge = selectedEdgeId ? edges.find((edge) => edge.id === selectedEdgeId) : null;
  const forcedEdges = new Map<string, Edge>();

  edges.forEach((edge) => {
    if (edge.id === selectedEdgeId) forcedEdges.set(edge.id, edge);
    if (selectedNodeId && (edge.source === selectedNodeId || edge.target === selectedNodeId)) {
      forcedEdges.set(edge.id, edge);
    }
  });

  if (selectedEdge) forcedEdges.set(selectedEdge.id, selectedEdge);

  const degreeByNodeId = new Map<string, number>();
  const selectedEdges = new Map<string, Edge>(forcedEdges);

  forcedEdges.forEach((edge) => {
    degreeByNodeId.set(edge.source, (degreeByNodeId.get(edge.source) ?? 0) + 1);
    degreeByNodeId.set(edge.target, (degreeByNodeId.get(edge.target) ?? 0) + 1);
  });

  const rootEdges = rootNodeId
    ? edges
        .filter(
          (edge) =>
            !selectedEdges.has(edge.id) &&
            (edge.source === rootNodeId || edge.target === rootNodeId)
        )
        .sort((a, b) => {
          const aData = a.data as EdgeData | undefined;
          const bData = b.data as EdgeData | undefined;
          const aScore = (edgeHasDocument(aData) ? 2 : 0) + (aData?.documentTitle ? 1 : 0);
          const bScore = (edgeHasDocument(bData) ? 2 : 0) + (bData?.documentTitle ? 1 : 0);
          return bScore - aScore || a.id.localeCompare(b.id);
        })
        .slice(0, CLEAN_EDGE_ROOT_BONUS_LIMIT)
    : [];

  rootEdges.forEach((edge) => {
    selectedEdges.set(edge.id, edge);
    degreeByNodeId.set(edge.source, (degreeByNodeId.get(edge.source) ?? 0) + 1);
    degreeByNodeId.set(edge.target, (degreeByNodeId.get(edge.target) ?? 0) + 1);
  });

  const prioritizedEdges = edges
    .filter((edge) => !selectedEdges.has(edge.id))
    .map((edge) => {
      const data = edge.data as EdgeData | undefined;
      const touchesRoot = rootNodeId ? edge.source === rootNodeId || edge.target === rootNodeId : false;
      const score =
        (touchesRoot ? 80 : 0) +
        (edgeHasDocument(data) ? 34 : 0) +
        (data?.documentTitle ? 12 : 0) +
        (data?.description ? 8 : 0);

      return { edge, score };
    })
    .sort((a, b) => b.score - a.score || a.edge.id.localeCompare(b.edge.id));

  for (const { edge } of prioritizedEdges) {
    if (selectedEdges.size >= CLEAN_EDGE_MAX_TOTAL) break;

    const sourceDegree = degreeByNodeId.get(edge.source) ?? 0;
    const targetDegree = degreeByNodeId.get(edge.target) ?? 0;

    if (sourceDegree >= CLEAN_EDGE_MAX_PER_NODE || targetDegree >= CLEAN_EDGE_MAX_PER_NODE) {
      continue;
    }

    selectedEdges.set(edge.id, edge);
    degreeByNodeId.set(edge.source, sourceDegree + 1);
    degreeByNodeId.set(edge.target, targetDegree + 1);
  }

  return edges.filter((edge) => selectedEdges.has(edge.id));
}

export default function GlobalGraphFlow({
  initialNodes,
  initialEdges,
  initialRootNode = null,
  initialActiveTag,
  officialTags,
  initialFocusNodeId = null,
  initialFocusEdgeId = null,
  currentUser = null,
}: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [allNodes, setAllNodes] = useState<Node[]>([]);
  const [allEdges, setAllEdges] = useState<Edge[]>(initialEdges);
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
  const [isGraphFilterOpen, setIsGraphFilterOpen] = useState(false);
  const [graphFilters, setGraphFilters] = useState<GraphFilters>(EMPTY_GRAPH_FILTERS);
  const [searchError, setSearchError] = useState('');
  const [themeAnimationKey, setThemeAnimationKey] = useState(0);
  const [isPathMenuOpen, setIsPathMenuOpen] = useState(false);
  const [pathFromQuery, setPathFromQuery] = useState('');
  const [pathToQuery, setPathToQuery] = useState('');
  const [pathFromNode, setPathFromNode] = useState<PathSearchResult | null>(null);
  const [pathToNode, setPathToNode] = useState<PathSearchResult | null>(null);
  const [pathActiveField, setPathActiveField] = useState<'from' | 'to' | null>(null);
  const [pathSearchResults, setPathSearchResults] = useState<PathSearchResult[]>([]);
  const tagTheme = activeTag.theme;
  const searchCloseTimerRef = useRef<number | null>(null);
  const initialFocusAppliedRef = useRef(false);
  const pathMenuRef = useRef<HTMLDivElement>(null);
  const graphFilterRef = useRef<HTMLDivElement>(null);

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

  const updateGraphUrl = useCallback((tagSlug: string, nodeId?: string | null) => {
    const url = new URL(window.location.href);
    url.pathname = '/global-graph';
    url.searchParams.set('tagSlug', tagSlug);
    url.searchParams.delete('edgeId');

    if (nodeId) {
      url.searchParams.set('nodeId', nodeId);
    } else {
      url.searchParams.delete('nodeId');
    }

    window.history.replaceState(null, '', `${url.pathname}?${url.searchParams.toString()}`);
  }, []);

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
        setAllNodes([]);
        setAllEdges([]);
        setNodes([]);
        setEdges([]);
        setLayoutReady(true);
        return;
      }

      try {
        const layoutEdges = selectCleanGraphEdges({
          edges: graphEdges,
          nodesLength: graphNodes.length,
          rootNodeId: nextRootNode?.id,
          selectedNodeId,
        });
        const { nodes: laidOutNodes, edges: laidOutEdges } = await applyElkLayout(
          graphNodes,
          layoutEdges,
          'TB'
        );
        const layoutEdgeById = new Map(laidOutEdges.map((edge) => [edge.id, edge]));
        const nextGraphEdges = graphEdges.map((edge) => layoutEdgeById.get(edge.id) ?? edge);
        const nextNodes = selectedNodeId
          ? laidOutNodes.map((node) => ({
              ...node,
              selected: node.id === selectedNodeId,
            }))
          : laidOutNodes;

        setAllNodes(laidOutNodes);
        setAllEdges(nextGraphEdges);
        setNodes(nextNodes);
        setEdges(nextGraphEdges);
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
        setAllNodes(graphNodes);
        setAllEdges(graphEdges);
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
    void applyGraphWindow(initialNodes, initialEdges, initialRootNode, initialFocusNodeId);
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

  useEffect(() => {
    const activeQuery = pathActiveField === 'from' ? pathFromQuery : pathToQuery;

    if (!isPathMenuOpen || !pathActiveField || activeQuery.trim().length < 2) {
      setPathSearchResults([]);
      return;
    }

    const delay = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          q: activeQuery.trim(),
          tagSlug: activeTag.slug,
        });
        const res = await fetch(`/api/global-graph/path-search?${params.toString()}`);
        if (!res.ok) return;

        const results = (await res.json()) as PathSearchResult[];
        const blockedId = pathActiveField === 'from' ? pathToNode?.id : pathFromNode?.id;
        setPathSearchResults(results.filter((node) => node.id !== blockedId));
      } catch (err) {
        console.error('Erro na busca de caminho:', err);
      }
    }, 240);

    return () => window.clearTimeout(delay);
  }, [
    activeTag.slug,
    isPathMenuOpen,
    pathActiveField,
    pathFromNode?.id,
    pathFromQuery,
    pathToNode?.id,
    pathToQuery,
  ]);

  useEffect(() => {
    if (!isPathMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (pathMenuRef.current?.contains(target)) return;

      setIsPathMenuOpen(false);
      setPathActiveField(null);
      setPathSearchResults([]);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isPathMenuOpen]);

  useEffect(() => {
    if (!isGraphFilterOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (graphFilterRef.current?.contains(target)) return;

      setIsGraphFilterOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isGraphFilterOpen]);

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
        const res = await fetch(`/api/global-graph?${params.toString()}`, { cache: 'no-store' });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Erro ao carregar recorte do grafo.');
        }

        const graphWindow = (await res.json()) as GraphWindowResponse;
        setActiveTag(graphWindow.activeTag);
        updateGraphUrl(graphWindow.activeTag.slug, node.id);
        await applyGraphWindow(graphWindow.nodes, graphWindow.edges, graphWindow.rootNode, node.id);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Erro ao carregar recorte do grafo.';
        setSearchError(message);
      } finally {
        setIsGraphLoading(false);
      }
    },
    [activeTag.slug, applyGraphWindow, updateGraphUrl]
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
      setGraphFilters(EMPTY_GRAPH_FILTERS);
      setIsGraphFilterOpen(false);

      try {
        const params = new URLSearchParams({ tagSlug: tag.slug });
        const res = await fetch(`/api/global-graph?${params.toString()}`, { cache: 'no-store' });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Erro ao carregar tema do grafo.');
        }

        const graphWindow = (await res.json()) as GraphWindowResponse;
        setActiveTag(graphWindow.activeTag);
        updateGraphUrl(graphWindow.activeTag.slug);
        await applyGraphWindow(graphWindow.nodes, graphWindow.edges, graphWindow.rootNode);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Erro ao carregar tema do grafo.';
        setSearchError(message);
      } finally {
        setIsGraphLoading(false);
      }
    },
    [applyGraphWindow, updateGraphUrl]
  );

  const activeFilterCount = useMemo(() => countActiveFilters(graphFilters), [graphFilters]);

  const maxConnectionCount = useMemo(() => {
    const counts = new Map<string, number>();

    allEdges.forEach((edge) => {
      counts.set(edge.source, (counts.get(edge.source) ?? 0) + 1);
      counts.set(edge.target, (counts.get(edge.target) ?? 0) + 1);
    });

    return Math.max(0, ...counts.values());
  }, [allEdges]);

  useEffect(() => {
    setGraphFilters((current) =>
      current.minConnections > maxConnectionCount
        ? { ...current, minConnections: maxConnectionCount }
        : current
    );
  }, [maxConnectionCount]);

  const filteredGraph = useMemo(() => {
    const relationFilter = new Set(graphFilters.relationKeys);
    const genderFilter = new Set(graphFilters.genderValues);
    const relationFilteredEdges =
      relationFilter.size > 0
        ? allEdges.filter((edge) => relationFilter.has(getEdgeRelationKey(edge)))
        : allEdges;
    const scopedEdges = graphFilters.edgeDocumentOnly
      ? relationFilteredEdges.filter((edge) => edgeHasDocument(edge.data as EdgeData | undefined))
      : relationFilteredEdges;
    const connectedNodeIds = new Set<string>();
    const connectionCountByNodeId = new Map<string, number>();

    scopedEdges.forEach((edge) => {
      connectedNodeIds.add(edge.source);
      connectedNodeIds.add(edge.target);
      connectionCountByNodeId.set(edge.source, (connectionCountByNodeId.get(edge.source) ?? 0) + 1);
      connectionCountByNodeId.set(edge.target, (connectionCountByNodeId.get(edge.target) ?? 0) + 1);
    });

    const filteredNodes = allNodes.filter((node) => {
      const data = node.data as Partial<PersonNodeData>;
      const nodeDate = readNodeDateValue(data, graphFilters.dateField);
      const hasMatchingDate = isIsoDateInRange(nodeDate, graphFilters.dateFrom, graphFilters.dateTo);
      const hasMatchingDatePresence = matchesDatePresence(data, graphFilters.datePresence);
      const hasMatchingGender =
        genderFilter.size === 0 || (data.gender ? genderFilter.has(data.gender) : false);
      const connectionCount = connectionCountByNodeId.get(node.id) ?? 0;
      const hasConnection = !graphFilters.onlyConnected || connectionCount > 0;
      const hasMinimumConnections = connectionCount >= graphFilters.minConnections;
      const hasMatchingContent = matchesNodeContent(data, graphFilters.nodeContent);
      const hasMatchingText = matchesTextFilter(data, graphFilters.textQuery);

      return (
        hasMatchingDate &&
        hasMatchingDatePresence &&
        hasMatchingGender &&
        hasConnection &&
        hasMinimumConnections &&
        hasMatchingContent &&
        hasMatchingText
      );
    });
    const visibleNodeIds = new Set(filteredNodes.map((node) => node.id));
    const filteredEdges = scopedEdges.filter(
      (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
    );

    return {
      nodes: filteredNodes,
      edges: filteredEdges,
      nodeIds: visibleNodeIds,
      edgeIds: new Set(filteredEdges.map((edge) => edge.id)),
      connectionCountByNodeId,
    };
  }, [allEdges, allNodes, graphFilters]);

  useEffect(() => {
    const nextNodes = filteredGraph.nodes.map((node) => ({
      ...node,
      selected: selectedNodeData?.id === node.id,
    }));

    setNodes(nextNodes);
    setEdges(filteredGraph.edges);

    if (selectedNodeData && !filteredGraph.nodeIds.has(selectedNodeData.id)) {
      setSelectedNodeData(null);
    }

    if (selectedEdgeId && !filteredGraph.edgeIds.has(selectedEdgeId)) {
      setSelectedEdgeId(null);
      setDocumentConnection(null);
    }

    if (layoutReady && allNodes.length > 0) {
      fitGraphContent(nextNodes, 320);
    }
  }, [
    allNodes.length,
    filteredGraph,
    fitGraphContent,
    layoutReady,
    selectedEdgeId,
    selectedNodeData,
    setEdges,
    setNodes,
  ]);

  const toggleGenderFilter = useCallback((value: string) => {
    setGraphFilters((current) => ({
      ...current,
      genderValues: current.genderValues.includes(value)
        ? current.genderValues.filter((item) => item !== value)
        : [...current.genderValues, value],
    }));
  }, []);

  const toggleRelationFilter = useCallback((value: string) => {
    setGraphFilters((current) => ({
      ...current,
      relationKeys: current.relationKeys.includes(value)
        ? current.relationKeys.filter((item) => item !== value)
        : [...current.relationKeys, value],
    }));
  }, []);

  const clearGraphFilters = useCallback(() => {
    setGraphFilters(EMPTY_GRAPH_FILTERS);
  }, []);

  const visibleGenderOptions = activeTag.genderOptions;
  const visibleRelationOptions = activeTag.relations;
  const minConnectionRangeMax = Math.max(maxConnectionCount, 1);

  const visibleEdges = useMemo(
    () =>
      selectCleanGraphEdges({
        edges,
        nodesLength: nodes.length,
        rootNodeId: rootNode?.id,
        selectedNodeId: selectedNodeData?.id,
        selectedEdgeId,
      }),
    [edges, nodes.length, rootNode?.id, selectedEdgeId, selectedNodeData?.id]
  );

  const styledEdges = useMemo<Edge[]>(
    () =>
      visibleEdges.map((e) => {
        const selected = e.id === selectedEdgeId;
        const showLabel = visibleEdges.length <= 80 || selected;

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
    [selectedEdgeId, tagTheme.edge, tagTheme.edgeSelected, tagTheme.primary, visibleEdges]
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

  useEffect(() => {
    if (!layoutReady || initialFocusAppliedRef.current) return;
    if (!initialFocusEdgeId) return;

    const edge = edges.find((item) => item.id === initialFocusEdgeId);
    if (!edge) return;

    initialFocusAppliedRef.current = true;
    window.requestAnimationFrame(() => {
      focusEdge(edge.id);
      setDocumentConnection(buildConnectionDocument(edge));
    });
  }, [buildConnectionDocument, edges, focusEdge, initialFocusEdgeId, layoutReady]);

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
    (event, edge) => {
      event.stopPropagation();
      setNodes((currentNodes) =>
        currentNodes.map((item) => ({
          ...item,
          selected: false,
        }))
      );
      setSelectedNodeData(null);
      focusEdge(edge.id);
      setDocumentConnection(buildConnectionDocument(edge));
    },
    [buildConnectionDocument, focusEdge, setNodes]
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

  const handleUpdateNode = useCallback(
    async (nodeId: string, data: NodeEditData) => {
      const response = await fetch(`/api/admin/global-nodes/${nodeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Nao foi possivel atualizar o no.');
      }

      const previousData = nodes.find((node) => node.id === nodeId)?.data as
        | PersonNodeData
        | undefined;
      const nextNodeData: PersonNodeData = {
        name: result.name,
        birthDate: result.birthDate ?? null,
        deathDate: result.deathDate ?? null,
        gender: result.gender ?? null,
        bio: result.bio ?? null,
        photoUrl: result.photoUrl ?? null,
        tagSlug: previousData?.tagSlug ?? activeTag.slug,
        tagLabel: previousData?.tagLabel ?? activeTag.label,
        tagColor: previousData?.tagColor ?? activeTag.theme.primary,
        fieldLabels: previousData?.fieldLabels ?? activeTag.fieldLabels,
        genderOptions: previousData?.genderOptions ?? activeTag.genderOptions,
      };

      const applyNodeUpdate = (node: Node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  ...nextNodeData,
                  label: nextNodeData.name,
                },
              }
            : node;

      setAllNodes((currentNodes) => currentNodes.map(applyNodeUpdate));
      setNodes((currentNodes) => currentNodes.map(applyNodeUpdate));

      setSelectedNodeData((current) =>
        current?.id === nodeId ? { ...current, ...nextNodeData } : current
      );

      setRootNode((current) =>
        current?.id === nodeId ? { ...current, name: nextNodeData.name } : current
      );
    },
    [
      activeTag.fieldLabels,
      activeTag.genderOptions,
      activeTag.label,
      activeTag.slug,
      activeTag.theme.primary,
      nodes,
      setNodes,
    ]
  );

  const handleUpdateConnection = useCallback(
    async (edgeId: string, data: ConnectionEditData) => {
      const response = await fetch(`/api/admin/global-edges/${edgeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Nao foi possivel atualizar a ligacao.');
      }

      const nextConnectionData = {
        relation: result.relationLabel ?? result.relation ?? data.relation,
        relationKey: result.relation ?? data.relation,
        description: result.description ?? null,
        documentTitle: result.documentTitle ?? null,
        documentContent: result.documentContent ?? null,
        documentImageUrl: result.documentImageUrl ?? null,
      };

      const applyEdgeUpdate = (edge: Edge) =>
          edge.id === edgeId
            ? {
                ...edge,
                label: nextConnectionData.relation,
                data: {
                  ...edge.data,
                  ...nextConnectionData,
                },
              }
            : edge;

      setAllEdges((currentEdges) => currentEdges.map(applyEdgeUpdate));
      setEdges((currentEdges) => currentEdges.map(applyEdgeUpdate));

      setDocumentConnection((current) =>
        current?.edgeId === edgeId ? { ...current, ...nextConnectionData } : current
      );
    },
    [setEdges]
  );

  const selectPathNode = useCallback((field: 'from' | 'to', node: PathSearchResult) => {
    if (field === 'from') {
      setPathFromNode(node);
      setPathFromQuery(node.name);
    } else {
      setPathToNode(node);
      setPathToQuery(node.name);
    }

    setPathSearchResults([]);
  }, []);

  const openPathPage = useCallback(() => {
    if (!pathFromNode || !pathToNode) return;

    const params = new URLSearchParams({
      from: pathFromNode.id,
      to: pathToNode.id,
      tagSlug: activeTag.slug,
    });
    window.location.assign(`/global-graph/path?${params.toString()}`);
  }, [activeTag.slug, pathFromNode, pathToNode]);

  const currentUserLabel = currentUser?.name?.trim() || currentUser?.email || '';
  const isCurrentUserAdmin = currentUser?.role === 'ADMIN';

  if (initialNodes.length === 0) {
    return (
      <div
        style={{
          height: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0f0d0b',
          fontFamily: '"DM Serif Display", Georgia, serif',
          overflow: 'hidden',
          overscrollBehavior: 'none',
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
          isAuthenticated={Boolean(currentUser)}
          initialTags={officialTags}
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
        </div>

        <div className={styles.centerTools}>
          <div
            className={`${styles.searchShell} ${
              isSearchExpanded && !isPathMenuOpen ? styles.searchShellOpen : ''
            } ${isPathMenuOpen ? styles.searchShellLocked : ''}`}
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
              if (isSearchExpanded && searchResults.length > 0 && !isFilterOpen) {
                setIsSearchOpen(true);
              }
            }}
            onMouseLeave={scheduleSearchClose}
          >
            <div
              className={`${styles.searchBar} ${
                isSearchExpanded && !isPathMenuOpen ? styles.searchBarOpen : ''
              }`}
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
                placeholder={isSearchExpanded && !isPathMenuOpen ? `Buscar em ${activeTag.label}...` : 'Buscar no grafo...'}
                className={styles.searchInput}
              />

              <div className={styles.tagTray} aria-hidden={!isSearchExpanded || isPathMenuOpen}>
                <button
                  type="button"
                  className={styles.tagButton}
                  onClick={(event) => {
                    event.stopPropagation();
                    setIsSearchExpanded(true);
                    setIsFilterOpen((current) => !current);
                    setIsSearchOpen(false);
                  }}
                  tabIndex={isSearchExpanded && !isPathMenuOpen ? 0 : -1}
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
            ref={pathMenuRef}
            className={styles.pathMenuShell}
            style={
              {
                '--path-menu-bg': tagTheme.surface,
                '--path-menu-border': tagTheme.border,
                '--path-menu-primary': tagTheme.primary,
                '--path-menu-secondary': tagTheme.secondary,
                '--path-menu-muted': tagTheme.muted,
                '--path-menu-page-bg': tagTheme.background,
              } as CSSProperties
            }
          >
            <button
              type="button"
              className={`${styles.pathMenuButton} ${isPathMenuOpen ? styles.pathMenuButtonOpen : ''}`}
              onPointerDown={() => {
                closeSearchArea();
                setIsGraphFilterOpen(false);
              }}
              onClick={() => {
                closeSearchArea();
                setIsGraphFilterOpen(false);
                setIsPathMenuOpen((current) => !current);
              }}
              aria-expanded={isPathMenuOpen}
              aria-label="Abrir ligacao direta"
            >
              <span className={styles.pathMenuIcon} aria-hidden="true">↔</span>
              <span className={styles.pathMenuText}>Ligacao direta</span>
            </button>

            {isPathMenuOpen && (
              <div className={styles.pathMenuPanel}>
                <label className={styles.pathField}>
                  <span>Origem</span>
                  <input
                    value={pathFromQuery}
                    onFocus={() => setPathActiveField('from')}
                    onChange={(event) => {
                      setPathFromQuery(event.target.value);
                      setPathFromNode(null);
                      setPathActiveField('from');
                    }}
                    placeholder="Buscar primeiro no..."
                  />
                </label>

                <label className={styles.pathField}>
                  <span>Destino</span>
                  <input
                    value={pathToQuery}
                    onFocus={() => setPathActiveField('to')}
                    onChange={(event) => {
                      setPathToQuery(event.target.value);
                      setPathToNode(null);
                      setPathActiveField('to');
                    }}
                    placeholder="Buscar segundo no..."
                  />
                </label>

                {pathActiveField && pathSearchResults.length > 0 && (
                  <div className={styles.pathResults}>
                    {pathSearchResults.map((node) => (
                      <button
                        key={node.id}
                        type="button"
                        onClick={() => selectPathNode(pathActiveField, node)}
                      >
                        <span>{node.name}</span>
                      </button>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  className={styles.pathSubmitButton}
                  disabled={!pathFromNode || !pathToNode}
                  onClick={openPathPage}
                >
                  Montar caminho
                </button>
              </div>
            )}
          </div>

          <div
            ref={graphFilterRef}
            className={styles.graphFilterShell}
            style={
              {
                '--graph-filter-bg': tagTheme.surface,
                '--graph-filter-border': tagTheme.border,
                '--graph-filter-primary': tagTheme.primary,
                '--graph-filter-secondary': tagTheme.secondary,
                '--graph-filter-muted': tagTheme.muted,
                '--graph-filter-page-bg': tagTheme.background,
              } as CSSProperties
            }
          >
            <button
              type="button"
              className={`${styles.graphFilterButton} ${isGraphFilterOpen ? styles.graphFilterButtonOpen : ''}`}
              onPointerDown={() => {
                closeSearchArea();
                setIsPathMenuOpen(false);
                setPathActiveField(null);
                setPathSearchResults([]);
              }}
              onClick={() => {
                closeSearchArea();
                setIsPathMenuOpen(false);
                setPathActiveField(null);
                setPathSearchResults([]);
                setIsGraphFilterOpen((current) => !current);
              }}
              aria-expanded={isGraphFilterOpen}
              aria-label="Abrir filtros do grafo"
            >
              <span className={styles.graphFilterIcon} aria-hidden="true">≡</span>
              <span className={styles.graphFilterText}>Filtros</span>
              {activeFilterCount > 0 && (
                <span className={styles.graphFilterBadge}>{activeFilterCount}</span>
              )}
            </button>

            {isGraphFilterOpen && (
              <div className={styles.graphFilterPanel}>
                <div className={styles.graphFilterHeader}>
                  <div className={styles.graphFilterStats}>
                    <span>
                      <strong>{filteredGraph.nodes.length}</strong>
                      <small>de {allNodes.length} nos</small>
                    </span>
                    <span>
                      <strong>{filteredGraph.edges.length}</strong>
                      <small>de {allEdges.length} ligacoes</small>
                    </span>
                  </div>
                  {activeFilterCount > 0 && (
                    <button type="button" onClick={clearGraphFilters}>
                      Limpar
                    </button>
                  )}
                </div>

                <label className={styles.graphFilterSearch}>
                  <span>Texto</span>
                  <input
                    value={graphFilters.textQuery}
                    onChange={(event) =>
                      setGraphFilters((current) => ({
                        ...current,
                        textQuery: event.target.value,
                      }))
                    }
                    placeholder="Nome, bio, campo ou tipo..."
                  />
                </label>

                <div className={`${styles.graphFilterSection} ${styles.graphFilterSectionCard}`}>
                  <span className={styles.graphFilterSectionTitle}>Data</span>
                  <div className={styles.graphFilterSegmented}>
                    {[
                      { value: 'any', label: 'Qualquer' },
                      { value: 'birthDate', label: activeTag.fieldLabels.birthDate },
                      { value: 'deathDate', label: activeTag.fieldLabels.deathDate },
                    ].map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        className={graphFilters.dateField === item.value ? styles.graphFilterSegmentActive : ''}
                        onClick={() =>
                          setGraphFilters((current) => ({
                            ...current,
                            dateField: item.value as GraphFilters['dateField'],
                          }))
                        }
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                  <div className={styles.graphFilterMiniChips}>
                    {[
                      { value: 'all', label: 'Todas' },
                      { value: 'withAnyDate', label: 'Com data' },
                      { value: 'withBirthDate', label: 'Com inicio' },
                      { value: 'withDeathDate', label: 'Com fim' },
                      { value: 'withBothDates', label: 'Com ambas' },
                    ].map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        className={
                          graphFilters.datePresence === item.value
                            ? styles.graphFilterChipSelected
                            : ''
                        }
                        onClick={() =>
                          setGraphFilters((current) => ({
                            ...current,
                            datePresence: item.value as GraphFilters['datePresence'],
                          }))
                        }
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                  <div className={styles.graphFilterDateGrid}>
                    <label>
                      <span>Inicio</span>
                      <input
                        type="date"
                        value={graphFilters.dateFrom}
                        onChange={(event) =>
                          setGraphFilters((current) => ({
                            ...current,
                            dateFrom: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span>Fim</span>
                      <input
                        type="date"
                        value={graphFilters.dateTo}
                        onChange={(event) =>
                          setGraphFilters((current) => ({
                            ...current,
                            dateTo: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                </div>

                <div className={`${styles.graphFilterSection} ${styles.graphFilterSectionCard}`}>
                  <span className={styles.graphFilterSectionTitle}>{activeTag.fieldLabels.gender}</span>
                  <div className={styles.graphFilterChips}>
                    {visibleGenderOptions.map((option) => {
                      const selected = graphFilters.genderValues.includes(option.key);

                      return (
                        <button
                          key={option.key}
                          type="button"
                          className={selected ? styles.graphFilterChipSelected : ''}
                          onClick={() => toggleGenderFilter(option.key)}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className={`${styles.graphFilterSection} ${styles.graphFilterSectionCard}`}>
                  <span className={styles.graphFilterSectionTitle}>Conteudo do no</span>
                  <div className={styles.graphFilterSegmented}>
                    {[
                      { value: 'all', label: 'Todos' },
                      { value: 'withPhoto', label: 'Com foto' },
                      { value: 'withoutPhoto', label: 'Sem foto' },
                      { value: 'withBio', label: 'Com bio' },
                    ].map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        className={graphFilters.nodeContent === item.value ? styles.graphFilterSegmentActive : ''}
                        onClick={() =>
                          setGraphFilters((current) => ({
                            ...current,
                            nodeContent: item.value as GraphFilters['nodeContent'],
                          }))
                        }
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={`${styles.graphFilterSection} ${styles.graphFilterSectionCard}`}>
                  <span className={styles.graphFilterSectionTitle}>Tipos de ligacao</span>
                  <div className={styles.graphFilterChips}>
                    {visibleRelationOptions.map((relation) => {
                      const selected = graphFilters.relationKeys.includes(relation.key);

                      return (
                        <button
                          key={relation.key}
                          type="button"
                          className={selected ? styles.graphFilterChipSelected : ''}
                          onClick={() => toggleRelationFilter(relation.key)}
                        >
                          {relation.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className={styles.graphFilterToggleGrid}>
                    <label className={styles.graphFilterToggle}>
                      <input
                        type="checkbox"
                        checked={graphFilters.onlyConnected}
                        onChange={(event) =>
                          setGraphFilters((current) => ({
                            ...current,
                            onlyConnected: event.target.checked,
                          }))
                        }
                      />
                      <span>Apenas com ligacoes</span>
                    </label>

                    <label className={styles.graphFilterToggle}>
                      <input
                        type="checkbox"
                        checked={graphFilters.edgeDocumentOnly}
                        onChange={(event) =>
                          setGraphFilters((current) => ({
                            ...current,
                            edgeDocumentOnly: event.target.checked,
                          }))
                        }
                      />
                      <span>Ligacoes com documento</span>
                    </label>
                  </div>

                  <label className={styles.graphFilterRange}>
                    <span>
                      <strong>Minimo de ligacoes</strong>
                      <small>{graphFilters.minConnections}</small>
                    </span>
                    <input
                      type="range"
                      min="0"
                      max={minConnectionRangeMax}
                      value={graphFilters.minConnections}
                      onChange={(event) =>
                        setGraphFilters((current) => ({
                          ...current,
                          minConnections: Number(event.target.value),
                        }))
                      }
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
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
        canEdit={isCurrentUserAdmin}
        onUpdateNode={handleUpdateNode}
      />

      <ConnectionDocumentModal
        connection={documentConnection}
        onClose={() => setDocumentConnection(null)}
        canEdit={isCurrentUserAdmin}
        citationTagSlug={activeTag.slug}
        onUpdateConnection={handleUpdateConnection}
      />

      <RequestNodeModal
        isOpen={isRequestModalOpen}
        onClose={handleCloseRequestModal}
        initialConnection={requestPreset}
        initialTagSlug={activeTag.slug}
        isAuthenticated={Boolean(currentUser)}
        initialTags={officialTags}
      />
    </div>
  );
}
