'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card } from '@/src/components/ui/Card';
import { LoadingSpinner, EmptyState, ErrorState } from '@/src/components/ui/LoadingState';
import { NetworkData, ProviderEdge } from '@/src/types/frontend';
import {
  Settings2,
  Shield,
  Key,
  Lock,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  ExternalLink,
  Ban,
  Check,
  Power,
} from 'lucide-react';

export default function NetworkAdminPage() {
  const [networkData, setNetworkData] = useState<NetworkData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Admin key state
  const [adminKey, setAdminKey] = useState<string>('TRUSTROUTE-ADMIN-2026');
  const [updatingEdge, setUpdatingEdge] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const fetchNetwork = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/network');
      if (!res.ok) {
        throw new Error(`Failed to load network topology (${res.status})`);
      }
      const data: NetworkData = await res.json();
      setNetworkData(data);
    } catch (err: any) {
      console.error('Error fetching admin network:', err);
      setError(err.message || 'Failed to load network data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNetwork();
  }, [fetchNetwork]);

  // Toggle Edge Prohibited or Availability
  const handleToggleConnection = async (
    edge: ProviderEdge,
    changes: { prohibited?: boolean; isAvailable?: boolean; status?: string }
  ) => {
    if (!adminKey.trim()) {
      setActionMessage({
        type: 'error',
        text: 'Admin Secret Key is required to authorize topology modifications.',
      });
      return;
    }

    const edgeId = `${edge.source}->${edge.target}`;
    try {
      setUpdatingEdge(edgeId);
      setActionMessage(null);

      const res = await fetch('/api/network/connections', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey,
        },
        body: JSON.stringify({
          source: edge.source,
          target: edge.target,
          ...changes,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update connection state');
      }

      setActionMessage({
        type: 'success',
        text: `Rail ${edge.source} ➔ ${edge.target} successfully updated in Neo4j. Route recalculations will now reflect this change.`,
      });

      // Refresh network state
      await fetchNetwork();
    } catch (err: any) {
      console.error('Error modifying connection:', err);
      setActionMessage({
        type: 'error',
        text: err.message || 'Network modification failed. Check your admin key.',
      });
    } finally {
      setUpdatingEdge(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <Settings2 className="w-6 h-6 text-blue-600" />
            Network & Rail Administration
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Enforce corridor sanctions, quarantine congested links, and manage Neo4j edge availability.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/routing"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Test in Routing Explorer
          </Link>
        </div>
      </div>

      {/* Security Credential & RBAC Notice */}
      <Card className="p-4 bg-slate-50 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Administrative Authorization Key
            </span>
          </div>
          <button
            onClick={() => setAdminKey('TRUSTROUTE-ADMIN-2026')}
            className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 underline text-left"
          >
            Insert Default Evaluator Key (TRUSTROUTE-ADMIN-2026)
          </button>
        </div>

        <div className="flex gap-2">
          <input
            type="password"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            placeholder="Enter x-admin-key secret..."
            className="w-full max-w-md px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          <strong>Enterprise Notice:</strong> In this evaluation build, operations are authenticated via the{' '}
          <code className="text-blue-600 dark:text-blue-400 font-mono">x-admin-key</code> header. Production deployment replaces this with Auth0 / Okta RBAC and hardware-token signed audits.
        </p>
      </Card>

      {/* Mutation Feedback Message */}
      {actionMessage && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center justify-between gap-3 ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2 font-medium">
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-xs font-bold underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Live Edge Operations Table */}
      {loading ? (
        <LoadingSpinner message="Loading network connection topology from Neo4j..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchNetwork} />
      ) : (
        <Card className="overflow-hidden border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Neo4j Edge Policies & Circuit Breakers ({networkData?.edges.length || 0} Rails)
            </h2>
            <span className="text-[11px] text-slate-500">
              Live updates mutate Neo4j CONNECTS_TO relationship properties
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Corridor Rail</th>
                  <th className="px-4 py-3">Base Cost</th>
                  <th className="px-4 py-3">Latency</th>
                  <th className="px-4 py-3">Reliability</th>
                  <th className="px-4 py-3">Sanctions / Prohibitions</th>
                  <th className="px-4 py-3">Availability</th>
                  <th className="px-4 py-3 text-right">Administrative Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                {networkData?.edges.map((edge) => {
                  const edgeKey = `${edge.source}->${edge.target}`;
                  const isUpdating = updatingEdge === edgeKey;
                  const isProhibited = edge.prohibited;

                  return (
                    <tr
                      key={edgeKey}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                        isProhibited ? 'bg-rose-50/15 dark:bg-rose-950/10' : ''
                      }`}
                    >
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">
                        {edge.source} ➔ {edge.target}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-sans">
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
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                            PROHIBITED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            PERMITTED
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-sans">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            edge.isAvailable
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          }`}
                        >
                          {edge.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-sans">
                        <div className="flex items-center justify-end gap-2">
                          {/* Toggle Prohibited */}
                          <button
                            onClick={() =>
                              handleToggleConnection(edge, {
                                prohibited: !edge.prohibited,
                              })
                            }
                            disabled={isUpdating}
                            className={`px-2.5 py-1 rounded text-xs font-semibold border transition-colors ${
                              edge.prohibited
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                            }`}
                          >
                            {isUpdating ? '...' : edge.prohibited ? 'Unblock Rail' : 'Prohibit Rail'}
                          </button>

                          {/* Toggle Availability / Maintenance */}
                          <button
                            onClick={() =>
                              handleToggleConnection(edge, {
                                isAvailable: !edge.isAvailable,
                                status: edge.isAvailable ? 'MAINTENANCE' : 'ACTIVE',
                              })
                            }
                            disabled={isUpdating}
                            className="px-2.5 py-1 rounded text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-slate-700 transition-colors"
                          >
                            {edge.isAvailable ? 'Set Maintenance' : 'Set Active'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

