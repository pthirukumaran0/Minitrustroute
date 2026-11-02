'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card } from '@/src/components/ui/Card';
import { StatusBadge } from '@/src/components/ui/StatusBadge';
import { LoadingSpinner, EmptyState, ErrorState } from '@/src/components/ui/LoadingState';
import { TransactionDetailDrawer } from '@/src/components/transactions/TransactionDetailDrawer';
import { TransactionRecord } from '@/src/types/frontend';
import { useAuth } from '@/src/context/AuthContext';
import {
  ShieldAlert,
  Zap,
  RefreshCw,
  Search,
  Filter,
  Eye,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Clock,
  UserX,
  XCircle,
  Archive,
  FileCheck,
  SearchCode,
  ShieldCheck,
  UserCheck,
  X,
  FileText,
  Ban,
  Layers,
  ChevronDown,
} from 'lucide-react';

export default function AdminFraudLogsPage() {
  const { authFetch, user } = useAuth();
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTxn, setSelectedTxn] = useState<TransactionRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'ACTIVE' | 'PENDING_ADMIN' | 'HIGH_RISK' | 'DISMISSED'>('ACTIVE');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [openActionTxnId, setOpenActionTxnId] = useState<string | null>(null);

  // Investigation Action Modals State
  const [suspendModalTxn, setSuspendModalTxn] = useState<TransactionRecord | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [isSubmittingSuspend, setIsSubmittingSuspend] = useState(false);

  const [rejectModalTxn, setRejectModalTxn] = useState<TransactionRecord | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isSubmittingReject, setIsSubmittingReject] = useState(false);

  const [dismissModalTxn, setDismissModalTxn] = useState<TransactionRecord | null>(null);
  const [dismissReason, setDismissReason] = useState('');
  const [isSubmittingDismiss, setIsSubmittingDismiss] = useState(false);

  const [underReviewModalTxn, setUnderReviewModalTxn] = useState<TransactionRecord | null>(null);
  const [investigationNotes, setInvestigationNotes] = useState('');
  const [isSubmittingUnderReview, setIsSubmittingUnderReview] = useState(false);

  const fetchFraudLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await authFetch('/api/transactions?limit=200');
      if (!res.ok) {
        throw new Error(`Failed to load fraud logs (HTTP ${res.status})`);
      }
      const data = await res.json();
      const allTxns: TransactionRecord[] = data.transactions || [];

      // Filter for all fraud threats, SIM-swap, high risk score, or cases in admin review
      const threats = allTxns.filter(
        (t) =>
          t.riskDecision === 'BLOCKED' ||
          t.riskScore >= 35 ||
          t.signals?.simSwap24h ||
          t.riskFactors?.simSwapWithin24h ||
          t.transferredToAdmin ||
          t.reviewStatus === 'PENDING_ADMIN_REVIEW' ||
          t.reviewStatus === 'UNDER_REVIEW' ||
          t.reviewStatus === 'REJECTED' ||
          t.reviewStatus === 'DISMISSED'
      );
      setTransactions(threats);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchFraudLogs();
  }, [fetchFraudLogs]);

  // Close actions dropdown on outside click
  useEffect(() => {
    const handleClickOutside = () => setOpenActionTxnId(null);
    if (openActionTxnId) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openActionTxnId]);

  // Action A: Suspend User
  const handleConfirmSuspend = async () => {
    if (!suspendModalTxn) return;
    if (!suspendReason.trim()) {
      alert('A valid suspension justification is required for the audit log.');
      return;
    }

    const targetIdentifier = suspendModalTxn.senderEmail || suspendModalTxn.senderId;
    if (!targetIdentifier) {
      alert('Could not determine sender user identifier for this transaction.');
      return;
    }

    try {
      setIsSubmittingSuspend(true);
      const res = await authFetch(`/api/users/${encodeURIComponent(targetIdentifier)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'SUSPENDED',
          reason: suspendReason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || 'Failed to suspend user account');
      }

      setFeedback({
        type: 'success',
        text: `Account associated with '${targetIdentifier}' has been suspended. Access to payment APIs revoked.`,
      });
      setSuspendModalTxn(null);
      setSuspendReason('');
      await fetchFraudLogs();
      setTimeout(() => setFeedback(null), 6000);
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsSubmittingSuspend(false);
    }
  };

  // Action B: Reject Case
  const handleConfirmReject = async () => {
    if (!rejectModalTxn) return;
    if (!rejectReason.trim()) {
      alert('A mandatory rejection reason is required for compliance audit logging.');
      return;
    }

    try {
      setIsSubmittingReject(true);
      const res = await authFetch(`/api/transactions/${rejectModalTxn.transactionId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: rejectReason.trim(),
          notes: rejectReason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || 'Failed to reject case');
      }

      setFeedback({
        type: 'success',
        text: `Case '${rejectModalTxn.transactionId}' marked as REJECTED with compliance reason recorded.`,
      });
      setRejectModalTxn(null);
      setRejectReason('');
      await fetchFraudLogs();
      setTimeout(() => setFeedback(null), 6000);
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsSubmittingReject(false);
    }
  };

  // Action C: Dismiss Case (Safe Removal Workflow)
  const handleConfirmDismiss = async () => {
    if (!dismissModalTxn) return;
    if (!dismissReason.trim()) {
      alert('A mandatory dismissal justification is required (e.g., False Positive verification).');
      return;
    }

    try {
      setIsSubmittingDismiss(true);
      const res = await authFetch(`/api/transactions/${dismissModalTxn.transactionId}/dismiss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: dismissReason.trim(),
          notes: dismissReason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || 'Failed to dismiss case');
      }

      setFeedback({
        type: 'success',
        text: `Case '${dismissModalTxn.transactionId}' safely dismissed and removed from active queue. Historical audit trail preserved.`,
      });
      setDismissModalTxn(null);
      setDismissReason('');
      await fetchFraudLogs();
      setTimeout(() => setFeedback(null), 6000);
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsSubmittingDismiss(false);
    }
  };

  // Action D: Mark Under Review / Add Notes
  const handleConfirmUnderReview = async () => {
    if (!underReviewModalTxn) return;

    try {
      setIsSubmittingUnderReview(true);
      const res = await authFetch(`/api/transactions/${underReviewModalTxn.transactionId}/under-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: investigationNotes.trim() || 'Assigned to active Admin fraud investigation.',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || 'Failed to update investigation status');
      }

      setFeedback({
        type: 'success',
        text: `Case '${underReviewModalTxn.transactionId}' is now UNDER_REVIEW.`,
      });
      setUnderReviewModalTxn(null);
      setInvestigationNotes('');
      await fetchFraudLogs();
      setTimeout(() => setFeedback(null), 5000);
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsSubmittingUnderReview(false);
    }
  };

  // Quick Action: Mark Resolved
  const handleMarkResolved = async (txn: TransactionRecord) => {
    try {
      const res = await authFetch(`/api/transactions/${txn.transactionId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: `Administrative investigation completed and verified by ${user?.name || 'Admin'}.`,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || 'Failed to resolve case');
      }
      setFeedback({
        type: 'success',
        text: `Transaction ${txn.transactionId} marked as RESOLVED.`,
      });
      await fetchFraudLogs();
      setTimeout(() => setFeedback(null), 5000);
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : String(err),
      });
    }
  };

  // Tab Counts
  const tabCounts = useMemo(() => {
    return {
      ACTIVE: transactions.filter((t) => t.reviewStatus !== 'DISMISSED').length,
      PENDING_ADMIN: transactions.filter((t) => t.reviewStatus === 'PENDING_ADMIN_REVIEW' || t.transferredToAdmin).length,
      HIGH_RISK: transactions.filter((t) => t.riskScore >= 70 && t.reviewStatus !== 'DISMISSED').length,
      DISMISSED: transactions.filter((t) => t.reviewStatus === 'DISMISSED').length,
    };
  }, [transactions]);

  // Filtered List
  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      // 1. Tab condition
      if (filterTab === 'ACTIVE' && t.reviewStatus === 'DISMISSED') return false;
      if (filterTab === 'PENDING_ADMIN' && !(t.reviewStatus === 'PENDING_ADMIN_REVIEW' || t.transferredToAdmin)) return false;
      if (filterTab === 'HIGH_RISK' && (t.riskScore < 70 || t.reviewStatus === 'DISMISSED')) return false;
      if (filterTab === 'DISMISSED' && t.reviewStatus !== 'DISMISSED') return false;

      // 2. Search query
      const q = searchQuery.toLowerCase().trim();
      return (
        q === '' ||
        t.transactionId.toLowerCase().includes(q) ||
        (t.senderName && t.senderName.toLowerCase().includes(q)) ||
        (t.senderEmail && t.senderEmail.toLowerCase().includes(q)) ||
        (t.recipientName && t.recipientName.toLowerCase().includes(q)) ||
        t.sourceCountry.toLowerCase().includes(q) ||
        t.destinationCountry.toLowerCase().includes(q)
      );
    });
  }, [transactions, filterTab, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-700 rounded-md">
              Admin Investigation Center
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1 flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 text-rose-600" />
            Fraud Logs & Threat Interception
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Supervisory administrative console to inspect intercepted threats, suspend compromised user accounts, reject cases with audit reasons, or safely dismiss false positives.
          </p>
        </div>

        <button
          onClick={fetchFraudLogs}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between gap-3 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="underline text-xs cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Navigation Tabs */}
        <div className="inline-flex p-1 bg-white border border-slate-200 rounded-xl shadow-2xs gap-1 flex-wrap">
          <button
            onClick={() => setFilterTab('ACTIVE')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
              filterTab === 'ACTIVE'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Active Threats ({tabCounts.ACTIVE})
          </button>
          <button
            onClick={() => setFilterTab('PENDING_ADMIN')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
              filterTab === 'PENDING_ADMIN'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-purple-700 hover:bg-purple-50'
            }`}
          >
            Pending Admin ({tabCounts.PENDING_ADMIN})
          </button>
          <button
            onClick={() => setFilterTab('HIGH_RISK')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
              filterTab === 'HIGH_RISK'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-amber-700 hover:bg-amber-50'
            }`}
          >
            High Risk ({tabCounts.HIGH_RISK})
          </button>
          <button
            onClick={() => setFilterTab('DISMISSED')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
              filterTab === 'DISMISSED'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Dismissed / Archive ({tabCounts.DISMISSED})
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ID, sender email, or corridor..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 shadow-2xs font-medium"
          />
        </div>
      </div>

      {/* Logs Table */}
      {loading ? (
        <LoadingSpinner message="Scanning fraud telemetry and persistent audit records..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchFraudLogs} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={
            filterTab === 'DISMISSED'
              ? 'No Dismissed Incidents'
              : 'No Threat Incidents Match Filter'
          }
          description="All flagged incidents have been addressed or no records match your criteria."
        />
      ) : (
        <Card className="overflow-hidden border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">Transaction ID</th>
                  <th className="px-5 py-3.5">Timestamp</th>
                  <th className="px-5 py-3.5">Sender Account</th>
                  <th className="px-5 py-3.5">Amount</th>
                  <th className="px-5 py-3.5">Risk Score</th>
                  <th className="px-5 py-3.5">Triggered Threat</th>
                  <th className="px-5 py-3.5">Case Status</th>
                  <th className="px-5 py-3.5 text-right">Investigation Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filtered.map((txn) => {
                  const simSwapped = txn.signals?.simSwap24h || txn.riskFactors?.simSwapWithin24h;
                  const highVelocity = txn.riskFactors?.velocityPerHour && txn.riskFactors.velocityPerHour > 5;
                  const isTransferred = txn.transferredToAdmin || txn.reviewStatus === 'PENDING_ADMIN_REVIEW';
                  const isUnderReview = txn.reviewStatus === 'UNDER_REVIEW';
                  const isRejected = txn.reviewStatus === 'REJECTED';
                  const isDismissed = txn.reviewStatus === 'DISMISSED';
                  const isResolved = txn.reviewStatus === 'RESOLVED' || txn.reviewStatus === 'VERIFIED_APPROVED';

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
                        <p className="font-bold text-slate-800">{txn.senderName || 'Sender'}</p>
                        <p className="text-[11px] text-slate-400 font-mono truncate max-w-[170px]">
                          {txn.senderEmail || 'N/A'}
                        </p>
                      </td>

                      <td className="px-5 py-4 font-bold text-slate-900 whitespace-nowrap">
                        {txn.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {txn.currency}
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

                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-0.5">
                          {simSwapped && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                              <Zap className="w-3 h-3 text-rose-600" />
                              CAMARA SIM-Swap 24h
                            </span>
                          )}
                          {highVelocity && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">
                              <Flame className="w-3 h-3 text-amber-600" />
                              Velocity Spike
                            </span>
                          )}
                          {!simSwapped && !highVelocity && (
                            <span className="text-[11px] text-slate-500">
                              {txn.contributingFactors?.[0] || 'Heuristic Anomaly'}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        {isDismissed ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                            <Archive className="w-3 h-3 text-purple-600" />
                            Dismissed (False Positive)
                          </span>
                        ) : isRejected ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                            <XCircle className="w-3 h-3 text-red-600" />
                            Rejected
                          </span>
                        ) : isResolved ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Resolved
                          </span>
                        ) : isUnderReview ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-600" />
                            Under Review
                          </span>
                        ) : isTransferred ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            <Clock className="w-3 h-3 text-purple-600" />
                            Pending Admin Review
                          </span>
                        ) : (
                          <StatusBadge status={txn.riskDecision} />
                        )}
                      </td>

                      {/* Admin Investigation Actions Dropdown */}
                      <td className="px-5 py-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="relative inline-block text-left">
                          <button
                            type="button"
                            onClick={() => setOpenActionTxnId(openActionTxnId === txn.transactionId ? null : txn.transactionId)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-2xs cursor-pointer"
                          >
                            <span>Actions</span>
                            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${openActionTxnId === txn.transactionId ? 'rotate-180' : ''}`} />
                          </button>

                          {openActionTxnId === txn.transactionId && (
                            <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-xl py-1 z-30 divide-y divide-slate-100">
                              <div className="py-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedTxn(txn);
                                    setOpenActionTxnId(null);
                                  }}
                                  className="w-full text-left px-3.5 py-1.5 text-xs text-slate-700 hover:bg-purple-50 hover:text-purple-700 flex items-center gap-2 cursor-pointer font-medium"
                                >
                                  <Eye className="w-3.5 h-3.5 text-purple-600" />
                                  <span>View Details</span>
                                </button>

                                {!isUnderReview && !isResolved && !isDismissed && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setUnderReviewModalTxn(txn);
                                      setInvestigationNotes('');
                                      setOpenActionTxnId(null);
                                    }}
                                    className="w-full text-left px-3.5 py-1.5 text-xs text-amber-700 hover:bg-amber-50 flex items-center gap-2 cursor-pointer font-medium"
                                  >
                                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                                    <span>Mark Under Review</span>
                                  </button>
                                )}

                                {!isResolved && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleMarkResolved(txn);
                                      setOpenActionTxnId(null);
                                    }}
                                    className="w-full text-left px-3.5 py-1.5 text-xs text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 cursor-pointer font-medium"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Mark Resolved</span>
                                  </button>
                                )}
                              </div>

                              <div className="py-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSuspendModalTxn(txn);
                                    setSuspendReason(`Suspicious financial velocity / unauthorized SIM-swap detected on transaction ${txn.transactionId}.`);
                                    setOpenActionTxnId(null);
                                  }}
                                  className="w-full text-left px-3.5 py-1.5 text-xs text-rose-700 hover:bg-rose-50 flex items-center gap-2 cursor-pointer font-medium"
                                >
                                  <UserX className="w-3.5 h-3.5 text-rose-600" />
                                  <span>Suspend User</span>
                                </button>

                                {!isRejected && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRejectModalTxn(txn);
                                      setRejectReason(`Confirmed fraudulent pattern: SIM swap within 24h on ${txn.transactionId}.`);
                                      setOpenActionTxnId(null);
                                    }}
                                    className="w-full text-left px-3.5 py-1.5 text-xs text-red-700 hover:bg-red-50 flex items-center gap-2 cursor-pointer font-medium"
                                  >
                                    <XCircle className="w-3.5 h-3.5 text-red-600" />
                                    <span>Reject Case</span>
                                  </button>
                                )}

                                {!isDismissed && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDismissModalTxn(txn);
                                      setDismissReason('Verified customer business travel / legitimate device migration. Flagged as False Positive.');
                                      setOpenActionTxnId(null);
                                    }}
                                    className="w-full text-left px-3.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2 cursor-pointer font-medium"
                                  >
                                    <Archive className="w-3.5 h-3.5 text-slate-600" />
                                    <span>Dismiss Case</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
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

      {/* Modal A: Suspend User Confirmation */}
      {suspendModalTxn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                  <UserX className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Suspend User Account</h3>
              </div>
              <button
                onClick={() => setSuspendModalTxn(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1">
              <p className="font-bold">Caution: Severe Account Restriction</p>
              <p>
                Suspending this user will immediately revoke their active sessions and prevent them from initiating any further payment transfers across all channels.
              </p>
            </div>

            <div className="space-y-2 bg-slate-50 p-3 rounded-xl text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">User Email:</span>
                <strong className="text-slate-900 font-mono">{suspendModalTxn.senderEmail}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Associated Txn:</span>
                <strong className="text-slate-900 font-mono">{suspendModalTxn.transactionId}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Incident Score:</span>
                <strong className="text-rose-600 font-bold">{suspendModalTxn.riskScore}/100</strong>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Suspension Justification <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="Specify regulatory violation, unauthorized device access, or compromise rationale..."
                className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSuspendModalTxn(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingSuspend}
                onClick={handleConfirmSuspend}
                className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isSubmittingSuspend ? 'Suspending...' : 'Confirm Account Suspension'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal B: Reject Case Confirmation */}
      {rejectModalTxn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-bold">
                  <XCircle className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Reject Fraud Case</h3>
              </div>
              <button
                onClick={() => setRejectModalTxn(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Mark transaction <strong className="font-mono text-slate-800">{rejectModalTxn.transactionId}</strong> as rejected. The original payment record and risk evaluation are preserved for compliance logs.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Mandatory Rejection Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Document fraudulent patterns, SIM-swap compromise, or carrier mismatch..."
                className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRejectModalTxn(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingReject}
                onClick={handleConfirmReject}
                className="px-4 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isSubmittingReject ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal C: Dismiss Case Confirmation (Safe Removal) */}
      {dismissModalTxn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
                  <Archive className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Dismiss Incident (False Positive)</h3>
              </div>
              <button
                onClick={() => setDismissModalTxn(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-900">
              <strong>Safe Removal Workflow:</strong> This case will be archived and removed from the active operational queue, but will remain permanently accessible in historical compliance archives. No data is permanently deleted.
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Dismissal / False Positive Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={dismissReason}
                onChange={(e) => setDismissReason(e.target.value)}
                placeholder="Explain why this threat alert was verified as legitimate customer activity..."
                className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDismissModalTxn(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingDismiss}
                onClick={handleConfirmDismiss}
                className="px-4 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isSubmittingDismiss ? 'Archiving...' : 'Dismiss & Archive Case'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal D: Investigation Notes / Under Review */}
      {underReviewModalTxn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <Clock className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Mark Under Active Investigation</h3>
              </div>
              <button
                onClick={() => setUnderReviewModalTxn(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Case <strong className="font-mono text-slate-800">{underReviewModalTxn.transactionId}</strong> will be assigned status <strong>UNDER_REVIEW</strong>.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Investigation Notes</label>
              <textarea
                rows={3}
                value={investigationNotes}
                onChange={(e) => setInvestigationNotes(e.target.value)}
                placeholder="Record initial findings, subpoena checks, or carrier correspondence..."
                className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setUnderReviewModalTxn(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingUnderReview}
                onClick={handleConfirmUnderReview}
                className="px-4 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isSubmittingUnderReview ? 'Saving...' : 'Set Under Review'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Details Drawer */}
      <TransactionDetailDrawer
        transaction={selectedTxn}
        isOpen={Boolean(selectedTxn)}
        onClose={() => setSelectedTxn(null)}
      />
    </div>
  );
}
