'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Card, StatCard } from '@/src/components/ui/Card';
import { StatusBadge } from '@/src/components/ui/StatusBadge';
import { LoadingState } from '@/src/components/ui/LoadingState';
import { ErrorState } from '@/src/components/ui/ErrorState';
import { TransactionDetailDrawer } from '@/src/components/transactions/TransactionDetailDrawer';
import { TransactionRecord } from '@/src/types/frontend';
import { useAuth } from '@/src/context/AuthContext';
import {
  ShieldAlert,
  AlertTriangle,
  Smartphone,
  PhoneCall,
  HardDrive,
  TrendingDown,
  Info,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Lock,
  ArrowRight,
  Send,
  Eye,
  Clock,
  Check,
  X,
  FileText,
} from 'lucide-react';

export default function RiskAnalysisPage() {
  const { authFetch, user } = useAuth();
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTxn, setSelectedTxn] = useState<TransactionRecord | null>(null);
  const [filterType, setFilterType] = useState<'ALL_RISK' | 'SIM_SWAP' | 'SUSPICIOUS_DEVICE' | 'UNVERIFIED'>('ALL_RISK');

  // Transfer to Admin modal state
  const [transferModalTxn, setTransferModalTxn] = useState<TransactionRecord | null>(null);
  const [transferNotes, setTransferNotes] = useState('');
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchRiskData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await authFetch('/api/transactions?limit=150');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to load risk data');

      setTransactions(data.transactions || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchRiskData();
  }, [fetchRiskData]);

  // Handle Transfer to Admin execution
  const handleConfirmTransfer = async () => {
    if (!transferModalTxn) return;

    try {
      setIsSubmittingTransfer(true);
      const res = await authFetch(`/api/transactions/${transferModalTxn.transactionId}/transfer-to-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: transferNotes.trim() || `Transferred by Analyst ${user?.name || user?.email || ''} for supervisory Admin review.`,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || 'Failed to transfer case to Admin');
      }

      // Optimistically update transaction in local state
      setTransactions((prev) =>
        prev.map((t) =>
          t.transactionId === transferModalTxn.transactionId
            ? {
                ...t,
                transferredToAdmin: true,
                reviewStatus: 'PENDING_ADMIN_REVIEW',
                transferNotes: transferNotes.trim(),
                transferredAt: new Date().toISOString(),
                transferredBy: user?.email || 'analyst@trustroute.com',
              }
            : t
        )
      );

      setFeedback({
        type: 'success',
        text: `Case '${transferModalTxn.transactionId}' successfully transferred to Admin Review Queue and Fraud Logs.`,
      });
      setTransferModalTxn(null);
      setTransferNotes('');
      setTimeout(() => setFeedback(null), 6000);
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsSubmittingTransfer(false);
    }
  };

  // Compute metrics from real transaction data
  const blockedTxns = transactions.filter((t) => t.riskDecision === 'BLOCKED');
  const stepUpTxns = transactions.filter((t) => t.riskDecision === 'STEP_UP' || t.status === 'STEP_UP_REQUIRED');
  const simSwapTxns = transactions.filter((t) => t.signals?.simSwap24h || t.riskFactors?.simSwapWithin24h);
  const unverifiedTxns = transactions.filter((t) => t.signals?.numberVerified === false);
  const suspiciousDeviceTxns = transactions.filter(
    (t) => t.signals?.deviceStatus === 'SUSPICIOUS' || t.signals?.deviceStatus === 'UNKNOWN'
  );

  // Active filter
  const displayedTxns = transactions.filter((t) => {
    if (filterType === 'SIM_SWAP') return t.signals?.simSwap24h || t.riskFactors?.simSwapWithin24h;
    if (filterType === 'SUSPICIOUS_DEVICE') return t.signals?.deviceStatus === 'SUSPICIOUS';
    if (filterType === 'UNVERIFIED') return t.signals?.numberVerified === false;
    return t.riskDecision !== 'APPROVED' || t.riskScore >= 35 || t.transferredToAdmin;
  });

  if (loading && transactions.length === 0) {
    return <LoadingState message="Analyzing transaction fraud telemetry..." rows={6} />;
  }

  if (error && transactions.length === 0) {
    return <ErrorState message={error} onRetry={fetchRiskData} />;
  }

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-700 rounded-md">
              Analyst Operations
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2 mt-1">
            <ShieldAlert className="w-6 h-6 text-rose-600" />
            Fraud Monitoring & Risk Analytics
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Deterministic rule-based anomaly detection evaluating telecom carriers, hardware fingerprints, and transaction velocity.
          </p>
        </div>
        <button
          onClick={fetchRiskData}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors shadow-2xs cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Feedback Alert */}
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

      {/* 2. Mandatory Rules Callout */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-xs space-y-2 text-slate-300 shadow-sm">
        <div className="flex items-center justify-between text-white font-bold">
          <span className="flex items-center gap-2 text-rose-400">
            <ShieldAlert className="w-4 h-4" />
            Mandatory Risk Enforcement Policy
          </span>
          <span className="text-[10px] font-mono bg-slate-800 px-2 py-0.5 rounded text-slate-400">
            Deterministic Rule Engine
          </span>
        </div>
        <p className="text-slate-300 leading-relaxed">
          1. <strong>Mandatory 24h SIM Swap Rule:</strong> Any transaction accompanied by a mobile SIM swap in the last 24h is unconditionally rejected as <strong>BLOCKED</strong> with zero route assigned to prevent OTP-interception account takeover.
        </p>
        <p className="text-slate-300 leading-relaxed">
          2. <strong>Supervisory Escalation:</strong> Analysts can escalate confirmed threats or ambiguous cross-border transactions to <strong>Admin Review</strong> using the <em>Transfer to Admin</em> action.
        </p>
      </div>

      {/* 3. Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Blocked Threats"
          value={blockedTxns.length}
          subtitle="Transactions denied routing"
          color="rose"
          icon={<ShieldAlert className="w-5 h-5 text-rose-600" />}
          onClick={() => setFilterType('ALL_RISK')}
        />
        <StatCard
          title="SIM Swap Alerts"
          value={simSwapTxns.length}
          subtitle="Active 24h SIM swap detected"
          color="rose"
          icon={<Smartphone className="w-5 h-5 text-rose-600" />}
          onClick={() => setFilterType('SIM_SWAP')}
        />
        <StatCard
          title="Unverified Numbers"
          value={unverifiedTxns.length}
          subtitle="Telco carrier identity mismatch"
          color="amber"
          icon={<PhoneCall className="w-5 h-5 text-amber-600" />}
          onClick={() => setFilterType('UNVERIFIED')}
        />
        <StatCard
          title="Suspicious Devices"
          value={suspiciousDeviceTxns.length}
          subtitle="Rooted / Emulator fingerprints"
          color="amber"
          icon={<HardDrive className="w-5 h-5 text-amber-600" />}
          onClick={() => setFilterType('SUSPICIOUS_DEVICE')}
        />
      </div>

      {/* 4. Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setFilterType('ALL_RISK')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            filterType === 'ALL_RISK'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          All Elevated Risk ({blockedTxns.length + stepUpTxns.length})
        </button>
        <button
          onClick={() => setFilterType('SIM_SWAP')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            filterType === 'SIM_SWAP'
              ? 'bg-rose-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          SIM Swap Attacks ({simSwapTxns.length})
        </button>
        <button
          onClick={() => setFilterType('UNVERIFIED')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            filterType === 'UNVERIFIED'
              ? 'bg-amber-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Unverified Phone ({unverifiedTxns.length})
        </button>
        <button
          onClick={() => setFilterType('SUSPICIOUS_DEVICE')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            filterType === 'SUSPICIOUS_DEVICE'
              ? 'bg-amber-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Suspicious Devices ({suspiciousDeviceTxns.length})
        </button>
      </div>

      {/* 5. Filtered Risk Ledger Table */}
      <Card className="overflow-hidden border-slate-200 bg-white">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Flagged Transactions Queue
            </h2>
            <p className="text-xs text-slate-500">
              Transactions requiring intervention, authentication, or supervisory administrative transfer.
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-400">
            {displayedTxns.length} records matching category
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider border-b border-slate-200 font-semibold">
              <tr>
                <th className="px-5 py-3.5">Transaction ID</th>
                <th className="px-5 py-3.5">Amount</th>
                <th className="px-5 py-3.5">Risk Score</th>
                <th className="px-5 py-3.5">Verdict</th>
                <th className="px-5 py-3.5">SIM Swap (24h)</th>
                <th className="px-5 py-3.5">Device</th>
                <th className="px-5 py-3.5">Primary Factor</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {displayedTxns.length > 0 ? (
                displayedTxns.map((txn) => {
                  const isTransferred =
                    txn.transferredToAdmin || txn.reviewStatus === 'PENDING_ADMIN_REVIEW';
                  const isResolved =
                    txn.reviewStatus === 'RESOLVED' || txn.reviewStatus === 'VERIFIED_APPROVED';
                  const isEligible =
                    !isTransferred &&
                    !isResolved &&
                    (txn.riskDecision === 'BLOCKED' ||
                      txn.riskDecision === 'STEP_UP' ||
                      txn.status === 'STEP_UP_REQUIRED' ||
                      txn.riskScore >= 35 ||
                      txn.signals?.simSwap24h);

                  return (
                    <tr
                      key={txn.transactionId}
                      onClick={() => setSelectedTxn(txn)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-3.5 font-mono font-bold text-blue-600">
                        {txn.transactionId}
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-slate-900 whitespace-nowrap">
                        {txn.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {txn.currency}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className="font-mono font-bold text-rose-600">
                          {txn.riskScore}
                        </span>
                        <span className="text-slate-400">/100</span>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <StatusBadge status={txn.riskDecision} />
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {txn.signals?.simSwap24h || txn.riskFactors?.simSwapWithin24h ? (
                          <span className="text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                            DETECTED
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Clear</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                        {txn.signals?.deviceStatus || 'STANDARD'}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 truncate max-w-xs">
                        {txn.contributingFactors?.[1] || txn.contributingFactors?.[0] || 'Risk evaluated'}
                      </td>

                      {/* Actions Column with Transfer to Admin */}
                      <td className="px-5 py-3.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {isTransferred ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200 rounded-lg">
                              <Clock className="w-3 h-3 text-purple-600" />
                              Transferred to Admin
                            </span>
                          ) : isResolved ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Resolved
                            </span>
                          ) : isEligible ? (
                            <button
                              type="button"
                              onClick={() => {
                                setTransferModalTxn(txn);
                                setTransferNotes(
                                  `Flagged risk anomaly (Score: ${txn.riskScore}/100, Verdict: ${txn.riskDecision}). Requesting Admin review.`
                                );
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
                              title="Transfer case to Administrator supervisory review"
                            >
                              <Send className="w-3 h-3 text-purple-600" />
                              <span>Transfer to Admin</span>
                            </button>
                          ) : (
                            <span
                              className="text-[10px] text-slate-400 italic px-2 py-1"
                              title="Transaction risk is low/normal; not eligible for administrative escalation"
                            >
                              Not Eligible
                            </span>
                          )}

                          <button
                            onClick={() => setSelectedTxn(txn)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Inspect Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-slate-400">
                    No transactions match the selected risk category.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Transfer to Admin Confirmation Modal */}
      {transferModalTxn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <Send className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Transfer Case to Admin</h3>
              </div>
              <button
                onClick={() => setTransferModalTxn(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Transfer transaction <strong className="font-mono text-purple-700">{transferModalTxn.transactionId}</strong> to the Administrator supervisory review queue. The case evidence, risk metrics, and audit history will be permanently preserved and escalated.
            </p>

            <div className="space-y-2 bg-slate-50 p-3 rounded-xl text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Transaction ID:</span>
                <strong className="font-mono text-slate-900">{transferModalTxn.transactionId}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount:</span>
                <strong className="text-slate-900">
                  {transferModalTxn.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {transferModalTxn.currency}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Risk Score & Decision:</span>
                <strong className="text-rose-600 font-bold">
                  {transferModalTxn.riskScore}/100 ({transferModalTxn.riskDecision})
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Sender Account:</span>
                <strong className="font-mono text-slate-800">{transferModalTxn.senderEmail || transferModalTxn.senderId || 'N/A'}</strong>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Analyst Transfer Justification / Supervisory Notes
              </label>
              <textarea
                rows={3}
                value={transferNotes}
                onChange={(e) => setTransferNotes(e.target.value)}
                placeholder="Explain the specific anomaly, device mismatch, or reason for administrative escalation..."
                className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setTransferModalTxn(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingTransfer}
                onClick={handleConfirmTransfer}
                className="px-4 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isSubmittingTransfer ? 'Transferring...' : 'Confirm Transfer to Admin'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slide-over Transaction Inspector */}
      <TransactionDetailDrawer
        transaction={selectedTxn}
        isOpen={Boolean(selectedTxn)}
        onClose={() => setSelectedTxn(null)}
      />
    </div>
  );
}
