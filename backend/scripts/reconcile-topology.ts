import neo4j from 'neo4j-driver';
import mongoose from 'mongoose';
import PaymentProvider, { IPaymentProvider } from '../src/models/PaymentProvider';

const NEO4J_URI = process.env.NEO4J_URI || 'bolt://127.0.0.1:7687';
const NEO4J_USER = process.env.NEO4J_USERNAME || process.env.NEO4J_USER || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/trustroute';

export const EXACT_15_PROVIDERS: Array<Omit<IPaymentProvider, 'createdAt' | 'updatedAt'>> = [
  // 1. Origin Gateway USA
  {
    providerId: 'Gateway-US',
    providerName: 'US Gateway (New York)',
    providerType: 'GATEWAY',
    country: 'USA',
    countryCode: 'USA',
    city: 'New York',
    supportedCurrencies: ['USD', 'EUR', 'GBP'],
    status: 'ACTIVE',
    transactionFee: 0.5,
    averageLatency: 15,
    liquidity: 50000000,
    reliability: 0.9995,
    isAvailable: true,
  },
  // 2. Commercial Clearing Bank USA
  {
    providerId: 'Bank-JPMorgan',
    providerName: 'JPMorgan Chase Clearing',
    providerType: 'BANK',
    country: 'USA',
    countryCode: 'USA',
    city: 'New York',
    supportedCurrencies: ['USD', 'EUR', 'GBP', 'AED', 'SGD'],
    status: 'ACTIVE',
    transactionFee: 1.5,
    averageLatency: 25,
    liquidity: 100000000,
    reliability: 0.9998,
    isAvailable: true,
  },
  // 3. Global Interbank Network
  {
    providerId: 'Swift-Direct',
    providerName: 'SWIFT International Settlement',
    providerType: 'CLEARING',
    country: 'GLOBAL',
    countryCode: 'GLB',
    city: 'Brussels',
    supportedCurrencies: ['USD', 'EUR', 'GBP', 'INR', 'AED', 'SGD'],
    status: 'ACTIVE',
    transactionFee: 2.1,
    averageLatency: 40,
    liquidity: 500000000,
    reliability: 0.9985,
    isAvailable: true,
  },
  // 4. Middle East Liquidity Hub
  {
    providerId: 'Corridor-MiddleEast',
    providerName: 'Gulf Financial Clearing Hub',
    providerType: 'CORRIDOR',
    country: 'UAE',
    countryCode: 'UAE',
    city: 'Dubai',
    supportedCurrencies: ['AED', 'USD', 'EUR'],
    status: 'ACTIVE',
    transactionFee: 1.2,
    averageLatency: 35,
    liquidity: 30000000,
    reliability: 0.999,
    isAvailable: true,
  },
  // 5. Destination Bank UAE
  {
    providerId: 'Bank-Dubai-Commercial',
    providerName: 'Dubai Commercial Bank',
    providerType: 'DESTINATION_BANK',
    country: 'UAE',
    countryCode: 'UAE',
    city: 'Dubai',
    supportedCurrencies: ['AED', 'USD'],
    status: 'ACTIVE',
    transactionFee: 0.4,
    averageLatency: 15,
    liquidity: 25000000,
    reliability: 0.9995,
    isAvailable: true,
  },
  // 6. National Clearing India
  {
    providerId: 'Clearing-India-NEFT',
    providerName: 'India Cross-Border Liquidity Portal',
    providerType: 'CLEARING',
    country: 'IND',
    countryCode: 'IND',
    city: 'Mumbai',
    supportedCurrencies: ['INR', 'USD'],
    status: 'ACTIVE',
    transactionFee: 0.8,
    averageLatency: 30,
    liquidity: 40000000,
    reliability: 0.999,
    isAvailable: true,
  },
  // 7. Destination Bank India (Mumbai)
  {
    providerId: 'Bank-SBI-Mumbai',
    providerName: 'State Bank of India (Mumbai)',
    providerType: 'DESTINATION_BANK',
    country: 'IND',
    countryCode: 'IND',
    city: 'Mumbai',
    supportedCurrencies: ['INR'],
    status: 'ACTIVE',
    transactionFee: 0.5,
    averageLatency: 20,
    liquidity: 45000000,
    reliability: 0.9992,
    isAvailable: true,
  },
  // 8. Destination Bank UK
  {
    providerId: 'Bank-Barclays-London',
    providerName: 'Barclays Bank London',
    providerType: 'DESTINATION_BANK',
    country: 'GBR',
    countryCode: 'GBR',
    city: 'London',
    supportedCurrencies: ['GBP', 'EUR', 'USD'],
    status: 'ACTIVE',
    transactionFee: 1.8,
    averageLatency: 35,
    liquidity: 60000000,
    reliability: 0.9994,
    isAvailable: true,
  },
  // 9. Isolated Pacific Bank (Fiji) - Intentionally has 0 incoming edges to satisfy Test 12!
  {
    providerId: 'Bank-Isolated-Pacific',
    providerName: 'Isolated Island Bank (Suva)',
    providerType: 'DESTINATION_BANK',
    country: 'FJI',
    countryCode: 'FJI',
    city: 'Suva',
    supportedCurrencies: ['FJD'],
    status: 'ACTIVE',
    transactionFee: 5.0,
    averageLatency: 250,
    liquidity: 1000000,
    reliability: 0.95,
    isAvailable: true,
  },
  // 10. Origin Gateway Germany / EU
  {
    providerId: 'Gateway-EU',
    providerName: 'European Financial Gateway (Frankfurt)',
    providerType: 'GATEWAY',
    country: 'DEU',
    countryCode: 'DEU',
    city: 'Frankfurt',
    supportedCurrencies: ['EUR', 'USD', 'GBP'],
    status: 'ACTIVE',
    transactionFee: 0.6,
    averageLatency: 18,
    liquidity: 80000000,
    reliability: 0.9996,
    isAvailable: true,
  },
  // 11. Euro Clearing Bank
  {
    providerId: 'Bank-Deutsche',
    providerName: 'Deutsche Bank Global Clearing',
    providerType: 'BANK',
    country: 'DEU',
    countryCode: 'DEU',
    city: 'Frankfurt',
    supportedCurrencies: ['EUR', 'USD', 'GBP'],
    status: 'ACTIVE',
    transactionFee: 1.4,
    averageLatency: 22,
    liquidity: 90000000,
    reliability: 0.9995,
    isAvailable: true,
  },
  // 12. SEPA Instant Pan-European Corridor
  {
    providerId: 'Corridor-SEPA-Instant',
    providerName: 'SEPA Instant Pan-European Corridor',
    providerType: 'CORRIDOR',
    country: 'DEU',
    countryCode: 'DEU',
    city: 'Frankfurt',
    supportedCurrencies: ['EUR', 'GBP'],
    status: 'ACTIVE',
    transactionFee: 0.7,
    averageLatency: 20,
    liquidity: 75000000,
    reliability: 0.9997,
    isAvailable: true,
  },
  // 13. Origin Gateway Southeast Asia (Singapore)
  {
    providerId: 'Gateway-Asia',
    providerName: 'Asia-Pacific Gateway (Singapore)',
    providerType: 'GATEWAY',
    country: 'SGP',
    countryCode: 'SGP',
    city: 'Singapore',
    supportedCurrencies: ['SGD', 'USD', 'INR', 'AED'],
    status: 'ACTIVE',
    transactionFee: 0.6,
    averageLatency: 16,
    liquidity: 65000000,
    reliability: 0.9995,
    isAvailable: true,
  },
  // 14. Asian Commercial Liquidity Bank
  {
    providerId: 'Bank-DBS-Singapore',
    providerName: 'DBS Treasury & Liquidity Clearing',
    providerType: 'BANK',
    country: 'SGP',
    countryCode: 'SGP',
    city: 'Singapore',
    supportedCurrencies: ['SGD', 'USD', 'INR', 'AED'],
    status: 'ACTIVE',
    transactionFee: 1.1,
    averageLatency: 24,
    liquidity: 85000000,
    reliability: 0.9996,
    isAvailable: true,
  },
  // 15. Secondary Destination Bank India (Delhi)
  {
    providerId: 'Bank-HDFC-Delhi',
    providerName: 'HDFC Corporate Settlement (Delhi)',
    providerType: 'DESTINATION_BANK',
    country: 'IND',
    countryCode: 'IND',
    city: 'New Delhi',
    supportedCurrencies: ['INR', 'USD'],
    status: 'ACTIVE',
    transactionFee: 0.5,
    averageLatency: 22,
    liquidity: 50000000,
    reliability: 0.9991,
    isAvailable: true,
  },
];

export const CORRIDOR_CONNECTIONS = [
  // Existing tested corridors (preserved exactly for unit tests & Phase 1/2)
  { source: 'Bank-JPMorgan', target: 'Bank-Barclays-London', baseCost: 1.8, latencyMs: 35, reliability: 0.999, status: 'ACTIVE', prohibited: false, isAvailable: true, corridorId: 'CORR-US-UK-JPM' },
  { source: 'Bank-JPMorgan', target: 'Corridor-MiddleEast', baseCost: 1.2, latencyMs: 55, reliability: 0.995, status: 'ACTIVE', prohibited: false, isAvailable: true, corridorId: 'CORR-US-ME-JPM' },
  { source: 'Clearing-India-NEFT', target: 'Bank-SBI-Mumbai', baseCost: 0.5, latencyMs: 20, reliability: 0.999, status: 'ACTIVE', prohibited: false, isAvailable: true, corridorId: 'CORR-IND-SETTLE-SBI' },
  { source: 'Corridor-MiddleEast', target: 'Bank-Dubai-Commercial', baseCost: 0.4, latencyMs: 15, reliability: 0.999, status: 'ACTIVE', prohibited: false, isAvailable: true, corridorId: 'CORR-ME-SETTLE-DCB' },
  { source: 'Gateway-US', target: 'Bank-Dubai-Commercial', baseCost: 0.1, latencyMs: 5, reliability: 0.999, status: 'INACTIVE', prohibited: true, isAvailable: false, corridorId: 'CORR-US-UAE-PROHIBITED' },
  { source: 'Gateway-US', target: 'Bank-JPMorgan', baseCost: 1.5, latencyMs: 25, reliability: 0.999, status: 'ACTIVE', prohibited: false, isAvailable: true, corridorId: 'CORR-US-INTERNAL-JPM' },
  { source: 'Gateway-US', target: 'Swift-Direct', baseCost: 2.1, latencyMs: 40, reliability: 0.998, status: 'ACTIVE', prohibited: false, isAvailable: true, corridorId: 'CORR-US-SWIFT' },
  { source: 'Swift-Direct', target: 'Clearing-India-NEFT', baseCost: 1.9, latencyMs: 70, reliability: 0.994, status: 'ACTIVE', prohibited: false, isAvailable: true, corridorId: 'CORR-SWIFT-NEFT' },
  { source: 'Swift-Direct', target: 'Corridor-MiddleEast', baseCost: 1.4, latencyMs: 50, reliability: 0.997, status: 'ACTIVE', prohibited: false, isAvailable: true, corridorId: 'CORR-SWIFT-ME' },

  // New corridors connecting the extended 15 entities
  { source: 'Gateway-EU', target: 'Bank-Deutsche', baseCost: 0.6, latencyMs: 18, reliability: 0.9995, status: 'ACTIVE', prohibited: false, isAvailable: true, corridorId: 'CORR-EU-DEUTSCHE' },
  { source: 'Bank-Deutsche', target: 'Swift-Direct', baseCost: 1.3, latencyMs: 30, reliability: 0.999, status: 'ACTIVE', prohibited: false, isAvailable: true, corridorId: 'CORR-DEUTSCHE-SWIFT' },
  { source: 'Bank-Deutsche', target: 'Corridor-SEPA-Instant', baseCost: 0.7, latencyMs: 15, reliability: 0.9998, status: 'ACTIVE', prohibited: false, isAvailable: true, corridorId: 'CORR-DEUTSCHE-SEPA' },
  { source: 'Corridor-SEPA-Instant', target: 'Bank-Barclays-London', baseCost: 0.9, latencyMs: 20, reliability: 0.9995, status: 'ACTIVE', prohibited: false, isAvailable: true, corridorId: 'CORR-SEPA-BARCLAYS' },

  { source: 'Gateway-Asia', target: 'Bank-DBS-Singapore', baseCost: 0.5, latencyMs: 16, reliability: 0.9996, status: 'ACTIVE', prohibited: false, isAvailable: true, corridorId: 'CORR-ASIA-DBS' },
  { source: 'Bank-DBS-Singapore', target: 'Swift-Direct', baseCost: 1.5, latencyMs: 45, reliability: 0.9988, status: 'ACTIVE', prohibited: false, isAvailable: true, corridorId: 'CORR-DBS-SWIFT' },
  { source: 'Bank-DBS-Singapore', target: 'Corridor-MiddleEast', baseCost: 1.1, latencyMs: 38, reliability: 0.9992, status: 'ACTIVE', prohibited: false, isAvailable: true, corridorId: 'CORR-DBS-ME' },
  { source: 'Bank-DBS-Singapore', target: 'Clearing-India-NEFT', baseCost: 1.0, latencyMs: 35, reliability: 0.9991, status: 'ACTIVE', prohibited: false, isAvailable: true, corridorId: 'CORR-DBS-NEFT' },

  { source: 'Clearing-India-NEFT', target: 'Bank-HDFC-Delhi', baseCost: 0.5, latencyMs: 22, reliability: 0.999, status: 'ACTIVE', prohibited: false, isAvailable: true, corridorId: 'CORR-IND-SETTLE-HDFC' },
];

export async function reconcileTopology() {
  console.log('🔄 Reconciling 15 Payment Providers across MongoDB and Neo4j...');

  // 1. Reconcile MongoDB
  await mongoose.connect(MONGODB_URI);
  console.log('📦 Connected to MongoDB');

  for (const p of EXACT_15_PROVIDERS) {
    await PaymentProvider.findOneAndUpdate(
      { providerId: p.providerId },
      { $set: p },
      { upsert: true, new: true }
    );
  }
  const mongoCount = await PaymentProvider.countDocuments();
  console.log(`✅ MongoDB: Exactly ${mongoCount} providers saved`);

  // 2. Reconcile Neo4j
  if (!NEO4J_PASSWORD) {
    throw new Error('Missing NEO4J_PASSWORD');
  }
  const driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));
  const session = driver.session({ database: 'neo4j' });

  try {
    // Unique constraint on id
    await session.run(`
      CREATE CONSTRAINT provider_id_unique IF NOT EXISTS
      FOR (p:PaymentProvider)
      REQUIRE p.id IS UNIQUE
    `).catch(() => {});

    // Upsert nodes
    for (const p of EXACT_15_PROVIDERS) {
      await session.run(
        `
        MERGE (p:PaymentProvider { id: $id })
        SET p.providerId = $id,
            p.name = $name,
            p.type = $type,
            p.country = $country,
            p.countryCode = $countryCode,
            p.city = $city,
            p.currency = $currency,
            p.supportedCurrencies = $supportedCurrencies,
            p.status = $status,
            p.transactionFee = $transactionFee,
            p.averageLatency = $averageLatency,
            p.liquidity = $liquidity,
            p.reliability = $reliability,
            p.isAvailable = $isAvailable
        RETURN p.id
        `,
        {
          id: p.providerId,
          name: p.providerName,
          type: p.providerType,
          country: p.country,
          countryCode: p.countryCode,
          city: p.city || '',
          currency: p.supportedCurrencies[0] || 'USD',
          supportedCurrencies: p.supportedCurrencies,
          status: p.status,
          transactionFee: p.transactionFee,
          averageLatency: p.averageLatency,
          liquidity: p.liquidity,
          reliability: p.reliability,
          isAvailable: p.isAvailable,
        }
      );
    }

    // Upsert edges
    for (const e of CORRIDOR_CONNECTIONS) {
      await session.run(
        `
        MATCH (a:PaymentProvider { id: $source })
        MATCH (b:PaymentProvider { id: $target })
        MERGE (a)-[r:CONNECTS_TO]->(b)
        SET r.corridorId = $corridorId,
            r.baseCost = $baseCost,
            r.latencyMs = $latencyMs,
            r.reliability = $reliability,
            r.status = $status,
            r.prohibited = $prohibited,
            r.isAvailable = $isAvailable
        RETURN r
        `,
        {
          source: e.source,
          target: e.target,
          corridorId: e.corridorId,
          baseCost: e.baseCost,
          latencyMs: e.latencyMs,
          reliability: e.reliability,
          status: e.status,
          prohibited: e.prohibited,
          isAvailable: e.isAvailable,
        }
      );
    }

    const nodeCountRes = await session.run('MATCH (p:PaymentProvider) RETURN count(p) AS count');
    const edgeCountRes = await session.run('MATCH ()-[r:CONNECTS_TO]->() RETURN count(r) AS count');
    const neo4jNodeCount = nodeCountRes.records[0].get('count').toInt();
    const neo4jEdgeCount = edgeCountRes.records[0].get('count').toInt();

    console.log(`✅ Neo4j: Exactly ${neo4jNodeCount} PaymentProvider nodes, ${neo4jEdgeCount} CONNECTS_TO relationships`);

    if (mongoCount === 15 && neo4jNodeCount === 15) {
      console.log('🎉 TOPOLOGY CONSISTENCY VERIFIED: EXACTLY 15 PROVIDERS IN BOTH MONGODB AND NEO4J!');
    } else {
      console.warn(`⚠️ Mismatch: MongoDB has ${mongoCount}, Neo4j has ${neo4jNodeCount}`);
    }
  } finally {
    await session.close();
    await driver.close();
    await mongoose.disconnect();
  }
}

if (process.argv[1]?.includes('reconcile-topology')) {
  reconcileTopology().catch((err) => {
    console.error('Topology reconciliation failed:', err);
    process.exit(1);
  });
}

