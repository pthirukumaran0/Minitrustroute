'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card } from '@/src/components/ui/Card';
import { LoadingSpinner, EmptyState, ErrorState } from '@/src/components/ui/LoadingState';
import { NetworkData, SelectedRoute } from '@/src/types/frontend';
import {
  GitCompare,
  ArrowRight,
  Zap,
  Clock,
  DollarSign,
  ShieldCheck,
  CheckCircle2,
  TrendingUp,
  Sliders,
  Layers,
  Copy,
  Check,
  Info,
} from 'lucide-react';

interface CandidateRoute {
  rank: number;
  isPrimary: boolean;
  routeName: string;
  hops: string[];
  totalCost: number;
  totalLatencyMs: number;
  cumulativeReliability: number;
  compositeWeight: number;
  explanation?: string;
}

export default function RouteComparisonPage() {
  const [networkData, setNetworkData] = useState<NetworkData | null>(null);
  const [loadingNodes, setLoadingNodes] = useState<boolean>(true);

  // Selector state
  const [sourceNodeId, setSourceNodeId] = useState<string>('Gateway-US');
  const [targetNodeId, setTargetNodeId] = useState<string>('Bank-SBI-Mumbai');
  const [simAmount, setSimAmount] = useState<number>(5000);
  const [simCurrency, setSimCurrency] = useState<string>('USD');

  // Comparison state
  const [loadingComparison, setLoadingComparison] = useState<boolean>(false);
  const [primaryRoute, setPrimaryRoute] = useState<SelectedRoute | null>(null);
  const [alternatives, setAlternatives] = useState<any[]>([]);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Fetch nodes list
  const fetchNodes = useCallback(async () => {
    try {
      setLoadingNodes(true);
      const res = await fetch('/api/network');
      if (res.ok) {
        const data: NetworkData = await res.json();
        setNetworkData(data);
      }
    } catch (err) {
      console.error('Error fetching nodes:', err);
    } finally {
      setLoadingNodes(false);
    }
  }, []);

  useEffect(() => {
    fetchNodes();
  }, [fetchNodes]);

  // Execute Yen's K-Shortest Path Route Preview
  const handleRunComparison = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!sourceNodeId || !targetNodeId) return;

    try {
      setLoadingComparison(true);
      setComparisonError(null);
      const res = await fetch('/api/network/route-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceNodeId,
          targetNodeId,
          amount: Number(simAmount) || 1000,
          currency: simCurrency,
          maxAlternatives: 3,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setPrimaryRoute(null);
        setAlternatives([]);
        setComparisonError(data.error || 'No reachable paths discovered between selected nodes.');
        return;
      }

      setPrimaryRoute(data.primaryRoute || null);
      setAlternatives(data.alternatives || []);
    } catch (err: any) {
      console.error('Error in route comparison:', err);
      setComparisonError(err.message || 'Failed to compare routes.');
    } finally {
      setLoadingComparison(false);
    }
  };

  useEffect(() => {
    if (networkData && networkData.nodes.length > 0 && !primaryRoute) {
      handleRunComparison();
    }
  }, [networkData]);

  // Combine primary + alternatives into ordered candidate list
  const allCandidates: CandidateRoute[] = primaryRoute
    ? [
        {
          rank: 1,
          isPrimary: true,
          routeName: primaryRoute.routeName,
          hops: primaryRoute.hops,
          totalCost: primaryRoute.estimatedCost,
          totalLatencyMs: primaryRoute.estimatedLatencyMs,
          cumulativeReliability: primaryRoute.reliability || 0.998,
          compositeWeight: (primaryRoute as any).compositeWeight || 0,
          explanation: primaryRoute.explanation,
        },
        ...alternatives.map((alt, idx) => ({
          rank: idx + 2,
          isPrimary: false,
          routeName: `Alternative Candidate #${idx + 1}`,
          hops: (alt.hops || []) as string[],
          totalCost: alt.totalCost,
          totalLatencyMs: alt.totalLatencyMs,
          cumulativeReliability: alt.cumulativeReliability || 0.995,
          compositeWeight: alt.compositeWeight || 0,
          explanation: undefined,
        })),
      ]
    : [];

  const handleCopySummary = () => {
    if (!primaryRoute) return;
    const summary = {
      corridor: `${sourceNodeId} -> ${targetNodeId}`,
      optimalRoute: primaryRoute,
      alternatives: alternatives,
      generatedAt: new Date().toISOString(),
    };
    navigator.clipboard.writeText(JSON.stringify(summary, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <GitCompare className="w-6 h-6 text-blue-600" />
            Route Comparison (Yen&apos;s K-Shortest Paths)
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Evaluate alternative interbank paths generated by Yen&apos;s loopless KSP algorithm.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {primaryRoute && (
            <button
              onClick={handleCopySummary}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  Copied JSON
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy Analysis
                </>
              )}
            </button>
          )}
          <Link
            href="/routing"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs transition-colors"
          >
            Visualizer Topology
          </Link>
        </div>
      </div>

      {/* Simulator Inputs */}
      <Card className="p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        <form
          onSubmit={handleRunComparison}
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end"
        >
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Source Gateway
            </label>
            <select
              value={sourceNodeId}
              onChange={(e) => setSourceNodeId(e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100"
            >
              {networkData?.nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name} ({n.id})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Target Destination Bank
            </label>
            <select
              value={targetNodeId}
              onChange={(e) => setTargetNodeId(e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100"
            >
              {networkData?.nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name} ({n.id})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Transfer Amount & Currency
            </label>
            <div className="flex gap-1.5">
              <input
                type="number"
                min="1"
                value={simAmount}
                onChange={(e) => setSimAmount(Number(e.target.value))}
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100"
              />
              <select
                value={simCurrency}
                onChange={(e) => setSimCurrency(e.target.value)}
                className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-2 text-slate-900 dark:text-slate-100"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="INR">INR</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={loadingComparison}
            className="w-full py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors h-[34px] disabled:opacity-50"
          >
            {loadingComparison ? (
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Zap className="w-3.5 h-3.5" />
            )}
            Run Yen&apos;s K-SP
          </button>
        </form>
      </Card>

      {/* Comparison Body */}
      {loadingComparison ? (
        <LoadingSpinner message="Executing Yen's K-Shortest Path deviation search on Neo4j graph..." />
      ) : comparisonError ? (
        <Card className="p-6 bg-rose-50/60 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300">
          <p className="font-bold text-sm">Deviation Search Completed With No Paths</p>
          <p className="text-xs mt-1">{comparisonError}</p>
        </Card>
      ) : allCandidates.length === 0 ? (
        <EmptyState
          title="No Routes Compared"
          description="Select source and destination nodes to compute Yen's K-shortest paths."
        />
      ) : (
        <div className="space-y-6">
          {/* Side-by-Side Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {allCandidates.map((candidate) => {
              const costDelta =
                candidate.rank > 1 && allCandidates[0]
                  ? candidate.totalCost - allCandidates[0].totalCost
                  : 0;
              const latencyDelta =
                candidate.rank > 1 && allCandidates[0]
                  ? candidate.totalLatencyMs - allCandidates[0].totalLatencyMs
                  : 0;

              return (
                <Card
                  key={candidate.rank}
                  className={`p-5 flex flex-col justify-between transition-all ${
                    candidate.isPrimary
                      ? 'bg-blue-50/20 dark:bg-blue-950/20 border-2 border-blue-500 shadow-md ring-1 ring-blue-500/20'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                          candidate.isPrimary
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        Rank #{candidate.rank} {candidate.isPrimary ? '• Optimal' : '• Deviation'}
                      </span>
                      {candidate.isPrimary && (
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                          SELECTED
                        </span>
                      )}
                    </div>

                    {/* Hops Flow */}
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                        Interbank Sequence ({candidate.hops.length} Hops)
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {candidate.hops.map((hop: string, hIdx: number) => (
                          <React.Fragment key={hop}>
                            <span className="px-2 py-0.5 text-[11px] font-mono font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200">
                              {hop}
                            </span>
                            {hIdx < candidate.hops.length - 1 && (
                              <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>

                    {/* Metrics Stack */}
                    <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Base Rail Fee:</span>
                        <div className="text-right">
                          <span className="font-mono font-bold text-slate-900 dark:text-white">
                            ${candidate.totalCost.toFixed(2)}
                          </span>
                          {costDelta !== 0 && (
                            <span className="text-[10px] font-mono text-amber-600 block">
                              +{costDelta.toFixed(2)} vs #1
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">End-to-End Latency:</span>
                        <div className="text-right">
                          <span className="font-mono font-bold text-slate-900 dark:text-white">
                            {candidate.totalLatencyMs} ms
                          </span>
                          {latencyDelta !== 0 && (
                            <span
                              className={`text-[10px] font-mono block ${
                                latencyDelta < 0 ? 'text-emerald-600' : 'text-amber-600'
                              }`}
                            >
                              {latencyDelta > 0 ? `+${latencyDelta}` : latencyDelta} ms vs #1
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">SLA Reliability:</span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {(candidate.cumulativeReliability * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Footer / Trade-off commentary */}
                  <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                    {candidate.isPrimary ? (
                      <p className="text-blue-700 dark:text-blue-300 font-medium">
                        ✓ Optimal Multi-Objective balance between settlement speed and low cost.
                      </p>
                    ) : (
                      <p>
                        Fallback candidate in event of corridor congestion or provider maintenance.
                      </p>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Tabular Metric Comparison */}
          <Card className="overflow-hidden border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Comprehensive Multi-Attribute Matrix
              </h3>
              <span className="text-[11px] text-slate-500">
                Algorithm: Yen&apos;s Loopless Deviation Traversal
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Path Rank</th>
                    <th className="px-4 py-3">Hops</th>
                    <th className="px-4 py-3">Total Cost</th>
                    <th className="px-4 py-3">Latency (ms)</th>
                    <th className="px-4 py-3">Reliability</th>
                    <th className="px-4 py-3">Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                  {allCandidates.map((c) => (
                    <tr
                      key={c.rank}
                      className={c.isPrimary ? 'bg-blue-50/30 dark:bg-blue-950/20 font-semibold' : ''}
                    >
                      <td className="px-4 py-3 font-sans font-bold">
                        {c.isPrimary ? 'Rank #1 (Primary)' : `Rank #${c.rank}`}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                        {c.hops.join(' ➔ ')}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                        ${c.totalCost.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                        {c.totalLatencyMs} ms
                      </td>
                      <td className="px-4 py-3 text-emerald-600 dark:text-emerald-400">
                        {(c.cumulativeReliability * 100).toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 font-sans">
                        {c.isPrimary ? (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-bold">
                            Default Route
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400">
                            Hot Standby
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

