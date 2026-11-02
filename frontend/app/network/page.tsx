'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Card } from '@/src/components/ui/Card';
import { LoadingSpinner, EmptyState, ErrorState } from '@/src/components/ui/LoadingState';
import { RouteGraphVisualizer } from '@/src/components/routing/RouteGraphVisualizer';
import { NetworkData, ProviderNode, ProviderEdge } from '@/src/types/frontend';
import { useAuth } from '@/src/context/AuthContext';
import {
  Network,
  RefreshCw,
  Search,
  Filter,
  Layers,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Zap,
  Globe2,
  DollarSign,
  Clock,
  Activity,
  X,
  Sliders,
  ExternalLink,
  Plus,
  Edit2,
  Power,
  PowerOff,
  CheckCircle2,
  AlertTriangle,
  Check,
  Save,
  Trash2,
} from 'lucide-react';

export default function GraphPage() {
  const { authFetch, role } = useAuth();
  const [networkData, setNetworkData] = useState<NetworkData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Inspector Selection State
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<ProviderEdge | null>(null);

  // Add Connection Modal State
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    sourceCountry: 'US',
    sourceGateway: '',
    sourceGatewayName: '',
    destinationCountry: 'GB',
    destinationGateway: '',
    destinationGatewayName: '',
    baseCost: '1.50',
    latencyMs: '45',
    reliability: '99.5',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  });

  // Edit Edge State
  const [isEditingEdge, setIsEditingEdge] = useState(false);
  const [editForm, setEditForm] = useState({
    baseCost: '',
    latencyMs: '',
    reliability: '',
  });
  const [isUpdatingEdge, setIsUpdatingEdge] = useState(false);

  const fetchGraphData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/network');
      if (!res.ok) {
        throw new Error(`Failed to load payment graph topology from Neo4j (HTTP ${res.status})`);
      }
      const data: NetworkData = await res.json();
      if (!data.success) {
        throw new Error((data as any).error || 'Failed to retrieve topology data from Neo4j');
      }
      setNetworkData(data);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not connect to Neo4j graph database. Please ensure the database is running and reachable.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGraphData();
  }, [fetchGraphData]);

  // Handle selecting a node (clears edge selection)
  const handleSelectNode = (nodeId: string) => {
    setSelectedNodeId(nodeId === selectedNodeId ? null : nodeId);
    setSelectedEdge(null);
    setIsEditingEdge(false);
  };

  // Handle selecting an edge (clears node selection)
  const handleSelectEdge = (edge: ProviderEdge) => {
    if (selectedEdge && selectedEdge.source === edge.source && selectedEdge.target === edge.target) {
      setSelectedEdge(null);
      setIsEditingEdge(false);
    } else {
      setSelectedEdge(edge);
      setSelectedNodeId(null);
      setIsEditingEdge(false);
      setEditForm({
        baseCost: edge.baseCost.toFixed(2),
        latencyMs: String(edge.latencyMs),
        reliability: (edge.reliability * 100).toFixed(1),
      });
    }
  };

  const selectedNode = networkData?.nodes.find((n) => n.id === selectedNodeId) || null;

  // Filter edges connected to selected node for the inspector
  const outgoingEdges = selectedNode
    ? networkData?.edges.filter((e) => e.source === selectedNode.id) || []
    : [];
  const incomingEdges = selectedNode
    ? networkData?.edges.filter((e) => e.target === selectedNode.id) || []
    : [];

  // Available unique countries from nodes
  const availableCountries = useMemo(() => {
    if (!networkData) return ['US', 'GB', 'EU', 'SG', 'AE', 'IN', 'JP', 'CH'];
    const countries = Array.from(new Set(networkData.nodes.map((n) => n.country).filter(Boolean)));
    return countries.length > 0 ? countries : ['US', 'GB', 'EU', 'SG', 'AE', 'IN', 'JP', 'CH'];
  }, [networkData]);

  // Handle Adding New Connection
  const handleCreateConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    const source = addForm.sourceGateway.trim();
    const target = addForm.destinationGateway.trim();

    if (!source || !target) {
      alert('Please specify both source and destination gateways.');
      return;
    }

    if (source.toUpperCase() === target.toUpperCase()) {
      alert('Self-connections are prohibited: Source and destination payment gateways must be distinct entities.');
      return;
    }

    const cost = parseFloat(addForm.baseCost);
    const latency = parseInt(addForm.latencyMs, 10);
    const relPercent = parseFloat(addForm.reliability);

    if (isNaN(cost) || cost < 0) {
      alert('Transit cost must be a non-negative number.');
      return;
    }
    if (isNaN(latency) || latency < 1) {
      alert('Latency must be at least 1ms.');
      return;
    }
    if (isNaN(relPercent) || relPercent < 0 || relPercent > 100) {
      alert('Reliability SLA must be between 0 and 100%.');
      return;
    }

    try {
      setIsSubmittingAdd(true);
      const res = await authFetch('/api/network/connections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': 'TRUSTROUTE-ADMIN-2026',
        },
        body: JSON.stringify({
          sourceCountry: addForm.sourceCountry.trim().toUpperCase(),
          sourceGateway: source,
          sourceGatewayName: addForm.sourceGatewayName.trim() || source,
          destinationCountry: addForm.destinationCountry.trim().toUpperCase(),
          destinationGateway: target,
          destinationGatewayName: addForm.destinationGatewayName.trim() || target,
          baseCost: cost,
          latencyMs: latency,
          reliability: Number((relPercent / 100).toFixed(4)),
          status: addForm.status,
          isAvailable: addForm.status === 'ACTIVE',
          prohibited: false,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || 'Failed to establish connection in Neo4j');
      }

      setFeedback({
        type: 'success',
        text: `Rail between '${source}' and '${target}' created in Neo4j. Immediately available for Dijkstra and Yen routing in the Simulator!`,
      });
      setAddModalOpen(false);
      setAddForm({
        sourceCountry: 'US',
        sourceGateway: '',
        sourceGatewayName: '',
        destinationCountry: 'GB',
        destinationGateway: '',
        destinationGatewayName: '',
        baseCost: '1.50',
        latencyMs: '45',
        reliability: '99.5',
        status: 'ACTIVE',
      });
      await fetchGraphData();
      setTimeout(() => setFeedback(null), 6000);
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  // Handle Toggling Edge Availability (Deactivate / Activate)
  const handleToggleEdgeAvailability = async () => {
    if (!selectedEdge) return;
    const newAvailable = !selectedEdge.isAvailable;
    const newStatus = newAvailable ? 'ACTIVE' : 'INACTIVE';
    const newProhibited = !newAvailable;

    try {
      setIsUpdatingEdge(true);
      const res = await authFetch('/api/network/connections', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': 'TRUSTROUTE-ADMIN-2026',
        },
        body: JSON.stringify({
          source: selectedEdge.source,
          target: selectedEdge.target,
          isAvailable: newAvailable,
          prohibited: newProhibited,
          status: newStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || 'Failed to update connection in Neo4j');
      }

      setFeedback({
        type: 'success',
        text: newAvailable
          ? `Rail ${selectedEdge.source} ➔ ${selectedEdge.target} activated. Simulator now routes through this edge.`
          : `Rail ${selectedEdge.source} ➔ ${selectedEdge.target} deactivated. Simulator immediately excludes this edge.`,
      });

      // Update in-place
      setSelectedEdge({
        ...selectedEdge,
        isAvailable: newAvailable,
        prohibited: newProhibited,
        status: newStatus,
      });

      await fetchGraphData();
      setTimeout(() => setFeedback(null), 5000);
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsUpdatingEdge(false);
    }
  };

  // Handle Saving Edited Edge Parameters
  const handleSaveEdgeParameters = async () => {
    if (!selectedEdge) return;
    const cost = parseFloat(editForm.baseCost);
    const latency = parseInt(editForm.latencyMs, 10);
    const relPercent = parseFloat(editForm.reliability);

    if (isNaN(cost) || cost < 0 || isNaN(latency) || latency < 1 || isNaN(relPercent)) {
      alert('Please enter valid numeric parameters.');
      return;
    }

    try {
      setIsUpdatingEdge(true);
      const res = await authFetch('/api/network/connections', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': 'TRUSTROUTE-ADMIN-2026',
        },
        body: JSON.stringify({
          source: selectedEdge.source,
          target: selectedEdge.target,
          baseCost: cost,
          latencyMs: latency,
          reliability: Number((relPercent / 100).toFixed(4)),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || 'Failed to save parameters in Neo4j');
      }

      setFeedback({
        type: 'success',
        text: `Updated rail parameters for ${selectedEdge.source} ➔ ${selectedEdge.target} in Neo4j.`,
      });

      setSelectedEdge({
        ...selectedEdge,
        baseCost: cost,
        latencyMs: latency,
        reliability: Number((relPercent / 100).toFixed(4)),
      });

      setIsEditingEdge(false);
      await fetchGraphData();
      setTimeout(() => setFeedback(null), 5000);
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsUpdatingEdge(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-700 rounded-md">
              Payment Infrastructure
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1 flex items-center gap-2.5">
            <Network className="w-6 h-6 text-indigo-600" />
            Graph Topology & Rail Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Complete dynamic Neo4j payment network topology with interactive node & edge inspection, dynamic rail provisioning, and instant route simulator sync.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Connection</span>
          </button>

          <button
            onClick={fetchGraphData}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reload Graph
          </button>

          <Link
            href="/route-comparison"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5" />
            Open Simulator
          </Link>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between gap-3 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="underline text-xs cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Network Stats Bar */}
      {networkData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Total Entities (Nodes)
            </span>
            <p className="text-xl font-black text-slate-900 mt-0.5">
              {networkData.nodes.length}
            </p>
            <span className="text-[10px] text-slate-500">Live payment institutions</span>
          </div>

          <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Direct Corridors (Edges)
            </span>
            <p className="text-xl font-black text-slate-900 mt-0.5">
              {networkData.edges.length}
            </p>
            <span className="text-[10px] text-slate-500">Directed interbank rails</span>
          </div>

          <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Active Rails
            </span>
            <p className="text-xl font-black text-emerald-600 mt-0.5">
              {networkData.edges.filter((e) => e.isAvailable && !e.prohibited).length}
            </p>
            <span className="text-[10px] text-emerald-600/80">Available for routing</span>
          </div>

          <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Prohibited / Suspended
            </span>
            <p className="text-xl font-black text-rose-600 mt-0.5">
              {networkData.edges.filter((e) => e.prohibited || !e.isAvailable).length}
            </p>
            <span className="text-[10px] text-rose-600/80">Excluded by compliance policy</span>
          </div>
        </div>
      )}

      {/* Main Graph Card & Inspector Area */}
      {loading ? (
        <LoadingSpinner message="Querying active topology nodes and edges from Neo4j..." />
      ) : error ? (
        <ErrorState
          title="Graph Database Connection Error"
          message={error}
          onRetry={fetchGraphData}
        />
      ) : !networkData || networkData.nodes.length === 0 ? (
        <EmptyState
          title="Empty Payment Network"
          description="No payment provider nodes or interbank edges found in the Neo4j database."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
          {/* Main Visualizer Canvas (3 cols) */}
          <div className="lg:col-span-3 space-y-3">
            <Card className="p-0 overflow-hidden border-slate-200 bg-slate-900">
              <RouteGraphVisualizer
                nodes={networkData.nodes}
                edges={networkData.edges}
                selectedNodeId={selectedNodeId}
                selectedEdge={selectedEdge}
                onSelectNode={handleSelectNode}
                onSelectEdge={handleSelectEdge}
                highlightRouteName="Neo4j Production Interbank Payment Graph"
                className="min-h-[500px]"
              />
            </Card>

            {/* Interactive Instructions & Hints */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
              <span className="flex items-center gap-1.5 font-medium">
                <Activity className="w-4 h-4 text-indigo-600" />
                Click any <strong>node</strong> or <strong>directional rail</strong> on the canvas to inspect or modify properties in Neo4j.
              </span>
              <span className="text-[11px] text-slate-400">
                Pan with drag • Zoom with scroll / controls
              </span>
            </div>
          </div>

          {/* Inspector / Details Panel (1 col) */}
          <div className="lg:col-span-1 space-y-3">
            {selectedNode ? (
              <Card className="p-4 bg-white border-slate-200 space-y-3 shadow-2xs">
                <div className="flex items-start justify-between pb-2 border-b border-slate-100">
                  <div>
                    <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 rounded">
                      {selectedNode.type}
                    </span>
                    <h3 className="font-bold text-slate-900 text-sm mt-1">
                      {selectedNode.name}
                    </h3>
                    <p className="font-mono text-[11px] text-slate-400">{selectedNode.id}</p>
                  </div>
                  <button
                    onClick={() => setSelectedNodeId(null)}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500">Jurisdiction:</span>
                    <strong className="text-slate-800">{selectedNode.country || 'Global'}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500">Primary Currency:</span>
                    <strong className="text-slate-800 font-mono">{selectedNode.currency || 'USD'}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500">Operating Status:</span>
                    <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {selectedNode.status || 'ACTIVE'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500">Outgoing Rails:</span>
                    <strong className="text-slate-800">{outgoingEdges.length} connections</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500">Incoming Rails:</span>
                    <strong className="text-slate-800">{incomingEdges.length} connections</strong>
                  </div>
                </div>

                {/* Direct Connections List */}
                {outgoingEdges.length > 0 && (
                  <div className="pt-2 space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Direct Downstream Partners:
                    </span>
                    <div className="space-y-1 max-h-36 overflow-y-auto">
                      {outgoingEdges.map((e) => (
                        <div
                          key={e.target}
                          onClick={() => handleSelectEdge(e)}
                          className="p-1.5 rounded-lg bg-slate-50 hover:bg-indigo-50 border border-slate-100 flex items-center justify-between text-[11px] cursor-pointer transition-colors"
                        >
                          <span className="font-mono text-slate-700">➔ {e.target}</span>
                          <span className="font-bold text-slate-900">${e.baseCost.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <Link
                    href={`/route-comparison?source=${selectedNode.id}`}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-2xs"
                  >
                    <span>Simulate Route From Node</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </Card>
            ) : selectedEdge ? (
              <Card className="p-4 bg-white border-slate-200 space-y-3 shadow-2xs">
                <div className="flex items-start justify-between pb-2 border-b border-slate-100">
                  <div>
                    <span
                      className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded border ${
                        selectedEdge.prohibited || !selectedEdge.isAvailable
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      {selectedEdge.prohibited || !selectedEdge.isAvailable
                        ? 'SUSPENDED / INACTIVE RAIL'
                        : 'ACTIVE CORRIDOR'}
                    </span>
                    <h3 className="font-bold text-slate-900 text-sm mt-1 flex items-center gap-1.5">
                      <span className="font-mono">{selectedEdge.source}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-mono">{selectedEdge.target}</span>
                    </h3>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedEdge(null);
                      setIsEditingEdge(false);
                    }}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {!isEditingEdge ? (
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500">Base Transit Fee:</span>
                      <strong className="text-slate-900 font-bold">${selectedEdge.baseCost.toFixed(2)}</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500">Corridor Latency:</span>
                      <strong className="text-slate-900 font-mono">{selectedEdge.latencyMs} ms</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500">Reliability SLA:</span>
                      <strong className="text-emerald-700 font-bold">{(selectedEdge.reliability * 100).toFixed(1)}%</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500">Status:</span>
                      <span
                        className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${
                          selectedEdge.isAvailable && !selectedEdge.prohibited
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {selectedEdge.isAvailable && !selectedEdge.prohibited ? 'ACTIVE' : 'DEACTIVATED'}
                      </span>
                    </div>

                    {/* Edge Control Actions */}
                    <div className="pt-3 space-y-2">
                      <button
                        type="button"
                        onClick={() => setIsEditingEdge(true)}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit Parameters</span>
                      </button>

                      <button
                        type="button"
                        disabled={isUpdatingEdge}
                        onClick={handleToggleEdgeAvailability}
                        className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50 ${
                          selectedEdge.isAvailable && !selectedEdge.prohibited
                            ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
                        }`}
                      >
                        {selectedEdge.isAvailable && !selectedEdge.prohibited ? (
                          <>
                            <PowerOff className="w-3.5 h-3.5" />
                            <span>Deactivate Rail</span>
                          </>
                        ) : (
                          <>
                            <Power className="w-3.5 h-3.5" />
                            <span>Reactivate Rail</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Edit Form */
                  <div className="space-y-3 text-xs pt-1">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">Transit Cost ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editForm.baseCost}
                        onChange={(e) => setEditForm({ ...editForm, baseCost: e.target.value })}
                        className="w-full p-2 text-xs border border-slate-200 rounded-lg font-mono focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">Latency (ms)</label>
                      <input
                        type="number"
                        min="1"
                        value={editForm.latencyMs}
                        onChange={(e) => setEditForm({ ...editForm, latencyMs: e.target.value })}
                        className="w-full p-2 text-xs border border-slate-200 rounded-lg font-mono focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">Reliability SLA (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={editForm.reliability}
                        onChange={(e) => setEditForm({ ...editForm, reliability: e.target.value })}
                        className="w-full p-2 text-xs border border-slate-200 rounded-lg font-mono focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsEditingEdge(false)}
                        className="flex-1 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={isUpdatingEdge}
                        onClick={handleSaveEdgeParameters}
                        className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg cursor-pointer disabled:opacity-50"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Save</span>
                      </button>
                    </div>
                  </div>
                )}
              </Card>
            ) : (
              <Card className="p-4 bg-white border-slate-200 space-y-3 text-xs">
                <h4 className="font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  Topology Legend
                </h4>
                <div className="space-y-2 text-[11px] text-slate-600 leading-relaxed">
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-full bg-blue-600 inline-block shrink-0" />
                    <span><strong>Gateway:</strong> Regional origin access points (e.g., Gateway-US, Gateway-EU).</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-full bg-indigo-700 inline-block shrink-0" />
                    <span><strong>Clearing Bank:</strong> Global correspondent settlement banks.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-full bg-slate-700 inline-block shrink-0" />
                    <span><strong>Corridor:</strong> Bilateral rails (e.g. Swift-Direct, SEPA, MiddleEast).</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-full bg-indigo-900 inline-block shrink-0" />
                    <span><strong>Destination Bank:</strong> End beneficiary settlement banks.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-0.5 bg-blue-500 inline-block shrink-0" />
                    <span><strong>Active Rail:</strong> Directed graph path with live SLA.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-0.5 bg-rose-500 border-t border-dashed inline-block shrink-0" />
                    <span><strong>Prohibited Rail:</strong> Sanctioned or inactive connection.</span>
                  </div>
                </div>

                <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-indigo-900 text-[11px] space-y-1">
                  <p className="font-bold text-indigo-950">Graph-to-Simulator Sync</p>
                  <p>All active rails created or modified here are dynamically queried by the route comparison simulator in real time.</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Add Network Connection Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Add Network Connection</h3>
                  <p className="text-[10px] text-slate-500">Provision interbank rail into Neo4j graph</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateConnection} className="space-y-4 text-xs">
              {/* Source Details */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Source Gateway & Jurisdiction
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Source Country <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. US, GB, SG"
                      value={addForm.sourceCountry}
                      onChange={(e) => setAddForm({ ...addForm, sourceCountry: e.target.value.toUpperCase() })}
                      className="w-full p-2 text-xs border border-slate-200 rounded-lg uppercase font-bold focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Source Gateway ID <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      list="existingNodesList"
                      placeholder="e.g. Gateway-US"
                      value={addForm.sourceGateway}
                      onChange={(e) => setAddForm({ ...addForm, sourceGateway: e.target.value })}
                      className="w-full p-2 text-xs border border-slate-200 rounded-lg font-mono focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">
                    Gateway Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. North America Primary Settlement Hub"
                    value={addForm.sourceGatewayName}
                    onChange={(e) => setAddForm({ ...addForm, sourceGatewayName: e.target.value })}
                    className="w-full p-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                </div>
              </div>

              {/* Destination Details */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Destination Gateway & Jurisdiction
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Destination Country <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. GB, EU, IN"
                      value={addForm.destinationCountry}
                      onChange={(e) => setAddForm({ ...addForm, destinationCountry: e.target.value.toUpperCase() })}
                      className="w-full p-2 text-xs border border-slate-200 rounded-lg uppercase font-bold focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Destination Gateway ID <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      list="existingNodesList"
                      placeholder="e.g. Bank-GB-01"
                      value={addForm.destinationGateway}
                      onChange={(e) => setAddForm({ ...addForm, destinationGateway: e.target.value })}
                      className="w-full p-2 text-xs border border-slate-200 rounded-lg font-mono focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">
                    Destination Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Barclays Interbank Correspondent"
                    value={addForm.destinationGatewayName}
                    onChange={(e) => setAddForm({ ...addForm, destinationGatewayName: e.target.value })}
                    className="w-full p-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                </div>
              </div>

              {/* SLA & Parameters */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Base Cost ($) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={addForm.baseCost}
                    onChange={(e) => setAddForm({ ...addForm, baseCost: e.target.value })}
                    className="w-full p-2 text-xs border border-slate-200 rounded-lg font-mono focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Latency (ms) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={addForm.latencyMs}
                    onChange={(e) => setAddForm({ ...addForm, latencyMs: e.target.value })}
                    className="w-full p-2 text-xs border border-slate-200 rounded-lg font-mono focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Reliability (%) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    required
                    value={addForm.reliability}
                    onChange={(e) => setAddForm({ ...addForm, reliability: e.target.value })}
                    className="w-full p-2 text-xs border border-slate-200 rounded-lg font-mono focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Operating Status</label>
                <select
                  value={addForm.status}
                  onChange={(e) => setAddForm({ ...addForm, status: e.target.value as 'ACTIVE' | 'INACTIVE' })}
                  className="w-full p-2 text-xs border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="ACTIVE">ACTIVE (Available for immediate Simulator routing)</option>
                  <option value="INACTIVE">INACTIVE (Excluded from live route calculation)</option>
                </select>
              </div>

              {/* Autocomplete Datalist */}
              <datalist id="existingNodesList">
                {networkData?.nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name} ({n.country})
                  </option>
                ))}
              </datalist>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdd}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingAdd ? 'Provisioning...' : 'Establish Rail in Neo4j'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
