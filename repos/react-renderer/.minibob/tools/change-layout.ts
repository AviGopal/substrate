// change_layout tool — moves, resizes, or re-layers an existing impulse.
// Calls the renderer's layout_change resolver via POST /resolve.

interface ChangeLayoutArgs {
  impulseId: string
  position?: { type: 'flow' | 'center' | 'absolute' | 'below-input'; x?: number; y?: number }
  layer?: number
  size?: { width: string; height: string } | 'auto'
}

interface ToolResult {
  success: boolean
  output: string
  error?: string
}

export async function execute(args: ChangeLayoutArgs): Promise<ToolResult> {
  const endpoint = process.env.REACT_RENDERER_ENDPOINT ?? 'http://localhost:3001'
  const apiKey = process.env.METABOB_API_KEY
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiKey) headers['Authorization'] = `ApiKey ${apiKey}`

  let response: Response
  try {
    response = await fetch(`${endpoint}/resolve`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        pointer: {
          type: 'layout_change',
          impulseId: args.impulseId,
          ...(args.position && { position: args.position }),
          ...(typeof args.layer === 'number' && { layer: args.layer }),
          ...(args.size && { size: args.size }),
        },
      }),
    })
  } catch (err) {
    return { success: false, output: '', error: `Could not reach renderer: ${err}` }
  }

  if (!response.ok) {
    return { success: false, output: '', error: `HTTP ${response.status}: ${await response.text()}` }
  }

  return { success: true, output: `Layout updated for impulse ${args.impulseId}` }
}
