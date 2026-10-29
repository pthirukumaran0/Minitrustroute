import neo4j from 'neo4j-driver';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const NEO4J_URI = process.env.NEO4J_URI || 'bolt://127.0.0.1:7687';
const NEO4J_USER = process.env.NEO4J_USERNAME || process.env.NEO4J_USER || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD;

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
  error?: string;
}

const results: TestResult[] = [];

async function runTest(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`✅ PASS: ${name}`);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    results.push({ name, passed: false, error: errorMsg });
    console.error(`❌ FAIL: ${name} -> ${errorMsg}`);
  }
}

async function main() {
  console.log('====================================================');
  console.log('🧪 TrustRoute Phase 1 Comprehensive Test Suite');
  console.log('====================================================\n');

  // Test 1: GET /api/health
  await runTest('GET /api/health returns 200 and healthy DB statuses', async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    if (res.status !== 200) {
      throw new Error(`Expected HTTP 200, got ${res.status}`);
    }
    const data = await res.json();
    if (data.status !== 'healthy') {
      throw new Error(`Overall health is '${data.status}', expected 'healthy'`);
    }
    if (data.databases.mongodb.status !== 'healthy') {
      throw new Error(`MongoDB reported ${data.databases.mongodb.status}`);
    }
    if (data.databases.neo4j.status !== 'healthy') {
      throw new Error(`Neo4j reported ${data.databases.neo4j.status}`);
    }
  });

  // Test 2: GET /api/transactions
  await runTest('GET /api/transactions returns array of transactions newest first', async () => {
    const res = await fetch(`${BASE_URL}/api/transactions?limit=10`);
    if (res.status !== 200) {
      throw new Error(`Expected HTTP 200, got ${res.status}`);
    }
    const data = await res.json();
    if (!data.success || !Array.isArray(data.transactions)) {
      throw new Error('Response did not have success: true or transactions array');
    }
    if (data.transactions.length === 0) {
      throw new Error('Expected at least one transaction in database');
    }

    // Verify ordering
    if (data.transactions.length >= 2) {
      const firstTime = new Date(data.transactions[0].createdAt).getTime();
      const secondTime = new Date(data.transactions[1].createdAt).getTime();
      if (firstTime < secondTime) {
        throw new Error('Transactions are not sorted newest first (createdAt: -1)');
      }
    }
  });

  // Test 3: POST /api/transactions (Valid Safe Transaction)
  const testSafeTxnId = `TEST-SAFE-${Date.now()}`;
  await runTest('POST /api/transactions accepts valid low-risk payment and approves', async () => {
    const payload = {
      transactionId: testSafeTxnId,
      amount: 450,
      currency: 'USD',
      sourceCountry: 'USA',
      destinationCountry: 'USA',
      signals: {
        simSwap24h: false,
        numberVerified: true,
        deviceStatus: 'TRUSTED',
      },
    };

    const res = await fetch(`${BASE_URL}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.status !== 201) {
      const err = await res.text();
      throw new Error(`Expected HTTP 201, got ${res.status}: ${err}`);
    }

    const data = await res.json();
    if (!data.success || !data.transaction) {
      throw new Error('Missing transaction object in response');
    }
    if (data.transaction.riskDecision !== 'APPROVED') {
      throw new Error(`Expected APPROVED, got ${data.transaction.riskDecision}`);
    }
    if (data.transaction.riskScore >= 35) {
      throw new Error(`Expected low risk score (<35), got ${data.transaction.riskScore}`);
    }
    if (!data.transaction.selectedRoute) {
      throw new Error('Expected selectedRoute to be populated for APPROVED transaction');
    }
  });

  // Test 4: Security test: Client attempts to tamper / forge risk decision
  const testTamperTxnId = `TEST-TAMPER-${Date.now()}`;
  await runTest('POST /api/transactions enforces server rule & blocks fraud, rejecting client tamper', async () => {
    const payload = {
      transactionId: testTamperTxnId,
      amount: 22000,
      currency: 'USD',
      sourceCountry: 'USA',
      destinationCountry: 'UAE',
      signals: {
        simSwap24h: true, // SIM swap within 24h
        numberVerified: false, // Unverified
        deviceStatus: 'SUSPICIOUS', // Suspicious device
      },
      // Attacker tries to inject fraudulent approval
      riskScore: 0,
      riskDecision: 'APPROVED',
      status: 'APPROVED',
    };

    const res = await fetch(`${BASE_URL}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.status !== 201) {
      const err = await res.text();
      throw new Error(`Expected HTTP 201, got ${res.status}: ${err}`);
    }

    const data = await res.json();
    if (data.transaction.riskDecision !== 'BLOCKED') {
      throw new Error(
        `SECURITY VULNERABILITY: Client forged decision accepted! Got ${data.transaction.riskDecision}`
      );
    }
    if (data.transaction.selectedRoute !== null) {
      throw new Error('Blocked transaction must have selectedRoute set to null');
    }
    if (data.transaction.status !== 'BLOCKED') {
      throw new Error(`Expected status BLOCKED, got ${data.transaction.status}`);
    }
  });

  // Test 5: Validation test: Negative amount rejected by Zod
  await runTest('POST /api/transactions rejects negative amount with HTTP 400', async () => {
    const payload = {
      amount: -100,
      currency: 'USD',
      sourceCountry: 'USA',
      destinationCountry: 'UAE',
      signals: {
        simSwap24h: false,
        numberVerified: true,
        deviceStatus: 'TRUSTED',
      },
    };

    const res = await fetch(`${BASE_URL}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.status !== 400) {
      throw new Error(`Expected HTTP 400 for negative amount, got ${res.status}`);
    }
  });

  // Test 6: Validation test: Invalid currency code rejected by Zod
  await runTest('POST /api/transactions rejects invalid currency length with HTTP 400', async () => {
    const payload = {
      amount: 100,
      currency: 'INVALID_LONG_CURRENCY',
      sourceCountry: 'USA',
      destinationCountry: 'UAE',
      signals: {
        simSwap24h: false,
        numberVerified: true,
        deviceStatus: 'TRUSTED',
      },
    };

    const res = await fetch(`${BASE_URL}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.status !== 400) {
      throw new Error(`Expected HTTP 400 for invalid currency, got ${res.status}`);
    }
  });

  // Test 7: Conflict test: Duplicate transactionId rejected with HTTP 409
  await runTest('POST /api/transactions rejects duplicate transactionId with HTTP 409', async () => {
    const payload = {
      transactionId: testSafeTxnId, // Already inserted in Test 3
      amount: 500,
      currency: 'USD',
      sourceCountry: 'USA',
      destinationCountry: 'USA',
      signals: {
        simSwap24h: false,
        numberVerified: true,
        deviceStatus: 'TRUSTED',
      },
    };

    const res = await fetch(`${BASE_URL}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.status !== 409) {
      throw new Error(`Expected HTTP 409 for duplicate transactionId, got ${res.status}`);
    }
  });

  // Test 8: Neo4j Graph Verification
  await runTest('Neo4j database contains seeded PaymentProvider nodes and CONNECTS_TO relationships', async () => {
    if (!NEO4J_PASSWORD) {
      throw new Error('NEO4J_PASSWORD missing');
    }
    const driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));
    const session = driver.session({ database: 'neo4j' });

    try {
      const nodeRes = await session.run(
        'MATCH (p:PaymentProvider) RETURN count(p) as count'
      );
      const edgeRes = await session.run(
        'MATCH ()-[r:CONNECTS_TO]->() RETURN count(r) as count'
      );

      const nodeCount = nodeRes.records[0].get('count').toInt();
      const edgeCount = edgeRes.records[0].get('count').toInt();

      if (nodeCount < 8) {
        throw new Error(`Expected at least 8 PaymentProvider nodes, found ${nodeCount}`);
      }
      if (edgeCount < 8) {
        throw new Error(`Expected at least 8 CONNECTS_TO edges, found ${edgeCount}`);
      }
    } finally {
      await session.close();
      await driver.close();
    }
  });

  console.log('\n====================================================');
  console.log('📊 Test Summary:');
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main();

