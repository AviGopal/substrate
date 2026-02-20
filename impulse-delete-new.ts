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
