'use client';

import React from 'react';
import { Drawer } from '@/src/components/ui/Drawer';
import { StatusBadge } from '@/src/components/ui/StatusBadge';
import { TransactionRecord } from '@/src/types/frontend';
import {
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Phone,
  HardDrive,
  Route as RouteIcon,
  Clock,
  DollarSign,
  AlertTriangle,
  ArrowRight,
  Lock,
} from 'lucide-react';

interface TransactionDetailDrawerProps {
  transaction: TransactionRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

export function TransactionDetailDrawer({
  transaction,
  isOpen,
  onClose,
}: TransactionDetailDrawerProps) {
  if (!transaction) return null;

  const isBlocked = transaction.riskDecision === 'BLOCKED';
  const isStepUp = transaction.riskDecision === 'STEP_UP';
  const isApproved = transaction.riskDecision === 'APPROVED';

  // Format creation date
  const dateFormatted = new Date(transaction.createdAt).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  });

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={transaction.transactionId}
      subtitle={`Created on ${dateFormatted}`}
      width="lg"
    >
      {/* 1. Header Metrics Card */}
      <div className="bg-slate-50 dark:bg-slate-800/60 p-5 rounded-xl border border-slate-200/80 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Transfer Amount
          </span>
          <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
            {transaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}{' '}
            <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
              {transaction.currency}
            </span>
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Corridor: <strong className="text-slate-700 dark:text-slate-200">{transaction.sourceCountry}</strong> ➔{' '}
            <strong className="text-slate-700 dark:text-slate-200">{transaction.destinationCountry}</strong>
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <StatusBadge status={transaction.riskDecision} size="lg" />
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
            Lifecycle: <strong className="text-slate-700 dark:text-slate-300">{transaction.status}</strong>
          </span>
        </div>
      </div>

      {/* 2. Fraud & Risk Score Card */}
      <div className="p-5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isBlocked ? (
              <ShieldAlert className="w-5 h-5 text-rose-600" />
            ) : isStepUp ? (
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            )}
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Server-Calculated Risk Assessment
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Risk Score:</span>
            <span
              className={`text-lg font-black font-mono px-2 py-0.5 rounded-md ${
                isBlocked
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                  : isStepUp
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
              }`}
            >
              {transaction.riskScore} / 100
            </span>
          </div>
        </div>

        {/* Visual Score Bar */}
        <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isBlocked ? 'bg-rose-600' : isStepUp ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${Math.max(5, transaction.riskScore)}%` }}
          />
        </div>

        {/* Contributing Factors */}
        <div>
          <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
            Deterministic Decision Factors
          </h4>
          <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
            {transaction.contributingFactors && transaction.contributingFactors.length > 0 ? (
              transaction.contributingFactors.map((factor, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-blue-500 font-bold">•</span>
                  <span>{factor}</span>
                </li>
              ))
            ) : (
              <li className="text-slate-400">Baseline transaction evaluation</li>
            )}
          </ul>
        </div>

        {/* Recommended Action */}
        {transaction.recommendedAction && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500">Recommended Action:</span>
            <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
              {transaction.recommendedAction}
            </span>
          </div>
        )}
      </div>

      {/* 3. Telecom Signals (Simulated) */}
      <div className="p-5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-blue-600" />
            Telecom & Device Signals
          </h3>
          <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-900 px-2 py-0.5 rounded">
            SIMULATED TELECOM DATA
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {/* SIM Swap */}
          <div
            className={`p-3 rounded-lg border text-xs ${
              transaction.signals.simSwap24h
                ? 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/30 dark:border-rose-900 dark:text-rose-300'
                : 'bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-800/60 dark:border-slate-700 dark:text-slate-300'
            }`}
          >
            <p className="text-[11px] font-medium text-slate-500">24-Hour SIM Swap</p>
            <p className="font-bold text-sm mt-0.5">
              {transaction.signals.simSwap24h ? 'DETECTED' : 'CLEAR'}
            </p>
          </div>

          {/* Number Verified */}
          <div
            className={`p-3 rounded-lg border text-xs ${
              !transaction.signals.numberVerified
                ? 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-300'
                : 'bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-800/60 dark:border-slate-700 dark:text-slate-300'
            }`}
          >
            <p className="text-[11px] font-medium text-slate-500">Number Verified</p>
            <p className="font-bold text-sm mt-0.5">
              {transaction.signals.numberVerified ? 'VERIFIED' : 'UNVERIFIED'}
            </p>
          </div>

          {/* Device Status */}
          <div
            className={`p-3 rounded-lg border text-xs ${
              transaction.signals.deviceStatus === 'SUSPICIOUS'
                ? 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/30 dark:border-rose-900 dark:text-rose-300'
                : transaction.signals.deviceStatus === 'UNKNOWN'
                ? 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-300'
                : 'bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-800/60 dark:border-slate-700 dark:text-slate-300'
            }`}
          >
            <p className="text-[11px] font-medium text-slate-500">Device Fingerprint</p>
            <p className="font-bold text-sm mt-0.5">{transaction.signals.deviceStatus}</p>
          </div>
        </div>
      </div>

      {/* 4. Payment Routing Section */}
      <div className="p-5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <RouteIcon className="w-4 h-4 text-blue-600" />
            Neo4j Payment Routing
          </h3>
          {isApproved && transaction.selectedRoute && (
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
              OPTIMAL ROUTE SELECTED
            </span>
          )}
        </div>

        {isApproved && transaction.selectedRoute ? (
          <div className="space-y-3">
            {/* Hops Flow */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                Provider Corridor Path ({transaction.selectedRoute.hops.length} Hops)
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {transaction.selectedRoute.hops.map((hop, i) => (
                  <React.Fragment key={hop}>
                    <span className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-xs font-mono font-bold text-slate-800 dark:text-slate-200 shadow-2xs">
                      {hop}
                    </span>
                    {i < transaction.selectedRoute!.hops.length - 1 && (
                      <ArrowRight className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Route Metrics */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                <span className="text-[10px] font-medium text-slate-500 uppercase">Estimated Fee</span>
                <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                  ${transaction.selectedRoute.estimatedCost?.toFixed(2) || '0.00'}
                </p>
              </div>
              <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                <span className="text-[10px] font-medium text-slate-500 uppercase">Latency</span>
                <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                  {transaction.selectedRoute.estimatedLatencyMs || 0} ms
                </p>
              </div>
              <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                <span className="text-[10px] font-medium text-slate-500 uppercase">Reliability</span>
                <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                  {transaction.selectedRoute.reliability
                    ? `${(transaction.selectedRoute.reliability * 100).toFixed(1)}%`
                    : '99.8%'}
                </p>
              </div>
            </div>

            {/* Explanation */}
            {transaction.selectedRoute.explanation && (
              <p className="text-xs text-slate-600 dark:text-slate-400 bg-blue-50/40 dark:bg-blue-950/20 p-2.5 rounded-md border border-blue-100 dark:border-blue-900/40">
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
      </div>
    </Drawer>
  );
}

