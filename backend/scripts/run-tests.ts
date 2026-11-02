/**
 * TrustRoute Test Runner
 * ---------------------
 * Starts the Express backend as a child process, waits for it to be healthy,
 * then runs the specified test script. Cleans up the server after tests finish.
 *
 * Usage (via npm scripts):
 *   npm run test:phase1   →  runs this with scripts/test-phase1.ts
 *   npm run test:phase2   →  runs this with scripts/test-phase2.ts
 *
 * If the backend is already running on the target port, it uses that process
 * and does NOT shut it down afterwards.
 *
 * Environment overrides:
 *   BASE_URL                  Override server URL  (default: http://127.0.0.1:5000)
 *   PORT                      Override server port (default: 5000)
 *   SERVER_READY_TIMEOUT_MS   Max ms to wait for server (default: 30000)
 */

import { spawn, ChildProcess, SpawnOptions } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// ─── Paths ────────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ENV_FILE = path.resolve(ROOT, '.env');

// On Windows, .bin shims are .cmd files and require shell: true to spawn.
const IS_WINDOWS = process.platform === 'win32';
const TSX_BIN = path.resolve(
  ROOT,
  'node_modules',
  '.bin',
  IS_WINDOWS ? 'tsx.cmd' : 'tsx'
);

// ─── Config ───────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || '5000', 10);
const BASE_URL = process.env.BASE_URL || `http://127.0.0.1:${PORT}`;
const HEALTH_URL = `${BASE_URL}/api/health`;
const READY_TIMEOUT_MS = parseInt(process.env.SERVER_READY_TIMEOUT_MS || '30000', 10);
const POLL_INTERVAL_MS = 500;

// Which test script to run — passed as the first CLI argument.
const testScriptArg = process.argv[2];
if (!testScriptArg) {
  console.error('Usage: tsx scripts/run-tests.ts <path/to/test-script.ts>');
  process.exit(1);
}
const testScriptAbs = path.resolve(ROOT, testScriptArg);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Poll /api/health until it responds (any HTTP status) or times out. */
async function waitForServer(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError = '';

  while (Date.now() < deadline) {
    try {
      const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(2000) });
      // Any HTTP response (200 or 503) means Express is up.
      if (res.status > 0) return;
    } catch (e: unknown) {
      lastError = e instanceof Error ? e.message : String(e);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  throw new Error(
    `Server at ${HEALTH_URL} did not respond within ${timeoutMs}ms. Last error: ${lastError}`
  );
}

/** Kill a spawned process. On Windows, uses taskkill to kill the full process tree. */
function killProcess(child: ChildProcess): void {
  if (!child || child.killed || child.exitCode !== null) return;
  try {
    if (IS_WINDOWS && child.pid) {
      spawn('taskkill', ['/pid', String(child.pid), '/f', '/t'], {
        stdio: 'ignore',
        shell: true,
      });
    } else {
      child.kill('SIGTERM');
    }
  } catch {
    // best-effort
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 TrustRoute Test Runner');
  console.log(`   Test script : ${testScriptArg}`);
  console.log(`   Server URL  : ${BASE_URL}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  // ── Step 1: Check if server is already running ────────────────────────────
  let serverAlreadyRunning = false;
  try {
    await waitForServer(2000);
    serverAlreadyRunning = true;
    console.log(`✅ Server already running at ${BASE_URL}. Skipping startup.\n`);
  } catch {
    // Server not running — we'll start it below.
  }

  let serverProcess: ChildProcess | null = null;

  if (!serverAlreadyRunning) {
    // ── Step 2: Start the server ────────────────────────────────────────────
    console.log('🚀 Starting backend server...');

    const spawnOpts: SpawnOptions = {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
      detached: false,
      // .cmd shims require shell mode on Windows
      shell: IS_WINDOWS,
    };

    serverProcess = spawn(
      TSX_BIN,
      ['--env-file=' + ENV_FILE, path.join('src', 'server.ts')],
      spawnOpts
    );

    if (serverProcess.stdout) {
      serverProcess.stdout.on('data', (d: Buffer) => {
        process.stdout.write('[server] ' + d.toString());
      });
    }
    if (serverProcess.stderr) {
      serverProcess.stderr.on('data', (d: Buffer) => {
        process.stderr.write('[server] ' + d.toString());
      });
    }

    serverProcess.on('error', (err) => {
      console.error('[server] Spawn error:', err.message);
    });

    serverProcess.on('exit', (code, signal) => {
      if (code !== 0 && code !== null) {
        console.error(`[server] Process exited unexpectedly (code=${code}, signal=${signal})`);
      }
    });

    // ── Step 3: Wait for server to become healthy ───────────────────────────
    console.log(`⏳ Waiting up to ${READY_TIMEOUT_MS / 1000}s for server to be ready...`);
    try {
      await waitForServer(READY_TIMEOUT_MS);
      console.log(`✅ Server is ready at ${BASE_URL}\n`);
    } catch (err) {
      console.error(`❌ ${err instanceof Error ? err.message : err}`);
      if (serverProcess) killProcess(serverProcess);
      process.exit(1);
    }
  }

  // ── Step 4: Run the test script ───────────────────────────────────────────
  let testExitCode = 0;

  try {
    console.log(`▶  Running: ${testScriptArg}\n`);

    const testSpawnOpts: SpawnOptions = {
      cwd: ROOT,
      stdio: 'inherit',
      env: {
        ...process.env,
        BASE_URL,
      },
      shell: IS_WINDOWS,
    };

    const testProcess = spawn(
      TSX_BIN,
      ['--env-file=' + ENV_FILE, testScriptAbs],
      testSpawnOpts
    );

    testExitCode = await new Promise<number>((resolve) => {
      testProcess.on('exit', (code) => resolve(code ?? 1));
      testProcess.on('error', (err) => {
        console.error('Test process error:', err.message);
        resolve(1);
      });
    });
  } finally {
    // ── Step 5: Shut down the server we started (not one we found running) ──
    if (serverProcess && !serverAlreadyRunning) {
      console.log('\n🛑 Stopping server process...');
      killProcess(serverProcess);
      await new Promise((r) => setTimeout(r, 1500));
      console.log('✅ Server stopped.');
    }
  }

  process.exit(testExitCode);
}

main().catch((err) => {
  console.error('Runner error:', err);
  process.exit(1);
});
