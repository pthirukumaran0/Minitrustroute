import { Request, Response, NextFunction } from 'express';
import { verifyToken, UserTokenPayload } from '../lib/auth';
import { connectToDatabase } from '../lib/database';
import RevokedToken from '../models/RevokedToken';
import User, { UserRole } from '../models/User';

declare global {
  namespace Express {
    interface Request {
      user?: UserTokenPayload;
      /** Raw bearer token of the current request (used for logout revocation). */
      authToken?: string;
    }
  }
}

function extractToken(req: Request): string | undefined {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  if (req.headers['x-auth-token']) {
    return String(req.headers['x-auth-token']).trim();
  }
  return undefined;
}

/**
 * Returns true when the token id has been revoked (logout / role switch).
 * Tokens without a jti were issued before revocation support existed; they are
 * treated as revoked so that every active session carries a revocable id.
 */
async function isRevoked(payload: UserTokenPayload): Promise<boolean> {
  if (!payload.jti) return false;
  await connectToDatabase();
  const hit = await RevokedToken.exists({ jti: payload.jti });
  return Boolean(hit);
}

/**
 * Middleware that strictly verifies JWT authentication token.
 * Rejects with 401 if missing, invalid, expired or revoked.
 */
export async function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Authentication token is required to access this resource.',
    });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({
      success: false,
      error: 'INVALID_OR_EXPIRED_TOKEN',
      message: 'Your session has expired or the token is invalid. Please log in again.',
    });
  }

  try {
    if (await isRevoked(payload)) {
      return res.status(401).json({
        success: false,
        error: 'TOKEN_REVOKED',
        message: 'This session has been signed out. Please log in again.',
      });
    }

    // Verify account status: Deny immediately if account has been suspended or deactivated
    await connectToDatabase();
    const userDoc = await User.findById(payload.userId).select('status').lean();
    if (userDoc && (userDoc.status === 'SUSPENDED' || userDoc.status === 'INACTIVE')) {
      return res.status(403).json({
        success: false,
        error: 'ACCOUNT_SUSPENDED',
        message: 'Your account has been suspended by an administrator. Access is denied.',
      });
    }
  } catch (err) {
    // Fail closed: if revocation status cannot be determined, do not authenticate.
    return next(err);
  }

  req.user = payload;
  req.authToken = token;
  next();
}

/**
 * Optional authentication middleware: if a valid, non-revoked token is present, attaches user;
 * does not reject if missing.
 */
export async function optionalAuthenticate(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);

  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      try {
        if (!(await isRevoked(payload))) {
          req.user = payload;
          req.authToken = token;
        }
      } catch (err) {
        return next(err);
      }
    }
  }

  next();
}

/**
 * Role-Based Access Control (RBAC) middleware.
 * Verifies that the authenticated user possesses one of the required roles.
 */
export function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication is required before authorization check.',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: `Access denied. Role '${req.user.role}' is not authorized for this operation. Requires one of: [${allowedRoles.join(', ')}].`,
      });
    }

    next();
  };
}
