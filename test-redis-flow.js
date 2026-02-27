const Redis = require('ioredis');

async function testRedisFlow() {
  const testRunId = "k8s-backend-test-1772183335";
  const testData = {
    testRunId: testRunId,
    sessionId: `test-session-${testRunId}`,
    data: {
      input: "test-redis-key-e2e",
      timestamp: new Date().toISOString()
    }
  };

  const key = `test:session:${testRunId}`;
  
  // Connect to Redis
  const redis = new Redis({
    host: 'localhost',
    port: 6379,
    retryStrategy: (times) => {
      if (times > 3) return null;
      return Math.min(times * 100, 2000);
    }
  });

  try {
    console.log('Writing test data to Redis...');
    console.log('Key:', key);
    console.log('Data:', JSON.stringify(testData, null, 2));
    
    // Write data with TTL
    await redis.setex(key, 300, JSON.stringify(testData));
    console.log('✓ Data written successfully');
    
    // Read data back
    console.log('\nReading data back from Redis...');
    const retrievedData = await redis.get(key);
    
    if (!retrievedData) {
      throw new Error('No data retrieved from Redis');
    }
    
    const parsedData = JSON.parse(retrievedData);
    console.log('Retrieved data:', JSON.stringify(parsedData, null, 2));
    
    // Validate input-output
    const input = testData.data.input;
    const output = parsedData.data.input;
    
    const result = {
      testRunId: testRunId,
      testName: "redis-data-flow",
      input: input,
      output: output,
      status: input === output ? "PASS" : "FAIL",
      dataDependency: "output === input",
      verificationMethod: "exact string match",
      redisTestImpulseId: `redis-test-${testRunId}`,
      fullDataMatch: JSON.stringify(testData) === JSON.stringify(parsedData),
      ttl: await redis.ttl(key)
    };
    
    console.log('\n=== Test Result ===');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.status === "PASS") {
      console.log('\n✓ Redis data flow test PASSED');
    } else {
      console.log('\n✗ Redis data flow test FAILED');
      console.log('Expected input:', input);
      console.log('Actual output:', output);
    }
    
    await redis.quit();
    return result;
    
  } catch (error) {
    console.error('Error:', error.message);
    await redis.quit();
    throw error;
  }
}

testRedisFlow().catch(console.error);
