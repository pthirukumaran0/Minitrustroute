import {
  checkSimSwap,
  checkNumberVerification,
  maskPhoneNumber,
  checkCamaraConnectivity,
  getCamaraAccessToken,
  clearCachedCamaraToken,
} from '../src/services/camaraService';
import { calculateRiskDecision } from '../src/lib/riskEngine';
import { evaluateTelecomSignals } from '../src/lib/camaraMock';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: string;
}

const results: TestResult[] = [];

async function runTest(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`✅ PASS: ${name}`);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    results.push({ name, passed: false, error: errorMsg });
    console.error(`❌ FAIL: ${name} -> ${errorMsg}`);
  }
}

async function main() {
  console.log('================================================================');
  console.log('🧪 TrustRoute Comprehensive CAMARA Open Gateway Test Suite');
  console.log('================================================================\n');

  // Test 1: Phone number masking utility
  await runTest('Phone number masking utility conceals middle digits (E.164)', async () => {
    const masked1 = maskPhoneNumber('+14155552671');
    const masked2 = maskPhoneNumber('+447911123456');
    const masked3 = maskPhoneNumber('+919876543210');

    if (masked1.includes('555') || !masked1.endsWith('2671')) {
      throw new Error(`Masking failed for +14155552671: got ${masked1}`);
    }
    if (masked2.includes('1112') || !masked2.endsWith('3456')) {
      throw new Error(`Masking failed for +447911123456: got ${masked2}`);
    }
    if (masked3.includes('7654') || !masked3.endsWith('3210')) {
      throw new Error(`Masking failed for +919876543210: got ${masked3}`);
    }
  });

  // Test 2: Recent SIM swap detected (swapped: true) -> Mandatory BLOCKED verdict
  await runTest('Recent SIM swap detected triggers mandatory BLOCKED risk decision', async () => {
    const checkResult = await checkSimSwap({
      phoneNumber: '+14155559999',
      senderEmail: 'test-simswap@trustroute.com',
    });

    if (!checkResult.swappedWithin24h) {
      throw new Error(`Expected swappedWithin24h === true, got ${checkResult.swappedWithin24h}`);
    }
    if (checkResult.status !== 'COMPLETED') {
      throw new Error(`Expected status === COMPLETED, got ${checkResult.status}`);
    }

    const decision = calculateRiskDecision({
      amount: 1500,
      currency: 'USD',
      sourceCountry: 'USA',
      destinationCountry: 'GBR',
      signals: {
        simSwap24h: checkResult.swappedWithin24h,
        numberVerified: true,
        deviceStatus: 'TRUSTED',
        simSwapVerificationStatus: checkResult.status,
      },
    });

    if (decision.riskDecision !== 'BLOCKED') {
      throw new Error(`Expected BLOCKED decision, got ${decision.riskDecision}`);
    }
    if (decision.riskScore < 70) {
      throw new Error(`Expected riskScore >= 70, got ${decision.riskScore}`);
    }
    if (!decision.contributingFactors.some((f) => f.includes('SIM swap detected within previous 24h'))) {
      throw new Error('Missing SIM swap contributing factor in risk decision');
    }
  });

  // Test 3: Clean SIM swap (swapped: false) -> Evaluated alongside signals -> APPROVED
  await runTest('Clean SIM swap (no recent swap) allows APPROVED decision for safe transaction', async () => {
    const checkResult = await checkSimSwap({
      phoneNumber: '+14155550142',
      senderEmail: 'clean-sender@trustroute.com',
    });

    if (checkResult.swappedWithin24h !== false) {
      throw new Error(`Expected swappedWithin24h === false, got ${checkResult.swappedWithin24h}`);
    }
    if (checkResult.status !== 'COMPLETED') {
      throw new Error(`Expected status === COMPLETED, got ${checkResult.status}`);
    }

    const decision = calculateRiskDecision({
      amount: 1500,
      currency: 'USD',
      sourceCountry: 'USA',
      destinationCountry: 'GBR',
      signals: {
        simSwap24h: checkResult.swappedWithin24h,
        numberVerified: true,
        deviceStatus: 'TRUSTED',
        simSwapVerificationStatus: checkResult.status,
      },
    });

    if (decision.riskDecision !== 'APPROVED') {
      throw new Error(`Expected APPROVED decision, got ${decision.riskDecision}`);
    }
    if (decision.riskScore >= 35) {
      throw new Error(`Expected riskScore < 35, got ${decision.riskScore}`);
    }
  });

  // Test 4: CAMARA Number Verification API - Match Confirmed
  await runTest('Number Verification confirms device MSISDN match (positive verification)', async () => {
    const verifyResult = await checkNumberVerification({
      phoneNumber: '+14155550142',
      senderEmail: 'treasury@trustroute.com',
    });

    if (!verifyResult.verified) {
      throw new Error(`Expected verified === true, got ${verifyResult.verified}`);
    }
    if (verifyResult.status !== 'COMPLETED') {
      throw new Error(`Expected status === COMPLETED, got ${verifyResult.status}`);
    }
  });

  // Test 5: CAMARA Number Verification API - Mismatch / Unverified
  await runTest('Number Verification detects MSISDN mismatch and increases risk', async () => {
    const verifyResult = await checkNumberVerification({
      phoneNumber: '+14155558888',
      senderEmail: 'unverified-contractor@trustroute.com',
    });

    if (verifyResult.verified !== false) {
      throw new Error(`Expected verified === false, got ${verifyResult.verified}`);
    }

    const decision = calculateRiskDecision({
      amount: 1500,
      currency: 'USD',
      sourceCountry: 'USA',
      destinationCountry: 'GBR',
      signals: {
        simSwap24h: false,
        numberVerified: verifyResult.verified,
        deviceStatus: 'TRUSTED',
        numberVerificationStatus: verifyResult.status,
      },
    });

    if (decision.riskScore < 35) {
      throw new Error(`Expected riskScore >= 35 for unverified number, got ${decision.riskScore}`);
    }
    if (decision.riskDecision !== 'STEP_UP') {
      throw new Error(`Expected STEP_UP decision for unverified number, got ${decision.riskDecision}`);
    }
  });

  // Test 6: Missing Credentials Handling
  await runTest('Missing OAuth2 credentials throws explicit informative error without pretending connectivity', async () => {
    try {
      await getCamaraAccessToken({
        mode: 'sandbox',
        baseUrl: 'https://api.sandbox.telecom.com',
        clientId: '',
        clientSecret: '',
        timeoutMs: 5000,
      });
      throw new Error('Expected getCamaraAccessToken to throw on empty credentials');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('CAMARA OAuth2 credentials missing')) {
        throw new Error(`Expected informative error, got: ${msg}`);
      }
    }
  });

  // Test 7: Carrier Authentication Failure (401/403) -> Zero-Trust STEP_UP
  await runTest('Carrier Authentication Failure (AUTH_ERROR) triggers Zero-Trust STEP_UP', async () => {
    clearCachedCamaraToken();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return new Response(JSON.stringify({ error: 'invalid_client', error_description: 'Bad credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    try {
      const checkResult = await checkSimSwap({
        phoneNumber: '+14155550142',
        configOverride: {
          mode: 'sandbox',
          baseUrl: 'https://api.sandbox.telecom.com',
          clientId: 'dummy-id',
          clientSecret: 'bad-secret',
        },
      });

      if (checkResult.status !== 'AUTH_ERROR') {
        throw new Error(`Expected status === AUTH_ERROR, got ${checkResult.status}`);
      }

      const decision = calculateRiskDecision({
        amount: 1500,
        currency: 'USD',
        sourceCountry: 'USA',
        destinationCountry: 'GBR',
        signals: {
          simSwap24h: checkResult.swappedWithin24h,
          numberVerified: true,
          deviceStatus: 'TRUSTED',
          simSwapVerificationStatus: checkResult.status,
        },
      });

      if (decision.riskDecision !== 'STEP_UP') {
        throw new Error(`Expected STEP_UP decision on AUTH_ERROR, got ${decision.riskDecision}`);
      }
      if (decision.riskScore < 35) {
        throw new Error(`Expected riskScore >= 35 on AUTH_ERROR, got ${decision.riskScore}`);
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  // Test 8: Carrier Rate Limit Exceeded (HTTP 429) -> Handled Safely with Zero-Trust STEP_UP
  await runTest('Carrier Rate Limit (HTTP 429) is handled gracefully and triggers Zero-Trust STEP_UP', async () => {
    clearCachedCamaraToken();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('token')) {
        return new Response(JSON.stringify({ access_token: 'mock-token', expires_in: 3600 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '30',
        },
      });
    };

    try {
      const checkResult = await checkSimSwap({
        phoneNumber: '+14155550142',
        configOverride: {
          mode: 'sandbox',
          baseUrl: 'https://api.sandbox.telecom.com',
          clientId: 'dummy-id',
          clientSecret: 'dummy-secret',
        },
      });

      if (checkResult.status !== 'RATE_LIMITED') {
        throw new Error(`Expected status === RATE_LIMITED, got ${checkResult.status}`);
      }

      const decision = calculateRiskDecision({
        amount: 1500,
        currency: 'USD',
        sourceCountry: 'USA',
        destinationCountry: 'GBR',
        signals: {
          simSwap24h: checkResult.swappedWithin24h,
          numberVerified: true,
          deviceStatus: 'TRUSTED',
          simSwapVerificationStatus: checkResult.status,
        },
      });

      if (decision.riskDecision !== 'STEP_UP') {
        throw new Error(`Expected STEP_UP decision on RATE_LIMITED, got ${decision.riskDecision}`);
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  // Test 9: Carrier Gateway Timeout -> Never silently approved -> STEP_UP_REQUIRED
  await runTest('Carrier Timeout (TIMEOUT) triggers Zero-Trust STEP_UP', async () => {
    clearCachedCamaraToken();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('token')) {
        return new Response(JSON.stringify({ access_token: 'mock-token', expires_in: 3600 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      throw abortError;
    };

    try {
      const checkResult = await checkSimSwap({
        phoneNumber: '+14155550142',
        configOverride: {
          mode: 'sandbox',
          baseUrl: 'https://api.sandbox.telecom.com',
          clientId: 'dummy-id',
          clientSecret: 'dummy-secret',
          timeoutMs: 100,
        },
      });

      if (checkResult.status !== 'TIMEOUT') {
        throw new Error(`Expected status === TIMEOUT, got ${checkResult.status}`);
      }

      const decision = calculateRiskDecision({
        amount: 1500,
        currency: 'USD',
        sourceCountry: 'USA',
        destinationCountry: 'GBR',
        signals: {
          simSwap24h: checkResult.swappedWithin24h,
          numberVerified: true,
          deviceStatus: 'TRUSTED',
          simSwapVerificationStatus: checkResult.status,
        },
      });

      if (decision.riskDecision !== 'STEP_UP') {
        throw new Error(`Expected STEP_UP decision on TIMEOUT, got ${decision.riskDecision}`);
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  // Test 10: Malformed API Response -> Handled safely -> STEP_UP_REQUIRED
  await runTest('Malformed API Response triggers Zero-Trust STEP_UP', async () => {
    clearCachedCamaraToken();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('token')) {
        return new Response(JSON.stringify({ access_token: 'mock-token', expires_in: 3600 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ carrier: 'AT&T', status: 'OK' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    try {
      const checkResult = await checkSimSwap({
        phoneNumber: '+14155550142',
        configOverride: {
          mode: 'sandbox',
          baseUrl: 'https://api.sandbox.telecom.com',
          clientId: 'dummy-id',
          clientSecret: 'dummy-secret',
        },
      });

      if (checkResult.status !== 'ERROR') {
        throw new Error(`Expected status === ERROR, got ${checkResult.status}`);
      }

      const decision = calculateRiskDecision({
        amount: 1500,
        currency: 'USD',
        sourceCountry: 'USA',
        destinationCountry: 'GBR',
        signals: {
          simSwap24h: checkResult.swappedWithin24h,
          numberVerified: true,
          deviceStatus: 'TRUSTED',
          simSwapVerificationStatus: checkResult.status,
        },
      });

      if (decision.riskDecision !== 'STEP_UP') {
        throw new Error(`Expected STEP_UP decision on malformed response, got ${decision.riskDecision}`);
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  // Test 11: Unsupported Phone Number (404/400) -> Handled safely -> STEP_UP_REQUIRED
  await runTest('Unsupported Phone Number (404/400) triggers Zero-Trust STEP_UP', async () => {
    clearCachedCamaraToken();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('token')) {
        return new Response(JSON.stringify({ access_token: 'mock-token', expires_in: 3600 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ code: 'INVALID_PHONE_NUMBER', message: 'Number not recognized' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    try {
      const checkResult = await checkSimSwap({
        phoneNumber: '+19999999999',
        configOverride: {
          mode: 'sandbox',
          baseUrl: 'https://api.sandbox.telecom.com',
          clientId: 'dummy-id',
          clientSecret: 'dummy-secret',
        },
      });

      if (checkResult.status !== 'UNSUPPORTED_NUMBER') {
        throw new Error(`Expected status === UNSUPPORTED_NUMBER, got ${checkResult.status}`);
      }

      const decision = calculateRiskDecision({
        amount: 1500,
        currency: 'USD',
        sourceCountry: 'USA',
        destinationCountry: 'GBR',
        signals: {
          simSwap24h: checkResult.swappedWithin24h,
          numberVerified: true,
          deviceStatus: 'TRUSTED',
          simSwapVerificationStatus: checkResult.status,
        },
      });

      if (decision.riskDecision !== 'STEP_UP') {
        throw new Error(`Expected STEP_UP decision on UNSUPPORTED_NUMBER, got ${decision.riskDecision}`);
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  // Test 12: Pipeline Integration with evaluateTelecomSignals
  await runTest('evaluateTelecomSignals incorporates both SIM Swap and Number Verification', async () => {
    const result = await evaluateTelecomSignals({
      amount: 2500,
      currency: 'USD',
      sourceCountry: 'USA',
      destinationCountry: 'GBR',
      senderEmail: 'treasury@trustroute.com',
      phoneNumber: '+14155550199',
    });

    if (!result.telecomVerification) {
      throw new Error('telecomVerification object missing from evaluateTelecomSignals output');
    }
    if (!result.telecomVerification.phoneNumberMasked) {
      throw new Error('phoneNumberMasked missing from telecomVerification');
    }
    if (result.telecomVerification.phoneNumberMasked.includes('55501')) {
      throw new Error('Masking leaked phone digits in telecomVerification');
    }
    if (typeof result.telecomVerification.simSwap?.swappedWithin24h !== 'boolean') {
      throw new Error('simSwap.swappedWithin24h missing');
    }
    if (typeof result.telecomVerification.numberVerification?.verified !== 'boolean') {
      throw new Error('numberVerification.verified missing');
    }
    if (result.signals.simSwapVerificationStatus !== 'COMPLETED') {
      throw new Error(`Expected COMPLETED status, got ${result.signals.simSwapVerificationStatus}`);
    }
    if (result.signals.numberVerificationStatus !== 'COMPLETED') {
      throw new Error(`Expected COMPLETED status for number verification, got ${result.signals.numberVerificationStatus}`);
    }
  });

  // Test 13: Diagnostics checkCamaraConnectivity
  await runTest('checkCamaraConnectivity returns connectivity diagnostic without exposing secrets', async () => {
    const diag = await checkCamaraConnectivity();
    if (!diag.mode) {
      throw new Error('mode missing from diagnostic output');
    }
    if (diag.latencyMs === undefined) {
      throw new Error('latencyMs missing from diagnostic output');
    }
    const jsonStr = JSON.stringify(diag);
    if (jsonStr.includes('clientSecret') && !jsonStr.includes('hasClientSecret')) {
      throw new Error('clientSecret field exposed in diagnostic output');
    }
  });

  console.log('\n================================================================');
  const passCount = results.filter((r) => r.passed).length;
  const failCount = results.filter((r) => !r.passed).length;
  console.log(`Summary: ${passCount} passed, ${failCount} failed (${results.length} total)`);
  console.log('================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
