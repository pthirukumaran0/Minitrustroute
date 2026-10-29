'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, StatCard } from '@/src/components/ui/Card';
import { StatusBadge } from '@/src/components/ui/StatusBadge';
import { LoadingState } from '@/src/components/ui/LoadingState';
import { ErrorState } from '@/src/components/ui/ErrorState';
import { TransactionDetailDrawer } from '@/src/components/transactions/TransactionDetailDrawer';
import { TransactionRecord, SystemHealthData } from '@/src/types/frontend';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Send,
  Database,
  ArrowRight,
  TrendingUp,
  RefreshCw,
  ExternalLink,
  GitFork,
  Radio,
} from 'lucide-react';

interface AnalyticsData {
  summary: {
    total: number;
    approved: number;
    stepUp: number;
    blocked: number;
    approvalRate: number;
    blockedRate: number;
    stepUpRate: number;
    volumeByCurrency: Array<{
      currency: string;
      totalVolume: number;
      transactionCount: number;
      avgAmount: number;
    }>;
  };
  riskDistribution: {
    low: number;
    medium: number;
    high: number;
  };
  corridors: Array<{
    corridor: string;
    source: string;
    destination: string;
    count: number;
  }>;
  recentFlagged: TransactionRecord[];
  recentTransactions: TransactionRecord[];
}

export default function OverviewDashboardPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [health, setHealth] = useState<SystemHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTxn, setSelectedTxn] = useState<TransactionRecord | null>(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [analyticsRes, healthRes] = await Promise.all([
        fetch('/api/analytics'),
        fetch('/api/health'),
      ]);

      if (!analyticsRes.ok) {
        throw new Error(`Analytics API error (HTTP ${analyticsRes.status})`);
      }

      const analyticsJson = await analyticsRes.json();
      if (!analyticsJson.success) {
        throw new Error(analyticsJson.error || 'Failed to load analytics summary');
      }

      setData(analyticsJson);

      if (healthRes.ok) {
        const healthJson = await healthRes.json();
        setHealth(healthJson);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading && !data) {
    return <LoadingState message="Loading live TrustRoute analytics..." rows={5} />;
  }

  if (error && !data) {
    return <ErrorState title="Failed to Load Dashboard" message={error} onRetry={fetchDashboardData} />;
  }

  const summary = data?.summary;
  const isMongoHealthy = health?.databases.mongodb.status === 'healthy';
  const isNeo4jHealthy = health?.databases.neo4j.status === 'healthy';

  return (
    <div className="space-y-6">
      {/* 1. Page Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Executive Operations Dashboard
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time cross-border payment telemetry, deterministic fraud verdicts, and graph network state.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchDashboardData}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-2xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <Link
            href="/payment"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            New Payment
          </Link>
        </div>
      </div>

      {/* 2. Top Metric Cards (Linked to Filtered Views) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/transactions" className="block">
          <StatCard
            title="Total Processed"
            value={summary?.total || 0}
            subtitle="Ledger transactions recorded"
            color="slate"
            icon={<TrendingUp className="w-5 h-5 text-slate-600 dark:text-slate-400" />}
          />
        </Link>

        <Link href="/transactions?decision=APPROVED" className="block">
          <StatCard
            title="Approved Transactions"
            value={summary?.approved || 0}
            subtitle={`${summary?.approvalRate || 0}% auto-cleared rate`}
            color="emerald"
            icon={<ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
          />
        </Link>

        <Link href="/step-up" className="block">
          <StatCard
            title="Step-Up Auth Queue"
            value={summary?.stepUp || 0}
            subtitle="Requires secondary out-of-band verification"
            color="amber"
            icon={<AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
          />
        </Link>

        <Link href="/risk" className="block">
          <StatCard
            title="Blocked Threats"
            value={summary?.blocked || 0}
            subtitle={`${summary?.blockedRate || 0}% fraud prevention rate`}
            color="rose"
            icon={<ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400" />}
          />
        </Link>
      </div>

      {/* 3. Transaction Volume by Currency (Distinctly separated as required) */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Financial Volume Breakdown (By Currency)
            </h2>
            <p className="text-xs text-slate-500">
              Currencies are aggregated independently to ensure numerical fidelity without foreign exchange distortion.
            </p>
          </div>
          <span className="text-[11px] font-mono font-medium text-slate-400">
            {summary?.volumeByCurrency.length || 0} Currencies Active
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {summary?.volumeByCurrency && summary.volumeByCurrency.length > 0 ? (
            summary.volumeByCurrency.map((vol) => (
              <div
                key={vol.currency}
                className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-xs font-bold font-mono bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                    {vol.currency}
                  </span>
                  <span className="text-xs text-slate-500">{vol.transactionCount} payments</span>
                </div>
                <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  {vol.totalVolume.toLocaleString(undefined, { minimumFractionDigits: 2 })}{' '}
                  <span className="text-xs font-semibold text-slate-400">{vol.currency}</span>
                </p>
                <p className="text-[11px] text-slate-500">
                  Average size: {vol.avgAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {vol.currency}
                </p>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-400 py-3 col-span-3">No financial volume recorded yet.</p>
          )}
        </div>
      </Card>

      {/* 4. Dual Section: Risk Score Distribution & Live Health Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Risk Distribution Card */}
        <Card className="p-5 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-blue-600" />
              Risk Score Distribution
            </h2>
            <Link href="/risk" className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1">
              Deep Analysis <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900">
              <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-400 uppercase">
                Low Risk (0 - 34)
              </span>
              <p className="text-xl font-bold text-emerald-900 dark:text-emerald-200 mt-1">
                {data?.riskDistribution.low || 0}
              </p>
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400">Auto-Approved</span>
            </div>

            <div className="p-3 rounded-lg bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900">
              <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-400 uppercase">
                Medium Risk (35 - 69)
              </span>
              <p className="text-xl font-bold text-amber-900 dark:text-amber-200 mt-1">
                {data?.riskDistribution.medium || 0}
              </p>
              <span className="text-[10px] text-amber-700 dark:text-amber-400">Step-Up Auth</span>
            </div>

            <div className="p-3 rounded-lg bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900">
              <span className="text-[11px] font-semibold text-rose-800 dark:text-rose-400 uppercase">
                High Risk (70 - 100)
              </span>
              <p className="text-xl font-bold text-rose-900 dark:text-rose-200 mt-1">
                {data?.riskDistribution.high || 0}
              </p>
              <span className="text-[10px] text-rose-700 dark:text-rose-400">Immediate Block</span>
            </div>
          </div>

          {/* Top Corridors list */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Active Cross-Border Corridors
            </h4>
            <div className="flex flex-wrap gap-2">
              {data?.corridors && data.corridors.length > 0 ? (
                data.corridors.map((c) => (
                  <span
                    key={c.corridor}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    <span>{c.corridor}</span>
                    <strong className="text-blue-600 dark:text-blue-400">({c.count})</strong>
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-400">No corridors registered yet.</span>
              )}
            </div>
          </div>
        </Card>

        {/* Live Database Connectivity Health Card */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-600" />
              Engine Connectivity
            </h2>
            <Link href="/health" className="text-xs font-semibold text-blue-600 hover:underline">
              Diagnostics
            </Link>
          </div>

          <div className="space-y-3">
            {/* MongoDB */}
            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">MongoDB Ledger</p>
                <p className="text-[11px] text-slate-500">
                  Latency: {health?.databases.mongodb.latencyMs ? `${health.databases.mongodb.latencyMs} ms` : 'Active'}
                </p>
              </div>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                  isMongoHealthy
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}
              >
                {isMongoHealthy ? 'CONNECTED' : 'OFFLINE'}
              </span>
            </div>

            {/* Neo4j */}
            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Neo4j Property Graph</p>
                <p className="text-[11px] text-slate-500">
                  Latency: {health?.databases.neo4j.latencyMs ? `${health.databases.neo4j.latencyMs} ms` : 'Active'}
                </p>
              </div>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                  isNeo4jHealthy
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}
              >
                {isNeo4jHealthy ? 'CONNECTED' : 'OFFLINE'}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 text-[11px] text-slate-600 dark:text-slate-400">
            <span className="font-semibold text-blue-800 dark:text-blue-300 block mb-0.5">Dual-DB Architecture:</span>
            Transactions and audit records persist in MongoDB, while routing topology executes over Neo4j Bolt rails.
          </div>
        </Card>
      </div>

      {/* 5. Recent Activity Table */}
      <Card className="overflow-hidden">
        <div className="p-5 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Recent Transactions</h2>
            <p className="text-xs text-slate-500">Newest payments submitted to the routing engine.</p>
          </div>
          <Link
            href="/transactions"
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            View All ({summary?.total || 0}) <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 font-semibold">
              <tr>
                <th className="px-5 py-3">Transaction ID</th>
                <th className="px-5 py-3">Amount</th>
                <th className="px-5 py-3">Corridor</th>
                <th className="px-5 py-3">Risk Verdict</th>
                <th className="px-5 py-3">Selected Route</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {data?.recentTransactions && data.recentTransactions.length > 0 ? (
                data.recentTransactions.map((txn) => (
                  <tr
                    key={txn.transactionId}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                    onClick={() => setSelectedTxn(txn)}
                  >
                    <td className="px-5 py-3.5 font-mono font-bold text-blue-600 dark:text-blue-400">
                      {txn.transactionId}
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-slate-900 dark:text-white">
                      {txn.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {txn.currency}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">
                      {txn.sourceCountry} ➔ {txn.destinationCountry}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={txn.riskDecision} />
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                      {txn.selectedRoute ? (
                        <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                          {txn.selectedRoute.hops.join(' ➔ ')}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">None (Held / Blocked)</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTxn(txn);
                        }}
                        className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                    No transactions processed yet. Run <code className="font-mono">npm run seed:demo</code> to populate demo data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Slide-over Transaction Inspector */}
      <TransactionDetailDrawer
        transaction={selectedTxn}
        isOpen={Boolean(selectedTxn)}
        onClose={() => setSelectedTxn(null)}
      />
    </div>
  );
}
