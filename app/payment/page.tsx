'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/src/components/ui/Card';
import { StatusBadge } from '@/src/components/ui/StatusBadge';
import { ProviderNode, TransactionRecord } from '@/src/types/frontend';
import {
  Send,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Smartphone,
  Lock,
  ArrowRight,
  Info,
  CheckCircle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

export default function PaymentInitiationPage() {
  const [amount, setAmount] = useState<string>('2500');
  const [currency, setCurrency] = useState<string>('USD');
  const [sourceCountry, setSourceCountry] = useState<string>('USA');
  const [destinationCountry, setDestinationCountry] = useState<string>('UAE');
  const [sourceProviderId, setSourceProviderId] = useState<string>('');
  const [destinationProviderId, setDestinationProviderId] = useState<string>('');

  // Telecom & Device Signals (Simulated)
  const [simSwap24h, setSimSwap24h] = useState<boolean>(false);
  const [numberVerified, setNumberVerified] = useState<boolean>(true);
  const [deviceStatus, setDeviceStatus] = useState<string>('TRUSTED');

  // Network Nodes for Selectors
  const [providers, setProviders] = useState<ProviderNode[]>([]);

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitResult, setSubmitResult] = useState<{
    success: boolean;
    transaction?: TransactionRecord;
    riskEvaluation?: {
      score: number;
      decision: string;
      factors: string[];
      action: string;
    };
    routing?: {
      selected: boolean;
      explanation: string;
      route: any;
    };
    error?: string;
  } | null>(null);

  // Load available payment providers from Neo4j
  useEffect(() => {
    fetch('/api/network')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.nodes) {
          setProviders(data.nodes);
        }
      })
      .catch(() => {});
  }, []);

  // Preset Scenario Handler for Instant Testing
  const applyPresetScenario = (scenario: 'safe' | 'simswap' | 'unverified' | 'highval') => {
    setSubmitResult(null);
    setFieldErrors({});
    if (scenario === 'safe') {
      setAmount('1500');
      setCurrency('USD');
      setSourceCountry('USA');
      setDestinationCountry('UAE');
      setSimSwap24h(false);
      setNumberVerified(true);
      setDeviceStatus('TRUSTED');
    } else if (scenario === 'simswap') {
      setAmount('12000');
      setCurrency('USD');
      setSourceCountry('USA');
      setDestinationCountry('UAE');
      setSimSwap24h(true); // Mandatory BLOCKED rule trigger
      setNumberVerified(false);
      setDeviceStatus('SUSPICIOUS');
    } else if (scenario === 'unverified') {
      setAmount('3400');
      setCurrency('USD');
      setSourceCountry('USA');
      setDestinationCountry('IND');
      setSimSwap24h(false);
      setNumberVerified(false); // Triggers STEP_UP
      setDeviceStatus('UNKNOWN');
    } else if (scenario === 'highval') {
      setAmount('75000');
      setCurrency('USD');
      setSourceCountry('USA');
      setDestinationCountry('GBR');
      setSimSwap24h(false);
      setNumberVerified(true);
      setDeviceStatus('TRUSTED');
    }
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    const parsedAmount = parseFloat(amount);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      errors.amount = 'Amount must be a positive number greater than 0';
    }
    if (!currency || currency.trim().length !== 3) {
      errors.currency = 'Currency must be a 3-letter uppercase code (e.g. USD, EUR)';
    }
    if (!sourceCountry.trim()) {
      errors.sourceCountry = 'Source country is required';
    }
    if (!destinationCountry.trim()) {
      errors.destinationCountry = 'Destination country is required';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    setSubmitResult(null);

    try {
      const payload: any = {
        amount: parseFloat(amount),
        currency: currency.trim().toUpperCase(),
        sourceCountry: sourceCountry.trim(),
        destinationCountry: destinationCountry.trim(),
        signals: {
          simSwap24h,
          numberVerified,
          deviceStatus,
        },
      };

      if (sourceProviderId) payload.sourceProviderId = sourceProviderId;
      if (destinationProviderId) payload.destinationProviderId = destinationProviderId;

      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setSubmitResult({
          success: false,
          error: data.error || data.issues?.[0]?.message || 'Submission failed',
        });
      } else {
        setSubmitResult({
          success: true,
          transaction: data.transaction,
          riskEvaluation: data.riskEvaluation,
          routing: data.routing,
        });
      }
    } catch (err: unknown) {
      setSubmitResult({
        success: false,
        error: err instanceof Error ? err.message : 'Network error submitting payment',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const gateways = providers.filter((p) => p.type === 'GATEWAY' || p.country === 'USA');
  const destBanks = providers.filter((p) => p.type === 'DESTINATION_BANK');

  return (
    <div className="space-y-6">
      {/* 1. Header & Notice */}
      <div className="pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Simulated Payment Initiation
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Submit cross-border payment orders to evaluate deterministic risk scoring and live Neo4j corridor pathfinding.
        </p>
      </div>

      {/* Advisory Banner */}
      <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 rounded-xl flex items-start gap-3 text-xs text-blue-900 dark:text-blue-300">
        <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-semibold">Simulated Environment Notice</p>
          <p className="text-slate-600 dark:text-slate-400">
            TrustRoute evaluates fraud signals and models financial paths through Neo4j clearing networks. No live bank balances or real fiat currencies are moved.
          </p>
        </div>
      </div>

      {/* 2. Quick Preset Selector */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mr-1">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          Test Scenarios:
        </span>
        <button
          type="button"
          onClick={() => applyPresetScenario('safe')}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 transition-colors"
        >
          1. Clean Payment ($1.5k, Approved)
        </button>
        <button
          type="button"
          onClick={() => applyPresetScenario('simswap')}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 transition-colors"
        >
          2. SIM Swap Takeover (Blocked)
        </button>
        <button
          type="button"
          onClick={() => applyPresetScenario('unverified')}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 transition-colors"
        >
          3. Unverified Device (Step-Up)
        </button>
        <button
          type="button"
          onClick={() => applyPresetScenario('highval')}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800 transition-colors"
        >
          4. High Value ($75k, Step-Up)
        </button>
      </div>

      {/* 3. Form & Live Result Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Form (7 cols) */}
        <form onSubmit={handleSubmit} className="lg:col-span-7 space-y-5">
          <Card className="p-6 space-y-5">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider pb-2 border-b border-slate-100 dark:border-slate-800">
              Transaction Parameters
            </h2>

            {/* Amount and Currency */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                  Transfer Amount *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 5000"
                  className={`w-full px-3.5 py-2 text-sm rounded-lg border bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 ${
                    fieldErrors.amount
                      ? 'border-rose-500 focus:ring-rose-400'
                      : 'border-slate-300 dark:border-slate-700 focus:ring-blue-500'
                  }`}
                  disabled={submitting}
                />
                {fieldErrors.amount && <p className="text-xs text-rose-600">{fieldErrors.amount}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                  Currency *
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  disabled={submitting}
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="INR">INR (₹)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="AED">AED (د.إ)</option>
                </select>
              </div>
            </div>

            {/* Origin & Destination Countries */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                  Source Country (Origin) *
                </label>
                <select
                  value={sourceCountry}
                  onChange={(e) => setSourceCountry(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  disabled={submitting}
                >
                  <option value="USA">United States (USA)</option>
                  <option value="GBR">United Kingdom (GBR)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                  Destination Country *
                </label>
                <select
                  value={destinationCountry}
                  onChange={(e) => setDestinationCountry(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  disabled={submitting}
                >
                  <option value="UAE">United Arab Emirates (UAE)</option>
                  <option value="IND">India (IND)</option>
                  <option value="GBR">United Kingdom (GBR)</option>
                  <option value="USA">Domestic (USA)</option>
                  <option value="FJI">Fiji (FJI - Isolated Node)</option>
                  <option value="XYZ">Unknown / Missing Provider (XYZ)</option>
                </select>
              </div>
            </div>

            {/* Optional Specific Providers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-500 block">
                  Origin Gateway (Auto-resolved if empty)
                </label>
                <select
                  value={sourceProviderId}
                  onChange={(e) => setSourceProviderId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
                  disabled={submitting}
                >
                  <option value="">Auto-resolve from Origin Country</option>
                  {gateways.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-500 block">
                  Destination Bank (Auto-resolved if empty)
                </label>
                <select
                  value={destinationProviderId}
                  onChange={(e) => setDestinationProviderId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
                  disabled={submitting}
                >
                  <option value="">Auto-resolve from Destination Country</option>
                  {destBanks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.country})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          {/* Telecom Signals Sub-Card */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-blue-600" />
                Simulated Telecom Risk Signals
              </h2>
              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-900">
                CAMARA / Telco Mock
              </span>
            </div>

            <div className="space-y-3">
              {/* SIM Swap Toggle */}
              <label className="flex items-start justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 cursor-pointer hover:bg-slate-100/50 transition-colors">
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">
                    Recent SIM Swap (Within Last 24 Hours)
                  </span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    Mandatory Rule: Any SIM swap in the last 24h triggers an immediate <strong className="text-rose-600">BLOCKED</strong> verdict.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={simSwap24h}
                  onChange={(e) => setSimSwap24h(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 shrink-0 mt-1"
                  disabled={submitting}
                />
              </label>

              {/* Number Verified Toggle */}
              <label className="flex items-start justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 cursor-pointer hover:bg-slate-100/50 transition-colors">
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">
                    Carrier Mobile Number Verified
                  </span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    Unverified numbers add +25 risk points and require Step-Up Authentication.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={numberVerified}
                  onChange={(e) => setNumberVerified(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 shrink-0 mt-1"
                  disabled={submitting}
                />
              </label>

              {/* Device Status Select */}
              <div className="space-y-1.5 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                <label className="text-xs font-bold text-slate-900 dark:text-white block">
                  Device Fingerprint Integrity
                </label>
                <select
                  value={deviceStatus}
                  onChange={(e) => setDeviceStatus(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  disabled={submitting}
                >
                  <option value="TRUSTED">TRUSTED — Known device (+0 points)</option>
                  <option value="UNKNOWN">UNKNOWN — First-time / Incognito (+15 points)</option>
                  <option value="SUSPICIOUS">SUSPICIOUS — Rooted / Emulator (+30 points)</option>
                </select>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Evaluating Risk & Querying Neo4j Rails...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Submit & Route Payment</span>
                  </>
                )}
              </button>
            </div>
          </Card>
        </form>

        {/* Right Live Results Panel (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          <Card className="p-6">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              Server Decision & Route Response
            </h2>

            {submitResult ? (
              <div className="space-y-4 pt-4">
                {submitResult.success && submitResult.transaction ? (
                  <>
                    {/* Status Banner */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl border bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700">
                      <div>
                        <span className="text-[11px] font-semibold text-slate-500 uppercase block">Verdict</span>
                        <p className="text-xs font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                          ID: {submitResult.transaction.transactionId}
                        </p>
                      </div>
                      <StatusBadge status={submitResult.transaction.riskDecision} size="lg" />
                    </div>

                    {/* Risk Score */}
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Server Risk Metric:</span>
                        <span className="font-black font-mono text-base text-slate-900 dark:text-white">
                          {submitResult.riskEvaluation?.score ?? submitResult.transaction.riskScore} / 100
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            submitResult.transaction.riskDecision === 'BLOCKED'
                              ? 'bg-rose-600'
                              : submitResult.transaction.riskDecision === 'STEP_UP'
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.max(5, submitResult.transaction.riskScore)}%` }}
                        />
                      </div>
                      <div className="pt-2">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                          Calculated Factors
                        </span>
                        <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                          {submitResult.riskEvaluation?.factors.map((f, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <span className="text-blue-500 font-bold">•</span>
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Routing Details */}
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                      <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <ArrowRight className="w-3.5 h-3.5 text-blue-600" />
                        Routing Outcome
                      </span>

                      {submitResult.transaction.selectedRoute ? (
                        <div className="space-y-2.5">
                          <div className="p-2.5 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-lg text-xs">
                            <span className="font-bold text-emerald-800 dark:text-emerald-300 block mb-1">
                              Selected Corridor Hops:
                            </span>
                            <p className="font-mono text-emerald-900 dark:text-emerald-200 font-semibold">
                              {submitResult.transaction.selectedRoute.hops.join(' ➔ ')}
                            </p>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-center text-xs">
                            <div className="p-2 rounded bg-slate-50 dark:bg-slate-800">
                              <span className="text-[10px] text-slate-500">Est. Fee</span>
                              <p className="font-bold text-slate-900 dark:text-white">
                                ${submitResult.transaction.selectedRoute.estimatedCost?.toFixed(2)}
                              </p>
                            </div>
                            <div className="p-2 rounded bg-slate-50 dark:bg-slate-800">
                              <span className="text-[10px] text-slate-500">Latency</span>
                              <p className="font-bold text-slate-900 dark:text-white">
                                {submitResult.transaction.selectedRoute.estimatedLatencyMs} ms
                              </p>
                            </div>
                          </div>
                          {submitResult.routing?.explanation && (
                            <p className="text-[11px] text-slate-500 leading-relaxed">
                              {submitResult.routing.explanation}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-lg text-xs text-slate-500 italic">
                          {submitResult.routing?.explanation || 'No payment route assigned under risk policy.'}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300">
                    <p className="font-bold">Submission Rejected</p>
                    <p className="mt-1">{submitResult.error}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                <CheckCircle className="w-8 h-8 text-slate-300 mx-auto" />
                <p>Fill out parameters and click "Submit & Route Payment".</p>
                <p className="text-[11px] text-slate-400">
                  The backend will calculate risk deterministically and select the shortest graph route.
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

