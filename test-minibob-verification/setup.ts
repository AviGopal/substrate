#!/usr/bin/env bun
/**
 * Test Environment Setup
 * 
 * Verifies all prerequisites before running tests:
 * - Kubernetes cluster accessible
 * - Backend services healthy
 * - DNS resolution working
 * - MiniBob library linked
 */

import { $ } from "bun"

interface HealthCheck {
  name: string
  check: () => Promise<boolean>
  required: boolean
  fix?: string
}

const checks: HealthCheck[] = [
  {
    name: "Kubernetes context",
    check: async () => {
      try {
        const result = await $`kubectl config current-context`.text()
        console.log(`  Current context: ${result.trim()}`)
        return true
      } catch {
        return false
      }
    },
    required: true,
    fix: "Run: kubectl config use-context docker-desktop"
  },
  
  {
    name: "MiniBob pod running",
    check: async () => {
      try {
        const result = await $`kubectl get pods -n activity-system -l app=minibob -o json`.json()
        const pods = result.items || []
        const running = pods.filter((p: any) => p.status.phase === "Running")
        console.log(`  MiniBob pods: ${running.length}/${pods.length} running`)
        return running.length > 0
      } catch {
        return false
      }
    },
    required: true,
    fix: "Deploy minibob: cd helm && helmfile -f minibob-cluster.yaml apply"
  },
  
  {
    name: "Backend API healthy",
    check: async () => {
      try {
        const response = await fetch("http://api.minibob.local/health")
        const data = await response.json() as { status: string }
        console.log(`  API status: ${data.status}`)
        return data.status === "healthy"
      } catch (error) {
        console.log(`  API error: ${error}`)
        return false
      }
    },
    required: true,
    fix: "Check /etc/hosts has: 127.0.0.1 api.minibob.local"
  },
  
  {
    name: "Dashboard accessible",
    check: async () => {
      try {
        const response = await fetch("http://dashboard.minibob.local")
        console.log(`  Dashboard status: ${response.status}`)
        return response.ok
      } catch {
        return false
      }
    },
    required: false,
    fix: "Check /etc/hosts has: 127.0.0.1 dashboard.minibob.local"
  },
  
  {
    name: "SurrealDB healthy",
    check: async () => {
      try {
        const result = await $`kubectl get pods -n metabob -l app=surrealdb -o json`.json()
        const pods = result.items || []
        const running = pods.filter((p: any) => p.status.phase === "Running")
        console.log(`  SurrealDB pods: ${running.length}/${pods.length} running`)
        return running.length > 0
      } catch {
        return false
      }
    },
    required: true,
    fix: "Deploy database: cd helm && helmfile apply"
  },
  
  {
    name: "MiniBob library linked",
    check: async () => {
      try {
        // Check if @metabob/minibob can be imported
        await import("../repos/minibob/dist/lib.js")
        console.log("  Library import: ✅")
        return true
      } catch (error) {
        console.log(`  Library import failed: ${error}`)
        return false
      }
    },
    required: true,
    fix: "Link library: cd repos/minibob && bun link && cd ../metabob-opencode && bun link @metabob/minibob"
  }
]

async function main() {
  console.log("MiniBob Verification Test Suite - Environment Setup")
  console.log("=" .repeat(60))
  console.log()
  
  let allPassed = true
  const failures: Array<{ name: string; fix: string }> = []
  
  for (const healthCheck of checks) {
    process.stdout.write(`Checking: ${healthCheck.name}... `)
    
    const passed = await healthCheck.check()
    
    if (passed) {
      console.log("✅")
    } else {
      console.log(healthCheck.required ? "❌ REQUIRED" : "⚠️  OPTIONAL")
      
      if (healthCheck.required) {
        allPassed = false
        failures.push({ 
          name: healthCheck.name, 
          fix: healthCheck.fix || "No fix available" 
        })
      }
    }
    console.log()
  }
  
  console.log("=" .repeat(60))
  
  if (allPassed) {
    console.log("✅ All checks passed! Ready to run tests.")
    console.log()
    console.log("Run tests with:")
    console.log("  bun run all-tests.ts          # All tests")
    console.log("  bun run tests/01-*.ts         # Individual test")
    console.log()
    console.log("Monitor via dashboard:")
    console.log("  http://dashboard.minibob.local")
    console.log()
    process.exit(0)
  } else {
    console.log("❌ Some required checks failed")
    console.log()
    console.log("Fixes:")
    for (const failure of failures) {
      console.log(`  ${failure.name}:`)
      console.log(`    ${failure.fix}`)
      console.log()
    }
    process.exit(1)
  }
}

main().catch(error => {
  console.error("Setup failed:", error)
  process.exit(1)
})
