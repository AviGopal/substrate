#!/bin/bash
set -e

# Fix impulse-unload.ts
cat > impulse-unload-new.ts << 'ENDFILE'
import { Tool } from "./tool"
import DESCRIPTION from "./impulse-unload.txt"
import { ActivityTemplate } from "../session/activity-template"
import { SessionMemory } from "../session/session-memory"
import { ImpulseResolver } from "../session/impulse-resolver"
import { Session } from "../session"
import { Bus } from "../bus"
import z from "zod"
import { Log } from "../util/log"

const log = Log.create({ service: "impulse-unload" })

export const ImpulseUnloadTool = Tool.define("impulse_unload", async () => {
  return {
    description: DESCRIPTION,
    parameters: z.object({
      id: z.string().describe("Impulse identifier to unload"),
    }),
    async execute(params, context): Promise<{ title: string; output: string; metadata: any }> {
      // ✅ ALWAYS use SessionMemory (single source of truth)
      const sessionID = context.sessionID

      // Get impulse from SessionMemory
      const impulse = await SessionMemory.getImpulse(sessionID, params.id)

      if (!impulse) {
        log.error("impulse not found", { id: params.id, sessionID })
        return {
          title: "Error",
          output: `Impulse '${params.id}' not found`,
          metadata: { success: false, error: "impulse_not_found", id: params.id },
        }
      }

      const freedTokens = impulse.tokenCount || 0
      const wasLoaded = impulse.loaded

      const unloaded = ImpulseResolver.unload(impulse)

      // ✅ Save to SessionMemory
      await SessionMemory.updateImpulse(sessionID, params.id, unloaded)

      // Publish impulse lifecycle event
      await Bus.publish(Session.Event.ImpulseUpdated, {
        sessionID,
        impulseId: params.id,
        action: "unloaded",
      })

      log.info("unloaded impulse", {
        id: params.id,
        freedTokens,
        wasLoaded,
        sessionID,
      })

      const message = wasLoaded
        ? `Unloaded impulse '${params.id}' (freed ${freedTokens} tokens)`
        : `Impulse '${params.id}' was not loaded (no-op)`

      return {
        title: `Unloaded impulse: ${params.id}`,
        output: message,
        metadata: {
          success: true,
          id: params.id,
          freedTokens: wasLoaded ? freedTokens : 0,
          wasLoaded,
        },
      }
    },
  }
})
ENDFILE

cp impulse-unload-new.ts repos/metabob-opencode/packages/opencode/src/tool/impulse-unload.ts
echo "✓ Fixed impulse-unload.ts"

# Fix impulse-delete.ts
cat > impulse-delete-new.ts << 'ENDFILE'
import { Tool } from "./tool"
import DESCRIPTION from "./impulse-delete.txt"
import { SessionMemory } from "../session/session-memory"
import { Session } from "../session"
import { Bus } from "../bus"
import z from "zod"
import { Log } from "../util/log"

const log = Log.create({ service: "impulse-delete" })

export const ImpulseDeleteTool = Tool.define("impulse_delete", async () => {
  return {
    description: DESCRIPTION,
    parameters: z.object({
      id: z.string().describe("Impulse identifier to delete"),
    }),
    async execute(params, context): Promise<{ title: string; output: string; metadata: any }> {
      // ✅ ALWAYS use SessionMemory (single source of truth)
      const sessionID = context.sessionID

      // Get impulse from SessionMemory
      const impulse = await SessionMemory.getImpulse(sessionID, params.id)

      if (!impulse) {
        log.error("impulse not found", { id: params.id, sessionID })
        return {
          title: "Error",
          output: `Impulse '${params.id}' not found`,
          metadata: { success: false, error: "impulse_not_found", id: params.id },
        }
      }

      const freedTokens = impulse.loaded ? (impulse.tokenCount || 0) : 0

      // ✅ Delete from SessionMemory
      await SessionMemory.deleteImpulse(sessionID, params.id)

      // Publish impulse lifecycle event
      await Bus.publish(Session.Event.ImpulseUpdated, {
        sessionID,
        impulseId: params.id,
        action: "deleted",
      })

      log.info("deleted impulse", {
        id: params.id,
        freedTokens,
        sessionID,
      })

      return {
        title: `Deleted impulse: ${params.id}`,
        output: `Deleted impulse '${params.id}'${freedTokens > 0 ? ` (freed ${freedTokens} tokens)` : ""}`,
        metadata: {
          success: true,
          id: params.id,
          freedTokens,
        },
      }
    },
  }
})
ENDFILE

cp impulse-delete-new.ts repos/metabob-opencode/packages/opencode/src/tool/impulse-delete.ts
echo "✓ Fixed impulse-delete.ts"

echo "All impulse tools fixed!"
