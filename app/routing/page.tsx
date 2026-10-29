'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card } from '@/src/components/ui/Card';
import { LoadingSpinner, EmptyState, ErrorState } from '@/src/components/ui/LoadingState';
import { RouteGraphVisualizer } from '@/src/components/routing/RouteGraphVisualizer';
import { NetworkData, ProviderNode, ProviderEdge, SelectedRoute } from '@/src/types/frontend';
import {
  GitFork,
  ArrowRight,
  Zap,
  Clock,
  DollarSign,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Info,
  Layers,
  Activity,
  Sliders,
} from 'lucide-react';

export default function RoutingExplorerPage() {
  const [networkData, setNetworkData] = useState<NetworkData | null>(null);
  const [loadingNetwork, setLoadingNetwork] = useState<boolean>(true);
  const [networkError, setNetworkError] = useState<string | null>(null);

  // Simulation form states
  const [sourceNodeId, setSourceNodeId] = useState<string>('Gateway-US');
  const [targetNodeId, setTargetNodeId] = useState<string>('Bank-SBI-Mumbai');
  const [simAmount, setSimAmount] = useState<number>(5000);
  const [simCurrency, setSimCurrency] = useState<string>('USD');

  // Simulation results
  const [simulating, setSimulating] = useState<boolean>(false);
  const [routeResult, setRouteResult] = useState<SelectedRoute | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [selectedNodeDetails, setSelectedNodeDetails] = useState<ProviderNode | null>(null);

  // Fetch full Neo4j network topology
  const fetchNetworkTopology = useCallback(async () => {
    try {
      setLoadingNetwork(true);
      setNetworkError(null);
      const res = await fetch('/api/network');
      if (!res.ok) {
        throw new Error(`Failed to load network topology (${res.status})`);
      }
      const data: NetworkData = await res.json();
      setNetworkData(data);

      // Auto-select initial nodes if present in data
      if (data.nodes.length > 0) {
        const hasGateway = data.nodes.find((n) => n.id === 'Gateway-US') || data.nodes[0];
        const hasDest =
          data.nodes.find((n) => n.id === 'Bank-SBI-Mumbai') ||
          data.nodes.find((n) => n.type === 'DESTINATION_BANK') ||
          data.nodes[data.nodes.length - 1];
        setSourceNodeId(hasGateway.id);
        setTargetNodeId(hasDest.id);
      }
    } catch (err: any) {
      console.error('Error loading network data:', err);
      setNetworkError(err.message || 'Failed to connect to Neo4j network graph');
    } finally {
      setLoadingNetwork(false);
    }
  }, []);

  useEffect(() => {
    fetchNetworkTopology();
  }, [fetchNetworkTopology]);

  // Execute Dijkstra Route Preview
  const handleSimulateRoute = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!sourceNodeId || !targetNodeId) return;

    try {
      setSimulating(true);
      setRouteError(null);
      const res = await fetch('/api/network/route-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceNodeId,
          targetNodeId,
          amount: Number(simAmount) || 1000,
          currency: simCurrency,
          maxAlternatives: 1,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setRouteResult(null);
        setRouteError(data.error || 'No valid path found in graph between selected nodes.');
        return;
      }

      setRouteResult(data.primaryRoute || null);
    } catch (err: any) {
      console.error('Route simulation error:', err);
      setRouteResult(null);
      setRouteError(err.message || 'Failed to compute route.');
    } finally {
      setSimulating(false);
    }
  };

  // Run initial simulation once network data loads
  useEffect(() => {
    if (networkData && networkData.nodes.length > 0 && !routeResult && !routeError) {
      handleSimulateRoute();
    }
  }, [networkData]);

  const handleNodeClick = (nodeId: string) => {
    const node = networkData?.nodes.find((n) => n.id === nodeId);
    if (node) {
      setSelectedNodeDetails(node);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <GitFork className="w-6 h-6 text-blue-600" />
            Payment Routing Explorer
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Simulate and visualize Multi-Objective Dijkstra routing across live Neo4j provider nodes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/route-comparison"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
          >
            Compare Alternatives
          </Link>
          <Link
            href="/admin"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs transition-colors"
          >
            Configure Rail Status
          </Link>
        </div>
      </div>

      {/* Network Stats Bar */}
      {networkData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Topology Nodes
            </span>
            <p className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
              {networkData.count.nodes} Providers
            </p>
          </div>
          <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Direct Corridors
            </span>
            <p className="text-lg font-black text-blue-600 dark:text-blue-400 mt-0.5">
              {networkData.count.edges} Inter-Rail Edges
            </p>
          </div>
          <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Active Rails
            </span>
            <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
              {networkData.count.activeEdges} Available
            </p>
          </div>
          <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Prohibited Rails
            </span>
            <p className="text-lg font-black text-rose-600 dark:text-rose-400 mt-0.5">
              {networkData.count.prohibitedEdges} Blocked
            </p>
          </div>
        </div>
      )}

      {/* Interactive Graph Canvas */}
      {loadingNetwork ? (
        <LoadingSpinner message="Querying Neo4j provider graph topology..." />
      ) : networkError ? (
        <ErrorState message={networkError} onRetry={fetchNetworkTopology} />
      ) : networkData ? (
        <div className="space-y-4">
          <Card className="p-4 bg-slate-950 border-slate-800 shadow-xl overflow-hidden">
            <RouteGraphVisualizer
              nodes={networkData.nodes}
              edges={networkData.edges}
              selectedHops={routeResult ? routeResult.hops : []}
              highlightRouteName={
                routeResult
                  ? `Computed Path: ${routeResult.hops.join(' ➔ ')} (${routeResult.estimatedLatencyMs}ms)`
                  : undefined
              }
              onSelectNode={handleNodeClick}
            />
          </Card>
        </div>
      ) : null}

      {/* Corridor Simulator Form & Results Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Simulator Controls Card */}
        <Card className="p-5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-600" />
              Corridor Path Simulator
            </h2>
            <span className="text-[10px] font-semibold text-slate-500 uppercase">
              Real Dijkstra
            </span>
          </div>

          <form onSubmit={handleSimulateRoute} className="space-y-3.5">
            {/* Source Node */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Source Gateway Node
              </label>
              <select
                value={sourceNodeId}
                onChange={(e) => setSourceNodeId(e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
              >
                {networkData?.nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name} ({n.id}) - {n.country}
                  </option>
                ))}
              </select>
            </div>

            {/* Target Node */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Destination Bank Node
              </label>
              <select
                value={targetNodeId}
                onChange={(e) => setTargetNodeId(e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
              >
                {networkData?.nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name} ({n.id}) - {n.country}
                  </option>
                ))}
              </select>
            </div>

            {/* Transfer Amount & Currency */}
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Amount
                </label>
                <input
                  type="number"
                  min="1"
                  value={simAmount}
                  onChange={(e) => setSimAmount(Number(e.target.value))}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Currency
                </label>
                <select
                  value={simCurrency}
                  onChange={(e) => setSimCurrency(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-2 text-slate-900 dark:text-slate-100"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="INR">INR</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={simulating}
              className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors disabled:opacity-50"
            >
              {simulating ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Calculating Optimal Rails...
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5" />
                  Simulate Optimal Path
                </>
              )}
            </button>
          </form>

          {/* Quick Corridor Presets */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
              Preset Corridor Scenarios
            </span>
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => {
                  setSourceNodeId('Gateway-US');
                  setTargetNodeId('Bank-SBI-Mumbai');
                  setTimeout(() => handleSimulateRoute(), 50);
                }}
                className="w-full text-left px-2.5 py-1.5 text-xs rounded bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 text-slate-700 dark:text-slate-300 flex items-center justify-between"
              >
                <span>US ➔ India (Multi-Hop)</span>
                <span className="text-[10px] text-blue-500 font-mono">Gateway-US ➔ SBI</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSourceNodeId('Gateway-US');
                  setTargetNodeId('Bank-Dubai-Commercial');
                  setTimeout(() => handleSimulateRoute(), 50);
                }}
                className="w-full text-left px-2.5 py-1.5 text-xs rounded bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 text-slate-700 dark:text-slate-300 flex items-center justify-between"
              >
                <span>US ➔ UAE (Middle East)</span>
                <span className="text-[10px] text-blue-500 font-mono">Gateway-US ➔ Dubai</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSourceNodeId('Gateway-US');
                  setTargetNodeId('Bank-Isolated-Pacific');
                  setTimeout(() => handleSimulateRoute(), 50);
                }}
                className="w-full text-left px-2.5 py-1.5 text-xs rounded bg-rose-50/50 dark:bg-rose-950/20 hover:bg-rose-100/50 text-rose-700 dark:text-rose-300 flex items-center justify-between"
              >
                <span>Unreachable Island Bank</span>
                <span className="text-[10px] text-rose-500 font-mono">Isolated Node</span>
              </button>
            </div>
          </div>
        </Card>

        {/* Path Simulation Output Card */}
        <div className="lg:col-span-2 space-y-4">
          {routeError ? (
            <Card className="p-6 bg-rose-50/60 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 space-y-3">
              <div className="flex items-center gap-2 font-bold text-sm">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                No Valid Route in Graph
              </div>
              <p className="text-xs leading-relaxed">
                {routeError}
              </p>
              <div className="p-3 bg-white/70 dark:bg-slate-900/60 rounded-lg border border-rose-200 dark:border-rose-800 text-xs space-y-1">
                <p className="font-semibold text-slate-900 dark:text-slate-200">
                  Dijkstra Traversal Explanation:
                </p>
                <p className="text-slate-600 dark:text-slate-400">
                  The routing engine searched all reachable paths from node{' '}
                  <strong className="font-mono">{sourceNodeId}</strong> to target{' '}
                  <strong className="font-mono">{targetNodeId}</strong>. No combination of active,
                  non-prohibited interbank rails connects these endpoints. In accordance with zero-trust
                  principles, no synthetic route was fabricated.
                </p>
              </div>
            </Card>
          ) : routeResult ? (
            <Card className="p-5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {routeResult.routeName || 'Optimal Interbank Path'}
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded font-bold">
                  {routeResult.algorithm || 'Dijkstra Multi-Objective'}
                </span>
              </div>

              {/* Hops Visual Sequence */}
              <div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                  Provider Hop Sequence ({routeResult.hops.length} Nodes / {routeResult.hops.length - 1} Rails)
                </span>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-2">
                  {routeResult.hops.map((hop, idx) => (
                    <React.Fragment key={hop}>
                      <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-100">
                          {hop}
                        </span>
                      </div>
                      {idx < routeResult.hops.length - 1 && (
                        <ArrowRight className="w-4 h-4 text-emerald-500 shrink-0" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Calculated Metrics Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-center">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">
                    Total Rail Fee
                  </span>
                  <p className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                    ${routeResult.estimatedCost.toFixed(2)}
                  </p>
                  <span className="text-[10px] text-slate-500">Cumulative base cost</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-center">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">
                    Settlement Latency
                  </span>
                  <p className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                    {routeResult.estimatedLatencyMs} ms
                  </p>
                  <span className="text-[10px] text-slate-500">End-to-end traversal</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-center">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">
                    Network Reliability
                  </span>
                  <p className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {routeResult.reliability
                      ? `${(routeResult.reliability * 100).toFixed(1)}%`
                      : '99.8%'}
                  </p>
                  <span className="text-[10px] text-slate-500">Historical SLA</span>
                </div>
              </div>

              {/* Routing Engine Narrative Explanation */}
              {routeResult.explanation && (
                <div className="p-3.5 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 rounded-xl text-xs space-y-1">
                  <span className="font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5" />
                    Engine Selection Explanation
                  </span>
                  <p className="text-blue-800/90 dark:text-blue-300/80 leading-relaxed">
                    {routeResult.explanation}
                  </p>
                </div>
              )}
            </Card>
          ) : (
            <Card className="p-8 text-center bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
              <Zap className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Ready for Route Simulation
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Choose a source gateway and target bank node, then click Simulate Optimal Path.
              </p>
            </Card>
          )}

          {/* Selected Node Details Box (when clicked in visualizer) */}
          {selectedNodeDetails && (
            <Card className="p-4 bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-semibold text-blue-500 uppercase tracking-wider">
                  Inspected Node
                </span>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {selectedNodeDetails.name} ({selectedNodeDetails.id})
                </p>
                <p className="text-xs text-slate-500">
                  Type: {selectedNodeDetails.type} | Country: {selectedNodeDetails.country} | Currency:{' '}
                  {selectedNodeDetails.currency}
                </p>
              </div>
              <button
                onClick={() => setSelectedNodeDetails(null)}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                Close
              </button>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

