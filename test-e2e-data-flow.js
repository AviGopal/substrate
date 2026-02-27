const Redis = require('ioredis');
const { Surreal } = require('surrealdb');

async function testE2EDataFlow() {
  const testRunId = "k8s-backend-test-1772183335";
  const testPrompt = "Validate K8s deployed metabob stack: verify Redis connectivity, SurrealDB vessel registry (3 vessels), metabob-rpc-api health, and ACP vessel communication";
  
  const results = {
    testRunId: testRunId,
    testName: "end-to-end-data-flow",
    dataFlow: {
      stage1_redis: {
        input: testPrompt,
        stored: false,
        status: "PENDING"
      },
      stage2_surrealdb: {
        activityCreated: false,
        linkedToSession: false,
        status: "PENDING"
      },
      stage3_devbob: {
        taskDelegated: false,
        resultGenerated: false,
        resultDependsOnInput: false,
        status: "PENDING",
        note: "Requires parent agent with acp_delegate tool"
      },
      stage4_validation: {
        finalState: "incomplete",
        inputOutputDependency: "not-tested",
        status: "PENDING"
      }
    },
    overallStatus: "IN_PROGRESS",
    dependencyGraph: "input → redis → surrealdb → devbob → output",
    e2eTestImpulseId: `e2e-test-${testRunId}`
  };

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║       End-to-End Data Flow Test - Metabob Stack         ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // Stage 1: Store session data in Redis
  console.log('═══ Stage 1: Redis Session Storage ═══\n');
  
  const redis = new Redis({
    host: 'localhost',
    port: 6379,
    retryStrategy: (times) => {
      if (times > 3) return null;
      return Math.min(times * 100, 2000);
    }
  });

  try {
    const sessionData = {
      sessionId: testRunId,
      prompt: testPrompt,
      timestamp: new Date().toISOString(),
      metadata: {
        testType: "e2e-validation",
        components: ["redis", "surrealdb", "devbob"]
      }
    };

    const sessionKey = `session:${testRunId}`;
    console.log('Storing session data in Redis...');
    console.log(`Key: ${sessionKey}`);
    console.log(`Prompt: ${testPrompt.substring(0, 60)}...`);
    
    await redis.setex(sessionKey, 300, JSON.stringify(sessionData));
    console.log('✓ Session data stored in Redis\n');

    // Verify storage
    const retrieved = await redis.get(sessionKey);
    const parsedData = JSON.parse(retrieved);
    
    if (parsedData.prompt === testPrompt) {
      console.log('✓ Verification: Input prompt stored correctly');
      results.dataFlow.stage1_redis.stored = true;
      results.dataFlow.stage1_redis.status = "PASS";
    } else {
      console.log('✗ Verification failed: Prompt mismatch');
      results.dataFlow.stage1_redis.status = "FAIL";
    }

    await redis.quit();

  } catch (error) {
    console.error('✗ Redis stage failed:', error.message);
    results.dataFlow.stage1_redis.status = "FAIL";
    await redis.quit();
  }

  console.log('\n═══ Stage 2: SurrealDB Activity Creation ═══\n');

  const db = new Surreal();

  try {
    await db.connect('http://localhost:8000');
    await db.signin({ username: 'root', password: 'root' });
    await db.use({ namespace: 'metabob', database: 'metabob' });
    console.log('✓ Connected to SurrealDB\n');

    // Create activity record
    const activityId = testRunId.replace(/-/g, '_');
    const createQuery = `
      CREATE activity:⟨${activityId}⟩ SET
        activityId = "${testRunId}",
        sessionId = "${testRunId}",
        status = "pending",
        prompt = "${testPrompt}",
        createdAt = time::now()
    `;

    console.log('Creating activity record...');
    const createResult = await db.query(createQuery);
    const activity = createResult[0]?.[0] || createResult[0];
    console.log('✓ Activity record created');
    console.log(`  ID: activity:${activityId}`);
    console.log(`  Status: ${activity.status}`);
    console.log(`  Linked to session: ${activity.sessionId}\n`);

    // Verify linking
    if (activity.sessionId === testRunId) {
      console.log('✓ Verification: Activity linked to session correctly');
      results.dataFlow.stage2_surrealdb.activityCreated = true;
      results.dataFlow.stage2_surrealdb.linkedToSession = true;
      results.dataFlow.stage2_surrealdb.status = "PASS";
    } else {
      console.log('✗ Verification failed: Session linking incorrect');
      results.dataFlow.stage2_surrealdb.status = "FAIL";
    }

    await db.close();

  } catch (error) {
    console.error('✗ SurrealDB stage failed:', error.message);
    results.dataFlow.stage2_surrealdb.status = "FAIL";
    try { await db.close(); } catch {}
  }

  console.log('\n═══ Stage 3: DevBob ACP Delegation ═══\n');
  
  console.log('⚠ Note: This stage requires parent agent execution');
  console.log('DevBob ACP delegation requires:');
  console.log('  • OpenCode runtime with acp_delegate tool');
  console.log('  • Parent agent context (not subagent)');
  console.log('  • Active impulse system\n');

  console.log('Recommended ACP delegation call:');
  console.log('```typescript');
  console.log('const result = await acp_delegate({');
  console.log('  target: "docker://k8s_devbob_devbob-0_metabob_...",');
  console.log('  taskDescription: "Process metabob stack validation",');
  console.log(`  prompt: \`Read session data from Redis key: session:${testRunId}`);
  console.log('           Process the validation prompt and update activity status in SurrealDB\`,');
  console.log('  timeout: 120');
  console.log('});');
  console.log('```\n');

  console.log('Expected DevBob actions:');
  console.log('  1. Read session data from Redis');
  console.log('  2. Parse validation prompt');
  console.log('  3. Execute validation tasks');
  console.log('  4. Update activity status in SurrealDB to "completed"');
  console.log('  5. Store results back to Redis or SurrealDB\n');

  results.dataFlow.stage3_devbob.status = "MANUAL_EXECUTION_REQUIRED";

  console.log('═══ Stage 4: Final Validation ═══\n');
  
  console.log('After DevBob execution, validate:');
  console.log('  • Activity status updated to "completed"');
  console.log('  • Result contains reference to original prompt');
  console.log('  • Input-output dependency chain intact');
  console.log('  • All components communicated successfully\n');

  results.dataFlow.stage4_validation.status = "PENDING_STAGE3";

  // Update overall status
  if (results.dataFlow.stage1_redis.status === "PASS" &&
      results.dataFlow.stage2_surrealdb.status === "PASS") {
    results.overallStatus = "PARTIAL_SUCCESS";
    console.log('═══════════════════════════════════════════════════════════');
    console.log('Overall Status: ⚠ PARTIAL SUCCESS');
    console.log('  ✓ Stage 1 (Redis): PASS');
    console.log('  ✓ Stage 2 (SurrealDB): PASS');
    console.log('  ⚠ Stage 3 (DevBob): MANUAL EXECUTION REQUIRED');
    console.log('  ⚠ Stage 4 (Validation): PENDING');
    console.log('═══════════════════════════════════════════════════════════\n');
  } else {
    results.overallStatus = "PARTIAL_FAILURE";
    console.log('═══════════════════════════════════════════════════════════');
    console.log('Overall Status: ✗ PARTIAL FAILURE');
    console.log(`  Stage 1 (Redis): ${results.dataFlow.stage1_redis.status}`);
    console.log(`  Stage 2 (SurrealDB): ${results.dataFlow.stage2_surrealdb.status}`);
    console.log('═══════════════════════════════════════════════════════════\n');
  }

  console.log('═══ Test Results ═══\n');
  console.log(JSON.stringify(results, null, 2));

  return results;
}

testE2EDataFlow().catch(console.error);
