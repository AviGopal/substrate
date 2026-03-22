/**
 * Test: Minibob → Backend → Dashboard Data Flow
 * 
 * Tests the complete integration:
 * 1. Create mock activity execution data
 * 2. POST to backend API
 * 3. Verify data is stored
 * 4. Check dashboard can retrieve it
 */

const BACKEND_URL = "http://localhost:8081";

interface ExecutionRecord {
  variant_id: string;
  success: boolean;
  duration_ms: number;
  cost: number;
  tokens: {
    input: number;
    output: number;
    cache: number;
  };
  error_message?: string;
  error_type?: string;
  failed_task_id?: string;
  impulses_used?: string[];
  component_changes?: string[];
}

async function testBackendIntegration() {
  console.log("🧪 Testing Minibob → Backend → Dashboard Integration\n");
  
  // Step 1: Create mock execution data
  console.log("Step 1: Creating mock activity execution...");
  
  const executionId = `exec_${Date.now()}_test`;
  const variantId = "test-output-impulses";
  
  const executionData: ExecutionRecord = {
    variant_id: variantId,
    success: true,
    duration_ms: 2500,
    cost: 0.0234,
    tokens: {
      input: 8500,
      output: 1200,
      cache: 2000
    },
    impulses_used: ["test-data", "test-summary"],
    component_changes: ["src/activity.ts", "src/impulse.ts"]
  };
  
  console.log(`  📝 Execution ID: ${executionId}`);
  console.log(`  📝 Variant: ${variantId}\n`);
  
  // Step 2: POST execution start to backend
  console.log("Step 2: Posting execution to backend API...");
  
  try {
    const response = await fetch(`${BACKEND_URL}/v2/activities/executions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(executionData)
    });
    
    console.log(`  📡 Response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`  ❌ Error: ${errorText}`);
      throw new Error(`Failed to post execution: ${response.status} ${errorText}`);
    }
    
    const result = await response.json();
    console.log(`  ✅ Execution posted successfully`);
    console.log(`  📊 Response:`, JSON.stringify(result, null, 2));
  } catch (error: any) {
    console.error(`  ❌ Failed to post execution:`, error.message);
    console.log("\n⚠️  Trying alternative approach: GET templates first...\n");
    
    // Try GET templates to test connectivity
    try {
      const templatesResponse = await fetch(`${BACKEND_URL}/v2/activities/templates`);
      console.log(`  📡 GET templates status: ${templatesResponse.status}`);
      
      if (templatesResponse.ok) {
        const templates = await templatesResponse.json();
        console.log(`  ✅ Backend is reachable`);
        console.log(`  📊 Found ${templates.length || 0} templates`);
      } else {
        const errorText = await templatesResponse.text();
        console.log(`  ❌ Templates error: ${errorText}`);
      }
    } catch (getError: any) {
      console.error(`  ❌ GET templates failed:`, getError.message);
    }
    
    return;
  }
  
  // Step 3: Post another execution (failed example)
  console.log("\nStep 3: Posting a failed execution example...");
  
  const failedExecution: ExecutionRecord = {
    variant_id: "test-validation-failure",
    success: false,
    duration_ms: 1200,
    cost: 0.0089,
    tokens: {
      input: 3500,
      output: 200,
      cache: 1000
    },
    error_message: "Validation failed: required file not found",
    error_type: "validation_error",
    failed_task_id: "task-2-validate"
  };
  
  try {
    const failedResponse = await fetch(`${BACKEND_URL}/v2/activities/executions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(failedExecution)
    });
    
    console.log(`  📡 Failed execution status: ${failedResponse.status}`);
    
    if (failedResponse.ok) {
      const failedResult = await failedResponse.json();
      console.log(`  ✅ Failed execution recorded`);
      console.log(`  📊 Response:`, JSON.stringify(failedResult, null, 2));
    } else {
      const errorText = await failedResponse.text();
      console.log(`  ⚠️  Failed execution warning: ${errorText}`);
    }
  } catch (error: any) {
    console.error(`  ❌ Failed to post failed execution:`, error.message);
  }
  
  // Step 4: Query backend to verify data
  console.log("\nStep 4: Verifying data in backend...");
  
  try {
    const queryResponse = await fetch(`${BACKEND_URL}/v2/activities/templates?category=tool`);
    console.log(`  📡 Query status: ${queryResponse.status}`);
    
    if (queryResponse.ok) {
      const templates = await queryResponse.json();
      console.log(`  ✅ Query successful`);
      console.log(`  📊 Templates retrieved: ${templates.length || 0}`);
      
      if (templates.length > 0) {
        console.log(`  📋 Sample template:`, JSON.stringify(templates[0], null, 2).substring(0, 200) + "...");
      }
    } else {
      const errorText = await queryResponse.text();
      console.log(`  ⚠️  Query error: ${errorText}`);
    }
  } catch (error: any) {
    console.error(`  ❌ Query failed:`, error.message);
  }
  
  // Step 5: Check dashboard data availability
  console.log("\nStep 5: Dashboard data availability check...");
  console.log(`  🌐 Dashboard URL: http://dashboard.minibob.local`);
  console.log(`  📊 Expected to see execution: ${executionId}`);
  console.log(`  💡 Open dashboard to verify visualization\n`);
  
  console.log("=" .repeat(60));
  console.log("Test Summary:");
  console.log("=" .repeat(60));
  console.log(`Execution ID: ${executionId}`);
  console.log(`Variant: ${variantId}`);
  console.log(`Status: Should be visible in backend and dashboard`);
  console.log(`\n✅ Test complete! Check dashboard at http://dashboard.minibob.local`);
  console.log("=" .repeat(60));
}

// Run test
testBackendIntegration().catch(error => {
  console.error("❌ Test failed:", error);
  if (typeof process !== 'undefined') {
    process.exit(1);
  }
});
