'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card } from '@/src/components/ui/Card';
import { LoadingSpinner, EmptyState, ErrorState } from '@/src/components/ui/LoadingState';
import { NetworkData, ProviderNode, ProviderEdge } from '@/src/types/frontend';
import {
  Network,
  Building2,
  ArrowRight,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Layers,
  Settings2,
} from 'lucide-react';

export default function ProviderNetworkPage() {
  const [networkData, setNetworkData] = useState<NetworkData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<'nodes' | 'edges'>('nodes');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  const fetchNetwork = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/network');
      if (!res.ok) {
        throw new Error(`Failed to load Neo4j network topology (${res.status})`);
      }
      const data: NetworkData = await res.json();
      setNetworkData(data);
    } catch (err: any) {
      console.error('Error fetching provider network:', err);
      setError(err.message || 'Failed to load network topology');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNetwork();
  }, [fetchNetwork]);

  // Filtered nodes
  const filteredNodes = networkData?.nodes.filter((node) => {
    const matchesSearch =
      node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      node.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      node.country.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'ALL' || node.type === typeFilter;
    return matchesSearch && matchesType;
  });

  // Filtered edges
  const filteredEdges = networkData?.edges.filter((edge) => {
    return (
      edge.source.toLowerCase().includes(searchTerm.toLowerCase()) ||
      edge.target.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  // Node type counts
  const gatewayCount = networkData?.nodes.filter((n) => n.type === 'GATEWAY').length || 0;
  const clearingCount =
    networkData?.nodes.filter((n) => n.type === 'CLEARING' || n.type === 'CORRIDOR').length || 0;
  const bankCount =
    networkData?.nodes.filter((n) => n.type === 'BANK' || n.type === 'DESTINATION_BANK').length || 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <Network className="w-6 h-6 text-blue-600" />
            Payment Provider Network
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Global directory of correspondent banks, clearing systems, and settlement rails in Neo4j.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchNetwork()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Graph
          </button>
          <Link
            href="/admin"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs transition-colors"
          >
            <Settings2 className="w-3.5 h-3.5" />
            Admin Rail Toggles
          </Link>
        </div>
      </div>

      {/* Network High-level Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Total Providers
          </span>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {networkData?.count.nodes || 0}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Nodes indexed in Neo4j</p>
        </Card>

        <Card className="p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Origin Gateways
          </span>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
            {gatewayCount}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Sender entry points</p>
        </Card>

        <Card className="p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Clearing / Corridors
          </span>
          <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
            {clearingCount}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Intermediary switchboards</p>
        </Card>

        <Card className="p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Interbank Rails
          </span>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {networkData?.count.edges || 0}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            {networkData?.count.activeEdges || 0} active, {networkData?.count.prohibitedEdges || 0} blocked
          </p>
        </Card>
      </div>

      {/* Tabs and Search Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit">
          <button
            onClick={() => setActiveTab('nodes')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeTab === 'nodes'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Provider Nodes ({networkData?.nodes.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('edges')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeTab === 'edges'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Inter-Rail Connections ({networkData?.edges.length || 0})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={activeTab === 'nodes' ? 'Search providers...' : 'Search rails...'}
              className="pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {activeTab === 'nodes' && (
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="py-1.5 px-3 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Provider Types</option>
              <option value="GATEWAY">Gateways</option>
              <option value="BANK">Intermediary Banks</option>
              <option value="CLEARING">Clearing Rails</option>
              <option value="CORRIDOR">Corridors</option>
              <option value="DESTINATION_BANK">Destination Banks</option>
            </select>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <LoadingSpinner message="Querying live Neo4j database graph..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchNetwork} />
      ) : activeTab === 'nodes' ? (
        <Card className="overflow-hidden border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Provider ID</th>
                  <th className="px-4 py-3">Institution Name</th>
                  <th className="px-4 py-3">Classification</th>
                  <th className="px-4 py-3">Jurisdiction</th>
                  <th className="px-4 py-3">Base Currency</th>
                  <th className="px-4 py-3">Operational State</th>
                  <th className="px-4 py-3 text-right">Availability</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-sans">
                {filteredNodes && filteredNodes.length > 0 ? (
                  filteredNodes.map((node) => (
                    <tr
                      key={node.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                        {node.id}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">
                        {node.name}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {node.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                        <span className="font-semibold">{node.country}</span>
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-blue-600 dark:text-blue-400">
                        {node.currency}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          {node.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          ONLINE
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      No provider nodes match the selected search criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Source Node</th>
                  <th className="px-4 py-3">Target Node</th>
                  <th className="px-4 py-3">Base Cost</th>
                  <th className="px-4 py-3">Latency</th>
                  <th className="px-4 py-3">Historical Reliability</th>
                  <th className="px-4 py-3">Sanctions / Policy</th>
                  <th className="px-4 py-3 text-right">Operational State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                {filteredEdges && filteredEdges.length > 0 ? (
                  filteredEdges.map((edge, idx) => {
                    const isProhibited =
                      edge.prohibited || !edge.isAvailable || edge.status !== 'ACTIVE';
                    return (
                      <tr
                        key={`${edge.source}-${edge.target}-${idx}`}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                          isProhibited ? 'bg-rose-50/20 dark:bg-rose-950/10' : ''
                        }`}
                      >
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">
                          {edge.source}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">
                          {edge.target}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">
                          ${edge.baseCost.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                          {edge.latencyMs} ms
                        </td>
                        <td className="px-4 py-3 text-emerald-600 dark:text-emerald-400">
                          {(edge.reliability * 100).toFixed(1)}%
                        </td>
                        <td className="px-4 py-3 font-sans">
                          {isProhibited ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                              PROHIBITED
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
                              PERMITTED
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-sans">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              edge.isAvailable
                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {edge.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      No inter-provider rails match the search query.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

