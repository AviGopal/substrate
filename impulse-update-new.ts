import { Tool } from "./tool"
import DESCRIPTION from "./impulse-update.txt"
import { ActivityTemplate } from "../session/activity-template"
import { SessionMemory } from "../session/session-memory"
import { Session } from "../session"
import { Bus } from "../bus"
import z from "zod"
import { Log } from "../util/log"

const log = Log.create({ service: "impulse-update" })

export const ImpulseUpdateTool = Tool.define("impulse_update", async () => {
  return {
    description: DESCRIPTION,
    parameters: z.object({
      id: z.string().describe("Impulse identifier to update"),
      budget: z.number().optional().describe("New token budget"),
      priority: z.enum(["high", "medium", "low"]).optional().describe("New priority"),
      metadata: z.record(z.string(), z.unknown()).optional().describe("New metadata (merges with existing)"),
    }),
    async execute(params, context): Promise<{ title: string; output: string; metadata: any }> {
      // ✅ ALWAYS use SessionMemory (single source of truth)
      const sessionID = context.sessionID

      // Get impulse from SessionMemory
      let impulse = await SessionMemory.getImpulse(sessionID, params.id)

      if (!impulse) {
        log.error("impulse not found", { id: params.id, sessionID })
        return {
          title: "Error",
          output: `Impulse '${params.id}' not found`,
          metadata: { success: false, error: "impulse_not_found", id: params.id },
        }
      }

      const oldValues = {
        budget: impulse.budget,
        priority: impulse.priority,
      }

      // Build updates object
      const updates: Partial<ActivityTemplate.Impulse.Schema> = {}
      if (params.budget !== undefined) {
        updates.budget = params.budget
      }
      if (params.priority !== undefined) {
        updates.priority = params.priority
      }
      if (params.metadata !== undefined) {
        // Merge with existing metadata
        updates.metadata = { ...impulse.metadata, ...params.metadata }
      }

      // ✅ Update in SessionMemory
      await SessionMemory.updateImpulse(sessionID, params.id, updates)
      impulse = { ...impulse, ...updates }

      // Publish impulse lifecycle event
      await Bus.publish(Session.Event.ImpulseUpdated, {
        sessionID,
        impulseId: params.id,
        action: "updated",
      })

      const changes = []
      if (params.budget !== undefined) changes.push(`budget: ${oldValues.budget} → ${params.budget}`)
      if (params.priority !== undefined) changes.push(`priority: ${oldValues.priority} → ${params.priority}`)
      if (params.metadata !== undefined) changes.push("metadata: updated")

      log.info("updated impulse", {
        id: params.id,
        sessionID,
        changes: changes.join(", "),
      })

      return {
        title: `Updated impulse: ${params.id}`,
        output: `Updated impulse '${params.id}': ${changes.join(", ")}`,
        metadata: {
          success: true,
          impulse: {
            id: impulse.id,
            type: impulse.type,
            budget: impulse.budget,
            priority: impulse.priority,
            loaded: impulse.loaded,
            metadata: impulse.metadata,
          },
          changes: changes.length,
        },
      }
    },
  }
})
