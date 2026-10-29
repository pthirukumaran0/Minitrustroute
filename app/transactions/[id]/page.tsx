'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '@/src/components/ui/Card';
import { StatusBadge } from '@/src/components/ui/StatusBadge';
import { LoadingState } from '@/src/components/ui/LoadingState';
import { ErrorState } from '@/src/components/ui/ErrorState';
import { TransactionRecord } from '@/src/types/frontend';
import {
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Smartphone,
  Route as RouteIcon,
  ArrowRight,
  Lock,
  Clock,
  Database,
} from 'lucide-react';

function TransactionDetailContent() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();

  const [transaction, setTransaction] = useState<TransactionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchTransaction = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/transactions/${id}`);
        if (!res.ok) {
          throw new Error(`Transaction '${id}' not found (HTTP ${res.status})`);
        }
        const data = await res.json();
        if (!data.success || !data.transaction) {
          throw new Error(data.error || 'Failed to retrieve transaction');
        }
        setTransaction(data.transaction);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchTransaction();
  }, [id]);

  if (loading) {
    return <LoadingState message={`Retrieving transaction ${id} from ledger...`} rows={6} />;
  }

  if (error || !transaction) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Monitor
        </button>
        <ErrorState title="Transaction Not Found" message={error || 'Record does not exist in ledger'} />
      </div>
    );
  }

  const isBlocked = transaction.riskDecision === 'BLOCKED';
  const isStepUp = transaction.riskDecision === 'STEP_UP';
  const isApproved = transaction.riskDecision === 'APPROVED';

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Back button */}
      <div>
        <Link
          href="/transactions"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Transaction Ledger
        </Link>
      </div>

      {/* Main Header Card */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Transaction Ledger ID
            </span>
            <h1 className="text-xl sm:text-2xl font-black font-mono text-slate-900 dark:text-white tracking-tight mt-0.5">
              {transaction.transactionId}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Recorded: {new Date(transaction.createdAt).toLocaleString()}
            </p>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-2">
            <StatusBadge status={transaction.riskDecision} size="lg" />
            <span className="text-xs font-mono text-slate-500">
              Database State: <strong className="text-slate-800 dark:text-slate-200">{transaction.status}</strong>
            </span>
          </div>
        </div>

        {/* Amount & Corridor Details */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <span className="text-xs text-slate-500">Transfer Amount</span>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {transaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}{' '}
              <span className="text-sm font-semibold text-blue-600">{transaction.currency}</span>
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <span className="text-xs text-slate-500">Payment Corridor</span>
            <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">
              {transaction.sourceCountry} ➔ {transaction.destinationCountry}
            </p>
            <span className="text-[11px] text-slate-400">
              {transaction.sourceCountry === transaction.destinationCountry ? 'Domestic Rail' : 'Cross-Border Rail'}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <span className="text-xs text-slate-500">Storage Subsystem</span>
            <p className="text-lg font-bold text-slate-900 dark:text-white mt-1 flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-600" />
              MongoDB Ledger
            </p>
            <span className="text-[11px] text-slate-400">Immutable Document Audit</span>
          </div>
        </div>
      </Card>

      {/* Dual Column: Risk Evaluation & Telecom Signals */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Risk Assessment */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              {isBlocked ? (
                <ShieldAlert className="w-4 h-4 text-rose-600" />
              ) : isStepUp ? (
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              )}
              Deterministic Fraud Analysis
            </h2>
            <span className="text-sm font-black font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
              Score: {transaction.riskScore} / 100
            </span>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Contributing Factors Evaluated
            </h3>
            <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
              {transaction.contributingFactors && transaction.contributingFactors.length > 0 ? (
                transaction.contributingFactors.map((factor, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-blue-500 font-bold">•</span>
                    <span>{factor}</span>
                  </li>
                ))
              ) : (
                <li className="text-slate-400 italic">No specific risk triggers flagged.</li>
              )}
            </ul>
          </div>

          {transaction.recommendedAction && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-500 block mb-1">Recommended Action</span>
              <p className="font-mono text-xs font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 p-2 rounded-md border border-blue-100 dark:border-blue-900">
                {transaction.recommendedAction}
              </p>
            </div>
          )}
        </Card>

        {/* Telecom Signals */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-blue-600" />
              Telecom Carrier Signals
            </h2>
            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-900">
              SIMULATED SIGNALS
            </span>
          </div>

          <div className="space-y-3">
            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">24-Hour SIM Swap</p>
                <p className="text-[11px] text-slate-500">Carrier SIM card reissue detection</p>
              </div>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded ${
                  transaction.signals.simSwap24h
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                }`}
              >
                {transaction.signals.simSwap24h ? 'DETECTED' : 'CLEAR'}
              </span>
            </div>

            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">Mobile Number Verified</p>
                <p className="text-[11px] text-slate-500">Subscriber identity matches phone carrier</p>
              </div>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded ${
                  transaction.signals.numberVerified
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                }`}
              >
                {transaction.signals.numberVerified ? 'VERIFIED' : 'UNVERIFIED'}
              </span>
            </div>

            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">Device Fingerprint</p>
                <p className="text-[11px] text-slate-500">Hardware & browser integrity</p>
              </div>
              <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded">
                {transaction.signals.deviceStatus}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Selected Payment Route Card */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <RouteIcon className="w-4 h-4 text-blue-600" />
            Payment Corridor & Route Execution
          </h2>
          {isApproved && (
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
              DISPATCHED
            </span>
          )}
        </div>

        {isApproved && transaction.selectedRoute ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                Provider Corridor Path ({transaction.selectedRoute.hops.length} Hops)
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {transaction.selectedRoute.hops.map((hop, i) => (
                  <React.Fragment key={hop}>
                    <span className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-slate-800 dark:text-slate-200 shadow-2xs">
                      {hop}
                    </span>
                    {i < transaction.selectedRoute!.hops.length - 1 && (
                      <ArrowRight className="w-4 h-4 text-blue-500 shrink-0" />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
                <span className="text-xs text-slate-500">Estimated Cost</span>
                <p className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                  ${transaction.selectedRoute.estimatedCost?.toFixed(2) || '0.00'}
                </p>
              </div>
              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
                <span className="text-xs text-slate-500">Propagation Latency</span>
                <p className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                  {transaction.selectedRoute.estimatedLatencyMs || 0} ms
                </p>
              </div>
              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
                <span className="text-xs text-slate-500">Historical Reliability</span>
                <p className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                  {transaction.selectedRoute.reliability
                    ? `${(transaction.selectedRoute.reliability * 100).toFixed(1)}%`
                    : '99.8%'}
                </p>
              </div>
            </div>

            {transaction.selectedRoute.explanation && (
              <p className="text-xs text-slate-600 dark:text-slate-400 bg-blue-50/50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-100 dark:border-blue-900">
                {transaction.selectedRoute.explanation}
              </p>
            )}
          </div>
        ) : isStepUp ? (
          <div className="p-4 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-lg text-xs space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
              <Lock className="w-4 h-4" />
              Route Assignment Held Pending Verification
            </div>
            <p className="text-amber-700 dark:text-amber-400 leading-relaxed">
              This transaction requires multi-factor authentication (Step-Up Auth) before funds can be routed through correspondent banks. Under TrustRoute security policy, no interbank route is executed until the customer completes out-of-band verification.
            </p>
          </div>
        ) : (
          <div className="p-4 bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-lg text-xs space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-rose-800 dark:text-rose-300">
              <ShieldAlert className="w-4 h-4" />
              Routing Strictly Prohibited
            </div>
            <p className="text-rose-700 dark:text-rose-400 leading-relaxed">
              This transaction was blocked by server-side risk rules (e.g. active SIM swap or extreme risk score). Under no circumstances are payment routes generated or funds disbursed for blocked requests.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}

export default function TransactionDetailPage() {
  return (
    <React.Suspense fallback={<LoadingState message="Loading transaction details..." />}>
      <TransactionDetailContent />
    </React.Suspense>
  );
}

