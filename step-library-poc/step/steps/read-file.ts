// Read File Step
import { readFile } from 'fs/promises'
import { StepRegistry } from '../step-registry.js'

StepRegistry.register({
  id: 'read-file',
  name: 'Read File',
  description: 'Read contents of a file',
  category: 'filesystem',
  inputSchema: { path: 'string' },
  outputSchema: { content: 'string' },
  timeout: 5000
})

export async function readFileStep(input: { path: string }) {
  const content = await readFile(input.path, 'utf-8')
  return {
    success: true,
    output: { content }
  }
}
