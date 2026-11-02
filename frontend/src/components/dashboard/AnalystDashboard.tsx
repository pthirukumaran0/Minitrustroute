'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Card } from '@/src/components/ui/Card';
import { LoadingState } from '@/src/components/ui/LoadingState';
import { ErrorState } from '@/src/components/ui/ErrorState';
import { TransactionDetailDrawer } from '@/src/components/transactions/TransactionDetailDrawer';
import { TransactionRecord } from '@/src/types/frontend';
import { useAuth } from '@/src/context/AuthContext';
import {
  ShieldAlert,
  AlertTriangle,
  UserCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  RefreshCw,
  Search,
  Filter,
  Radio,
  ExternalLink,
  Smartphone,
  Eye,
  Check,
  Ban,
  ArrowUpRight,
  XCircle,
  ShieldX,
} from 'lucide-react';

export function AnalystDashboard() {
  const { user, authFetch } = useAuth();
  const [queue, setQueue] = useState<TransactionRecord[]>([]);
  const [allTransactions, setAllTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTxn, setSelectedTxn] = useState<TransactionRecord | null>(null);
  const [reviewModalTxn, setReviewModalTxn] = useState<TransactionRecord | null>(null);
  const [reviewAction, setReviewAction] = useState<'APPROVE' | 'ESCALATE' | 'BLOCK'>('ESCALATE');
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [submittingReview, setSubmittingReview] = useState<boolean>(false);
  const [reviewMessage, setReviewMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [verdictFilter, setVerdictFilter] = useState<'ALL' | 'APPROVED' | 'STEP_UP' | 'BLOCKED'>('ALL');

  const fetchAnalystData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [queueRes, txRes] = await Promise.all([
        authFetch('/api/transactions/review-queue?limit=100'),
        authFetch('/api/transactions?limit=200'),
      ]);

      if (!queueRes.ok || !txRes.ok) {
        throw new Error('Failed to load fraud operations feed from MongoDB');
      }

      const queueData = await queueRes.json();
      const txData = await txRes.json();

      setQueue(queueData.queue || queueData.transactions || []);
      setAllTransactions(txData.transactions || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchAnalystData();
  }, [fetchAnalystData]);

  // Deduplicated source pool of all operational transactions
  const combinedTransactions = useMemo(() => {
    const map = new Map<string, TransactionRecord>();
    // First insert review queue items
    queue.forEach((t) => map.set(t.transactionId, t));
    // Then add any additional transactions
    allTransactions.forEach((t) => {
      if (!map.has(t.transactionId)) {
        map.set(t.transactionId, t);
      }
    });
    return Array.from(map.values()).sort((a, b) => {
      const timeA = new Date(a.createdAt || a.timestamp || 0).getTime();
      const timeB = new Date(b.createdAt || b.timestamp || 0).getTime();
      return timeB - timeA;
    });
  }, [queue, allTransactions]);

  // Derived metrics from real records
  const reviewQueueCount = combinedTransactions.filter(
    (t) => t.riskDecision === 'STEP_UP' || t.status === 'STEP_UP_REQUIRED' || t.reviewStatus === 'PENDING_REVIEW'
  ).length;

  const approvedCount = combinedTransactions.filter(
    (t) => t.riskDecision === 'APPROVED' || t.status === 'APPROVED' || t.reviewStatus === 'VERIFIED_APPROVED'
  ).length;

  const blockedCount = combinedTransactions.filter(
    (t) => t.riskDecision === 'BLOCKED' || t.status === 'BLOCKED'
  ).length;

  const simSwapAttacksCount = combinedTransactions.filter(
    (t) => t.signals?.simSwap24h || t.contributingFactors?.some((f) => f.toLowerCase().includes('sim swap'))
  ).length;

  const handleExecuteReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewModalTxn) return;

    setSubmittingReview(true);
    setReviewMessage(null);

    try {
      const res = await fetch(`/api/transactions/${reviewModalTxn.transactionId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: reviewAction,
          notes: reviewNotes || `Supervisory decision: ${reviewAction}`,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || 'Failed to record review action');
      }

      setReviewMessage({
        type: 'success',
        text: `Successfully recorded review verdict: ${reviewAction} on transaction ${reviewModalTxn.transactionId}.`,
      });

      await fetchAnalystData();
      setTimeout(() => {
        setReviewModalTxn(null);
        setReviewMessage(null);
        setReviewNotes('');
      }, 1200);
    } catch (err: unknown) {
      setReviewMessage({
        type: 'error',
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmittingReview(false);
    }
  };

  // Filtered urgent feed according to search query and active verdictFilter
  const urgentFeed = useMemo(() => {
    return combinedTransactions.filter((t) => {
      const q = search.toLowerCase().trim();
      const matchesSearch =
        q === '' ||
        t.transactionId.toLowerCase().includes(q) ||
        (t.senderName && t.senderName.toLowerCase().includes(q)) ||
        (t.senderEmail && t.senderEmail.toLowerCase().includes(q)) ||
        (t.recipientName && t.recipientName.toLowerCase().includes(q)) ||
        t.sourceCountry.toLowerCase().includes(q) ||
        t.destinationCountry.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      const norm = (t.riskDecision || t.status || '').toUpperCase();

      if (verdictFilter === 'ALL') {
        return true;
      }
      if (verdictFilter === 'APPROVED') {
        return norm === 'APPROVED' || t.status === 'APPROVED' || t.reviewStatus === 'VERIFIED_APPROVED';
      }
      if (verdictFilter === 'BLOCKED') {
        return norm === 'BLOCKED' || t.status === 'BLOCKED';
      }
      if (verdictFilter === 'STEP_UP') {
        return (
          norm === 'STEP_UP' ||
          norm === 'STEP-UP' ||
          t.status === 'STEP_UP_REQUIRED' ||
          t.reviewStatus === 'PENDING_REVIEW'
        );
      }
      return true;
    });
  }, [combinedTransactions, search, verdictFilter]);

  return (
    <div className="space-y-6">
      {/* 1. Header & Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <span className="text-xs font-bold text-amber-600 uppercase tracking-wider block">
            Good afternoon, {user?.name || 'Alex Rivera'}
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-0.5 flex items-center gap-2.5">
            <ShieldAlert className="w-7 h-7 text-amber-600" />
            Fraud Operations Console
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time review queue, telecom signal anomalies, and risk challenges.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchAnalystData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200/80 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Queue</span>
          </button>
          <Link
            href="/review-queue"
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs hover:shadow-sm transition-all cursor-pointer"
          >
            <UserCheck className="w-4 h-4" />
            <span>Open Review Queue ({reviewQueueCount})</span>
          </Link>
        </div>
      </div>

      {/* 2. Four Operational Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Review Queue */}
        <Card className="p-5 bg-white border border-slate-200/70 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Review Queue
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 mt-2">{reviewQueueCount}</p>
          <div className="mt-2 text-xs text-amber-600 font-semibold flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>Pending Analyst Evaluation</span>
          </div>
        </Card>

        {/* Card 2: SIM-Swap Attacks */}
        <Card className="p-5 bg-white border border-slate-200/70 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              SIM-Swap Attacks
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Smartphone className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-rose-600 mt-2">{simSwapAttacksCount}</p>
          <div className="mt-2 text-xs text-rose-600 font-semibold flex items-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Intercepted by Policy</span>
          </div>
        </Card>

        {/* Card 3: Approved Transactions */}
        <Card className="p-5 bg-white border border-slate-200/70 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Approved Cleared
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-emerald-600 mt-2">{approvedCount}</p>
          <div className="mt-2 text-xs text-emerald-600 font-semibold flex items-center gap-1">
            <Check className="w-3.5 h-3.5" />
            <span>Cleared for Interbank Rails</span>
          </div>
        </Card>

        {/* Card 4: Blocked Interceptions */}
        <Card className="p-5 bg-white border border-slate-200/70 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Blocked Threats
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Ban className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 mt-2">{blockedCount}</p>
          <div className="mt-2 text-xs text-slate-500 font-medium">
            Strict Zero-Trust Blocked
          </div>
        </Card>
      </div>

      {/* 3. Urgent Review Queue Feed */}
      <Card className="bg-white border border-slate-200/70 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>Urgent Review Queue Feed</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200">
                {urgentFeed.length} Displayed
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Live operational ledger of cross-border transfers categorized by Zero-Trust risk decisions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search ID, sender, country..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200/80 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 w-52 font-medium"
              />
            </div>

            {/* Filter Tabs / Pills */}
            <div className="inline-flex p-1 bg-slate-100/80 border border-slate-200/80 rounded-xl shadow-2xs">
              <button
                onClick={() => setVerdictFilter('ALL')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  verdictFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({combinedTransactions.length})
              </button>

              <button
                onClick={() => setVerdictFilter('APPROVED')}
                className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  verdictFilter === 'APPROVED'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Approved ({approvedCount})</span>
              </button>

              <button
                onClick={() => setVerdictFilter('STEP_UP')}
                className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  verdictFilter === 'STEP_UP'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'text-amber-700 hover:bg-amber-50'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Step-Up ({reviewQueueCount})</span>
              </button>

              <button
                onClick={() => setVerdictFilter('BLOCKED')}
                className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  verdictFilter === 'BLOCKED'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'text-rose-700 hover:bg-rose-50'
                }`}
              >
                <Ban className="w-3.5 h-3.5" />
                <span>Blocked ({blockedCount})</span>
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-8">
            <LoadingState message="Loading fraud operations queue from MongoDB..." rows={4} />
          </div>
        ) : error ? (
          <div className="p-6">
            <ErrorState title="Failed to Load Review Queue" message={error} onRetry={fetchAnalystData} />
          </div>
        ) : urgentFeed.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            {verdictFilter === 'APPROVED' ? (
              <>
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <h3 className="text-sm font-bold text-slate-800">No Approved Transactions</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  No approved transactions match your current search query in the ledger.
                </p>
              </>
            ) : verdictFilter === 'BLOCKED' ? (
              <>
                <ShieldX className="w-10 h-10 text-rose-500 mx-auto" />
                <h3 className="text-sm font-bold text-slate-800">No Blocked Threat Records</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  No blocked transactions match your current search criteria.
                </p>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <h3 className="text-sm font-bold text-slate-800">Review Queue Clear</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  No transactions currently require step-up authentication or analyst clearance.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200/80">
                <tr>
                  <th className="px-5 py-3.5">Transaction ID</th>
                  <th className="px-5 py-3.5">Timestamp</th>
                  <th className="px-5 py-3.5">Sender / Recipient</th>
                  <th className="px-5 py-3.5">Amount</th>
                  <th className="px-5 py-3.5">Risk Score</th>
                  <th className="px-5 py-3.5">Zero-Trust Decision</th>
                  <th className="px-5 py-3.5">Threat Vector / Signal</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {urgentFeed.map((txn) => {
                  const normDecision = (txn.riskDecision || txn.status || '').toUpperCase();
                  const isApproved =
                    normDecision === 'APPROVED' ||
                    txn.status === 'APPROVED' ||
                    txn.reviewStatus === 'VERIFIED_APPROVED';
                  const isBlocked = normDecision === 'BLOCKED' || txn.status === 'BLOCKED';
                  const isStepUp = !isApproved && !isBlocked;

                  const hasSimSwap = txn.signals?.simSwap24h || txn.riskFactors?.simSwapWithin24h;

                  return (
                    <tr
                      key={txn.transactionId}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                      onClick={() => setSelectedTxn(txn)}
                    >
                      <td className="px-5 py-4 font-mono font-bold text-indigo-600">
                        {txn.transactionId}
                      </td>

                      <td className="px-5 py-4 text-slate-500 text-[11px] whitespace-nowrap">
                        {new Date(txn.timestamp || txn.createdAt).toLocaleString(undefined, {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-bold text-slate-800">{txn.senderName || 'Corporate Client'}</p>
                        <p className="text-[11px] text-slate-500">
                          {txn.recipientName || 'Beneficiary'} • <span className="font-mono text-slate-400">{txn.sourceCountry} → {txn.destinationCountry}</span>
                        </p>
                      </td>

                      <td className="px-5 py-4 font-bold text-slate-900 whitespace-nowrap">
                        ${txn.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}{' '}
                        <span className="text-[10px] text-slate-400 font-semibold">{txn.currency}</span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-mono font-extrabold px-2 py-0.5 rounded-md text-[11px] ${
                              txn.riskScore >= 70
                                ? 'bg-rose-100 text-rose-700'
                                : txn.riskScore >= 35
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {txn.riskScore}/100
                          </span>
                        </div>
                      </td>

                      {/* Visual Status Indicator: Strict Compliance with Guidelines */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        {isApproved ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            APPROVED
                          </span>
                        ) : isBlocked ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <Ban className="w-3.5 h-3.5 text-rose-600" />
                            BLOCKED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                            STEP-UP
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4 max-w-xs">
                        <span
                          className={`text-[11px] truncate block ${
                            hasSimSwap ? 'text-rose-700 font-bold' : 'text-slate-600'
                          }`}
                          title={txn.contributingFactors?.join(' | ')}
                        >
                          {hasSimSwap
                            ? 'CAMARA SIM Swap < 24h'
                            : txn.contributingFactors?.[0] || 'Standard Zero-Trust Evaluation'}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedTxn(txn)}
                            className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                          >
                            Inspect
                          </button>
                          {isStepUp && (
                            <button
                              onClick={() => {
                                setReviewModalTxn(txn);
                                setReviewAction(hasSimSwap ? 'BLOCK' : 'APPROVE');
                                setReviewNotes('');
                              }}
                              className="px-3 py-1 text-xs font-bold rounded-lg transition-all bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs cursor-pointer"
                            >
                              Review
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Review Modal */}
      {reviewModalTxn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Fraud Supervisory Action</h3>
              </div>
              <button
                onClick={() => setReviewModalTxn(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                <p className="text-slate-500 font-mono text-[11px]">{reviewModalTxn.transactionId}</p>
                <p className="font-bold text-slate-900 text-sm">
                  ${reviewModalTxn.amount.toLocaleString()} {reviewModalTxn.currency}
                </p>
                <p className="text-slate-600">
                  Risk Score: <strong>{reviewModalTxn.riskScore}/100</strong>
                </p>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Supervisory Verdict</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['APPROVE', 'ESCALATE', 'BLOCK'] as const).map((action) => (
                    <button
                      key={action}
                      type="button"
                      onClick={() => setReviewAction(action)}
                      className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                        reviewAction === action
                          ? action === 'APPROVE'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : action === 'BLOCK'
                            ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                            : 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {action}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Supervisory Notes</label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={3}
                  placeholder="Reason for analyst resolution..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {reviewMessage && (
                <div
                  className={`p-2.5 rounded-xl text-xs font-semibold ${
                    reviewMessage.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {reviewMessage.text}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReviewModalTxn(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteReview}
                disabled={submittingReview}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {submittingReview ? 'Recording...' : 'Submit Decision'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slide-over Inspector */}
      <TransactionDetailDrawer
        transaction={selectedTxn}
        isOpen={Boolean(selectedTxn)}
        onClose={() => setSelectedTxn(null)}
      />
    </div>
  );
}
