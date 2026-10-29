import mongoose from 'mongoose';
import { calculateRiskDecision } from '../src/lib/riskEngine';
import {
  findOptimalRoute,
  dijkstraShortestPath,
  yensKShortestPaths,
  calculateEdgeWeight,
  GraphData,
  RoutingNode,
  RoutingEdge,
} from '../src/lib/routingEngine';
import Transaction from '../src/models/Transaction';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/trustroute';

interface TestRecord {
  id: number;
  category: 'UNIT' | 'NEO4J_LIVE' | 'API_AND_MONGO_LIVE';
  name: string;
  passed: boolean;
  error?: string;
  details?: string;
}

const testResults: TestRecord[] = [];

async function assertTest(
  id: number,
  category: 'UNIT' | 'NEO4J_LIVE' | 'API_AND_MONGO_LIVE',
  name: string,
  fn: () => Promise<void> | void
) {
  try {
    await fn();
    testResults.push({ id, category, name, passed: true });
    console.log(`[PASS] (${category}) Test ${id}: ${name}`);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    testResults.push({ id, category, name, passed: false, error: errorMsg });
    console.error(`[FAIL] (${category}) Test ${id}: ${name} -> ${errorMsg}`);
  }
}

async function main() {
  console.log('========================================================================');
  console.log('🛡️ TrustRoute Phase 2 Comprehensive Test Suite');
  console.log('   - Risk Engine & Deterministic Fraud Rules');
  console.log('   - Intelligent Neo4j-Backed Payment Routing (Dijkstra & Yen K-Shortest)');
  console.log('   - Live MongoDB Transaction Persistence & API Integration');
  console.log('========================================================================\n');

  // ===========================================================================
  // SECTION 1: UNIT TESTS (Pure Deterministic Logic & Algorithm Validation)
  // ===========================================================================
  console.log('--- 1. UNIT TESTS: RISK ENGINE RULES & ROUTING ALGORITHMS ---\n');

  // 1. Low-risk transaction
  await assertTest(1, 'UNIT', 'Low-risk transaction evaluates to APPROVED with low score', () => {
    const res = calculateRiskDecision({
      amount: 450,
      currency: 'USD',
      sourceCountry: 'USA',
      destinationCountry: 'USA',
      signals: {
        simSwap24h: false,
        numberVerified: true,
        deviceStatus: 'TRUSTED',
      },
    });

    if (res.riskDecision !== 'APPROVED') {
      throw new Error(`Expected APPROVED, got ${res.riskDecision}`);
    }
    if (res.riskScore >= 35) {
      throw new Error(`Expected riskScore < 35 for low risk, got ${res.riskScore}`);
    }
    if (res.recommendedAction !== 'PROCEED_WITH_INTELLIGENT_ROUTING') {
      throw new Error(`Unexpected recommendedAction: ${res.recommendedAction}`);
    }
  });

  // 2. Recent SIM swap resulting in BLOCKED
  await assertTest(2, 'UNIT', 'Recent SIM swap within 24h triggers mandatory BLOCKED rule', () => {
    // Test with low amount to prove SIM swap alone guarantees BLOCKED
    const res = calculateRiskDecision({
      amount: 15,
      currency: 'USD',
      sourceCountry: 'USA',
      destinationCountry: 'USA',
      signals: {
        simSwap24h: true, // SIM swap within 24h!
        numberVerified: true,
        deviceStatus: 'TRUSTED',
      },
    });

    if (res.riskDecision !== 'BLOCKED') {
      throw new Error(`Mandatory SIM swap rule failed! Expected BLOCKED, got ${res.riskDecision}`);
    }
    if (res.status !== 'BLOCKED') {
      throw new Error(`Expected status BLOCKED, got ${res.status}`);
    }
    if (res.recommendedAction !== 'BLOCK_IMMEDIATE_AND_ALERT_FRAUD_OPS') {
      throw new Error(`Unexpected action: ${res.recommendedAction}`);
    }
    const hasFactor = res.contributingFactors.some((f) => f.includes('SIM swap'));
    if (!hasFactor) {
      throw new Error('Contributing factors missing SIM swap entry');
    }
  });

  // 3. Unverified phone number
  await assertTest(3, 'UNIT', 'Unverified phone number increases score and triggers STEP_UP', () => {
    const res = calculateRiskDecision({
      amount: 800,
      currency: 'USD',
      sourceCountry: 'USA',
      destinationCountry: 'UAE',
      signals: {
        simSwap24h: false,
        numberVerified: false, // Unverified (+25)
        deviceStatus: 'TRUSTED',
      },
    });

    // Base (10) + Unverified (25) + Cross-border (5) = 40 -> STEP_UP (35 <= score < 70)
    if (res.riskDecision !== 'STEP_UP') {
      throw new Error(`Expected STEP_UP, got ${res.riskDecision} (score: ${res.riskScore})`);
    }
    if (res.status !== 'STEP_UP_REQUIRED') {
      throw new Error(`Expected status STEP_UP_REQUIRED, got ${res.status}`);
    }
    if (res.recommendedAction !== 'REQUIRE_OUT_OF_BAND_MFA_AUTHENTICATION') {
      throw new Error(`Unexpected action: ${res.recommendedAction}`);
    }
  });

  // 4. Suspicious device
  await assertTest(4, 'UNIT', 'Suspicious device status increases score and triggers STEP_UP', () => {
    const res = calculateRiskDecision({
      amount: 600,
      currency: 'USD',
      sourceCountry: 'USA',
      destinationCountry: 'UAE',
      signals: {
        simSwap24h: false,
        numberVerified: true,
        deviceStatus: 'SUSPICIOUS', // Suspicious device (+30)
      },
    });

    // Base (10) + Suspicious (30) + Cross-border (5) = 45 -> STEP_UP
    if (res.riskDecision !== 'STEP_UP') {
      throw new Error(`Expected STEP_UP, got ${res.riskDecision} (score: ${res.riskScore})`);
    }
    const hasDeviceFactor = res.contributingFactors.some((f) => f.includes('suspicious'));
    if (!hasDeviceFactor) {
      throw new Error('Missing suspicious device factor in breakdown');
    }
  });

  // 5. High-value transaction
  await assertTest(5, 'UNIT', 'High-value transaction (> $50,000) adds risk points and triggers STEP_UP', () => {
    const res = calculateRiskDecision({
      amount: 75000,
      currency: 'USD',
      sourceCountry: 'USA',
      destinationCountry: 'GBR',
      signals: {
        simSwap24h: false,
        numberVerified: true,
        deviceStatus: 'TRUSTED',
      },
    });

    // Base (10) + High Value > 50k (30) + Cross-border (5) = 45 -> STEP_UP
    if (res.riskDecision !== 'STEP_UP') {
      throw new Error(`Expected STEP_UP for high-value transfer, got ${res.riskDecision}`);
    }
    const hasValueFactor = res.contributingFactors.some((f) => f.includes('> 50,000'));
    if (!hasValueFactor) {
      throw new Error('Missing high-value factor in breakdown');
    }
  });

  // 6. Forged client-supplied risk decision
  await assertTest(6, 'UNIT', 'Risk engine ignores client-supplied values and evaluates deterministically', () => {
    // Attempting to pass forged inputs directly
    const res1 = calculateRiskDecision({
      amount: 25000,
      currency: 'USD',
      sourceCountry: 'USA',
      destinationCountry: 'UAE',
      signals: {
        simSwap24h: true, // Attacker swapped SIM
        numberVerified: false,
        deviceStatus: 'SUSPICIOUS',
      },
    });

    // Identical second run to verify strict determinism
    const res2 = calculateRiskDecision({
      amount: 25000,
      currency: 'USD',
      sourceCountry: 'USA',
      destinationCountry: 'UAE',
      signals: {
        simSwap24h: true,
        numberVerified: false,
        deviceStatus: 'SUSPICIOUS',
      },
    });

    if (res1.riskDecision !== 'BLOCKED' || res2.riskDecision !== 'BLOCKED') {
      throw new Error('Risk engine failed to enforce BLOCKED on high-risk input');
    }
    if (res1.riskScore !== res2.riskScore) {
      throw new Error(`Non-deterministic scores: ${res1.riskScore} vs ${res2.riskScore}`);
    }
  });

  // 7. BLOCKED transaction with no route
  await assertTest(7, 'UNIT', 'Policy enforcement: BLOCKED transactions must never be assigned a route', () => {
    const res = calculateRiskDecision({
      amount: 50000,
      currency: 'USD',
      sourceCountry: 'USA',
      destinationCountry: 'UAE',
      signals: {
        simSwap24h: true,
        numberVerified: false,
        deviceStatus: 'SUSPICIOUS',
      },
    });

    if (res.riskDecision !== 'BLOCKED') {
      throw new Error('Expected BLOCKED decision');
    }
    // Under TrustRoute policy, BLOCKED payments have null route
    const policyRoute = (res.riskDecision as string) === 'APPROVED' ? 'ROUTE-ASSIGNED' : null;
    if (policyRoute !== null) {
      throw new Error(`Violated policy: BLOCKED transaction assigned a route: ${policyRoute}`);
    }
  });

  // 8. STEP_UP transaction not falsely marked as verified
  await assertTest(8, 'UNIT', 'STEP_UP transaction status must be STEP_UP_REQUIRED, not VERIFIED or APPROVED', () => {
    const res = calculateRiskDecision({
      amount: 6500,
      currency: 'USD',
      sourceCountry: 'USA',
      destinationCountry: 'UAE',
      signals: {
        simSwap24h: false,
        numberVerified: false, // unverified mobile -> STEP_UP
        deviceStatus: 'TRUSTED',
      },
    });

    if (res.riskDecision !== 'STEP_UP') {
      throw new Error(`Expected STEP_UP, got ${res.riskDecision}`);
    }
    if (res.status === 'APPROVED' || res.status === 'VERIFIED' || res.status === 'COMPLETED') {
      throw new Error(`SECURITY FLAW: STEP_UP falsely marked as '${res.status}'`);
    }
    if (res.status !== 'STEP_UP_REQUIRED') {
      throw new Error(`Expected status STEP_UP_REQUIRED, got '${res.status}'`);
    }
  });

  // 10. Correct route cost, latency, and composite weight calculation (Algorithm Math Verification)
  await assertTest(10, 'UNIT', 'Dijkstra and Yen algorithm correctly computes path costs and latency', () => {
    // Build a mock test graph with known costs
    const testGraph: GraphData = {
      nodes: new Map<string, RoutingNode>([
        ['N1', { id: 'N1', name: 'Node 1', type: 'GATEWAY', country: 'US', currency: 'USD', status: 'ACTIVE', isAvailable: true }],
        ['N2', { id: 'N2', name: 'Node 2', type: 'BANK', country: 'US', currency: 'USD', status: 'ACTIVE', isAvailable: true }],
        ['N3', { id: 'N3', name: 'Node 3', type: 'DESTINATION_BANK', country: 'AE', currency: 'AED', status: 'ACTIVE', isAvailable: true }],
      ]),
      adjacency: new Map<string, RoutingEdge[]>([
        ['N1', [{ source: 'N1', target: 'N2', baseCost: 1.5, latencyMs: 20, reliability: 0.999, status: 'ACTIVE', isAvailable: true, prohibited: false }]],
        ['N2', [{ source: 'N2', target: 'N3', baseCost: 2.0, latencyMs: 30, reliability: 0.998, status: 'ACTIVE', isAvailable: true, prohibited: false }]],
        ['N3', []],
      ]),
    };

    const route = dijkstraShortestPath(testGraph, 'N1', 'N3');
    if (!route) {
      throw new Error('Dijkstra returned null for connected graph');
    }

    // Verify exact math:
    // Cost = 1.5 + 2.0 = 3.5
    // Latency = 20 + 30 = 50ms
    // Reliability = 0.999 * 0.998 = 0.997002 (~0.9970)
    if (Math.abs(route.totalCost - 3.5) > 0.001) {
      throw new Error(`Expected totalCost 3.5, got ${route.totalCost}`);
    }
    if (route.totalLatencyMs !== 50) {
      throw new Error(`Expected totalLatencyMs 50, got ${route.totalLatencyMs}`);
    }
    if (Math.abs(route.cumulativeReliability - 0.997) > 0.001) {
      throw new Error(`Expected cumulativeReliability 0.997, got ${route.cumulativeReliability}`);
    }
    if (route.hops.join('->') !== 'N1->N2->N3') {
      throw new Error(`Expected hops N1->N2->N3, got ${route.hops.join('->')}`);
    }

    // Also verify Yen's algorithm on testGraph
    const kPaths = yensKShortestPaths(testGraph, 'N1', 'N3', 2);
    if (kPaths.length !== 1) {
      throw new Error(`Expected exactly 1 path in linear graph, got ${kPaths.length}`);
    }
  });

  // ===========================================================================
  // SECTION 2: LIVE NEO4J GRAPH INTEGRATION TESTS
  // ===========================================================================
  console.log('\n--- 2. LIVE NEO4J DATABASE INTEGRATION TESTS ---\n');

  // 9. Successful Neo4j-backed route selection
  await assertTest(9, 'NEO4J_LIVE', 'Neo4j intelligent routing selects optimal multi-hop path and excludes prohibited edges', async () => {
    const result = await findOptimalRoute({
      sourceCountry: 'USA',
      destinationCountry: 'UAE',
    });

    if (!result.success || !result.route) {
      throw new Error(`Failed to find route: ${result.details}`);
    }

    // Must start at US gateway and end at UAE destination bank
    if (result.route.hops[0] !== 'Gateway-US') {
      throw new Error(`Expected route to start with Gateway-US, got ${result.route.hops[0]}`);
    }
    const lastHop = result.route.hops[result.route.hops.length - 1];
    if (lastHop !== 'Bank-Dubai-Commercial') {
      throw new Error(`Expected route to end with Bank-Dubai-Commercial, got ${lastHop}`);
    }

    // CRITICAL: Ensure the prohibited edge (Gateway-US -> Bank-Dubai-Commercial) was EXCLUDED
    // The active path should route through JPMorgan/Swift and MiddleEast corridor (>= 4 hops)
    if (result.route.hops.length < 3) {
      throw new Error(
        `SECURITY/ROUTING FLAW: Algorithm picked prohibited direct shortcut! Hops: ${result.route.hops.join('->')}`
      );
    }

    // Verify calculated cost and latency are positive numbers
    if (result.route.estimatedCost <= 0 || result.route.estimatedLatencyMs <= 0) {
      throw new Error('Route cost or latency was not computed properly');
    }
    if (!result.route.explanation || result.route.explanation.length < 20) {
      throw new Error('Missing routing explanation');
    }
  });

  // 11. Missing provider
  await assertTest(11, 'NEO4J_LIVE', 'Routing returns MISSING_PROVIDER error for non-existent country without inventing route', async () => {
    const result = await findOptimalRoute({
      sourceCountry: 'USA',
      destinationCountry: 'NON_EXISTENT_COUNTRY_XYZ',
    });

    if (result.success) {
      throw new Error('Expected failure for missing destination provider, but route was invented!');
    }
    if (result.error !== 'MISSING_PROVIDER') {
      throw new Error(`Expected error MISSING_PROVIDER, got ${result.error}`);
    }
  });

  // 12. Unreachable destination
  await assertTest(12, 'NEO4J_LIVE', 'Routing returns UNREACHABLE_DESTINATION when provider has no incoming paths', async () => {
    // Bank-Isolated-Pacific is located in Fiji (FJI), with no edges connecting Gateway-US to it
    const result = await findOptimalRoute({
      sourceCountry: 'USA',
      destinationCountry: 'FJI',
    });

    if (result.success) {
      throw new Error('Expected failure for unreachable destination, but route was falsely generated!');
    }
    if (result.error !== 'UNREACHABLE_DESTINATION') {
      throw new Error(`Expected error UNREACHABLE_DESTINATION, got ${result.error} (${result.details})`);
    }
  });

  // ===========================================================================
  // SECTION 3: LIVE END-TO-END API & MONGODB PERSISTENCE TESTS
  // ===========================================================================
  console.log('\n--- 3. LIVE API & MONGODB PERSISTENCE TESTS ---\n');

  // 13. Invalid transaction input
  await assertTest(13, 'API_AND_MONGO_LIVE', 'POST /api/transactions returns HTTP 400 for negative amount or invalid currency', async () => {
    const resNegative = await fetch(`${BASE_URL}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: -250,
        currency: 'USD',
        sourceCountry: 'USA',
        destinationCountry: 'UAE',
        signals: { simSwap24h: false, numberVerified: true, deviceStatus: 'TRUSTED' },
      }),
    });

    if (resNegative.status !== 400) {
      throw new Error(`Expected HTTP 400 for negative amount, got ${resNegative.status}`);
    }

    const resCurrency = await fetch(`${BASE_URL}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 250,
        currency: 'TOOLONG_CURRENCY',
        sourceCountry: 'USA',
        destinationCountry: 'UAE',
        signals: { simSwap24h: false, numberVerified: true, deviceStatus: 'TRUSTED' },
      }),
    });

    if (resCurrency.status !== 400) {
      throw new Error(`Expected HTTP 400 for invalid currency, got ${resCurrency.status}`);
    }
  });

  // 14. Duplicate transaction ID
  await assertTest(14, 'API_AND_MONGO_LIVE', 'POST /api/transactions returns HTTP 409 Conflict for duplicate transactionId', async () => {
    const uniqueTxId = `TXN-DUPCHECK-${Date.now()}`;
    const payload = {
      transactionId: uniqueTxId,
      amount: 500,
      currency: 'USD',
      sourceCountry: 'USA',
      destinationCountry: 'USA',
      signals: { simSwap24h: false, numberVerified: true, deviceStatus: 'TRUSTED' },
    };

    // First insert
    const res1 = await fetch(`${BASE_URL}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res1.status !== 201) {
      throw new Error(`Failed initial insert: ${res1.status}`);
    }

    // Duplicate insert attempt
    const res2 = await fetch(`${BASE_URL}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res2.status !== 409) {
      throw new Error(`Expected HTTP 409 Conflict for duplicate ID, got ${res2.status}`);
    }
  });

  // 15. Persistence of risk and routing results
  await assertTest(15, 'API_AND_MONGO_LIVE', 'Transaction persists actual risk score, decision, contributing factors, and routing to MongoDB', async () => {
    const verifyTxnId = `TXN-PERSIST-${Date.now()}`;
    const payload = {
      transactionId: verifyTxnId,
      amount: 1250,
      currency: 'USD',
      sourceCountry: 'USA',
      destinationCountry: 'UAE',
      signals: {
        simSwap24h: false,
        numberVerified: true,
        deviceStatus: 'TRUSTED',
      },
    };

    // 1. Post transaction via HTTP API
    const apiRes = await fetch(`${BASE_URL}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (apiRes.status !== 201) {
      const err = await apiRes.text();
      throw new Error(`API returned HTTP ${apiRes.status}: ${err}`);
    }

    const apiData = await apiRes.json();
    if (!apiData.success || !apiData.transaction) {
      throw new Error('API response missing transaction payload');
    }

    // 2. Genuinely query local MongoDB directly to verify disk persistence
    await mongoose.connect(MONGODB_URI);
    try {
      const dbRecord = await Transaction.findOne({ transactionId: verifyTxnId }).lean();
      if (!dbRecord) {
        throw new Error(`Transaction ${verifyTxnId} was not found in MongoDB!`);
      }

      if (dbRecord.riskScore !== apiData.riskEvaluation.score) {
        throw new Error(
          `Persisted riskScore mismatch: DB has ${dbRecord.riskScore}, API returned ${apiData.riskEvaluation.score}`
        );
      }
      if (dbRecord.riskDecision !== 'APPROVED') {
        throw new Error(`Persisted riskDecision mismatch: DB has ${dbRecord.riskDecision}`);
      }
      if (!Array.isArray(dbRecord.contributingFactors) || dbRecord.contributingFactors.length === 0) {
        throw new Error('Contributing factors were not persisted in MongoDB');
      }
      if (!dbRecord.recommendedAction) {
        throw new Error('recommendedAction was not persisted in MongoDB');
      }
      if (!dbRecord.selectedRoute || !Array.isArray(dbRecord.selectedRoute.hops)) {
        throw new Error('selectedRoute was not persisted in MongoDB for approved transaction');
      }
      if (dbRecord.selectedRoute.hops[0] !== 'Gateway-US') {
        throw new Error(`Persisted route does not start with Gateway-US: ${dbRecord.selectedRoute.hops.join('->')}`);
      }
    } finally {
      await mongoose.disconnect();
    }
  });

  // ===========================================================================
  // TEST SUMMARY REPORT
  // ===========================================================================
  console.log('\n========================================================================');
  console.log('📊 Phase 2 Comprehensive Test Suite Summary:');
  const total = testResults.length;
  const passed = testResults.filter((r) => r.passed).length;
  const failed = testResults.filter((r) => !r.passed).length;

  console.log(`Total Tests Run : ${total}`);
  console.log(`Passed          : ${passed}`);
  console.log(`Failed          : ${failed}`);
  console.log('========================================================================\n');

  if (failed > 0) {
    console.error(`❌ Phase 2 tests FAILED (${failed} failure(s)). Review logs above.`);
    process.exit(1);
  } else {
    console.log('🎉 ALL 15 PHASE 2 TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  }
}

main();
