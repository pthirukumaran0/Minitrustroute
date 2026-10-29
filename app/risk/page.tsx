'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, StatCard } from '@/src/components/ui/Card';
import { StatusBadge } from '@/src/components/ui/StatusBadge';
import { LoadingState } from '@/src/components/ui/LoadingState';
import { ErrorState } from '@/src/components/ui/ErrorState';
import { TransactionDetailDrawer } from '@/src/components/transactions/TransactionDetailDrawer';
import { TransactionRecord } from '@/src/types/frontend';
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
} from 'lucide-react';

export default function RiskAnalysisPage() {
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTxn, setSelectedTxn] = useState<TransactionRecord | null>(null);
  const [filterType, setFilterType] = useState<'ALL_RISK' | 'SIM_SWAP' | 'SUSPICIOUS_DEVICE' | 'UNVERIFIED'>('ALL_RISK');

  const fetchRiskData = async () => {
    try {
      setLoading(true);
      setError(null);
      // Fetch newest transactions
      const res = await fetch('/api/transactions?limit=100');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      // Filter to all transactions that had elevated risk (STEP_UP or BLOCKED or score >= 35)
      setTransactions(data.transactions || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRiskData();
  }, []);

  // Compute metrics from real transaction data
  const blockedTxns = transactions.filter((t) => t.riskDecision === 'BLOCKED');
  const stepUpTxns = transactions.filter((t) => t.riskDecision === 'STEP_UP');
  const simSwapTxns = transactions.filter((t) => t.signals.simSwap24h);
  const unverifiedTxns = transactions.filter((t) => !t.signals.numberVerified);
  const suspiciousDeviceTxns = transactions.filter(
    (t) => t.signals.deviceStatus === 'SUSPICIOUS' || t.signals.deviceStatus === 'UNKNOWN'
  );

  // Active filter
  const displayedTxns = transactions.filter((t) => {
    if (filterType === 'SIM_SWAP') return t.signals.simSwap24h;
    if (filterType === 'SUSPICIOUS_DEVICE') return t.signals.deviceStatus === 'SUSPICIOUS';
    if (filterType === 'UNVERIFIED') return !t.signals.numberVerified;
    return t.riskDecision !== 'APPROVED' || t.riskScore >= 35;
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-rose-600" />
            Fraud Monitoring & Risk Analytics
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Deterministic rule-based anomaly detection evaluating telecom carriers, hardware fingerprints, and transaction velocity.
          </p>
        </div>
        <button
          onClick={fetchRiskData}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 transition-colors shadow-2xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* 2. Mandatory Rules Callout */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-xs space-y-2 text-slate-300">
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
          2. <strong>Step-Up Authentication Isolation:</strong> Transactions requiring step-up authentication are assigned <strong>STEP_UP_REQUIRED</strong> and held with no payment route until verified.
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
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setFilterType('ALL_RISK')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            filterType === 'ALL_RISK'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
          }`}
        >
          All Elevated Risk ({blockedTxns.length + stepUpTxns.length})
        </button>
        <button
          onClick={() => setFilterType('SIM_SWAP')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            filterType === 'SIM_SWAP'
              ? 'bg-rose-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
          }`}
        >
          SIM Swap Attacks ({simSwapTxns.length})
        </button>
        <button
          onClick={() => setFilterType('UNVERIFIED')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            filterType === 'UNVERIFIED'
              ? 'bg-amber-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
          }`}
        >
          Unverified Phone ({unverifiedTxns.length})
        </button>
        <button
          onClick={() => setFilterType('SUSPICIOUS_DEVICE')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            filterType === 'SUSPICIOUS_DEVICE'
              ? 'bg-amber-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
          }`}
        >
          Suspicious Devices ({suspiciousDeviceTxns.length})
        </button>
      </div>

      {/* 5. Filtered Risk Ledger Table */}
      <Card className="overflow-hidden">
        <div className="p-5 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Flagged Transactions Queue
            </h2>
            <p className="text-xs text-slate-500">
              Transactions requiring intervention, authentication, or automatic blocking.
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-400">
            {displayedTxns.length} records matching category
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 font-semibold">
              <tr>
                <th className="px-5 py-3.5">Transaction ID</th>
                <th className="px-5 py-3.5">Amount</th>
                <th className="px-5 py-3.5">Risk Score</th>
                <th className="px-5 py-3.5">Verdict</th>
                <th className="px-5 py-3.5">SIM Swap (24h)</th>
                <th className="px-5 py-3.5">Device</th>
                <th className="px-5 py-3.5">Primary Factor</th>
                <th className="px-5 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {displayedTxns.length > 0 ? (
                displayedTxns.map((txn) => (
                  <tr
                    key={txn.transactionId}
                    onClick={() => setSelectedTxn(txn)}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3.5 font-mono font-bold text-blue-600 dark:text-blue-400">
                      {txn.transactionId}
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-slate-900 dark:text-white">
                      {txn.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {txn.currency}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                        {txn.riskScore}
                      </span>
                      <span className="text-slate-400">/100</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={txn.riskDecision} />
                    </td>
                    <td className="px-5 py-3.5">
                      {txn.signals.simSwap24h ? (
                        <span className="text-[11px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-900">
                          DETECTED
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Clear</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                      {txn.signals.deviceStatus}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400 truncate max-w-xs">
                      {txn.contributingFactors?.[1] || txn.contributingFactors?.[0] || 'Risk evaluated'}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTxn(txn);
                        }}
                        className="text-xs font-semibold text-blue-600 hover:underline"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
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

      {/* Slide-over Transaction Inspector */}
      <TransactionDetailDrawer
        transaction={selectedTxn}
        isOpen={Boolean(selectedTxn)}
        onClose={() => setSelectedTxn(null)}
      />
    </div>
  );
}

