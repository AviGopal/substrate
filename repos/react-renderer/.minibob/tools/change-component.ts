// change_component tool — replaces the primitive on an existing impulse in-place.
// Use this when the data model changes and the visual representation must change
// (e.g. graph → table after a mode switch). The impulse ID is preserved; only
// the primitive tree changes. Triggers an impulse_update WS event so the browser
// re-renders without any flicker or viewport scroll.

interface ChangePrimitive {
  type: string
  [key: string]: unknown
}

interface ChangeComponentArgs {
  impulseId: string
  primitive: ChangePrimitive
  animation?: 'none' | 'fade' | 'slide' | 'scale'
}

interface ToolResult {
  success: boolean
  output: string
  error?: string
}

export async function execute(args: ChangeComponentArgs): Promise<ToolResult> {
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
          type: 'component_change',
          impulseId: args.impulseId,
          primitive: args.primitive,
          ...(args.animation && { animation: args.animation }),
        },
      }),
    })
  } catch (err) {
    return { success: false, output: '', error: `Could not reach renderer: ${err}` }
  }

  if (!response.ok) {
    return { success: false, output: '', error: `HTTP ${response.status}: ${await response.text()}` }
  }

  return { success: true, output: `Component replaced on impulse ${args.impulseId}` }
}
