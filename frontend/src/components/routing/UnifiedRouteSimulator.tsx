'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card } from '@/src/components/ui/Card';
import { LoadingSpinner, EmptyState, ErrorState } from '@/src/components/ui/LoadingState';
import { NetworkData, ProviderNode } from '@/src/types/frontend';
import { useAuth } from '@/src/context/AuthContext';
import {
  GitCompare,
  ArrowRight,
  Zap,
  Clock,
  DollarSign,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Copy,
  Check,
  Building2,
  TrendingUp,
  Info,
  ShieldAlert,
  Sliders,
} from 'lucide-react';

export interface CalculatedPathway {
  rank: number;
  isPrimary: boolean;
  routeId?: string;
  routeName: string;
  hops: string[];
  providerNames: string[];
  intermediateHops: string[];
  intermediateNames: string[];
  totalCost: number;
  totalLatencyMs: number;
  cumulativeReliability: number;
  riskFactor: number;
  compositeWeight?: number;
  hopCount: number;
  status: string;
  currency: string;
  amount: number;
  explanation?: string;
}

interface UnifiedRouteSimulatorProps {
  forcedRole?: 'sender' | 'analyst' | 'admin';
}

export function UnifiedRouteSimulator({ forcedRole }: UnifiedRouteSimulatorProps) {
  const { role: authRole } = useAuth();
  const effectiveRole = forcedRole || authRole || 'analyst';

  const [networkData, setNetworkData] = useState<NetworkData | null>(null);
  const [loadingBanks, setLoadingBanks] = useState<boolean>(true);
  const [bankError, setBankError] = useState<string | null>(null);

  // Bank-based Transfer Parameters
  const [sourceBankId, setSourceBankId] = useState<string>('');
  const [destinationBankId, setDestinationBankId] = useState<string>('');
  const [amount, setAmount] = useState<number>(5000);
  const [currency, setCurrency] = useState<string>('USD');
  const [kPaths, setKPaths] = useState<number>(3);

  // Simulation execution results
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [calculatedPathways, setCalculatedPathways] = useState<CalculatedPathway[]>([]);
  const [calculationError, setCalculationError] = useState<string | null>(null);
  const [requestedKCount, setRequestedKCount] = useState<number>(3);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Stale request handling
  const activeRequestIdRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 1. Fetch valid banks and payment providers dynamically from live Neo4j network
  const fetchBanks = useCallback(async () => {
    try {
      setLoadingBanks(true);
      setBankError(null);
      const res = await fetch('/api/network');
      if (!res.ok) {
        throw new Error(`Failed to load bank entities from Neo4j (HTTP ${res.status})`);
      }
      const data: NetworkData = await res.json();
      setNetworkData(data);

      if (data.nodes && data.nodes.length > 0) {
        const availableNodes = data.nodes.filter(
          (n) => n.status !== 'INACTIVE' && n.isAvailable !== false
        );
        const validNodes = availableNodes.length > 0 ? availableNodes : data.nodes;

        // Set initial source and destination banks
        setSourceBankId((prev) => {
          if (prev && validNodes.some((n) => n.id === prev)) return prev;
          return validNodes[0]?.id || '';
        });

        setDestinationBankId((prev) => {
          if (prev && validNodes.some((n) => n.id === prev && n.id !== validNodes[0]?.id)) {
            return prev;
          }
          const altNode = validNodes.find((n) => n.id !== validNodes[0]?.id);
          return altNode?.id || validNodes[1]?.id || validNodes[0]?.id || '';
        });
      }
    } catch (err: unknown) {
      setBankError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingBanks(false);
    }
  }, []);

  useEffect(() => {
    fetchBanks();
  }, [fetchBanks]);

  // Derived gateway nodes & identifiers
  const sourceNode = networkData?.nodes.find((n) => n.id === sourceBankId);
  const destinationNode = networkData?.nodes.find((n) => n.id === destinationBankId);

  // Source Gateway Identifier automatically populated from selected source bank
  const sourceGatewayId = sourceNode?.id || '';
  // Destination Gateway Identifier automatically populated from selected destination bank
  const destinationGatewayId = destinationNode?.id || '';

  // 2. Execute Yen's K-Shortest Paths Algorithm
  const handleCalculatePathways = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // Input Validations
    if (!sourceBankId || !destinationBankId) {
      setCalculationError('Please select both a valid Source Bank and Destination Bank.');
      setCalculatedPathways([]);
      return;
    }

    if (sourceBankId === destinationBankId) {
      setCalculationError('Source Bank and Destination Bank must be distinct financial entities.');
      setCalculatedPathways([]);
      return;
    }

    if (!amount || amount <= 0) {
      setCalculationError('Transfer amount must be a positive number greater than 0.');
      setCalculatedPathways([]);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const requestId = ++activeRequestIdRef.current;
    const currentK = Number(kPaths) || 3;
    setRequestedKCount(currentK);

    setIsCalculating(true);
    setCalculationError(null);

    try {
      const res = await fetch('/api/network/route-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        body: JSON.stringify({
          sourceNodeId: sourceGatewayId,
          targetNodeId: destinationGatewayId,
          sourceProviderId: sourceGatewayId,
          destinationProviderId: destinationGatewayId,
          amount: Number(amount),
          currency,
          k: currentK,
          maxAlternatives: currentK,
        }),
      });

      const data = await res.json();

      if (activeRequestIdRef.current !== requestId) return;

      if (!res.ok || !data.success) {
        setCalculatedPathways([]);
        setCalculationError(
          data.details ||
            data.message ||
            data.error ||
            `No active routing path connects ${sourceNode?.name || sourceGatewayId} to ${destinationNode?.name || destinationGatewayId} over active network edges.`
        );
        return;
      }

      // Map pathways returned by backend Yen's algorithm
      if (data.routes && Array.isArray(data.routes)) {
        setCalculatedPathways(data.routes.slice(0, currentK));
      } else if (data.primaryRoute || data.route) {
        const prim = data.primaryRoute || data.route;
        const alts = data.alternatives || [];
        const combined: CalculatedPathway[] = [
          {
            rank: 1,
            isPrimary: true,
            routeId: prim.routeId,
            routeName: prim.routeName || 'Best Optimal Pathway',
            hops: prim.hops || [],
            providerNames: prim.providerNames || prim.hops || [],
            intermediateHops: (prim.hops || []).slice(1, -1),
            intermediateNames: (prim.providerNames || prim.hops || []).slice(1, -1),
            totalCost: prim.estimatedCost ?? prim.totalCost ?? 0,
            totalLatencyMs: prim.estimatedLatencyMs ?? prim.totalLatencyMs ?? 0,
            cumulativeReliability: prim.reliability ?? prim.cumulativeReliability ?? 1.0,
            riskFactor: Number(((1.0 - (prim.reliability ?? 1.0)) * 100).toFixed(1)),
            hopCount: Math.max(0, (prim.hops?.length || 1) - 1),
            status: 'ACTIVE',
            currency,
            amount,
            explanation: prim.explanation,
          },
          ...alts.map((alt: any, idx: number) => ({
            rank: idx + 2,
            isPrimary: false,
            routeId: `ROUTE-${sourceGatewayId}-TO-${destinationGatewayId}-ALT-${idx + 1}`,
            routeName: `Alternative Pathway ${idx + 2} (${Math.max(0, (alt.hops?.length || 1) - 1)} hops)`,
            hops: alt.hops || [],
            providerNames: alt.providerNames || alt.hops || [],
            intermediateHops: (alt.hops || []).slice(1, -1),
            intermediateNames: (alt.providerNames || alt.hops || []).slice(1, -1),
            totalCost: alt.totalCost ?? alt.estimatedCost ?? 0,
            totalLatencyMs: alt.totalLatencyMs ?? alt.estimatedLatencyMs ?? 0,
            cumulativeReliability: alt.cumulativeReliability ?? alt.reliability ?? 1.0,
            riskFactor: Number(((1.0 - (alt.cumulativeReliability ?? 1.0)) * 100).toFixed(1)),
            hopCount: Math.max(0, (alt.hops?.length || 1) - 1),
            status: 'ACTIVE',
            currency,
            amount,
            explanation: `Alternative pathway ${idx + 2} calculated via Yen's K-Shortest loopless path algorithm across live Neo4j topology.`,
          })),
        ];
        setCalculatedPathways(combined.slice(0, currentK));
      } else {
        setCalculatedPathways([]);
        setCalculationError('No pathways returned from routing engine.');
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      if (activeRequestIdRef.current !== requestId) return;
      setCalculatedPathways([]);
      setCalculationError(
        err instanceof Error ? err.message : 'Failed to execute Yen K-Shortest pathways calculation.'
      );
    } finally {
      if (activeRequestIdRef.current === requestId) {
        setIsCalculating(false);
      }
    }
  };

  // Initial calculation once banks are loaded
  const initialCalculatedRef = useRef(false);
  useEffect(() => {
    if (
      !initialCalculatedRef.current &&
      networkData?.nodes &&
      networkData.nodes.length > 1 &&
      sourceBankId &&
      destinationBankId &&
      sourceBankId !== destinationBankId
    ) {
      initialCalculatedRef.current = true;
      handleCalculatePathways();
    }
  }, [networkData, sourceBankId, destinationBankId]);

  // Handle Source Bank selection
  const handleSourceChange = (newSourceId: string) => {
    setSourceBankId(newSourceId);
    if (destinationBankId === newSourceId) {
      const alternate = networkData?.nodes.find((n) => n.id !== newSourceId);
      if (alternate) {
        setDestinationBankId(alternate.id);
      }
    }
  };

  // Handle Destination Bank selection
  const handleDestinationChange = (newDestId: string) => {
    setDestinationBankId(newDestId);
    if (sourceBankId === newDestId) {
      const alternate = networkData?.nodes.find((n) => n.id !== newDestId);
      if (alternate) {
        setSourceBankId(alternate.id);
      }
    }
  };

  const handleCopyPathway = (index: number, pathway: CalculatedPathway) => {
    navigator.clipboard.writeText(JSON.stringify(pathway, null, 2));
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const roleTheme = {
    sender: {
      badge: 'Sender Pathway Evaluation',
      badgeClass: 'bg-indigo-100 text-indigo-700',
      title: 'Payment Pathway Simulator',
      description: 'Evaluate live interbank routing options and calculate optimal payment pathways before transfer initiation.',
      accent: 'indigo',
      notice: 'Simulation mode only — calculating pathways evaluates network options and does not execute an actual financial transaction.',
    },
    analyst: {
      badge: 'Analyst Intelligence',
      badgeClass: 'bg-blue-100 text-blue-700',
      title: 'Interbank Pathway Simulator',
      description: 'Analyze multi-hop failover paths and evaluate interbank routing efficiency across Neo4j clearing entities.',
      accent: 'blue',
      notice: 'Deterministic Yen\'s K-Shortest loopless paths algorithm evaluated against live Neo4j payment rails.',
    },
    admin: {
      badge: 'Platform Administration',
      badgeClass: 'bg-purple-100 text-purple-700',
      title: 'Payment Route Simulator',
      description: 'Evaluate optimal and K-alternative multi-hop interbank payment pathways computed directly over live Neo4j topology.',
      accent: 'purple',
      notice: 'Routing calculations strictly utilize active, non-prohibited Neo4j provider nodes and rails.',
    },
  }[effectiveRole];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md ${roleTheme.badgeClass}`}>
              {roleTheme.badge}
            </span>
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 rounded-md">
              Yen&apos;s K-Shortest Loopless Pathways
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1 flex items-center gap-2.5">
            <GitCompare className="w-6 h-6 text-purple-600" />
            {roleTheme.title}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {roleTheme.description}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchBanks}
            disabled={loadingBanks}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingBanks ? 'animate-spin' : ''}`} />
            Refresh Banks
          </button>
        </div>
      </div>

      {bankError && <ErrorState message={bankError} onRetry={fetchBanks} />}

      {/* Simulator Form (No Graph) */}
      <Card className="p-5 bg-white border-slate-200 shadow-2xs space-y-4">
        <form onSubmit={handleCalculatePathways} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 items-start">
            {/* 1. Source Bank */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">
                Source Bank <span className="text-purple-600">*</span>
              </label>
              <select
                value={sourceBankId}
                onChange={(e) => handleSourceChange(e.target.value)}
                disabled={loadingBanks || isCalculating}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer disabled:opacity-50 shadow-2xs"
              >
                {loadingBanks ? (
                  <option>Loading Neo4j Banks...</option>
                ) : (
                  networkData?.nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name} {n.country ? `[${n.country}]` : ''}
                    </option>
                  ))
                )}
              </select>
              {/* Automatically resolved Source Gateway Identifier */}
              <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono bg-slate-50 px-2 py-1 rounded border border-slate-200">
                <span className="text-slate-400">Gateway:</span>
                <strong className="text-purple-700 truncate">{sourceGatewayId || 'N/A'}</strong>
              </div>
            </div>

            {/* 2. Destination Bank */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">
                Destination Bank <span className="text-purple-600">*</span>
              </label>
              <select
                value={destinationBankId}
                onChange={(e) => handleDestinationChange(e.target.value)}
                disabled={loadingBanks || isCalculating}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer disabled:opacity-50 shadow-2xs"
              >
                {loadingBanks ? (
                  <option>Loading Neo4j Banks...</option>
                ) : (
                  networkData?.nodes.map((n) => (
                    <option key={n.id} value={n.id} disabled={n.id === sourceBankId}>
                      {n.name} {n.country ? `[${n.country}]` : ''} {n.id === sourceBankId ? '(Source)' : ''}
                    </option>
                  ))
                )}
              </select>
              {/* Automatically resolved Destination Gateway Identifier */}
              <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono bg-slate-50 px-2 py-1 rounded border border-slate-200">
                <span className="text-slate-400">Gateway:</span>
                <strong className="text-purple-700 truncate">{destinationGatewayId || 'N/A'}</strong>
              </div>
            </div>

            {/* 3. Amount */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">
                Amount <span className="text-purple-600">*</span>
              </label>
              <input
                type="number"
                min={1}
                step="any"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                disabled={isCalculating}
                placeholder="5000"
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 shadow-2xs"
              />
              <span className="text-[10px] text-slate-400 block">Transfer principal</span>
            </div>

            {/* 4. Currency */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">
                Currency <span className="text-purple-600">*</span>
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                disabled={isCalculating}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer disabled:opacity-50 shadow-2xs"
              >
                <option value="USD">USD ($ - US Dollar)</option>
                <option value="EUR">EUR (€ - Euro)</option>
                <option value="GBP">GBP (£ - British Pound)</option>
                <option value="INR">INR (₹ - Indian Rupee)</option>
                <option value="AED">AED (د.إ - UAE Dirham)</option>
                <option value="SGD">SGD (S$ - Singapore Dollar)</option>
                <option value="CHF">CHF (CHF - Swiss Franc)</option>
                <option value="JPY">JPY (¥ - Japanese Yen)</option>
              </select>
              <span className="text-[10px] text-slate-400 block">Settlement denomination</span>
            </div>

            {/* 5. K - Number of Pathways (1 to 5) */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">
                K – Number of Pathways <span className="text-purple-600">*</span>
              </label>
              <select
                value={kPaths}
                onChange={(e) => setKPaths(Number(e.target.value))}
                disabled={isCalculating}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer disabled:opacity-50 shadow-2xs"
              >
                <option value={1}>K = 1 (Best Single Pathway)</option>
                <option value={2}>K = 2 (Top 2 Alternative Pathways)</option>
                <option value={3}>K = 3 (Top 3 Alternative Pathways)</option>
                <option value={4}>K = 4 (Top 4 Alternative Pathways)</option>
                <option value={5}>K = 5 (Top 5 Alternative Pathways)</option>
              </select>
              <span className="text-[10px] text-slate-400 block">Yen loopless search depth</span>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
            <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
              <Building2 className="w-3.5 h-3.5 text-purple-600" />
              <span className="font-semibold text-slate-700">Bank Corridor:</span>
              <span className="font-semibold text-slate-900">
                {sourceNode?.name || sourceGatewayId}
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-semibold text-slate-900">
                {destinationNode?.name || destinationGatewayId}
              </span>
            </div>

            <button
              type="submit"
              disabled={isCalculating || loadingBanks || !sourceBankId || !destinationBankId}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCalculating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Calculating Pathways...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                  <span>Calculate Pathways</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Informational notice */}
        <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px] text-slate-500 flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-purple-600 shrink-0" />
          <span>{roleTheme.notice}</span>
        </div>
      </Card>

      {/* Error / No Route Banner */}
      {calculationError && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 space-y-1 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <h3 className="font-bold text-sm">Pathway Calculation Unsuccessful</h3>
          </div>
          <p className="text-xs text-rose-700 pl-7 leading-relaxed font-medium">
            {calculationError}
          </p>
        </div>
      )}

      {/* Fewer-than-K notification */}
      {!isCalculating && calculatedPathways.length > 0 && calculatedPathways.length < requestedKCount && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2 font-medium">
          <Info className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            Only {calculatedPathways.length} valid pathway{calculatedPathways.length > 1 ? 's are' : ' is'} available in the active network topology for this bank pair.
          </span>
        </div>
      )}

      {/* Loading state */}
      {isCalculating && (
        <LoadingSpinner message="Executing Yen's K-Shortest Loopless Paths algorithm across Neo4j graph..." />
      )}

      {/* Pathway Result Cards (NO GRAPH) */}
      {!isCalculating && calculatedPathways.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                Calculated Payment Pathways ({calculatedPathways.length} of {requestedKCount} Requested)
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 rounded-md">
                Yen&apos;s KSP Verified
              </span>
            </div>
            <span className="text-xs text-slate-400 font-medium">
              Ranked in Ascending Order of Route Cost / Composite Weight
            </span>
          </div>

          <div className="space-y-4">
            {calculatedPathways.map((pathway, idx) => {
              const isBest = pathway.rank === 1;

              return (
                <Card
                  key={pathway.routeId || idx}
                  className={`p-5 transition-all bg-white ${
                    isBest
                      ? 'border-2 border-purple-500 shadow-md ring-1 ring-purple-100'
                      : 'border-slate-200 hover:border-slate-300 shadow-2xs'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3.5 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-lg font-black text-xs ${
                          isBest
                            ? 'bg-purple-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        #{pathway.rank}
                      </span>

                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900">
                            {isBest ? 'Pathway 1 – Best Route' : `Pathway ${pathway.rank} – Alternative Route`}
                          </h3>
                          {isBest && (
                            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
                              Optimal
                            </span>
                          )}
                          <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-slate-50 text-slate-600 border border-slate-200 rounded">
                            {pathway.status || 'ACTIVE'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {pathway.routeId || `ROUTE-${sourceGatewayId}-TO-${destinationGatewayId}-K${pathway.rank}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Hops</span>
                        <span className="text-xs font-black text-slate-800">
                          {pathway.hopCount} hops ({pathway.hops.length} clearing nodes)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyPathway(idx, pathway)}
                        className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        title="Copy pathway JSON"
                      >
                        {copiedIndex === idx ? (
                          <Check className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Complete Pathway Flow (Source Bank → Intermediate Bank 1 → ... → Destination Bank) */}
                  <div className="py-4">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2.5">
                      Bank-to-Bank Sequence Pathway
                    </span>

                    <div className="flex flex-wrap items-center gap-2">
                      {pathway.hops.map((hopId, hopIdx) => {
                        const isOrigin = hopIdx === 0;
                        const isTarget = hopIdx === pathway.hops.length - 1;
                        const bankName = pathway.providerNames?.[hopIdx] || hopId;

                        return (
                          <React.Fragment key={`${hopId}-${hopIdx}`}>
                            <div
                              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs ${
                                isOrigin
                                  ? 'bg-purple-50/80 border-purple-200 text-purple-900 font-bold'
                                  : isTarget
                                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900 font-bold'
                                  : 'bg-slate-50 border-slate-200 text-slate-800 font-semibold'
                              }`}
                            >
                              <div
                                className={`w-2 h-2 rounded-full ${
                                  isOrigin
                                    ? 'bg-purple-600'
                                    : isTarget
                                    ? 'bg-emerald-600'
                                    : 'bg-slate-400'
                                }`}
                              />
                              <div>
                                <span className="block">{bankName}</span>
                                <span className="block text-[10px] font-mono text-slate-400 font-normal">
                                  {hopId}
                                </span>
                              </div>
                            </div>

                            {!isTarget && (
                              <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>

                  {/* Intermediate Banks Breakdown */}
                  {pathway.intermediateHops && pathway.intermediateHops.length > 0 && (
                    <div className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl mb-4 text-xs">
                      <span className="text-slate-500 font-medium">Intermediate Banks ({pathway.intermediateHops.length}): </span>
                      <strong className="text-slate-800">
                        {pathway.intermediateNames?.join(' → ') || pathway.intermediateHops.join(' → ')}
                      </strong>
                    </div>
                  )}

                  {/* Route Key Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
                    <div className="p-2.5 rounded-lg bg-slate-50/70 border border-slate-100">
                      <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">
                        <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Total Cost</span>
                      </div>
                      <span className="text-base font-black text-slate-900">
                        ${pathway.totalCost.toFixed(2)}
                      </span>
                      <span className="block text-[10px] text-slate-400">Total rail fee</span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-50/70 border border-slate-100">
                      <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">
                        <Clock className="w-3.5 h-3.5 text-blue-600" />
                        <span>Total Latency</span>
                      </div>
                      <span className="text-base font-black text-slate-900">
                        {pathway.totalLatencyMs} ms
                      </span>
                      <span className="block text-[10px] text-slate-400">Transit duration</span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-50/70 border border-slate-100">
                      <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                        <span>Reliability</span>
                      </div>
                      <span className="text-base font-black text-purple-700">
                        {(pathway.cumulativeReliability * 100).toFixed(1)}%
                      </span>
                      <span className="block text-[10px] text-slate-400">Packet success rate</span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-50/70 border border-slate-100">
                      <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">
                        <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
                        <span>Risk Factor</span>
                      </div>
                      <span
                        className={`text-base font-black ${
                          pathway.riskFactor > 5
                            ? 'text-rose-600'
                            : pathway.riskFactor > 2
                            ? 'text-amber-600'
                            : 'text-emerald-600'
                        }`}
                      >
                        {pathway.riskFactor}%
                      </span>
                      <span className="block text-[10px] text-slate-400">Failure likelihood</span>
                    </div>
                  </div>

                  {/* Route Explanation */}
                  {pathway.explanation && (
                    <div className="mt-3 text-[11px] text-slate-500 bg-slate-50/50 p-2.5 rounded-lg border border-slate-100 flex items-start gap-2">
                      <Info className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5" />
                      <span>{pathway.explanation}</span>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
export default UnifiedRouteSimulator;

