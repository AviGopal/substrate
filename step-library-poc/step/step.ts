// Step Library - Core Types
// Simple, focused, working code

import { z } from 'zod'

export const StepSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.enum(['filesystem', 'code', 'test', 'git', 'llm', 'data']),
  inputSchema: z.any(),
  outputSchema: z.any(),
  timeout: z.number().default(30000),
})

export type Step = z.infer<typeof StepSchema>

export interface StepResult {
  success: boolean
  output?: any
  error?: string
  duration: number
}

export type StepExecutor = (input: any) => Promise<StepResult>
