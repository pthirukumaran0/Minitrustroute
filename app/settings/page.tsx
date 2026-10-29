'use client';

import React, { useState } from 'react';
import { Card } from '@/src/components/ui/Card';
import {
  Sliders,
  ShieldAlert,
  GitFork,
  SlidersHorizontal,
  Lock,
  Database,
  Info,
  CheckCircle2,
  Save,
} from 'lucide-react';

export default function SettingsPage() {
  // Local preferences state
  const [tableDensity, setTableDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(0);
  const [currencyFormat, setCurrencyFormat] = useState<string>('standard');
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <Sliders className="w-6 h-6 text-blue-600" />
            System Settings & Engine Configuration
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Review deterministic fraud scoring rules, routing multi-objective parameters, and workspace preferences.
          </p>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          Workspace preferences saved locally.
        </div>
      )}

      {/* 1. Risk Engine Parameter Reference */}
      <Card className="p-5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-600" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Risk Engine Scoring Weights (Deterministic Rule Matrix)
            </h2>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
            RULE-BASED V1.0 (IMMUTABLE)
          </span>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          The risk engine produces deterministic verdicts strictly calculated on the server to prevent client spoofing.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              SIM Swap (&lt; 24h)
            </span>
            <p className="text-xl font-black text-rose-600 dark:text-rose-400 mt-1">
              +100 Penalty
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Instant BLOCKED override. No route evaluated.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Unverified Phone
            </span>
            <p className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1">
              +25 Penalty
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Telecom MSISDN verification failed.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Suspicious Device
            </span>
            <p className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1">
              +35 Penalty
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Fingerprint anomaly or emulator detected.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              High Value (&gt; 10k)
            </span>
            <p className="text-xl font-black text-blue-600 dark:text-blue-400 mt-1">
              +15 Penalty
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Transfer amount exceeds currency threshold.
            </p>
          </div>
        </div>

        {/* Threshold Tiers */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 text-xs space-y-2">
          <span className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] block">
            Verdicts & Enforcement Thresholds
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg">
              <span className="font-black text-emerald-700 dark:text-emerald-300 block">
                Score 0 – 30: APPROVED
              </span>
              <p className="text-[11px] text-emerald-800 dark:text-emerald-400 mt-0.5">
                Low risk. Optimal Neo4j interbank route dispatched immediately.
              </p>
            </div>
            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg">
              <span className="font-black text-amber-700 dark:text-amber-300 block">
                Score 31 – 70: STEP_UP
              </span>
              <p className="text-[11px] text-amber-800 dark:text-amber-400 mt-0.5">
                Medium risk. Quarantined in escrow; routing held until MFA clears.
              </p>
            </div>
            <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg">
              <span className="font-black text-rose-700 dark:text-rose-300 block">
                Score 71 – 100: BLOCKED
              </span>
              <p className="text-[11px] text-rose-800 dark:text-rose-400 mt-0.5">
                High risk or active SIM swap. Transaction permanently rejected.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* 2. Routing Engine Optimization Parameters */}
      <Card className="p-5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <GitFork className="w-5 h-5 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Payment Routing Engine Configuration (Dijkstra + Yen&apos;s KSP)
            </h2>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
            NEO4J BOLT GRAPH V1.0
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
            <span className="text-[10px] font-semibold text-slate-400 uppercase">
              Cost Weight Factor (α)
            </span>
            <p className="text-xl font-black text-slate-900 dark:text-white mt-1">0.50 (50%)</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Normalizes interbank transaction fees.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
            <span className="text-[10px] font-semibold text-slate-400 uppercase">
              Latency Weight Factor (β)
            </span>
            <p className="text-xl font-black text-slate-900 dark:text-white mt-1">0.50 (50%)</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Normalizes network transit and clearing time.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
            <span className="text-[10px] font-semibold text-slate-400 uppercase">
              Yen&apos;s K Candidates
            </span>
            <p className="text-xl font-black text-blue-600 dark:text-blue-400 mt-1">K = 3 Paths</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Computes primary + 2 loopless fallback candidates.
            </p>
          </div>
        </div>
      </Card>

      {/* 3. Workspace UI Preferences Form */}
      <Card className="p-5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-slate-700 dark:text-slate-300" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Workspace & Display Preferences
            </h2>
          </div>
        </div>

        <form onSubmit={handleSavePreferences} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Data Table Density
              </label>
              <select
                value={tableDensity}
                onChange={(e: any) => setTableDensity(e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100"
              >
                <option value="comfortable">Comfortable (Standard Row Height)</option>
                <option value="compact">Compact (Dense Financial View)</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Dashboard Auto-Refresh Rate
              </label>
              <select
                value={autoRefreshInterval}
                onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100"
              >
                <option value={0}>Manual Refresh Only</option>
                <option value={30}>Every 30 Seconds</option>
                <option value={60}>Every 60 Seconds</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-2xs transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            Save Preferences
          </button>
        </form>
      </Card>
    </div>
  );
}
