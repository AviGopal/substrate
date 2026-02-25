/**
 * Validation Harness: integration-flow-sidebar-concurrent-activities
 * 
 * Tests the sidebar's ability to display concurrent activities and their children
 * across ACP contexts with accurate metrics and minimalist styling.
 * 
 * Test Strategy:
 * 1. Create a parent activity with 3-5 child activities
 * 2. Some children execute concurrently via ACP delegation
 * 3. Verify tree structure, status indicators, aggregated metrics
 * 4. Validate concurrent execution visualization
 */

import { Activity } from "../../repos/metabob-opencode/packages/opencode/src/session/activity.js"
import { SessionState } from "../../repos/metabob-opencode/packages/opencode/src/session/session-state.js"
import { Storage } from "../../repos/metabob-opencode/packages/opencode/src/storage/storage.js"
import { Session } from "../../repos/metabob-opencode/packages/opencode/src/session/index.js"

export interface ValidationInput {
  sessionID: string
  parentActivityId: string
  childActivities: Array<{
    id: string
    title: string
    status: "setup" | "executing" | "completing" | "done" | "failed"
    parentActivityId: string
    cost: number
    tokens: { input: number; output: number; cache: number }
    acpAgent?: {
      agentId: string
      agentName: string
      sessionID: string
    }
  }>
}

export interface ValidationOutput {
  pass: boolean
  actual: {
    treeStructure: {
      rootNodes: number
      totalNodes: number
      maxDepth: number
      parentChildLinks: number
    }
    statusIndicators: {
      executing: number
      done: number
      failed: number
    }
    concurrentExecution: {
      detected: boolean
      concurrentCount: number
    }
    aggregatedMetrics: {
      totalCost: number
      totalTokens: number
      rootCost: number
      childrenCost: number
    }
    acpChildren: {
      resolved: number
      linkedToParent: number
    }
  }
  expected: {
    treeStructure: {
      rootNodes: number
      totalNodes: number
      maxDepth: number
      parentChildLinks: number
    }
    statusIndicators: {
      executing: number
      done: number
      failed: number
    }
    concurrentExecution: {
      detected: boolean
      concurrentCount: number
    }
    aggregatedMetrics: {
      totalCost: number
      totalTokens: number
      rootCost: number
      childrenCost: number
    }
    acpChildren: {
      resolved: number
      linkedToParent: number
    }
  }
  errors: string[]
}

/**
 * Run validation test for concurrent activities tree visualization
 */
export async function runValidation(input: ValidationInput): Promise<ValidationOutput> {
  const errors: string[] = []
  
  try {
    // Create test session
    const session = await Session.create({
      directory: process.cwd(),
      agent: "general",
    })
    
    // Create parent activity
    const parentActivity = await Activity.create({
      title: "Parent Activity - Multi-task workflow",
      directory: process.cwd(),
      sessionIDs: [input.sessionID],
      template: undefined,
    })

    // Update parent with test data
    const parent = await Activity.load(parentActivity.id)
    parent.stats.cost.total = 1.5
    parent.stats.tokens.input = 10000
    parent.stats.tokens.output = 5000
    parent.stats.tokens.cache.read = 2000
    parent.status = "executing"
    await Storage.write(["activity", parent.id], parent)

    // Create child activities
    const childActivities: Activity.Info[] = []
    for (const child of input.childActivities) {
      const childActivity = await Activity.create({
        title: child.title,
        directory: process.cwd(),
        sessionIDs: child.acpAgent ? [child.acpAgent.sessionID] : [input.sessionID],
        template: undefined,
        parentActivityId: parentActivity.id,
      })

      const childInfo = await Activity.load(childActivity.id)
      childInfo.status = child.status
      childInfo.stats.cost.total = child.cost
      childInfo.stats.tokens.input = child.tokens.input
      childInfo.stats.tokens.output = child.tokens.output
      childInfo.stats.tokens.cache.read = child.tokens.cache
      
      if (child.acpAgent) {
        childInfo.acpAgents = [{
          agentId: child.acpAgent.agentId,
          agentName: child.acpAgent.agentName,
          target: `docker://${child.acpAgent.agentName}`,
          sessionID: child.acpAgent.sessionID,
          spawnedAt: Date.now(),
          status: "active",
          taskIds: [`task-${child.id}`],
        }]
      }

      await Storage.write(["activity", childInfo.id], childInfo)
      childActivities.push(childInfo)
    }

    // Fetch session state with activity tree
    const state = await SessionState.get(input.sessionID)
    const tree = state.activities.activityTree || []

    // Analyze tree structure
    const flattenTree = (nodes: SessionState.ActivityTreeNode[]): SessionState.ActivityTreeNode[] => {
      return nodes.flatMap((node) => [node, ...flattenTree(node.children)])
    }
    
    const allNodes = flattenTree(tree)
    const rootNodes = tree.length
    const totalNodes = allNodes.length
    const maxDepth = Math.max(0, ...allNodes.map((n) => n.treeDepth))
    const parentChildLinks = allNodes.filter((n) => n.children.length > 0).reduce(
      (sum, n) => sum + n.children.length,
      0
    )

    // Count status indicators
    const statusCounts = {
      executing: allNodes.filter((n) => n.status === "executing").length,
      done: allNodes.filter((n) => n.status === "done").length,
      failed: allNodes.filter((n) => n.status === "failed").length,
    }

    // Check concurrent execution
    const concurrentNodes = allNodes.filter((n) => n.hasConcurrentChildren)
    const concurrentDetected = concurrentNodes.length > 0
    const concurrentCount = concurrentNodes.reduce(
      (sum, n) => sum + n.children.filter((c) => c.status === "executing").length,
      0
    )

    // Calculate aggregated metrics
    const rootNode = tree[0]
    const totalCost = rootNode?.aggregatedCost || 0
    const totalTokens = rootNode
      ? rootNode.aggregatedTokens.input + rootNode.aggregatedTokens.output + rootNode.aggregatedTokens.cache
      : 0
    const rootCost = rootNode?.cost || 0
    const childrenCost = totalCost - rootCost

    // Check ACP children resolution
    const acpChildrenInTree = allNodes.filter((n) => 
      childActivities.some((c) => c.id === n.id && c.acpAgents && c.acpAgents.length > 0)
    )
    const acpChildrenLinked = acpChildrenInTree.filter((n) => n.parentActivityId === parentActivity.id)

    // Build actual output
    const actual = {
      treeStructure: {
        rootNodes,
        totalNodes,
        maxDepth,
        parentChildLinks,
      },
      statusIndicators: statusCounts,
      concurrentExecution: {
        detected: concurrentDetected,
        concurrentCount,
      },
      aggregatedMetrics: {
        totalCost,
        totalTokens,
        rootCost,
        childrenCost,
      },
      acpChildren: {
        resolved: acpChildrenInTree.length,
        linkedToParent: acpChildrenLinked.length,
      },
    }

    // Calculate expected output
    const expectedExecuting = input.childActivities.filter((c) => c.status === "executing").length
    const expectedDone = input.childActivities.filter((c) => c.status === "done").length
    const expectedFailed = input.childActivities.filter((c) => c.status === "failed").length
    const expectedConcurrent = expectedExecuting >= 2
    const expectedTotalCost = 1.5 + input.childActivities.reduce((sum, c) => sum + c.cost, 0)
    const expectedTotalTokens = 17000 + input.childActivities.reduce(
      (sum, c) => sum + c.tokens.input + c.tokens.output + c.tokens.cache,
      0
    )
    const expectedACPChildren = input.childActivities.filter((c) => c.acpAgent).length

    const expected = {
      treeStructure: {
        rootNodes: 1,
        totalNodes: 1 + input.childActivities.length,
        maxDepth: 1,
        parentChildLinks: input.childActivities.length,
      },
      statusIndicators: {
        executing: expectedExecuting + 1, // +1 for parent
        done: expectedDone,
        failed: expectedFailed,
      },
      concurrentExecution: {
        detected: expectedConcurrent,
        concurrentCount: expectedExecuting,
      },
      aggregatedMetrics: {
        totalCost: expectedTotalCost,
        totalTokens: expectedTotalTokens,
        rootCost: 1.5,
        childrenCost: input.childActivities.reduce((sum, c) => sum + c.cost, 0),
      },
      acpChildren: {
        resolved: expectedACPChildren,
        linkedToParent: expectedACPChildren,
      },
    }

    // Validate assertions
    const tolerance = 0.01 // Allow 1% tolerance for floating point

    if (actual.treeStructure.rootNodes !== expected.treeStructure.rootNodes) {
      errors.push(
        `Tree root count mismatch: expected ${expected.treeStructure.rootNodes}, got ${actual.treeStructure.rootNodes}`
      )
    }

    if (actual.treeStructure.totalNodes !== expected.treeStructure.totalNodes) {
      errors.push(
        `Total node count mismatch: expected ${expected.treeStructure.totalNodes}, got ${actual.treeStructure.totalNodes}`
      )
    }

    if (actual.treeStructure.parentChildLinks !== expected.treeStructure.parentChildLinks) {
      errors.push(
        `Parent-child link count mismatch: expected ${expected.treeStructure.parentChildLinks}, got ${actual.treeStructure.parentChildLinks}`
      )
    }

    if (actual.statusIndicators.executing !== expected.statusIndicators.executing) {
      errors.push(
        `Executing status count mismatch: expected ${expected.statusIndicators.executing}, got ${actual.statusIndicators.executing}`
      )
    }

    if (actual.concurrentExecution.detected !== expected.concurrentExecution.detected) {
      errors.push(
        `Concurrent execution detection failed: expected ${expected.concurrentExecution.detected}, got ${actual.concurrentExecution.detected}`
      )
    }

    if (Math.abs(actual.aggregatedMetrics.totalCost - expected.aggregatedMetrics.totalCost) > tolerance) {
      errors.push(
        `Total cost aggregation incorrect: expected ${expected.aggregatedMetrics.totalCost.toFixed(2)}, got ${actual.aggregatedMetrics.totalCost.toFixed(2)}`
      )
    }

    if (actual.acpChildren.resolved !== expected.acpChildren.resolved) {
      errors.push(
        `ACP children resolution failed: expected ${expected.acpChildren.resolved}, got ${actual.acpChildren.resolved}`
      )
    }

    // Cleanup
    await Storage.delete(["activity", parentActivity.id])
    for (const child of childActivities) {
      await Storage.delete(["activity", child.id])
    }
    await Session.delete(input.sessionID)

    return {
      pass: errors.length === 0,
      actual,
      expected,
      errors,
    }
  } catch (error) {
    errors.push(`Test execution failed: ${error instanceof Error ? error.message : String(error)}`)
    return {
      pass: false,
      actual: {} as any,
      expected: {} as any,
      errors,
    }
  }
}

/**
 * Run all validation test cases
 */
export async function runAllTests(): Promise<{ passed: number; failed: number; results: ValidationOutput[] }> {
  const testCases: ValidationInput[] = [
    // Case 1: Basic concurrent activities (2 executing children)
    {
      sessionID: "test-session-1",
      parentActivityId: "parent-1",
      childActivities: [
        {
          id: "child-1-1",
          title: "Backend API implementation",
          status: "executing",
          parentActivityId: "parent-1",
          cost: 0.5,
          tokens: { input: 3000, output: 1500, cache: 500 },
          acpAgent: {
            agentId: "agent-backend",
            agentName: "devbob-backend-agent",
            sessionID: "acp-session-backend",
          },
        },
        {
          id: "child-1-2",
          title: "Frontend UI components",
          status: "executing",
          parentActivityId: "parent-1",
          cost: 0.4,
          tokens: { input: 2500, output: 1200, cache: 400 },
          acpAgent: {
            agentId: "agent-frontend",
            agentName: "devbob-frontend-agent",
            sessionID: "acp-session-frontend",
          },
        },
        {
          id: "child-1-3",
          title: "Database schema migration",
          status: "done",
          parentActivityId: "parent-1",
          cost: 0.3,
          tokens: { input: 2000, output: 1000, cache: 300 },
        },
      ],
    },
    // Case 2: High concurrency (4 executing children)
    {
      sessionID: "test-session-2",
      parentActivityId: "parent-2",
      childActivities: [
        {
          id: "child-2-1",
          title: "Authentication service",
          status: "executing",
          parentActivityId: "parent-2",
          cost: 0.6,
          tokens: { input: 4000, output: 2000, cache: 600 },
          acpAgent: {
            agentId: "agent-auth",
            agentName: "devbob-auth-agent",
            sessionID: "acp-session-auth",
          },
        },
        {
          id: "child-2-2",
          title: "Payment integration",
          status: "executing",
          parentActivityId: "parent-2",
          cost: 0.7,
          tokens: { input: 4500, output: 2200, cache: 700 },
          acpAgent: {
            agentId: "agent-payment",
            agentName: "devbob-payment-agent",
            sessionID: "acp-session-payment",
          },
        },
        {
          id: "child-2-3",
          title: "Email notifications",
          status: "executing",
          parentActivityId: "parent-2",
          cost: 0.4,
          tokens: { input: 2500, output: 1300, cache: 400 },
        },
        {
          id: "child-2-4",
          title: "Analytics tracking",
          status: "executing",
          parentActivityId: "parent-2",
          cost: 0.5,
          tokens: { input: 3000, output: 1500, cache: 500 },
        },
        {
          id: "child-2-5",
          title: "API documentation",
          status: "done",
          parentActivityId: "parent-2",
          cost: 0.2,
          tokens: { input: 1500, output: 800, cache: 200 },
        },
      ],
    },
    // Case 3: Mixed status with failed activity
    {
      sessionID: "test-session-3",
      parentActivityId: "parent-3",
      childActivities: [
        {
          id: "child-3-1",
          title: "User service",
          status: "done",
          parentActivityId: "parent-3",
          cost: 0.8,
          tokens: { input: 5000, output: 2500, cache: 800 },
        },
        {
          id: "child-3-2",
          title: "Error handling middleware",
          status: "failed",
          parentActivityId: "parent-3",
          cost: 0.3,
          tokens: { input: 2000, output: 1000, cache: 300 },
        },
        {
          id: "child-3-3",
          title: "Logging system",
          status: "executing",
          parentActivityId: "parent-3",
          cost: 0.4,
          tokens: { input: 2500, output: 1200, cache: 400 },
        },
      ],
    },
  ]

  const results: ValidationOutput[] = []
  let passed = 0
  let failed = 0

  for (const testCase of testCases) {
    const result = await runValidation(testCase)
    results.push(result)
    if (result.pass) {
      passed++
    } else {
      failed++
    }
  }

  return { passed, failed, results }
}

// CLI execution
if (require.main === module) {
  runAllTests()
    .then(({ passed, failed, results }) => {
      console.log(`\n=== Validation Results ===`)
      console.log(`Passed: ${passed}`)
      console.log(`Failed: ${failed}`)
      console.log(`Total: ${passed + failed}\n`)

      results.forEach((result, index) => {
        console.log(`Test Case ${index + 1}: ${result.pass ? "✓ PASS" : "✗ FAIL"}`)
        if (!result.pass) {
          console.log("Errors:")
          result.errors.forEach((err) => console.log(`  - ${err}`))
        }
      })

      process.exit(failed > 0 ? 1 : 0)
    })
    .catch((error) => {
      console.error("Validation harness failed:", error)
      process.exit(1)
    })
}
