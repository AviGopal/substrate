import { Tool } from "./tool"
import DESCRIPTION from "./impulse-list.txt"
import { SessionMemory } from "../session/session-memory"
import z from "zod"
import { Log } from "../util/log"

const log = Log.create({ service: "impulse-list" })

export const ImpulseListTool = Tool.define("impulse_list", async () => {
  return {
    description: DESCRIPTION,
    parameters: z.object({
      loaded: z.boolean().optional().describe("Filter by loaded status"),
      priority: z.enum(["high", "medium", "low"]).optional().describe("Filter by priority"),
    }),
    async execute(params, context): Promise<{ title: string; output: string; metadata: any }> {
      // ✅ ALWAYS use SessionMemory (single source of truth)
      const sessionID = context.sessionID

      // Load impulses from SessionMemory
      let impulses = await SessionMemory.listImpulses(sessionID)

      // Apply filters
      if (params.loaded !== undefined) {
        impulses = impulses.filter((i) => i.loaded === params.loaded)
      }
      if (params.priority) {
        impulses = impulses.filter((i) => i.priority === params.priority)
      }

      // Calculate stats
      const totalBudget = impulses.reduce((sum, i) => sum + i.budget, 0)
      const usedTokens = impulses.reduce((sum, i) => sum + (i.tokenCount || 0), 0)
      const loadedCount = impulses.filter((i) => i.loaded).length

      const impulseList = impulses.map((i) => ({
        id: i.id,
        type: i.type,
        priority: i.priority,
        budget: i.budget,
        loaded: i.loaded,
        tokenCount: i.tokenCount,
        pointerType: i.pointer.type,
        createdBy: i.metadata?.createdBy,
      }))

      const stats = {
        total: impulses.length,
        loaded: loadedCount,
        unloaded: impulses.length - loadedCount,
        totalBudget,
        usedTokens,
        utilization: totalBudget > 0 ? Math.round((usedTokens / totalBudget) * 100) : 0,
      }

      log.info("listed impulses", { sessionID, ...stats })

      let output = `Found ${impulses.length} impulse(s) in session\n\n`

      if (impulses.length > 0) {
        output += "Impulses:\n"
        for (const imp of impulseList) {
          output += `  - ${imp.id} (${imp.pointerType}): ${imp.loaded ? "loaded" : "unloaded"}, `
          output += `${imp.tokenCount || 0}/${imp.budget} tokens, priority: ${imp.priority}`
          if (imp.createdBy) {
            output += `, created by: ${imp.createdBy.slice(0, 8)}`
          }
          output += `\n`
        }

        output += `\nStats:\n`
        output += `  Total impulses: ${stats.total}\n`
        output += `  Loaded: ${stats.loaded}, Unloaded: ${stats.unloaded}\n`
        output += `  Total budget: ${stats.totalBudget} tokens\n`
        output += `  Used tokens: ${stats.usedTokens} tokens\n`
        output += `  Utilization: ${stats.utilization}%\n`
      } else {
        output += "No impulses found matching filters.\n"
      }

      return {
        title: "Impulse List",
        output,
        metadata: {
          success: true,
          impulses: impulseList,
          stats,
        },
      }
    },
  }
})
