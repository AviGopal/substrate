#!/usr/bin/env bun
/**
 * Register activity template using the proper register_activity_template tool
 * This follows the documented workflow in ACTIVITY_TEMPLATE_CREATION_GUIDE.md
 */

import { Instance } from "../repos/metabob-opencode/packages/opencode/src/project/instance"
import { RegisterActivityTemplateTool } from "../repos/metabob-opencode/packages/opencode/src/tool/register-activity-template"
import { resolve } from "path"

const templatePath = resolve(
  __dirname,
  "../repos/metabob-opencode/packages/opencode/templates/built-in/debug-activity-self-contained-v3.json"
)

console.log(`📋 Registering template: ${templatePath}`)

await Instance.provide({
  directory: process.cwd(),
  async fn() {
    // Initialize the tool
    const toolDef = await RegisterActivityTemplateTool.init()
    
    // Execute it with proper context
    const result = await toolDef.execute(
      {
        file_path: templatePath,
        register_with_metabob: true,
      },
      { 
        sessionID: "registration-session",
        messageID: "msg-register",
        agent: "activity",
        abort: new AbortController().signal,
        metadata: () => {}
      }
    )
    
    console.log("\n" + result.output)
    console.log("\nMetadata:", JSON.stringify(result.metadata, null, 2))
  }
})
