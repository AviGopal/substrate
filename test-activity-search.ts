#!/usr/bin/env bun
/**
 * Test script to diagnose activity search issues
 */

import { MCP } from "./repos/metabob-opencode/packages/opencode/src/mcp"
import { MetabobCLI } from "./repos/metabob-opencode/packages/opencode/src/util/metabob"

async function main() {
  console.log("=== Activity Search Diagnostic ===\n")

  // Step 1: Check MCP client availability
  console.log("Step 1: Checking MCP client...")
  const clients = await MCP.clients()
  const metabobClient = clients["metabob"]
  
  if (!metabobClient) {
    console.error("❌ Metabob MCP client not found!")
    console.log("Available clients:", Object.keys(clients))
    process.exit(1)
  }
  console.log("✓ Metabob MCP client found\n")

  // Step 2: List available tools
  console.log("Step 2: Listing available tools...")
  try {
    const toolsResult = await metabobClient.listTools()
    const toolNames = toolsResult.tools.map(t => t.name).sort()
    console.log("✓ Available tools:", toolNames.length)
    console.log("  ", toolNames.join(", "))
    console.log()

    // Check for search_activities
    const hasSearchActivities = toolNames.includes("search_activities")
    console.log(hasSearchActivities 
      ? "✓ search_activities tool found" 
      : "❌ search_activities tool NOT found")
    console.log()
  } catch (error) {
    console.error("❌ Failed to list tools:", error)
    process.exit(1)
  }

  // Step 3: Test search_activities directly via MCP
  console.log("Step 3: Testing search_activities via MCP...")
  try {
    const result = await metabobClient.callTool({
      name: "search_activities",
      arguments: {
        query: "",
        category: "",
        limit: 5,
        min_success_rate: 0.0,
      }
    })
    
    console.log("✓ MCP call succeeded")
    console.log("  Result type:", typeof result)
    console.log("  Result keys:", result ? Object.keys(result) : "none")
    
    if (result && (result as any).content) {
      const content = (result as any).content
      if (Array.isArray(content)) {
        const textContent = content
          .filter((item: any) => item.type === "text")
          .map((item: any) => item.text)
          .join("\n")
        
        try {
          const parsed = JSON.parse(textContent)
          console.log("  Status:", parsed.status)
          console.log("  Activities found:", parsed.activities?.length || 0)
          
          if (parsed.activities && parsed.activities.length > 0) {
            console.log("\n  Sample activities:")
            parsed.activities.slice(0, 3).forEach((act: any, idx: number) => {
              console.log(`    ${idx + 1}. ${act.activity_id || act.id} - ${act.name}`)
            })
          }
        } catch (parseError) {
          console.log("  Raw content:", textContent.slice(0, 200))
        }
      }
    }
    console.log()
  } catch (error) {
    console.error("❌ search_activities call failed:", error)
    console.log()
  }

  // Step 4: Test via MetabobCLI wrapper
  console.log("Step 4: Testing via MetabobCLI.searchActivities...")
  try {
    const activities = await MetabobCLI.searchActivities("", { limit: 5 })
    console.log("✓ MetabobCLI.searchActivities succeeded")
    console.log("  Activities returned:", activities.length)
    
    if (activities.length > 0) {
      console.log("\n  Sample activities:")
      activities.slice(0, 3).forEach((act: any, idx: number) => {
        console.log(`    ${idx + 1}. ${act.activity_id || act.id} - ${act.name}`)
      })
    } else {
      console.log("  ⚠️  No activities returned (empty array)")
    }
    console.log()
  } catch (error) {
    console.error("❌ MetabobCLI.searchActivities failed:", error)
    console.log()
  }

  // Step 5: Check TemplateLoader
  console.log("Step 5: Testing TemplateLoader.list...")
  try {
    const { TemplateLoader } = await import("./repos/metabob-opencode/packages/opencode/src/session/template-loader")
    const result = await TemplateLoader.list()
    console.log("✓ TemplateLoader.list succeeded")
    console.log("  Templates returned:", result.templates.length)
    console.log("  Source:", result.source)
    
    if (result.templates.length > 0) {
      console.log("\n  Sample templates:")
      result.templates.slice(0, 3).forEach((tmpl: any, idx: number) => {
        console.log(`    ${idx + 1}. ${tmpl.id} - ${tmpl.name}`)
      })
    } else {
      console.log("  ⚠️  No templates returned (empty array)")
    }
    console.log()
  } catch (error) {
    console.error("❌ TemplateLoader.list failed:", error)
    console.log()
  }

  console.log("=== Diagnostic Complete ===")
}

main().catch(console.error)
