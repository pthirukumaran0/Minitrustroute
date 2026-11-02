import mongoose from 'mongoose';
import neo4j from 'neo4j-driver';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:5000';

async function verify() {
  console.log('--- LIVE API VERIFICATION ---');

  // 1. Health
  const hRes = await fetch(`${BASE_URL}/api/health`);
  const health = await hRes.json();
  console.log('1. Health:', hRes.status, health.status, 'Mongo:', health.databases?.mongodb?.status, 'Neo4j:', health.databases?.neo4j?.status);

  // 2. Auth: Register
  const testEmail = `test-user-${Date.now()}@corporate.com`;
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test Reviewer',
      email: testEmail,
      mobileNumber: '+14155550199',
      password: 'Password123!',
    }),
  });
  const regData = await regRes.json();
  console.log('2. Register new sender:', regRes.status, regData.success ? 'SUCCESS' : regData.error, 'Role:', regData.user?.role);

  // 3. Auth: Login
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: 'Password123!' }),
  });
  const loginData = await loginRes.json();
  console.log('3. Login new user:', loginRes.status, 'Token length:', loginData.token?.length);
  const userToken = loginData.token;

  // 4. Quick-switch to Analyst
  const switchRes = await fetch(`${BASE_URL}/api/auth/quick-switch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'analyst' }),
  });
  const switchData = await switchRes.json();
  console.log('4. Quick switch to analyst:', switchRes.status, switchData.user?.name, 'Role:', switchData.user?.role);
  const analystToken = switchData.token;

  // 5. Automatic Telecom Evaluation on Create Transaction
  const txRes = await fetch(`${BASE_URL}/api/transactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${userToken}`,
    },
    body: JSON.stringify({
      amount: 1500,
      currency: 'USD',
      sourceCountry: 'USA',
      destinationCountry: 'UAE',
      recipientName: 'Acme Dubai Clearing',
    }),
  });
  const txData = await txRes.json();
  console.log('5. Create Txn (Automatic CAMARA signals):', txRes.status, 'Verdict:', txData.transaction?.riskDecision, 'Mode:', txData.telecomVerification?.mode, 'Hops:', txData.transaction?.selectedRoute?.hops?.join(' -> '));

  // 6. Review Queue Fetch
  const qRes = await fetch(`${BASE_URL}/api/transactions/review-queue`, {
    headers: { Authorization: `Bearer ${analystToken}` },
  });
  const qData = await qRes.json();
  console.log('6. Review Queue Fetch:', qRes.status, 'Queue count:', qData.queue?.length, 'Transactions count:', qData.transactions?.length);

  // 7. Network Topology (15 Nodes)
  const netRes = await fetch(`${BASE_URL}/api/network`);
  const netData = await netRes.json();
  console.log('7. Network Topology:', netRes.status, 'Nodes count:', netData.count?.nodes, 'Edges count:', netData.count?.edges);

  // 8. Auth: Logout & Token Revocation
  const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${userToken}` },
  });
  console.log('8. Logout User:', logoutRes.status);

  // 9. Verify revoked token rejects
  const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${userToken}` },
  });
  console.log('9. Revoked token access to /api/auth/me:', meRes.status, '(Expected 401)');

  console.log('--- ALL LIVE INTEGRATION CHECKS COMPLETED ---');
}

verify().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});

