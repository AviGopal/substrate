// render_ui workspace tool
// Pushes a primitive to the react-renderer browser viewport.
// Endpoint discovery: REACT_RENDERER_ENDPOINT env var → localhost:3001 fallback.

interface Primitive {
  type: string
  [key: string]: unknown
}

interface RenderUiArgs {
  primitive: Primitive
  position?: { mode: 'flow' | 'absolute' | 'center'; x?: number; y?: number }
  animation?: 'fade' | 'slide' | 'scale' | 'none'
  priority?: 'high' | 'medium' | 'low'
}

interface ToolResult {
  success: boolean
  output: string
  error?: string
}

export async function execute(args: RenderUiArgs): Promise<ToolResult> {
  const endpoint = process.env.REACT_RENDERER_ENDPOINT ?? 'http://localhost:3001'
  const apiKey = process.env.METABOB_API_KEY

  const body = {
    primitive: args.primitive,
    ...(args.position && { position: args.position }),
    ...(args.animation && { animation: args.animation }),
    ...(args.priority && { priority: args.priority }),
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiKey) headers['Authorization'] = `ApiKey ${apiKey}`

  let response: Response
  try {
    response = await fetch(`${endpoint}/impulses`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
  } catch (err) {
    return {
      success: false,
      output: '',
      error: `Could not reach react-renderer at ${endpoint}: ${err instanceof Error ? err.message : err}`,
    }
  }

  if (!response.ok) {
    const text = await response.text()
    return { success: false, output: '', error: `HTTP ${response.status}: ${text}` }
  }

  const data = await response.json() as { impulse?: { id: string } }
  const impulseId = data.impulse?.id ?? '(unknown)'

  return {
    success: true,
    output: `Rendered in browser (impulse ${impulseId}). View at ${endpoint}/app`,
  }
}
