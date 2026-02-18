// Step Executor - Run steps with timeout and error handling

import type { Step, StepResult, StepExecutor } from './step.js'

export async function executeStep(
  step: Step,
  executor: StepExecutor,
  input: any
): Promise<StepResult> {
  const start = Date.now()
  
  try {
    // Simple timeout implementation
    const result = await Promise.race([
      executor(input),
      new Promise<StepResult>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), step.timeout)
      )
    ])
    
    return {
      ...result,
      duration: Date.now() - start
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      duration: Date.now() - start
    }
  }
}
