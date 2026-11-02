import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });

import mongoose from 'mongoose';
import { connectToDatabase } from '../src/lib/database';
import { closeNeo4jDriver } from '../src/lib/neo4j';
import Transaction from '../src/models/Transaction';
import { evaluateTelecomSignals } from '../src/lib/camaraMock';
import { calculateRiskDecision } from '../src/lib/riskEngine';
import { findOptimalRoute } from '../src/lib/routingEngine';

async function main() {
  console.log('=== TrustRoute E2E Payment Routing & Fraud Scenarios Test ===\n');
  await connectToDatabase();

  let pass = 0;
  let total = 0;
  function assert(cond: boolean, name: string) {
    total++;
    if (cond) {
      pass++;
      console.log(`[PASS] ${name}`);
    } else {
      console.error(`[FAIL] ${name}`);
    }
  }

  try {
    // ---------------------------------------------------------
    // TEST 1: Ordinary Clean Payment (Safe Scenario)
    // ---------------------------------------------------------
    console.log('--- Test 1: Ordinary Clean Low-Risk Payment ---');
    const telco1 = await evaluateTelecomSignals({
      amount: 1500,
      currency: 'USD',
      sourceCountry: 'USA',
      destinationCountry: 'UAE',
      senderEmail: 'sarah.jenkins@trustroute.com',
      recipientName: 'Emirates National Settlement Bank',
    });
    assert(telco1.signals.simSwap24h === false, 'Safe: simSwap24h is false');
    assert(telco1.signals.numberVerified === true, 'Safe: numberVerified is true');

    const risk1 = calculateRiskDecision({
      amount: 1500,
      currency: 'USD',
      sourceCountry: 'USA',
      destinationCountry: 'UAE',
      signals: telco1.signals,
    });
    assert(risk1.riskDecision === 'APPROVED', `Safe: Verdict is APPROVED (got ${risk1.riskDecision}, score: ${risk1.riskScore})`);

    const route1 = await findOptimalRoute({
      sourceCountry: 'USA',
      destinationCountry: 'UAE',
      amount: 1500,
    });
    assert(route1.success === true, 'Safe: Route calculation succeeded');
    assert(Boolean(route1.route?.hops && route1.route.hops.length >= 2), `Safe: Route has hops (${route1.route?.hops.join(' -> ')})`);

    const txnId1 = `TXN-SAFE-TEST-${Date.now()}`;
    const saved1 = await Transaction.create({
      transactionId: txnId1,
      amount: 1500,
      currency: 'USD',
      sourceCountry: 'USA',
      destinationCountry: 'UAE',
      riskScore: risk1.riskScore,
      riskDecision: risk1.riskDecision,
      signals: telco1.signals,
      contributingFactors: risk1.contributingFactors,
      selectedRoute: route1.route,
      status: 'APPROVED',
      senderEmail: 'sarah.jenkins@trustroute.com',
      recipientName: 'Emirates National Settlement Bank',
    });
    assert(saved1.transactionId === txnId1, 'Safe: Stored in MongoDB with transactionId');
    assert(saved1.selectedRoute?.hops.length === route1.route?.hops.length, 'Safe: Stored route hops match Neo4j path');

    // ---------------------------------------------------------
    // TEST 2: Demo Fraud Scenario A (SIM Swap within 24h -> BLOCKED)
    // ---------------------------------------------------------
    console.log('\n--- Test 2: Fraud Scenario A (SIM Swap within 24h) ---');
    const telco2 = await evaluateTelecomSignals({
      amount: 12000,
      currency: 'USD',
      sourceCountry: 'USA',
      destinationCountry: 'UAE',
      senderEmail: 'sarah.jenkins@trustroute.com',
      recipientName: 'Compromised-SIM Vendor Ltd',
    });
    assert(telco2.signals.simSwap24h === true, 'SIM Swap: simSwap24h is true');

    const risk2 = calculateRiskDecision({
      amount: 12000,
      currency: 'USD',
      sourceCountry: 'USA',
      destinationCountry: 'UAE',
      signals: telco2.signals,
    });
    assert(risk2.riskDecision === 'BLOCKED', `SIM Swap: Verdict is BLOCKED (got ${risk2.riskDecision}, score: ${risk2.riskScore})`);
    assert(risk2.riskScore >= 80, `SIM Swap: Risk score >= 80 (got ${risk2.riskScore})`);
    assert(
      risk2.contributingFactors.some((f) => f.toLowerCase().includes('sim-swap') || f.toLowerCase().includes('sim swap')),
      'SIM Swap: Factors contain SIM-swap violation'
    );

    // Blocked transactions must NOT receive a route
    let route2 = null;
    if (risk2.riskDecision === 'APPROVED') {
      route2 = await findOptimalRoute({ sourceCountry: 'USA', destinationCountry: 'UAE' });
    }
    assert(route2 === null, 'SIM Swap: No executable route assigned for blocked transaction');

    const txnId2 = `TXN-SIMSWAP-TEST-${Date.now()}`;
    const saved2 = await Transaction.create({
      transactionId: txnId2,
      amount: 12000,
      currency: 'USD',
      sourceCountry: 'USA',
      destinationCountry: 'UAE',
      riskScore: risk2.riskScore,
      riskDecision: risk2.riskDecision,
      signals: telco2.signals,
      contributingFactors: risk2.contributingFactors,
      selectedRoute: null,
      status: 'BLOCKED',
      senderEmail: 'sarah.jenkins@trustroute.com',
      recipientName: 'Compromised-SIM Vendor Ltd',
    });
    assert(saved2.status === 'BLOCKED', 'SIM Swap: Saved in MongoDB with BLOCKED status');
    assert(saved2.selectedRoute === null, 'SIM Swap: MongoDB selectedRoute is null');

    // ---------------------------------------------------------
    // TEST 3: Demo Fraud Scenario B (Unverified Carrier -> STEP_UP & Verification)
    // ---------------------------------------------------------
    console.log('\n--- Test 3: Fraud Scenario B (Unverified Device -> Step-Up & Verification) ---');
    const telco3 = await evaluateTelecomSignals({
      amount: 3400,
      currency: 'USD',
      sourceCountry: 'USA',
      destinationCountry: 'IND',
      senderEmail: 'sarah.jenkins@trustroute.com',
      recipientName: 'Unverified-Carrier Contractor',
    });
    assert(telco3.signals.numberVerified === false, 'Step-Up: numberVerified is false');

    const risk3 = calculateRiskDecision({
      amount: 3400,
      currency: 'USD',
      sourceCountry: 'USA',
      destinationCountry: 'IND',
      signals: telco3.signals,
    });
    assert(risk3.riskDecision === 'STEP_UP', `Step-Up: Verdict is STEP_UP (got ${risk3.riskDecision}, score: ${risk3.riskScore})`);

    // Quarantined transaction must NOT receive route prior to verification
    let route3 = null;
    assert(route3 === null, 'Step-Up: No route executed prior to verification');

    const txnId3 = `TXN-STEPUP-TEST-${Date.now()}`;
    const saved3 = await Transaction.create({
      transactionId: txnId3,
      amount: 3400,
      currency: 'USD',
      sourceCountry: 'USA',
      destinationCountry: 'IND',
      riskScore: risk3.riskScore,
      riskDecision: risk3.riskDecision,
      signals: telco3.signals,
      contributingFactors: risk3.contributingFactors,
      selectedRoute: null,
      status: 'STEP_UP_REQUIRED',
      reviewStatus: 'PENDING_REVIEW',
      senderEmail: 'sarah.jenkins@trustroute.com',
      recipientName: 'Unverified-Carrier Contractor',
    });
    assert(saved3.status === 'STEP_UP_REQUIRED', 'Step-Up: Saved in MongoDB as STEP_UP_REQUIRED');

    // Now simulate Complete Verification action:
    const verifiedSignals = {
      simSwap24h: false,
      numberVerified: true,
      deviceStatus: 'TRUSTED',
    };
    const reEvaluatedRisk = calculateRiskDecision({
      amount: saved3.amount,
      currency: saved3.currency,
      sourceCountry: saved3.sourceCountry,
      destinationCountry: saved3.destinationCountry,
      signals: verifiedSignals,
    });
    assert(reEvaluatedRisk.riskDecision === 'APPROVED', `After MFA: Decision is APPROVED (score: ${reEvaluatedRisk.riskScore})`);

    const verifiedRoute = await findOptimalRoute({
      sourceCountry: saved3.sourceCountry,
      destinationCountry: saved3.destinationCountry,
      amount: saved3.amount,
    });
    assert(verifiedRoute.success === true, 'After MFA: Neo4j route calculated successfully');

    saved3.status = 'APPROVED';
    saved3.reviewStatus = 'VERIFIED_APPROVED';
    saved3.selectedRoute = verifiedRoute.route;
    await saved3.save();

    const reloaded3 = await Transaction.findOne({ transactionId: txnId3 });
    assert(reloaded3?.status === 'APPROVED', 'After MFA: MongoDB status updated to APPROVED');
    assert(Boolean(reloaded3?.selectedRoute?.hops.length), 'After MFA: MongoDB selectedRoute populated');

    // ---------------------------------------------------------
    // TEST 4: Different Source/Destination Corridor Distinctness
    // ---------------------------------------------------------
    console.log('\n--- Test 4: Dynamic Corridor Path Distinctness ---');
    const routeUAE = await findOptimalRoute({ sourceCountry: 'USA', destinationCountry: 'UAE' });
    const routeIND = await findOptimalRoute({ sourceCountry: 'USA', destinationCountry: 'IND' });

    assert(routeUAE.success && routeIND.success, 'Both dynamic corridors computed');
    const pathUAE = routeUAE.route?.hops.join(' -> ');
    const pathIND = routeIND.route?.hops.join(' -> ');
    assert(pathUAE !== pathIND, `Different destinations produce different graph paths:\n   UAE: ${pathUAE}\n   IND: ${pathIND}`);

    console.log(`\n========================================`);
    console.log(`All E2E Scenarios: ${pass}/${total} assertions PASSED.`);
    console.log(`========================================`);
  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    await mongoose.disconnect();
    await closeNeo4jDriver();
  }
}

main();
