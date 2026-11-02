'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/src/components/ui/Card';
import { StatusBadge } from '@/src/components/ui/StatusBadge';
import { RouteGraphVisualizer } from '@/src/components/routing/RouteGraphVisualizer';
import { NetworkData, ProviderNode, TransactionRecord } from '@/src/types/frontend';
import { useAuth } from '@/src/context/AuthContext';
import {
  Send,
  ArrowRightLeft,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  ArrowRight,
  Info,
  CheckCircle,
  RefreshCw,
  Sparkles,
  Zap,
  ChevronDown,
  ChevronUp,
  Edit3,
  Layers,
  DollarSign,
  Clock,
  Lock,
} from 'lucide-react';

export default function PaymentInitiationPage() {
  const { authFetch, user } = useAuth();

  // Transaction Inputs
  const [amount, setAmount] = useState<string>('2500');
  const [currency, setCurrency] = useState<string>('USD');
  const [sourceCountry, setSourceCountry] = useState<string>('USA');
  const [destinationCountry, setDestinationCountry] = useState<string>('UAE');
  const [sourceProviderId, setSourceProviderId] = useState<string>('');
  const [destinationProviderId, setDestinationProviderId] = useState<string>('');
  const [recipientName, setRecipientName] = useState<string>('Acme Global Settlement');

  // Collapsible Form State (Collapses automatically upon submit)
  const [isFormCollapsed, setIsFormCollapsed] = useState<boolean>(false);

  // Network Nodes for Selectors & Visualization
  const [networkData, setNetworkData] = useState<NetworkData | null>(null);
  const [providers, setProviders] = useState<ProviderNode[]>([]);

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
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

  // Load available payment providers and topology from Neo4j
  useEffect(() => {
    fetch('/api/network')
      .then((res) => res.json())
      .then((data: NetworkData) => {
        if (data.nodes) {
          setNetworkData(data);
          setProviders(data.nodes);
        }
      })
      .catch(() => {});
  }, []);

  // Filter Gateways and Destination Banks for dropdowns
  const gateways = providers.filter((p) => p.type === 'GATEWAY');
  const destBanks = providers.filter((p) => p.type === 'DESTINATION_BANK' || p.type === 'BANK');

  // Auto-align provider when country changes
  useEffect(() => {
    const matchingGateway = gateways.find((g) => g.country === sourceCountry);
    if (matchingGateway) setSourceProviderId(matchingGateway.id);
  }, [sourceCountry, providers]);

  useEffect(() => {
    const matchingBank = destBanks.find((b) => b.country === destinationCountry);
    if (matchingBank) setDestinationProviderId(matchingBank.id);
  }, [destinationCountry, providers]);

  // Complete Step-Up Verification & Re-evaluate Risk + Neo4j Route
  const handleCompleteVerification = async () => {
    if (!submitResult?.transaction?.transactionId) return;
    setVerifying(true);
    try {
      const res = await authFetch(`/api/transactions/${submitResult.transaction.transactionId}/verify-step-up`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.message || data.error || 'Verification failed');
        return;
      }
      setSubmitResult((prev) =>
        prev
          ? {
              ...prev,
              transaction: data.transaction,
              riskEvaluation: {
                score: data.transaction.riskScore,
                decision: data.transaction.riskDecision,
                factors: data.transaction.contributingFactors || [],
                action: data.transaction.recommendedAction || '',
              },
              routing: data.routing,
            }
          : null
      );
    } catch (err: any) {
      alert(err.message || 'Verification error');
    } finally {
      setVerifying(false);
    }
  };

  // Preset Scenario Handler for Instant Testing
  const applyPresetScenario = (scenario: 'safe' | 'fraud' | 'unverified' | 'highval') => {
    setSubmitResult(null);
    setIsFormCollapsed(false);
    setFieldErrors({});

    if (scenario === 'safe') {
      setAmount('1500');
      setCurrency('USD');
      setSourceCountry('USA');
      setDestinationCountry('UAE');
      setRecipientName('Emirates National Settlement Bank');
    } else if (scenario === 'fraud') {
      setAmount('12000');
      setCurrency('USD');
      setSourceCountry('USA');
      setDestinationCountry('UAE');
      setRecipientName('Compromised-SIM Vendor Ltd');
    } else if (scenario === 'unverified') {
      setAmount('3400');
      setCurrency('USD');
      setSourceCountry('USA');
      setDestinationCountry('IND');
      setRecipientName('Unverified-Carrier Contractor');
    } else if (scenario === 'highval') {
      setAmount('75000');
      setCurrency('USD');
      setSourceCountry('USA');
      setDestinationCountry('GBR');
      setRecipientName('Standard Chartered Capital Clearing');
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
    if (!recipientName.trim()) {
      errors.recipientName = 'Recipient name is required';
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
        senderEmail: user?.email || 'sender@trustroute.com',
        senderName: user?.name || 'Sarah Jenkins',
        recipientName: recipientName.trim(),
        phoneNumber: '+14155550142', // Standard default MSISDN for seamless server-side security evaluation
      };

      if (sourceProviderId) payload.sourceProviderId = sourceProviderId;
      if (destinationProviderId) payload.destinationProviderId = destinationProviderId;

      const res = await authFetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setSubmitResult({
          success: false,
          error: data.error || data.message || 'Payment initiation failed',
        });
      } else {
        setSubmitResult(data);
        // Automatically collapse parameters card to maximize view of graph and results
        setIsFormCollapsed(true);
      }
    } catch (err: any) {
      setSubmitResult({
        success: false,
        error: err.message || 'Network communication error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Helper labels
  const selectedOriginNode = providers.find((p) => p.id === sourceProviderId) || providers.find((p) => p.country === sourceCountry);
  const selectedDestNode = providers.find((p) => p.id === destinationProviderId) || providers.find((p) => p.country === destinationCountry);

  const selectedHops = submitResult?.transaction?.selectedRoute?.hops || [];
  const isApproved = submitResult?.transaction?.riskDecision === 'APPROVED';
  const isBlocked = submitResult?.transaction?.riskDecision === 'BLOCKED';
  const isStepUp = submitResult?.transaction?.riskDecision === 'STEP_UP';

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <ArrowRightLeft className="w-6 h-6 text-indigo-600" />
            New Transfer
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Initiate cross-border transfers with deterministic risk scoring and intelligent Neo4j multi-hop corridor routing.
          </p>
        </div>

        {/* Quick Preset Selector */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mr-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            Scenarios:
          </span>
          <button
            type="button"
            onClick={() => applyPresetScenario('safe')}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 transition-colors"
          >
            1. Safe ($1.5k)
          </button>
          <button
            type="button"
            onClick={() => applyPresetScenario('fraud')}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 transition-colors"
          >
            2. High Risk (Blocked)
          </button>
          <button
            type="button"
            onClick={() => applyPresetScenario('unverified')}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 transition-colors"
          >
            3. Quarantined (Step-Up)
          </button>
          <button
            type="button"
            onClick={() => applyPresetScenario('highval')}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800 transition-colors"
          >
            4. High Value ($75k)
          </button>
        </div>
      </div>

      {/* 2. Collapsible Transaction Parameters Card */}
      <Card className="border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        {/* Header / Toggle Bar */}
        <div className="p-4 sm:p-5 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center font-bold">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <span>Transaction Parameters</span>
                {isFormCollapsed && (
                  <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    Collapsed
                  </span>
                )}
              </h2>
              {isFormCollapsed ? (
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 font-medium flex items-center gap-2">
                  <span className="font-bold text-slate-900 dark:text-white font-mono">
                    ${parseFloat(amount || '0').toLocaleString()} {currency}
                  </span>
                  <span>•</span>
                  <span>{sourceCountry} ({selectedOriginNode?.name || sourceProviderId || 'Origin'})</span>
                  <span>➔</span>
                  <span>{destinationCountry} ({selectedDestNode?.name || destinationProviderId || 'Destination'})</span>
                  <span>•</span>
                  <span className="text-slate-500 truncate max-w-xs">{recipientName}</span>
                </p>
              ) : (
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure transfer details, origin gateway, and target settlement bank.
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsFormCollapsed(!isFormCollapsed)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors shadow-2xs cursor-pointer"
          >
            {isFormCollapsed ? (
              <>
                <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                <span>Edit Parameters</span>
                <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
              </>
            ) : (
              <>
                <span>Collapse Summary</span>
                <ChevronUp className="w-3.5 h-3.5 ml-0.5" />
              </>
            )}
          </button>
        </div>

        {/* Expanded Form Body */}
        {!isFormCollapsed && (
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 bg-white dark:bg-slate-900">
            {/* Amount and Currency */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                  Transfer Amount *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold text-sm">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 5000"
                    className={`w-full pl-8 pr-3.5 py-2 text-sm rounded-lg border bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono focus:outline-hidden focus:ring-2 ${
                      fieldErrors.amount
                        ? 'border-rose-500 focus:ring-rose-400'
                        : 'border-slate-300 dark:border-slate-700 focus:ring-blue-500'
                    }`}
                    disabled={submitting}
                  />
                </div>
                {fieldErrors.amount && <p className="text-xs text-rose-600">{fieldErrors.amount}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                  Currency *
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono font-bold focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  disabled={submitting}
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="INR">INR (₹)</option>
                  <option value="AED">AED (د.إ)</option>
                </select>
              </div>
            </div>

            {/* Source & Destination Entities */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                  Origin Country *
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

            {/* Recipient Details & Provider Specifics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="sm:col-span-1 space-y-1">
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block">
                  Recipient Creditor Name *
                </label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Recipient Name"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  disabled={submitting}
                />
                {fieldErrors.recipientName && <p className="text-[10px] text-rose-600">{fieldErrors.recipientName}</p>}
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block">
                  Origin Gateway (Neo4j Node)
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
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block">
                  Destination Settlement Bank
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

            {/* Clear, Prominent SUBMIT Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto px-8 py-3 rounded-xl text-sm font-black text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:cursor-not-allowed uppercase tracking-wider"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Evaluating Risk & Finding Neo4j Optimal Route...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Submit & Route Payment</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </Card>

      {/* 3. Service Decision & Route Response (Prominent & Clear) */}
      {submitResult && (
        <div className="space-y-6">
          {submitResult.success && submitResult.transaction ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* Service Decision Card (5 cols) */}
              <Card className="lg:col-span-5 p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 space-y-4 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-blue-600" />
                      Service Decision
                    </span>
                    <span className="font-mono text-xs text-slate-400 font-semibold">
                      {submitResult.transaction.transactionId}
                    </span>
                  </div>

                  {/* Verdict Badge */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl border bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Risk Verdict</span>
                      <p className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                        {submitResult.transaction.riskDecision}
                      </p>
                    </div>
                    <StatusBadge status={submitResult.transaction.riskDecision} size="lg" />
                  </div>

                  {/* Risk Metric Bar */}
                  <div className="space-y-1.5 p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Deterministic Risk Score:</span>
                      <span className="font-black font-mono text-base text-slate-900 dark:text-white">
                        {submitResult.riskEvaluation?.score ?? submitResult.transaction.riskScore} / 100
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          isBlocked
                            ? 'bg-rose-600'
                            : isStepUp
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.max(8, submitResult.transaction.riskScore)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 block pt-0.5">
                      Thresholds: &lt;35 Approved, 35-69 Step-Up, &ge;70 Blocked
                    </span>
                  </div>

                  {/* Contributing Factors */}
                  {submitResult.riskEvaluation?.factors && submitResult.riskEvaluation.factors.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Decision Contributing Factors:
                      </span>
                      <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1 max-h-40 overflow-y-auto">
                        {submitResult.riskEvaluation.factors.map((factor, idx) => (
                          <li key={idx} className="flex items-start gap-1.5 leading-snug">
                            <span className="text-blue-500 font-bold">•</span>
                            <span>{factor}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Conditional Actions for Step-Up or Blocked */}
                {isStepUp && (
                  <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl space-y-2 mt-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-200">
                      <Lock className="w-4 h-4 text-amber-600" />
                      <span>Step-Up Authentication Required</span>
                    </div>
                    <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-tight">
                      Quarantined transfer. Out-of-band verification required before correspondent rails can be unlocked.
                    </p>
                    <button
                      type="button"
                      onClick={handleCompleteVerification}
                      disabled={verifying}
                      className="w-full py-2.5 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {verifying ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Verifying & Calculating Route...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Complete Verification & Unlock Route</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {isBlocked && (
                  <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl space-y-1 mt-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-rose-800 dark:text-rose-200">
                      <ShieldAlert className="w-4 h-4 text-rose-600" />
                      <span>Payment Blocked by Security Policy</span>
                    </div>
                    <p className="text-[11px] text-rose-700 dark:text-rose-300 leading-relaxed">
                      High risk violation detected. Payment routing and funds debit are prohibited.
                    </p>
                  </div>
                )}
              </Card>

              {/* Route Response Card (7 cols) */}
              <Card className="lg:col-span-7 p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 space-y-4 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-emerald-600" />
                      Route Response
                    </span>
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Corridor: {submitResult.transaction.sourceCountry} ➔ {submitResult.transaction.destinationCountry}
                    </span>
                  </div>

                  {submitResult.transaction.selectedRoute ? (
                    (() => {
                      const activeRoute = submitResult.transaction.selectedRoute;
                      return (
                        <div className="space-y-4">
                          {/* Hops Banner */}
                          <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-xl space-y-2">
                            <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block">
                              Assigned Multi-Hop Interbank Path:
                            </span>
                            <div className="flex flex-wrap items-center gap-2 text-xs font-bold font-mono text-emerald-950 dark:text-emerald-100">
                              {activeRoute.hops.map((hop: string, idx: number) => (
                                <React.Fragment key={hop}>
                                  <span className="px-2.5 py-1 rounded-md bg-emerald-100/80 dark:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-800 shadow-2xs">
                                    {hop}
                                  </span>
                                  {idx < activeRoute.hops.length - 1 && (
                                    <ArrowRight className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  )}
                                </React.Fragment>
                              ))}
                            </div>
                          </div>

                          {/* Fee, Latency, Reliability Metrics */}
                          <div className="grid grid-cols-3 gap-3 text-center">
                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60">
                              <span className="text-[10px] text-slate-400 font-semibold block uppercase">Est. Rail Fee</span>
                              <p className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                                ${activeRoute.estimatedCost?.toFixed(2)}
                              </p>
                            </div>
                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60">
                              <span className="text-[10px] text-slate-400 font-semibold block uppercase">Hop Latency</span>
                              <p className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                                {activeRoute.estimatedLatencyMs} ms
                              </p>
                            </div>
                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60">
                              <span className="text-[10px] text-slate-400 font-semibold block uppercase">Reliability</span>
                              <p className="text-base font-black text-emerald-600 mt-0.5">
                                {((activeRoute.reliability || 0.99) * 100).toFixed(1)}%
                              </p>
                            </div>
                          </div>

                          {/* Routing Explanation */}
                          {submitResult.routing?.explanation && (
                            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                              {submitResult.routing.explanation}
                            </p>
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    <div className="py-8 text-center space-y-2">
                      <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        {isBlocked ? 'Executable Route Prohibited' : 'Route Calculation Pending Verification'}
                      </p>
                      <p className="text-xs text-slate-500 max-w-md mx-auto">
                        {submitResult.routing?.explanation ||
                          'No payment corridor route was assigned to this transaction based on risk verdict.'}
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          ) : (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300">
              <p className="font-bold">Transaction Request Failed</p>
              <p className="mt-1">{submitResult.error}</p>
            </div>
          )}
        </div>
      )}

      {/* 4. Dynamic Neo4j Network Graph Section */}
      <Card className="p-5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-600" />
              Dynamic Neo4j Network Topology & Route Highlight
            </h2>
            <p className="text-xs text-slate-500">
              {isApproved && selectedHops.length > 0
                ? `Highlighting optimal path connecting ${selectedOriginNode?.name || sourceCountry} to ${selectedDestNode?.name || destinationCountry}.`
                : 'Interactive clearing network topology across 15 correspondent banks, corridors, and gateways.'}
            </p>
          </div>

          {selectedHops.length > 0 && isApproved && (
            <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full w-fit">
              Active: {selectedHops.join(' ➔ ')}
            </span>
          )}
        </div>

        {networkData ? (
          <RouteGraphVisualizer
            nodes={networkData.nodes}
            edges={networkData.edges}
            selectedHops={isApproved ? selectedHops : []}
            highlightRouteName={
              isApproved && selectedHops.length > 0
                ? `Assigned Corridor: ${selectedHops.join(' ➔ ')}`
                : undefined
            }
            noRouteMessage={
              submitResult && !isApproved
                ? isBlocked
                  ? 'Payment Blocked by Risk Policy: No executable route authorized'
                  : 'Step-Up Required: Route pending authentication'
                : undefined
            }
            className="w-full shadow-inner"
          />
        ) : (
          <div className="py-16 text-center text-xs text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-400" />
            <span>Loading Neo4j provider graph topology...</span>
          </div>
        )}
      </Card>
    </div>
  );
}
