'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card } from '@/src/components/ui/Card';
import { StatusBadge } from '@/src/components/ui/StatusBadge';
import { LoadingState } from '@/src/components/ui/LoadingState';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorState } from '@/src/components/ui/ErrorState';
import { TransactionDetailDrawer } from '@/src/components/transactions/TransactionDetailDrawer';
import { TransactionRecord } from '@/src/types/frontend';
import {
  Search,
  Filter,
  ArrowUpDown,
  RefreshCw,
  X,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ListOrdered,
  Download,
} from 'lucide-react';

function TransactionMonitorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [decision, setDecision] = useState<string>(searchParams.get('decision') || '');
  const [country, setCountry] = useState<string>('');
  const [sort, setSort] = useState<string>('createdAt_desc');

  // Detail Drawer
  const [selectedTxn, setSelectedTxn] = useState<TransactionRecord | null>(null);

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '15');
      if (decision) params.set('decision', decision);
      if (search) params.set('search', search);
      if (country) params.set('country', country);
      if (sort) params.set('sort', sort);

      const res = await fetch(`/api/transactions?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch transactions (HTTP ${res.status})`);
      }

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'API returned failure');
      }

      setTransactions(data.transactions || []);
      setTotal(data.total ?? data.transactions?.length ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [page, decision, search, country, sort]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleResetFilters = () => {
    setSearch('');
    setDecision('');
    setCountry('');
    setSort('createdAt_desc');
    setPage(1);
  };

  const hasActiveFilters = Boolean(search || decision || country || sort !== 'createdAt_desc');

  // Export CSV of currently loaded transactions
  const exportCSV = () => {
    if (transactions.length === 0) return;
    const headers = [
      'Transaction ID',
      'Amount',
      'Currency',
      'Source Country',
      'Destination Country',
      'Risk Score',
      'Decision',
      'Status',
      'Route Hops',
      'Created At',
    ];
    const rows = transactions.map((t) => [
      t.transactionId,
      t.amount,
      t.currency,
      t.sourceCountry,
      t.destinationCountry,
      t.riskScore,
      t.riskDecision,
      t.status,
      t.selectedRoute ? t.selectedRoute.hops.join(' -> ') : 'None',
      t.createdAt,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.map((x) => `"${x}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `trustroute_transactions_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Transaction Ledger & Monitor
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Audit-grade record of cross-border transfers, deterministic risk verdicts, and graph corridor execution.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            disabled={transactions.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            onClick={fetchTransactions}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* 2. Search & Filter Bar */}
      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by ID or Country..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Decision Filter */}
          <div className="flex items-center gap-1.5">
            <select
              value={decision}
              onChange={(e) => {
                setDecision(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            >
              <option value="">All Risk Verdicts</option>
              <option value="APPROVED">APPROVED Only</option>
              <option value="STEP_UP">STEP_UP Only</option>
              <option value="BLOCKED">BLOCKED Only</option>
            </select>
          </div>

          {/* Country Filter */}
          <div className="flex items-center gap-1.5">
            <select
              value={country}
              onChange={(e) => {
                setCountry(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            >
              <option value="">All Jurisdictions</option>
              <option value="USA">United States (USA)</option>
              <option value="UAE">United Arab Emirates (UAE)</option>
              <option value="IND">India (IND)</option>
              <option value="GBR">United Kingdom (GBR)</option>
            </select>
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-1.5">
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium"
            >
              <option value="createdAt_desc">Sort: Newest First</option>
              <option value="createdAt_asc">Sort: Oldest First</option>
              <option value="amount_desc">Sort: Highest Amount</option>
              <option value="amount_asc">Sort: Lowest Amount</option>
              <option value="riskScore_desc">Sort: Highest Risk Score</option>
              <option value="riskScore_asc">Sort: Lowest Risk Score</option>
            </select>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            <span className="text-slate-500">
              Showing filtered results ({total} matches)
            </span>
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline"
            >
              <X className="w-3.5 h-3.5" />
              Reset Filters
            </button>
          </div>
        )}
      </Card>

      {/* 3. Main Data Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <LoadingState message="Retrieving transactions from MongoDB..." rows={8} />
        ) : error ? (
          <div className="p-6">
            <ErrorState message={error} onRetry={fetchTransactions} />
          </div>
        ) : transactions.length === 0 ? (
          <EmptyState
            icon={<ListOrdered className="w-8 h-8" />}
            title="No Transactions Match Filters"
            description="Try clearing search filters or seed demo transactions with npm run seed:demo."
            actionText="Reset All Filters"
            onAction={handleResetFilters}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 font-semibold">
                  <tr>
                    <th className="px-5 py-3.5">Transaction ID</th>
                    <th className="px-5 py-3.5">Timestamp</th>
                    <th className="px-5 py-3.5">Amount</th>
                    <th className="px-5 py-3.5">Corridor</th>
                    <th className="px-5 py-3.5">Risk Score</th>
                    <th className="px-5 py-3.5">Verdict</th>
                    <th className="px-5 py-3.5">Assigned Route</th>
                    <th className="px-5 py-3.5 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {transactions.map((txn) => {
                    const formattedDate = new Date(txn.createdAt).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <tr
                        key={txn.transactionId}
                        onClick={() => setSelectedTxn(txn)}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                      >
                        <td className="px-5 py-3.5 font-mono font-bold text-blue-600 dark:text-blue-400">
                          {txn.transactionId}
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">
                          {formattedDate}
                        </td>
                        <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          {txn.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}{' '}
                          <span className="text-[11px] font-semibold text-slate-400">{txn.currency}</span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {txn.sourceCountry} ➔ {txn.destinationCountry}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                            {txn.riskScore}
                          </span>
                          <span className="text-slate-400">/100</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusBadge status={txn.riskDecision} />
                        </td>
                        <td className="px-5 py-3.5 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                          {txn.selectedRoute ? (
                            <span className="text-emerald-700 dark:text-emerald-400 font-semibold truncate block max-w-xs">
                              {txn.selectedRoute.hops.join(' ➔ ')}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">None (Held / Blocked)</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTxn(txn);
                            }}
                            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                          >
                            <span>Inspect</span>
                            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="px-5 py-3.5 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between text-xs">
              <span className="text-slate-500">
                Page <strong className="text-slate-800 dark:text-slate-200">{page}</strong> of{' '}
                <strong className="text-slate-800 dark:text-slate-200">{totalPages}</strong> ({total} total transactions)
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
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

export default function TransactionMonitorPage() {
  return (
    <React.Suspense fallback={<LoadingState message="Loading transactions..." />}>
      <TransactionMonitorContent />
    </React.Suspense>
  );
}

