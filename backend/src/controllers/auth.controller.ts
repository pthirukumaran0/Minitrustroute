import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { connectToDatabase } from '../lib/database';
import User from '../models/User';
import AuditLog from '../models/AuditLog';
import RevokedToken from '../models/RevokedToken';
import { hashPassword, verifyPassword, signToken } from '../lib/auth';
import { ensureStableAnonymousIds, getOrAssignAnonymousId } from '../lib/userUtils';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const RegisterSchema = z.object({
  name: z.string().min(2, 'Full name must have at least 2 characters'),
  email: z.string().email('Valid email address is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  mobileNumber: z.string().optional(),
  role: z.string().optional(),
  organization: z.string().optional(),
});

/**
 * Predefined canonical demo personas for instant one-click switching and testing.
 */
export const CANONICAL_PERSONAS = [
  {
    role: 'sender' as const,
    name: 'Sarah Jenkins',
    email: 'sender@trustroute.com',
    organization: 'Starlight Global Logistics LLC',
    title: 'Corporate Treasury Director',
    description: 'Corporate client creating international corridors and tracking liquidity transfers.',
  },
  {
    role: 'analyst' as const,
    name: 'Alex Rivera',
    email: 'analyst@trustroute.com',
    organization: 'TrustRoute Fraud Ops',
    title: 'Senior Fraud Operations Specialist',
    description: 'Investigates SIM-swap anomalies, audits review queues, and analyzes rail risks.',
  },
  {
    role: 'admin' as const,
    name: 'Elena Rostova',
    email: 'admin@trustroute.com',
    organization: 'TrustRoute Core Infrastructure',
    title: 'Platform Chief Architect & Administrator',
    description: 'Monitors ground-truth benchmark simulations, manages users, and manages network rails.',
  },
];

/**
 * POST /api/auth/login
 */
export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_FAILED',
        issues: parsed.error.issues,
      });
    }

    const { email, password } = parsed.data;
    await connectToDatabase();

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        error: 'ACCOUNT_INACTIVE',
        message: `Account is currently ${user.status.toLowerCase()}. Please contact an administrator.`,
      });
    }

    const isValid = verifyPassword(password, user.salt, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      });
    }

    // Update last login and loginCount
    user.lastLogin = new Date();
    user.lastLoginAt = user.lastLogin;
    user.loginCount = (user.loginCount || 0) + 1;
    if (!user.anonymousId) {
      await getOrAssignAnonymousId(user);
    } else {
      await user.save();
    }

    const token = signToken({
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      organization: user.organization,
    });

    // Audit log
    await AuditLog.create({
      actorEmail: user.email,
      actorName: user.name,
      actorRole: user.role,
      action: 'USER_LOGIN',
      resourceType: 'AUTH',
      resourceId: user._id.toString(),
      outcome: 'SUCCESS',
      details: { role: user.role, organization: user.organization },
    }).catch(() => {});

    res.json({
      success: true,
      token,
      user: user.toSafeObject(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/register
 */
export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_FAILED',
        issues: parsed.error.issues,
      });
    }

    const { name, email, password, mobileNumber, organization } = parsed.data;
    await connectToDatabase();

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'USER_EXISTS',
        message: 'A user with this email address is already registered.',
      });
    }

    const { salt, hash } = hashPassword(password);
    const newUser = await User.create({
      name,
      email: email.toLowerCase(),
      passwordHash: hash,
      salt,
      role: 'sender',
      mobileNumber: mobileNumber || '+14155550142',
      demoRoleSwitch: false,
      organization: organization || 'TrustRoute Enterprise Client',
      status: 'ACTIVE',
    });

    const token = signToken({
      userId: newUser._id.toString(),
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
      organization: newUser.organization,
    });

    res.status(201).json({
      success: true,
      token,
      user: newUser.toSafeObject(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/auth/me
 */
export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
    }

    await connectToDatabase();
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'USER_NOT_FOUND' });
    }

    res.json({
      success: true,
      user: user.toSafeObject(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/quick-switch
 * Allows immediate persona switching for evaluation and demonstration.
 */
export async function quickSwitch(req: Request, res: Response, next: NextFunction) {
  try {
    const targetRole = String(req.body?.role || '').toLowerCase();
    const persona = CANONICAL_PERSONAS.find((p) => p.role === targetRole);

    if (!persona) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_ROLE',
        message: "Role must be 'sender', 'analyst', or 'admin'.",
      });
    }

    await connectToDatabase();
    let user = await User.findOne({ email: persona.email });

    if (!user) {
      const { salt, hash } = hashPassword(`${persona.role.toUpperCase()}@2026`);
      user = await User.create({
        name: persona.name,
        email: persona.email,
        passwordHash: hash,
        salt,
        role: persona.role,
        organization: persona.organization,
        status: 'ACTIVE',
        demoRoleSwitch: true,
      });
    } else if (!user.demoRoleSwitch) {
      user.demoRoleSwitch = true;
      await user.save();
    }

    user.lastLogin = new Date();
    user.lastLoginAt = user.lastLogin;
    user.loginCount = (user.loginCount || 0) + 1;
    if (!user.anonymousId) {
      await getOrAssignAnonymousId(user);
    } else {
      await user.save();
    }

    const token = signToken({
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      organization: user.organization,
    });

    res.json({
      success: true,
      token,
      user: user.toSafeObject(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/auth/personas
 */
export async function getPersonas(req: Request, res: Response) {
  res.json({
    success: true,
    personas: CANONICAL_PERSONAS,
  });
}

/**
 * POST /api/auth/logout
 * Revokes current JWT token server-side so it cannot be reused.
 */
export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.user && req.user.jti) {
      await connectToDatabase();
      const expiresAt = req.user.exp ? new Date(req.user.exp * 1000) : new Date(Date.now() + 24 * 3600 * 1000);
      await RevokedToken.create({
        jti: req.user.jti,
        userId: req.user.userId,
        reason: 'LOGOUT',
        expiresAt,
      }).catch(() => {});
    }

    res.json({
      success: true,
      message: 'Logged out successfully.',
    });
  } catch (error) {
    next(error);
  }
}


