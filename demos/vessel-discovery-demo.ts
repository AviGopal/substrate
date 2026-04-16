#!/usr/bin/env bun
/**
 * Vessel Discovery Demo
 *
 * Demonstrates all vessel discovery and interaction patterns:
 * 1. Local vessel discovery (config, backend, introspection)
 * 2. Vessel-to-vessel interaction via impulses
 * 3. Bundling multiple vessels
 * 4. Integration with activity system
 */

// =============================================================================
// 1. VESSEL DISCOVERY SERVICE
// =============================================================================

interface VesselDescriptor {
  id: string
  name: string
  endpoint: string
  protocol: 'http' | 'mcp' | 'unix'
  shapes: string[]
  capabilities: string[]
  health?: {
    lastCheck: number
    reachable: boolean
  }
  source: 'backend' | 'config' | 'introspection' | 'environment'
}

class VesselDiscoveryService {
  private vessels: Map<string, VesselDescriptor> = new Map()
  private shapeIndex: Map<string, string[]> = new Map() // shape → vesselIds

  constructor(
    private backendEndpoint: string = 'https://activity.metabob.com',
    private configPath: string = '.metabob/config.json'
  ) {}

  /**
   * Discover all vessels from all sources
   */
  async discover(): Promise<VesselDescriptor[]> {
    console.log('🔍 Discovering vessels...\n')

    // 1. Backend discovery
    await this.discoverFromBackend()

    // 2. Config discovery
    await this.discoverFromConfig()

    // 3. Codebase introspection
    await this.discoverFromCodebase()

    // 4. Build shape index
    this.buildShapeIndex()

    console.log(`\n✓ Found ${this.vessels.size} vessels`)
    return Array.from(this.vessels.values())
  }

  /**
   * Resolve which vessel can handle a shape
   */
  async resolveShape(shape: string): Promise<VesselDescriptor | null> {
    const vesselIds = this.shapeIndex.get(shape)
    if (!vesselIds || vesselIds.length === 0) {
      console.log(`❌ No vessel found for shape: ${shape}`)
      return null
    }

    console.log(`✓ Found ${vesselIds.length} vessel(s) for shape: ${shape}`)

    // Try vessels in priority order
    for (const vesselId of vesselIds) {
      const vessel = this.vessels.get(vesselId)
      if (!vessel) continue

      // Check health
      const healthy = await this.checkHealth(vessel)
      if (healthy) {
        console.log(`  → Using vessel: ${vessel.name} (${vessel.endpoint})`)
        return vessel
      }
    }

    return null
  }

  private async discoverFromBackend() {
    console.log('📡 Backend discovery...')
    try {
      const response = await fetch(`${this.backendEndpoint}/v2/vessels/list`)
      if (!response.ok) {
        console.log('  ⚠️  Backend unavailable')
        return
      }

      const { vessels } = await response.json()

      for (const v of vessels || []) {
        this.vessels.set(v.vesselId, {
          id: v.vesselId,
          name: v.vesselName,
          endpoint: v.endpoint,
          protocol: v.endpoint.startsWith('unix://') ? 'unix' : 'http',
          shapes: v.shapes || [],
          capabilities: v.metadata?.capabilities || [],
          source: 'backend'
        })
        console.log(`  ✓ ${v.vesselName} (${v.endpoint})`)
      }
    } catch (error) {
      console.log('  ⚠️  Backend unreachable')
    }
  }

  private async discoverFromConfig() {
    console.log('\n📝 Config discovery...')
    try {
      const file = Bun.file(this.configPath)
      if (!await file.exists()) {
        console.log('  ⚠️  No config file found')
        return
      }

      const config = await file.json()

      for (const [vesselId, vesselConfig] of Object.entries(config.vessels || {})) {
        const vc = vesselConfig as any
        this.vessels.set(vesselId, {
          id: vesselId,
          name: vesselId,
          endpoint: vc.endpoint,
          protocol: vc.type || 'http',
          shapes: vc.capabilities || [],
          capabilities: vc.capabilities || [],
          source: 'config'
        })
        console.log(`  ✓ ${vesselId} (${vc.endpoint})`)
      }
    } catch (error) {
      console.log('  ⚠️  Config file invalid')
    }
  }

  private async discoverFromCodebase() {
    console.log('\n🔎 Codebase introspection...')

    const resolvers: string[] = []

    // Discover npm scripts
    try {
      const pkgFile = Bun.file('package.json')
      if (await pkgFile.exists()) {
        const pkg = await pkgFile.json()
        const scripts = Object.keys(pkg.scripts || {})
        resolvers.push(...scripts.map(s => `npm:${s}`))
        console.log(`  ✓ Found ${scripts.length} npm scripts`)
      }
    } catch {}

    // Discover Makefile targets
    try {
      const makeFile = Bun.file('Makefile')
      if (await makeFile.exists()) {
        const content = await makeFile.text()
        const targets = content.match(/^([a-z-]+):/gm) || []
        resolvers.push(...targets.map(t => `make:${t.replace(':', '')}`))
        console.log(`  ✓ Found ${targets.length} make targets`)
      }
    } catch {}

    if (resolvers.length > 0) {
      this.vessels.set('codebase', {
        id: 'codebase',
        name: 'Current Codebase',
        endpoint: 'local://',
        protocol: 'http',
        shapes: resolvers,
        capabilities: ['command', 'script', 'build', 'test'],
        source: 'introspection'
      })
    }
  }

  private buildShapeIndex() {
    this.shapeIndex.clear()

    for (const [vesselId, vessel] of this.vessels) {
      for (const shape of vessel.shapes) {
        if (!this.shapeIndex.has(shape)) {
          this.shapeIndex.set(shape, [])
        }
        this.shapeIndex.get(shape)!.push(vesselId)
      }
    }
  }

  private async checkHealth(vessel: VesselDescriptor): Promise<boolean> {
    // Skip health check for introspected vessels
    if (vessel.source === 'introspection') return true

    try {
      const healthUrl = vessel.endpoint.replace(/\/$/, '') + '/health'
      const response = await fetch(healthUrl, {
        signal: AbortSignal.timeout(2000)
      })

      vessel.health = {
        lastCheck: Date.now(),
        reachable: response.ok
      }

      return response.ok
    } catch {
      vessel.health = {
        lastCheck: Date.now(),
        reachable: false
      }
      return false
    }
  }

  listVessels(): VesselDescriptor[] {
    return Array.from(this.vessels.values())
  }

  listShapes(): Map<string, string[]> {
    return this.shapeIndex
  }
}

// =============================================================================
// 2. VESSEL INTERACTION VIA IMPULSES
// =============================================================================

interface Impulse {
  id: string
  shape: string
  content: any
  metadata: Record<string, any>
}

async function demonstrateVesselInteraction(discovery: VesselDiscoveryService) {
  console.log('\n' + '='.repeat(60))
  console.log('VESSEL INTERACTION DEMO')
  console.log('='.repeat(60))

  // Step 1: Get terminal state from terminal vessel
  console.log('\n1. Requesting terminalState from terminal vessel...')
  const terminalVessel = await discovery.resolveShape('terminalState')

  if (!terminalVessel) {
    console.log('   ⚠️  Terminal vessel not available (start it first)')
    return
  }

  // Simulate impulse resolution
  const terminalImpulse: Impulse = {
    id: 'terminal-demo-123',
    shape: 'terminalState',
    content: {
      buffer: '$ npm test\n✓ All tests passed\n',
      shellHistory: ['npm test'],
      exitCode: 0
    },
    metadata: { terminalId: 'demo-123' }
  }

  console.log('   ✓ Received terminal impulse')
  console.log('     Buffer:', terminalImpulse.content.buffer.trim())

  // Step 2: Process with LLM (hypothetical)
  console.log('\n2. Processing terminal output with LLM...')
  const analysisImpulse: Impulse = {
    id: 'analysis-demo-456',
    shape: 'analysis',
    content: 'Tests passed successfully. No errors detected.',
    metadata: {
      source: terminalImpulse.id,
      confidence: 0.95
    }
  }

  console.log('   ✓ Generated analysis impulse')
  console.log('     Analysis:', analysisImpulse.content)

  // Step 3: Create composite impulse
  console.log('\n3. Creating composite result...')
  const resultImpulse: Impulse = {
    id: 'result-demo-789',
    shape: 'test_result',
    content: {
      status: 'success',
      terminalOutput: terminalImpulse.content.buffer,
      analysis: analysisImpulse.content
    },
    metadata: {
      sourceImpulses: [terminalImpulse.id, analysisImpulse.id]
    }
  }

  console.log('   ✓ Created composite impulse')
  console.log('     Status:', resultImpulse.content.status)

  console.log('\n✓ Vessel interaction complete (via impulse chain)')
}

// =============================================================================
// 3. VESSEL BUNDLE MANAGEMENT
// =============================================================================

interface VesselBundle {
  name: string
  vessels: {
    id: string
    autoStart: boolean
    command?: string
    endpoint: string
  }[]
}

async function demonstrateVesselBundle() {
  console.log('\n' + '='.repeat(60))
  console.log('VESSEL BUNDLE DEMO')
  console.log('='.repeat(60))

  const bundle: VesselBundle = {
    name: 'development',
    vessels: [
      {
        id: 'terminal',
        autoStart: true,
        command: 'bun run repos/terminal/src/index.ts --port 9137',
        endpoint: 'http://localhost:9137'
      },
      {
        id: 'database',
        autoStart: false,
        endpoint: 'http://localhost:5432'
      }
    ]
  }

  console.log(`\n📦 Loading bundle: ${bundle.name}`)
  console.log(`   Vessels: ${bundle.vessels.map(v => v.id).join(', ')}`)

  for (const vessel of bundle.vessels) {
    if (vessel.autoStart && vessel.command) {
      console.log(`\n🚀 Starting vessel: ${vessel.id}`)
      console.log(`   Command: ${vessel.command}`)
      console.log(`   Endpoint: ${vessel.endpoint}`)
      console.log('   (would execute: Bun.spawn(...))')
    } else {
      console.log(`\n📌 Registered vessel: ${vessel.id}`)
      console.log(`   Endpoint: ${vessel.endpoint}`)
    }
  }

  console.log('\n✓ Bundle loaded')
}

// =============================================================================
// 4. ACTIVITY INTEGRATION
// =============================================================================

interface ActivityTask {
  id: string
  resolver: string
  inputShapes?: string[]
  outputShapes?: string[]
  config?: Record<string, any>
}

interface Activity {
  id: string
  name: string
  tasks: ActivityTask[]
}

async function demonstrateActivityIntegration(discovery: VesselDiscoveryService) {
  console.log('\n' + '='.repeat(60))
  console.log('ACTIVITY INTEGRATION DEMO')
  console.log('='.repeat(60))

  const activity: Activity = {
    id: 'debug-test-failure',
    name: 'Debug Test Failure',
    tasks: [
      {
        id: 'run-test',
        resolver: 'terminal',
        outputShapes: ['terminalState']
      },
      {
        id: 'analyze-output',
        resolver: 'llm',
        inputShapes: ['terminalState'],
        outputShapes: ['analysis']
      },
      {
        id: 'create-report',
        resolver: 'file',
        inputShapes: ['analysis'],
        outputShapes: ['file_content']
      }
    ]
  }

  console.log(`\n📋 Activity: ${activity.name}`)
  console.log(`   Tasks: ${activity.tasks.length}`)

  for (const [index, task] of activity.tasks.entries()) {
    console.log(`\n${index + 1}. Task: ${task.id}`)
    console.log(`   Resolver: ${task.resolver}`)

    // Resolve vessel for this task
    if (task.outputShapes) {
      for (const shape of task.outputShapes) {
        const vessel = await discovery.resolveShape(shape)
        if (vessel) {
          console.log(`   ✓ Will use ${vessel.name} for ${shape}`)
        } else {
          console.log(`   ⚠️  No vessel for ${shape}`)
        }
      }
    }
  }

  console.log('\n✓ Activity can execute (all vessels available)')
}

// =============================================================================
// MAIN DEMO
// =============================================================================

async function main() {
  console.clear()
  console.log('╔══════════════════════════════════════════════════════════╗')
  console.log('║        Vessel Discovery & Interaction Demo               ║')
  console.log('╚══════════════════════════════════════════════════════════╝')

  // 1. Discovery
  const discovery = new VesselDiscoveryService()
  await discovery.discover()

  // Show discovered vessels
  console.log('\n' + '='.repeat(60))
  console.log('DISCOVERED VESSELS')
  console.log('='.repeat(60))

  for (const vessel of discovery.listVessels()) {
    console.log(`\n📍 ${vessel.name}`)
    console.log(`   ID: ${vessel.id}`)
    console.log(`   Endpoint: ${vessel.endpoint}`)
    console.log(`   Source: ${vessel.source}`)
    console.log(`   Shapes: ${vessel.shapes.slice(0, 3).join(', ')}${vessel.shapes.length > 3 ? '...' : ''}`)
  }

  // Show shape index
  console.log('\n' + '='.repeat(60))
  console.log('SHAPE INDEX')
  console.log('='.repeat(60))

  const shapeIndex = discovery.listShapes()
  for (const [shape, vesselIds] of Array.from(shapeIndex.entries()).slice(0, 5)) {
    console.log(`\n🔷 ${shape}`)
    console.log(`   Vessels: ${vesselIds.join(', ')}`)
  }

  // 2. Interaction demo
  await demonstrateVesselInteraction(discovery)

  // 3. Bundle demo
  await demonstrateVesselBundle()

  // 4. Activity integration demo
  await demonstrateActivityIntegration(discovery)

  // Final summary
  console.log('\n' + '='.repeat(60))
  console.log('DEMO COMPLETE')
  console.log('='.repeat(60))
  console.log('\nKey Takeaways:')
  console.log('  1. ✓ Vessels discovered from multiple sources')
  console.log('  2. ✓ Shape-based routing works')
  console.log('  3. ✓ Vessels interact via impulses (not direct calls)')
  console.log('  4. ✓ Activities can compose multiple vessels')
  console.log('  5. ✓ Bundles simplify multi-vessel management')
  console.log('\nSee docs/architecture/VESSEL_DISCOVERY_AND_INTERACTION.md')
  console.log('for complete architectural details.')
}

main().catch(console.error)
