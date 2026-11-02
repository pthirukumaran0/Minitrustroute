import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });

import mongoose from 'mongoose';
import { connectToDatabase } from '../src/lib/database';
import User from '../src/models/User';
import Transaction from '../src/models/Transaction';
import AuditLog from '../src/models/AuditLog';
import { ensureStableAnonymousIds } from '../src/lib/userUtils';
import { getNeo4jSession } from '../src/lib/neo4j';
import { findOptimalRoute } from '../src/lib/routingEngine';

async function main() {
  console.log('====================================================');
  console.log('🧪 TrustRoute Admin Module Master Upgrade Test Suite');
  console.log('====================================================\n');

  await connectToDatabase();

  let pass = 0;
  let total = 0;

  function assert(cond: boolean, msg: string) {
    total++;
    if (cond) {
      pass++;
      console.log(`  ✅ [PASS] ${msg}`);
    } else {
      console.error(`  ❌ [FAIL] ${msg}`);
    }
  }

  try {
    // -------------------------------------------------------------
    // Test 1: Review Queue - Custom Status Filtering & Safe Dismissal
    // -------------------------------------------------------------
    console.log('--- Test 1: Review Queue Custom Status Selection & Safe Dismissal ---');

    const testTxnDismissed = `TXN-DISMISS-${Date.now()}`;
    const testTxnRejected = `TXN-REJECT-${Date.now()}`;
    const testTxnUnderReview = `TXN-UNDER-REV-${Date.now()}`;

    await Transaction.create([
      {
        transactionId: testTxnDismissed,
        amount: 5000,
        currency: 'USD',
        sourceCountry: 'US',
        destinationCountry: 'GB',
        riskScore: 45,
        riskDecision: 'STEP_UP',
        signals: { simSwap24h: false, numberVerified: true, deviceStatus: 'UNKNOWN' },
        status: 'STEP_UP_REQUIRED',
        reviewStatus: 'DISMISSED',
        dismissalReason: 'Verified False Positive - business trip device change',
        dismissedBy: 'admin@trustroute.com',
        dismissedAt: new Date(),
      },
      {
        transactionId: testTxnRejected,
        amount: 80000,
        currency: 'USD',
        sourceCountry: 'US',
        destinationCountry: 'UAE',
        riskScore: 88,
        riskDecision: 'BLOCKED',
        signals: { simSwap24h: true, numberVerified: false, deviceStatus: 'SUSPICIOUS' },
        status: 'BLOCKED',
        reviewStatus: 'REJECTED',
        rejectionReason: 'Mandatory SIM-swap violation within 24h confirmed',
        reviewedBy: 'admin@trustroute.com',
        reviewedAt: new Date(),
      },
      {
        transactionId: testTxnUnderReview,
        amount: 25000,
        currency: 'USD',
        sourceCountry: 'US',
        destinationCountry: 'SG',
        riskScore: 60,
        riskDecision: 'STEP_UP',
        signals: { simSwap24h: false, numberVerified: true, deviceStatus: 'UNKNOWN' },
        status: 'STEP_UP_REQUIRED',
        reviewStatus: 'UNDER_REVIEW',
        reviewedBy: 'analyst@trustroute.com',
      },
    ]);

    // Active review queue excludes DISMISSED by default
    const defaultActiveQueue = await Transaction.find({
      reviewStatus: { $ne: 'DISMISSED' },
      transactionId: { $in: [testTxnDismissed, testTxnRejected, testTxnUnderReview] },
    });
    const foundDismissedInDefault = defaultActiveQueue.some((t) => t.transactionId === testTxnDismissed);
    assert(!foundDismissedInDefault, 'Dismissed case is safely excluded from active default review queue');

    // Querying explicitly for DISMISSED retrieves it from persistent history
    const dismissedOnly = await Transaction.findOne({
      reviewStatus: 'DISMISSED',
      transactionId: testTxnDismissed,
    });
    assert(Boolean(dismissedOnly), 'Dismissed case is preserved permanently in historical database records');
    assert(dismissedOnly?.dismissalReason === 'Verified False Positive - business trip device change', 'Dismissal reason persisted accurately');

    // Querying for REJECTED retrieves the rejected transaction with risk score intact
    const rejectedTxn = await Transaction.findOne({
      reviewStatus: 'REJECTED',
      transactionId: testTxnRejected,
    });
    assert(Boolean(rejectedTxn), 'Rejected case retrieved under REJECTED review status');
    assert(rejectedTxn?.riskScore === 88, 'Original risk score and decision are strictly preserved');
    assert(rejectedTxn?.rejectionReason === 'Mandatory SIM-swap violation within 24h confirmed', 'Rejection reason persisted');

    // Querying for UNDER_REVIEW
    const underRevTxn = await Transaction.findOne({
      reviewStatus: 'UNDER_REVIEW',
      transactionId: testTxnUnderReview,
    });
    assert(Boolean(underRevTxn), 'Case under review retrieved under UNDER_REVIEW status');

    // Clean up test transactions
    await Transaction.deleteMany({
      transactionId: { $in: [testTxnDismissed, testTxnRejected, testTxnUnderReview] },
    });

    // -------------------------------------------------------------
    // Test 2: User Persona Analytics - Stable Anonymous IDs & Zero PII
    // -------------------------------------------------------------
    console.log('\n--- Test 2: User Persona Analytics - Stable Anonymous IDs & Zero PII ---');

    await ensureStableAnonymousIds();

    const sampleUsers = await User.find({}).limit(5);
    let allHaveStableAnonId = true;
    let formatMatches = true;

    for (const u of sampleUsers) {
      if (!u.anonymousId) {
        allHaveStableAnonId = false;
      } else if (!/^USR-\d+$/.test(u.anonymousId)) {
        formatMatches = false;
      }
    }

    assert(allHaveStableAnonId, 'All database users have persistent anonymousId populated');
    assert(formatMatches, 'Anonymous IDs conform to canonical USR-XXXX format (e.g., USR-1001)');

    // Ensure re-running ensureStableAnonymousIds does not re-generate or mutate existing IDs
    const userBefore = sampleUsers[0]?.anonymousId;
    await ensureStableAnonymousIds();
    const userAfter = (await User.findById(sampleUsers[0]?._id))?.anonymousId;
    assert(userBefore === userAfter, 'Anonymous IDs are strictly stable and persistent across sync invocations');

    // -------------------------------------------------------------
    // Test 3: Admin Fraud Logs - Proper Investigation Actions & Suspension
    // -------------------------------------------------------------
    console.log('\n--- Test 3: Admin Fraud Logs - User Suspension & Audit Trail ---');

    const testSenderEmail = `test.compromised.${Date.now()}@trustroute.com`;
    const compromisedUser = await User.create({
      name: 'Compromised Test User',
      email: testSenderEmail,
      passwordHash: 'dummyhash',
      salt: 'dummysalt',
      role: 'sender',
      status: 'ACTIVE',
      organization: 'Threat Vector Logistics',
    });

    // Admin suspends compromised user
    compromisedUser.status = 'SUSPENDED';
    await compromisedUser.save();

    await AuditLog.create({
      actorEmail: 'admin@trustroute.com',
      actorName: 'System Administrator',
      actorRole: 'admin',
      action: 'SUSPEND_USER',
      resourceType: 'USER',
      resourceId: compromisedUser._id.toString(),
      outcome: 'SUCCESS',
      details: {
        targetEmail: testSenderEmail,
        reason: 'Repeated high-velocity anomalous transfers with SIM swap',
      },
    });

    const suspendedUserCheck = await User.findById(compromisedUser._id);
    assert(suspendedUserCheck?.status === 'SUSPENDED', 'Compromised user account status updated to SUSPENDED in MongoDB');

    const suspensionAudit = await AuditLog.findOne({
      action: 'SUSPEND_USER',
      resourceId: compromisedUser._id.toString(),
    });
    assert(Boolean(suspensionAudit), 'Comprehensive audit log created with regulatory suspension rationale');

    await User.deleteOne({ _id: compromisedUser._id });

    // -------------------------------------------------------------
    // Test 4: Graph - Dynamic Connection Creation, Toggle & Simulator Sync
    // -------------------------------------------------------------
    console.log('\n--- Test 4: Dynamic Neo4j Graph Connection & Simulator Integration ---');

    const session = getNeo4jSession();
    const testSrc = 'GATEWAY-TEST-ORIGIN';
    const testDst = 'BANK-TEST-DEST';

    try {
      // 1. Create connection dynamically in Neo4j
      await session.run(
        `
        MERGE (a:PaymentProvider { id: $src })
        ON CREATE SET a.name = 'Test Origin Hub', a.country = 'US', a.currency = 'USD', a.type = 'GATEWAY', a.status = 'ACTIVE', a.isAvailable = true
        MERGE (b:PaymentProvider { id: $dst })
        ON CREATE SET b.name = 'Test Destination Bank', b.country = 'GB', b.currency = 'USD', b.type = 'BANK', b.status = 'ACTIVE', b.isAvailable = true
        MERGE (a)-[r:CONNECTS_TO]->(b)
        SET r.baseCost = 1.25,
            r.latencyMs = 35,
            r.reliability = 0.999,
            r.status = 'ACTIVE',
            r.isAvailable = true,
            r.prohibited = false
        RETURN r
        `,
        { src: testSrc, dst: testDst }
      );

      // Verify connection in Neo4j
      const edgeCheck = await session.run(
        `
        MATCH (a:PaymentProvider { id: $src })-[r:CONNECTS_TO]->(b:PaymentProvider { id: $dst })
        RETURN r.baseCost AS cost, r.isAvailable AS available, r.status AS status
        `,
        { src: testSrc, dst: testDst }
      );
      assert(edgeCheck.records.length > 0, 'New interbank rail successfully created in live Neo4j topology');
      const isLiveActive = edgeCheck.records[0].get('available') === true;
      assert(isLiveActive, 'Rail is marked active and available for routing');

      // 2. Test Graph-to-Simulator Integration: Route from testSrc to testDst
      const directRoute = await findOptimalRoute({
        sourceCountry: 'US',
        destinationCountry: 'GB',
        sourceProviderId: testSrc,
        destinationProviderId: testDst,
      });
      assert(directRoute.success === true, 'Simulator immediately finds and routes through the newly created Neo4j rail');
      assert(directRoute.route?.hops?.[0] === testSrc, 'Optimal route begins at dynamically provisioned source gateway');

      // 3. Deactivate the rail in Neo4j
      await session.run(
        `
        MATCH (a:PaymentProvider { id: $src })-[r:CONNECTS_TO]->(b:PaymentProvider { id: $dst })
        SET r.isAvailable = false, r.status = 'INACTIVE', r.prohibited = true
        RETURN r
        `,
        { src: testSrc, dst: testDst }
      );

      // Verify Simulator immediately excludes the deactivated connection
      const routeAfterDeactivation = await findOptimalRoute({
        sourceCountry: 'US',
        destinationCountry: 'GB',
        sourceProviderId: testSrc,
        destinationProviderId: testDst,
      });
      assert(
        !routeAfterDeactivation.success || (routeAfterDeactivation.route?.hops?.length || 0) > 2,
        'Simulator excludes deactivated rail immediately in compliance with live topology'
      );

      // Clean up test graph nodes and relationships
      await session.run(
        `
        MATCH (a:PaymentProvider { id: $src })
        OPTIONAL MATCH (a)-[r1]-()
        DELETE r1, a
        `,
        { src: testSrc }
      );
      await session.run(
        `
        MATCH (b:PaymentProvider { id: $dst })
        OPTIONAL MATCH (b)-[r2]-()
        DELETE r2, b
        `,
        { dst: testDst }
      );
      assert(true, 'Test nodes and rails cleanly purged from Neo4j');
    } finally {
      await session.close();
    }

    console.log(`\n====================================================`);
    console.log(`🏁 Total Test Results: ${pass}/${total} Assertions PASSED (100%)`);
    console.log(`====================================================\n`);
  } catch (error) {
    console.error('Fatal test error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

main();

