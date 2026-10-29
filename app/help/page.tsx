'use client';

import React from 'react';
import Link from 'next/link';
import { Card } from '@/src/components/ui/Card';
import {
  HelpCircle,
  Shield,
  Layers,
  Database,
  GitFork,
  Smartphone,
  Lock,
  ExternalLink,
  BookOpen,
  Code2,
  FileCheck2,
  Terminal,
} from 'lucide-react';

export default function HelpAndArchitecturePage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <HelpCircle className="w-6 h-6 text-blue-600" />
            System Documentation & Architecture Handbook
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Complete technical specification, algorithmic formulas, and academic review reference for TrustRoute.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/payment"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs transition-colors"
          >
            Launch Payment Simulator
          </Link>
        </div>
      </div>

      {/* 1. Academic & Project Summary Callout */}
      <Card className="p-6 bg-slate-950 border-slate-800 text-white space-y-3">
        <div className="flex items-center gap-2 text-blue-400 font-bold text-xs uppercase tracking-wider">
          <BookOpen className="w-4 h-4" />
          Final-Year Engineering Mini-Project
        </div>
        <h2 className="text-xl font-black tracking-tight text-white">
          TrustRoute: AI-Powered Secure Cross-Border Payment Router
        </h2>
        <p className="text-xs text-slate-300 leading-relaxed max-w-4xl">
          TrustRoute addresses systemic vulnerabilities in traditional cross-border financial rails: opaque correspondent banking fees, multi-day settlement latency, and account takeover (ATO) fraud driven by SIM swap attacks. By synthesizing server-side GSMA telecom security signals with Neo4j graph algorithms (Multi-Objective Dijkstra and Yen&apos;s K-Shortest Paths), TrustRoute guarantees fraud mitigation prior to capital commitment.
        </p>
      </Card>

      {/* 2. Dual-Database Architectural Design */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
          Dual-Database Architecture
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center gap-2.5">
              <Database className="w-5 h-5 text-emerald-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  MongoDB (Document Ledger)
                </h3>
                <span className="text-[11px] text-slate-400">
                  Transactional Consistency & Audit Logging
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              MongoDB serves as the authoritative, tamper-evident ledger for all financial transactions. It stores full telemetry payloads (MSISDN status, device fingerprint, SIM swap history), server risk evaluation scores, and immutable audit timestamps with zero data loss.
            </p>
            <ul className="text-xs text-slate-500 space-y-1 font-mono pt-1">
              <li>• Model: Transaction (Mongoose 9.x)</li>
              <li>• Indexes: transactionId (unique), createdAt (-1), riskDecision</li>
              <li>• Storage Mode: Single database & collection isolation</li>
            </ul>
          </Card>

          <Card className="p-5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center gap-2.5">
              <Layers className="w-5 h-5 text-blue-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Neo4j (Labeled Property Graph)
                </h3>
                <span className="text-[11px] text-slate-400">
                  Network Topology & Shortest-Path Discovery
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Neo4j models the global correspondent payment network. Nodes represent Payment Gateways, Intermediary Clearing Systems, and Destination Commercial Banks. Directed <code className="font-mono text-blue-500">CONNECTS_TO</code> relationships maintain base fee, transit latency, SLA reliability, and sanction availability flags.
            </p>
            <ul className="text-xs text-slate-500 space-y-1 font-mono pt-1">
              <li>• Driver: Official neo4j-driver v5.x via Bolt</li>
              <li>• Algorithms: Dijkstra Multi-Objective + Yen&apos;s KSP</li>
              <li>• Dynamic Circuit Breaking: Administrative rail toggles</li>
            </ul>
          </Card>
        </div>
      </div>

      {/* 3. Mathematical Foundations & Algorithms */}
      <Card className="p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 space-y-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
          <GitFork className="w-4 h-4 text-blue-600" />
          Algorithmic Formulation
        </h2>

        <div className="space-y-4 text-xs">
          {/* Risk Formula */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
            <h3 className="font-bold text-slate-900 dark:text-white">
              1. Deterministic Telecom Risk Scoring Engine
            </h3>
            <p className="text-slate-600 dark:text-slate-300">
              Unlike unpredictable black-box heuristics, TrustRoute enforces a deterministic, zero-trust rule matrix evaluated exclusively on the server:
            </p>
            <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded font-mono text-[11px] text-slate-800 dark:text-slate-200">
              RiskScore = SIMSwap24h(+100) + UnverifiedPhone(+25) + SuspiciousDevice(+35) + HighValue(+15)
            </div>
            <ul className="list-disc list-inside text-slate-500 space-y-0.5">
              <li><strong>Score ≤ 30:</strong> APPROVED — Low risk; payment route is computed and executed.</li>
              <li><strong>Score 31–70:</strong> STEP_UP — Medium risk; payment is quarantined pending MFA. No route executed.</li>
              <li><strong>Score ≥ 71:</strong> BLOCKED — High risk; transaction permanently rejected. No route executed.</li>
              <li><strong>Mandatory SIM Swap Rule:</strong> An active SIM swap within 24h triggers an automatic +100 penalty resulting in immediate BLOCKED status regardless of other factors.</li>
            </ul>
          </div>

          {/* Dijkstra Multi-Objective Formula */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
            <h3 className="font-bold text-slate-900 dark:text-white">
              2. Multi-Objective Dijkstra Shortest Path
            </h3>
            <p className="text-slate-600 dark:text-slate-300">
              Given a directed graph G = (V, E), edge weight W(e) represents a composite trade-off between transit fee and settlement latency:
            </p>
            <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded font-mono text-[11px] text-slate-800 dark:text-slate-200">
              W(e) = α · (BaseCost(e) / MaxCost) + β · (LatencyMs(e) / MaxLatency)
            </div>
            <p className="text-slate-500">
              Subject to constraints: Reliability(e) ≥ 0.95 and isAvailable(e) = true and prohibited(e) = false.
            </p>
          </div>

          {/* Yen's Algorithm */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
            <h3 className="font-bold text-slate-900 dark:text-white">
              3. Yen&apos;s K-Shortest Loopless Paths Algorithm
            </h3>
            <p className="text-slate-600 dark:text-slate-300">
              Discovers alternative routes A[1], A[2], ..., A[K-1] by iteratively taking prefix sub-paths of previously discovered routes and finding deviation paths to the destination while temporarily masking edges to guarantee loopless candidate diversity.
            </p>
          </div>
        </div>
      </Card>

      {/* 4. Evaluator Review Cheat-Sheet / FAQ */}
      <Card className="p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 space-y-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
          <FileCheck2 className="w-4 h-4 text-emerald-600" />
          Academic Evaluator Review Cheat-Sheet & FAQ
        </h2>

        <div className="space-y-3 text-xs">
          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <p className="font-bold text-slate-900 dark:text-white">
              Q: Why is SIM swap checked prior to route generation?
            </p>
            <p className="text-slate-600 dark:text-slate-300 mt-1">
              <strong>A:</strong> Account takeover (ATO) fraud via unauthorized SIM porting allows attackers to intercept SMS one-time passwords. Executing cross-border settlements before verifying SIM swap state risks irrevocable loss of funds. TrustRoute enforces a hard circuit breaker: if SIM swap &lt; 24h is detected, the transaction is immediately BLOCKED and routing calculations are aborted.
            </p>
          </div>

          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <p className="font-bold text-slate-900 dark:text-white">
              Q: Why are currency volumes reported separately rather than summed together?
            </p>
            <p className="text-slate-600 dark:text-slate-300 mt-1">
              <strong>A:</strong> Adding USD, EUR, and INR amounts without live spot-rate conversions violates basic accounting and audit standards. TrustRoute segregates transfer volume by currency pool, displaying separate totals and ticket averages for financial accuracy.
            </p>
          </div>

          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <p className="font-bold text-slate-900 dark:text-white">
              Q: How does the system handle unreachable or disconnected corridors?
            </p>
            <p className="text-slate-600 dark:text-slate-300 mt-1">
              <strong>A:</strong> The routing engine traverses the Neo4j graph using true adjacency lists. If no path exists to an isolated node (such as <code className="font-mono">Bank-Isolated-Pacific</code>) or if an intermediary link is set to PROHIBITED in the admin console, the engine cleanly returns a structured error without crashing or inventing synthetic hops.
            </p>
          </div>

          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <p className="font-bold text-slate-900 dark:text-white">
              Q: How does the architecture prevent client-side decision tampering?
            </p>
            <p className="text-slate-600 dark:text-slate-300 mt-1">
              <strong>A:</strong> All decisions, risk scores, and routes are computed strictly inside Next.js server-side API routes (<code className="font-mono">/api/transactions</code>). Client requests only submit transaction parameters and signals; even if a malicious client sends <code className="font-mono">riskDecision: APPROVED</code>, the server completely disregards it and recalculates the verdict.
            </p>
          </div>
        </div>
      </Card>

      {/* 5. API Reference Cheatsheet */}
      <Card className="overflow-hidden border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Terminal className="w-4 h-4 text-blue-600" />
            Backend API Reference Quick Reference
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 uppercase tracking-wider font-sans font-semibold">
              <tr>
                <th className="px-4 py-2.5">Endpoint</th>
                <th className="px-4 py-2.5">Method</th>
                <th className="px-4 py-2.5">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-sans">
              <tr>
                <td className="px-4 py-2.5 font-mono text-blue-600 font-bold">/api/health</td>
                <td className="px-4 py-2.5 font-mono font-bold text-emerald-600">GET</td>
                <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                  Validates MongoDB & Neo4j connectivity and latency.
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-mono text-blue-600 font-bold">/api/transactions</td>
                <td className="px-4 py-2.5 font-mono font-bold text-emerald-600">GET</td>
                <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                  Retrieves filtered transactions with pagination and sorting.
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-mono text-blue-600 font-bold">/api/transactions</td>
                <td className="px-4 py-2.5 font-mono font-bold text-blue-600">POST</td>
                <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                  Validates payload, executes risk rules, routes via Neo4j, commits to MongoDB.
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-mono text-blue-600 font-bold">/api/network</td>
                <td className="px-4 py-2.5 font-mono font-bold text-emerald-600">GET</td>
                <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                  Fetches all 9 provider nodes and directed interbank rails from Neo4j.
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-mono text-blue-600 font-bold">/api/network/route-preview</td>
                <td className="px-4 py-2.5 font-mono font-bold text-blue-600">POST</td>
                <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                  Simulates Dijkstra shortest path and Yen&apos;s K alternatives without database writes.
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-mono text-blue-600 font-bold">/api/network/connections</td>
                <td className="px-4 py-2.5 font-mono font-bold text-amber-600">PATCH</td>
                <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                  Admin route to toggle edge availability or set prohibitions (requires x-admin-key).
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-mono text-blue-600 font-bold">/api/analytics</td>
                <td className="px-4 py-2.5 font-mono font-bold text-emerald-600">GET</td>
                <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                  Aggregates transaction volumes, risk distributions, and conversion metrics.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

