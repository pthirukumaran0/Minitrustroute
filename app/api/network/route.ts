import { NextResponse } from 'next/server';
import { getNeo4jSession } from '@/src/lib/neo4j';

export async function GET() {
  const session = getNeo4jSession();
  try {
    // 1. Fetch all provider nodes
    const nodeRes = await session.run(`
      MATCH (p:PaymentProvider)
      RETURN p.id AS id, p.name AS name, p.type AS type,
             p.country AS country, p.currency AS currency,
             coalesce(p.status, 'ACTIVE') AS status,
             coalesce(p.isAvailable, true) AS isAvailable
      ORDER BY p.country, p.name
    `);

    const nodes = nodeRes.records.map((r) => ({
      id: r.get('id'),
      name: r.get('name'),
      type: r.get('type'),
      country: r.get('country'),
      currency: r.get('currency'),
      status: r.get('status'),
      isAvailable: Boolean(r.get('isAvailable')),
    }));

    // 2. Fetch all directed connections
    const edgeRes = await session.run(`
      MATCH (a:PaymentProvider)-[r:CONNECTS_TO]->(b:PaymentProvider)
      RETURN a.id AS source, b.id AS target,
             r.baseCost AS baseCost,
             r.latencyMs AS latencyMs,
             r.reliability AS reliability,
             coalesce(r.status, 'ACTIVE') AS status,
             coalesce(r.isAvailable, true) AS isAvailable,
             coalesce(r.prohibited, false) AS prohibited
      ORDER BY a.id, b.id
    `);

    const edges = edgeRes.records.map((r) => {
      const rawCost = r.get('baseCost');
      const rawLatency = r.get('latencyMs');
      const rawRel = r.get('reliability');

      const baseCost =
        typeof rawCost === 'object' && rawCost !== null && 'toNumber' in rawCost
          ? (rawCost as { toNumber(): number }).toNumber()
          : Number(rawCost ?? 1.0);

      const latencyMs =
        typeof rawLatency === 'object' && rawLatency !== null && 'toNumber' in rawLatency
          ? (rawLatency as { toNumber(): number }).toNumber()
          : Number(rawLatency ?? 50);

      const reliability =
        typeof rawRel === 'object' && rawRel !== null && 'toNumber' in rawRel
          ? (rawRel as { toNumber(): number }).toNumber()
          : Number(rawRel ?? 0.99);

      return {
        source: r.get('source'),
        target: r.get('target'),
        baseCost,
        latencyMs,
        reliability,
        status: r.get('status'),
        isAvailable: Boolean(r.get('isAvailable')),
        prohibited: Boolean(r.get('prohibited')),
      };
    });

    return NextResponse.json({
      success: true,
      count: {
        nodes: nodes.length,
        edges: edges.length,
        activeEdges: edges.filter((e) => e.isAvailable && !e.prohibited && e.status === 'ACTIVE').length,
        prohibitedEdges: edges.filter((e) => e.prohibited || !e.isAvailable).length,
      },
      nodes,
      edges,
    });
  } catch (error: unknown) {
    console.error('Error fetching Neo4j network:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to query graph topology',
      },
      { status: 500 }
    );
  } finally {
    await session.close();
  }
}

