import { Request, Response, NextFunction } from 'express';
import { connectToDatabase } from '../lib/database';
import AuditLog from '../models/AuditLog';

/**
 * GET /api/audit
 * Returns paginated immutable audit records.
 * Accessible to Analyst and Admin personas.
 */
export async function getAuditLogs(req: Request, res: Response, next: NextFunction) {
  try {
    await connectToDatabase();

    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '25', 10)));
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const skip = (page - 1) * limit;

    const action = req.query.action as string | undefined;
    const actorRole = req.query.actorRole as string | undefined;
    const outcome = req.query.outcome as string | undefined;

    const query: Record<string, unknown> = {};
    if (action) query.action = action;
    if (actorRole) query.actorRole = actorRole;
    if (outcome) query.outcome = outcome;

    const [total, logs] = await Promise.all([
      AuditLog.countDocuments(query),
      AuditLog.find(query).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
    ]);

    res.json({
      success: true,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
      logs,
    });
  } catch (error) {
    next(error);
  }
}

