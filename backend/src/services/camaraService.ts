/**
 * CAMARA-Compliant Telecom Open Gateway Service for TrustRoute
 * -------------------------------------------------------------
 * Adheres strictly to the GSMA Open Gateway / Linux Foundation CAMARA specifications:
 * 1. CAMARA SIM Swap API (v0.3.0 / v0.4.0) — POST /sim-swap/v0/check
 * 2. CAMARA Number Verification API (v0.2.0 / v0.3.0) — POST /number-verification/v0/verify
 *
 * Supported Operating Modes:
 * - 'mock': Deterministic, audit-safe simulated responses (isSimulated: true)
 * - 'sandbox': Real authenticated HTTP calls to developer sandbox (e.g. Nokia NaC, Vodafone, Orange)
 * - 'live': Production network requests only with authenticated operator contracts
 *
 * Zero-Trust Guarantee:
 * - Network timeouts, authorization failures, rate limits, and unsupported identifiers
 *   are NEVER silently marked as safe or auto-approved.
 */

import crypto from 'crypto';

export type CamaraMode = 'mock' | 'sandbox' | 'live';

export interface CamaraConfig {
  mode: CamaraMode;
  baseUrl: string;
  authUrl?: string;
  clientId?: string;
  clientSecret?: string;
  scope?: string;
  apiKey?: string;
  timeoutMs: number;
}

export type CamaraStatus =
  | 'COMPLETED'
  | 'UNAVAILABLE'
  | 'TIMEOUT'
  | 'AUTH_ERROR'
  | 'RATE_LIMITED'
  | 'UNSUPPORTED_NUMBER'
  | 'ERROR';

export interface CamaraCheckResult {
  mode: CamaraMode;
  provider: string;
  status: CamaraStatus;
  swappedWithin24h: boolean;
  phoneNumberMasked: string;
  latencyMs: number;
  checkedAt: string;
  details: string;
  isSimulated: boolean;
  rawResponse?: unknown;
}

export interface CamaraNumberVerificationResult {
  mode: CamaraMode;
  provider: string;
  status: CamaraStatus;
  verified: boolean;
  phoneNumberMasked: string;
  latencyMs: number;
  checkedAt: string;
  details: string;
  isSimulated: boolean;
  rawResponse?: unknown;
}

export interface CamaraAuditEvent {
  id: string;
  timestamp: string;
  mode: CamaraMode;
  api: 'SIM_SWAP' | 'NUMBER_VERIFICATION';
  phoneNumberMasked: string;
  status: CamaraStatus;
  latencyMs: number;
  details: string;
  success: boolean;
}

export interface CamaraConnectivityDiagnostic {
  mode: CamaraMode;
  isSimulated: boolean;
  provider: string;
  baseUrl: string;
  authUrl: string;
  hasClientId: boolean;
  hasClientSecret: boolean;
  hasApiKey: boolean;
  configuredScope: string;
  connectivity: 'HEALTHY' | 'DEGRADED' | 'UNCONFIGURED' | 'ERROR';
  status?: string;
  checkedAt?: string;
  message: string;
  latencyMs?: number;
  recentFailuresCount: number;
  recentEvents: CamaraAuditEvent[];
}

// In-memory token cache for OAuth2 Client Credentials
let cachedToken: {
  accessToken: string;
  expiresAt: number;
} | null = null;

// In-memory bounded audit log of recent CAMARA checks for Admin / Analyst telemetry
const MAX_AUDIT_EVENTS = 30;
const recentAuditEvents: CamaraAuditEvent[] = [];

function recordAuditEvent(event: Omit<CamaraAuditEvent, 'id'>): void {
  const record: CamaraAuditEvent = {
    ...event,
    id: `CAMARA-EVT-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
  };
  recentAuditEvents.unshift(record);
  if (recentAuditEvents.length > MAX_AUDIT_EVENTS) {
    recentAuditEvents.pop();
  }
}

/**
 * Returns recent telecom verification events for admin / analyst inspection.
 */
export function getCamaraRecentEvents(): CamaraAuditEvent[] {
  return [...recentAuditEvents];
}

/**
 * Reads CAMARA configuration from environment variables.
 */
export function getCamaraConfig(): CamaraConfig {
  const rawMode = (process.env.CAMARA_MODE || 'mock').trim().toLowerCase();
  const mode: CamaraMode =
    rawMode === 'live' || rawMode === 'production'
      ? 'live'
      : rawMode === 'sandbox'
      ? 'sandbox'
      : 'mock';

  return {
    mode,
    baseUrl: process.env.CAMARA_BASE_URL || 'https://api.sandbox.telecom-provider.com',
    authUrl:
      process.env.CAMARA_AUTH_URL ||
      (process.env.CAMARA_BASE_URL ? `${process.env.CAMARA_BASE_URL}/oauth2/v1/token` : ''),
    clientId: process.env.CAMARA_CLIENT_ID || '',
    clientSecret: process.env.CAMARA_CLIENT_SECRET || '',
    scope: process.env.CAMARA_SCOPE || 'sim-swap:check number-verification:verify',
    apiKey: process.env.CAMARA_API_KEY || '',
    timeoutMs: Math.max(1000, parseInt(process.env.CAMARA_TIMEOUT_MS || '5000', 10)),
  };
}

/**
 * Masks E.164 phone numbers for privacy-preserving audit logging and frontend rendering.
 * e.g. "+14159876543" -> "+1415•••6543"
 */
export function maskPhoneNumber(phone?: string): string {
  if (!phone || phone.trim().length === 0) return '+1415•••0142';
  const clean = phone.trim();
  if (clean.length <= 6) return '••••••';
  const prefix = clean.slice(0, 5);
  const suffix = clean.slice(-4);
  return `${prefix}•••${suffix}`;
}

/**
 * Obtains an OAuth 2.0 Bearer access token via Client Credentials grant.
 */
export async function getCamaraAccessToken(config: CamaraConfig): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 30000) {
    return cachedToken.accessToken;
  }

  if (!config.clientId || !config.clientSecret) {
    throw new Error('CAMARA OAuth2 credentials missing: CAMARA_CLIENT_ID and CAMARA_CLIENT_SECRET are required.');
  }

  const authUrl = config.authUrl || `${config.baseUrl}/oauth2/v1/token`;
  const bodyParams = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: config.scope || 'sim-swap:check number-verification:verify',
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
  };

  if (config.apiKey) {
    headers['x-api-key'] = config.apiKey;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const res = await fetch(authUrl, {
      method: 'POST',
      headers,
      body: bodyParams.toString(),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`CAMARA Auth failed (${res.status} ${res.statusText}): ${errText}`);
    }

    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) {
      throw new Error('CAMARA Auth response missing access_token.');
    }

    const expiresIn = Number(data.expires_in) || 3600;
    cachedToken = {
      accessToken: data.access_token,
      expiresAt: now + expiresIn * 1000,
    };

    return cachedToken.accessToken;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Clears cached token (used during auth error recovery or unit testing).
 */
export function clearCachedCamaraToken(): void {
  cachedToken = null;
}

/**
 * Resolves standard provider label based on mode.
 */
function getProviderLabel(mode: CamaraMode): string {
  if (mode === 'mock') return 'TrustRoute CAMARA Gateway Simulator (Mock Mode)';
  if (mode === 'sandbox') return 'CAMARA Open Gateway (Developer Sandbox)';
  return 'CAMARA Open Gateway (Production Mobile Network)';
}

/**
 * Executes a CAMARA SIM Swap check (POST /sim-swap/v0/check).
 */
export async function checkSimSwap(params: {
  phoneNumber?: string;
  senderEmail?: string;
  recipientName?: string;
  maxAgeHours?: number;
  configOverride?: Partial<CamaraConfig>;
}): Promise<CamaraCheckResult> {
  const startTime = Date.now();
  const baseConfig = getCamaraConfig();
  const config: CamaraConfig = { ...baseConfig, ...(params.configOverride || {}) };

  const phone = params.phoneNumber || '+14155550142';
  const maskedPhone = maskPhoneNumber(phone);
  const maxAge = params.maxAgeHours || 24;
  const providerLabel = getProviderLabel(config.mode);

  // 1. MOCK OPERATING MODE
  if (config.mode === 'mock') {
    const emailLower = (params.senderEmail || '').toLowerCase();
    const recipientLower = (params.recipientName || '').toLowerCase();
    const phoneLower = (params.phoneNumber || '').toLowerCase();

    // Deterministic demo triggers
    const isSimSwapDetected =
      emailLower.includes('simswap') ||
      emailLower.includes('hacked') ||
      recipientLower.includes('compromised-sim') ||
      recipientLower.includes('sim-swap') ||
      phoneLower.includes('9999') ||
      phoneLower.includes('swap');

    // Simulate unsupported number if designated
    if (phoneLower.includes('unsupported') || phoneLower.includes('0000')) {
      const res: CamaraCheckResult = {
        mode: 'mock',
        isSimulated: true,
        provider: providerLabel,
        status: 'UNSUPPORTED_NUMBER',
        swappedWithin24h: false,
        phoneNumberMasked: maskedPhone,
        latencyMs: Date.now() - startTime + 15,
        checkedAt: new Date().toISOString(),
        details: 'Phone number format unsupported by simulated carrier network.',
      };
      recordAuditEvent({
        timestamp: res.checkedAt,
        mode: 'mock',
        api: 'SIM_SWAP',
        phoneNumberMasked: maskedPhone,
        status: 'UNSUPPORTED_NUMBER',
        latencyMs: res.latencyMs,
        details: res.details,
        success: false,
      });
      return res;
    }

    const res: CamaraCheckResult = {
      mode: 'mock',
      isSimulated: true,
      provider: providerLabel,
      status: 'COMPLETED',
      swappedWithin24h: isSimSwapDetected,
      phoneNumberMasked: maskedPhone,
      latencyMs: Date.now() - startTime + 22,
      checkedAt: new Date().toISOString(),
      details: isSimSwapDetected
        ? 'Simulated CAMARA check: SIM swap detected within previous 24h window.'
        : 'Simulated CAMARA check: Clean SIM status confirmed with carrier.',
      rawResponse: {
        swapped: isSimSwapDetected,
      },
    };

    recordAuditEvent({
      timestamp: res.checkedAt,
      mode: 'mock',
      api: 'SIM_SWAP',
      phoneNumberMasked: maskedPhone,
      status: 'COMPLETED',
      latencyMs: res.latencyMs,
      details: res.details,
      success: !isSimSwapDetected,
    });

    return res;
  }

  // 2. REAL HTTP REQUEST (SANDBOX OR LIVE)
  let accessToken: string;
  try {
    accessToken = await getCamaraAccessToken(config);
  } catch (authErr: unknown) {
    const latencyMs = Date.now() - startTime;
    const msg = authErr instanceof Error ? authErr.message : String(authErr);
    const res: CamaraCheckResult = {
      mode: config.mode,
      isSimulated: false,
      provider: providerLabel,
      status: 'AUTH_ERROR',
      swappedWithin24h: false,
      phoneNumberMasked: maskedPhone,
      latencyMs,
      checkedAt: new Date().toISOString(),
      details: `Carrier authentication failed: ${msg}. Zero-Trust policy: Withholding approval.`,
    };
    recordAuditEvent({
      timestamp: res.checkedAt,
      mode: config.mode,
      api: 'SIM_SWAP',
      phoneNumberMasked: maskedPhone,
      status: 'AUTH_ERROR',
      latencyMs,
      details: res.details,
      success: false,
    });
    return res;
  }

  const endpointUrl = `${config.baseUrl.replace(/\/+$/, '')}/sim-swap/v0/check`;
  const correlatorId = crypto.randomUUID();

  const requestHeaders: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'x-correlator': correlatorId,
  };

  if (config.apiKey) {
    requestHeaders['x-api-key'] = config.apiKey;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const res = await fetch(endpointUrl, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify({
        phoneNumber: phone,
        maxAge,
      }),
      signal: controller.signal,
    });

    const latencyMs = Date.now() - startTime;

    if (res.status === 200) {
      const data = (await res.json().catch(() => null)) as { swapped?: boolean } | null;

      if (!data || typeof data.swapped !== 'boolean') {
        const errResult: CamaraCheckResult = {
          mode: config.mode,
          isSimulated: false,
          provider: providerLabel,
          status: 'ERROR',
          swappedWithin24h: false,
          phoneNumberMasked: maskedPhone,
          latencyMs,
          checkedAt: new Date().toISOString(),
          details: 'Malformed CAMARA response: Missing or non-boolean "swapped" property.',
          rawResponse: data,
        };
        recordAuditEvent({
          timestamp: errResult.checkedAt,
          mode: config.mode,
          api: 'SIM_SWAP',
          phoneNumberMasked: maskedPhone,
          status: 'ERROR',
          latencyMs,
          details: errResult.details,
          success: false,
        });
        return errResult;
      }

      const checkResult: CamaraCheckResult = {
        mode: config.mode,
        isSimulated: false,
        provider: providerLabel,
        status: 'COMPLETED',
        swappedWithin24h: Boolean(data.swapped),
        phoneNumberMasked: maskedPhone,
        latencyMs,
        checkedAt: new Date().toISOString(),
        details: data.swapped
          ? `SIM swap detected within the last ${maxAge} hours by operator.`
          : `Confirmed absence of recent SIM swap within the last ${maxAge} hours.`,
        rawResponse: data,
      };

      recordAuditEvent({
        timestamp: checkResult.checkedAt,
        mode: config.mode,
        api: 'SIM_SWAP',
        phoneNumberMasked: maskedPhone,
        status: 'COMPLETED',
        latencyMs,
        details: checkResult.details,
        success: !data.swapped,
      });

      return checkResult;
    }

    if (res.status === 400 || res.status === 404) {
      const errBody = await res.json().catch(() => ({}));
      const checkResult: CamaraCheckResult = {
        mode: config.mode,
        isSimulated: false,
        provider: providerLabel,
        status: 'UNSUPPORTED_NUMBER',
        swappedWithin24h: false,
        phoneNumberMasked: maskedPhone,
        latencyMs,
        checkedAt: new Date().toISOString(),
        details: `Carrier rejected mobile identifier (${res.status}): ${JSON.stringify(errBody)}`,
        rawResponse: errBody,
      };
      recordAuditEvent({
        timestamp: checkResult.checkedAt,
        mode: config.mode,
        api: 'SIM_SWAP',
        phoneNumberMasked: maskedPhone,
        status: 'UNSUPPORTED_NUMBER',
        latencyMs,
        details: checkResult.details,
        success: false,
      });
      return checkResult;
    }

    if (res.status === 401 || res.status === 403) {
      clearCachedCamaraToken();
      const checkResult: CamaraCheckResult = {
        mode: config.mode,
        isSimulated: false,
        provider: providerLabel,
        status: 'AUTH_ERROR',
        swappedWithin24h: false,
        phoneNumberMasked: maskedPhone,
        latencyMs,
        checkedAt: new Date().toISOString(),
        details: `Authorization rejected by operator (${res.status}). Token cleared.`,
      };
      recordAuditEvent({
        timestamp: checkResult.checkedAt,
        mode: config.mode,
        api: 'SIM_SWAP',
        phoneNumberMasked: maskedPhone,
        status: 'AUTH_ERROR',
        latencyMs,
        details: checkResult.details,
        success: false,
      });
      return checkResult;
    }

    if (res.status === 429) {
      const retryAfter = res.headers.get('Retry-After');
      const checkResult: CamaraCheckResult = {
        mode: config.mode,
        isSimulated: false,
        provider: providerLabel,
        status: 'RATE_LIMITED',
        swappedWithin24h: false,
        phoneNumberMasked: maskedPhone,
        latencyMs,
        checkedAt: new Date().toISOString(),
        details: `Operator rate limit exceeded (HTTP 429). Retry-After: ${retryAfter || 'default backoff'}.`,
      };
      recordAuditEvent({
        timestamp: checkResult.checkedAt,
        mode: config.mode,
        api: 'SIM_SWAP',
        phoneNumberMasked: maskedPhone,
        status: 'RATE_LIMITED',
        latencyMs,
        details: checkResult.details,
        success: false,
      });
      return checkResult;
    }

    // 500, 502, 503, 504 Gateway errors
    const errText = await res.text().catch(() => '');
    const checkResult: CamaraCheckResult = {
      mode: config.mode,
      isSimulated: false,
      provider: providerLabel,
      status: 'UNAVAILABLE',
      swappedWithin24h: false,
      phoneNumberMasked: maskedPhone,
      latencyMs,
      checkedAt: new Date().toISOString(),
      details: `Operator gateway error (${res.status}): ${errText.slice(0, 200)}`,
    };
    recordAuditEvent({
      timestamp: checkResult.checkedAt,
      mode: config.mode,
      api: 'SIM_SWAP',
      phoneNumberMasked: maskedPhone,
      status: 'UNAVAILABLE',
      latencyMs,
      details: checkResult.details,
      success: false,
    });
    return checkResult;
  } catch (fetchErr: unknown) {
    const latencyMs = Date.now() - startTime;
    if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
      const checkResult: CamaraCheckResult = {
        mode: config.mode,
        isSimulated: false,
        provider: providerLabel,
        status: 'TIMEOUT',
        swappedWithin24h: false,
        phoneNumberMasked: maskedPhone,
        latencyMs,
        checkedAt: new Date().toISOString(),
        details: `CAMARA API call timed out after ${config.timeoutMs}ms.`,
      };
      recordAuditEvent({
        timestamp: checkResult.checkedAt,
        mode: config.mode,
        api: 'SIM_SWAP',
        phoneNumberMasked: maskedPhone,
        status: 'TIMEOUT',
        latencyMs,
        details: checkResult.details,
        success: false,
      });
      return checkResult;
    }

    const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
    const checkResult: CamaraCheckResult = {
      mode: config.mode,
      isSimulated: false,
      provider: providerLabel,
      status: 'UNAVAILABLE',
      swappedWithin24h: false,
      phoneNumberMasked: maskedPhone,
      latencyMs,
      checkedAt: new Date().toISOString(),
      details: `Network communication failure with telecom gateway: ${msg}`,
    };
    recordAuditEvent({
      timestamp: checkResult.checkedAt,
      mode: config.mode,
      api: 'SIM_SWAP',
      phoneNumberMasked: maskedPhone,
      status: 'UNAVAILABLE',
      latencyMs,
      details: checkResult.details,
      success: false,
    });
    return checkResult;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Executes a CAMARA Number Verification check (POST /number-verification/v0/verify).
 * Adheres to GSMA Open Gateway / Linux Foundation CAMARA Number Verification API specification.
 */
export async function checkNumberVerification(params: {
  phoneNumber?: string;
  senderEmail?: string;
  recipientName?: string;
  configOverride?: Partial<CamaraConfig>;
}): Promise<CamaraNumberVerificationResult> {
  const startTime = Date.now();
  const baseConfig = getCamaraConfig();
  const config: CamaraConfig = { ...baseConfig, ...(params.configOverride || {}) };

  const phone = params.phoneNumber || '+14155550142';
  const maskedPhone = maskPhoneNumber(phone);
  const providerLabel = getProviderLabel(config.mode);

  // 1. MOCK OPERATING MODE
  if (config.mode === 'mock') {
    const emailLower = (params.senderEmail || '').toLowerCase();
    const recipientLower = (params.recipientName || '').toLowerCase();
    const phoneLower = (params.phoneNumber || '').toLowerCase();

    // Deterministic demo triggers for number verification
    const isMismatchOrUnverified =
      emailLower.includes('unverified') ||
      emailLower.includes('mismatch') ||
      recipientLower.includes('unverified') ||
      phoneLower.includes('unverified') ||
      phoneLower.includes('8888');

    // Simulate unsupported number if designated
    if (phoneLower.includes('unsupported') || phoneLower.includes('0000')) {
      const res: CamaraNumberVerificationResult = {
        mode: 'mock',
        isSimulated: true,
        provider: providerLabel,
        status: 'UNSUPPORTED_NUMBER',
        verified: false,
        phoneNumberMasked: maskedPhone,
        latencyMs: Date.now() - startTime + 12,
        checkedAt: new Date().toISOString(),
        details: 'Phone number format unsupported for carrier identity verification.',
      };
      recordAuditEvent({
        timestamp: res.checkedAt,
        mode: 'mock',
        api: 'NUMBER_VERIFICATION',
        phoneNumberMasked: maskedPhone,
        status: 'UNSUPPORTED_NUMBER',
        latencyMs: res.latencyMs,
        details: res.details,
        success: false,
      });
      return res;
    }

    const res: CamaraNumberVerificationResult = {
      mode: 'mock',
      isSimulated: true,
      provider: providerLabel,
      status: 'COMPLETED',
      verified: !isMismatchOrUnverified,
      phoneNumberMasked: maskedPhone,
      latencyMs: Date.now() - startTime + 18,
      checkedAt: new Date().toISOString(),
      details: isMismatchOrUnverified
        ? 'Simulated carrier check: Number verification mismatch between account holder and SIM.'
        : 'Simulated carrier check: MSISDN identity match successfully verified by carrier.',
      rawResponse: {
        devicePhoneNumberMatches: !isMismatchOrUnverified,
      },
    };

    recordAuditEvent({
      timestamp: res.checkedAt,
      mode: 'mock',
      api: 'NUMBER_VERIFICATION',
      phoneNumberMasked: maskedPhone,
      status: 'COMPLETED',
      latencyMs: res.latencyMs,
      details: res.details,
      success: !isMismatchOrUnverified,
    });

    return res;
  }

  // 2. REAL HTTP REQUEST (SANDBOX OR LIVE)
  let accessToken: string;
  try {
    accessToken = await getCamaraAccessToken(config);
  } catch (authErr: unknown) {
    const latencyMs = Date.now() - startTime;
    const msg = authErr instanceof Error ? authErr.message : String(authErr);
    const res: CamaraNumberVerificationResult = {
      mode: config.mode,
      isSimulated: false,
      provider: providerLabel,
      status: 'AUTH_ERROR',
      verified: false,
      phoneNumberMasked: maskedPhone,
      latencyMs,
      checkedAt: new Date().toISOString(),
      details: `Carrier authentication failed for Number Verification: ${msg}.`,
    };
    recordAuditEvent({
      timestamp: res.checkedAt,
      mode: config.mode,
      api: 'NUMBER_VERIFICATION',
      phoneNumberMasked: maskedPhone,
      status: 'AUTH_ERROR',
      latencyMs,
      details: res.details,
      success: false,
    });
    return res;
  }

  const endpointUrl = `${config.baseUrl.replace(/\/+$/, '')}/number-verification/v0/verify`;
  const correlatorId = crypto.randomUUID();

  const requestHeaders: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'x-correlator': correlatorId,
  };

  if (config.apiKey) {
    requestHeaders['x-api-key'] = config.apiKey;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const res = await fetch(endpointUrl, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify({
        phoneNumber: phone,
      }),
      signal: controller.signal,
    });

    const latencyMs = Date.now() - startTime;

    if (res.status === 200) {
      const data = (await res.json().catch(() => null)) as { devicePhoneNumberMatches?: boolean } | null;

      if (!data || typeof data.devicePhoneNumberMatches !== 'boolean') {
        const errResult: CamaraNumberVerificationResult = {
          mode: config.mode,
          isSimulated: false,
          provider: providerLabel,
          status: 'ERROR',
          verified: false,
          phoneNumberMasked: maskedPhone,
          latencyMs,
          checkedAt: new Date().toISOString(),
          details: 'Malformed response: Missing or non-boolean "devicePhoneNumberMatches" property.',
          rawResponse: data,
        };
        recordAuditEvent({
          timestamp: errResult.checkedAt,
          mode: config.mode,
          api: 'NUMBER_VERIFICATION',
          phoneNumberMasked: maskedPhone,
          status: 'ERROR',
          latencyMs,
          details: errResult.details,
          success: false,
        });
        return errResult;
      }

      const match = Boolean(data.devicePhoneNumberMatches);
      const verifyResult: CamaraNumberVerificationResult = {
        mode: config.mode,
        isSimulated: false,
        provider: providerLabel,
        status: 'COMPLETED',
        verified: match,
        phoneNumberMasked: maskedPhone,
        latencyMs,
        checkedAt: new Date().toISOString(),
        details: match
          ? 'Carrier confirmed: Device MSISDN matches registered corporate sender identity.'
          : 'Carrier mismatch: Device MSISDN does not match registered corporate sender identity.',
        rawResponse: data,
      };

      recordAuditEvent({
        timestamp: verifyResult.checkedAt,
        mode: config.mode,
        api: 'NUMBER_VERIFICATION',
        phoneNumberMasked: maskedPhone,
        status: 'COMPLETED',
        latencyMs,
        details: verifyResult.details,
        success: match,
      });

      return verifyResult;
    }

    if (res.status === 400 || res.status === 404) {
      const errBody = await res.json().catch(() => ({}));
      const verifyResult: CamaraNumberVerificationResult = {
        mode: config.mode,
        isSimulated: false,
        provider: providerLabel,
        status: 'UNSUPPORTED_NUMBER',
        verified: false,
        phoneNumberMasked: maskedPhone,
        latencyMs,
        checkedAt: new Date().toISOString(),
        details: `Carrier rejected mobile identifier (${res.status}): ${JSON.stringify(errBody)}`,
        rawResponse: errBody,
      };
      recordAuditEvent({
        timestamp: verifyResult.checkedAt,
        mode: config.mode,
        api: 'NUMBER_VERIFICATION',
        phoneNumberMasked: maskedPhone,
        status: 'UNSUPPORTED_NUMBER',
        latencyMs,
        details: verifyResult.details,
        success: false,
      });
      return verifyResult;
    }

    if (res.status === 401 || res.status === 403) {
      clearCachedCamaraToken();
      const verifyResult: CamaraNumberVerificationResult = {
        mode: config.mode,
        isSimulated: false,
        provider: providerLabel,
        status: 'AUTH_ERROR',
        verified: false,
        phoneNumberMasked: maskedPhone,
        latencyMs,
        checkedAt: new Date().toISOString(),
        details: `Authorization rejected for Number Verification (${res.status}). Token cleared.`,
      };
      recordAuditEvent({
        timestamp: verifyResult.checkedAt,
        mode: config.mode,
        api: 'NUMBER_VERIFICATION',
        phoneNumberMasked: maskedPhone,
        status: 'AUTH_ERROR',
        latencyMs,
        details: verifyResult.details,
        success: false,
      });
      return verifyResult;
    }

    if (res.status === 429) {
      const retryAfter = res.headers.get('Retry-After');
      const verifyResult: CamaraNumberVerificationResult = {
        mode: config.mode,
        isSimulated: false,
        provider: providerLabel,
        status: 'RATE_LIMITED',
        verified: false,
        phoneNumberMasked: maskedPhone,
        latencyMs,
        checkedAt: new Date().toISOString(),
        details: `Carrier rate limit exceeded for Number Verification (HTTP 429). Retry-After: ${retryAfter || 'default backoff'}.`,
      };
      recordAuditEvent({
        timestamp: verifyResult.checkedAt,
        mode: config.mode,
        api: 'NUMBER_VERIFICATION',
        phoneNumberMasked: maskedPhone,
        status: 'RATE_LIMITED',
        latencyMs,
        details: verifyResult.details,
        success: false,
      });
      return verifyResult;
    }

    const errText = await res.text().catch(() => '');
    const verifyResult: CamaraNumberVerificationResult = {
      mode: config.mode,
      isSimulated: false,
      provider: providerLabel,
      status: 'UNAVAILABLE',
      verified: false,
      phoneNumberMasked: maskedPhone,
      latencyMs,
      checkedAt: new Date().toISOString(),
      details: `Operator gateway error during Number Verification (${res.status}): ${errText.slice(0, 200)}`,
    };
    recordAuditEvent({
      timestamp: verifyResult.checkedAt,
      mode: config.mode,
      api: 'NUMBER_VERIFICATION',
      phoneNumberMasked: maskedPhone,
      status: 'UNAVAILABLE',
      latencyMs,
      details: verifyResult.details,
      success: false,
    });
    return verifyResult;
  } catch (fetchErr: unknown) {
    const latencyMs = Date.now() - startTime;
    if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
      const verifyResult: CamaraNumberVerificationResult = {
        mode: config.mode,
        isSimulated: false,
        provider: providerLabel,
        status: 'TIMEOUT',
        verified: false,
        phoneNumberMasked: maskedPhone,
        latencyMs,
        checkedAt: new Date().toISOString(),
        details: `CAMARA Number Verification timed out after ${config.timeoutMs}ms.`,
      };
      recordAuditEvent({
        timestamp: verifyResult.checkedAt,
        mode: config.mode,
        api: 'NUMBER_VERIFICATION',
        phoneNumberMasked: maskedPhone,
        status: 'TIMEOUT',
        latencyMs,
        details: verifyResult.details,
        success: false,
      });
      return verifyResult;
    }

    const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
    const verifyResult: CamaraNumberVerificationResult = {
      mode: config.mode,
      isSimulated: false,
      provider: providerLabel,
      status: 'UNAVAILABLE',
      verified: false,
      phoneNumberMasked: maskedPhone,
      latencyMs,
      checkedAt: new Date().toISOString(),
      details: `Network communication failure with telecom gateway: ${msg}`,
    };
    recordAuditEvent({
      timestamp: verifyResult.checkedAt,
      mode: config.mode,
      api: 'NUMBER_VERIFICATION',
      phoneNumberMasked: maskedPhone,
      status: 'UNAVAILABLE',
      latencyMs,
      details: verifyResult.details,
      success: false,
    });
    return verifyResult;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Diagnostic tool to check CAMARA telecom gateway connectivity without exposing secrets.
 */
export async function checkCamaraConnectivity(): Promise<CamaraConnectivityDiagnostic> {
  const config = getCamaraConfig();
  const startTime = Date.now();

  const hasClientId = Boolean(config.clientId && config.clientId.trim().length > 0);
  const hasClientSecret = Boolean(config.clientSecret && config.clientSecret.trim().length > 0);
  const hasApiKey = Boolean(config.apiKey && config.apiKey.trim().length > 0);
  const providerLabel = getProviderLabel(config.mode);

  const recentFailures = recentAuditEvents.filter((e) => !e.success).length;

  if (config.mode === 'mock') {
    return {
      mode: 'mock',
      isSimulated: true,
      provider: providerLabel,
      baseUrl: config.baseUrl,
      authUrl: config.authUrl || `${config.baseUrl}/oauth2/v1/token`,
      hasClientId,
      hasClientSecret,
      hasApiKey,
      configuredScope: config.scope || 'sim-swap:check number-verification:verify',
      connectivity: 'HEALTHY',
      status: 'HEALTHY',
      checkedAt: new Date().toISOString(),
      message: 'Running in MOCK mode. Telecom signals are deterministically simulated for academic demonstration.',
      latencyMs: Date.now() - startTime + 5,
      recentFailuresCount: recentFailures,
      recentEvents: recentAuditEvents.slice(0, 10),
    };
  }

  // Sandbox or Live mode check
  if (!hasClientId || !hasClientSecret) {
    return {
      mode: config.mode,
      isSimulated: false,
      provider: providerLabel,
      baseUrl: config.baseUrl,
      authUrl: config.authUrl || `${config.baseUrl}/oauth2/v1/token`,
      hasClientId,
      hasClientSecret,
      hasApiKey,
      configuredScope: config.scope || 'sim-swap:check number-verification:verify',
      connectivity: 'UNCONFIGURED',
      status: 'UNCONFIGURED',
      checkedAt: new Date().toISOString(),
      message: `Running in ${config.mode.toUpperCase()} mode, but CAMARA_CLIENT_ID or CAMARA_CLIENT_SECRET is missing.`,
      recentFailuresCount: recentFailures,
      recentEvents: recentAuditEvents.slice(0, 10),
    };
  }

  try {
    await getCamaraAccessToken(config);
    return {
      mode: config.mode,
      isSimulated: false,
      provider: providerLabel,
      baseUrl: config.baseUrl,
      authUrl: config.authUrl || `${config.baseUrl}/oauth2/v1/token`,
      hasClientId,
      hasClientSecret,
      hasApiKey,
      configuredScope: config.scope || 'sim-swap:check number-verification:verify',
      connectivity: 'HEALTHY',
      status: 'HEALTHY',
      checkedAt: new Date().toISOString(),
      message: `Successfully authenticated with ${config.mode.toUpperCase()} provider OAuth 2.0 server.`,
      latencyMs: Date.now() - startTime,
      recentFailuresCount: recentFailures,
      recentEvents: recentAuditEvents.slice(0, 10),
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      mode: config.mode,
      isSimulated: false,
      provider: providerLabel,
      baseUrl: config.baseUrl,
      authUrl: config.authUrl || `${config.baseUrl}/oauth2/v1/token`,
      hasClientId,
      hasClientSecret,
      hasApiKey,
      configuredScope: config.scope || 'sim-swap:check number-verification:verify',
      connectivity: 'DEGRADED',
      status: 'DEGRADED',
      checkedAt: new Date().toISOString(),
      message: `Failed to authenticate with ${config.mode.toUpperCase()} server: ${msg}`,
      latencyMs: Date.now() - startTime,
      recentFailuresCount: recentFailures,
      recentEvents: recentAuditEvents.slice(0, 10),
    };
  }
}
