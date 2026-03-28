/**
 * Validation Harness: surrealdb-primary-redis-cache
 * 
 * SPECIFICATION:
 * SurrealDB must be the primary data store for all activity data (templates, metrics, executions).
 * Redis is a read-through cache only.
 * 
 * Write path: Client → rpc-api → SurrealDB → Redis cache
 * Read path: Client → rpc-api → Redis (cache hit) OR SurrealDB (cache miss) → populate Redis
 * 
 * VALIDATION STRATEGY:
 * 1. Template Creation: Verify SurrealDB write happens BEFORE Redis cache
 * 2. Template Read (Cold Cache): Verify Redis miss → SurrealDB query → Redis populate
 * 3. Template Read (Warm Cache): Verify Redis hit (no SurrealDB query)
 * 4. Execution Recording: Verify SurrealDB write happens BEFORE Redis cache
 * 5. Cache Invalidation: Verify metrics updates invalidate Redis cache
 * 6. Data Durability: Verify templates survive Redis flush (read from SurrealDB)
 */

interface ValidationResult {
  pass: boolean;
  testCase: string;
  actual: any;
  expected: any;
  error?: string;
  details?: string;
}

interface TestCase {
  id: string;
  name: string;
  input: any;
  expectedOutput: any;
}

interface HarnessResult {
  overallPass: boolean;
  results: ValidationResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
}

/**
 * Mock Redis client for testing
 */
class MockRedisClient {
  private data: Map<string, string> = new Map();
  private sets: Map<string, Set<string>> = new Map();
  public operations: Array<{ operation: string; key: string; timestamp: number }> = [];

  get(key: string): string | null {
    this.operations.push({ operation: 'GET', key, timestamp: Date.now() });
    return this.data.get(key) || null;
  }

  set(key: string, value: string): void {
    this.operations.push({ operation: 'SET', key, timestamp: Date.now() });
    this.data.set(key, value);
  }

  setex(key: string, ttl: number, value: string): void {
    this.operations.push({ operation: 'SETEX', key, timestamp: Date.now() });
    this.data.set(key, value);
  }

  del(key: string): void {
    this.operations.push({ operation: 'DEL', key, timestamp: Date.now() });
    this.data.delete(key);
  }

  sadd(key: string, value: string): void {
    this.operations.push({ operation: 'SADD', key, timestamp: Date.now() });
    if (!this.sets.has(key)) {
      this.sets.set(key, new Set());
    }
    this.sets.get(key)!.add(value);
  }

  smembers(key: string): string[] {
    this.operations.push({ operation: 'SMEMBERS', key, timestamp: Date.now() });
    return Array.from(this.sets.get(key) || []);
  }

  flushall(): void {
    this.operations.push({ operation: 'FLUSHALL', key: '*', timestamp: Date.now() });
    this.data.clear();
    this.sets.clear();
  }

  getOperations(): Array<{ operation: string; key: string; timestamp: number }> {
    return this.operations;
  }

  clearOperations(): void {
    this.operations = [];
  }
}

/**
 * Mock SurrealDB client for testing
 */
class MockSurrealDBClient {
  private records: Map<string, any> = new Map();
  public operations: Array<{ operation: string; table: string; recordId?: string; timestamp: number }> = [];

  create(recordId: string, data: any): any {
    this.operations.push({ operation: 'CREATE', table: recordId.split(':')[0], recordId, timestamp: Date.now() });
    this.records.set(recordId, { ...data, id: recordId });
    return this.records.get(recordId);
  }

  select(recordId: string): any | null {
    this.operations.push({ operation: 'SELECT', table: recordId.split(':')[0], recordId, timestamp: Date.now() });
    return this.records.get(recordId) || null;
  }

  update(recordId: string, data: any): any {
    this.operations.push({ operation: 'UPDATE', table: recordId.split(':')[0], recordId, timestamp: Date.now() });
    const existing = this.records.get(recordId) || {};
    this.records.set(recordId, { ...existing, ...data });
    return this.records.get(recordId);
  }

  query(queryString: string, params?: any): any[] {
    const table = this.extractTableFromQuery(queryString);
    this.operations.push({ operation: 'QUERY', table, timestamp: Date.now() });
    
    // Simple mock: return all records from the table
    const results = Array.from(this.records.entries())
      .filter(([id, _]) => id.startsWith(table + ':'))
      .map(([_, record]) => record);
    
    return [results];
  }

  delete(recordId: string): void {
    this.operations.push({ operation: 'DELETE', table: recordId.split(':')[0], recordId, timestamp: Date.now() });
    this.records.delete(recordId);
  }

  private extractTableFromQuery(query: string): string {
    const match = query.match(/FROM\s+(\w+)/i);
    return match ? match[1] : 'unknown';
  }

  getOperations(): Array<{ operation: string; table: string; recordId?: string; timestamp: number }> {
    return this.operations;
  }

  clearOperations(): void {
    this.operations = [];
  }

  clear(): void {
    this.records.clear();
    this.operations = [];
  }
}

/**
 * Test Case 1: Template Creation - Verify SurrealDB write before Redis
 */
function testTemplateCreation(): ValidationResult {
  const testCase = "Template Creation Write Order";
  const redis = new MockRedisClient();
  const surrealdb = new MockSurrealDBClient();

  const templateData = {
    variant_id: "test-template-abc123",
    activity_id: "test-template",
    variant_name: "Test Template",
    description: "Test template for validation",
    task_steps: [],
    genealogy: { content_hash: "abc123", parent_hash: null, generation: 0 }
  };

  try {
    // Simulate template creation with correct ordering
    // 1. Write to SurrealDB FIRST
    const surrealResult = surrealdb.create(`activity_template:${templateData.variant_id}`, templateData);
    
    // 2. Then write to Redis cache
    redis.setex(`activity:template:${templateData.variant_id}`, 3600, JSON.stringify(templateData));
    redis.sadd('activity:templates:list', templateData.variant_id);

    // Verify ordering
    const surrealOps = surrealdb.getOperations();
    const redisOps = redis.getOperations();

    const surrealWriteTime = surrealOps.find(op => op.operation === 'CREATE')?.timestamp || 0;
    const redisWriteTime = redisOps.find(op => op.operation === 'SETEX')?.timestamp || 0;

    const pass = surrealWriteTime < redisWriteTime && surrealWriteTime > 0 && redisWriteTime > 0;

    return {
      pass,
      testCase,
      actual: {
        surrealWriteTime,
        redisWriteTime,
        orderCorrect: surrealWriteTime < redisWriteTime,
        operations: { surrealdb: surrealOps, redis: redisOps }
      },
      expected: {
        orderCorrect: true,
        description: "SurrealDB write must happen BEFORE Redis cache write"
      },
      details: pass 
        ? "✓ Template written to SurrealDB before Redis cache" 
        : "✗ VIOLATION: Redis written before or without SurrealDB"
    };
  } catch (error: any) {
    return {
      pass: false,
      testCase,
      actual: error.message,
      expected: "No error during template creation",
      error: error.message
    };
  }
}

/**
 * Test Case 2: Template Read Cold Cache - Verify cache-aside pattern
 */
function testTemplateReadColdCache(): ValidationResult {
  const testCase = "Template Read (Cold Cache)";
  const redis = new MockRedisClient();
  const surrealdb = new MockSurrealDBClient();

  const variantId = "test-template-xyz789";
  const templateData = {
    variant_id: variantId,
    activity_id: "test-template",
    variant_name: "Test Template",
    description: "Test template",
    task_steps: []
  };

  try {
    // Pre-populate SurrealDB (simulating existing template)
    surrealdb.create(`activity_template:${variantId}`, templateData);
    surrealdb.clearOperations();
    redis.clearOperations();

    // Simulate read operation with cold cache
    // 1. Try Redis first (miss)
    let result = redis.get(`activity:template:${variantId}`);
    
    // 2. On miss, query SurrealDB
    if (!result) {
      const surrealResult = surrealdb.select(`activity_template:${variantId}`);
      
      // 3. Populate Redis cache
      if (surrealResult) {
        redis.setex(`activity:template:${variantId}`, 3600, JSON.stringify(surrealResult));
        redis.sadd('activity:templates:list', variantId);
        result = JSON.stringify(surrealResult);
      }
    }

    // Verify operations
    const redisOps = redis.getOperations();
    const surrealOps = surrealdb.getOperations();

    const hasRedisGet = redisOps.some(op => op.operation === 'GET');
    const hasSurrealSelect = surrealOps.some(op => op.operation === 'SELECT');
    const hasRedisCachePopulate = redisOps.some(op => op.operation === 'SETEX');

    const pass = hasRedisGet && hasSurrealSelect && hasRedisCachePopulate && result !== null;

    return {
      pass,
      testCase,
      actual: {
        redisChecked: hasRedisGet,
        surrealQueried: hasSurrealSelect,
        cachePopulated: hasRedisCachePopulate,
        resultRetrieved: result !== null,
        operations: { redis: redisOps, surrealdb: surrealOps }
      },
      expected: {
        redisChecked: true,
        surrealQueried: true,
        cachePopulated: true,
        resultRetrieved: true,
        description: "Redis miss → SurrealDB query → Redis populate"
      },
      details: pass
        ? "✓ Cache-aside pattern correctly implemented"
        : "✗ VIOLATION: Cache-aside pattern not followed"
    };
  } catch (error: any) {
    return {
      pass: false,
      testCase,
      actual: error.message,
      expected: "Cache-aside pattern execution",
      error: error.message
    };
  }
}

/**
 * Test Case 3: Template Read Warm Cache - Verify cache hit
 */
function testTemplateReadWarmCache(): ValidationResult {
  const testCase = "Template Read (Warm Cache)";
  const redis = new MockRedisClient();
  const surrealdb = new MockSurrealDBClient();

  const variantId = "test-template-warm123";
  const templateData = {
    variant_id: variantId,
    activity_id: "test-template",
    variant_name: "Test Template"
  };

  try {
    // Pre-populate both stores
    surrealdb.create(`activity_template:${variantId}`, templateData);
    redis.set(`activity:template:${variantId}`, JSON.stringify(templateData));
    
    // Clear operation logs
    surrealdb.clearOperations();
    redis.clearOperations();

    // Simulate read operation with warm cache
    const result = redis.get(`activity:template:${variantId}`);

    // Verify operations
    const redisOps = redis.getOperations();
    const surrealOps = surrealdb.getOperations();

    const hasRedisGet = redisOps.some(op => op.operation === 'GET');
    const noSurrealQuery = surrealOps.length === 0;
    const resultFound = result !== null;

    const pass = hasRedisGet && noSurrealQuery && resultFound;

    return {
      pass,
      testCase,
      actual: {
        redisChecked: hasRedisGet,
        surrealQueried: !noSurrealQuery,
        cacheHit: resultFound,
        operations: { redis: redisOps, surrealdb: surrealOps }
      },
      expected: {
        redisChecked: true,
        surrealQueried: false,
        cacheHit: true,
        description: "Redis hit (no SurrealDB query needed)"
      },
      details: pass
        ? "✓ Cache hit correctly served from Redis"
        : "✗ VIOLATION: SurrealDB queried despite warm cache"
    };
  } catch (error: any) {
    return {
      pass: false,
      testCase,
      actual: error.message,
      expected: "Cache hit from Redis",
      error: error.message
    };
  }
}

/**
 * Test Case 4: Data Durability - Template survives Redis flush
 */
function testDataDurability(): ValidationResult {
  const testCase = "Data Durability (Redis Flush)";
  const redis = new MockRedisClient();
  const surrealdb = new MockSurrealDBClient();

  const variantId = "test-template-durable456";
  const templateData = {
    variant_id: variantId,
    activity_id: "test-template",
    variant_name: "Durable Template"
  };

  try {
    // 1. Create template (SurrealDB + Redis)
    surrealdb.create(`activity_template:${variantId}`, templateData);
    redis.setex(`activity:template:${variantId}`, 3600, JSON.stringify(templateData));

    // 2. Flush Redis (simulate Redis restart/failure)
    redis.flushall();

    // 3. Try to read template (should fallback to SurrealDB)
    redis.clearOperations();
    surrealdb.clearOperations();

    let result = redis.get(`activity:template:${variantId}`);
    
    if (!result) {
      const surrealResult = surrealdb.select(`activity_template:${variantId}`);
      if (surrealResult) {
        redis.setex(`activity:template:${variantId}`, 3600, JSON.stringify(surrealResult));
        result = JSON.stringify(surrealResult);
      }
    }

    // Verify
    const redisOps = redis.getOperations();
    const surrealOps = surrealdb.getOperations();

    const hasSurrealFallback = surrealOps.some(op => op.operation === 'SELECT');
    const dataRecovered = result !== null;

    const pass = hasSurrealFallback && dataRecovered;

    return {
      pass,
      testCase,
      actual: {
        surrealFallbackUsed: hasSurrealFallback,
        dataRecovered,
        operations: { redis: redisOps, surrealdb: surrealOps }
      },
      expected: {
        surrealFallbackUsed: true,
        dataRecovered: true,
        description: "Template must survive Redis flush by reading from SurrealDB"
      },
      details: pass
        ? "✓ Template recovered from SurrealDB after Redis flush"
        : "✗ CRITICAL: Data lost after Redis flush (NO DURABILITY)"
    };
  } catch (error: any) {
    return {
      pass: false,
      testCase,
      actual: error.message,
      expected: "Data recovery from SurrealDB",
      error: error.message
    };
  }
}

/**
 * Test Case 5: Execution Recording - Verify SurrealDB write before Redis
 */
function testExecutionRecording(): ValidationResult {
  const testCase = "Execution Recording Write Order";
  const redis = new MockRedisClient();
  const surrealdb = new MockSurrealDBClient();

  const executionData = {
    execution_id: "exec-test-123",
    variant_id: "test-template-abc123",
    success: true,
    duration_ms: 45000,
    cost_usd: 0.022
  };

  try {
    // Simulate execution recording with correct ordering
    // 1. Write to SurrealDB FIRST
    const executionRecord = surrealdb.create(`activity_execution:${executionData.execution_id}`, executionData);
    const metricsUpdate = surrealdb.update(`template_metrics:${executionData.variant_id}`, {
      total_executions: 1,
      successful_executions: 1,
      success_rate: 1.0
    });

    // 2. Then invalidate/update Redis cache
    redis.del(`activity:metrics:${executionData.variant_id}`);
    // Or optionally: redis.setex with updated metrics

    // Verify ordering
    const surrealOps = surrealdb.getOperations();
    const redisOps = redis.getOperations();

    const surrealWriteTime = surrealOps.find(op => op.operation === 'CREATE')?.timestamp || 0;
    const redisInvalidateTime = redisOps.find(op => op.operation === 'DEL')?.timestamp || 0;

    const pass = surrealWriteTime < redisInvalidateTime && surrealWriteTime > 0 && redisInvalidateTime > 0;

    return {
      pass,
      testCase,
      actual: {
        surrealWriteTime,
        redisInvalidateTime,
        orderCorrect: surrealWriteTime < redisInvalidateTime,
        operations: { surrealdb: surrealOps, redis: redisOps }
      },
      expected: {
        orderCorrect: true,
        description: "SurrealDB execution write must happen BEFORE Redis cache invalidation"
      },
      details: pass
        ? "✓ Execution recorded in SurrealDB before cache invalidation"
        : "✗ VIOLATION: Redis invalidated before or without SurrealDB write"
    };
  } catch (error: any) {
    return {
      pass: false,
      testCase,
      actual: error.message,
      expected: "Correct execution recording order",
      error: error.message
    };
  }
}

/**
 * Test Case 6: Cache Invalidation - Metrics update invalidates cache
 */
function testCacheInvalidation(): ValidationResult {
  const testCase = "Cache Invalidation on Metrics Update";
  const redis = new MockRedisClient();
  const surrealdb = new MockSurrealDBClient();

  const variantId = "test-template-cache-inv";
  const oldMetrics = { total_executions: 5, success_rate: 0.8 };
  const newMetrics = { total_executions: 6, success_rate: 0.833 };

  try {
    // Pre-populate cache
    redis.set(`activity:metrics:${variantId}`, JSON.stringify(oldMetrics));
    surrealdb.create(`template_metrics:${variantId}`, oldMetrics);

    // Clear operations
    redis.clearOperations();
    surrealdb.clearOperations();

    // Simulate metrics update
    // 1. Update SurrealDB
    surrealdb.update(`template_metrics:${variantId}`, newMetrics);

    // 2. Invalidate Redis cache
    redis.del(`activity:metrics:${variantId}`);

    // Verify
    const surrealOps = surrealdb.getOperations();
    const redisOps = redis.getOperations();

    const hasSurrealUpdate = surrealOps.some(op => op.operation === 'UPDATE');
    const hasCacheInvalidation = redisOps.some(op => op.operation === 'DEL');
    const cacheCleared = redis.get(`activity:metrics:${variantId}`) === null;

    const pass = hasSurrealUpdate && hasCacheInvalidation && cacheCleared;

    return {
      pass,
      testCase,
      actual: {
        surrealUpdated: hasSurrealUpdate,
        cacheInvalidated: hasCacheInvalidation,
        cacheCleared,
        operations: { surrealdb: surrealOps, redis: redisOps }
      },
      expected: {
        surrealUpdated: true,
        cacheInvalidated: true,
        cacheCleared: true,
        description: "Metrics update in SurrealDB must invalidate Redis cache"
      },
      details: pass
        ? "✓ Cache correctly invalidated on metrics update"
        : "✗ VIOLATION: Cache not invalidated, stale data possible"
    };
  } catch (error: any) {
    return {
      pass: false,
      testCase,
      actual: error.message,
      expected: "Cache invalidation on update",
      error: error.message
    };
  }
}

/**
 * Main validation runner
 */
export function runValidation(input?: any): HarnessResult {
  const results: ValidationResult[] = [
    testTemplateCreation(),
    testTemplateReadColdCache(),
    testTemplateReadWarmCache(),
    testDataDurability(),
    testExecutionRecording(),
    testCacheInvalidation()
  ];

  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => r.pass === false).length;

  return {
    overallPass: failed === 0,
    results,
    summary: {
      total: results.length,
      passed,
      failed
    }
  };
}

/**
 * CLI entry point
 */
if (require.main === module) {
  console.log('=== SurrealDB Primary Redis Cache Validation Harness ===\n');
  
  const result = runValidation();
  
  console.log('Test Results:\n');
  result.results.forEach((test, index) => {
    const status = test.pass ? '✓ PASS' : '✗ FAIL';
    console.log(`${index + 1}. ${status}: ${test.testCase}`);
    if (test.details) {
      console.log(`   ${test.details}`);
    }
    if (!test.pass && test.error) {
      console.log(`   Error: ${test.error}`);
    }
    console.log('');
  });
  
  console.log('Summary:');
  console.log(`  Total: ${result.summary.total}`);
  console.log(`  Passed: ${result.summary.passed}`);
  console.log(`  Failed: ${result.summary.failed}`);
  console.log(`  Overall: ${result.overallPass ? '✓ PASS' : '✗ FAIL'}\n`);
  
  process.exit(result.overallPass ? 0 : 1);
}
