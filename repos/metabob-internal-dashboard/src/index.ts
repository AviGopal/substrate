/**
 * Internal Dashboard Server
 *
 * Bun server with WebSocket support for MiniBob-controlled UI.
 * UI components are impulses managed through MiniBob's activity system.
 */

import { wsHandler } from './lib/websocket-handler'
import type { QueryMessage, ActionMessage } from './lib/websocket-handler'
import { initializeMiniBobIntegration, getMiniBobIntegration } from './lib/minibob-integration'

const PORT = parseInt(process.env.PORT || '3001')
const MINIBOB_API_URL = process.env.MINIBOB_API_URL || 'http://metabob-activity-api.activity-system.svc.cluster.local:8080'
const WORKING_DIRECTORY = process.env.WORKING_DIRECTORY || process.cwd()

// Track MiniBob API connection
let minibobConnected = false

// Check MiniBob API connection
async function checkMiniBobConnection() {
  try {
    const response = await fetch(`${MINIBOB_API_URL}/health`)
    minibobConnected = response.ok
  } catch {
    minibobConnected = false
  }
}

// Check connection every 30 seconds
setInterval(checkMiniBobConnection, 30000)
checkMiniBobConnection()

// Initialize MiniBob integration
const minibobIntegration = await initializeMiniBobIntegration({
  activityApiUrl: MINIBOB_API_URL,
  workingDirectory: WORKING_DIRECTORY,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
})

// Set up query handler - routes to MiniBob
wsHandler.onQuery(async (query: QueryMessage, sessionId: string) => {
  console.log(`[Query] ${sessionId}: ${query.text}`)
  const integration = getMiniBobIntegration()
  if (integration) {
    await integration.handleQuery(query, sessionId)
  }
})

// Set up action handler - routes to MiniBob
wsHandler.onAction(async (action: ActionMessage, sessionId: string) => {
  console.log(`[Action] ${sessionId}: ${action.action} on ${action.componentId}`)
  const integration = getMiniBobIntegration()
  if (integration) {
    await integration.handleAction(action, sessionId)
  }
})

// Build frontend
console.log('Building frontend...')
const buildResult = await Bun.build({
  entrypoints: ['./src/frontend.tsx'],
  outdir: './public/assets',
  minify: process.env.NODE_ENV === 'production',
  sourcemap: 'external',
  target: 'browser',
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
  }
})

if (!buildResult.success) {
  console.error('Frontend build failed:')
  for (const log of buildResult.logs) {
    console.error(log)
  }
  process.exit(1)
}
console.log('Frontend built successfully')

// Interface for WebSocket connection data
interface ConnectionData {
  connectedAt: number
}

// Bun server with WebSocket support
const server = Bun.serve<ConnectionData>({
  port: PORT,

  async fetch(req, server) {
    const url = new URL(req.url)

    // WebSocket upgrade
    if (url.pathname === '/ws') {
      const upgraded = server.upgrade(req, {
        data: { connectedAt: Date.now() }
      })
      if (upgraded) return undefined
      return new Response('WebSocket upgrade failed', { status: 400 })
    }

    // Health check
    if (url.pathname === '/health') {
      return Response.json({
        status: 'ok',
        minibob: minibobConnected ? 'connected' : 'disconnected',
        connections: wsHandler.getConnectionCount(),
        impulses: wsHandler.getImpulseCount()
      })
    }

    // Serve built JS files
    if (url.pathname.startsWith('/assets/')) {
      const filePath = `./public${url.pathname}`
      const file = Bun.file(filePath)
      if (await file.exists()) {
        const contentType = url.pathname.endsWith('.js')
          ? 'application/javascript'
          : url.pathname.endsWith('.map')
          ? 'application/json'
          : 'application/octet-stream'
        return new Response(file, {
          headers: { 'Content-Type': contentType }
        })
      }
      return new Response('Not found', { status: 404 })
    }

    // Serve the main HTML
    const html = await Bun.file('./src/index.html').text()
    return new Response(html, {
      headers: { 'Content-Type': 'text/html' }
    })
  },

  websocket: {
    open(ws) {
      wsHandler.handleOpen(ws as any)
    },
    message(ws, message) {
      wsHandler.handleMessage(ws as any, message)
    },
    close(ws) {
      wsHandler.handleClose(ws as any)
    },
  },
})

console.log(`
╔══════════════════════════════════════════════════════════════╗
║           Metabob Internal Dashboard                        ║
╠══════════════════════════════════════════════════════════════╣
║  HTTP:      http://localhost:${PORT}                             ║
║  WebSocket: ws://localhost:${PORT}/ws                            ║
║  Health:    http://localhost:${PORT}/health                      ║
║  MiniBob:   ${MINIBOB_API_URL.padEnd(42)}║
╚══════════════════════════════════════════════════════════════╝
`)
