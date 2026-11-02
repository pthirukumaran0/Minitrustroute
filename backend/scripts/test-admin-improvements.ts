import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });

import mongoose from 'mongoose';
import { connectToDatabase } from '../src/lib/database';
import User from '../src/models/User';
import Transaction from '../src/models/Transaction';
import AuditLog from '../src/models/AuditLog';
import { generateToken } from '../src/lib/auth';

async function main() {
  console.log('=== Testing Admin, User Management & Fraud Transfer Improvements ===\n');
  await connectToDatabase();

  let pass = 0;
  let total = 0;
  function assert(cond: boolean, msg: string) {
    total++;
    if (cond) {
      pass++;
      console.log(`[PASS] ${msg}`);
    } else {
      console.error(`[FAIL] ${msg}`);
    }
  }

  try {
    // -------------------------------------------------------------
    // Test 1: User Suspend & Reactivate Workflow
    // -------------------------------------------------------------
    console.log('--- Test 1: User Suspend & Reactivate ---');
    const testEmail = `test.suspension.${Date.now()}@trustroute.com`;
    const user = await User.create({
      name: 'Test Suspended User',
      email: testEmail,
      passwordHash: 'dummy',
      salt: 'dummy',
      role: 'sender',
      status: 'ACTIVE',
      organization: 'Acme Test Corp',
    });
    assert(user.status === 'ACTIVE', 'Created active test user');

    // Suspend user
    user.status = 'SUSPENDED';
    await user.save();
    const refreshed = await User.findById(user._id);
    assert(refreshed?.status === 'SUSPENDED', 'User status persisted as SUSPENDED in MongoDB');

    // Create Audit Log for suspension
    await AuditLog.create({
      actorEmail: 'admin@trustroute.com',
      actorName: 'System Administrator',
      actorRole: 'admin',
      action: 'SUSPEND_USER',
      resourceType: 'USER',
      resourceId: user._id.toString(),
      outcome: 'SUCCESS',
      details: { targetEmail: testEmail, previousStatus: 'ACTIVE', newStatus: 'SUSPENDED' },
    });
    const auditRecord = await AuditLog.findOne({
      action: 'SUSPEND_USER',
      resourceId: user._id.toString(),
    });
    assert(Boolean(auditRecord), 'Audit record created for user suspension');

    // Reactivate user
    refreshed!.status = 'ACTIVE';
    await refreshed!.save();
    const reactivated = await User.findById(user._id);
    assert(reactivated?.status === 'ACTIVE', 'User successfully reactivated in MongoDB');

    // Clean up test user
    await User.deleteOne({ _id: user._id });

    // -------------------------------------------------------------
    // Test 2: Transfer Fraud Log to Admin Workflow
    // -------------------------------------------------------------
    console.log('\n--- Test 2: Transfer Fraud Log to Admin ---');
    const testTxnId = `TXN-FRAUD-TEST-${Date.now()}`;
    const fraudTxn = await Transaction.create({
      transactionId: testTxnId,
      amount: 45000,
      currency: 'USD',
      sourceCountry: 'USA',
      destinationCountry: 'UAE',
      riskScore: 92,
      riskDecision: 'BLOCKED',
      signals: {
        simSwap24h: true,
        numberVerified: false,
        deviceStatus: 'SUSPICIOUS',
      },
      contributingFactors: ['CAMARA SIM-Swap detected within 24h', 'High-value threshold exceeded'],
      selectedRoute: null,
      status: 'BLOCKED',
      senderEmail: 'compromised.sender@trustroute.com',
      transferredToAdmin: false,
    });
    assert(fraudTxn.transferredToAdmin === false, 'Fraud transaction initially not transferred');

    // Simulate transfer to admin
    fraudTxn.reviewStatus = 'PENDING_ADMIN_REVIEW';
    fraudTxn.transferredToAdmin = true;
    fraudTxn.transferredBy = 'analyst.alex@trustroute.com';
    fraudTxn.transferredAt = new Date();
    fraudTxn.transferNotes = 'Escalated to Admin: Critical SIM-swap violation on high-value transfer';
    await fraudTxn.save();

    const transferredTxn = await Transaction.findOne({ transactionId: testTxnId });
    assert(transferredTxn?.transferredToAdmin === true, 'transferredToAdmin is true in MongoDB');
    assert(transferredTxn?.reviewStatus === 'PENDING_ADMIN_REVIEW', 'reviewStatus is PENDING_ADMIN_REVIEW');
    assert(transferredTxn?.transferredBy === 'analyst.alex@trustroute.com', 'transferredBy recorded properly');
    assert(Boolean(transferredTxn?.transferredAt), 'transferredAt timestamp recorded properly');

    // Verify presence in Review Queue query
    const inQueue = await Transaction.findOne({
      $or: [
        { riskDecision: 'STEP_UP' },
        { status: 'STEP_UP_REQUIRED' },
        { reviewStatus: 'PENDING_REVIEW' },
        { reviewStatus: 'PENDING_ADMIN_REVIEW' },
        { transferredToAdmin: true },
      ],
      transactionId: testTxnId,
    });
    assert(Boolean(inQueue), 'Transferred fraud case is retrieved by Review Queue query');

    // Clean up test transaction
    await Transaction.deleteOne({ transactionId: testTxnId });

    console.log(`\n========================================`);
    console.log(`Result: ${pass}/${total} assertions PASSED.`);
    console.log(`========================================\n`);
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

main();

