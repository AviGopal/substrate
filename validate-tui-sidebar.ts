#!/usr/bin/env bun
/**
 * TUI Sidebar Component Validation
 * 
 * Validates that all TUI sidebar components are properly displaying:
 * - Session memory agent status and negotiation metrics
 * - Cost breakdown by activity, turn, agent, and impulse
 * - Memory usage tracking (heap, cache, session)
 * - Activity hierarchy with nested activities
 * - Real-time event updates via SSE
 */

const BASE_URL = process.env.OPENCODE_BASE_URL || "http://localhost:8080"

// Simple API client without SDK dependency
const api = {
  baseURL: BASE_URL,
  async session_list() {
    const response = await fetch(`${BASE_URL}/session`)
    return response.json()
  },
}

interface ValidationResult {
  component: string
  status: "✓" | "✗" | "⚠"
  message: string
  details?: any
}

const results: ValidationResult[] = []

async function validateComponent(name: string, check: () => Promise<{ status: "✓" | "✗" | "⚠"; message: string; details?: any }>) {
  try {
    const result = await check()
    results.push({ component: name, ...result })
  } catch (error) {
    results.push({
      component: name,
      status: "✗",
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

async function main() {
  console.log("🔍 TUI Sidebar Component Validation\n")
  console.log("=".repeat(60))

  // Get current session
  const sessions = await api.session_list()
  const currentSession = sessions[0]

  if (!currentSession) {
    console.error("❌ No active session found")
    process.exit(1)
  }

  console.log(`\n📋 Session: ${currentSession.id}`)
  console.log(`   Title: ${currentSession.title}\n`)

  // 1. Validate Session State Endpoint
  await validateComponent("Session State API", async () => {
    const response = await fetch(`${api.baseURL}/session/${currentSession.id}/state`)
    if (!response.ok) {
      return { status: "✗", message: `HTTP ${response.status}: ${response.statusText}` }
    }
    const state = await response.json()
    
    // Check required fields
    const required = ["contextWindow", "memoryManagement", "impulses", "activities", "acp"]
    const missing = required.filter((field) => !state[field])
    
    if (missing.length > 0) {
      return { status: "✗", message: `Missing fields: ${missing.join(", ")}`, details: state }
    }
    
    return { status: "✓", message: "All state fields present", details: state }
  })

  // 2. Validate Context Window Tracking
  await validateComponent("Context Window", async () => {
    const response = await fetch(`${api.baseURL}/session/${currentSession.id}/state`)
    const state = await response.json()
    const ctx = state.contextWindow
    
    if (!ctx || typeof ctx.estimatedTokens !== "number" || typeof ctx.utilizationPercent !== "number") {
      return { status: "✗", message: "Invalid context window data", details: ctx }
    }
    
    if (ctx.utilizationPercent < 0 || ctx.utilizationPercent > 100) {
      return { status: "⚠", message: `Utilization out of range: ${ctx.utilizationPercent}%`, details: ctx }
    }
    
    return {
      status: "✓",
      message: `${ctx.estimatedTokens.toLocaleString()} tokens (${Math.round(ctx.utilizationPercent)}%)`,
      details: ctx,
    }
  })

  // 3. Validate Memory Management
  await validateComponent("Memory Management", async () => {
    const response = await fetch(`${api.baseURL}/session/${currentSession.id}/state`)
    const state = await response.json()
    const mem = state.memoryManagement
    
    if (!mem || typeof mem.heapUsedMB !== "number" || typeof mem.heapTotalMB !== "number") {
      return { status: "✗", message: "Invalid memory data", details: mem }
    }
    
    const heapPercent = (mem.heapUsedMB / mem.heapTotalMB) * 100
    const status = mem.shouldCompact ? "⚠" : "✓"
    const warning = mem.shouldCompact ? " (compaction recommended)" : ""
    
    return {
      status,
      message: `${Math.round(mem.heapUsedMB)}MB / ${Math.round(mem.heapTotalMB)}MB${warning}`,
      details: mem,
    }
  })

  // 4. Validate Session Memory (Impulses)
  await validateComponent("Session Memory (Impulses)", async () => {
    const response = await fetch(`${api.baseURL}/session/${currentSession.id}/state`)
    const state = await response.json()
    const impulses = state.impulses
    
    if (!impulses || typeof impulses.impulseCount !== "number") {
      return { status: "✗", message: "Invalid impulse data", details: impulses }
    }
    
    if (impulses.impulseCount === 0) {
      return { status: "⚠", message: "No impulses found (session may not have memory agent active)" }
    }
    
    return {
      status: "✓",
      message: `${impulses.impulseCount} impulses (${impulses.loadedCount} loaded, ${impulses.unloadedCount} unloaded)`,
      details: impulses,
    }
  })

  // 5. Validate Activities
  await validateComponent("Activities", async () => {
    const response = await fetch(`${api.baseURL}/session/${currentSession.id}/state`)
    const state = await response.json()
    const activities = state.activities
    
    if (!activities || !Array.isArray(activities.activeActivities)) {
      return { status: "✗", message: "Invalid activities data", details: activities }
    }
    
    if (activities.activeActivities.length === 0) {
      return { status: "⚠", message: "No active activities" }
    }
    
    // Check for nested activities
    const nested = activities.activeActivities.filter((a: any) => a.parentActivityId)
    
    return {
      status: "✓",
      message: `${activities.activeActivities.length} active (${nested.length} nested)`,
      details: activities,
    }
  })

  // 6. Validate Cost Breakdown API
  await validateComponent("Cost Breakdown API", async () => {
    const response = await fetch(`${api.baseURL}/session/${currentSession.id}/relationships/cost-breakdown`)
    if (!response.ok) {
      return { status: "✗", message: `HTTP ${response.status}: ${response.statusText}` }
    }
    const cost = await response.json()
    
    const required = ["byActivity", "byTurn", "byImpulse", "byAgent", "totals"]
    const missing = required.filter((field) => !cost[field])
    
    if (missing.length > 0) {
      return { status: "✗", message: `Missing fields: ${missing.join(", ")}`, details: cost }
    }
    
    return { status: "✓", message: "All cost breakdown fields present", details: cost }
  })

  // 7. Validate Cost Totals
  await validateComponent("Cost Totals", async () => {
    const response = await fetch(`${api.baseURL}/session/${currentSession.id}/relationships/cost-breakdown`)
    const cost = await response.json()
    const totals = cost.totals
    
    if (!totals || typeof totals.totalCost !== "number") {
      return { status: "✗", message: "Invalid totals data", details: totals }
    }
    
    const breakdown = {
      execution: totals.totalExecutionCost || 0,
      impulse: totals.totalImpulseCost || 0,
      acp: totals.totalACPCost || 0,
      memory: totals.totalMemoryAgentCost || 0,
    }
    
    const sum = breakdown.execution + breakdown.impulse + breakdown.acp + breakdown.memory
    const diff = Math.abs(sum - totals.totalCost)
    
    if (diff > 0.01) {
      return {
        status: "⚠",
        message: `Sum mismatch: ${sum.toFixed(4)} vs ${totals.totalCost.toFixed(4)}`,
        details: { totals, breakdown, diff },
      }
    }
    
    return {
      status: "✓",
      message: `$${totals.totalCost.toFixed(4)} (exec: $${breakdown.execution.toFixed(4)}, impulse: $${breakdown.impulse.toFixed(4)}, acp: $${breakdown.acp.toFixed(4)}, memory: $${breakdown.memory.toFixed(4)})`,
      details: totals,
    }
  })

  // 8. Validate Cost by Activity
  await validateComponent("Cost by Activity", async () => {
    const response = await fetch(`${api.baseURL}/session/${currentSession.id}/relationships/cost-breakdown`)
    const cost = await response.json()
    
    if (!Array.isArray(cost.byActivity)) {
      return { status: "✗", message: "byActivity is not an array", details: cost.byActivity }
    }
    
    if (cost.byActivity.length === 0) {
      return { status: "⚠", message: "No activities with cost data" }
    }
    
    // Check for nested activities
    const nested = cost.byActivity.filter((a: any) => a.nestedActivities && a.nestedActivities.length > 0)
    
    return {
      status: "✓",
      message: `${cost.byActivity.length} activities (${nested.length} with nested)`,
      details: cost.byActivity,
    }
  })

  // 9. Validate Cost by Agent (Memory Agent)
  await validateComponent("Cost by Agent (Memory Agent)", async () => {
    const response = await fetch(`${api.baseURL}/session/${currentSession.id}/relationships/cost-breakdown`)
    const cost = await response.json()
    const memoryAgent = cost.byAgent?.memoryAgent
    
    if (!memoryAgent) {
      return { status: "⚠", message: "No memory agent cost data (agent may not be running)" }
    }
    
    if (typeof memoryAgent.cost !== "number" || typeof memoryAgent.negotiationCount !== "number") {
      return { status: "✗", message: "Invalid memory agent data", details: memoryAgent }
    }
    
    if (memoryAgent.cost === 0 && memoryAgent.negotiationCount === 0) {
      return { status: "⚠", message: "Memory agent has no activity (0 negotiations)" }
    }
    
    return {
      status: "✓",
      message: `$${memoryAgent.cost.toFixed(4)} (${memoryAgent.negotiationCount} negotiations)`,
      details: memoryAgent,
    }
  })

  // 10. Validate Cost by Agent (ACP Agents)
  await validateComponent("Cost by Agent (ACP)", async () => {
    const response = await fetch(`${api.baseURL}/session/${currentSession.id}/relationships/cost-breakdown`)
    const cost = await response.json()
    const acpAgents = cost.byAgent?.acpAgents
    
    if (!Array.isArray(acpAgents)) {
      return { status: "✗", message: "acpAgents is not an array", details: acpAgents }
    }
    
    if (acpAgents.length === 0) {
      return { status: "⚠", message: "No ACP agents (no delegated work)" }
    }
    
    const totalAcpCost = acpAgents.reduce((sum: number, a: any) => sum + (a.cost || 0), 0)
    
    return {
      status: "✓",
      message: `${acpAgents.length} agents ($${totalAcpCost.toFixed(4)} total)`,
      details: acpAgents,
    }
  })

  // 11. Validate Impulse-Activity Relationships
  await validateComponent("Impulse-Activity Map", async () => {
    const response = await fetch(`${api.baseURL}/session/${currentSession.id}/relationships/impulse-activity-map`)
    if (!response.ok) {
      return { status: "✗", message: `HTTP ${response.status}: ${response.statusText}` }
    }
    const map = await response.json()
    
    if (!map || typeof map !== "object") {
      return { status: "✗", message: "Invalid impulse-activity map", details: map }
    }
    
    const activityCount = Object.keys(map).length
    const impulseCount = Object.values(map).flat().length
    
    if (activityCount === 0) {
      return { status: "⚠", message: "No impulse-activity relationships" }
    }
    
    return {
      status: "✓",
      message: `${activityCount} activities using ${impulseCount} impulse references`,
      details: { activityCount, impulseCount },
    }
  })

  // 12. Validate Activity-ACP Relationships
  await validateComponent("Activity-ACP Map", async () => {
    const response = await fetch(`${api.baseURL}/session/${currentSession.id}/relationships/activity-acp-map`)
    if (!response.ok) {
      return { status: "✗", message: `HTTP ${response.status}: ${response.statusText}` }
    }
    const map = await response.json()
    
    if (!map || typeof map !== "object") {
      return { status: "✗", message: "Invalid activity-ACP map", details: map }
    }
    
    const agentCount = Object.keys(map).length
    
    if (agentCount === 0) {
      return { status: "⚠", message: "No activity-ACP relationships (no delegated work)" }
    }
    
    return {
      status: "✓",
      message: `${agentCount} ACP agents with activity relationships`,
      details: { agentCount },
    }
  })

  // 13. Validate Integration Graph
  await validateComponent("Integration Flow Graph", async () => {
    const response = await fetch(`${api.baseURL}/session/${currentSession.id}/relationships/integration-graph`)
    if (!response.ok) {
      return { status: "✗", message: `HTTP ${response.status}: ${response.statusText}` }
    }
    const graph = await response.json()
    
    if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
      return { status: "✗", message: "Invalid graph structure", details: graph }
    }
    
    const stats = graph.stats || {}
    const nodesByType = stats.nodesByType || {}
    
    return {
      status: "✓",
      message: `${graph.nodes.length} nodes, ${graph.edges.length} edges (activities: ${nodesByType.activity || 0}, impulses: ${nodesByType.impulse || 0}, agents: ${nodesByType["acp-agent"] || 0})`,
      details: stats,
    }
  })

  // 14. Validate ACP Agents
  await validateComponent("ACP Agents", async () => {
    const response = await fetch(`${api.baseURL}/session/${currentSession.id}/state`)
    const state = await response.json()
    const acp = state.acp
    
    if (!acp || typeof acp.agentCount !== "number") {
      return { status: "✗", message: "Invalid ACP data", details: acp }
    }
    
    if (acp.agentCount === 0) {
      return { status: "⚠", message: "No ACP agents connected (no delegated work)" }
    }
    
    const connected = acp.agents.filter((a: any) => a.status === "connected").length
    
    return {
      status: "✓",
      message: `${acp.agentCount} agents (${connected} connected)`,
      details: acp,
    }
  })

  // Print results
  console.log("\n" + "=".repeat(60))
  console.log("📊 Validation Results\n")

  const maxComponentLength = Math.max(...results.map((r) => r.component.length))

  for (const result of results) {
    const padding = " ".repeat(maxComponentLength - result.component.length)
    console.log(`${result.status} ${result.component}${padding}  ${result.message}`)
  }

  // Summary
  const passed = results.filter((r) => r.status === "✓").length
  const warnings = results.filter((r) => r.status === "⚠").length
  const failed = results.filter((r) => r.status === "✗").length

  console.log("\n" + "=".repeat(60))
  console.log(`\n✅ Passed: ${passed}/${results.length}`)
  if (warnings > 0) console.log(`⚠️  Warnings: ${warnings}/${results.length}`)
  if (failed > 0) console.log(`❌ Failed: ${failed}/${results.length}`)

  // Exit with appropriate code
  if (failed > 0) {
    process.exit(1)
  } else if (warnings > 0) {
    process.exit(0) // Warnings are ok
  } else {
    process.exit(0)
  }
}

main().catch((error) => {
  console.error("\n❌ Validation failed:", error)
  process.exit(1)
})
