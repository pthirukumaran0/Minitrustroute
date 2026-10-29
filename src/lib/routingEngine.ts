import { getNeo4jSession } from './neo4j';
import { ISelectedRoute } from '../models/Transaction';

export interface RoutingNode {
  id: string;
  name: string;
  type: string;
  country: string;
  currency: string;
  status: string;
  isAvailable: boolean;
}

export interface RoutingEdge {
  source: string;
  target: string;
  baseCost: number;
  latencyMs: number;
  reliability: number;
  status: string;
  isAvailable: boolean;
  prohibited: boolean;
}

export interface GraphData {
  nodes: Map<string, RoutingNode>;
  adjacency: Map<string, RoutingEdge[]>;
}

export interface RouteOption {
  hops: string[];
  providerNames: string[];
  totalCost: number;
  totalLatencyMs: number;
  cumulativeReliability: number;
  compositeWeight: number;
}

export interface RouteRequestOptions {
  sourceCountry?: string;
  destinationCountry?: string;
  sourceProviderId?: string;
  destinationProviderId?: string;
  excludeEdges?: Array<{ source: string; target: string }>;
  excludeNodes?: string[];
  maxAlternatives?: number;
}

export interface OptimalRouteResult {
  success: boolean;
  route?: ISelectedRoute & {
    hops: string[];
    providerNames: string[];
    estimatedCost: number;
    estimatedLatencyMs: number;
    reliability: number;
    algorithm: string;
    explanation: string;
    alternatives?: RouteOption[];
  };
  error?: 'MISSING_PROVIDER' | 'UNREACHABLE_DESTINATION' | 'NO_VALID_ROUTE' | 'DATABASE_ERROR';
  details?: string;
}

/**
 * Calculates deterministic composite edge weight for multi-objective optimization.
 * Weight(e) = (1.0 * baseCost) + (0.5 * (latencyMs / 100)) + (5.0 * (1.0 - reliability) * 100)
 *
 * All coefficients are strictly positive, ensuring no negative cycles.
 */
export function calculateEdgeWeight(
  edge: { baseCost: number; latencyMs: number; reliability: number },
  weights = { costWeight: 1.0, latencyWeight: 0.5, reliabilityWeight: 5.0 }
): number {
  const costTerm = edge.baseCost * weights.costWeight;
  const latencyTerm = (edge.latencyMs / 100) * weights.latencyWeight;
  const reliabilityTerm = (1.0 - Math.min(1.0, Math.max(0.01, edge.reliability))) * 100 * weights.reliabilityWeight;

  return Number((costTerm + latencyTerm + reliabilityTerm).toFixed(4));
}

/**
 * Loads the active payment network graph directly from Neo4j.
 * Automatically excludes unavailable, suspended, or prohibited nodes and edges.
 */
export async function loadPaymentGraphFromNeo4j(database = 'neo4j'): Promise<GraphData> {
  const session = getNeo4jSession(database);
  try {
    // 1. Fetch active nodes
    const nodeQuery = `
      MATCH (p:PaymentProvider)
      WHERE coalesce(p.status, 'ACTIVE') = 'ACTIVE'
        AND coalesce(p.isAvailable, true) = true
      RETURN p.id AS id, p.name AS name, p.type AS type,
             p.country AS country, p.currency AS currency,
             coalesce(p.status, 'ACTIVE') AS status,
             coalesce(p.isAvailable, true) AS isAvailable
    `;
    const nodeResult = await session.run(nodeQuery);

    const nodes = new Map<string, RoutingNode>();
    for (const record of nodeResult.records) {
      const id = record.get('id');
      nodes.set(id, {
        id,
        name: record.get('name') || id,
        type: record.get('type') || 'BANK',
        country: record.get('country') || '',
        currency: record.get('currency') || '',
        status: record.get('status'),
        isAvailable: Boolean(record.get('isAvailable')),
      });
    }

    // 2. Fetch active, non-prohibited relationships
    const edgeQuery = `
      MATCH (a:PaymentProvider)-[r:CONNECTS_TO]->(b:PaymentProvider)
      WHERE coalesce(a.status, 'ACTIVE') = 'ACTIVE' AND coalesce(a.isAvailable, true) = true
        AND coalesce(b.status, 'ACTIVE') = 'ACTIVE' AND coalesce(b.isAvailable, true) = true
        AND coalesce(r.status, 'ACTIVE') = 'ACTIVE'
        AND coalesce(r.isAvailable, true) = true
        AND coalesce(r.prohibited, false) = false
      RETURN a.id AS source, b.id AS target,
             r.baseCost AS baseCost,
             r.latencyMs AS latencyMs,
             r.reliability AS reliability,
             coalesce(r.status, 'ACTIVE') AS status,
             coalesce(r.isAvailable, true) AS isAvailable,
             coalesce(r.prohibited, false) AS prohibited
    `;
    const edgeResult = await session.run(edgeQuery);

    const adjacency = new Map<string, RoutingEdge[]>();
    for (const node of nodes.keys()) {
      adjacency.set(node, []);
    }

    for (const record of edgeResult.records) {
      const source = record.get('source');
      const target = record.get('target');

      // Helper to cleanly extract raw numbers from Neo4j Integers or floats
      const rawCost = record.get('baseCost');
      const rawLatency = record.get('latencyMs');
      const rawReliability = record.get('reliability');

      const baseCost = typeof rawCost === 'object' && rawCost !== null && 'toNumber' in rawCost
        ? (rawCost as { toNumber(): number }).toNumber()
        : Number(rawCost ?? 1.0);

      const latencyMs = typeof rawLatency === 'object' && rawLatency !== null && 'toNumber' in rawLatency
        ? (rawLatency as { toNumber(): number }).toNumber()
        : Number(rawLatency ?? 50);

      const reliability = typeof rawReliability === 'object' && rawReliability !== null && 'toNumber' in rawReliability
        ? (rawReliability as { toNumber(): number }).toNumber()
        : Number(rawReliability ?? 0.99);

      if (!adjacency.has(source)) {
        adjacency.set(source, []);
      }

      adjacency.get(source)!.push({
        source,
        target,
        baseCost,
        latencyMs,
        reliability,
        status: record.get('status'),
        isAvailable: Boolean(record.get('isAvailable')),
        prohibited: Boolean(record.get('prohibited')),
      });
    }

    return { nodes, adjacency };
  } finally {
    await session.close();
  }
}

/**
 * Deterministic Dijkstra's Shortest Path Algorithm with Composite Multi-Objective Function.
 *
 * @param graph In-memory graph structure loaded from Neo4j
 * @param sourceId Starting provider node ID
 * @param targetId Destination provider node ID
 * @param excludeEdges Optional set of prohibited edges to skip
 * @param excludeNodes Optional set of nodes to skip
 */
export function dijkstraShortestPath(
  graph: GraphData,
  sourceId: string,
  targetId: string,
  excludeEdges: Set<string> = new Set(),
  excludeNodes: Set<string> = new Set()
): RouteOption | null {
  if (!graph.nodes.has(sourceId) || !graph.nodes.has(targetId)) {
    return null;
  }
  if (excludeNodes.has(sourceId) || excludeNodes.has(targetId)) {
    return null;
  }
  if (sourceId === targetId) {
    const node = graph.nodes.get(sourceId)!;
    return {
      hops: [sourceId],
      providerNames: [node.name],
      totalCost: 0,
      totalLatencyMs: 0,
      cumulativeReliability: 1.0,
      compositeWeight: 0,
    };
  }

  const distances = new Map<string, number>();
  const previous = new Map<string, { from: string; edge: RoutingEdge } | null>();
  const visited = new Set<string>();

  for (const nodeId of graph.nodes.keys()) {
    distances.set(nodeId, Infinity);
    previous.set(nodeId, null);
  }
  distances.set(sourceId, 0);

  while (visited.size < graph.nodes.size) {
    // Deterministic selection of unvisited node with lowest distance
    let closestNode: string | null = null;
    let shortestDist = Infinity;

    for (const [nodeId, dist] of distances.entries()) {
      if (!visited.has(nodeId) && !excludeNodes.has(nodeId)) {
        if (dist < shortestDist) {
          shortestDist = dist;
          closestNode = nodeId;
        } else if (dist === shortestDist && dist < Infinity && closestNode !== null) {
          // Deterministic tie-breaking by lexicographical node ID
          if (nodeId < closestNode) {
            closestNode = nodeId;
          }
        }
      }
    }

    if (closestNode === null || shortestDist === Infinity) {
      break; // All reachable nodes visited
    }

    if (closestNode === targetId) {
      break; // Reached target with shortest distance
    }

    visited.add(closestNode);

    const edges = graph.adjacency.get(closestNode) || [];
    for (const edge of edges) {
      if (visited.has(edge.target) || excludeNodes.has(edge.target)) {
        continue;
      }
      const edgeKey = `${edge.source}->${edge.target}`;
      if (excludeEdges.has(edgeKey) || edge.prohibited || !edge.isAvailable || edge.status !== 'ACTIVE') {
        continue;
      }

      const weight = calculateEdgeWeight(edge);
      const newDist = shortestDist + weight;
      const currentDist = distances.get(edge.target) ?? Infinity;

      if (newDist < currentDist) {
        distances.set(edge.target, newDist);
        previous.set(edge.target, { from: closestNode, edge });
      } else if (Math.abs(newDist - currentDist) < 1e-6) {
        // Deterministic tie-breaker: compare edge baseCost then target ID
        const currentPrev = previous.get(edge.target);
        if (currentPrev && edge.baseCost < currentPrev.edge.baseCost) {
          distances.set(edge.target, newDist);
          previous.set(edge.target, { from: closestNode, edge });
        }
      }
    }
  }

  // If target node is unreachable
  if (distances.get(targetId) === Infinity || !previous.get(targetId)) {
    return null;
  }

  // Reconstruct path
  const hops: string[] = [];
  const edgesAlongPath: RoutingEdge[] = [];
  let curr: string | null = targetId;

  while (curr !== null && curr !== sourceId) {
    hops.unshift(curr);
    const prevInfo = previous.get(curr);
    if (!prevInfo) break;
    edgesAlongPath.unshift(prevInfo.edge);
    curr = prevInfo.from;
  }
  hops.unshift(sourceId);

  // Compute aggregate metrics
  let totalCost = 0;
  let totalLatencyMs = 0;
  let cumulativeReliability = 1.0;
  let compositeWeight = 0;

  for (const edge of edgesAlongPath) {
    totalCost += edge.baseCost;
    totalLatencyMs += edge.latencyMs;
    cumulativeReliability *= edge.reliability;
    compositeWeight += calculateEdgeWeight(edge);
  }

  const providerNames = hops.map((h) => graph.nodes.get(h)?.name || h);

  return {
    hops,
    providerNames,
    totalCost: Number(totalCost.toFixed(2)),
    totalLatencyMs: Math.round(totalLatencyMs),
    cumulativeReliability: Number(cumulativeReliability.toFixed(4)),
    compositeWeight: Number(compositeWeight.toFixed(4)),
  };
}

/**
 * Implementation of Yen's K-Shortest Loopless Paths Algorithm (1971).
 * Finds up to K candidate shortest paths using Dijkstra as its sub-routine.
 *
 * @param graph In-memory graph structure loaded from Neo4j
 * @param sourceId Starting provider ID
 * @param targetId Destination provider ID
 * @param K Maximum number of alternative paths to return (e.g. 3)
 */
export function yensKShortestPaths(
  graph: GraphData,
  sourceId: string,
  targetId: string,
  K = 3
): RouteOption[] {
  const shortest = dijkstraShortestPath(graph, sourceId, targetId);
  if (!shortest) {
    return [];
  }

  // A stores the established k-shortest paths
  const A: RouteOption[] = [shortest];
  // B stores potential candidate paths
  const B: RouteOption[] = [];

  for (let k = 1; k < K; k++) {
    const prevPath = A[k - 1].hops;

    // The spur node ranges from the first node to the second to last node in the previous k-shortest path
    for (let i = 0; i < prevPath.length - 1; i++) {
      const spurNode = prevPath[i];
      const rootPath = prevPath.slice(0, i + 1);

      const excludeEdges = new Set<string>();
      const excludeNodes = new Set<string>();

      // Remove edges used in previous paths that share the same root path
      for (const p of A) {
        if (p.hops.length > i + 1) {
          const rootMatches = p.hops.slice(0, i + 1).every((val, idx) => val === rootPath[idx]);
          if (rootMatches) {
            excludeEdges.add(`${p.hops[i]}->${p.hops[i + 1]}`);
          }
        }
      }

      // Remove rootPath nodes (except spurNode) to ensure loopless paths
      for (let r = 0; r < rootPath.length - 1; r++) {
        excludeNodes.add(rootPath[r]);
      }

      // Find shortest spur path from spurNode to targetId
      const spurPathResult = dijkstraShortestPath(
        graph,
        spurNode,
        targetId,
        excludeEdges,
        excludeNodes
      );

      if (spurPathResult) {
        // Candidate path = rootPath (without spurNode) + spurPath
        const candidateHops = [...rootPath.slice(0, -1), ...spurPathResult.hops];
        const candidateKey = candidateHops.join('->');

        // Check if candidate already exists in A or B
        const existsInA = A.some((p) => p.hops.join('->') === candidateKey);
        const existsInB = B.some((p) => p.hops.join('->') === candidateKey);

        if (!existsInA && !existsInB) {
          // Recompute accurate full metrics for candidate path
          let cost = 0;
          let latency = 0;
          let rel = 1.0;
          let compWeight = 0;

          for (let eIdx = 0; eIdx < candidateHops.length - 1; eIdx++) {
            const u = candidateHops[eIdx];
            const v = candidateHops[eIdx + 1];
            const edge = graph.adjacency.get(u)?.find((e) => e.target === v);
            if (edge) {
              cost += edge.baseCost;
              latency += edge.latencyMs;
              rel *= edge.reliability;
              compWeight += calculateEdgeWeight(edge);
            }
          }

          B.push({
            hops: candidateHops,
            providerNames: candidateHops.map((h) => graph.nodes.get(h)?.name || h),
            totalCost: Number(cost.toFixed(2)),
            totalLatencyMs: Math.round(latency),
            cumulativeReliability: Number(rel.toFixed(4)),
            compositeWeight: Number(compWeight.toFixed(4)),
          });
        }
      }
    }

    if (B.length === 0) {
      break;
    }

    // Sort candidate paths in B by composite weight (lowest first)
    B.sort((a, b) => {
      if (Math.abs(a.compositeWeight - b.compositeWeight) > 1e-4) {
        return a.compositeWeight - b.compositeWeight;
      }
      return a.totalCost - b.totalCost;
    });

    // Add lowest cost candidate from B to A
    A.push(B.shift()!);
  }

  return A;
}

/**
 * Resolves entry and exit payment provider IDs given source and destination parameters.
 */
export function resolveProviderEndpoints(
  graph: GraphData,
  options: RouteRequestOptions
): { sourceId: string | null; targetId: string | null; error?: string } {
  let sourceId = options.sourceProviderId || null;
  let targetId = options.destinationProviderId || null;

  // Resolve source node if not specified explicitly
  if (!sourceId && options.sourceCountry) {
    const srcUpper = options.sourceCountry.trim().toUpperCase();
    for (const [id, node] of graph.nodes.entries()) {
      if (node.country.toUpperCase() === srcUpper && node.type === 'GATEWAY') {
        sourceId = id;
        break;
      }
    }
    // Fallback: any provider in source country
    if (!sourceId) {
      for (const [id, node] of graph.nodes.entries()) {
        if (node.country.toUpperCase() === srcUpper) {
          sourceId = id;
          break;
        }
      }
    }
  }

  // Resolve destination node if not specified explicitly
  if (!targetId && options.destinationCountry) {
    const dstUpper = options.destinationCountry.trim().toUpperCase();
    for (const [id, node] of graph.nodes.entries()) {
      if (node.country.toUpperCase() === dstUpper && node.type === 'DESTINATION_BANK') {
        targetId = id;
        break;
      }
    }
    // Fallback: any provider in destination country
    if (!targetId) {
      for (const [id, node] of graph.nodes.entries()) {
        if (node.country.toUpperCase() === dstUpper) {
          targetId = id;
          break;
        }
      }
    }
  }

  if (!sourceId) {
    return {
      sourceId: null,
      targetId: null,
      error: `Missing provider: No active payment provider or gateway found for origin '${options.sourceCountry || 'unknown'}'`,
    };
  }

  if (!targetId) {
    return {
      sourceId,
      targetId: null,
      error: `Missing provider: No active settlement bank or provider found for destination '${options.destinationCountry || 'unknown'}'`,
    };
  }

  return { sourceId, targetId };
}

/**
 * Main intelligent routing entry point.
 * Reads actual Neo4j topology, resolves endpoints, runs Dijkstra / Yen's algorithm,
 * and formats the final route result with an explanation.
 */
export async function findOptimalRoute(options: RouteRequestOptions): Promise<OptimalRouteResult> {
  let graph: GraphData;
  try {
    graph = await loadPaymentGraphFromNeo4j();
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: 'DATABASE_ERROR',
      details: `Failed to load payment graph from Neo4j: ${errorMsg}`,
    };
  }

  // 1. Resolve source and destination provider endpoints
  const { sourceId, targetId, error } = resolveProviderEndpoints(graph, options);
  if (error || !sourceId || !targetId) {
    return {
      success: false,
      error: 'MISSING_PROVIDER',
      details: error || 'Could not resolve source and destination payment providers.',
    };
  }

  // 2. Prepare edge/node exclusions
  const excludeEdges = new Set<string>();
  if (options.excludeEdges) {
    options.excludeEdges.forEach((e) => excludeEdges.add(`${e.source}->${e.target}`));
  }
  const excludeNodes = new Set<string>(options.excludeNodes || []);

  // 3. Find optimal shortest path and up to 3 alternative routes using Yen's K-Shortest Paths
  const maxK = Math.max(1, options.maxAlternatives || 3);
  const kRoutes = yensKShortestPaths(graph, sourceId, targetId, maxK);

  if (kRoutes.length === 0) {
    return {
      success: false,
      error: 'UNREACHABLE_DESTINATION',
      details: `No active routing path connects origin provider '${sourceId}' to destination provider '${targetId}' over active network edges.`,
    };
  }

  const primaryRoute = kRoutes[0];
  const sourceNode = graph.nodes.get(sourceId);
  const targetNode = graph.nodes.get(targetId);

  const routeId = `ROUTE-${sourceId}-TO-${targetId}-${primaryRoute.hops.length}HOPS`;
  const routeName = `${sourceNode?.name || sourceId} to ${targetNode?.name || targetId} Corridor`;

  const explanation = `Route selected using Multi-Objective Dijkstra Algorithm optimizing cost ($${primaryRoute.totalCost.toFixed(
    2
  )}), latency (${primaryRoute.totalLatencyMs}ms), and reliability (${(
    primaryRoute.cumulativeReliability * 100
  ).toFixed(1)}%). Path spans ${primaryRoute.hops.length} nodes: ${primaryRoute.providerNames.join(
    ' ➔ '
  )}.`;

  return {
    success: true,
    route: {
      routeId,
      routeName,
      hops: primaryRoute.hops,
      providerNames: primaryRoute.providerNames,
      estimatedCost: primaryRoute.totalCost,
      estimatedLatencyMs: primaryRoute.totalLatencyMs,
      reliability: primaryRoute.cumulativeReliability,
      algorithm: 'Multi-Objective Dijkstra & Yen K-Shortest Paths',
      explanation,
      alternatives: kRoutes.slice(1),
    },
  };
}

