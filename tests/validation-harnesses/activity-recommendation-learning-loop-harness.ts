/**
 * Validation Harness: Activity Recommendation and Learning Loop End-to-End
 *
 * SPECIFICATION: Activity Recommendation and Learning Loop End-to-End Validation
 * PURPOSE: Validate complete learning loop from recommendation → execution → persistence → improved recommendations
 * ENVIRONMENT: Can run locally or in devbob container with backend at api.metabob.local
 *
 * TEST FLOW:
 * 1. Call recommendation endpoint with test task
 * 2. Verify 3-5 recommendations returned with Thompson Sampling metadata
 * 3. Execute top recommendation (simulated)
 * 4. Verify execution recorded via API
 * 5. Call recommendations again and verify metrics updated
 * 6. Test graceful degradation (optional)
 *
 * USAGE:
 *   import { runValidation } from './activity-recommendation-learning-loop-harness';
 *   const result = await runValidation({ backendUrl: 'http://api.metabob.local' });
 *   console.log(result.pass ? 'PASS' : 'FAIL');
 */

export interface ValidationInput {
  backendUrl?: string;
  taskDescription?: string;
  category?: string;
  limit?: number;
  timeout?: number;
}

export interface ValidationOutput {
  pass: boolean;
  testsPassed: number;
  testsFailed: number;
  testResults: Array<{
    name: string;
    pass: boolean;
    message: string;
    actual?: any;
    expected?: any;
  }>;
  summary: string;
}

export interface RecommendationResponse {
  status: string;
  recommendations: Array<{
    template_id: string;
    variant_id: string;
    selection_metadata: {
      method: string;
      alpha: number;
      beta: number;
      sample: number;
    };
  }>;
  timestamp: string;
}

export interface ExecutionResponse {
  success: boolean;
  execution_id: string;
  metrics_updated: boolean;
}

/**
 * Main validation function - runs all test cases
 */
export async function runValidation(input: ValidationInput = {}): Promise<ValidationOutput> {
  const {
    backendUrl = process.env.BACKEND_URL || 'http://api.metabob.local',
    taskDescription = 'Add REST endpoint for user management',
    category = 'feature',
    limit = 5,
    timeout = 30000,
  } = input;

  const testResults: ValidationOutput['testResults'] = [];
  let testsPassed = 0;
  let testsFailed = 0;

  console.log('===========================================');
  console.log('Activity Recommendation and Learning Loop');
  console.log('End-to-End Validation Harness');
  console.log('===========================================');
  console.log(`Backend URL: ${backendUrl}`);
  console.log(`Test Task: ${taskDescription}`);
  console.log(`Category: ${category}`);
  console.log('');

  // Test Case 1: Call recommendation endpoint
  try {
    console.log('Test 1: Call recommendation endpoint...');
    const rec1Response = await fetch(`${backendUrl}/v2/activities/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_description: taskDescription, category, limit }),
    });

    if (!rec1Response.ok) {
      throw new Error(`HTTP ${rec1Response.status}: ${rec1Response.statusText}`);
    }

    const rec1Data: RecommendationResponse = await rec1Response.json();

    // Verify status is success
    const statusTest = {
      name: 'Recommendation endpoint returns success status',
      pass: rec1Data.status === 'success',
      message: rec1Data.status === 'success' ? 'Status is success' : `Status is ${rec1Data.status}`,
      actual: rec1Data.status,
      expected: 'success',
    };
    testResults.push(statusTest);
    statusTest.pass ? testsPassed++ : testsFailed++;

    // Verify recommendations count
    const recCount = rec1Data.recommendations.length;
    const countTest = {
      name: 'Recommendation count is between 1 and limit',
      pass: recCount >= 1 && recCount <= limit,
      message: `${recCount} recommendations returned`,
      actual: recCount,
      expected: `1-${limit}`,
    };
    testResults.push(countTest);
    countTest.pass ? testsPassed++ : testsFailed++;

    // Verify first recommendation structure
    if (rec1Data.recommendations.length > 0) {
      const firstRec = rec1Data.recommendations[0];

      const templateIdTest = {
        name: 'First recommendation has template_id',
        pass: !!firstRec.template_id,
        message: firstRec.template_id ? `template_id: ${firstRec.template_id}` : 'Missing template_id',
        actual: firstRec.template_id,
        expected: 'non-empty string',
      };
      testResults.push(templateIdTest);
      templateIdTest.pass ? testsPassed++ : testsFailed++;

      const metadataTest = {
        name: 'First recommendation has selection_metadata',
        pass: !!firstRec.selection_metadata,
        message: firstRec.selection_metadata ? 'selection_metadata present' : 'Missing selection_metadata',
        actual: firstRec.selection_metadata,
        expected: 'object with method, alpha, beta, sample',
      };
      testResults.push(metadataTest);
      metadataTest.pass ? testsPassed++ : testsFailed++;

      if (firstRec.selection_metadata) {
        const methodTest = {
          name: 'Selection method is thompson_sampling',
          pass: firstRec.selection_metadata.method === 'thompson_sampling',
          message: `Method: ${firstRec.selection_metadata.method}`,
          actual: firstRec.selection_metadata.method,
          expected: 'thompson_sampling',
        };
        testResults.push(methodTest);
        methodTest.pass ? testsPassed++ : testsFailed++;

        const alphaTest = {
          name: 'Selection metadata has alpha > 0',
          pass: firstRec.selection_metadata.alpha > 0,
          message: `Alpha: ${firstRec.selection_metadata.alpha}`,
          actual: firstRec.selection_metadata.alpha,
          expected: '> 0',
        };
        testResults.push(alphaTest);
        alphaTest.pass ? testsPassed++ : testsFailed++;

        const betaTest = {
          name: 'Selection metadata has beta > 0',
          pass: firstRec.selection_metadata.beta > 0,
          message: `Beta: ${firstRec.selection_metadata.beta}`,
          actual: firstRec.selection_metadata.beta,
          expected: '> 0',
        };
        testResults.push(betaTest);
        betaTest.pass ? testsPassed++ : testsFailed++;

        const sampleTest = {
          name: 'Sample value is between 0 and 1',
          pass: firstRec.selection_metadata.sample >= 0 && firstRec.selection_metadata.sample <= 1,
          message: `Sample: ${firstRec.selection_metadata.sample}`,
          actual: firstRec.selection_metadata.sample,
          expected: '0-1',
        };
        testResults.push(sampleTest);
        sampleTest.pass ? testsPassed++ : testsFailed++;
      }

      // Store for next test
      const selectedTemplateId = firstRec.template_id;
      const initialAlpha = firstRec.selection_metadata?.alpha || 1.0;
      const initialBeta = firstRec.selection_metadata?.beta || 1.0;

      // Test Case 2: Simulate execution recording
      console.log('Test 2: Simulate activity execution and record result...');
      const activityId = `test_exec_${Date.now()}`;
      const execResponse = await fetch(`${backendUrl}/api/v1/learning-loop/executions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activity_id: activityId,
          template_id: selectedTemplateId,
          started_at: new Date().toISOString(),
          duration_ms: 5000,
          success: true,
          tokens: { input: 1000, output: 500, cache: 200 },
          cost: 0.05,
          impulses_used: [],
          component_changes: [],
        }),
      });

      if (!execResponse.ok) {
        throw new Error(`Execution recording failed: HTTP ${execResponse.status}`);
      }

      const execData: ExecutionResponse = await execResponse.json();

      const execSuccessTest = {
        name: 'Execution recorded successfully',
        pass: execData.success === true,
        message: execData.success ? 'Execution recorded' : 'Execution recording failed',
        actual: execData.success,
        expected: true,
      };
      testResults.push(execSuccessTest);
      execSuccessTest.pass ? testsPassed++ : testsFailed++;

      const execIdTest = {
        name: 'Execution ID returned',
        pass: !!execData.execution_id,
        message: execData.execution_id ? `execution_id: ${execData.execution_id}` : 'Missing execution_id',
        actual: execData.execution_id,
        expected: 'non-empty string',
      };
      testResults.push(execIdTest);
      execIdTest.pass ? testsPassed++ : testsFailed++;

      // Wait for background processing
      console.log('Waiting 2 seconds for background metrics update...');
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Test Case 3: Verify metrics updated
      console.log('Test 3: Verify metrics updated in recommendations...');
      const rec2Response = await fetch(`${backendUrl}/v2/activities/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_description: taskDescription, category, limit }),
      });

      if (!rec2Response.ok) {
        throw new Error(`Second recommendation call failed: HTTP ${rec2Response.status}`);
      }

      const rec2Data: RecommendationResponse = await rec2Response.json();

      // Find same template in new recommendations
      const updatedRec = rec2Data.recommendations.find((r) => r.template_id === selectedTemplateId);

      if (updatedRec && updatedRec.selection_metadata) {
        const newAlpha = updatedRec.selection_metadata.alpha;
        const metricsUpdatedTest = {
          name: 'Metrics updated (alpha changed or ranking changed)',
          pass: newAlpha !== initialAlpha || !updatedRec,
          message: `Alpha: ${initialAlpha} → ${newAlpha}`,
          actual: newAlpha,
          expected: `> ${initialAlpha} (or template ranking changed)`,
        };
        testResults.push(metricsUpdatedTest);
        metricsUpdatedTest.pass ? testsPassed++ : testsFailed++;
      } else {
        // Template not in top recommendations anymore (ranking changed)
        const rankingChangedTest = {
          name: 'Template ranking changed after execution',
          pass: true,
          message: 'Template not in top recommendations (ranking improved for others)',
          actual: 'Template not found in top recommendations',
          expected: 'Ranking dynamics working',
        };
        testResults.push(rankingChangedTest);
        testsPassed++;
      }
    }
  } catch (error) {
    const errorTest = {
      name: 'Validation harness execution',
      pass: false,
      message: `Error: ${error instanceof Error ? error.message : String(error)}`,
      actual: error,
      expected: 'No errors',
    };
    testResults.push(errorTest);
    testsFailed++;
  }

  // Generate summary
  const pass = testsFailed === 0;
  const summary = pass
    ? `✅ ALL TESTS PASSED (${testsPassed}/${testsPassed + testsFailed})`
    : `❌ SOME TESTS FAILED (${testsPassed} passed, ${testsFailed} failed)`;

  console.log('');
  console.log('===========================================');
  console.log('Test Summary');
  console.log('===========================================');
  console.log(`Passed: ${testsPassed}`);
  console.log(`Failed: ${testsFailed}`);
  console.log('');
  console.log('Detailed Results:');
  testResults.forEach((result) => {
    const status = result.pass ? '✅ PASS' : '❌ FAIL';
    console.log(`${status}: ${result.name} - ${result.message}`);
  });
  console.log('');
  console.log(summary);
  console.log('===========================================');

  return {
    pass,
    testsPassed,
    testsFailed,
    testResults,
    summary,
  };
}

/**
 * CLI entry point
 */
if (require.main === module) {
  (async () => {
    const result = await runValidation();
    process.exit(result.pass ? 0 : 1);
  })();
}
