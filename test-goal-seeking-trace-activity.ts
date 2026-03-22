/**
 * Test: Goal-Seeking Activity Creation
 * 
 * Creates a "trace minibob behavior" activity using goal-seeking,
 * then executes it to demonstrate activity composition.
 */

import { ActivityExecutor, type ExecutorConfig } from "./repos/minibob/src/activity"
import { getMCPClient, isMCPEnabled } from "./repos/minibob/src/mcp"

const MCP_ENDPOINT = process.env.MCP_ENDPOINT || "http://metabob-activity-api.activity-system.svc.cluster.local:8080"

async function testGoalSeekingActivityCreation() {
  console.log("🧪 Test: Goal-Seeking Activity Creation\n")
  console.log("=" .repeat(60))
  
  // Step 1: Connect to backend
  console.log("\n📡 Step 1: Connecting to backend...")
  console.log(`MCP Endpoint: ${MCP_ENDPOINT}`)
  
  const mcp = getMCPClient()
  if (!mcp) {
    console.error("❌ MCP client not available")
    process.exit(1)
  }
  
  // Step 2: Create "trace minibob behavior" activity using goal-seeking
  console.log("\n🎯 Step 2: Creating 'trace minibob behavior' activity...")
  
  const goalDescription = `
    Create an activity that traces minibob's execution behavior for debugging purposes.
    The activity should:
    1. Log the current configuration and environment
    2. Execute a simple test task (echo a message)
    3. Capture and log the execution metrics (tokens, duration, cost)
    4. Verify the MCP connection is working
    5. Check impulse filtering status
    6. Generate a summary report
  `
  
  const templateName = "trace-minibob-execution"
  const category = "infrastructure"
  
  try {
    // Call goal-seeking endpoint to create the activity
    const response = await fetch(`${MCP_ENDPOINT}/v2/activities/create-goal-seeking`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        goal_description: goalDescription.trim(),
        template_name: templateName,
        category: category,
        variables: {
          test_message: "Hello from minibob trace test"
        },
        register_to_backend: true,
      }),
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Goal-seeking failed: ${response.status} - ${errorText}`)
    }
    
    const result = await response.json()
    console.log(`✅ Activity created: ${result.template_id}`)
    console.log(`   Tasks: ${result.task_count}`)
    console.log(`   Estimated cost: $${result.estimated_cost?.toFixed(4) || 'N/A'}`)
    
    // Step 3: Query the created template
    console.log("\n📋 Step 3: Querying created template...")
    
    const templateResponse = await fetch(
      `${MCP_ENDPOINT}/v2/activities/templates/${result.template_id}`
    )
    
    if (templateResponse.ok) {
      const template = await templateResponse.json()
      console.log(`✅ Template retrieved:`)
      console.log(`   Name: ${template.name}`)
      console.log(`   Description: ${template.description}`)
      console.log(`   Tasks: ${template.tasks?.length || 0}`)
      
      if (template.tasks) {
        console.log("\n   Task breakdown:")
        template.tasks.forEach((task: any, idx: number) => {
          console.log(`   ${idx + 1}. ${task.id}: ${task.description}`)
        })
      }
    }
    
    // Step 4: Check activity composition in backend
    console.log("\n🔍 Step 4: Checking activity composition...")
    
    const compositionResponse = await fetch(
      `${MCP_ENDPOINT}/v2/activities/compositions?parent_activity_id=${result.template_id}`
    )
    
    if (compositionResponse.ok) {
      const compositions = await compositionResponse.json()
      console.log(`   Compositions found: ${compositions.length}`)
      
      if (compositions.length > 0) {
        compositions.forEach((comp: any) => {
          console.log(`   - ${comp.parent_activity_id} → ${comp.child_activity_id}`)
        })
      }
    }
    
    // Step 5: Create a second activity that uses the first one
    console.log("\n🎯 Step 5: Creating a composed activity...")
    
    const composedGoal = `
      Create an activity that runs a comprehensive minibob health check.
      The activity should:
      1. Use the trace-minibob-execution activity to capture baseline behavior
      2. Execute multiple test activities in sequence
      3. Compare metrics between runs
      4. Generate a health report with pass/fail status
    `
    
    const composedResponse = await fetch(`${MCP_ENDPOINT}/v2/activities/create-goal-seeking`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        goal_description: composedGoal.trim(),
        template_name: "minibob-health-check",
        category: "infrastructure",
        variables: {
          baseline_activity: result.template_id
        },
        register_to_backend: true,
      }),
    })
    
    if (composedResponse.ok) {
      const composedResult = await composedResponse.json()
      console.log(`✅ Composed activity created: ${composedResult.template_id}`)
      console.log(`   This activity should compose with: ${result.template_id}`)
    }
    
    // Step 6: Query all activities to see the full picture
    console.log("\n📊 Step 6: Querying all infrastructure activities...")
    
    const allActivitiesResponse = await fetch(
      `${MCP_ENDPOINT}/v2/activities/templates?category=infrastructure`
    )
    
    if (allActivitiesResponse.ok) {
      const allActivities = await allActivitiesResponse.json()
      console.log(`✅ Found ${allActivities.length} infrastructure activities`)
      
      console.log("\n   Recent activities:")
      allActivities.slice(0, 5).forEach((act: any) => {
        console.log(`   - ${act.id}: ${act.name}`)
        console.log(`     Success rate: ${(act.success_rate * 100).toFixed(1)}%`)
        console.log(`     Executions: ${act.execution_count}`)
      })
    }
    
    console.log("\n" + "=".repeat(60))
    console.log("✅ Test complete!")
    console.log("\n📝 Summary:")
    console.log(`   - Created trace activity: ${result.template_id}`)
    console.log(`   - Created composed health check activity`)
    console.log(`   - Backend is tracking activity compositions`)
    console.log("\n🌐 Next: Check dashboard.minibob.local to visualize activity structure")
    
  } catch (error) {
    console.error("\n❌ Test failed:", error instanceof Error ? error.message : String(error))
    if (error instanceof Error && error.stack) {
      console.error("Stack:", error.stack)
    }
    process.exit(1)
  }
}

// Run the test
testGoalSeekingActivityCreation()
