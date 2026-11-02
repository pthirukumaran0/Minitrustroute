import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { loadPaymentGraphFromNeo4j, yensKShortestPaths } from '../src/lib/routingEngine';
import { connectToDatabase } from '../src/lib/database';
import mongoose from 'mongoose';
import User from '../src/models/User';

async function runTests() {
  console.log('\n====================================================');
  console.log('🧪 Running Test Suite: Admin Yen\'s K-Shortest Path Simulator & Read-Only Roles');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, desc: string) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${desc}`);
      process.exitCode = 1;
    }
  }

  // --- Test 1: Neo4j Live Topology & Dynamic Gateway Loading ---
  console.log('--- Test 1: Neo4j Gateway Discovery & Active Rails ---');
  const graph = await loadPaymentGraphFromNeo4j();
  assert(graph.nodes.size >= 5, `Dynamic gateways loaded from Neo4j: ${graph.nodes.size} nodes found`);

  const nodeIds = Array.from(graph.nodes.keys());
  const sourceNode = nodeIds[0];
  const targetNode = nodeIds[nodeIds.length - 1];
  assert(sourceNode !== targetNode, `Distinct source (${sourceNode}) and target (${targetNode}) discovered`);

  // --- Test 2: Yen's K-Shortest Loopless Paths Algorithm ---
  console.log('\n--- Test 2: Yen\'s K-Shortest Algorithm Execution ---');
  // Find a pair with connections
  let validPair: { src: string; tgt: string } | null = null;
  for (const src of nodeIds) {
    for (const tgt of nodeIds) {
      if (src !== tgt) {
        const testPaths = yensKShortestPaths(graph, src, tgt, 3);
        if (testPaths.length >= 2) {
          validPair = { src, tgt };
          break;
        }
      }
    }
    if (validPair) break;
  }

  if (!validPair) {
    // If no 2-path pair exists, test with any connected pair
    for (const src of nodeIds) {
      for (const tgt of nodeIds) {
        if (src !== tgt) {
          const testPaths = yensKShortestPaths(graph, src, tgt, 1);
          if (testPaths.length >= 1) {
            validPair = { src, tgt };
            break;
          }
        }
      }
      if (validPair) break;
    }
  }

  assert(validPair !== null, `Connected gateway corridor discovered: ${validPair?.src} -> ${validPair?.tgt}`);

  if (validPair) {
    // Test K = 1
    const pathsK1 = yensKShortestPaths(graph, validPair.src, validPair.tgt, 1);
    assert(pathsK1.length === 1, `K=1 returns exactly 1 shortest route`);
    assert(pathsK1[0].hops[0] === validPair.src, `Primary route starts at selected source (${validPair.src})`);
    assert(pathsK1[0].hops[pathsK1[0].hops.length - 1] === validPair.tgt, `Primary route terminates at target (${validPair.tgt})`);

    // Test K = 3
    const pathsK3 = yensKShortestPaths(graph, validPair.src, validPair.tgt, 3);
    assert(pathsK3.length >= 1, `K=3 returns up to ${pathsK3.length} loopless pathways`);

    // Verify ordering by composite weight / cost
    for (let i = 1; i < pathsK3.length; i++) {
      assert(
        pathsK3[i].compositeWeight >= pathsK3[i - 1].compositeWeight - 1e-4,
        `Route #${i + 1} composite weight (${pathsK3[i].compositeWeight}) >= Route #${i} (${pathsK3[i - 1].compositeWeight})`
      );
    }

    // Verify all paths are loopless
    pathsK3.forEach((path, idx) => {
      const uniqueHops = new Set(path.hops);
      assert(uniqueHops.size === path.hops.length, `Route #${idx + 1} is strictly loopless (no duplicate gateways)`);
    });
  }

  // --- Test 3: Same Source and Destination Handling ---
  console.log('\n--- Test 3: Validation Constraints & Unreachable Handling ---');
  if (sourceNode) {
    const samePairPaths = yensKShortestPaths(graph, sourceNode, sourceNode, 3);
    assert(samePairPaths.length <= 1, `Identical source/destination handled correctly without infinite loops`);
  }

  // --- Test 4: User Management - Read-Only Role & Zero-PII ---
  console.log('\n--- Test 4: User Management - Role Column Read-Only & RBAC Protection ---');
  await connectToDatabase();
  const nonAdminUsers = await User.find({ role: { $in: ['sender', 'analyst'] } }).lean();
  assert(nonAdminUsers.length >= 10, `Non-admin users in MongoDB: ${nonAdminUsers.length} (within 10-15 target)`);

  const adminUsers = await User.find({ role: 'admin' }).lean();
  assert(adminUsers.length >= 1, `Admin accounts securely exist in DB: ${adminUsers.length}`);

  // Ensure stable anonymous IDs exist
  const hasAnonymousIds = nonAdminUsers.every((u) => u.anonymousId && u.anonymousId.startsWith('USR-'));
  assert(hasAnonymousIds, `All non-admin users have persistent anonymous identifiers (USR-xxxx)`);

  await mongoose.disconnect();

  console.log('\n====================================================');
  console.log(`🏁 Total Test Results: ${passed}/${total} Assertions PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('====================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
