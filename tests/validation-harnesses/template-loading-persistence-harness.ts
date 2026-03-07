/**
 * Validation Harness: template-loading-persistence
 * 
 * Tests that activity templates persist in SurrealDB and are accessible
 * after Redis cache is cleared.
 * 
 * Validation Strategy:
 * 1. Create a test template (writes to SurrealDB + Redis cache)
 * 2. Verify template exists in both SurrealDB and Redis
 * 3. Clear Redis cache
 * 4. Query template via API (should load from SurrealDB)
 * 5. Verify template returned successfully
 * 6. Verify Redis cache repopulated
 * 
 * Expected Behavior:
 * - Template loads successfully after Redis clear
 * - No "Template not found" errors
 * - Cache automatically repopulates from SurrealDB
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as crypto from 'crypto';

const execAsync = promisify(exec);

interface ValidationResult {
  pass: boolean;
  actual: any;
  expected: any;
  details: string;
  errors?: string[];
}

interface TestInput {
  templateName: string;
  templateCategory: 'feature' | 'bugfix' | 'refactor' | 'tool' | 'infrastructure';
  rpcApiUrl?: string;
  kubectlContext?: string;
}

interface ExpectedOutput {
  templateCreated: boolean;
  existsInSurrealDB: boolean;
  existsInRedisBeforeClear: boolean;
  redisCleared: boolean;
  loadedAfterClear: boolean;
  existsInRedisAfterClear: boolean;
  cacheRepopulated: boolean;
}

/**
 * Main validation function
 */
export async function runValidation(input: TestInput): Promise<ValidationResult> {
  const errors: string[] = [];
  const actual: Partial<ExpectedOutput> = {};
  
  try {
    // Step 1: Create test template
    console.log('[1/7] Creating test template...');
    const templateData = generateTestTemplate(input.templateName, input.templateCategory);
    const createResult = await createTemplate(templateData, input.rpcApiUrl);
    actual.templateCreated = createResult.success;
    
    if (!createResult.success) {
      errors.push(`Failed to create template: ${createResult.error}`);
      return buildFailResult(actual, errors);
    }
    
    const variantId = createResult.variantId!;
    console.log(`✓ Template created: ${variantId}`);
    
    // Step 2: Verify template in SurrealDB
    console.log('[2/7] Verifying template in SurrealDB...');
    const surrealCheck1 = await checkTemplateInSurrealDB(variantId, input.kubectlContext);
    actual.existsInSurrealDB = surrealCheck1.exists;
    
    if (!surrealCheck1.exists) {
      errors.push('Template not found in SurrealDB after creation');
      return buildFailResult(actual, errors);
    }
    console.log('✓ Template exists in SurrealDB');
    
    // Step 3: Verify template in Redis cache
    console.log('[3/7] Verifying template in Redis cache...');
    const redisCheck1 = await checkTemplateInRedis(variantId, input.kubectlContext);
    actual.existsInRedisBeforeClear = redisCheck1.exists;
    
    if (!redisCheck1.exists) {
      errors.push('Template not found in Redis cache after creation');
      return buildFailResult(actual, errors);
    }
    console.log('✓ Template exists in Redis cache');
    
    // Step 4: Clear Redis cache
    console.log('[4/7] Clearing Redis cache...');
    const clearResult = await clearRedisCache(input.kubectlContext);
    actual.redisCleared = clearResult.success;
    
    if (!clearResult.success) {
      errors.push(`Failed to clear Redis cache: ${clearResult.error}`);
      return buildFailResult(actual, errors);
    }
    console.log('✓ Redis cache cleared');
    
    // Step 5: Load template via API (should trigger SurrealDB fallback)
    console.log('[5/7] Loading template after cache clear...');
    const loadResult = await loadTemplate(variantId, input.rpcApiUrl);
    actual.loadedAfterClear = loadResult.success;
    
    if (!loadResult.success) {
      errors.push(`Failed to load template after cache clear: ${loadResult.error}`);
      return buildFailResult(actual, errors);
    }
    console.log('✓ Template loaded successfully after cache clear');
    
    // Step 6: Verify Redis cache repopulated
    console.log('[6/7] Verifying cache repopulation...');
    const redisCheck2 = await checkTemplateInRedis(variantId, input.kubectlContext);
    actual.existsInRedisAfterClear = redisCheck2.exists;
    actual.cacheRepopulated = redisCheck2.exists;
    
    if (!redisCheck2.exists) {
      errors.push('Redis cache not repopulated after template load');
      return buildFailResult(actual, errors);
    }
    console.log('✓ Redis cache repopulated');
    
    // Step 7: Verify logs show cache miss → SurrealDB fallback
    console.log('[7/7] Verifying logs for cache miss pattern...');
    const logsCheck = await checkLogsForCacheMiss(variantId, input.kubectlContext);
    
    if (!logsCheck.found) {
      errors.push('Logs do not show cache miss → SurrealDB fallback pattern');
      // This is a warning, not a failure (logs might have rolled over)
      console.warn('⚠ Warning: Cache miss pattern not found in recent logs');
    } else {
      console.log('✓ Logs confirm cache miss → SurrealDB fallback');
    }
    
    // All checks passed
    const expected: ExpectedOutput = {
      templateCreated: true,
      existsInSurrealDB: true,
      existsInRedisBeforeClear: true,
      redisCleared: true,
      loadedAfterClear: true,
      existsInRedisAfterClear: true,
      cacheRepopulated: true,
    };
    
    return {
      pass: true,
      actual,
      expected,
      details: `✅ PASS: Template loading persistence validated successfully. Template persisted in SurrealDB and loaded after Redis clear.`,
    };
    
  } catch (error) {
    errors.push(`Unexpected error: ${error}`);
    return buildFailResult(actual, errors);
  }
}

/**
 * Generate test template data
 */
function generateTestTemplate(name: string, category: string) {
  const testId = crypto.randomBytes(4).toString('hex');
  return {
    name: `${name} ${testId}`,
    description: `Test template for validation harness (${testId})`,
    category,
    tasks: [
      {
        id: 'task-1',
        description: 'Test task for validation',
        prompt: {
          template: 'Echo: Validation test template',
          maxTokens: 1000,
        },
      },
    ],
  };
}

/**
 * Create template via RPC API
 */
async function createTemplate(
  templateData: any,
  rpcApiUrl?: string
): Promise<{ success: boolean; variantId?: string; error?: string }> {
  const url = rpcApiUrl || process.env.RPC_API_URL || 'http://localhost:8000';
  
  try {
    const response = await fetch(`${url}/v2/activities/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(templateData),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }
    
    const result = await response.json();
    return { success: true, variantId: result.variant_id || result.variantId };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Load template via RPC API
 */
async function loadTemplate(
  variantId: string,
  rpcApiUrl?: string
): Promise<{ success: boolean; template?: any; error?: string }> {
  const url = rpcApiUrl || process.env.RPC_API_URL || 'http://localhost:8000';
  
  try {
    const response = await fetch(`${url}/v2/activities/templates/${variantId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }
    
    const template = await response.json();
    return { success: true, template };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Check if template exists in SurrealDB
 */
async function checkTemplateInSurrealDB(
  variantId: string,
  kubectlContext?: string
): Promise<{ exists: boolean; error?: string }> {
  try {
    const contextFlag = kubectlContext ? `--context ${kubectlContext}` : '';
    const query = `SELECT * FROM activity_template WHERE variant_id = '${variantId}'`;
    
    const cmd = `kubectl ${contextFlag} exec -i deployment/surreal -- surreal sql \
      --conn http://localhost:8000 \
      --user root --pass root \
      --ns test --db test \
      "${query}"`;
    
    const { stdout } = await execAsync(cmd);
    
    // Parse SurrealDB response (JSON format)
    const response = JSON.parse(stdout);
    const exists = response && response.length > 0;
    
    return { exists };
  } catch (error) {
    return { exists: false, error: String(error) };
  }
}

/**
 * Check if template exists in Redis cache
 */
async function checkTemplateInRedis(
  variantId: string,
  kubectlContext?: string
): Promise<{ exists: boolean; error?: string }> {
  try {
    const contextFlag = kubectlContext ? `--context ${kubectlContext}` : '';
    const key = `activity:template:${variantId}`;
    
    const cmd = `kubectl ${contextFlag} exec -i deployment/redis -- redis-cli EXISTS "${key}"`;
    
    const { stdout } = await execAsync(cmd);
    const exists = stdout.trim() === '1';
    
    return { exists };
  } catch (error) {
    return { exists: false, error: String(error) };
  }
}

/**
 * Clear Redis cache
 */
async function clearRedisCache(
  kubectlContext?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const contextFlag = kubectlContext ? `--context ${kubectlContext}` : '';
    const cmd = `kubectl ${contextFlag} exec -i deployment/redis -- redis-cli FLUSHDB`;
    
    await execAsync(cmd);
    
    // Verify cache is empty
    const verifyCmdResult = await execAsync(
      `kubectl ${contextFlag} exec -i deployment/redis -- redis-cli DBSIZE`
    );
    const dbSize = parseInt(verifyCmdResult.stdout.trim(), 10);
    
    if (dbSize !== 0) {
      return { success: false, error: `Redis cache not empty after FLUSHDB (size: ${dbSize})` };
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Check logs for cache miss pattern
 */
async function checkLogsForCacheMiss(
  variantId: string,
  kubectlContext?: string
): Promise<{ found: boolean; logs?: string }> {
  try {
    const contextFlag = kubectlContext ? `--context ${kubectlContext}` : '';
    const cmd = `kubectl ${contextFlag} logs -l app=rpc-api --tail=100 | grep -E "(Template cache miss|loading from SurrealDB|${variantId})"`;
    
    const { stdout } = await execAsync(cmd);
    
    const found = stdout.includes('Template cache miss') || stdout.includes('loading from SurrealDB');
    
    return { found, logs: stdout };
  } catch (error) {
    // grep returns exit code 1 if no matches found
    return { found: false };
  }
}

/**
 * Build failure result
 */
function buildFailResult(actual: any, errors: string[]): ValidationResult {
  const expected: ExpectedOutput = {
    templateCreated: true,
    existsInSurrealDB: true,
    existsInRedisBeforeClear: true,
    redisCleared: true,
    loadedAfterClear: true,
    existsInRedisAfterClear: true,
    cacheRepopulated: true,
  };
  
  return {
    pass: false,
    actual,
    expected,
    details: `❌ FAIL: Template loading persistence validation failed`,
    errors,
  };
}

/**
 * CLI entry point
 */
if (require.main === module) {
  const input: TestInput = {
    templateName: process.env.TEMPLATE_NAME || 'Test Template Persistence',
    templateCategory: (process.env.TEMPLATE_CATEGORY as any) || 'feature',
    rpcApiUrl: process.env.RPC_API_URL,
    kubectlContext: process.env.KUBECTL_CONTEXT,
  };
  
  runValidation(input)
    .then((result) => {
      console.log('\n' + '='.repeat(80));
      console.log('VALIDATION RESULT');
      console.log('='.repeat(80));
      console.log(result.details);
      
      if (result.errors && result.errors.length > 0) {
        console.log('\nErrors:');
        result.errors.forEach((err) => console.log(`  - ${err}`));
      }
      
      console.log('\nActual Output:');
      console.log(JSON.stringify(result.actual, null, 2));
      
      console.log('\nExpected Output:');
      console.log(JSON.stringify(result.expected, null, 2));
      
      console.log('='.repeat(80));
      
      process.exit(result.pass ? 0 : 1);
    })
    .catch((error) => {
      console.error('Validation harness error:', error);
      process.exit(1);
    });
}
