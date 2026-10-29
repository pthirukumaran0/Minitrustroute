import { NextResponse } from 'next/server';
import { checkMongoHealth } from '@/src/lib/database';
import { checkNeo4jHealth } from '@/src/lib/neo4j';

export async function GET() {
  const timestamp = new Date().toISOString();

  // Run health checks concurrently
  const [mongoHealth, neo4jHealth] = await Promise.all([
    checkMongoHealth(),
    checkNeo4jHealth(),
  ]);

  const isHealthy = mongoHealth.status === 'healthy' && neo4jHealth.status === 'healthy';
  const statusCode = isHealthy ? 200 : 503;

  return NextResponse.json(
    {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp,
      databases: {
        mongodb: mongoHealth,
        neo4j: neo4jHealth,
      },
    },
    { status: statusCode }
  );
}
