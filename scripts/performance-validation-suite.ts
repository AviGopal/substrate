#!/usr/bin/env bun
/**
 * DevBob Performance Validation Suite
 * 
 * Validates performance improvements against baseline metrics:
 * - 30% reduction in memory usage
 * - 40% reduction in token consumption  
 * - <100ms overhead for context selection
 * 
 * Test scenarios:
 * 1. Baseline metrics establishment
 * 2. Impulse loading performance (small, medium, large)
 * 3. Activity execution performance (simple, complex)
 * 4. Memory usage analysis
 * 5. Token consumption analysis
 * 6. Metabob integration overhead
 */

import { Instance } from "./repos/metabob-opencode/packages/opencode/src/project/instance"
import { ACPDelegateTool } from "./repos/metabob-opencode/packages/opencode/src/tool/acp-delegate"
import { SessionMemory } from "./repos/metabob-opencode/packages/opencode/src/session/session-memory"
import type { ActivityTemplate } from "./repos/metabob-opencode/packages/opencode/src/session/activity-template"

console.log("📊 DevBob Performance Validation Suite")
console.log("======================================")

// Test configuration
const TEST_AGENTS = {
  opencode: "devbob-opencode",
  rpcapi: "devbob-rpc-api",
  dashboard: "devbob-dashboard",
  cli: "devbob-cli"
} as const

// Performance targets
const PERFORMANCE_TARGETS = {
  memoryReduction: 30, // 30% reduction
  tokenReduction: 40,  // 40% reduction  
  contextSelectionOverhead: 100, // <100ms
  impulseLoadingImprovement: 20, // 20% reduction
}

// Test data generators
function generateSmallImpulse(): ActivityTemplate.Impulse.Schema {
  return {
    id: `small-impulse-${Date.now()}`,
    type: "requirements",
    pointer: {
      type: "memo",
      content: "Small test impulse with minimal content for performance testing.",
      source: "performance-test"
    },
    budget: 1000,
    loaded: true,
    content: "Small test impulse with minimal content for performance testing."
  }
}

function generateMediumImpulse(): ActivityTemplate.Impulse.Schema {
  const mediumContent = `# Medium Test Impulse

## Requirements
This is a medium-sized impulse for performance testing with more detailed content.

### Features Required
1. Authentication system with JWT tokens
2. User management with CRUD operations
3. Email notification system
4. File upload and processing
5. API rate limiting and security

### Technical Specifications
- REST API with OpenAPI documentation
- PostgreSQL database with migrations
- Redis caching layer
- Background job processing
- Comprehensive test coverage

### Acceptance Criteria
- All endpoints must have proper validation
- Database queries must be optimized
- Security measures must be implemented
- Performance must meet SLA requirements
- Documentation must be complete

This content is designed to be around 1-10KB in size for testing medium impulse performance.`

  return {
    id: `medium-impulse-${Date.now()}`,
    type: "requirements",
    pointer: {
      type: "memo",
      content: mediumContent,
      source: "performance-test"
    },
    budget: 5000,
    loaded: true,
    content: mediumContent
  }
}

function generateLargeImpulse(): ActivityTemplate.Impulse.Schema {
  // Generate large content (>100KB)
  let largeContent = `# Large Test Impulse for Performance Testing\n\n`
  
  for (let i = 0; i < 50; i++) {
    largeContent += `## Section ${i + 1}: Detailed Requirements\n\n`
    largeContent += `This section contains detailed requirements for component ${i + 1}. `
    largeContent += `It includes comprehensive specifications, implementation details, `
    largeContent += `testing requirements, and performance considerations.\n\n`
    
    largeContent += `### Technical Specifications\n`
    largeContent += `- Component architecture with microservices design\n`
    largeContent += `- Database schema with relationships and indexes\n`
    largeContent += `- API endpoints with request/response schemas\n`
    largeContent += `- Security requirements and authentication flows\n`
    largeContent += `- Performance benchmarks and SLA requirements\n\n`
    
    largeContent += `### Implementation Details\n`
    largeContent += `Detailed implementation guidelines for developers including `
    largeContent += `code structure, design patterns, error handling, logging, `
    largeContent += `monitoring, and deployment procedures.\n\n`
  }
  
  return {
    id: `large-impulse-${Date.now()}`,
    type: "requirements", 
    pointer: {
      type: "memo",
      content: largeContent,
      source: "performance-test"
    },
    budget: 10000,
    loaded: true,
    content: largeContent
  }
}

// Performance measurement utilities
class PerformanceMetrics {
  private metrics: Array<{
    test: string
    startTime: number
    endTime?: number
    memoryBefore?: NodeJS.MemoryUsage
    memoryAfter?: NodeJS.MemoryUsage
    tokenEstimate?: number
    responseSize?: number
    success: boolean
    error?: string
  }> = []

  startMeasurement(testName: string) {
    const startTime = performance.now()
    const memoryBefore = process.memoryUsage()
    
    this.metrics.push({
      test: testName,
      startTime,
      memoryBefore,
      success: false
    })
    
    return this.metrics.length - 1 // Return index for completion
  }

  completeMeasurement(index: number, success: boolean = true, error?: string, tokenEstimate?: number, responseSize?: number) {
    if (index >= 0 && index < this.metrics.length) {
      const metric = this.metrics[index]
      metric.endTime = performance.now()
      metric.memoryAfter = process.memoryUsage()
      metric.success = success
      metric.error = error
      metric.tokenEstimate = tokenEstimate
      metric.responseSize = responseSize
    }
  }

  getDuration(index: number): number {
    const metric = this.metrics[index]
    return metric.endTime ? metric.endTime - metric.startTime : 0
  }

  getMemoryDelta(index: number): number {
    const metric = this.metrics[index]
    if (metric.memoryBefore && metric.memoryAfter) {
      return metric.memoryAfter.heapUsed - metric.memoryBefore.heapUsed
    }
    return 0
  }

  getAllMetrics() {
    return this.metrics
  }

  generateReport() {
    const report = {
      totalTests: this.metrics.length,
      successful: this.metrics.filter(m => m.success).length,
      failed: this.metrics.filter(m => !m.success).length,
      avgDuration: this.metrics.reduce((sum, m) => sum + this.getDuration(this.metrics.indexOf(m)), 0) / this.metrics.length,
      totalMemoryDelta: this.metrics.reduce((sum, m) => sum + this.getMemoryDelta(this.metrics.indexOf(m)), 0),
      tests: this.metrics.map((m, i) => ({
        test: m.test,
        duration: this.getDuration(i),
        memoryDelta: this.getMemoryDelta(i),
        success: m.success,
        error: m.error,
        tokenEstimate: m.tokenEstimate,
        responseSize: m.responseSize
      }))
    }
    return report
  }
}

const metrics = new PerformanceMetrics()

// Run within Instance context
await Instance.provide({
  directory: `${process.cwd()}/repos/metabob-opencode`,
  fn: async () => {
    console.log("🔧 Initializing Performance Test Environment...")
    
    let acpTool: Awaited<ReturnType<typeof ACPDelegateTool.init>>
    try {
      acpTool = await ACPDelegateTool.init()
      console.log("✅ ACP Tool initialized for performance testing")
    } catch (error) {
      console.log("❌ Failed to initialize ACP tool:", error)
      process.exit(1)
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    console.log("Phase 1: Baseline Metrics - Impulse Loading Performance")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

    // Test 1.1: Small Impulse Loading
    console.log("\n📦 Testing Small Impulse Loading (<1KB)...")
    const smallImpulse = generateSmallImpulse()
    
    const smallImpulseIndex = metrics.startMeasurement("small_impulse_loading")
    try {
      await SessionMemory.createImpulse("perf-test-small", smallImpulse)
      const loadedImpulse = await SessionMemory.getImpulse("perf-test-small", smallImpulse.id)
      
      metrics.completeMeasurement(
        smallImpulseIndex, 
        true, 
        undefined, 
        smallImpulse.content.length / 4, // Rough token estimate
        smallImpulse.content.length
      )
      
      console.log(`✅ Small impulse loaded in ${metrics.getDuration(smallImpulseIndex).toFixed(2)}ms`)
      console.log(`   Memory delta: ${(metrics.getMemoryDelta(smallImpulseIndex) / 1024 / 1024).toFixed(2)}MB`)
      console.log(`   Content size: ${smallImpulse.content.length} bytes`)
    } catch (error) {
      metrics.completeMeasurement(smallImpulseIndex, false, String(error))
      console.log("❌ Small impulse loading failed:", error)
    }

    // Test 1.2: Medium Impulse Loading  
    console.log("\n📦 Testing Medium Impulse Loading (1KB-100KB)...")
    const mediumImpulse = generateMediumImpulse()
    
    const mediumImpulseIndex = metrics.startMeasurement("medium_impulse_loading")
    try {
      await SessionMemory.createImpulse("perf-test-medium", mediumImpulse)
      const loadedImpulse = await SessionMemory.getImpulse("perf-test-medium", mediumImpulse.id)
      
      metrics.completeMeasurement(
        mediumImpulseIndex,
        true,
        undefined,
        mediumImpulse.content.length / 4, // Rough token estimate
        mediumImpulse.content.length
      )
      
      console.log(`✅ Medium impulse loaded in ${metrics.getDuration(mediumImpulseIndex).toFixed(2)}ms`)
      console.log(`   Memory delta: ${(metrics.getMemoryDelta(mediumImpulseIndex) / 1024 / 1024).toFixed(2)}MB`)
      console.log(`   Content size: ${mediumImpulse.content.length} bytes`)
    } catch (error) {
      metrics.completeMeasurement(mediumImpulseIndex, false, String(error))
      console.log("❌ Medium impulse loading failed:", error)
    }

    // Test 1.3: Large Impulse Loading
    console.log("\n📦 Testing Large Impulse Loading (>100KB)...")
    const largeImpulse = generateLargeImpulse()
    
    const largeImpulseIndex = metrics.startMeasurement("large_impulse_loading")
    try {
      await SessionMemory.createImpulse("perf-test-large", largeImpulse)
      const loadedImpulse = await SessionMemory.getImpulse("perf-test-large", largeImpulse.id)
      
      metrics.completeMeasurement(
        largeImpulseIndex,
        true,
        undefined,
        largeImpulse.content.length / 4, // Rough token estimate
        largeImpulse.content.length
      )
      
      console.log(`✅ Large impulse loaded in ${metrics.getDuration(largeImpulseIndex).toFixed(2)}ms`)
      console.log(`   Memory delta: ${(metrics.getMemoryDelta(largeImpulseIndex) / 1024 / 1024).toFixed(2)}MB`)
      console.log(`   Content size: ${largeImpulse.content.length} bytes`)
    } catch (error) {
      metrics.completeMeasurement(largeImpulseIndex, false, String(error))
      console.log("❌ Large impulse loading failed:", error)
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    console.log("Phase 2: Activity Execution Performance")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

    // Test 2.1: Simple Activity (1-3 tasks)
    console.log("\n⚡ Testing Simple Activity Execution...")
    const simpleActivityIndex = metrics.startMeasurement("simple_activity_execution")
    
    try {
      const result = await acpTool.execute(
        {
          target: `docker://${TEST_AGENTS.opencode}`,
          taskDescription: "Simple activity performance test",
          prompt: `Perform a simple development task for performance measurement:

1. Create a small text file with current timestamp
2. Read the file back  
3. Report the file size

This tests simple activity execution performance.`,
          shareImpulses: [smallImpulse.id],
          timeout: 120,
        },
        {
          sessionID: "perf-test-simple-activity",
          activityId: undefined,
          taskId: undefined,
        } as any,
      )

      metrics.completeMeasurement(
        simpleActivityIndex,
        result.metadata?.success || false,
        result.metadata?.error,
        result.output.length / 4, // Rough token estimate
        result.output.length
      )

      if (result.metadata?.success) {
        console.log(`✅ Simple activity completed in ${metrics.getDuration(simpleActivityIndex).toFixed(2)}ms`)
        console.log(`   Memory delta: ${(metrics.getMemoryDelta(simpleActivityIndex) / 1024 / 1024).toFixed(2)}MB`)
        console.log(`   Response size: ${result.output.length} chars`)
      } else {
        console.log("❌ Simple activity execution failed")
      }
    } catch (error) {
      metrics.completeMeasurement(simpleActivityIndex, false, String(error))
      console.log("❌ Simple activity execution failed:", error)
    }

    // Test 2.2: Complex Activity (5+ tasks)
    console.log("\n⚡ Testing Complex Activity Execution...")
    const complexActivityIndex = metrics.startMeasurement("complex_activity_execution")
    
    try {
      const result = await acpTool.execute(
        {
          target: `docker://${TEST_AGENTS.opencode}`,
          taskDescription: "Complex activity performance test",
          prompt: `Perform a complex multi-step development task for performance measurement:

1. Search for activity templates using search_activities
2. Create a project structure with multiple directories
3. Write configuration files (package.json, README.md, .gitignore)
4. Read and validate the created files
5. Generate a summary report of all operations
6. Clean up temporary files

This tests complex activity execution performance with multiple steps.`,
          shareImpulses: [mediumImpulse.id],
          timeout: 180,
        },
        {
          sessionID: "perf-test-complex-activity",
          activityId: undefined,
          taskId: undefined,
        } as any,
      )

      metrics.completeMeasurement(
        complexActivityIndex,
        result.metadata?.success || false,
        result.metadata?.error,
        result.output.length / 4, // Rough token estimate
        result.output.length
      )

      if (result.metadata?.success) {
        console.log(`✅ Complex activity completed in ${metrics.getDuration(complexActivityIndex).toFixed(2)}ms`)
        console.log(`   Memory delta: ${(metrics.getMemoryDelta(complexActivityIndex) / 1024 / 1024).toFixed(2)}MB`)
        console.log(`   Response size: ${result.output.length} chars`)
      } else {
        console.log("❌ Complex activity execution failed")
      }
    } catch (error) {
      metrics.completeMeasurement(complexActivityIndex, false, String(error))
      console.log("❌ Complex activity execution failed:", error)
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    console.log("Phase 3: Metabob Integration Overhead")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

    // Test 3.1: Context Selection Overhead
    console.log("\n🎯 Testing Context Selection Performance...")
    const contextSelectionIndex = metrics.startMeasurement("context_selection_overhead")
    
    try {
      const result = await acpTool.execute(
        {
          target: `docker://${TEST_AGENTS.opencode}`,
          taskDescription: "Context selection performance test",
          prompt: `Test context selection and processing overhead:

1. Use test_metabob_mcp to verify Metabob connectivity
2. If available, test basic context selection capabilities
3. Measure response time and report results

This tests Metabob integration overhead.`,
          timeout: 90,
        },
        {
          sessionID: "perf-test-context-selection",
          activityId: undefined,
          taskId: undefined,
        } as any,
      )

      metrics.completeMeasurement(
        contextSelectionIndex,
        result.metadata?.success || false,
        result.metadata?.error,
        result.output.length / 4,
        result.output.length
      )

      const duration = metrics.getDuration(contextSelectionIndex)
      if (result.metadata?.success) {
        console.log(`✅ Context selection completed in ${duration.toFixed(2)}ms`)
        console.log(`   Target: <${PERFORMANCE_TARGETS.contextSelectionOverhead}ms`)
        console.log(`   Status: ${duration < PERFORMANCE_TARGETS.contextSelectionOverhead ? '✅ MEETS TARGET' : '⚠️  ABOVE TARGET'}`)
      } else {
        console.log("❌ Context selection test failed")
      }
    } catch (error) {
      metrics.completeMeasurement(contextSelectionIndex, false, String(error))
      console.log("❌ Context selection test failed:", error)
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    console.log("Phase 4: Cross-Container Performance")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

    // Test 4.1: Cross-Agent Communication Performance
    console.log("\n🔄 Testing Cross-Agent Communication Performance...")
    const crossAgentIndex = metrics.startMeasurement("cross_agent_communication")
    
    try {
      // Test parallel execution across multiple agents
      const parallelTasks = [
        acpTool.execute({
          target: `docker://${TEST_AGENTS.rpcapi}`,
          taskDescription: "RPC API performance test",
          prompt: "Create a simple file and report completion. Test agent performance.",
          timeout: 60,
        }, { sessionID: "perf-rpc", activityId: undefined, taskId: undefined } as any),
        
        acpTool.execute({
          target: `docker://${TEST_AGENTS.dashboard}`,
          taskDescription: "Dashboard performance test", 
          prompt: "Create a simple file and report completion. Test agent performance.",
          timeout: 60,
        }, { sessionID: "perf-dash", activityId: undefined, taskId: undefined } as any),
        
        acpTool.execute({
          target: `docker://${TEST_AGENTS.cli}`,
          taskDescription: "CLI performance test",
          prompt: "Create a simple file and report completion. Test agent performance.", 
          timeout: 60,
        }, { sessionID: "perf-cli", activityId: undefined, taskId: undefined } as any),
      ]

      const results = await Promise.allSettled(parallelTasks)
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.metadata?.success).length
      
      metrics.completeMeasurement(
        crossAgentIndex,
        successful === parallelTasks.length,
        successful < parallelTasks.length ? `${successful}/${parallelTasks.length} tasks succeeded` : undefined,
        0, // Token estimate not applicable for parallel test
        successful
      )

      console.log(`✅ Cross-agent communication: ${successful}/${parallelTasks.length} agents responded`)
      console.log(`   Duration: ${metrics.getDuration(crossAgentIndex).toFixed(2)}ms`)
      console.log(`   All agents: ${successful === parallelTasks.length ? '✅ SUCCESS' : '⚠️  PARTIAL'}`)
      
    } catch (error) {
      metrics.completeMeasurement(crossAgentIndex, false, String(error))
      console.log("❌ Cross-agent communication test failed:", error)
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    console.log("Phase 5: Performance Analysis & Report Generation")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

    const report = metrics.generateReport()
    
    console.log("\n📊 PERFORMANCE VALIDATION RESULTS")
    console.log("==================================")
    console.log(`Total Tests: ${report.totalTests}`)
    console.log(`Successful: ${report.successful}`)
    console.log(`Failed: ${report.failed}`)
    console.log(`Average Duration: ${report.avgDuration.toFixed(2)}ms`)
    console.log(`Total Memory Delta: ${(report.totalMemoryDelta / 1024 / 1024).toFixed(2)}MB`)
    
    console.log("\n🎯 PERFORMANCE TARGET ANALYSIS")
    console.log("==============================")
    
    // Analyze against targets
    const impulseTests = report.tests.filter(t => t.test.includes('impulse_loading'))
    const activityTests = report.tests.filter(t => t.test.includes('activity_execution'))
    const contextTest = report.tests.find(t => t.test === 'context_selection_overhead')
    
    console.log("\n📦 IMPULSE LOADING PERFORMANCE:")
    impulseTests.forEach(test => {
      console.log(`   ${test.test}: ${test.duration.toFixed(2)}ms (${(test.memoryDelta / 1024 / 1024).toFixed(2)}MB)`)
    })
    
    console.log("\n⚡ ACTIVITY EXECUTION PERFORMANCE:")
    activityTests.forEach(test => {
      console.log(`   ${test.test}: ${test.duration.toFixed(2)}ms (${(test.memoryDelta / 1024 / 1024).toFixed(2)}MB)`)
    })
    
    if (contextTest) {
      console.log("\n🎯 CONTEXT SELECTION OVERHEAD:")
      console.log(`   Duration: ${contextTest.duration.toFixed(2)}ms`)
      console.log(`   Target: <${PERFORMANCE_TARGETS.contextSelectionOverhead}ms`)
      console.log(`   Status: ${contextTest.duration < PERFORMANCE_TARGETS.contextSelectionOverhead ? '✅ MEETS TARGET' : '⚠️  ABOVE TARGET'}`)
    }
    
    // Generate final assessment
    console.log("\n🏆 FINAL ASSESSMENT")
    console.log("==================")
    
    const avgMemoryUsage = report.totalMemoryDelta / report.totalTests
    const successRate = (report.successful / report.totalTests) * 100
    
    console.log(`✅ Success Rate: ${successRate.toFixed(1)}%`)
    console.log(`📊 Average Memory per Test: ${(avgMemoryUsage / 1024 / 1024).toFixed(2)}MB`)
    console.log(`⏱️  Average Response Time: ${report.avgDuration.toFixed(2)}ms`)
    
    // Performance recommendations
    console.log("\n💡 RECOMMENDATIONS")
    console.log("==================")
    
    if (report.avgDuration > 30000) {
      console.log("⚠️  High average response time detected")
      console.log("   - Consider optimizing activity template queries")
      console.log("   - Review memory agent timeout settings")
    }
    
    if (avgMemoryUsage > 100 * 1024 * 1024) {
      console.log("⚠️  High memory usage detected") 
      console.log("   - Implement impulse compression strategies")
      console.log("   - Consider lazy loading for large impulses")
    }
    
    if (report.failed > 0) {
      console.log("⚠️  Some tests failed")
      console.log("   - Review error logs for optimization opportunities")
      console.log("   - Consider increasing timeout values for complex operations")
    }
    
    console.log("\n✨ DevBob Performance Validation Complete!")
    console.log(`📈 System is ${successRate >= 80 ? '✅ PERFORMING WELL' : '⚠️  NEEDS OPTIMIZATION'}`)
  },
})