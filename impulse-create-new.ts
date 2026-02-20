import { Tool } from "./tool"
import DESCRIPTION from "./impulse-create.txt"
import { ActivityTemplate } from "../session/activity-template"
import { Activity } from "../session/activity"
import { SessionMemory } from "../session/session-memory"
import { Session } from "../session"
import { Bus } from "../bus"
import z from "zod"
import { Log } from "../util/log"

const log = Log.create({ service: "impulse-create" })

export const ImpulseCreateTool = Tool.define("impulse_create", async () => {
  return {
    description: DESCRIPTION,
    parameters: z.object({
      id: z.string().describe("Unique impulse identifier"),
      pointer: ActivityTemplate.Impulse.Pointer.describe("Serializable pointer to content"),
      budget: z.number().describe("Token allocation for this impulse"),
      priority: z.enum(["high", "medium", "low"]).default("medium").describe("Loading priority"),
      type: z.string().optional().describe("Impulse type for categorization"),
      metadata: z.record(z.string(), z.unknown()).optional().describe("Additional metadata"),
    }),
    async execute(params, context): Promise<{ title: string; output: string; metadata: any }> {
      // ✅ ALWAYS use SessionMemory (single source of truth)
      const sessionID = context.sessionID
      
      // Track which activity created this impulse (for metrics/debugging)
      const createdByActivity = Activity.getActivityForSession(sessionID)

      // Check if impulse already exists in session
      const existing = await SessionMemory.getImpulse(sessionID, params.id)
      if (existing) {
        log.error("impulse already exists", { id: params.id, sessionID })
        return {
          title: "Error",
          output: `Impulse '${params.id}' already exists in session`,
          metadata: {
            success: false,
            error: "impulse_exists",
          },
        }
      }

      // Create session-scoped impulse (always)
      const impulse: ActivityTemplate.Impulse.Schema = {
        id: params.id,
        type: params.type || params.pointer.type,
        pointer: params.pointer,
        budget: params.budget,
        priority: params.priority,
        loaded: false,
        metadata: {
          ...params.metadata,
          // Track which activity created this impulse
          createdBy: createdByActivity,
          createdAt: Date.now(),
        },
        scope: "session",
        sessionID,
      }

      // ✅ Store in SessionMemory (shared across execution graph)
      await SessionMemory.addImpulse(sessionID, impulse)

      // Publish impulse lifecycle event
      await Bus.publish(Session.Event.ImpulseUpdated, {
        sessionID,
        impulseId: params.id,
        action: "created",
      })

      // Track activity stats (NOT storage, just metrics)
      if (createdByActivity) {
        await Activity.updateMemoryStats(createdByActivity, {
          impulsesCreated: +1,
        }).catch((error) => {
          log.debug("failed to update activity memory stats", { 
            activityId: createdByActivity, 
            error 
          })
        })
      }

      log.info("created session-scoped impulse", {
        id: params.id,
        type: impulse.type,
        budget: params.budget,
        sessionID,
        createdBy: createdByActivity,
      })

      return {
        title: `Created impulse: ${params.id}`,
        output: `Created impulse '${params.id}' with ${params.budget} token budget`,
        metadata: {
          success: true,
          impulse: {
            id: params.id,
            type: params.type || params.pointer.type,
            budget: params.budget,
            priority: params.priority,
            loaded: false,
            createdBy: createdByActivity,
          },
        },
      }
    },
  }
})
