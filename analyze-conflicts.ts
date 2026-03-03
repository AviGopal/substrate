#!/usr/bin/env bun

// Files modified by MCP Tool Call Enforcement
const mcpEnforcementFiles = [
  "repos/metabob-opencode/packages/opencode/src/tool/activity.ts",
  "repos/metabob-opencode/packages/opencode/src/tool/impulse-create.ts",
  "repos/metabob-opencode/packages/opencode/src/session/template-loader.ts",
  "repos/metabob-opencode/packages/opencode/src/mcp/index.ts"
]

// Files modified by bootstrap template filepath compliance
const bootstrapFiles = [
  "repos/metabob-opencode/packages/opencode/src/session/activity-template.ts" // bootstrap template loading
]

// Files modified by instance invariant storage
const storageFiles = [
  "repos/metabob-opencode/packages/opencode/src/session/activity-state.ts", // activity storage
  "repos/metabob-opencode/packages/opencode/src/session/impulse-learning.ts" // learning storage
]

const conflicts = []
const sharedComponents = []

// Check for overlaps
const allFiles = [
  ...mcpEnforcementFiles,
  ...bootstrapFiles,
  ...storageFiles
]

const fileCounts = allFiles.reduce((acc, file) => {
  acc[file] = (acc[file] || 0) + 1
  return acc
}, {} as Record<string, number>)

const sharedFiles = Object.entries(fileCounts).filter(([_, count]) => count > 1)

if (sharedFiles.length > 0) {
  console.log("Shared files detected:")
  sharedFiles.forEach(([file, count]) => {
    console.log(`  ${file}: modified by ${count} specifications`)
  })
} else {
  console.log("No shared files detected - specifications modify different components")
}

// Analyze for logical conflicts
console.log("\nLogical Conflict Analysis:")

// MCP Enforcement adds strictBackend mode (requires backend)
// Bootstrap Filepath Compliance ensures embedded loading works (no backend required)
// These could conflict if strictBackend=true but MCP unavailable

console.log("1. MCP Enforcement vs Bootstrap Loading:")
console.log("   - MCP Enforcement: strictBackend=true requires backend connectivity")
console.log("   - Bootstrap Compliance: Embedded loading works without backend")
console.log("   - Conflict: POTENTIAL - strictBackend=true would fail if MCP unavailable, even with embedded bootstrap")
console.log("   - Resolution: strictBackend should allow embedded bootstrap templates as exception")

// Instance Invariant Storage uses backend sync (via MCP)
// MCP Enforcement makes backend failures visible
// These are COMPLEMENTARY

console.log("\n2. MCP Enforcement vs Instance Storage:")
console.log("   - MCP Enforcement: Elevates backend sync failures to ERROR level")
console.log("   - Instance Storage: Uses backend sync for cross-instance access")
console.log("   - Conflict: NONE - Complementary. Enhanced logging helps debug storage sync issues")

console.log("\nConflict Summary:")
console.log("  - Critical Conflicts: 0")
console.log("  - Potential Conflicts: 1 (strictBackend vs embedded bootstrap)")
console.log("  - Complementary: 1 (MCP logging + storage sync)")
