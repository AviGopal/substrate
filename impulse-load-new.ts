import { Tool } from "./tool"
import DESCRIPTION from "./impulse-load.txt"
import { Activity } from "../session/activity"
import { ActivityTemplate } from "../session/activity-template"
import { SessionMemory } from "../session/session-memory"
import { ImpulseResolver } from "../session/impulse-resolver"
import { Session } from "../session"
import { Bus } from "../bus"
import z from "zod"
import { Log } from "../util/log"

const log = Log.create({ service: "impulse-load" })

export const ImpulseLoadTool = Tool.define("impulse_load", async () => {
  return {
    description: DESCRIPTION,
    parameters: z.object({
      id: z.string().describe("Impulse identifier to load"),
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

      if (impulse.loaded) {
        log.info("impulse already loaded", {
          id: params.id,
          tokenCount: impulse.tokenCount,
          sessionID,
        })
        return {
          title: `Impulse already loaded: ${params.id}`,
          output: `Impulse '${params.id}' already loaded (${impulse.tokenCount} tokens)`,
          metadata: {
            success: true,
            impulse: {
              id: impulse.id,
              loaded: impulse.loaded,
              tokenCount: impulse.tokenCount,
              budget: impulse.budget,
              withinBudget: (impulse.tokenCount || 0) <= impulse.budget,
            },
          },
        }
      }

      // Load impulse content
      log.info("loading impulse", { id: params.id, type: impulse.type, sessionID })
      const loaded = await ImpulseResolver.load(impulse)

      // ✅ Save to SessionMemory
      await SessionMemory.updateImpulse(sessionID, params.id, loaded)

      // Publish impulse lifecycle event
      await Bus.publish(Session.Event.ImpulseUpdated, {
        sessionID,
        impulseId: params.id,
        action: "loaded",
      })

      const withinBudget = (loaded.tokenCount || 0) <= loaded.budget
      const budgetStatus = withinBudget ? "within budget" : "over budget"

      log.info("impulse loaded", {
        id: params.id,
        tokenCount: loaded.tokenCount,
        budget: loaded.budget,
        withinBudget,
        sessionID,
      })

      return {
        title: `Loaded impulse: ${params.id}`,
        output: `Loaded impulse '${params.id}' (${loaded.tokenCount}/${loaded.budget} tokens, ${budgetStatus})`,
        metadata: {
          success: true,
          impulse: {
            id: loaded.id,
            loaded: loaded.loaded,
            tokenCount: loaded.tokenCount,
            budget: loaded.budget,
            withinBudget,
            contentLength: loaded.content?.length || 0,
          },
        },
      }
    },
  }
})
