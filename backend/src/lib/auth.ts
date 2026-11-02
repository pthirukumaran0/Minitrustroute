import crypto from 'crypto';

/**
 * TrustRoute Secure Authentication Utility
 * -----------------------------------------
 * Implements standard RFC 7519 JWT (HS256) and PBKDF2 password hashing
 * using Node.js's built-in `crypto` module without requiring external packages.
 */

const JWT_SECRET = process.env.JWT_SECRET || 'trustroute-secure-jwt-secret-key-2026';
const TOKEN_EXPIRY_SECONDS = 24 * 60 * 60; // 24 hours

export interface UserTokenPayload {
  userId: string;
  email: string;
  name: string;
  role: 'sender' | 'analyst' | 'admin';
  organization?: string;
  /** Unique token id, used for server-side revocation on logout. */
  jti?: string;
  iat?: number;
  exp?: number;
}

/**
 * Base64URL encode a buffer or string
 */
function base64UrlEncode(data: Buffer | string): string {
  const str = Buffer.isBuffer(data) ? data.toString('base64') : Buffer.from(data).toString('base64');
  return str.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

/**
 * Base64URL decode to string
 */
function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Generates an RFC 7519 compliant HS256 JWT
 */
export function signToken(payload: Omit<UserTokenPayload, 'iat' | 'exp' | 'jti'>, expiresInSeconds: number = TOKEN_EXPIRY_SECONDS): string {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: UserTokenPayload = {
    ...payload,
    jti: crypto.randomUUID(),
    iat: now,
    exp: now + expiresInSeconds,
  };

  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));

  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest();
  const encodedSignature = base64UrlEncode(signature);

  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

/**
 * Verifies and decodes an HS256 JWT. Returns null if invalid or expired.
 */
export function verifyToken(token: string): UserTokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, encodedSignature] = parts;

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest();
    const expectedEncodedSignature = base64UrlEncode(expectedSignature);

    if (encodedSignature.length !== expectedEncodedSignature.length) {
      return null;
    }

    const isValid = crypto.timingSafeEqual(
      Buffer.from(encodedSignature),
      Buffer.from(expectedEncodedSignature)
    );
    if (!isValid) return null;

    // Decode and verify expiration
    const payloadJson = base64UrlDecode(encodedPayload);
    const payload: UserTokenPayload = JSON.parse(payloadJson);

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Hashes a password using PBKDF2 with 100,000 iterations and sha512.
 */
export function hashPassword(password: string): { salt: string; hash: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

/**
 * Verifies a password against the stored salt and hash using timing-safe comparison.
 */
export function verifyPassword(password: string, salt: string, storedHash: string): boolean {
  try {
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    const hashBuf = Buffer.from(hash);
    const storedBuf = Buffer.from(storedHash);

    if (hashBuf.length !== storedBuf.length) return false;
    return crypto.timingSafeEqual(hashBuf, storedBuf);
  } catch {
    return false;
  }
}

