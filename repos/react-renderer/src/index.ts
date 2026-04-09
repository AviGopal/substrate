// React-Renderer Vessel - HTTP/WebSocket Server Entry Point

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { nanoid } from 'nanoid'
import vesselManifest from '../vessel.json'
import { resolve, hasResolver, getResolverTypes } from './resolvers'
import { impulseStore } from './state/impulse-store'
import {
  handleOpen,
  handleMessage,
  handleClose,
  handleDrain,
  setQueryHandler,
  setActionHandler
} from './websocket/handler'
import type { Primitive, UIComponentImpulse } from './types'

// Load resolvers
import './resolvers/ui-component'

// ============================================================================
// HTTP Server (Hono)
// ============================================================================

const app = new Hono()

// Enable CORS for browser access
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization']
}))

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    vessel: vesselManifest.id,
    version: vesselManifest.version,
    uptime: process.uptime(),
    impulseCount: impulseStore.getAll().length,
    resolvers: getResolverTypes()
  })
})

// Vessel manifest (for discovery)
app.get('/manifest', (c) => {
  return c.json(vesselManifest)
})

// List registered resolvers
app.get('/resolvers', (c) => {
  return c.json({
    types: getResolverTypes()
  })
})

// Resolve impulse pointer
app.post('/resolve', async (c) => {
  try {
    const { pointer } = await c.req.json()

    if (!pointer || !pointer.type) {
      return c.json({ error: 'Missing pointer or pointer.type' }, 400)
    }

    if (!hasResolver(pointer.type)) {
      return c.json({ error: `No resolver for type: ${pointer.type}` }, 404)
    }

    const content = await resolve(pointer)
    return c.json({ content })
  } catch (error) {
    console.error('[Server] Resolve error:', error)
    return c.json(
      { error: error instanceof Error ? error.message : 'Resolution failed' },
      500
    )
  }
})

// Resolve specific impulse type
app.post('/resolve/:type', async (c) => {
  try {
    const type = c.req.param('type')
    const body = await c.req.json()

    if (!hasResolver(type)) {
      return c.json({ error: `No resolver for type: ${type}` }, 404)
    }

    const pointer = { type, ...body }
    const content = await resolve(pointer)
    return c.json({ content })
  } catch (error) {
    console.error('[Server] Resolve error:', error)
    return c.json(
      { error: error instanceof Error ? error.message : 'Resolution failed' },
      500
    )
  }
})

// ============================================================================
// Impulse Management API
// ============================================================================

// List all impulses
app.get('/impulses', (c) => {
  const impulses = impulseStore.getAll()
  return c.json({ impulses })
})

// Get specific impulse
app.get('/impulses/:id', (c) => {
  const id = c.req.param('id')
  const impulse = impulseStore.get(id)

  if (!impulse) {
    return c.json({ error: 'Impulse not found' }, 404)
  }

  return c.json({ impulse })
})

// Create impulse
app.post('/impulses', async (c) => {
  try {
    const body = await c.req.json()
    const { primitive, position, size, layer, animation, priority, metadata, dataRef, deletable } = body

    if (!primitive) {
      return c.json({ error: 'Missing primitive' }, 400)
    }

    const impulse = impulseStore.create(primitive as Primitive, {
      position,
      size,
      layer,
      animation,
      priority,
      metadata,
      dataRef,
      deletable
    })

    return c.json({ impulse }, 201)
  } catch (error) {
    console.error('[Server] Create impulse error:', error)
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to create impulse' },
      500
    )
  }
})

// Update impulse
app.put('/impulses/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const patch = await c.req.json() as Partial<UIComponentImpulse>

    const success = impulseStore.update(id, patch)

    if (!success) {
      return c.json({ error: 'Impulse not found' }, 404)
    }

    return c.json({ success: true, impulse: impulseStore.get(id) })
  } catch (error) {
    console.error('[Server] Update impulse error:', error)
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to update impulse' },
      500
    )
  }
})

// Delete impulse
app.delete('/impulses/:id', (c) => {
  const id = c.req.param('id')
  const success = impulseStore.delete(id)

  if (!success) {
    return c.json({ error: 'Impulse not found or not deletable' }, 404)
  }

  return c.json({ success: true })
})

// Clear all impulses
app.delete('/impulses', async (c) => {
  try {
    const { except } = await c.req.json().catch(() => ({ except: [] }))
    impulseStore.clear(except)
    return c.json({ success: true })
  } catch (error) {
    impulseStore.clear()
    return c.json({ success: true })
  }
})

// ============================================================================
// WebSocket + HTTP Server (Bun)
// ============================================================================

interface ClientInfo {
  sessionId: string
  connectedAt: number
  lastActivity: number
  viewport?: { width: number; height: number }
}

const PORT = Number(process.env.PORT) || 3000

console.log(`
╔════════════════════════════════════════════════════════════╗
║              React-Renderer Vessel                          ║
╚════════════════════════════════════════════════════════════╝

  Vessel ID:      ${vesselManifest.id}
  Version:        ${vesselManifest.version}
  Port:           ${PORT}
  Resolvers:      ${getResolverTypes().join(', ')}

  Endpoints:
    HTTP:         http://localhost:${PORT}
    WebSocket:    ws://localhost:${PORT}/ws
    Health:       http://localhost:${PORT}/health
    Manifest:     http://localhost:${PORT}/manifest

`)

const server = Bun.serve<ClientInfo>({
  port: PORT,

  fetch(req, server) {
    const url = new URL(req.url)

    // Handle WebSocket upgrade
    if (url.pathname === '/ws') {
      const sessionId = nanoid()
      const success = server.upgrade(req, {
        data: {
          sessionId,
          connectedAt: Date.now(),
          lastActivity: Date.now()
        }
      })

      if (success) {
        return undefined // Upgrade successful
      }

      return new Response('WebSocket upgrade failed', { status: 400 })
    }

    // Handle HTTP with Hono
    return app.fetch(req)
  },

  websocket: {
    open(ws) {
      handleOpen(ws)
    },

    message(ws, message) {
      handleMessage(ws, message)
    },

    close(ws) {
      handleClose(ws)
    },

    drain(ws) {
      handleDrain(ws)
    }
  }
})

console.log(`[Server] Listening on port ${PORT}`)

// Export for external configuration
export { setQueryHandler, setActionHandler, impulseStore }
export default server
