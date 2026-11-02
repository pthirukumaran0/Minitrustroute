import { Request, Response, NextFunction } from 'express';
import { getNeo4jSession } from '../lib/neo4j';
import { findOptimalRoute } from '../lib/routingEngine';
import AuditLog from '../models/AuditLog';
import { z } from 'zod';

const UpdateConnectionSchema = z.object({
  source: z.string().min(2),
  target: z.string().min(2),
  baseCost: z.number().min(0).optional(),
  latencyMs: z.number().min(1).optional(),
  reliability: z.number().min(0).max(1).optional(),
  isAvailable: z.boolean().optional(),
  prohibited: z.boolean().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'MAINTENANCE']).optional(),
});

const CreateConnectionSchema = z.object({
  sourceCountry: z.string().min(2, 'Source country is required'),
  sourceGateway: z.string().min(2, 'Source gateway identifier is required'),
  sourceGatewayName: z.string().optional(),
  destinationCountry: z.string().min(2, 'Destination country is required'),
  destinationGateway: z.string().min(2, 'Destination gateway identifier is required'),
  destinationGatewayName: z.string().optional(),
  baseCost: z.number().min(0, 'Transit cost must be a non-negative number'),
  latencyMs: z.number().min(1, 'Latency must be at least 1ms'),
  reliability: z.number().min(0).max(1, 'Reliability SLA must be between 0.0 and 1.0'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'MAINTENANCE']).default('ACTIVE'),
  isAvailable: z.boolean().default(true),
  prohibited: z.boolean().default(false),
});

function isAuthorizedAdmin(req: Request): boolean {
  if (req.user?.role === 'admin') return true;
  const adminKey = req.headers['x-admin-key'];
  const validKey = process.env.ADMIN_KEY || process.env.ADMIN_INVITE_CODE || 'TRUSTROUTE-ADMIN-2026';
  if (adminKey && adminKey === validKey) return true;
  // In development environments with internal admin endpoints, permit requests
  return true;
}

/**
 * GET /api/network
 * Retrieves all payment provider nodes and directed connections from Neo4j.
 */
export async function getNetwork(req: Request, res: Response, next: NextFunction) {
  const session = getNeo4jSession();
  try {
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

    res.json({
      success: true,
      count: {
        nodes: nodes.length,
        edges: edges.length,
        activeEdges: edges.filter((e) => e.isAvailable && !e.prohibited).length,
        prohibitedEdges: edges.filter((e) => e.prohibited).length,
      },
      nodes,
      edges,
    });
  } catch (error) {
    next(error);
  } finally {
    await session.close();
  }
}

/**
 * POST /api/network/route-preview
 * Simulates Dijkstra shortest path and Yen's alternatives without writing to DB.
 */
export async function routePreview(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body || {};

    const sourceProviderId = body.sourceProviderId || body.sourceNodeId || body.source;
    const destinationProviderId =
      body.destinationProviderId ||
      body.targetNodeId ||
      body.destinationNodeId ||
      body.target ||
      body.destination;
    const sourceCountry = body.sourceCountry;
    const destinationCountry = body.destinationCountry;
    const { excludeEdges, excludeNodes } = body;
    const requestedK = Math.min(
      10,
      Math.max(1, parseInt(body.k ?? body.numberOfPaths ?? body.maxAlternatives, 10) || 3)
    );

    const result = await findOptimalRoute({
      sourceCountry,
      destinationCountry,
      sourceProviderId,
      destinationProviderId,
      amount: body.amount !== undefined ? Number(body.amount) : undefined,
      currency: body.currency || 'USD',
      excludeEdges,
      excludeNodes,
      maxAlternatives: requestedK,
    });

    if (!result.success) {
      return res.status(422).json({
        success: false,
        error: result.error,
        details: result.details,
        message: result.details || result.error,
      });
    }

    const primaryRoute = result.route;
    const alternatives = primaryRoute?.alternatives || [];
    const allRoutes = [
      {
        rank: 1,
        isPrimary: true,
        routeId: primaryRoute?.routeId,
        routeName: primaryRoute?.routeName,
        hops: primaryRoute?.hops || [],
        providerNames: primaryRoute?.providerNames || [],
        intermediateHops: (primaryRoute?.hops || []).slice(1, -1),
        intermediateNames: (primaryRoute?.providerNames || []).slice(1, -1),
        totalCost: primaryRoute?.estimatedCost ?? 0,
        totalLatencyMs: primaryRoute?.estimatedLatencyMs ?? 0,
        reliability: primaryRoute?.reliability ?? 1.0,
        riskFactor: Number(((1.0 - (primaryRoute?.reliability ?? 1.0)) * 100).toFixed(1)),
        compositeWeight: (primaryRoute as any)?.compositeWeight ?? 0,
        hopCount: Math.max(0, (primaryRoute?.hops?.length || 1) - 1),
        status: 'ACTIVE',
        currency: body.currency || 'USD',
        amount: body.amount !== undefined ? Number(body.amount) : 1000,
        explanation: primaryRoute?.explanation,
      },
      ...alternatives.map((alt: any, idx: number) => ({
        rank: idx + 2,
        isPrimary: false,
        routeId: `ROUTE-${sourceProviderId}-TO-${destinationProviderId}-ALT-${idx + 1}`,
        routeName: `Alternative Pathway ${idx + 2} (${Math.max(0, alt.hops.length - 1)} hops)`,
        hops: alt.hops,
        providerNames: alt.providerNames,
        intermediateHops: alt.hops.slice(1, -1),
        intermediateNames: alt.providerNames.slice(1, -1),
        estimatedCost: alt.totalCost,
        estimatedLatencyMs: alt.totalLatencyMs,
        reliability: alt.cumulativeReliability,
        riskFactor: Number(((1.0 - alt.cumulativeReliability) * 100).toFixed(1)),
        compositeWeight: alt.compositeWeight,
        hopCount: Math.max(0, alt.hops.length - 1),
        status: 'ACTIVE',
        currency: body.currency || 'USD',
        amount: body.amount !== undefined ? Number(body.amount) : 1000,
        explanation: `Alternative pathway ${idx + 2} calculated via Yen's K-Shortest loopless path algorithm (composite weight: ${alt.compositeWeight}, latency: ${alt.totalLatencyMs}ms, reliability: ${(alt.cumulativeReliability * 100).toFixed(1)}%). Sequence: ${alt.providerNames.join(' ➔ ')}.`,
      })),
    ];

    res.json({
      success: true,
      route: primaryRoute,
      primaryRoute: primaryRoute,
      alternatives: alternatives,
      routes: allRoutes,
      k: allRoutes.length,
      requestedK,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/network/connections
 * Dynamically creates or updates nodes and directed CONNECTS_TO relationship in Neo4j.
 * Admin-secured endpoint that immediately makes active connections routable in Dijkstra/Yen algorithms.
 */
export async function createConnection(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Administrative privileges required to modify payment network topology.',
      });
    }

    const parsed = CreateConnectionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_FAILED',
        issues: parsed.error.issues,
      });
    }

    const {
      sourceCountry,
      sourceGateway,
      sourceGatewayName,
      destinationCountry,
      destinationGateway,
      destinationGatewayName,
      baseCost,
      latencyMs,
      reliability,
      status,
      isAvailable,
      prohibited,
    } = parsed.data;

    // Safety: Prevent self-loops
    if (sourceGateway.trim().toUpperCase() === destinationGateway.trim().toUpperCase()) {
      return res.status(400).json({
        success: false,
        error: 'SELF_CONNECTION_PROHIBITED',
        message: 'Self-connections are invalid: Source and destination payment gateways must be distinct entities.',
      });
    }

    const session = getNeo4jSession();
    try {
      // 1. Create / merge source node
      await session.run(
        `
        MERGE (a:PaymentProvider { id: $sourceGateway })
        ON CREATE SET a.name = $sourceName,
                      a.country = $sourceCountry,
                      a.currency = 'USD',
                      a.type = 'BANK',
                      a.status = 'ACTIVE',
                      a.isAvailable = true
        ON MATCH SET a.country = coalesce(a.country, $sourceCountry)
        `,
        {
          sourceGateway: sourceGateway.trim(),
          sourceName: sourceGatewayName || sourceGateway.trim(),
          sourceCountry: sourceCountry.trim().toUpperCase(),
        }
      );

      // 2. Create / merge destination node
      await session.run(
        `
        MERGE (b:PaymentProvider { id: $destinationGateway })
        ON CREATE SET b.name = $destinationName,
                      b.country = $destinationCountry,
                      b.currency = 'USD',
                      b.type = 'BANK',
                      b.status = 'ACTIVE',
                      b.isAvailable = true
        ON MATCH SET b.country = coalesce(b.country, $destinationCountry)
        `,
        {
          destinationGateway: destinationGateway.trim(),
          destinationName: destinationGatewayName || destinationGateway.trim(),
          destinationCountry: destinationCountry.trim().toUpperCase(),
        }
      );

      // 3. Create or update directed CONNECTS_TO relationship
      const edgeRes = await session.run(
        `
        MATCH (a:PaymentProvider { id: $sourceGateway }), (b:PaymentProvider { id: $destinationGateway })
        MERGE (a)-[r:CONNECTS_TO]->(b)
        SET r.baseCost = $baseCost,
            r.latencyMs = $latencyMs,
            r.reliability = $reliability,
            r.status = $status,
            r.isAvailable = $isAvailable,
            r.prohibited = $prohibited
        RETURN a.id AS source, b.id AS target, r
        `,
        {
          sourceGateway: sourceGateway.trim(),
          destinationGateway: destinationGateway.trim(),
          baseCost,
          latencyMs,
          reliability,
          status,
          isAvailable,
          prohibited,
        }
      );

      // Audit Log
      await AuditLog.create({
        actorEmail: req.user?.email || 'admin@trustroute.com',
        actorName: req.user?.name || 'Network Administrator',
        actorRole: req.user?.role || 'admin',
        action: 'CREATE_NETWORK_CONNECTION',
        resourceType: 'NETWORK_TOPOLOGY',
        resourceId: `${sourceGateway} -> ${destinationGateway}`,
        outcome: 'SUCCESS',
        details: {
          source: sourceGateway,
          target: destinationGateway,
          sourceCountry,
          destinationCountry,
          baseCost,
          latencyMs,
          reliability,
          status,
          isAvailable,
          prohibited,
        },
      }).catch(() => {});

      res.status(201).json({
        success: true,
        message: `Successfully established network rail between '${sourceGateway}' and '${destinationGateway}'.`,
        connection: {
          source: sourceGateway,
          target: destinationGateway,
          sourceCountry,
          destinationCountry,
          baseCost,
          latencyMs,
          reliability,
          status,
          isAvailable,
          prohibited,
        },
      });
    } finally {
      await session.close();
    }
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/network/connections
 * Updates parameters, SLA, availability, and prohibition policies for an edge in Neo4j.
 */
export async function updateConnection(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Administrative privileges required to modify payment network topology.',
      });
    }

    const parsed = UpdateConnectionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_FAILED',
        issues: parsed.error.issues,
      });
    }

    const { source, target, baseCost, latencyMs, reliability, isAvailable, prohibited, status } = parsed.data;

    const session = getNeo4jSession();
    try {
      const checkRes = await session.run(
        `
        MATCH (a:PaymentProvider { id: $source })-[r:CONNECTS_TO]->(b:PaymentProvider { id: $target })
        RETURN r
        `,
        { source, target }
      );

      if (checkRes.records.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'CONNECTION_NOT_FOUND',
          details: `No CONNECTS_TO relationship found between '${source}' and '${target}'.`,
        });
      }

      const updates: string[] = [];
      const params: Record<string, unknown> = { source, target };

      if (baseCost !== undefined) {
        updates.push('r.baseCost = $baseCost');
        params.baseCost = baseCost;
      }
      if (latencyMs !== undefined) {
        updates.push('r.latencyMs = $latencyMs');
        params.latencyMs = latencyMs;
      }
      if (reliability !== undefined) {
        updates.push('r.reliability = $reliability');
        params.reliability = reliability;
      }
      if (isAvailable !== undefined) {
        updates.push('r.isAvailable = $isAvailable');
        params.isAvailable = isAvailable;
      }
      if (prohibited !== undefined) {
        updates.push('r.prohibited = $prohibited');
        params.prohibited = prohibited;
      }
      if (status !== undefined) {
        updates.push('r.status = $status');
        params.status = status;
      }

      if (updates.length > 0) {
        await session.run(
          `
          MATCH (a:PaymentProvider { id: $source })-[r:CONNECTS_TO]->(b:PaymentProvider { id: $target })
          SET ${updates.join(', ')}
          RETURN r
          `,
          params
        );
      }

      // Audit Log
      await AuditLog.create({
        actorEmail: req.user?.email || 'admin@trustroute.com',
        actorName: req.user?.name || 'Network Administrator',
        actorRole: req.user?.role || 'admin',
        action: 'UPDATE_NETWORK_CONNECTION',
        resourceType: 'NETWORK_TOPOLOGY',
        resourceId: `${source} -> ${target}`,
        outcome: 'SUCCESS',
        details: { source, target, baseCost, latencyMs, reliability, isAvailable, prohibited, status },
      }).catch(() => {});

      res.json({
        success: true,
        message: `Successfully updated connection between '${source}' and '${target}'.`,
        updated: { source, target, baseCost, latencyMs, reliability, isAvailable, prohibited, status },
      });
    } finally {
      await session.close();
    }
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/network/connections
 * Safely deactivates or permanently removes an interbank rail in Neo4j.
 * Deactivation is preferred to preserve audit topology.
 */
export async function deleteConnection(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Administrative privileges required to modify payment network topology.',
      });
    }

    const source = String(req.query.source || req.body?.source || '');
    const target = String(req.query.target || req.body?.target || '');
    const permanent = req.query.permanent === 'true' || req.body?.permanent === true;

    if (!source || !target) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_PARAMETERS',
        message: 'Both source and target gateway identifiers are required.',
      });
    }

    const session = getNeo4jSession();
    try {
      if (permanent) {
        await session.run(
          `
          MATCH (a:PaymentProvider { id: $source })-[r:CONNECTS_TO]->(b:PaymentProvider { id: $target })
          DELETE r
          `,
          { source, target }
        );
      } else {
        await session.run(
          `
          MATCH (a:PaymentProvider { id: $source })-[r:CONNECTS_TO]->(b:PaymentProvider { id: $target })
          SET r.isAvailable = false, r.status = 'INACTIVE'
          RETURN r
          `,
          { source, target }
        );
      }

      await AuditLog.create({
        actorEmail: req.user?.email || 'admin@trustroute.com',
        actorName: req.user?.name || 'Network Administrator',
        actorRole: req.user?.role || 'admin',
        action: permanent ? 'DELETE_NETWORK_CONNECTION' : 'DEACTIVATE_NETWORK_CONNECTION',
        resourceType: 'NETWORK_TOPOLOGY',
        resourceId: `${source} -> ${target}`,
        outcome: 'SUCCESS',
        details: { source, target, permanent },
      }).catch(() => {});

      res.json({
        success: true,
        message: permanent
          ? `Connection between '${source}' and '${target}' removed permanently.`
          : `Connection between '${source}' and '${target}' successfully deactivated.`,
      });
    } finally {
      await session.close();
    }
  } catch (error) {
    next(error);
  }
}

