import { Request, Response, NextFunction } from 'express';
import { checkMongoHealth } from '../lib/database';
import { checkNeo4jHealth } from '../lib/neo4j';
import { checkCamaraConnectivity } from '../services/camaraService';

export async function getHealth(req: Request, res: Response, next: NextFunction) {
  try {
    const timestamp = new Date().toISOString();

    const [mongoHealth, neo4jHealth, camaraHealth] = await Promise.all([
      checkMongoHealth(),
      checkNeo4jHealth(),
      checkCamaraConnectivity().catch((err) => ({
        mode: 'error',
        isSimulated: false,
        provider: 'CAMARA Gateway',
        status: 'ERROR',
        message: err.message,
      })),
    ]);

    const isHealthy = mongoHealth.status === 'healthy' && neo4jHealth.status === 'healthy';
    const statusCode = isHealthy ? 200 : 503;

    res.status(statusCode).json({
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp,
      databases: {
        mongodb: mongoHealth,
        neo4j: neo4jHealth,
      },
      telecomGateway: camaraHealth,
    });
  } catch (error) {
    next(error);
  }
}

export async function getCamaraHealth(req: Request, res: Response, next: NextFunction) {
  try {
    const diagnostic = await checkCamaraConnectivity();
    const statusCode = diagnostic.status === 'ERROR' ? 502 : 200;
    res.status(statusCode).json({
      success: diagnostic.status !== 'ERROR',
      diagnostic,
    });
  } catch (error) {
    next(error);
  }
}

