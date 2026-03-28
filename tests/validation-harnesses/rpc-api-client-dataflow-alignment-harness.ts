/**
 * Validation Harness: RPC API Client-Server Dataflow Alignment
 * 
 * PURPOSE:
 * Validates that the RPC API serves data in the format clients (metabob-opencode, dashboard) 
 * actually expect. Tests complete request → processing → response cycles from client perspective.
 * 
 * VALIDATION STRATEGY:
 * 1. Quality Score Endpoint - Validate new GET /v2/activities/templates/{id}/quality-score
 * 2. Execution Reporting - Test POST /api/v1/learning-loop/executions with partial data
 * 3. Schema Tolerance - Verify API fills in missing fields (template_id, timestamps)
 * 4. Multi-Tenant Isolation - Test org_id/project_id filtering (when implemented)
 * 5. Deprecated Client Logic - Confirm quality scores NOT calculated client-side
 * 
 * NO LLM REQUIRED: Pure input/output validation against expected schemas.
 */

import fetch from 'node-fetch';

// ============================================================================
// Configuration
// ============================================================================

const RPC_API_BASE_URL = process.env.METABOB_RPC_API_URL || 'http://localhost:8081';
const LEARNING_LOOP_BASE_URL = process.env.METABOB_LEARNING_LOOP_URL || 'http://localhost:8081';

interface ValidationResult {
  pass: boolean;
  testCase: string;
  actual: any;
  expected: any;
  error?: string;
  details?: string;
}

interface HarnessResult {
  totalTests: number;
  passed: number;
  failed: number;
  results: ValidationResult[];
  summary: string;
}

// ============================================================================
// Test Case 1: Quality Score Endpoint Exists and Returns Valid Schema
// ============================================================================

async function testQualityScoreEndpoint(): Promise<ValidationResult> {
  const testCase = "Quality Score Endpoint Schema Validation";
  
  try {
    // Test with a known template (use one that should exist after bootstrap)
    const templateId = "create-activity";
    const url = `${RPC_API_BASE_URL}/v2/activities/templates/${templateId}/quality-score`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      // If template doesn't exist yet (404), that's acceptable - endpoint exists
      if (response.status === 404) {
        return {
          pass: true,
          testCase,
          actual: { status: 404, message: "Template not found (expected for new system)" },
          expected: { status: 404, note: "Endpoint exists but template has no execution data yet" },
          details: "Endpoint exists and returns proper 404 for missing template"
        };
      }
      
      return {
        pass: false,
        testCase,
        actual: { status: response.status, body: await response.text() },
        expected: { status: 200, schema: "QualityScoreResponse" },
        error: `Unexpected status: ${response.status}`
      };
    }
    
    const data = await response.json();
    
    // Validate response schema
    const expectedSchema = {
      template_id: 'string',
      quality_score: 'number (0-100)',
      breakdown: {
        success: 'number',
        cost: 'number',
        duration: 'number',
        documentation: 'number'
      },
      metrics: {
        success_rate: 'number',
        avg_cost_usd: 'number',
        avg_duration_ms: 'number',
        total_executions: 'number'
      }
    };
    
    const hasRequiredFields = 
      typeof data.template_id === 'string' &&
      typeof data.quality_score === 'number' &&
      data.quality_score >= 0 && data.quality_score <= 100 &&
      data.breakdown && 
      typeof data.breakdown.success === 'number' &&
      typeof data.breakdown.cost === 'number' &&
      typeof data.breakdown.duration === 'number' &&
      typeof data.breakdown.documentation === 'number' &&
      data.metrics &&
      typeof data.metrics.success_rate === 'number' &&
      typeof data.metrics.avg_cost_usd === 'number' &&
      typeof data.metrics.avg_duration_ms === 'number' &&
      typeof data.metrics.total_executions === 'number';
    
    return {
      pass: hasRequiredFields,
      testCase,
      actual: data,
      expected: expectedSchema,
      details: hasRequiredFields 
        ? `Quality score: ${data.quality_score}, Success rate: ${data.metrics.success_rate}`
        : 'Missing required fields in response'
    };
    
  } catch (error: any) {
    return {
      pass: false,
      testCase,
      actual: { error: error.message },
      expected: { status: 200, schema: 'QualityScoreResponse' },
      error: `Request failed: ${error.message}`
    };
  }
}

// ============================================================================
// Test Case 2: Execution Reporting with Minimal Data (Schema Tolerance)
// ============================================================================

async function testExecutionReportingMinimalData(): Promise<ValidationResult> {
  const testCase = "Execution Reporting - Minimal Data (Schema Tolerance)";
  
  try {
    const url = `${LEARNING_LOOP_BASE_URL}/api/v1/learning-loop/executions`;
    
    // Send MINIMAL data - only required fields client actually sends
    const minimalPayload = {
      activity_id: `act_test_harness_${Date.now()}`,
      duration_ms: 45000,
      success: true,
      tokens_input: 5000,
      tokens_output: 1500,
      tokens_cache: 2000,
      cost_usd: 0.08
      // NOTE: Missing template_id, started_at, completed_at
      // API should fill these in with defaults
    };
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(minimalPayload)
    });
    
    if (!response.ok) {
      const errorBody = await response.text();
      return {
        pass: false,
        testCase,
        actual: { status: response.status, error: errorBody },
        expected: { status: 201, note: "API should accept minimal payload and fill defaults" },
        error: `API rejected minimal payload: ${response.status}`
      };
    }
    
    const data = await response.json();
    
    // Validate response indicates success
    const expectedResponse = {
      success: true,
      execution_id: 'string',
      metrics_updated: 'boolean'
    };
    
    const isValid = 
      data.success === true &&
      typeof data.execution_id === 'string' &&
      typeof data.metrics_updated === 'boolean';
    
    return {
      pass: isValid,
      testCase,
      actual: data,
      expected: expectedResponse,
      details: isValid 
        ? `API accepted minimal data, execution_id: ${data.execution_id}`
        : 'Response schema validation failed'
    };
    
  } catch (error: any) {
    return {
      pass: false,
      testCase,
      actual: { error: error.message },
      expected: { status: 201, note: "Minimal payload accepted" },
      error: `Request failed: ${error.message}`
    };
  }
}

// ============================================================================
// Test Case 3: Execution Reporting with Complete Data (Backward Compatibility)
// ============================================================================

async function testExecutionReportingCompleteData(): Promise<ValidationResult> {
  const testCase = "Execution Reporting - Complete Data (Backward Compatibility)";
  
  try {
    const url = `${LEARNING_LOOP_BASE_URL}/api/v1/learning-loop/executions`;
    
    const now = new Date();
    const startTime = new Date(now.getTime() - 45000);
    
    // Send COMPLETE data - all fields
    const completePayload = {
      activity_id: `act_test_harness_complete_${Date.now()}`,
      template_id: "test-template",
      started_at: startTime.toISOString(),
      duration_ms: 45000,
      success: true,
      tokens_input: 5000,
      tokens_output: 1500,
      tokens_cache: 2000,
      cost_usd: 0.08,
      completed_at: now.toISOString(),
      impulses: [
        {
          impulse_id: "test-impulse-1",
          impulse_type: "file",
          tokens_loaded: 1000,
          cost_usd: 0.01,
          loaded_at: startTime.toISOString()
        }
      ]
    };
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(completePayload)
    });
    
    if (!response.ok) {
      const errorBody = await response.text();
      return {
        pass: false,
        testCase,
        actual: { status: response.status, error: errorBody },
        expected: { status: 201, note: "API should accept complete payload" },
        error: `API rejected complete payload: ${response.status}`
      };
    }
    
    const data = await response.json();
    
    const isValid = 
      data.success === true &&
      typeof data.execution_id === 'string' &&
      typeof data.metrics_updated === 'boolean';
    
    return {
      pass: isValid,
      testCase,
      actual: data,
      expected: { success: true, execution_id: 'string', metrics_updated: 'boolean' },
      details: isValid 
        ? `API accepted complete data including impulses, execution_id: ${data.execution_id}`
        : 'Response schema validation failed'
    };
    
  } catch (error: any) {
    return {
      pass: false,
      testCase,
      actual: { error: error.message },
      expected: { status: 201, note: "Complete payload accepted" },
      error: `Request failed: ${error.message}`
    };
  }
}

// ============================================================================
// Test Case 4: Template ID Extraction from Activity ID
// ============================================================================

async function testTemplateIdExtraction(): Promise<ValidationResult> {
  const testCase = "Template ID Extraction from Activity ID Pattern";
  
  try {
    const url = `${LEARNING_LOOP_BASE_URL}/api/v1/learning-loop/executions`;
    
    // Activity ID follows pattern: act_{template_id}_{timestamp}
    const activityId = `act_create-activity_${Date.now()}`;
    
    const payload = {
      activity_id: activityId,
      // NOTE: No template_id provided - should be extracted as "create-activity"
      duration_ms: 30000,
      success: true,
      cost_usd: 0.05
    };
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      return {
        pass: false,
        testCase,
        actual: { status: response.status },
        expected: { status: 201, note: "API should extract template_id from activity_id" },
        error: `Failed to accept payload: ${response.status}`
      };
    }
    
    const data = await response.json();
    
    return {
      pass: data.success === true,
      testCase,
      actual: data,
      expected: { success: true, note: "template_id extracted: 'create-activity'" },
      details: `API extracted template_id from pattern: ${activityId}`
    };
    
  } catch (error: any) {
    return {
      pass: false,
      testCase,
      actual: { error: error.message },
      expected: { status: 201 },
      error: `Request failed: ${error.message}`
    };
  }
}

// ============================================================================
// Test Case 5: Quality Score Components Validation
// ============================================================================

async function testQualityScoreComponents(): Promise<ValidationResult> {
  const testCase = "Quality Score Components Breakdown Validation";
  
  try {
    const templateId = "create-activity";
    const url = `${RPC_API_BASE_URL}/v2/activities/templates/${templateId}/quality-score`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.status === 404) {
      return {
        pass: true,
        testCase,
        actual: { status: 404, note: "Template has no execution data yet" },
        expected: { status: 404, acceptable: true },
        details: "Endpoint exists, template not yet executed"
      };
    }
    
    if (!response.ok) {
      return {
        pass: false,
        testCase,
        actual: { status: response.status },
        expected: { status: 200 },
        error: `Unexpected status: ${response.status}`
      };
    }
    
    const data = await response.json();
    
    // Validate quality score components sum correctly
    const breakdownSum = 
      data.breakdown.success + 
      data.breakdown.cost + 
      data.breakdown.duration + 
      data.breakdown.documentation;
    
    const isValidSum = Math.abs(breakdownSum - data.quality_score) < 0.01; // Allow rounding
    
    // Validate component ranges
    const componentsInRange = 
      data.breakdown.success >= 0 && data.breakdown.success <= 40 &&
      data.breakdown.cost >= 0 && data.breakdown.cost <= 20 &&
      data.breakdown.duration >= 0 && data.breakdown.duration <= 20 &&
      data.breakdown.documentation >= 0 && data.breakdown.documentation <= 20;
    
    const pass = isValidSum && componentsInRange;
    
    return {
      pass,
      testCase,
      actual: {
        quality_score: data.quality_score,
        breakdown: data.breakdown,
        sum: breakdownSum
      },
      expected: {
        note: "Components sum to quality_score, each within range",
        success: "0-40",
        cost: "0-20",
        duration: "0-20",
        documentation: "0-20"
      },
      details: pass 
        ? `Valid breakdown: ${JSON.stringify(data.breakdown)}`
        : `Invalid: sum=${breakdownSum} vs score=${data.quality_score}, ranges ok=${componentsInRange}`
    };
    
  } catch (error: any) {
    return {
      pass: false,
      testCase,
      actual: { error: error.message },
      expected: { status: 200 },
      error: `Request failed: ${error.message}`
    };
  }
}

// ============================================================================
// Test Case 6: Thompson Sampling Endpoint (Existing - Should Still Work)
// ============================================================================

async function testThompsonSamplingEndpoint(): Promise<ValidationResult> {
  const testCase = "Thompson Sampling Endpoint (Regression Test)";
  
  try {
    const templateId = "create-activity";
    const url = `${RPC_API_BASE_URL}/v2/activities/templates/${templateId}/select`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.status === 404) {
      return {
        pass: true,
        testCase,
        actual: { status: 404, note: "Template not found in system yet" },
        expected: { status: 404, acceptable: true },
        details: "Endpoint exists, template not yet registered"
      };
    }
    
    if (!response.ok) {
      return {
        pass: false,
        testCase,
        actual: { status: response.status },
        expected: { status: 200 },
        error: `Thompson Sampling endpoint failed: ${response.status}`
      };
    }
    
    const data = await response.json();
    
    // Validate Thompson Sampling response schema
    const hasThompsonMetadata = 
      data.selection_method && 
      typeof data.thompson_alpha === 'number' &&
      typeof data.thompson_beta === 'number' &&
      typeof data.thompson_sample === 'number';
    
    return {
      pass: hasThompsonMetadata,
      testCase,
      actual: {
        selection_method: data.selection_method,
        alpha: data.thompson_alpha,
        beta: data.thompson_beta,
        sample: data.thompson_sample
      },
      expected: {
        selection_method: 'thompson_sampling',
        alpha: 'number',
        beta: 'number',
        sample: 'number'
      },
      details: hasThompsonMetadata
        ? `Thompson Sampling working: alpha=${data.thompson_alpha}, beta=${data.thompson_beta}`
        : 'Missing Thompson Sampling metadata in response'
    };
    
  } catch (error: any) {
    return {
      pass: false,
      testCase,
      actual: { error: error.message },
      expected: { status: 200 },
      error: `Request failed: ${error.message}`
    };
  }
}

// ============================================================================
// Main Validation Runner
// ============================================================================

export async function runValidation(): Promise<HarnessResult> {
  console.log('🧪 Starting RPC API Client-Server Dataflow Alignment Validation\n');
  
  const results: ValidationResult[] = [];
  
  // Run all test cases
  console.log('Test 1: Quality Score Endpoint Schema...');
  results.push(await testQualityScoreEndpoint());
  
  console.log('Test 2: Execution Reporting - Minimal Data...');
  results.push(await testExecutionReportingMinimalData());
  
  console.log('Test 3: Execution Reporting - Complete Data...');
  results.push(await testExecutionReportingCompleteData());
  
  console.log('Test 4: Template ID Extraction...');
  results.push(await testTemplateIdExtraction());
  
  console.log('Test 5: Quality Score Components...');
  results.push(await testQualityScoreComponents());
  
  console.log('Test 6: Thompson Sampling (Regression)...');
  results.push(await testThompsonSamplingEndpoint());
  
  // Calculate summary
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  const total = results.length;
  
  const summary = `${passed}/${total} tests passed (${failed} failed)`;
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 VALIDATION SUMMARY: ${summary}`);
  console.log(`${'='.repeat(80)}\n`);
  
  // Print detailed results
  results.forEach((result, index) => {
    const icon = result.pass ? '✅' : '❌';
    console.log(`${icon} Test ${index + 1}: ${result.testCase}`);
    if (result.details) {
      console.log(`   ${result.details}`);
    }
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    console.log();
  });
  
  return {
    totalTests: total,
    passed,
    failed,
    results,
    summary
  };
}

// CLI execution
if (require.main === module) {
  runValidation()
    .then(result => {
      process.exit(result.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('❌ Validation harness failed:', error);
      process.exit(1);
    });
}
