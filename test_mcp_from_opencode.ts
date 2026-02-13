import { MCP } from './repos/metabob-opencode/packages/opencode/src/mcp/index.ts'

async function test() {
  console.log('Testing MCP client...')
  const clients = await MCP.clients()
  console.log('Clients:', Object.keys(clients || {}))
  
  const metabobClient = clients['metabob']
  if (!metabobClient) {
    console.error('No metabob client found!')
    return
  }
  
  console.log('Metabob client found, calling search_activities...')
  try {
    const result = await metabobClient.callTool({
      name: 'search_activities',
      arguments: {
        query: '',
        limit: 5,
        min_success_rate: 0.0
      }
    })
    console.log('Result:', JSON.stringify(result, null, 2))
  } catch (e: any) {
    console.error('Error:', e.message)
  }
}

test()
