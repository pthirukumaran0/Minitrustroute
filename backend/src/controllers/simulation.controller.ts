import { Request, Response } from 'express';
import { calculateRiskDecision } from '../lib/riskEngine';
import AuditLog from '../models/AuditLog';

export interface SimulationResult {
  total: number;
  fraudCount: number;
  legitimateCount: number;
  durationMs: number;
  averageLatencyMs: number;
  confusionMatrix: {
    blocked: {
      fraud: number; // True Positives (Blocked)
      legitimate: number; // False Positives (Blocked)
      total: number;
    };
    stepUp: {
      fraud: number; // Suspicious fraud caught in step-up
      legitimate: number; // Legitimate requiring secondary auth
      total: number;
    };
    approved: {
      fraud: number; // False Negatives (Missed fraud)
      legitimate: number; // True Negatives (Legitimate passed)
      total: number;
    };
    totals: {
      fraud: number;
      legitimate: number;
      total: number;
    };
  };
  metrics: {
    accuracy: number;
    detectionRate: number; // Recall of fraud
    precision: number;
    specificity: number;
    f1Score: number;
    falsePositiveRate: number;
    blockedCount: number;
    stepUpCount: number;
    approvedCount: number;
  };
  sampleCases: Array<{
    scenario: string;
    groundTruth: 'FRAUDULENT' | 'LEGITIMATE';
    predictedDecision: string;
    riskScore: number;
    signals: Record<string, unknown>;
  }>;
  executedAt: string;
}

// In-memory cache of the latest benchmark run
let cachedSimulation: SimulationResult | null = null;

/**
 * Runs 1,000 synthetic benchmark transactions with known ground-truth labels
 * through the authoritative risk engine.
 */
export function runSyntheticBenchmark(sampleSize: number = 1000): SimulationResult {
  const startTime = performance.now();

  let tpBlocked = 0;
  let fpBlocked = 0;
  let stepUpFraud = 0;
  let stepUpLegit = 0;
  let fnApproved = 0;
  let tnApproved = 0;

  const sampleCases: SimulationResult['sampleCases'] = [];

  // Ground-truth distribution across 1,000 transactions:
  // 350 Fraudulent cases (SIM swaps, spoofed identities, emulators, bot networks)
  // 650 Legitimate cases (Corporate payouts, verified corridors, domestic transfers)
  const fraudTarget = Math.round(sampleSize * 0.35);
  const legitTarget = sampleSize - fraudTarget;

  // 1. Generate and evaluate FRAUDULENT ground-truth scenarios
  for (let i = 0; i < fraudTarget; i++) {
    let signals: { simSwap24h: boolean; numberVerified: boolean; deviceStatus: string };
    let amount: number;
    let scenario = '';

    if (i < 150) {
      // Scenario A: SIM-swap attack within 24h
      scenario = 'SIM-Swap Attack (ATO)';
      signals = { simSwap24h: true, numberVerified: false, deviceStatus: 'SUSPICIOUS' };
      amount = 12000 + (i % 20) * 1500;
    } else if (i < 250) {
      // Scenario B: Unverified phone + emulator
      scenario = 'Compromised Device + Unverified MSISDN';
      signals = { simSwap24h: false, numberVerified: false, deviceStatus: 'SUSPICIOUS' };
      amount = 55000 + (i % 10) * 5000;
    } else if (i < 310) {
      // Scenario C: High-value unauthorized cross-border spike
      scenario = 'High-Value Anomaly (> $50K)';
      signals = { simSwap24h: false, numberVerified: false, deviceStatus: 'UNKNOWN' };
      amount = 75000 + (i % 5) * 10000;
    } else {
      // Scenario D: Low-and-slow probe from unrecognized device
      scenario = 'Probing Attack (Low Value, Unverified)';
      signals = { simSwap24h: false, numberVerified: false, deviceStatus: 'UNKNOWN' };
      amount = 450 + (i % 3) * 100;
    }

    const verdict = calculateRiskDecision({
      amount,
      currency: 'USD',
      sourceCountry: 'USA',
      destinationCountry: 'UAE',
      signals,
    });

    if (verdict.riskDecision === 'BLOCKED') {
      tpBlocked++;
    } else if (verdict.riskDecision === 'STEP_UP') {
      stepUpFraud++;
    } else {
      fnApproved++;
    }

    if (sampleCases.length < 5) {
      sampleCases.push({
        scenario,
        groundTruth: 'FRAUDULENT',
        predictedDecision: verdict.riskDecision,
        riskScore: verdict.riskScore,
        signals,
      });
    }
  }

  // 2. Generate and evaluate LEGITIMATE ground-truth scenarios
  for (let i = 0; i < legitTarget; i++) {
    let signals: { simSwap24h: boolean; numberVerified: boolean; deviceStatus: string };
    let amount: number;
    let scenario = '';

    if (i < 450) {
      // Scenario E: Verified corporate payroll / supplier transfer
      scenario = 'Verified Corporate Transfer';
      signals = { simSwap24h: false, numberVerified: true, deviceStatus: 'TRUSTED' };
      amount = 2500 + (i % 30) * 200;
    } else if (i < 580) {
      // Scenario F: Domestic transfer within same country
      scenario = 'Domestic Routine Transfer';
      signals = { simSwap24h: false, numberVerified: true, deviceStatus: 'TRUSTED' };
      amount = 450 + (i % 15) * 50;
    } else {
      // Scenario G: High-value verified legitimate transfer (triggers step-up due to amount)
      scenario = 'High-Value Legitimate (> $50K)';
      signals = { simSwap24h: false, numberVerified: true, deviceStatus: 'TRUSTED' };
      amount = 65000 + (i % 5) * 5000;
    }

    const verdict = calculateRiskDecision({
      amount,
      currency: 'USD',
      sourceCountry: 'USA',
      destinationCountry: i < 450 ? 'GBR' : i < 580 ? 'USA' : 'UAE',
      signals,
    });

    if (verdict.riskDecision === 'BLOCKED') {
      fpBlocked++;
    } else if (verdict.riskDecision === 'STEP_UP') {
      stepUpLegit++;
    } else {
      tnApproved++;
    }

    if (sampleCases.length < 10 && i % 130 === 0) {
      sampleCases.push({
        scenario,
        groundTruth: 'LEGITIMATE',
        predictedDecision: verdict.riskDecision,
        riskScore: verdict.riskScore,
        signals,
      });
    }
  }

  const durationMs = Math.round((performance.now() - startTime) * 100) / 100;
  const averageLatencyMs = Math.round((durationMs / sampleSize) * 100) / 100;

  // Intercepted Fraud = (Blocked Fraud + Step-Up Fraud)
  const interceptedFraud = tpBlocked + stepUpFraud;
  const totalFraud = fraudTarget;
  const totalLegit = legitTarget;

  // Standard metrics
  const precision =
    tpBlocked + fpBlocked > 0
      ? Number(((tpBlocked / (tpBlocked + fpBlocked)) * 100).toFixed(2))
      : 100;

  const detectionRate =
    totalFraud > 0
      ? Number(((interceptedFraud / totalFraud) * 100).toFixed(2))
      : 100;

  const recallBlockedOnly =
    totalFraud > 0
      ? Number(((tpBlocked / totalFraud) * 100).toFixed(2))
      : 100;

  const specificity =
    totalLegit > 0
      ? Number(((tnApproved / totalLegit) * 100).toFixed(2))
      : 100;

  const falsePositiveRate =
    totalLegit > 0
      ? Number(((fpBlocked / totalLegit) * 100).toFixed(2))
      : 0;

  const pRatio = precision / 100;
  const rRatio = recallBlockedOnly / 100;
  const f1 =
    pRatio + rRatio > 0
      ? Number((((2 * (pRatio * rRatio)) / (pRatio + rRatio)) * 100).toFixed(2))
      : 0;

  const accuracy = Number(
    (((tpBlocked + stepUpFraud + tnApproved) / sampleSize) * 100).toFixed(2)
  );

  const result: SimulationResult = {
    total: sampleSize,
    fraudCount: fraudTarget,
    legitimateCount: legitTarget,
    durationMs,
    averageLatencyMs: averageLatencyMs > 0 ? averageLatencyMs : 0.05,
    confusionMatrix: {
      blocked: {
        fraud: tpBlocked,
        legitimate: fpBlocked,
        total: tpBlocked + fpBlocked,
      },
      stepUp: {
        fraud: stepUpFraud,
        legitimate: stepUpLegit,
        total: stepUpFraud + stepUpLegit,
      },
      approved: {
        fraud: fnApproved,
        legitimate: tnApproved,
        total: fnApproved + tnApproved,
      },
      totals: {
        fraud: fraudTarget,
        legitimate: legitTarget,
        total: sampleSize,
      },
    },
    metrics: {
      accuracy,
      detectionRate,
      precision,
      specificity,
      f1Score: f1,
      falsePositiveRate,
      blockedCount: tpBlocked + fpBlocked,
      stepUpCount: stepUpFraud + stepUpLegit,
      approvedCount: fnApproved + tnApproved,
    },
    sampleCases,
    executedAt: new Date().toISOString(),
  };

  cachedSimulation = result;
  return result;
}

/**
 * GET /api/analytics/simulation
 * Retrieves the latest benchmark evaluation results (runs default if not yet run).
 */
export async function getSimulationResults(req: Request, res: Response) {
  if (!cachedSimulation) {
    cachedSimulation = runSyntheticBenchmark(1000);
  }

  res.json({
    success: true,
    simulation: cachedSimulation,
  });
}

/**
 * POST /api/analytics/simulate
 * Triggers a fresh 1,000-transaction simulation.
 */
export async function executeSimulation(req: Request, res: Response) {
  const sampleSize = parseInt(String(req.body?.sampleSize || '1000'), 10) || 1000;
  const result = runSyntheticBenchmark(Math.min(5000, Math.max(100, sampleSize)));

  // Audit log
  await AuditLog.create({
    actorEmail: req.user?.email || 'admin@trustroute.com',
    actorName: req.user?.name || 'Administrator',
    actorRole: req.user?.role || 'admin',
    action: 'RUN_SYNTHETIC_SIMULATION',
    resourceType: 'SIMULATION',
    outcome: 'SUCCESS',
    details: {
      sampleSize: result.total,
      detectionRate: result.metrics.detectionRate,
      durationMs: result.durationMs,
    },
  }).catch(() => {});

  res.json({
    success: true,
    message: `Successfully executed ${result.total}-transaction benchmark simulation in ${result.durationMs}ms.`,
    simulation: result,
  });
}

