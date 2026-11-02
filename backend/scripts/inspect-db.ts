import neo4j from 'neo4j-driver';

async function main() {
  const driver = neo4j.driver(process.env.NEO4J_URI!, neo4j.auth.basic(process.env.NEO4J_USERNAME || 'neo4j', process.env.NEO4J_PASSWORD!));
  const s = driver.session({ database: process.env.NEO4J_DATABASE || 'neo4j' });
  const n = await s.run('MATCH (p:PaymentProvider) RETURN p.id AS id, p.name AS name, p.type AS type, p.country AS c, p.currency AS cur, p.status AS st ORDER BY id');
  for (const r of n.records) console.log('N', r.get('id'), '|', r.get('name'), '|', r.get('type'), r.get('c'), r.get('cur'), r.get('st'));
  const e = await s.run('MATCH (a)-[r:CONNECTS_TO]->(b) RETURN a.id AS a, b.id AS b, r.baseCost AS c, r.latencyMs AS l, r.reliability AS rel, r.status AS st, r.prohibited AS p, r.isAvailable AS av ORDER BY a, b');
  for (const r of e.records) console.log('E', r.get('a'), '->', r.get('b'), r.get('c'), r.get('l'), r.get('rel'), r.get('st'), 'prohibited=' + r.get('p'), 'avail=' + r.get('av'));
  await s.close(); await driver.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
