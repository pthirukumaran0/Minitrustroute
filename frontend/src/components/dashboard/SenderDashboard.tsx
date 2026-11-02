'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Card } from '@/src/components/ui/Card';
import { StatusBadge } from '@/src/components/ui/StatusBadge';
import { LoadingState } from '@/src/components/ui/LoadingState';
import { ErrorState } from '@/src/components/ui/ErrorState';
import { TransactionDetailDrawer } from '@/src/components/transactions/TransactionDetailDrawer';
import { TransactionRecord } from '@/src/types/frontend';
import { useAuth } from '@/src/context/AuthContext';
import {
  Send,
  PlusCircle,
  ArrowRightLeft,
  TrendingUp,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  ExternalLink,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Clock,
  DollarSign,
  ArrowUpRight,
  Filter,
} from 'lucide-react';

export function SenderDashboard() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTxn, setSelectedTxn] = useState<TransactionRecord | null>(null);

  const fetchSenderData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Fetch transactions scoped to sender
      const res = await fetch('/api/transactions?scope=my-transfers&limit=50');
      if (!res.ok) {
        throw new Error(`Failed to load transfer ledger (${res.status})`);
      }
      const data = await res.json();
      setTransactions(data.transactions || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSenderData();
  }, [fetchSenderData]);

  // Derived metrics from real records
  const totalTransfers = transactions.length;
  const approvedTransfers = transactions.filter((t) => t.riskDecision === 'APPROVED');
  const stepUpTransfers = transactions.filter(
    (t) => t.riskDecision === 'STEP_UP' || t.status === 'STEP_UP_REQUIRED'
  );
  const blockedTransfers = transactions.filter((t) => t.riskDecision === 'BLOCKED');

  // Total Capital Routed: sum of approved transfers
  const totalCapitalRoutedUSD = approvedTransfers.reduce((acc, t) => acc + (t.amount || 0), 0);

  // Approval Rate
  const approvalRate =
    totalTransfers > 0 ? Number(((approvedTransfers.length / totalTransfers) * 100).toFixed(1)) : 100;

  // Step-Up Verified: count of transactions that underwent review/MFA and got verified
  const stepUpVerifiedCount = transactions.filter(
    (t) => t.reviewStatus === 'VERIFIED_APPROVED' || (t.signals?.numberVerified && t.riskScore < 35)
  ).length;

  // Time-aware greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-6">
      {/* 1. Header & Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider block">
            {greeting}, {user?.name || 'Sarah Jenkins'}
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-0.5">
            Corporate Client Portal
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Here is your cross-border payment activity and intelligent corridor routing status.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchSenderData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200/80 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <Link
            href="/payment"
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs hover:shadow-sm transition-all"
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>New Transfer</span>
          </Link>
        </div>
      </div>

      {/* 2. Four Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: My Transfers */}
        <Card className="p-5 bg-white border border-slate-200/70 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              My Transfers
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 mt-2">{totalTransfers}</p>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>100% Policy Verified</span>
          </div>
        </Card>

        {/* Card 2: Total Capital Routed */}
        <Card className="p-5 bg-white border border-slate-200/70 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Total Capital Routed
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 mt-2">
            ${totalCapitalRoutedUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <div className="mt-2 text-xs text-slate-500 font-medium">
            Settled via Neo4j Corridors (USD)
          </div>
        </Card>

        {/* Card 3: Approval Rate */}
        <Card className="p-5 bg-white border border-slate-200/70 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Approval Rate
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 mt-2">{approvalRate}%</p>
          <div className="mt-2 text-xs text-emerald-600 font-semibold">
            {approvedTransfers.length} of {totalTransfers} Passed Zero-Trust
          </div>
        </Card>

        {/* Card 4: Step-Up Verified */}
        <Card className="p-5 bg-white border border-slate-200/70 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Step-Up Verified
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 mt-2">{stepUpVerifiedCount}</p>
          <div className="mt-2 text-xs text-amber-600 font-semibold">
            {stepUpTransfers.length} Required MFA Challenges
          </div>
        </Card>
      </div>

      {/* 3. Verdict Distribution Bar */}
      <Card className="p-5 bg-white border border-slate-200/70 rounded-2xl shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Zero-Trust Verdict Distribution</h3>
            <p className="text-xs text-slate-500">Real-time breakdown of your transfer evaluations.</p>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-emerald-700">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              Approved ({approvedTransfers.length})
            </span>
            <span className="flex items-center gap-1.5 text-amber-700">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              Step-Up ({stepUpTransfers.length})
            </span>
            <span className="flex items-center gap-1.5 text-rose-700">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              Blocked ({blockedTransfers.length})
            </span>
          </div>
        </div>

        {/* Visual Bar */}
        <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
          {totalTransfers > 0 ? (
            <>
              <div
                style={{ width: `${(approvedTransfers.length / totalTransfers) * 100}%` }}
                className="bg-emerald-500 transition-all duration-300"
                title={`Approved: ${approvedTransfers.length}`}
              />
              <div
                style={{ width: `${(stepUpTransfers.length / totalTransfers) * 100}%` }}
                className="bg-amber-500 transition-all duration-300"
                title={`Step-Up: ${stepUpTransfers.length}`}
              />
              <div
                style={{ width: `${(blockedTransfers.length / totalTransfers) * 100}%` }}
                className="bg-rose-500 transition-all duration-300"
                title={`Blocked: ${blockedTransfers.length}`}
              />
            </>
          ) : (
            <div className="w-full bg-slate-200" />
          )}
        </div>
      </Card>

      {/* 4. Recent Transfers Table */}
      <Card className="bg-white border border-slate-200/70 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Recent Transfers & Routing Status</h2>
            <p className="text-xs text-slate-500">
              Transactions originated by your corporate account with live corridor execution.
            </p>
          </div>
          <Link
            href="/transactions"
            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="p-8">
            <LoadingState message="Loading your corporate transfers..." rows={4} />
          </div>
        ) : error ? (
          <div className="p-6">
            <ErrorState title="Failed to Load Transfers" message={error} onRetry={fetchSenderData} />
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
              <Send className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No Transfers Yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              You haven&apos;t initiated any cross-border payments. Click below to route your first transfer across optimal correspondent rails.
            </p>
            <Link
              href="/payment"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Initiate First Transfer</span>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200/80">
                <tr>
                  <th className="px-5 py-3.5">Transaction ID</th>
                  <th className="px-5 py-3.5">Sender / Recipient</th>
                  <th className="px-5 py-3.5">Amount</th>
                  <th className="px-5 py-3.5">Verdict</th>
                  <th className="px-5 py-3.5">Assigned Route</th>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {transactions.slice(0, 8).map((txn) => {
                  const dateStr = new Date(txn.createdAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <tr
                      key={txn.transactionId}
                      onClick={() => setSelectedTxn(txn)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-4 font-mono font-bold text-indigo-600">
                        {txn.transactionId}
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-bold text-slate-800">
                          {txn.recipientName || 'Correspondent Bank Creditor'}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {txn.sourceCountry} → {txn.destinationCountry}
                        </p>
                      </td>
                      <td className="px-5 py-4 font-bold text-slate-900">
                        ${txn.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}{' '}
                        <span className="text-[10px] text-slate-400 font-semibold">{txn.currency}</span>
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={txn.riskDecision} />
                      </td>
                      <td className="px-5 py-4 font-mono text-[11px]">
                        {txn.selectedRoute ? (
                          <span className="text-emerald-700 font-semibold truncate block max-w-xs">
                            {txn.selectedRoute.hops.join(' → ')}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">
                            {txn.riskDecision === 'BLOCKED' ? 'Route Prohibited' : 'Held for Auth'}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-slate-500 text-[11px] whitespace-nowrap">
                        {dateStr}
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTxn(txn);
                          }}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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

