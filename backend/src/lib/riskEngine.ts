import { RiskDecisionType, ITransactionSignals } from '../models/Transaction';

export interface RiskEvaluationInput {
  amount: number;
  currency: string;
  sourceCountry: string;
  destinationCountry: string;
  signals: ITransactionSignals;
}

export interface RiskEvaluationResult {
  riskScore: number;
  riskDecision: RiskDecisionType;
  status: string;
  contributingFactors: string[];
  recommendedAction: string;
  breakdown: string[]; // Maintained for backwards-compatibility
}

/**
 * Deterministic Rule-Based Risk Engine for TrustRoute.
 * Note: This is an explicit deterministic rules engine (not a machine-learning model).
 * It evaluates transaction and telecom risk signals consistently to produce deterministic,
 * reproducible decisions.
 *
 * Scoring Rules (Scale 0 - 100):
 * 1. Base Score: +10 (baseline transaction monitoring)
 * 2. Recent SIM Swap (last 24 hours):
 *    - MANDATORY RULE: A SIM swap detected within previous 24h ALWAYS results in BLOCKED.
 *    - Adds +70 points.
 * 3. Phone Number Verification:
 *    - Unverified: +25 points
 *    - Verified: +0 points
 * 4. Device Integrity:
 *    - SUSPICIOUS (emulator, rooted, mismatched fingerprint): +30 points
 *    - UNKNOWN (new device, incognito session): +15 points
 *    - TRUSTED: +0 points
 * 5. Transaction Value Tiers:
 *    - > 50,000: +30 points (High value cross-border transfer)
 *    - > 10,000: +15 points (Substantial transfer)
 *    - > 5,000:  +5 points (Moderate transfer)
 * 6. Corridor:
 *    - Cross-border (source != destination): +5 points
 *    - Domestic: +0 points
 *
 * Decision Thresholds:
 * - BLOCKED: simSwap24h === true OR riskScore >= 70
 * - STEP_UP: riskScore >= 35 AND riskScore < 70
 * - APPROVED: riskScore < 35
 */
export function calculateRiskDecision(input: RiskEvaluationInput): RiskEvaluationResult {
  let score = 10;
  const contributingFactors: string[] = ['Baseline transaction monitoring (+10)'];

  // 1. Mandatory SIM Swap Signal Evaluation
  if (input.signals.simSwap24h) {
    score += 70;
    contributingFactors.push(
      'CRITICAL: SIM swap detected within previous 24h (+70, Mandatory Rule: immediate BLOCKED decision)'
    );
  }

  // 1b. Zero-Trust Telco Verification Status Check:
  // An unknown result, timeout, authentication error, rate limit, or unsupported number must NEVER be silently interpreted as safe!
  const telcoFailed =
    (input.signals.simSwapVerificationStatus && input.signals.simSwapVerificationStatus !== 'COMPLETED') ||
    (input.signals.numberVerificationStatus && input.signals.numberVerificationStatus !== 'COMPLETED');

  if (telcoFailed) {
    const statusMsg =
      input.signals.simSwapVerificationStatus && input.signals.simSwapVerificationStatus !== 'COMPLETED'
        ? input.signals.simSwapVerificationStatus
        : input.signals.numberVerificationStatus;
    score += 25;
    contributingFactors.push(
      `Zero-Trust Alert: Telecom carrier verification unavailable (${statusMsg}). Signal withheld from instant approval (+25)`
    );
  }

  // 2. Telecom Carrier Number Verification Signal
  if (!input.signals.numberVerified) {
    score += 25;
    contributingFactors.push('Sender mobile phone number unverified with telecom carrier (+25)');
  } else {
    contributingFactors.push('Sender mobile phone number verified with telecom carrier (+0)');
  }

  // 3. Device Status Signal
  const deviceStatusUpper = (input.signals.deviceStatus || '').trim().toUpperCase();
  if (deviceStatusUpper === 'SUSPICIOUS') {
    score += 30;
    contributingFactors.push('Device fingerprint flagged as suspicious or emulator (+30)');
  } else if (deviceStatusUpper === 'UNKNOWN') {
    score += 15;
    contributingFactors.push('New or unrecognized device fingerprint (+15)');
  } else {
    contributingFactors.push('Device fingerprint verified as trusted (+0)');
  }

  // 4. Transaction Value Tier
  if (input.amount > 50000) {
    score += 30;
    contributingFactors.push(
      `High-value transfer (${input.amount.toLocaleString()} ${input.currency} > 50,000) (+30)`
    );
  } else if (input.amount > 10000) {
    score += 15;
    contributingFactors.push(
      `Substantial transfer (${input.amount.toLocaleString()} ${input.currency} > 10,000) (+15)`
    );
  } else if (input.amount > 5000) {
    score += 5;
    contributingFactors.push(
      `Moderate transfer (${input.amount.toLocaleString()} ${input.currency} > 5,000) (+5)`
    );
  } else {
    contributingFactors.push('Standard transaction amount within normal limits (+0)');
  }

  // 5. Corridor Check (Cross-border vs Domestic)
  const isCrossBorder =
    input.sourceCountry.trim().toUpperCase() !== input.destinationCountry.trim().toUpperCase();
  if (isCrossBorder) {
    score += 5;
    contributingFactors.push(
      `Cross-border international corridor (${input.sourceCountry} -> ${input.destinationCountry}) (+5)`
    );
  } else {
    contributingFactors.push('Domestic payment transfer within same country (+0)');
  }

  // Strictly clamp final score between 0 and 100
  const finalScore = Math.min(100, Math.max(0, score));

  // Determine final risk decision and recommended action
  let riskDecision: RiskDecisionType;
  let status: string;
  let recommendedAction: string;

  if (input.signals.simSwap24h) {
    // Mandatory Rule: Recent SIM swap ALWAYS yields BLOCKED
    riskDecision = 'BLOCKED';
    status = 'BLOCKED';
    recommendedAction = 'BLOCK_IMMEDIATE_AND_ALERT_FRAUD_OPS';
  } else if (finalScore >= 70) {
    riskDecision = 'BLOCKED';
    status = 'BLOCKED';
    recommendedAction = 'BLOCK_TRANSACTION_EXCESSIVE_RISK';
  } else if (finalScore >= 35) {
    riskDecision = 'STEP_UP';
    status = 'STEP_UP_REQUIRED';
    recommendedAction = 'REQUIRE_OUT_OF_BAND_MFA_AUTHENTICATION';
  } else {
    riskDecision = 'APPROVED';
    status = 'APPROVED';
    recommendedAction = 'PROCEED_WITH_INTELLIGENT_ROUTING';
  }

  return {
    riskScore: finalScore,
    riskDecision,
    status,
    contributingFactors,
    recommendedAction,
    breakdown: contributingFactors,
  };
}
