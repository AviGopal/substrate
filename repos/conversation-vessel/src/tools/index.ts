import { z } from 'zod';
import { defaultLLMToLLMResolver } from '../resolvers/llm-to-llm';

// Tool parameter schemas
export const bashParams = z.object({ command: z.string() });
export const readParams = z.object({ path: z.string(), offset: z.number().optional(), limit: z.number().optional() });
export const writeParams = z.object({ path: z.string(), content: z.string() });
export const editParams = z.object({ path: z.string(), oldText: z.string(), newText: z.string() });
export const callLLMParams = z.object({
  targetLLMId: z.string(),
  message: z.string(),
  model: z.string().optional(),
  temperature: z.number().optional(),
  maskAsHuman: z.boolean().optional()
});

// Tool definitions for LLM
export const toolDefinitions = {
  bash: { name: 'bash', description: 'Execute shell command', parameters: bashParams },
  read: { name: 'read', description: 'Read file content', parameters: readParams },
  write: { name: 'write', description: 'Write content to file', parameters: writeParams },
  edit: { name: 'edit', description: 'Replace text in file', parameters: editParams },
  callLLM: { 
    name: 'callLLM', 
    description: 'Call another LLM and relay the message, useful for multi-LLM conversations',
    parameters: callLLMParams 
  },
} as const;

export type ToolName = keyof typeof toolDefinitions;

// Tool result type
export interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
}

// Handler implementations using Bun APIs
async function bashHandler(params: z.infer<typeof bashParams>): Promise<ToolResult> {
  try {
    const proc = Bun.spawn(['sh', '-c', params.command], { stdout: 'pipe', stderr: 'pipe' });
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;
    return { success: exitCode === 0, output: stdout, error: stderr || undefined };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function readHandler(params: z.infer<typeof readParams>): Promise<ToolResult> {
  try {
    const file = Bun.file(params.path);
    const content = await file.text();
    const lines = content.split('\n');
    const start = params.offset ?? 0;
    const end = params.limit ? start + params.limit : lines.length;
    return { success: true, output: lines.slice(start, end).join('\n') };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function writeHandler(params: z.infer<typeof writeParams>): Promise<ToolResult> {
  try {
    await Bun.write(params.path, params.content);
    return { success: true, output: `Wrote ${params.content.length} bytes to ${params.path}` };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function editHandler(params: z.infer<typeof editParams>): Promise<ToolResult> {
  try {
    const file = Bun.file(params.path);
    const content = await file.text();
    if (!content.includes(params.oldText)) {
      return { success: false, error: 'Old text not found in file' };
    }
    const newContent = content.replace(params.oldText, params.newText);
    await Bun.write(params.path, newContent);
    return { success: true, output: `Replaced text in ${params.path}` };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// Handler registry
const handlers: Record<ToolName, (params: unknown) => Promise<ToolResult>> = {
  bash: (p) => bashHandler(bashParams.parse(p)),
  read: (p) => readHandler(readParams.parse(p)),
  write: (p) => writeHandler(writeParams.parse(p)),
  edit: (p) => editHandler(editParams.parse(p)),
};

// Execute a tool by name
export async function executeTool(name: ToolName, params: unknown): Promise<ToolResult> {
  const handler = handlers[name];
  if (!handler) return { success: false, error: `Unknown tool: ${name}` };
  return handler(params);
}
