import mongoose from 'mongoose';
import neo4j, { Driver } from 'neo4j-driver';
import Transaction, { ITransaction } from '../src/models/Transaction';
import { calculateRiskDecision } from '../src/lib/riskEngine';
import { findOptimalRoute } from '../src/lib/routingEngine';

// Ensure environment variables are loaded
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/trustroute';
const NEO4J_URI = process.env.NEO4J_URI || 'bolt://127.0.0.1:7687';
const NEO4J_USER = process.env.NEO4J_USERNAME || process.env.NEO4J_USER || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD;
const NEO4J_DATABASE = process.env.NEO4J_DATABASE || 'neo4j';

if (!NEO4J_PASSWORD) {
  console.error('❌ Error: NEO4J_PASSWORD environment variable is required.');
  process.exit(1);
}

// 1. Synthetic Demo Transactions (carefully labeled scenarios)
const DEMO_TRANSACTION_TEMPLATES = [
  {
    transactionId: 'DEMO-TXN-SAFE-001',
    amount: 1250,
    currency: 'USD',
    sourceCountry: 'USA',
    destinationCountry: 'UAE',
    signals: {
      simSwap24h: false,
      numberVerified: true,
      deviceStatus: 'TRUSTED',
    },
  },
  {
    transactionId: 'DEMO-TXN-STEPUP-002',
    amount: 3500,
    currency: 'USD',
    sourceCountry: 'USA',
    destinationCountry: 'IND',
    signals: {
      simSwap24h: false,
      numberVerified: false, // unverified mobile -> triggers STEP_UP
      deviceStatus: 'UNKNOWN', // new/unrecognized device
    },
  },
  {
    transactionId: 'DEMO-TXN-BLOCKED-003',
    amount: 18500,
    currency: 'USD',
    sourceCountry: 'USA',
    destinationCountry: 'UAE',
    signals: {
      simSwap24h: true, // SIM swap within 24h: Mandatory BLOCKED rule!
      numberVerified: false,
      deviceStatus: 'SUSPICIOUS',
    },
  },
  {
    transactionId: 'DEMO-TXN-HIGHVAL-004',
    amount: 65000,
    currency: 'USD',
    sourceCountry: 'USA',
    destinationCountry: 'GBR',
    signals: {
      simSwap24h: false,
      numberVerified: true,
      deviceStatus: 'TRUSTED',
    },
  },
  {
    transactionId: 'DEMO-TXN-LOCAL-005',
    amount: 320,
    currency: 'USD',
    sourceCountry: 'USA',
    destinationCountry: 'USA',
    signals: {
      simSwap24h: false,
      numberVerified: true,
      deviceStatus: 'TRUSTED',
    },
  },
];

// 2. Demo Payment Network Nodes (Payment Providers)
const PAYMENT_PROVIDERS = [
  {
    id: 'Gateway-US',
    name: 'US Gateway (New York)',
    type: 'GATEWAY',
    country: 'USA',
    currency: 'USD',
    status: 'ACTIVE',
    isAvailable: true,
  },
  {
    id: 'Bank-JPMorgan',
    name: 'JPMorgan Chase Clearing',
    type: 'BANK',
    country: 'USA',
    currency: 'USD',
    status: 'ACTIVE',
    isAvailable: true,
  },
  {
    id: 'Swift-Direct',
    name: 'SWIFT International Settlement',
    type: 'CLEARING',
    country: 'GLOBAL',
    currency: 'USD',
    status: 'ACTIVE',
    isAvailable: true,
  },
  {
    id: 'Corridor-MiddleEast',
    name: 'Gulf Financial Clearing Hub',
    type: 'CORRIDOR',
    country: 'UAE',
    currency: 'AED',
    status: 'ACTIVE',
    isAvailable: true,
  },
  {
    id: 'Clearing-India-NEFT',
    name: 'India Cross-Border Liquidity Portal',
    type: 'CLEARING',
    country: 'IND',
    currency: 'INR',
    status: 'ACTIVE',
    isAvailable: true,
  },
  {
    id: 'Bank-Dubai-Commercial',
    name: 'Dubai Commercial Bank',
    type: 'DESTINATION_BANK',
    country: 'UAE',
    currency: 'AED',
    status: 'ACTIVE',
    isAvailable: true,
  },
  {
    id: 'Bank-SBI-Mumbai',
    name: 'State Bank of India (Mumbai)',
    type: 'DESTINATION_BANK',
    country: 'IND',
    currency: 'INR',
    status: 'ACTIVE',
    isAvailable: true,
  },
  {
    id: 'Bank-Barclays-London',
    name: 'Barclays Bank London',
    type: 'DESTINATION_BANK',
    country: 'GBR',
    currency: 'GBP',
    status: 'ACTIVE',
    isAvailable: true,
  },
  // Isolated node to demonstrate handling of unreachable destinations
  {
    id: 'Bank-Isolated-Pacific',
    name: 'Isolated Island Bank (Suva)',
    type: 'DESTINATION_BANK',
    country: 'FJI',
    currency: 'FJD',
    status: 'ACTIVE',
    isAvailable: true,
  },
];

// 3. Demo Payment Network Edges (CONNECTS_TO relationships)
const PAYMENT_CONNECTIONS = [
  {
    source: 'Gateway-US',
    target: 'Bank-JPMorgan',
    baseCost: 1.5,
    latencyMs: 25,
    reliability: 0.999,
    status: 'ACTIVE',
    isAvailable: true,
    prohibited: false,
  },
  {
    source: 'Gateway-US',
    target: 'Swift-Direct',
    baseCost: 2.1,
    latencyMs: 40,
    reliability: 0.998,
    status: 'ACTIVE',
    isAvailable: true,
    prohibited: false,
  },
  {
    source: 'Bank-JPMorgan',
    target: 'Corridor-MiddleEast',
    baseCost: 1.2,
    latencyMs: 55,
    reliability: 0.995,
    status: 'ACTIVE',
    isAvailable: true,
    prohibited: false,
  },
  {
    source: 'Bank-JPMorgan',
    target: 'Bank-Barclays-London',
    baseCost: 1.8,
    latencyMs: 35,
    reliability: 0.999,
    status: 'ACTIVE',
    isAvailable: true,
    prohibited: false,
  },
  {
    source: 'Swift-Direct',
    target: 'Corridor-MiddleEast',
    baseCost: 1.4,
    latencyMs: 50,
    reliability: 0.997,
    status: 'ACTIVE',
    isAvailable: true,
    prohibited: false,
  },
  {
    source: 'Swift-Direct',
    target: 'Clearing-India-NEFT',
    baseCost: 1.9,
    latencyMs: 70,
    reliability: 0.994,
    status: 'ACTIVE',
    isAvailable: true,
    prohibited: false,
  },
  {
    source: 'Corridor-MiddleEast',
    target: 'Bank-Dubai-Commercial',
    baseCost: 0.4,
    latencyMs: 15,
    reliability: 0.999,
    status: 'ACTIVE',
    isAvailable: true,
    prohibited: false,
  },
  {
    source: 'Clearing-India-NEFT',
    target: 'Bank-SBI-Mumbai',
    baseCost: 0.5,
    latencyMs: 20,
    reliability: 0.999,
    status: 'ACTIVE',
    isAvailable: true,
    prohibited: false,
  },
  // Inactive/prohibited shortcut edge to test that the routing engine strictly excludes it
  {
    source: 'Gateway-US',
    target: 'Bank-Dubai-Commercial',
    baseCost: 0.1,
    latencyMs: 5,
    reliability: 0.999,
    status: 'INACTIVE',
    isAvailable: false,
    prohibited: true,
  },
];

async function seedNeo4j() {
  console.log('\n🌐 [1/2] Seeding Neo4j payment network topology...');
  const driver: Driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD!));
  const session = driver.session({ database: NEO4J_DATABASE });

  try {
    // 1. Create unique constraint for PaymentProvider id (if not exists)
    await session.run(`
      CREATE CONSTRAINT provider_id_unique IF NOT EXISTS
      FOR (p:PaymentProvider)
      REQUIRE p.id IS UNIQUE
    `);

    // 2. Upsert provider nodes using MERGE (idempotent, does not overwrite other nodes)
    for (const provider of PAYMENT_PROVIDERS) {
      await session.run(
        `
        MERGE (p:PaymentProvider { id: $id })
        ON CREATE SET
          p.name = $name,
          p.type = $type,
          p.country = $country,
          p.currency = $currency,
          p.status = $status,
          p.isAvailable = $isAvailable,
          p.createdAt = datetime()
        ON MATCH SET
          p.name = $name,
          p.type = $type,
          p.country = $country,
          p.currency = $currency,
          p.status = $status,
          p.isAvailable = $isAvailable,
          p.updatedAt = datetime()
        `,
        provider
      );
      console.log(`   ✔ Provider Node: ${provider.id} (${provider.name}) [Status: ${provider.status}]`);
    }

    // 3. Upsert CONNECTS_TO relationships using MERGE
    for (const conn of PAYMENT_CONNECTIONS) {
      await session.run(
        `
        MATCH (a:PaymentProvider { id: $source })
        MATCH (b:PaymentProvider { id: $target })
        MERGE (a)-[r:CONNECTS_TO]->(b)
        ON CREATE SET
          r.baseCost = $baseCost,
          r.latencyMs = $latencyMs,
          r.reliability = $reliability,
          r.status = $status,
          r.isAvailable = $isAvailable,
          r.prohibited = $prohibited,
          r.createdAt = datetime()
        ON MATCH SET
          r.baseCost = $baseCost,
          r.latencyMs = $latencyMs,
          r.reliability = $reliability,
          r.status = $status,
          r.isAvailable = $isAvailable,
          r.prohibited = $prohibited,
          r.updatedAt = datetime()
        `,
        conn
      );
      console.log(
        `   ✔ Route: ${conn.source} -[CONNECTS_TO]-> ${conn.target} [Available: ${conn.isAvailable}, Prohibited: ${conn.prohibited}]`
      );
    }

    const nodeCountRes = await session.run('MATCH (p:PaymentProvider) RETURN count(p) as count');
    const edgeCountRes = await session.run('MATCH ()-[r:CONNECTS_TO]->() RETURN count(r) as count');

    const nodes = nodeCountRes.records[0].get('count').toInt();
    const edges = edgeCountRes.records[0].get('count').toInt();

    console.log(`✅ Neo4j: Payment topology verified (${nodes} PaymentProvider nodes, ${edges} CONNECTS_TO edges).`);
  } finally {
    await session.close();
    await driver.close();
  }
}

async function seedMongo() {
  console.log('\n📦 [2/2] Seeding MongoDB synthetic transactions...');
  await mongoose.connect(MONGODB_URI);

  let insertedOrUpdated = 0;

  for (const template of DEMO_TRANSACTION_TEMPLATES) {
    // 1. Evaluate risk deterministically
    const risk = calculateRiskDecision({
      amount: template.amount,
      currency: template.currency,
      sourceCountry: template.sourceCountry,
      destinationCountry: template.destinationCountry,
      signals: template.signals,
    });

    // 2. Select route only for APPROVED transactions (policy enforcement)
    let selectedRoute = null;
    if (risk.riskDecision === 'APPROVED') {
      const routeRes = await findOptimalRoute({
        sourceCountry: template.sourceCountry,
        destinationCountry: template.destinationCountry,
      });
      if (routeRes.success && routeRes.route) {
        selectedRoute = routeRes.route;
      }
    }

    const payload: Partial<ITransaction> = {
      transactionId: template.transactionId,
      amount: template.amount,
      currency: template.currency,
      sourceCountry: template.sourceCountry,
      destinationCountry: template.destinationCountry,
      riskScore: risk.riskScore,
      riskDecision: risk.riskDecision,
      signals: template.signals,
      contributingFactors: risk.contributingFactors,
      recommendedAction: risk.recommendedAction,
      selectedRoute,
      status: risk.status,
    };

    // Use findOneAndUpdate with upsert: true to be idempotent & non-destructive
    await Transaction.findOneAndUpdate(
      { transactionId: template.transactionId },
      { $set: payload },
      { upsert: true, returnDocument: 'after', runValidators: true }
    );

    console.log(
      `   ✔ Upserted: ${template.transactionId} [${risk.riskDecision} | Score: ${risk.riskScore} | Route: ${
        selectedRoute ? selectedRoute.hops.join('->') : 'None'
      }]`
    );
    insertedOrUpdated++;
  }

  const totalCount = await Transaction.countDocuments();
  console.log(`✅ MongoDB: Processed ${insertedOrUpdated} demo records (Total records in DB: ${totalCount}).`);
  await mongoose.disconnect();
}

async function main() {
  console.log('====================================================');
  console.log('🚀 TrustRoute Phase 2: Repeatable Demo Seeder');
  console.log('====================================================\n');

  try {
    // Seed Neo4j first so routing lookups in MongoDB seeding can access the live graph
    await seedNeo4j();
    await seedMongo();
    console.log('\n🎉 Demo seeding finished successfully and non-destructively!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Seeding failed with error:', error);
    process.exit(1);
  }
}

main();
