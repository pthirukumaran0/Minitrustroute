import { checkCamaraConnectivity } from '../src/services/camaraService';

async function main() {
  console.log('================================================================');
  console.log('📡 TrustRoute CAMARA Gateway Connectivity Diagnostic');
  console.log('================================================================\n');

  try {
    const diagnostic = await checkCamaraConnectivity();

    console.log(`Operating Mode:        ${diagnostic.mode.toUpperCase()}`);
    console.log(`Is Simulated:          ${diagnostic.isSimulated}`);
    console.log(`Provider:              ${diagnostic.provider}`);
    console.log(`Status:                ${diagnostic.status}`);
    console.log(`Base URL:              ${diagnostic.baseUrl}`);
    console.log(`Auth Endpoint:         ${diagnostic.authUrl}`);
    console.log(`Has Client ID:         ${diagnostic.hasClientId}`);
    console.log(`Has Client Secret:     ${diagnostic.hasClientSecret ? 'YES (Secret Masked)' : 'NO'}`);
    console.log(`Has API Key:           ${diagnostic.hasApiKey ? 'YES (Key Masked)' : 'NO'}`);
    console.log(`Response Latency:      ${diagnostic.latencyMs}ms`);
    console.log(`Checked At:            ${diagnostic.checkedAt}`);
    console.log(`Message:               ${diagnostic.message}`);
    console.log('\n================================================================');

    if (diagnostic.status === 'ERROR') {
      console.error('❌ CAMARA Gateway Connectivity Check FAILED.');
      process.exit(1);
    } else {
      console.log('✅ CAMARA Gateway Connectivity Check PASSED.');
      process.exit(0);
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('❌ Unexpected Diagnostic Error:', errorMsg);
    process.exit(1);
  }
}

main();

