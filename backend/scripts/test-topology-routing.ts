import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });

import { findOptimalRoute, loadPaymentGraphFromNeo4j } from '../src/lib/routingEngine';
import { closeNeo4jDriver } from '../src/lib/neo4j';

async function main() {
  console.log('--- Testing Live Neo4j Topology Routing ---');
  let passCount = 0;
  let totalCount = 0;

  function assert(condition: boolean, msg: string) {
    totalCount++;
    if (condition) {
      passCount++;
      console.log(`[PASS] ${msg}`);
    } else {
      console.error(`[FAIL] ${msg}`);
    }
  }

  try {
    const graph = await loadPaymentGraphFromNeo4j();
    assert(graph.nodes.size === 15, `Loaded 15 nodes from Neo4j (got ${graph.nodes.size})`);

    // Scenario A: A -> B (Gateway-US -> Bank-SBI-Mumbai)
    const resA = await findOptimalRoute({
      sourceProviderId: 'Gateway-US',
      destinationProviderId: 'Bank-SBI-Mumbai',
    });
    assert(resA.success === true, 'A -> B: Route calculation succeeded');
    assert(resA.route?.hops[0] === 'Gateway-US', 'A -> B: Path starts at Gateway-US');
    assert(
      resA.route?.hops[resA.route.hops.length - 1] === 'Bank-SBI-Mumbai',
      'A -> B: Path ends at Bank-SBI-Mumbai'
    );
    console.log(`   Path A: ${resA.route?.hops.join(' -> ')} ($${resA.route?.estimatedCost}, ${resA.route?.estimatedLatencyMs}ms)`);

    // Scenario B: Change destination to C (Gateway-US -> Bank-Dubai-Commercial)
    const resB = await findOptimalRoute({
      sourceProviderId: 'Gateway-US',
      destinationProviderId: 'Bank-Dubai-Commercial',
    });
    assert(resB.success === true, 'A -> C: Route calculation succeeded');
    assert(resB.route?.hops[0] === 'Gateway-US', 'A -> C: Path starts at Gateway-US');
    assert(
      resB.route?.hops[resB.route.hops.length - 1] === 'Bank-Dubai-Commercial',
      'A -> C: Path ends at Bank-Dubai-Commercial'
    );
    console.log(`   Path B: ${resB.route?.hops.join(' -> ')} ($${resB.route?.estimatedCost}, ${resB.route?.estimatedLatencyMs}ms)`);

    // Scenario C: Change source to Gateway-EU, same destination Bank-Dubai-Commercial
    const resC = await findOptimalRoute({
      sourceProviderId: 'Gateway-EU',
      destinationProviderId: 'Bank-Dubai-Commercial',
    });
    if (!resC.success) {
      console.log('resC failure details:', resC.error, resC.details);
    }
    assert(resC.success === true, 'New Source -> C: Route calculation succeeded');
    assert(resC.route?.hops[0] === 'Gateway-EU', 'New Source -> C: Path starts at Gateway-EU');
    assert(
      resC.route?.hops[resC.route.hops.length - 1] === 'Bank-Dubai-Commercial',
      'New Source -> C: Path ends at Bank-Dubai-Commercial'
    );
    console.log(`   Path C: ${resC.route?.hops.join(' -> ')} ($${resC.route?.estimatedCost}, ${resC.route?.estimatedLatencyMs}ms)`);

    // Scenario D: Unreachable destination (Gateway-US -> Bank-Isolated-Pacific)
    const resD = await findOptimalRoute({
      sourceProviderId: 'Gateway-US',
      destinationProviderId: 'Bank-Isolated-Pacific',
    });
    assert(resD.success === false, 'Unreachable destination: Success is false');
    assert(
      resD.error === 'UNREACHABLE_DESTINATION',
      `Unreachable destination returns UNREACHABLE_DESTINATION (got ${resD.error})`
    );
    assert(Boolean(resD.details?.includes('No active routing path connects origin')), 'Unreachable returns proper explanation');

    // Scenario E: Source == Destination (Gateway-US -> Gateway-US)
    const resE = await findOptimalRoute({
      sourceProviderId: 'Gateway-US',
      destinationProviderId: 'Gateway-US',
    });
    assert(resE.success === false, 'Same source & destination: Success is false');
    assert(resE.error === 'NO_VALID_ROUTE', `Same source & destination returns NO_VALID_ROUTE (got ${resE.error})`);

    // Scenario H: Verify each hop in Path A exists in Neo4j edges
    let allHopsValid = true;
    if (resA.route) {
      for (let i = 0; i < resA.route.hops.length - 1; i++) {
        const u = resA.route.hops[i];
        const v = resA.route.hops[i + 1];
        const edge = graph.adjacency.get(u)?.find((e) => e.target === v);
        if (!edge || edge.prohibited || !edge.isAvailable) {
          allHopsValid = false;
          break;
        }
      }
    }
    assert(allHopsValid, 'Every displayed hop exists as active CONNECTS_TO in Neo4j');

    console.log(`\nResult: ${passCount}/${totalCount} tests passed.`);
  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    await closeNeo4jDriver();
  }
}

main();

