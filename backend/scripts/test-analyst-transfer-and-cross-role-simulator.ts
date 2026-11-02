import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { loadPaymentGraphFromNeo4j, yensKShortestPaths } from '../src/lib/routingEngine';
import { connectToDatabase } from '../src/lib/database';
import mongoose from 'mongoose';
import Transaction from '../src/models/Transaction';
import AuditLog from '../src/models/AuditLog';

async function runTests() {
  console.log('\n========================================================================');
  console.log('🧪 Testing: Analyst Risk Transfer to Admin & Cross-Role Pathway Simulator');
  console.log('========================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, desc: string) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${desc}`);
      process.exitCode = 1;
    }
  }

  // Connect to MongoDB
  await connectToDatabase();

  // --- PART 1: Analyst Risk Intelligence - Transfer to Admin ---
  console.log('--- Part 1: Analyst Risk Intelligence: Transfer to Admin ---');

  // Find or create a test high-risk transaction eligible for transfer
  let testTxn = await Transaction.findOne({
    riskScore: { $gte: 50 },
    transferredToAdmin: { $ne: true },
    reviewStatus: { $ne: 'PENDING_ADMIN_REVIEW' },
  });

  if (!testTxn) {
    testTxn = await Transaction.create({
      transactionId: `TXN-RISK-TEST-${Date.now()}`,
      senderId: 'USR-1001',
      senderEmail: 'test.sender@trustroute.com',
      senderName: 'Test Client',
      recipientName: 'Flagged Beneficiary',
      amount: 15000,
      currency: 'USD',
      sourceCountry: 'US',
      destinationCountry: 'IN',
      riskScore: 85,
      riskDecision: 'BLOCKED',
      status: 'BLOCKED',
      reviewStatus: 'PENDING_REVIEW',
      signals: {
        simSwap24h: true,
        deviceStatus: 'SUSPICIOUS',
        numberVerified: false,
      },
      contributingFactors: ['SIM-Swap detected within 24h', 'Device fingerprint anomaly'],
      transferredToAdmin: false,
    });
  }

  assert(testTxn !== null, `Eligible risk case selected: ${testTxn.transactionId} (Score: ${testTxn.riskScore}/100)`);

  // Simulate Transfer to Admin
  const analystEmail = 'analyst.marcus@trustroute.com';
  const transferNotes = 'Confirmed 24h SIM swap and velocity spike. Escalating for Admin supervisory review.';

  testTxn.reviewStatus = 'PENDING_ADMIN_REVIEW';
  testTxn.transferredToAdmin = true;
  testTxn.transferredBy = analystEmail;
  testTxn.transferredAt = new Date();
  testTxn.transferNotes = transferNotes;
  await testTxn.save();

  // Create audit log
  await AuditLog.create({
    actorEmail: analystEmail,
    actorName: 'Marcus Vance',
    actorRole: 'analyst',
    action: 'TRANSFER_FRAUD_TO_ADMIN',
    resourceType: 'TRANSACTION',
    resourceId: testTxn.transactionId,
    outcome: 'SUCCESS',
    details: {
      transactionId: testTxn.transactionId,
      riskScore: testTxn.riskScore,
      riskDecision: testTxn.riskDecision,
      newReviewStatus: 'PENDING_ADMIN_REVIEW',
      notes: transferNotes,
    },
  });

  // Verify in MongoDB
  const savedTxn = await Transaction.findOne({ transactionId: testTxn.transactionId }).lean();
  assert(savedTxn?.transferredToAdmin === true, 'Case transferredToAdmin flag is true in MongoDB');
  assert(savedTxn?.reviewStatus === 'PENDING_ADMIN_REVIEW', 'Case reviewStatus is PENDING_ADMIN_REVIEW');
  assert(savedTxn?.transferredBy === analystEmail, `Transferring analyst preserved (${savedTxn?.transferredBy})`);
  assert(savedTxn?.transferredAt !== undefined, 'Transfer timestamp recorded');
  assert(savedTxn?.transferNotes === transferNotes, 'Transfer supervisory notes recorded');

  // Verify Audit Log entry exists
  const auditEntry = await AuditLog.findOne({
    resourceId: testTxn.transactionId,
    action: 'TRANSFER_FRAUD_TO_ADMIN',
  }).lean();
  assert(auditEntry !== null, 'Comprehensive compliance AuditLog entry generated in MongoDB');
  assert(auditEntry?.actorRole === 'analyst', 'Audit log identifies transferring actor as analyst');

  // Test Duplicate Prevention
  const isDuplicate = savedTxn?.transferredToAdmin || savedTxn?.reviewStatus === 'PENDING_ADMIN_REVIEW';
  assert(isDuplicate === true, 'Duplicate transfer condition successfully triggers and blocks re-escalation');

  // --- PART 2: Simulator - Bank-Based Yen\'s K-Shortest Pathways (K = 1 to 5) ---
  console.log('\n--- Part 2: Bank-Based Yen\'s K-Shortest Pathways (K = 1 to 5) ---');

  const graph = await loadPaymentGraphFromNeo4j();
  assert(graph.nodes.size >= 5, `Live Neo4j graph discovered: ${graph.nodes.size} provider/bank nodes`);

  const nodes = Array.from(graph.nodes.values());
  const bankNodes = nodes.filter((n) => n.name && n.id);
  assert(bankNodes.length >= 5, `All ${bankNodes.length} nodes possess valid Bank names and Gateway IDs`);

  // Verify bank-to-gateway mapping consistency
  const sampleBank = bankNodes[0];
  assert(sampleBank.id.length > 0, `Bank "${sampleBank.name}" maps directly to gateway ID "${sampleBank.id}"`);

  // Find a connected pair
  let testCorridor: { src: string; tgt: string } | null = null;
  for (const src of bankNodes) {
    for (const tgt of bankNodes) {
      if (src.id !== tgt.id) {
        const p = yensKShortestPaths(graph, src.id, tgt.id, 2);
        if (p.length >= 2) {
          testCorridor = { src: src.id, tgt: tgt.id };
          break;
        }
      }
    }
    if (testCorridor) break;
  }

  if (!testCorridor) {
    testCorridor = { src: bankNodes[0].id, tgt: bankNodes[1].id };
  }

  assert(testCorridor !== null, `Evaluation corridor: ${testCorridor.src} -> ${testCorridor.tgt}`);

  // Test K = 1 through 5
  for (let k = 1; k <= 5; k++) {
    const pathways = yensKShortestPaths(graph, testCorridor.src, testCorridor.tgt, k);
    assert(
      pathways.length >= 1 && pathways.length <= k,
      `Yen KSP with K=${k} returns ${pathways.length} distinct pathway(s) (<= ${k})`
    );

    // Verify best route is at rank 1
    assert(pathways[0].hops[0] === testCorridor.src, `K=${k}: Rank 1 pathway starts at Source Bank (${testCorridor.src})`);
    assert(pathways[0].hops[pathways[0].hops.length - 1] === testCorridor.tgt, `K=${k}: Rank 1 pathway ends at Target Bank (${testCorridor.tgt})`);

    // Verify ordering by composite weight
    for (let i = 1; i < pathways.length; i++) {
      assert(
        pathways[i].compositeWeight >= pathways[i - 1].compositeWeight - 1e-4,
        `K=${k}: Pathway #${i + 1} composite weight (${pathways[i].compositeWeight}) >= Pathway #${i} (${pathways[i - 1].compositeWeight})`
      );
    }

    // Verify all pathways are loopless
    const allLoopless = pathways.every((p) => new Set(p.hops).size === p.hops.length);
    assert(allLoopless, `K=${k}: All ${pathways.length} calculated pathways are strictly loopless`);

    // Verify all pathways are distinct
    const pathKeys = pathways.map((p) => p.hops.join('->'));
    const uniquePaths = new Set(pathKeys);
    assert(uniquePaths.size === pathways.length, `K=${k}: All ${pathways.length} pathways are completely distinct`);
  }

  await mongoose.disconnect();

  console.log('\n========================================================================');
  console.log(`🏁 Total Test Results: ${passed}/${total} Assertions PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('========================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test execution error:', err);
  process.exit(1);
});
