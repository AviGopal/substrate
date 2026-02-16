/**
 * Direct test of template loading using the activity tool
 */

// Import directly from source (Bun will handle TypeScript)
const templateLoaderPath = "./repos/metabob-opencode/packages/opencode/src/session/template-loader.ts";

console.log("Testing template loading with fixed TemplateLoader...\n");

// Use the activity tool approach
import { $ } from "bun";

async function testViaActivityTool() {
  try {
    // Start an interactive session and try to use the activity tool
    const testScript = `
      Tell me about the fix-bug-complete activity template
    `;
    
    console.log("Attempting to query fix-bug-complete template via opencode...");
    
    // Try using opencode's MCP interface to check templates
    const result = await $`opencode mcp call search_activities --verbose=true --category=bugfix`.text();
    console.log("Search results:", result);
    
  } catch (error) {
    console.error("Error:", error.message);
  }
}

testViaActivityTool();
