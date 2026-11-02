import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { connectToDatabase } from '../lib/database';
import User, { UserRole } from '../models/User';
import AuditLog from '../models/AuditLog';

const UpdateRoleSchema = z.object({
  role: z.enum(['sender', 'analyst']),
});

const UpdateStatusSchema = z.object({
  status: z.preprocess((val) => {
    if (typeof val === 'string') {
      const upper = val.trim().toUpperCase();
      if (upper === 'DISABLED' || upper === 'SUSPEND' || upper === 'SUSPENDED') return 'SUSPENDED';
      if (upper === 'ACTIVE' || upper === 'ENABLED' || upper === 'REACTIVATE') return 'ACTIVE';
      if (upper === 'INACTIVE') return 'INACTIVE';
      return upper;
    }
    return val;
  }, z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED'])),
  reason: z.string().optional(),
});

/**
 * GET /api/users
 * Returns paginated user list with role filtering and search (Admin only).
 */
export async function getUsers(req: Request, res: Response, next: NextFunction) {
  try {
    await connectToDatabase();

    const limit = Math.min(50, Math.max(1, parseInt((req.query.limit as string) || '15', 10)));
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const skip = (page - 1) * limit;

    const role = req.query.role as string | undefined;
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;

    const query: Record<string, unknown> = {};

    if (role && ['sender', 'analyst'].includes(role.toLowerCase())) {
      query.role = role.toLowerCase();
    } else if (req.query.includeAdmin !== 'true') {
      // Exclude Admin accounts from regular User Management
      query.role = { $in: ['sender', 'analyst'] };
    }

    if (status && ['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(status.toUpperCase())) {
      query.status = status.toUpperCase();
    }

    if (search && search.trim().length > 0) {
      const sanitized = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { name: { $regex: sanitized, $options: 'i' } },
        { email: { $regex: sanitized, $options: 'i' } },
        { organization: { $regex: sanitized, $options: 'i' } },
      ];
    }

    const [total, users] = await Promise.all([
      User.countDocuments(query),
      User.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ]);

    const safeUsers = users.map((u) => {
      const { passwordHash, salt, ...safe } = u as any;
      return { ...safe, id: u._id.toString() };
    });

    res.json({
      success: true,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
      users: safeUsers,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/users/:id/role
 * Admin updates a user's role. Prevents removing the last admin.
 */
export async function updateUserRole(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.params.id;
    const parsed = UpdateRoleSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_FAILED',
        issues: parsed.error.issues,
      });
    }

    const { role } = parsed.data;
    await connectToDatabase();

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: 'USER_NOT_FOUND',
        message: `User with ID '${userId}' not found.`,
      });
    }

    // Safety check: Administrator accounts cannot be modified through the User Management interface
    if (targetUser.role === 'admin') {
      return res.status(403).json({
        success: false,
        error: 'ADMIN_MODIFICATION_PROHIBITED',
        message: 'Administrator accounts cannot be modified through the User Management interface.',
      });
    }

    const previousRole = targetUser.role;
    targetUser.role = role;
    await targetUser.save();

    // Audit log
    await AuditLog.create({
      actorEmail: req.user?.email || 'admin@trustroute.com',
      actorName: req.user?.name || 'Administrator',
      actorRole: req.user?.role || 'admin',
      action: 'UPDATE_USER_ROLE',
      resourceType: 'USER',
      resourceId: targetUser._id.toString(),
      outcome: 'SUCCESS',
      details: { targetEmail: targetUser.email, previousRole, newRole: role },
    }).catch(() => {});

    res.json({
      success: true,
      message: `User role updated from '${previousRole}' to '${role}'.`,
      user: targetUser.toSafeObject(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/users/:id/status
 * Admin toggles user account status (ACTIVE, INACTIVE, SUSPENDED).
 */
export async function updateUserStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = String(req.params.id || '');
    const parsed = UpdateStatusSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_FAILED',
        issues: parsed.error.issues,
      });
    }

    const { status, reason } = parsed.data;
    await connectToDatabase();

    const targetUser = await User.findOne({
      $or: [
        ...(userId.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: userId }] : []),
        { email: userId.toLowerCase() },
        { anonymousId: userId },
      ],
    });
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: 'USER_NOT_FOUND',
        message: `User '${userId}' not found.`,
      });
    }

    // Safety check: Prevent Admin from accidentally suspending or disabling their own account
    const currentUserId = req.user?.userId;
    const currentUserEmail = req.user?.email?.toLowerCase();
    if (
      status !== 'ACTIVE' &&
      ((currentUserId && targetUser._id.toString() === currentUserId) ||
        (currentUserEmail && targetUser.email.toLowerCase() === currentUserEmail))
    ) {
      return res.status(400).json({
        success: false,
        error: 'SELF_SUSPENSION_PROHIBITED',
        message: 'Administrators are strictly prohibited from suspending their own account.',
      });
    }

    // Safety check: Prevent disabling the last active admin
    if (targetUser.role === 'admin' && status !== 'ACTIVE') {
      const activeAdminCount = await User.countDocuments({ role: 'admin', status: 'ACTIVE' });
      if (activeAdminCount <= 1) {
        return res.status(400).json({
          success: false,
          error: 'LAST_ADMIN_PROTECTION',
          message: 'Cannot disable or suspend the last active administrator account.',
        });
      }
    }

    const previousStatus = targetUser.status;
    targetUser.status = status;
    await targetUser.save();

    const action =
      status === 'SUSPENDED'
        ? 'SUSPEND_USER'
        : status === 'ACTIVE'
        ? 'REACTIVATE_USER'
        : 'UPDATE_USER_STATUS';

    // Audit log
    await AuditLog.create({
      actorEmail: req.user?.email || 'admin@trustroute.com',
      actorName: req.user?.name || 'Administrator',
      actorRole: req.user?.role || 'admin',
      action,
      resourceType: 'USER',
      resourceId: targetUser._id.toString(),
      outcome: 'SUCCESS',
      details: {
        targetEmail: targetUser.email,
        targetUserId: targetUser._id.toString(),
        previousStatus,
        newStatus: status,
        reason: reason || 'Administrative action',
      },
    }).catch(() => {});

    res.json({
      success: true,
      message: `User '${targetUser.name}' status changed to '${status}'.`,
      user: {
        ...targetUser.toSafeObject(),
        id: targetUser._id.toString(),
      },
    });
  } catch (error) {
    next(error);
  }
}

