// Step Registry - Simple in-memory storage
// Start with memory, add persistence later

import type { Step } from './step.js'

const steps = new Map<string, Step>()

export const StepRegistry = {
  register(step: Step): void {
    steps.set(step.id, step)
  },
  
  get(id: string): Step | undefined {
    return steps.get(id)
  },
  
  list(): Step[] {
    return Array.from(steps.values())
  },
  
  search(category?: string): Step[] {
    const all = Array.from(steps.values())
    if (!category) return all
    return all.filter(s => s.category === category)
  }
}
