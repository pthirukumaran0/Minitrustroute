import neo4j, { Driver, Session } from 'neo4j-driver';

/**
 * Cache Neo4j Driver in global scope to prevent leaking socket connections
 * during Next.js Hot Module Replacement (HMR) in development.
 */
interface Neo4jCache {
  driver: Driver | null;
}

declare global {
  // eslint-disable-next-line no-var
  var neo4jCache: Neo4jCache | undefined;
}

let cached: Neo4jCache = global.neo4jCache || { driver: null };

if (!global.neo4jCache) {
  global.neo4jCache = cached;
}

/**
 * Returns a shared instance of the Neo4j driver.
 */
export function getNeo4jDriver(): Driver {
  if (cached.driver) {
    return cached.driver;
  }

  const uri = process.env.NEO4J_URI || 'bolt://127.0.0.1:7687';
  const username = process.env.NEO4J_USERNAME || process.env.NEO4J_USER || 'neo4j';
  const password = process.env.NEO4J_PASSWORD;

  if (!password) {
    throw new Error(
      'Missing NEO4J_PASSWORD environment variable. Please define it in your .env.local file.'
    );
  }

  const driver = neo4j.driver(uri, neo4j.auth.basic(username, password), {
    maxConnectionLifetime: 60 * 60 * 1000, // 1 hour
    maxConnectionPoolSize: 50,
    connectionAcquisitionTimeout: 5000,
  });

  cached.driver = driver;
  return driver;
}

/**
 * Creates a new session for executing Cypher queries.
 * Remember to always close the session when done (e.g. In a try/finally block).
 */
export function getNeo4jSession(database?: string): Session {
  const driver = getNeo4jDriver();
  const db = database || process.env.NEO4J_DATABASE || 'neo4j';
  return driver.session({ database: db });
}

/**
 * Performs an active connectivity check and test query on Neo4j.
 */
export async function checkNeo4jHealth(): Promise<{
  status: 'healthy' | 'unhealthy';
  database?: string;
  latencyMs?: number;
  error?: string;
}> {
  const startTime = Date.now();
  try {
    const driver = getNeo4jDriver();
    await driver.verifyConnectivity();

    const db = process.env.NEO4J_DATABASE || 'neo4j';
    const session = driver.session({ database: db });

    try {
      const result = await session.run('RETURN 1 AS ping');
      const val = result.records[0]?.get('ping');
      const latencyMs = Date.now() - startTime;

      return {
        status: val ? 'healthy' : 'unhealthy',
        database: db,
        latencyMs,
      };
    } finally {
      await session.close();
    }
  } catch (err: unknown) {
    return {
      status: 'unhealthy',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Safely closes the driver instance (useful in scripts and tests).
 * Also resets the global cache so the next call to getNeo4jDriver() creates a fresh connection.
 */
export async function closeNeo4jDriver(): Promise<void> {
  if (cached.driver) {
    try {
      await cached.driver.close();
    } finally {
      cached.driver = null;
      if (global.neo4jCache) {
        global.neo4jCache.driver = null;
      }
    }
  }
}

