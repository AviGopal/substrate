// React-Renderer Vessel - HTTP/WebSocket Server Entry Point

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { nanoid } from 'nanoid'
import { watch, readFileSync } from 'fs'
import vesselManifest from '../vessel.json'
import { resolve, hasResolver, getResolverTypes } from './resolvers'
import { impulseStore, recordRenderError, getRenderErrors } from './state/impulse-store'
import {
  handleOpen,
  handleMessage,
  handleClose,
  handleDrain,
  setQueryHandler,
  setActionHandler
} from './websocket/handler'
import type { Primitive, UIComponentImpulse } from './types'
import { VesselClient, type DiscoveryConfig } from '@metabob/vessel-discovery-client'
import { loadRendererConfig, resolveOrgId } from './config-loader'

// Load resolvers
import './resolvers/ui-component'
import './resolvers/layout-change'
import './resolvers/style-change'
import './resolvers/component-change'
import './resolvers/data-source-change'
import './resolvers/ui-event'
import './resolvers/composition-metric'
import { enqueueUiEvent } from './resolvers/ui-event'

// Global discovery client
let discoveryClient: VesselClient | null = null

// ============================================================================
// Vessel Tool Registry (mcpTool shape)
// ============================================================================

interface VesselTool {
  name: string
  description: string
  parameters: Record<string, unknown>
  execute: (args: Record<string, unknown>) => Promise<{ success: boolean; output: string; error?: string }>
}

const vesselTools: VesselTool[] = [
  {
    name: 'render_ui',
    description: 'Push a UI primitive to the connected browser viewport at /app. Creates a live-rendered element visible in the browser.',
    parameters: {
      type: 'object',
      required: ['primitive'],
      properties: {
        primitive: {
          type: 'object',
          required: ['type'],
          description: 'The UI primitive to render',
          properties: {
            type: { type: 'string', enum: ['text', 'badge', 'progress', 'code', 'container', 'data-table', 'chart', 'graph', 'input', 'button', 'image', 'custom'] },
            variant: { type: 'string' },
            content: { type: 'string' },
            label: { type: 'string' },
            value: { type: 'number' },
            layout: { type: 'string', enum: ['vertical', 'horizontal', 'grid', 'absolute'] },
            children: { type: 'array' },
            columns: { type: 'array' },
            data: { type: 'array' },
            language: { type: 'string' },
            code: { type: 'string' },
          },
        },
        position: {
          type: 'object',
          properties: {
            mode: { type: 'string', enum: ['flow', 'center', 'below-input', 'absolute'] },
            x: { type: 'number' },
            y: { type: 'number' },
          },
        },
        animation: { type: 'string', enum: ['fade', 'slide', 'scale', 'none'] },
        priority: { type: 'string', enum: ['high', 'medium', 'low'] },
      },
    },
    async execute(args) {
      const primitive = args.primitive as Primitive
      if (!primitive || typeof primitive !== 'object') {
        return { success: false, output: '', error: 'Missing or invalid primitive' }
      }
      const impulse = impulseStore.create(primitive, {
        position: args.position as UIComponentImpulse['pointer']['position'],
        layer: 0,
        animation: args.animation as UIComponentImpulse['pointer']['animation'],
        priority: args.priority as UIComponentImpulse['priority'] | undefined,
      })
      const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001
      const endpoint = process.env.VESSEL_ENDPOINT || `http://localhost:${PORT}`
      return { success: true, output: `Rendered in browser (impulse ${impulse.id}). View at ${endpoint}/app` }
    },
  },
]

// ============================================================================
// Shape Mapping Cache
// ============================================================================

let shapeMappingCache: Record<string, string> = {}
try {
  shapeMappingCache = JSON.parse(readFileSync("config/shape-mapping.json", "utf-8")) as Record<string, string>
} catch {
  // file absent or invalid JSON — default to empty mapping
}

export function getShapeMapping(): Record<string, string> {
  return shapeMappingCache
}

// ============================================================================
// Handler Builder
// ============================================================================

interface ClientInfo {
  sessionId: string
  connectedAt: number
  lastActivity: number
  viewport?: { width: number; height: number }
}

// ============================================================================
// API Key Auth Middleware Helper
// ============================================================================

/**
 * Returns a 401 Response if the request lacks the correct API key.
 * Returns null if authentication passes (or METABOB_API_KEY is not set).
 */
function checkApiKeyAuth(req: Request): Response | null {
  const expectedKey = process.env.METABOB_API_KEY
  if (!expectedKey) {
    // Dev mode: no key configured — skip auth
    return null
  }
  const authHeader = req.headers.get('Authorization') ?? ''
  if (authHeader === `ApiKey ${expectedKey}`) {
    return null
  }
  return Response.json({ error: 'unauthorized' }, { status: 401 })
}

function buildHandler() {
  const app = new Hono()

  // Enable CORS for browser access
  app.use('*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization']
  }))

  // Health check with discovery status
  app.get('/health', (c) => {
    const healthStatus: any = {
      status: 'ok',
      vessel: vesselManifest.id,
      version: vesselManifest.version,
      uptime: process.uptime(),
      impulseCount: impulseStore.getAll().length,
      resolvers: getResolverTypes(),
      checks: {
        discovery: { status: 'unknown', registered: false }
      }
    }

    if (discoveryClient) {
      const isRunning = discoveryClient.isRunning
      const lastHeartbeat = discoveryClient.lastHeartbeat

      healthStatus.checks.discovery = {
        status: isRunning ? 'healthy' : 'pending',
        registered: isRunning,
        lastHeartbeat: lastHeartbeat ? lastHeartbeat.toISOString() : null
      }
    } else {
      healthStatus.checks.discovery = {
        status: 'disabled',
        registered: false
      }
    }

    return c.json(healthStatus)
  })

  // Vessel manifest (for discovery)
  app.get('/manifest', (c) => {
    const manifest: any = { ...vesselManifest }

    if (discoveryClient) {
      manifest.discovery = {
        registered: discoveryClient.isRunning,
        lastHeartbeat: discoveryClient.lastHeartbeat?.toISOString() || null
      }
    }

    return c.json(manifest)
  })

  // List registered resolvers
  app.get('/resolvers', (c) => {
    return c.json({
      types: getResolverTypes()
    })
  })

  // MCP tool dispatch endpoint — called by minibob when LLM invokes a discovered tool
  app.post('/mcp/tools/call', async (c) => {
    const authErr = checkApiKeyAuth(c.req.raw)
    if (authErr) return authErr
    try {
      const { tool, arguments: args } = await c.req.json() as { tool: string; arguments: Record<string, unknown> }
      const entry = vesselTools.find(t => t.name === tool)
      if (!entry) {
        return c.json({ error: `Tool not found: ${tool}` }, 404)
      }
      const result = await entry.execute(args || {})
      return c.json(result)
    } catch (error) {
      console.error('[Server] Tool dispatch error:', error)
      return c.json({ success: false, output: '', error: error instanceof Error ? error.message : String(error) }, 500)
    }
  })

  // Resolve impulse pointer
  app.post('/resolve', async (c) => {
    try {
      const { pointer } = await c.req.json()

      if (!pointer || !pointer.type) {
        return c.json({ error: 'Missing pointer or pointer.type' }, 400)
      }

      // mcpTool: return this vessel's tool definitions for discovery-to-tools bridge
      if (pointer.type === 'mcpTool') {
        const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001
        const vesselEndpoint = process.env.VESSEL_ENDPOINT || `http://localhost:${PORT}`
        const vesselId = process.env.MINIBOB_VESSEL_ID || process.env.VESSEL_ID || `react-renderer-local`
        const authScheme = process.env.METABOB_API_KEY ? 'ApiKey' : 'none'
        const tools = vesselTools.map(t => ({
          content: {
            name: t.name,
            description: t.description,
            input_schema: t.parameters,
          },
          metadata: {
            shape: 'mcpTool',
            tool_name: t.name,
            vessel_id: vesselId,
            vessel_endpoint: vesselEndpoint,
            resolve_endpoint: '/mcp/tools/call',
            resolve_request_format: 'mcp-tool',
            auth_scheme: authScheme,
            relevance_score: 1.0,
          },
        }))
        return c.json({ tools })
      }

      if (!hasResolver(pointer.type)) {
        return c.json({ error: `No resolver for type: ${pointer.type}` }, 404)
      }

      const content = await resolve(pointer)

      // When ui_component is resolved via the discovery path, also create an impulse
      // in the browser store so it renders immediately. This is the "render on resolve"
      // contract: any vessel that produces a ui_component shape has it appear in the viewport.
      if (pointer.type === 'ui_component' && content && (content as Record<string, unknown>).primitive) {
        const c2 = content as Record<string, unknown>
        impulseStore.create(c2.primitive as Primitive, {
          position: c2.position as UIComponentImpulse['pointer']['position'],
          size: c2.size as UIComponentImpulse['pointer']['size'],
          layer: typeof c2.layer === 'number' ? c2.layer : 0,
          animation: c2.animation as UIComponentImpulse['pointer']['animation'],
        })
      }

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
    // Auth check for write resolvers (and general /resolve/:type)
    const authErr = checkApiKeyAuth(c.req.raw)
    if (authErr) return authErr

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
  // Write Resolver Routes
  // Each route authenticates via API key, extracts pointer from body, calls resolver.
  // ============================================================================

  async function dispatchWriteResolver(c: any, type: string) {
    const authErr = checkApiKeyAuth(c.req.raw)
    if (authErr) return authErr
    try {
      const body = await c.req.json()
      const pointer = { type, ...body }
      const result = await resolve(pointer)
      return c.json(result)
    } catch (error) {
      console.error(`[Server] ${type} resolver error:`, error)
      return c.json(
        { error: error instanceof Error ? error.message : 'Resolution failed' },
        500
      )
    }
  }

  app.post('/resolve/layout_change', (c) => dispatchWriteResolver(c, 'layout_change'))
  app.post('/resolve/style_change', (c) => dispatchWriteResolver(c, 'style_change'))
  app.post('/resolve/component_change', (c) => dispatchWriteResolver(c, 'component_change'))
  app.post('/resolve/data_source_change', (c) => dispatchWriteResolver(c, 'data_source_change'))
  app.post('/resolve/ui_event', (c) => dispatchWriteResolver(c, 'ui_event'))
  app.post('/resolve/composition_metric', (c) => dispatchWriteResolver(c, 'composition_metric'))

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

  // Viewer page — renders current impulse state as live HTML
  app.get('/view', (c) => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>react-renderer viewer</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, sans-serif; font-size: 14px; background: #fff; color: #111; }
    #root { padding: 16px; display: flex; flex-direction: column; gap: 12px; min-height: 100vh; }
    #status { position: fixed; top: 8px; right: 8px; font-size: 11px; padding: 2px 8px; border-radius: 9999px; background: #f3f4f6; color: #6b7280; }
    #status.ok { background: #d1fae5; color: #065f46; }
    .impulse { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
    /* primitives */
    .p-text-heading { font-size: 20px; font-weight: 700; margin: 0 0 4px; }
    .p-text-body { line-height: 1.6; margin: 0; }
    .p-text-caption { font-size: 12px; color: #6b7280; margin: 0; }
    .p-badge { display: inline-block; padding: 2px 10px; border-radius: 9999px; font-size: 12px; font-weight: 500; }
    .p-badge-info { background: #dbeafe; color: #1e40af; }
    .p-badge-success { background: #d1fae5; color: #065f46; }
    .p-badge-warning { background: #fef3c7; color: #92400e; }
    .p-badge-error { background: #fee2e2; color: #991b1b; }
    .p-badge-neutral { background: #f3f4f6; color: #374151; }
    .p-container-vertical { display: flex; flex-direction: column; gap: 8px; }
    .p-container-horizontal { display: flex; flex-direction: row; gap: 8px; align-items: flex-start; flex-wrap: wrap; }
    .p-container-grid { display: grid; gap: 8px; }
    .p-button { padding: 6px 14px; border-radius: 6px; border: none; cursor: pointer; font-size: 13px; font-weight: 500; }
    .p-button-primary { background: #2563eb; color: #fff; }
    .p-button-secondary { background: #f3f4f6; color: #111; }
    .p-button-destructive { background: #dc2626; color: #fff; }
    .p-progress-bar { height: 8px; border-radius: 4px; background: #e5e7eb; overflow: hidden; }
    .p-progress-bar-fill { height: 100%; background: #2563eb; border-radius: 4px; transition: width 0.3s; }
    .p-code { background: #1e1e1e; color: #d4d4d4; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 12px; overflow-x: auto; white-space: pre; }
    table { border-collapse: collapse; width: 100%; font-size: 13px; }
    th { padding: 6px 10px; border-bottom: 2px solid #e5e7eb; text-align: left; font-weight: 600; cursor: pointer; }
    td { padding: 6px 10px; border-bottom: 1px solid #f3f4f6; }
    tr:hover td { background: #f9fafb; }
    .p-unknown { padding: 8px 12px; background: #fef3c7; border-radius: 6px; font-size: 12px; font-family: monospace; color: #92400e; }
    .empty { color: #9ca3af; text-align: center; padding: 48px; }
  </style>
</head>
<body>
  <div id="status">connecting…</div>
  <div id="root"><div class="empty">Waiting for impulses…</div></div>
  <script>
    const impulses = new Map()
    const status = document.getElementById('status')
    const root = document.getElementById('root')

    function renderPrimitive(p) {
      if (!p || !p.type) return '<div class="p-unknown">missing type</div>'
      switch (p.type) {
        case 'text': {
          const cls = { heading: 'p-text-heading', body: 'p-text-body', caption: 'p-text-caption', code: 'p-code' }[p.variant] ?? 'p-text-body'
          const tag = p.variant === 'heading' ? 'h2' : 'p'
          return \`<\${tag} class="\${cls}">\${esc(p.content ?? '')}</\${tag}>\`
        }
        case 'badge':
          return \`<span class="p-badge p-badge-\${p.variant ?? 'neutral'}">\${esc(p.label ?? '')}</span>\`
        case 'button':
          return \`<button class="p-button p-button-\${p.variant ?? 'secondary'}">\${esc(p.label ?? 'Button')}</button>\`
        case 'progress': {
          const pct = Math.round(((p.value ?? 0) / (p.max ?? 100)) * 100)
          return \`<div><div class="p-progress-bar"><div class="p-progress-bar-fill" style="width:\${pct}%"></div></div><div style="font-size:11px;color:#6b7280;margin-top:2px">\${pct}%</div></div>\`
        }
        case 'code':
          return \`<pre class="p-code">\${esc(p.code ?? p.content ?? '')}</pre>\`
        case 'container': {
          const cls = { vertical: 'p-container-vertical', horizontal: 'p-container-horizontal', grid: 'p-container-grid' }[p.layout] ?? 'p-container-vertical'
          const style = p.layout === 'grid' && p.columns ? \` style="grid-template-columns:repeat(\${p.columns},1fr)"\` : ''
          const children = (p.children ?? []).map(renderPrimitive).join('')
          return \`<div class="\${cls}"\${style}>\${children}</div>\`
        }
        case 'data-table':
        case 'data-table-v2': {
          const cols = p.columns ?? []
          const rows = p.data ?? []
          const head = cols.map(c => \`<th>\${esc(c)}</th>\`).join('')
          const body = rows.map(r => \`<tr>\${cols.map(c => \`<td>\${esc(String(r[c] ?? ''))}</td>\`).join('')}</tr>\`).join('')
          return \`<table><thead><tr>\${head}</tr></thead><tbody>\${body}</tbody></table>\`
        }
        default:
          return \`<div class="p-unknown">Unknown primitive: \${esc(p.type)}<br><pre>\${esc(JSON.stringify(p, null, 2))}</pre></div>\`
      }
    }

    function esc(s) {
      return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
    }

    function redraw() {
      const arr = [...impulses.values()]
      if (arr.length === 0) {
        root.innerHTML = '<div class="empty">Waiting for impulses…</div>'
        return
      }
      root.innerHTML = arr.map(imp => {
        const prim = imp.pointer?.primitive ?? imp.content ?? imp.primitive ?? {}
        return \`<div class="impulse" data-id="\${imp.id}">\${renderPrimitive(prim)}</div>\`
      }).join('')
    }

    const wsUrl = location.origin.replace(/^http/, 'ws') + '/ws'
    let ws
    function connect() {
      ws = new WebSocket(wsUrl)
      ws.onopen = () => { status.textContent = 'connected'; status.className = 'ok' }
      ws.onclose = () => { status.textContent = 'reconnecting…'; status.className = ''; setTimeout(connect, 1500) }
      ws.onerror = () => ws.close()
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data)
        switch (msg.type) {
          case 'state_sync':
            impulses.clear()
            ;(msg.impulses ?? []).forEach(i => impulses.set(i.id, i))
            redraw(); break
          case 'impulse_create':
            if (msg.impulse) impulses.set(msg.impulse.id, msg.impulse)
            redraw(); break
          case 'impulse_update':
            if (msg.id && impulses.has(msg.id)) {
              impulses.set(msg.id, { ...impulses.get(msg.id), ...msg.patch })
            }
            redraw(); break
          case 'impulse_delete':
            if (msg.id) impulses.delete(msg.id)
            redraw(); break
        }
      }
    }
    connect()
  </script>
</body>
</html>`
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  })

  // ============================================================================
  // Built Client App
  // ============================================================================

  // Serve built client app (React SPA)
  app.get('/app', async (c) => c.html(await Bun.file('./dist/index.html').text()))
  app.get('/app/*', async (c) => c.html(await Bun.file('./dist/index.html').text()))

  // ============================================================================
  // Debugging & Inspection Routes
  // ============================================================================

  // POST /impulses/:id/errors — called by PrimitiveErrorBoundary (fire-and-forget from browser)
  app.post('/impulses/:id/errors', async (c) => {
    const body = await c.req.json()
    recordRenderError({
      impulseId: c.req.param('id'),
      primitiveType: body.primitiveType ?? 'unknown',
      error: body.error ?? 'unknown error',
      stack: body.stack,
      timestamp: body.timestamp ?? Date.now(),
    })
    return c.json({ received: true })
  })

  // GET /debug/errors — returns the render error log for inspection
  app.get('/debug/errors', (c) => {
    return c.json({ errors: getRenderErrors(), count: getRenderErrors().length })
  })

  // POST /validate-spec — validates a primitive spec without creating an impulse
  app.post('/validate-spec', async (c) => {
    const body = await c.req.json() as { primitive?: unknown }
    if (!body.primitive) {
      return c.json({ valid: false, errors: [{ path: 'primitive', message: 'primitive field is required' }] }, 400)
    }
    const prim = body.primitive as Record<string, unknown>
    if (!prim.type || typeof prim.type !== 'string') {
      return c.json({ valid: false, errors: [{ path: 'primitive.type', message: 'primitive.type must be a non-empty string' }] }, 400)
    }
    // Use the resolver to attempt resolution — if it throws, the spec is invalid
    try {
      await resolve({ type: 'ui_component', primitive: body.primitive } as any)
      return c.json({ valid: true, errors: [] })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return c.json({ valid: false, errors: [{ path: 'primitive', message: msg }] })
    }
  })

  // GET /impulses/:id/tree — returns the primitive tree for a specific impulse
  app.get('/impulses/:id/tree', (c) => {
    const impulse = impulseStore.get(c.req.param('id'))
    if (!impulse) return c.json({ error: 'not found' }, 404)

    function buildTree(prim: Record<string, unknown>, depth = 0): unknown {
      const children = (prim.children as Record<string, unknown>[] | undefined) ?? []
      return {
        type: prim.type,
        depth,
        childCount: children.length,
        children: children.map((child) => buildTree(child, depth + 1)),
      }
    }

    const primitive = (impulse.pointer?.primitive ?? impulse.content) as unknown as Record<string, unknown>
    return c.json({
      impulseId: impulse.id,
      tree: primitive ? buildTree(primitive) : null,
    })
  })

  return {
    fetch(req: Request, server: ReturnType<typeof Bun.serve>) {
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
      open(ws: any) {
        handleOpen(ws)
      },

      message(ws: any, message: any) {
        handleMessage(ws, message)
      },

      close(ws: any) {
        handleClose(ws)
      },

      drain(ws: any) {
        handleDrain(ws)
      }
    }
  }
}

// ============================================================================
// WebSocket + HTTP Server (Bun)
// ============================================================================

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
  ...buildHandler()
})

console.log(`[Server] Listening on port ${PORT}`)

// ============================================================================
// Default Action Handler — enqueues browser action messages as ui_event impulses
// ============================================================================

setActionHandler(async (action, _sessionId) => {
  enqueueUiEvent({
    action: action.action,
    payload: action.payload ?? {},
    componentId: action.componentId,
    timestamp: action.timestamp,
  })
})

// ============================================================================
// Config File Watcher
// ============================================================================

// Verified: config reload does not restart process (2026-04-24)
watch("config/shape-mapping.json", async () => {
  try {
    shapeMappingCache = JSON.parse(await Bun.file("config/shape-mapping.json").text()) as Record<string, string>
    server.reload(buildHandler())
    console.log("[ConfigReload] shape-mapping.json reloaded")
  } catch (e) {
    console.error("[ConfigReload] Failed to reload shape-mapping.json:", e)
  }
})

// ============================================================================
// Hot Reload
// ============================================================================

// Verified: WS clients survive handler swap (2026-04-24)
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    server.reload(buildHandler())
    const ts = process.env.DEBUG ? ` [${new Date().toISOString()}]` : ""
    console.log(`[HotReload] Handler swapped — WebSocket clients preserved${ts}`)
  })
}

// ============================================================================
// Activity Templates — startup sync to activity-api
// ============================================================================

async function syncTemplatesToActivityApi(): Promise<void> {
  const { activityApiEndpoint, metabobApiKey } = await loadRendererConfig(PORT)

  if (!metabobApiKey) {
    console.log('[Templates] METABOB_API_KEY not set — skipping template sync')
    return
  }

  const { readdirSync, readFileSync } = await import('fs')
  const { join } = await import('path')

  // Templates live in .minibob/templates/ (used by minibob --dev) and
  // templates/ (canonical path referenced in vessel.json).  Read from
  // .minibob/templates/ since that's the complete set.
  const templatesDir = join(import.meta.dir, '..', '.minibob', 'templates')
  let files: string[]
  try {
    files = readdirSync(templatesDir).filter(f => f.endsWith('.json'))
  } catch {
    console.log('[Templates] .minibob/templates/ not found — skipping template sync')
    return
  }

  const endpoint = `${activityApiEndpoint}/v2/activities/templates`
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `ApiKey ${metabobApiKey}`,
  }

  let synced = 0
  let skipped = 0
  for (const file of files) {
    let template: Record<string, unknown>
    try {
      template = JSON.parse(readFileSync(join(templatesDir, file), 'utf8'))
    } catch {
      console.warn(`[Templates] Could not parse ${file} — skipping`)
      skipped++
      continue
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(template),
      })
      if (res.ok || res.status === 409) {
        synced++
      } else {
        const text = await res.text().catch(() => '')
        console.warn(`[Templates] ${file}: HTTP ${res.status} — ${text.slice(0, 120)}`)
        skipped++
      }
    } catch (err) {
      console.warn(`[Templates] ${file}: fetch error — ${err instanceof Error ? err.message : err}`)
      skipped++
    }
  }

  console.log(`[Templates] Sync complete: ${synced} synced, ${skipped} skipped (${files.length} total)`)
}

// Shape-mapping config (config/shape-mapping.json) IS loaded at startup
// (see shapeMappingCache above) and hot-reloaded on file change (see watcher below).

// ============================================================================
// Discovery Vessel Integration
// ============================================================================

async function initializeDiscovery() {
  const rendererConfig = await loadRendererConfig(PORT)

  if (!rendererConfig.discoveryEnabled) {
    console.log('[Discovery] Discovery integration disabled')
    return
  }

  const vesselId = process.env.VESSEL_ID ?? `react-renderer-${process.env.HOSTNAME ?? "local"}`

  console.log(`[Discovery] Using endpoint: ${rendererConfig.discoveryEndpoint}`)
  console.log(`[Discovery] Vessel endpoint: ${rendererConfig.vesselEndpoint}`)

  const orgId = await resolveOrgId(rendererConfig.metabobApiKey, rendererConfig.identityEndpoint)
  if (orgId) {
    console.log(`[Discovery] Registering with orgId: ${orgId}`)
  }

  const config: DiscoveryConfig = {
    discoveryEndpoint: rendererConfig.discoveryEndpoint,
    vesselId,
    vesselName: 'react-renderer',
    version: vesselManifest.version,
    endpoint: rendererConfig.vesselEndpoint,
    shapes: [
      'ui_component',
      'ui_state',
      'viewport_state',
      'layout_change',
      'style_change',
      'component_change',
      'data_source_change',
      'ui_event',
      'composition_metric',
      'design_token',
      'mcpTool',
    ],
    protocol: 'http',
    authToken: rendererConfig.metabobApiKey || undefined,
    orgId,
    authType: 'ApiKey',
    resolve_endpoint: '/resolve',
    resolve_request_format: 'pointer',
    auth_scheme: 'ApiKey',
    resolve_timeout_ms: 10000,
    metadata: {
      capabilities: ['ui-rendering', 'websocket', 'real-time-updates'],
      environment: process.env.NODE_ENV || 'development',
    },
  }

  discoveryClient = new VesselClient(config)

  const success = await discoveryClient.register()

  if (success) {
    console.log('[Discovery] ✓ Registered successfully')
    // Use startHeartbeatManager if available, otherwise fall back to startHeartbeat
    if (typeof (discoveryClient as any).startHeartbeatManager === 'function') {
      (discoveryClient as any).startHeartbeatManager(60000)
    } else {
      discoveryClient.startHeartbeat()
    }
    console.log('[Discovery] Heartbeat started (60s interval)')
  } else {
    console.warn('[Discovery] ✗ Registration failed (will retry)')
  }
}

initializeDiscovery().catch((error) => {
  console.error('[Discovery] Initialization error:', error)
})

syncTemplatesToActivityApi().catch((error) => {
  console.error('[Templates] Sync error:', error)
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Server] SIGTERM received, shutting down gracefully')

  if (discoveryClient) {
    await discoveryClient.shutdown()
  }

  console.log('[Server] Graceful shutdown complete')
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('[Server] SIGINT received, shutting down gracefully')

  if (discoveryClient) {
    await discoveryClient.shutdown()
  }

  console.log('[Server] Graceful shutdown complete')
  process.exit(0)
})

// Export for external configuration
export { setQueryHandler, setActionHandler, impulseStore }
export default server
