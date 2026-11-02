import { Request, Response, NextFunction } from 'express';
import { connectToDatabase } from '../lib/database';
import Transaction from '../models/Transaction';
import AuditLog from '../models/AuditLog';

// In-memory set of read notification IDs for active session
const readNotificationIds = new Set<string>();

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: 'RISK_ALERT' | 'STEP_UP' | 'SECURITY' | 'TRANSACTION' | 'SYSTEM';
  severity: 'critical' | 'warning' | 'info' | 'success';
  link: string;
  read: boolean;
}

/**
 * GET /api/notifications
 * Generates actionable, real notifications from MongoDB transactions and audit logs.
 */
export async function getNotifications(req: Request, res: Response, next: NextFunction) {
  try {
    await connectToDatabase();

    // 1. Fetch recent flagged / important transactions
    const recentTxns = await Transaction.find({})
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    // 2. Fetch recent audit security events
    const recentAudits = await AuditLog.find({})
      .sort({ timestamp: -1 })
      .limit(10)
      .lean();

    const notifications: AppNotification[] = [];

    // Transform transactions into notifications
    for (const tx of recentTxns) {
      const isRead = readNotificationIds.has(`txn-${tx.transactionId}`);

      if (tx.riskDecision === 'BLOCKED') {
        const hasSimSwap = Boolean(tx.signals?.simSwap24h);
        notifications.push({
          id: `txn-${tx.transactionId}`,
          title: hasSimSwap ? 'CRITICAL: SIM Swap Block' : 'Payment Route Blocked',
          message: `Transaction ${tx.transactionId} (${tx.amount} ${tx.currency}) was blocked. Risk score: ${tx.riskScore}/100.`,
          timestamp: tx.createdAt ? new Date(tx.createdAt).toISOString() : new Date().toISOString(),
          type: 'RISK_ALERT',
          severity: 'critical',
          link: `/transactions/${tx.transactionId}`,
          read: isRead,
        });
      } else if (tx.riskDecision === 'STEP_UP' || tx.status === 'STEP_UP_REQUIRED') {
        notifications.push({
          id: `txn-${tx.transactionId}`,
          title: 'Action Required: Step-Up Verification',
          message: `Transaction ${tx.transactionId} (${tx.amount} ${tx.currency}) requires MFA device confirmation.`,
          timestamp: tx.createdAt ? new Date(tx.createdAt).toISOString() : new Date().toISOString(),
          type: 'STEP_UP',
          severity: 'warning',
          link: `/step-up`,
          read: isRead,
        });
      } else if (tx.status === 'APPROVED' && tx.selectedRoute) {
        notifications.push({
          id: `txn-${tx.transactionId}`,
          title: 'Payment Routed Successfully',
          message: `Transaction ${tx.transactionId} routed via ${tx.selectedRoute.hops?.length || 0} hops (${tx.selectedRoute.estimatedLatencyMs}ms).`,
          timestamp: tx.createdAt ? new Date(tx.createdAt).toISOString() : new Date().toISOString(),
          type: 'TRANSACTION',
          severity: 'success',
          link: `/transactions/${tx.transactionId}`,
          read: isRead,
        });
      }
    }

    // Transform audit logs into security/system notifications
    for (const log of recentAudits) {
      const auditId = `audit-${log._id}`;
      const isRead = readNotificationIds.has(auditId);

      if (log.outcome === 'BLOCKED' || log.outcome === 'FAILURE') {
        notifications.push({
          id: auditId,
          title: `Security Event: ${log.action}`,
          message: `Actor ${log.actorEmail} (${log.actorRole}): ${log.action} failed on ${log.resourceType}.`,
          timestamp: log.timestamp ? new Date(log.timestamp).toISOString() : new Date().toISOString(),
          type: 'SECURITY',
          severity: 'warning',
          link: '/audit',
          read: isRead,
        });
      }
    }

    // Sort by timestamp descending
    notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Keep top 15
    const topNotifications = notifications.slice(0, 15);
    const unreadCount = topNotifications.filter((n) => !n.read).length;

    res.json({
      success: true,
      unreadCount,
      notifications: topNotifications,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/notifications/:id/read
 * Marks a notification as read.
 */
export async function markNotificationAsRead(req: Request, res: Response, next: NextFunction) {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    if (id) {
      readNotificationIds.add(String(id));
    }
    res.json({ success: true, id, read: true });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/notifications/mark-all-read
 * Marks all notifications as read.
 */
export async function markAllNotificationsAsRead(req: Request, res: Response, next: NextFunction) {
  try {
    const { ids } = req.body;
    if (Array.isArray(ids)) {
      for (const id of ids) {
        readNotificationIds.add(String(id));
      }
    }
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
}
