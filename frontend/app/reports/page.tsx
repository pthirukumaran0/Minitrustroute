'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/src/context/AuthContext';
import { Card } from '@/src/components/ui/Card';
import { LoadingSpinner, EmptyState, ErrorState } from '@/src/components/ui/LoadingState';
import { AnalyticsSummary, TransactionRecord } from '@/src/types/frontend';
import {
  BarChart3,
  Download,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';

export default function ReportsAndAnalyticsPage() {
  const { role } = useAuth();
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalyticsData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch analytics summary & transactions concurrently
      const [analyticsRes, txRes] = await Promise.all([
        fetch('/api/analytics'),
        fetch('/api/transactions?limit=100'),
      ]);

      if (!analyticsRes.ok) throw new Error('Failed to load analytics summary');
      if (!txRes.ok) throw new Error('Failed to load transaction data');

      const aData = await analyticsRes.json();
      const tData = await txRes.json();

      // Backend returns { success, summary: {...}, ...summary }
      const analyticsPayload: AnalyticsSummary = aData.summary ?? aData;
      setAnalytics(analyticsPayload);
      setTransactions(tData.transactions || []);
    } catch (err: any) {
      console.error('Analytics load error:', err);
      setError(err.message || 'Failed to aggregate analytics data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (role !== 'sender') {
      fetchAnalyticsData();
    }
  }, [fetchAnalyticsData, role]);

  // Role Restriction Guard: Senders/Users cannot access Institutional Analytics
  if (role === 'sender') {
    return (
      <div className="py-16 px-4 max-w-lg mx-auto text-center space-y-5">
        <div className="w-16 h-16 rounded-3xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto shadow-xs">
          <ShieldAlert className="w-8 h-8 text-amber-600" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-black tracking-tight text-slate-900">
            Access Restricted
          </h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            Institutional Analytics & Fraud Telemetry are restricted to Fraud Operations Analysts and Administrators. Senders can view their personal transfer history under My Transfers.
          </p>
        </div>
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-2xs"
          >
            Return to Sender Dashboard
          </Link>
          <Link
            href="/transactions"
            className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-all shadow-2xs"
          >
            My Transfers
          </Link>
        </div>
      </div>
    );
  }

  // Export full CSV report
  const handleExportCSV = () => {
    if (!transactions.length) return;

    const headers = [
      'Transaction ID',
      'Created At',
      'Amount',
      'Currency',
      'Source Country',
      'Destination Country',
      'Risk Score',
      'Decision',
      'SIM Swap 24h',
      'Number Verified',
      'Device Status',
      'Route ID',
      'Estimated Fee ($)',
      'Latency (ms)',
      'Status',
    ];

    const rows = transactions.map((t) => [
      t.transactionId,
      t.createdAt,
      t.amount,
      t.currency,
      t.sourceCountry,
      t.destinationCountry,
      t.riskScore,
      t.riskDecision,
      t.signals?.simSwap24h ? 'YES' : 'NO',
      t.signals?.numberVerified ? 'YES' : 'NO',
      t.signals?.deviceStatus,
      t.selectedRoute?.routeId || 'NONE',
      t.selectedRoute?.estimatedCost || 0,
      t.selectedRoute?.estimatedLatencyMs || 0,
      t.status,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `trustroute-analytics-report-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Compute corridor stats from transactions
  const corridorStats = transactions.reduce<
    Record<string, { count: number; currencies: Record<string, number> }>
  >((acc, tx) => {
    const key = `${tx.sourceCountry} → ${tx.destinationCountry}`;
    if (!acc[key]) {
      acc[key] = { count: 0, currencies: {} };
    }
    acc[key].count += 1;
    acc[key].currencies[tx.currency] = (acc[key].currencies[tx.currency] || 0) + tx.amount;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            Reports & Performance Analytics
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Quantitative analysis of routing efficiency, fraud prevention rates, and independent currency volumes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {role === 'admin' && (
            <Link
              href="/admin/users"
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg shadow-2xs transition-colors"
            >
              <UserCheck className="w-3.5 h-3.5" />
              User Persona Analytics
            </Link>
          )}
          <button
            onClick={handleExportCSV}
            disabled={transactions.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            Export Full CSV Report
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner message="Aggregating transactional analytics from database..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchAnalyticsData} />
      ) : !analytics ? (
        <EmptyState title="No Analytics Available" description="Run test transactions to generate data." />
      ) : (
        <div className="space-y-6">
          {/* 1. Verdict Breakdown Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Total Transactions
              </span>
              <p className="text-3xl font-black text-slate-900 dark:text-white mt-1">
                {analytics.total}
              </p>
              <span className="text-xs text-slate-500 mt-1 block">100% processed server-side</span>
            </Card>

            <Card className="p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Approved Transfers
                </span>
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                {analytics.approved}
              </p>
              <span className="text-xs text-slate-500 mt-1 block">
                {analytics.approvalRate}% rate — Low risk (0-30)
              </span>
            </Card>

            <Card className="p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Step-Up Required
                </span>
                <UserCheck className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-3xl font-black text-amber-600 dark:text-amber-400 mt-1">
                {analytics.stepUp}
              </p>
              <span className="text-xs text-slate-500 mt-1 block">
                {analytics.stepUpRate}% rate — Medium risk (31-70)
              </span>
            </Card>

            <Card className="p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Blocked Fraud
                </span>
                <ShieldAlert className="w-4 h-4 text-rose-500" />
              </div>
              <p className="text-3xl font-black text-rose-600 dark:text-rose-400 mt-1">
                {analytics.blocked}
              </p>
              <span className="text-xs text-slate-500 mt-1 block">
                {analytics.blockedRate}% rate — High risk (71-100)
              </span>
            </Card>
          </div>

          {/* 2. Decision Ratio Progress Bar */}
          <Card className="p-5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Risk Engine Decision Ratio
              </h2>
              <span className="text-xs text-slate-500">{analytics.total} Evaluated In Total</span>
            </div>

            <div className="w-full h-4 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
              <div
                className="bg-emerald-500 h-full transition-all"
                style={{ width: `${analytics.approvalRate}%` }}
                title={`Approved: ${analytics.approved} (${analytics.approvalRate}%)`}
              />
              <div
                className="bg-amber-500 h-full transition-all"
                style={{ width: `${analytics.stepUpRate}%` }}
                title={`Step-Up: ${analytics.stepUp} (${analytics.stepUpRate}%)`}
              />
              <div
                className="bg-rose-500 h-full transition-all"
                style={{ width: `${analytics.blockedRate}%` }}
                title={`Blocked: ${analytics.blocked} (${analytics.blockedRate}%)`}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 pt-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>
                  Approved ({analytics.approved} - {analytics.approvalRate}%)
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span>
                  Step-Up Required ({analytics.stepUp} - {analytics.stepUpRate}%)
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span>
                  Blocked ({analytics.blocked} - {analytics.blockedRate}%)
                </span>
              </div>
            </div>
          </Card>

          {/* 3. Independent Currency Volumes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Disaggregated Transaction Volume by Currency
              </h2>
              <span className="text-[11px] text-slate-500">
                Strict financial accounting: no cross-currency mixing
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {analytics.volumeByCurrency.map((v) => (
                <Card
                  key={v.currency}
                  className="p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded">
                      {v.currency} POOL
                    </span>
                    <span className="text-xs font-mono text-slate-500">
                      {v.transactionCount} transfers
                    </span>
                  </div>
                  <p className="text-2xl font-black text-slate-900 dark:text-white mt-2">
                    {v.totalVolume.toLocaleString(undefined, { minimumFractionDigits: 2 })}{' '}
                    <span className="text-xs font-semibold text-slate-400">{v.currency}</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Avg ticket:{' '}
                    <strong className="text-slate-700 dark:text-slate-300">
                      {v.avgAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}{' '}
                      {v.currency}
                    </strong>
                  </p>
                </Card>
              ))}
            </div>
          </div>

          {/* 4. Corridor Efficiency Breakdown Table */}
          <Card className="overflow-hidden border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Active Corridor Distribution
              </h2>
              <span className="text-[11px] text-slate-500">
                Source and destination jurisdiction volume
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Jurisdiction Corridor</th>
                    <th className="px-4 py-3">Total Processed</th>
                    <th className="px-4 py-3">Disaggregated Volume</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {Object.entries(corridorStats).map(([corridor, data]) => (
                    <tr
                      key={corridor}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">
                        {corridor}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-300">
                        {data.count} transfers
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(data.currencies).map(([curr, amt]) => (
                            <span
                              key={curr}
                              className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-xs font-semibold text-slate-800 dark:text-slate-200"
                            >
                              {amt.toLocaleString(undefined, { minimumFractionDigits: 2 })} {curr}
                            </span>
                          ))}
                        </div>
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
