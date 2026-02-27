#!/usr/bin/env bun
import { createClient } from 'redis';

const TEST_RUN_ID = "k8s-local-validation-20260226";
const SESSION_ID = "test-session-k8s-local-validation-20260226";
const REDIS_KEY = `test:session:${TEST_RUN_ID}`;
const TTL_SECONDS = 300;

async function testRedisDataFlow() {
  console.log("Starting Redis data flow test...\n");
  
  // Create test data
  const testData = {
    testRunId: TEST_RUN_ID,
    sessionId: SESSION_ID,
    data: {
      input: "test-session-k8s",
      timestamp: new Date().toISOString()
    }
  };
  
  console.log("Test Data:");
  console.log(JSON.stringify(testData, null, 2));
  console.log();
  
  // Connect to Redis
  const client = createClient({
    socket: {
      host: 'localhost',
      port: 6379
    }
  });
  
  client.on('error', (err) => console.error('Redis Client Error', err));
  
  try {
    await client.connect();
    console.log("✓ Connected to Redis\n");
    
    // Write data to Redis
    const jsonData = JSON.stringify(testData);
    await client.set(REDIS_KEY, jsonData, {
      EX: TTL_SECONDS
    });
    console.log(`✓ Wrote data to Redis key: ${REDIS_KEY}`);
    console.log(`✓ Set TTL: ${TTL_SECONDS} seconds\n`);
    
    // Read data back from Redis
    const retrievedData = await client.get(REDIS_KEY);
    
    if (!retrievedData) {
      throw new Error("Failed to retrieve data from Redis");
    }
    
    console.log("✓ Retrieved data from Redis\n");
    
    // Parse and validate
    const parsedData = JSON.parse(retrievedData);
    console.log("Retrieved Data:");
    console.log(JSON.stringify(parsedData, null, 2));
    console.log();
    
    // Validate input-output dependency
    const input = testData.data.input;
    const output = parsedData.data.input;
    
    const status = (output === input) ? "PASS" : "FAIL";
    
    const result = {
      testRunId: TEST_RUN_ID,
      testName: "redis-data-flow",
      input: input,
      output: output,
      status: status,
      dataDependency: "output === input",
      verificationMethod: "exact string match",
      redisTestImpulseId: `redis-test-${TEST_RUN_ID}`,
      details: {
        keyUsed: REDIS_KEY,
        ttl: TTL_SECONDS,
        dataIntegrity: status === "PASS" ? "verified" : "corrupted",
        timestamp: new Date().toISOString()
      }
    };
    
    console.log("\n=== Test Results ===");
    console.log(JSON.stringify(result, null, 2));
    
    if (status === "FAIL") {
      console.error("\n❌ TEST FAILED: Output does not match input");
      console.error(`Expected: ${input}`);
      console.error(`Got: ${output}`);
    } else {
      console.log("\n✅ TEST PASSED: Data integrity verified");
    }
    
    // Clean up
    await client.del(REDIS_KEY);
    console.log(`\n✓ Cleaned up test key: ${REDIS_KEY}`);
    
    await client.disconnect();
    console.log("✓ Disconnected from Redis\n");
    
    return result;
    
  } catch (error) {
    console.error("Error during Redis test:", error);
    await client.disconnect();
    throw error;
  }
}

// Run the test
const result = await testRedisDataFlow();

// Save result to file
await Bun.write("redis-test-results.json", JSON.stringify(result, null, 2));
console.log("✓ Test results saved to redis-test-results.json");
