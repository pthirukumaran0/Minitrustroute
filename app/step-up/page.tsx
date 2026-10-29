'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card } from '@/src/components/ui/Card';
import { StatusBadge } from '@/src/components/ui/StatusBadge';
import { LoadingSpinner, EmptyState, ErrorState } from '@/src/components/ui/LoadingState';
import { TransactionDetailDrawer } from '@/src/components/transactions/TransactionDetailDrawer';
import { TransactionRecord } from '@/src/types/frontend';
import {
  UserCheck,
  AlertTriangle,
  Lock,
  Search,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  Smartphone,
  Eye,
  Info,
  CheckCircle2,
} from 'lucide-react';

export default function StepUpQueuePage() {
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedTx, setSelectedTx] = useState<TransactionRecord | null>(null);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

  const fetchStepUpTransactions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/transactions?decision=STEP_UP&limit=50');
      if (!res.ok) {
        throw new Error(`Failed to fetch step-up transactions (${res.status})`);
      }
      const data = await res.json();
      setTransactions(data.transactions || []);
    } catch (err: any) {
      console.error('Error fetching step-up queue:', err);
      setError(err.message || 'Failed to load step-up transactions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStepUpTransactions();
  }, [fetchStepUpTransactions]);

  const filtered = transactions.filter((tx) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      tx.transactionId.toLowerCase().includes(term) ||
      tx.sourceCountry.toLowerCase().includes(term) ||
      tx.destinationCountry.toLowerCase().includes(term) ||
      (tx.contributingFactors && tx.contributingFactors.some((f) => f.toLowerCase().includes(term)))
    );
  });

  // Calculate volume by currency held in step-up
  const volumeByCurrency = transactions.reduce<Record<string, number>>((acc, tx) => {
    acc[tx.currency] = (acc[tx.currency] || 0) + tx.amount;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Step-Up Verification Queue
            </h1>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
              {transactions.length} Pending
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Corridor transactions held in escrow awaiting out-of-band Multi-Factor Authentication.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchStepUpTransactions()}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-2xs transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Queue
          </button>
          <Link
            href="/payment"
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs transition-colors"
          >
            Test New Payment
          </Link>
        </div>
      </div>

      {/* Zero-Trust Architecture Notice */}
      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3.5">
        <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <p className="font-bold text-amber-900 dark:text-amber-200">
            Escrow Enforcement & Genuine Carrier MFA Policy
          </p>
          <p className="text-amber-800/90 dark:text-amber-300/80 leading-relaxed">
            In accordance with TrustRoute&apos;s zero-trust security policy, transactions scoring between 31 and 70 (e.g. unverified phone number, unknown/suspicious device, or high-value transfers) are withheld from payment rail dispatch. Under strict banking audit standards, <strong>no artificial bypass or manual instant approval</strong> is allowed; funds remain locked until genuine out-of-band carrier MFA or biometric challenge is verified.
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-white dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Held Transactions
            </span>
            <UserCheck className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {transactions.length}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Awaiting customer response
          </p>
        </Card>

        <Card className="p-4 bg-white dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Withheld Volume
            </span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-1 space-y-0.5">
            {Object.keys(volumeByCurrency).length > 0 ? (
              Object.entries(volumeByCurrency).map(([curr, amt]) => (
                <p key={curr} className="text-sm font-bold text-slate-900 dark:text-white">
                  {amt.toLocaleString(undefined, { minimumFractionDigits: 2 })} {curr}
                </p>
              ))
            ) : (
              <p className="text-sm font-semibold text-slate-400">0.00 Held</p>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Independent currency pools</p>
        </Card>

        <Card className="p-4 bg-white dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Primary Triggers
            </span>
            <Smartphone className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 space-y-1 text-xs">
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
              <span>Unverified MSISDN:</span>
              <strong className="font-mono">
                {transactions.filter((t) => !t.signals.numberVerified).length}
              </strong>
            </div>
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
              <span>Device Anomaly:</span>
              <strong className="font-mono">
                {transactions.filter((t) => t.signals.deviceStatus !== 'TRUSTED').length}
              </strong>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-white dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Routing Status
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-base font-bold text-amber-600 dark:text-amber-400 mt-1">
            Rails Quarantined
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            0 routes dispatched until step-up completion
          </p>
        </Card>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Transaction ID, Corridor, or Factor..."
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Main Table / State View */}
      {loading ? (
        <LoadingSpinner message="Querying pending step-up queue from MongoDB..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchStepUpTransactions} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No Step-Up Verifications Pending"
          description="There are currently no transactions quarantined in the step-up queue. All transactions have either cleared risk rules or been blocked."
          actionText="Initiate High-Risk Test Payment"
          actionHref="/payment"
        />
      ) : (
        <Card className="overflow-hidden border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Transaction ID</th>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Corridor</th>
                  <th className="px-4 py-3">Risk Score</th>
                  <th className="px-4 py-3">Step-Up Factors</th>
                  <th className="px-4 py-3">Required Action</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filtered.map((tx) => (
                  <tr
                    key={tx.transactionId}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                      {tx.transactionId}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {new Date(tx.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                      {tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}{' '}
                      <span className="text-[10px] text-blue-600 font-bold">{tx.currency}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      <span className="font-semibold">{tx.sourceCountry}</span> ➔{' '}
                      <span className="font-semibold">{tx.destinationCountry}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-900">
                        {tx.riskScore} / 100
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <div className="flex flex-wrap gap-1">
                        {tx.contributingFactors && tx.contributingFactors.length > 0 ? (
                          tx.contributingFactors.map((factor, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                            >
                              {factor}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-slate-400">Step-Up Required</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] font-mono text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/30 px-2 py-0.5 rounded border border-amber-200/50 dark:border-amber-900/40">
                        {tx.recommendedAction || 'SMS_OTP / Silent Network Auth'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          setSelectedTx(tx);
                          setDrawerOpen(true);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Transaction Detail Slide-Over Drawer */}
      <TransactionDetailDrawer
        transaction={selectedTx}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}

