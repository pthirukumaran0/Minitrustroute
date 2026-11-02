'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Card } from '@/src/components/ui/Card';
import { LoadingSpinner, EmptyState, ErrorState } from '@/src/components/ui/LoadingState';
import { TransactionDetailDrawer } from '@/src/components/transactions/TransactionDetailDrawer';
import { TransactionRecord } from '@/src/types/frontend';
import { useAuth } from '@/src/context/AuthContext';
import {
  ShieldAlert,
  Clock,
  Filter,
  RefreshCw,
  Eye,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Zap,
  Ban,
  Search,
  Check,
  ChevronDown,
  Layers,
  Inbox,
  UserCheck,
  AlertCircle,
  FileCheck,
} from 'lucide-react';

export type ReviewQueueStatus =
  | 'ALL'
  | 'PENDING_REVIEW'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'BLOCKED'
  | 'RESOLVED'
  | 'DISMISSED';

interface StatusOption {
  key: ReviewQueueStatus;
  label: string;
  colorType: 'green' | 'amber' | 'red' | 'purple' | 'slate';
  description: string;
}

const STATUS_OPTIONS: StatusOption[] = [
  { key: 'ALL', label: 'All Cases', colorType: 'slate', description: 'All active ledger transactions' },
  { key: 'PENDING_REVIEW', label: 'Pending Review', colorType: 'amber', description: 'Requires immediate supervisor or analyst review' },
  { key: 'UNDER_REVIEW', label: 'Under Review', colorType: 'amber', description: 'Under active fraud analyst investigation' },
  { key: 'APPROVED', label: 'Approved', colorType: 'green', description: 'Risk cleared or verified via step-up carrier auth' },
  { key: 'REJECTED', label: 'Rejected', colorType: 'red', description: 'Manually rejected with audit justification' },
  { key: 'BLOCKED', label: 'Blocked', colorType: 'red', description: 'Deterministic policy or SIM-swap block' },
  { key: 'RESOLVED', label: 'Resolved', colorType: 'green', description: 'Supervisory investigation finalized' },
  { key: 'DISMISSED', label: 'Dismissed', colorType: 'purple', description: 'Marked false positive and archived' },
];

export default function ReviewQueuePage() {
  const { authFetch } = useAuth();
  const [queueItems, setQueueItems] = useState<TransactionRecord[]>([]);
  const [allTransactions, setAllTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ReviewQueueStatus>('PENDING_REVIEW');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Inspector & Review Modal
  const [selectedTxn, setSelectedTxn] = useState<TransactionRecord | null>(null);
  const [reviewModalTxn, setReviewModalTxn] = useState<TransactionRecord | null>(null);
  const [reviewDecision, setReviewDecision] = useState<'APPROVED' | 'ESCALATED' | 'BLOCKED' | 'REJECT' | 'RESOLVED'>('APPROVED');
  const [reviewNotes, setReviewNotes] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [queueRes, allRes] = await Promise.all([
        authFetch('/api/transactions/review-queue?limit=150'),
        authFetch('/api/transactions?limit=250'),
      ]);

      if (!queueRes.ok || !allRes.ok) {
        throw new Error('Failed to load review queue transactions from MongoDB');
      }

      const queueData = await queueRes.json();
      const allData = await allRes.json();

      setQueueItems(queueData.queue || queueData.transactions || []);
      setAllTransactions(allData.transactions || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // Deduplicated combined records
  const combinedList = useMemo(() => {
    const map = new Map<string, TransactionRecord>();
    queueItems.forEach((t) => map.set(t.transactionId, t));
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
  }, [queueItems, allTransactions]);

  const handleOpenReview = (txn: TransactionRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setReviewModalTxn(txn);
    const simSwapped = txn.signals?.simSwap24h || txn.riskFactors?.simSwapWithin24h;
    setReviewDecision(simSwapped ? 'BLOCKED' : 'APPROVED');
    setReviewNotes('');
  };

  const handleSubmitReview = async () => {
    if (!reviewModalTxn) return;
    const simSwapped = reviewModalTxn.signals?.simSwap24h || reviewModalTxn.riskFactors?.simSwapWithin24h;
    if (simSwapped && reviewDecision === 'APPROVED') {
      alert('Mandatory Security Rule: Transactions flagged with SIM-swap within 24h cannot be approved.');
      return;
    }

    try {
      setSubmittingReview(true);
      const res = await authFetch(`/api/transactions/${reviewModalTxn.transactionId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: reviewDecision,
          reason: reviewNotes || `Supervisory resolution: ${reviewDecision}`,
          notes: reviewNotes || `Supervisory resolution: ${reviewDecision}`,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || 'Failed to submit supervisory decision');
      }

      setActionSuccessMsg(`Transaction ${reviewModalTxn.transactionId} updated to ${reviewDecision}`);
      setReviewModalTxn(null);
      await fetchQueue();
      setTimeout(() => setActionSuccessMsg(null), 4000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmittingReview(false);
    }
  };

  // Helper to categorize case status accurately
  const getCaseReviewCategory = (t: TransactionRecord): ReviewQueueStatus => {
    const rStatus = (t.reviewStatus || '').toUpperCase();
    if (rStatus === 'DISMISSED') return 'DISMISSED';
    if (rStatus === 'REJECTED') return 'REJECTED';
    if (rStatus === 'RESOLVED') return 'RESOLVED';
    if (rStatus === 'UNDER_REVIEW') return 'UNDER_REVIEW';
    if (rStatus === 'VERIFIED_APPROVED' || t.riskDecision === 'APPROVED' || t.status === 'APPROVED') {
      return 'APPROVED';
    }
    if (rStatus === 'BLOCKED' || t.riskDecision === 'BLOCKED' || t.status === 'BLOCKED') {
      return 'BLOCKED';
    }
    return 'PENDING_REVIEW';
  };

  // Live Accurate Counts
  const counts = useMemo(() => {
    const res: Record<ReviewQueueStatus, number> = {
      ALL: combinedList.filter((t) => t.reviewStatus !== 'DISMISSED').length,
      PENDING_REVIEW: 0,
      UNDER_REVIEW: 0,
      APPROVED: 0,
      REJECTED: 0,
      BLOCKED: 0,
      RESOLVED: 0,
      DISMISSED: 0,
    };

    for (const t of combinedList) {
      const cat = getCaseReviewCategory(t);
      res[cat] = (res[cat] || 0) + 1;
    }
    return res;
  }, [combinedList]);

  // Filtered List
  const filtered = useMemo(() => {
    return combinedList.filter((t) => {
      // 1. Text Search by Transaction ID / Case ID / Names / Countries
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        q === '' ||
        t.transactionId.toLowerCase().includes(q) ||
        (t.senderName && t.senderName.toLowerCase().includes(q)) ||
        (t.senderEmail && t.senderEmail.toLowerCase().includes(q)) ||
        (t.recipientName && t.recipientName.toLowerCase().includes(q)) ||
        t.sourceCountry.toLowerCase().includes(q) ||
        t.destinationCountry.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      // 2. Status Selection Filter
      if (statusFilter === 'ALL') {
        return t.reviewStatus !== 'DISMISSED';
      }

      const cat = getCaseReviewCategory(t);
      return cat === statusFilter;
    });
  }, [combinedList, searchQuery, statusFilter]);

  const activeOption = STATUS_OPTIONS.find((o) => o.key === statusFilter) || STATUS_OPTIONS[0];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 rounded-md">
              Operations
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1 flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 text-purple-600" />
            Review Queue
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time queue of transactions requiring compliance inspection, carrier credential validation, and supervisory sign-off.
          </p>
        </div>

        <button
          onClick={fetchQueue}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {actionSuccessMsg && (
        <div className="p-3.5 rounded-xl text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* Status Selection and Search Bar (Sole Dropdown Selection Interaction) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Custom Status Selection Dropdown Menu */}
        <div className="flex items-center gap-2.5">
          <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5 shrink-0">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            Queue Status:
          </label>

          <div className="relative">
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="inline-flex items-center justify-between gap-3 px-3.5 py-2 text-xs font-bold bg-white border border-slate-200 rounded-xl hover:border-slate-300 shadow-2xs cursor-pointer min-w-[220px] transition-all"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    activeOption.colorType === 'green'
                      ? 'bg-emerald-500 ring-2 ring-emerald-100'
                      : activeOption.colorType === 'amber'
                      ? 'bg-amber-500 ring-2 ring-amber-100'
                      : activeOption.colorType === 'red'
                      ? 'bg-rose-500 ring-2 ring-rose-100'
                      : activeOption.colorType === 'purple'
                      ? 'bg-purple-500 ring-2 ring-purple-100'
                      : 'bg-slate-500 ring-2 ring-slate-100'
                  }`}
                />
                <span className="text-slate-900">{activeOption.label}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-[10px] font-bold text-slate-700">
                  {counts[activeOption.key]}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </div>
            </button>

            {dropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                <div className="absolute left-0 mt-1.5 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="px-2.5 py-1.5 border-b border-slate-100">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Select Queue Status Filter
                    </p>
                  </div>
                  <div className="py-1 space-y-0.5">
                    {STATUS_OPTIONS.map((opt) => {
                      const isSelected = statusFilter === opt.key;
                      const count = counts[opt.key];
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => {
                            setStatusFilter(opt.key);
                            setDropdownOpen(false);
                          }}
                          className={`w-full text-left px-2.5 py-2 rounded-xl text-xs flex items-center justify-between cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-purple-50 text-purple-900 font-bold'
                              : 'text-slate-700 hover:bg-slate-50 font-medium'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                opt.colorType === 'green'
                                  ? 'bg-emerald-500'
                                  : opt.colorType === 'amber'
                                  ? 'bg-amber-500'
                                  : opt.colorType === 'red'
                                  ? 'bg-rose-500'
                                  : opt.colorType === 'purple'
                                  ? 'bg-purple-500'
                                  : 'bg-slate-500'
                              }`}
                            />
                            <div>
                              <span>{opt.label}</span>
                              <p className="text-[10px] text-slate-400 font-normal">{opt.description}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                                isSelected ? 'bg-purple-200/60 text-purple-800' : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {count}
                            </span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-purple-600" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Search by Transaction ID / Case ID */}
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by Transaction ID / Case ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-2xs font-medium"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <LoadingSpinner message="Querying urgent review queue from MongoDB..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchQueue} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={`No ${activeOption.label} Records Found`}
          description={`No transactions currently match '${activeOption.label}' status filter or search parameters.`}
        />
      ) : (
        <Card className="overflow-hidden border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">Transaction ID</th>
                  <th className="px-5 py-3.5">Timestamp</th>
                  <th className="px-5 py-3.5">Sender / Recipient</th>
                  <th className="px-5 py-3.5">Amount</th>
                  <th className="px-5 py-3.5">Corridor</th>
                  <th className="px-5 py-3.5">Risk Score</th>
                  <th className="px-5 py-3.5">Transaction Decision</th>
                  <th className="px-5 py-3.5">Review / Case Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filtered.map((txn) => {
                  const simSwapped = txn.signals?.simSwap24h || txn.riskFactors?.simSwapWithin24h;
                  const normDecision = (txn.riskDecision || txn.status || '').toUpperCase();
                  const caseStatus = getCaseReviewCategory(txn);

                  return (
                    <tr
                      key={txn.transactionId}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                      onClick={() => setSelectedTxn(txn)}
                    >
                      <td className="px-5 py-4 font-mono font-bold text-purple-600">
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
                        <p className="text-[11px] text-slate-500">{txn.recipientName || 'Beneficiary'}</p>
                      </td>
                      <td className="px-5 py-4 font-bold text-slate-900 whitespace-nowrap">
                        {txn.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {txn.currency}
                      </td>
                      <td className="px-5 py-4 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                        {txn.sourceCountry} → {txn.destinationCountry}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            txn.riskScore >= 70
                              ? 'bg-rose-100 text-rose-800'
                              : txn.riskScore >= 35
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {txn.riskScore} / 100
                        </span>
                      </td>

                      {/* Transaction Decision */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        {normDecision === 'APPROVED' || txn.status === 'APPROVED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            APPROVED
                          </span>
                        ) : normDecision === 'BLOCKED' || txn.status === 'BLOCKED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <Ban className="w-3 h-3 text-rose-600" />
                            BLOCKED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            STEP-UP
                          </span>
                        )}
                      </td>

                      {/* Consistent Review / Case Status Indicator */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        {caseStatus === 'APPROVED' || caseStatus === 'RESOLVED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                            {caseStatus === 'RESOLVED' ? 'Resolved' : 'Approved'}
                          </span>
                        ) : caseStatus === 'PENDING_REVIEW' || caseStatus === 'UNDER_REVIEW' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            <Clock className="w-3 h-3 text-amber-700" />
                            {caseStatus === 'UNDER_REVIEW' ? 'Under Review' : 'Pending Review'}
                          </span>
                        ) : caseStatus === 'REJECTED' || caseStatus === 'BLOCKED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                            <XCircle className="w-3 h-3 text-rose-700" />
                            {caseStatus === 'REJECTED' ? 'Rejected' : 'Blocked'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300">
                            <ShieldCheck className="w-3 h-3 text-purple-700" />
                            Dismissed
                          </span>
                        )}
                      </td>

                      {/* Action buttons */}
                      <td className="px-5 py-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={(e) => handleOpenReview(txn, e)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-2xs transition-colors cursor-pointer"
                          >
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span>Review</span>
                          </button>
                          <button
                            onClick={() => setSelectedTxn(txn)}
                            className="p-1.5 text-slate-500 hover:text-purple-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Inspect Details"
                          >
                            <Eye className="w-4 h-4" />
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

      {/* Review & Supervisory Decision Modal */}
      {reviewModalTxn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-purple-600" />
                Supervisory Decision
              </h3>
              <button
                onClick={() => setReviewModalTxn(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 bg-slate-50 p-3.5 rounded-xl text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Transaction ID:</span>
                <strong className="font-mono text-slate-800">{reviewModalTxn.transactionId}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Sender:</span>
                <strong className="text-slate-800">{reviewModalTxn.senderName}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount:</span>
                <strong className="text-slate-800">
                  {reviewModalTxn.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {reviewModalTxn.currency}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Deterministic Risk Score:</span>
                <span className="font-bold text-rose-600">{reviewModalTxn.riskScore} / 100</span>
              </div>
            </div>

            {/* Mandatory Policy Warning if SIM-swapped */}
            {(reviewModalTxn.signals?.simSwap24h || reviewModalTxn.riskFactors?.simSwapWithin24h) && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Mandatory Policy Warning:</strong> This transaction triggered a CAMARA SIM-swap alert within 24 hours. Under security regulations, this case cannot be approved.
                </div>
              </div>
            )}

            {/* Decision Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Select Resolution Decision</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={Boolean(reviewModalTxn.signals?.simSwap24h || reviewModalTxn.riskFactors?.simSwapWithin24h)}
                  onClick={() => setReviewDecision('APPROVED')}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                    reviewDecision === 'APPROVED'
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-800 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Approve</span>
                </button>

                <button
                  type="button"
                  onClick={() => setReviewDecision('BLOCKED')}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                    reviewDecision === 'BLOCKED'
                      ? 'bg-rose-50 border-rose-400 text-rose-800 ring-2 ring-rose-500/20'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Ban className="w-4 h-4 text-rose-600" />
                  <span>Block</span>
                </button>

                <button
                  type="button"
                  onClick={() => setReviewDecision('REJECT')}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                    reviewDecision === 'REJECT'
                      ? 'bg-red-50 border-red-400 text-red-800 ring-2 ring-red-500/20'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <XCircle className="w-4 h-4 text-red-600" />
                  <span>Reject Case</span>
                </button>

                <button
                  type="button"
                  onClick={() => setReviewDecision('RESOLVED')}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                    reviewDecision === 'RESOLVED'
                      ? 'bg-indigo-50 border-indigo-400 text-indigo-800 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <FileCheck className="w-4 h-4 text-indigo-600" />
                  <span>Resolve</span>
                </button>
              </div>
            </div>

            {/* Supervisory Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Investigation & Compliance Justification <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Document supervisory findings and rationale for persistent audit trail..."
                className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setReviewModalTxn(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingReview}
                onClick={handleSubmitReview}
                className="px-4 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
              >
                {submittingReview ? 'Recording...' : 'Submit Resolution'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      <TransactionDetailDrawer
        transaction={selectedTxn}
        isOpen={Boolean(selectedTxn)}
        onClose={() => setSelectedTxn(null)}
      />
    </div>
  );
}
