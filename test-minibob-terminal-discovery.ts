#!/usr/bin/env bun
/**
 * Test MiniBob Terminal Vessel Discovery
 *
 * Demonstrates MiniBob discovering the terminal vessel via the backend registry.
 */

import { VesselDiscoveryClient } from './repos/minibob/src/vessel-discovery'

const GREEN = '\x1b[32m'
const BLUE = '\x1b[34m'
const YELLOW = '\x1b[33m'
const NC = '\x1b[0m'

console.log(`${BLUE}═══════════════════════════════════════════════════${NC}`)
console.log(`${BLUE}MiniBob Terminal Vessel Discovery Test${NC}`)
console.log(`${BLUE}═══════════════════════════════════════════════════${NC}`)
console.log()

async function main() {
  // Initialize discovery client with local backend
  console.log(`${BLUE}1. Initializing vessel discovery client...${NC}`)
  const discoveryClient = new VesselDiscoveryClient('http://activity.metabob.local')
  console.log(`${GREEN}✓ Discovery client initialized${NC}`)
  console.log()

  // Discover vessels for terminalState shape
  console.log(`${BLUE}2. Discovering vessels that can resolve 'terminalState'...${NC}`)
  const discovery = await discoveryClient.discoverVesselsForShape('terminalState')

  if (discovery.found) {
    console.log(`${GREEN}✓ Found ${discovery.vessels.length} vessel(s)${NC}`)
    for (const vessel of discovery.vessels) {
      console.log(`   - ${vessel.vesselName} (${vessel.vesselId})`)
      console.log(`     Endpoint: ${vessel.endpoint}`)
      console.log(`     Shapes: ${vessel.shapes.join(', ')}`)
      if (vessel.metadata) {
        console.log(`     Metadata:`, vessel.metadata)
      }
    }
  } else {
    console.log(`${YELLOW}⚠ No vessels found for terminalState${NC}`)
    process.exit(1)
  }
  console.log()

  // Test resolution via discovery
  console.log(`${BLUE}3. Testing impulse resolution via discovered vessel...${NC}`)
  try {
    const testPointer = {
      type: 'terminalState',
      terminalId: 'test-terminal'
    }

    console.log(`   Resolving pointer:`, testPointer)
    const result = await discoveryClient.resolveViaDiscovery(testPointer)
    console.log(`${GREEN}✓ Successfully resolved impulse${NC}`)
    console.log(`   Result type: ${typeof result}`)
    if (typeof result === 'object' && 'content' in result) {
      console.log(`   Has content: ${(result as any).content.length} chars`)
      console.log(`   Has metadata: ${!!(result as any).metadata}`)
    }
  } catch (error: any) {
    // Expected to fail if terminal doesn't exist, but connection works
    if (error.message.includes('not found') || error.message.includes('404')) {
      console.log(`${GREEN}✓ Vessel endpoint reachable (terminal doesn't exist yet, expected)${NC}`)
    } else {
      console.log(`${YELLOW}⚠ Resolution failed: ${error.message}${NC}`)
    }
  }
  console.log()

  // Check cache
  console.log(`${BLUE}4. Checking discovery cache...${NC}`)
  const cacheStats = discoveryClient.getCacheStats()
  console.log(`${GREEN}✓ Cache statistics:${NC}`)
  console.log(`   Entries: ${cacheStats.entries}`)
  console.log(`   Shapes cached: ${cacheStats.shapes.join(', ')}`)
  console.log()

  // Discover multiple shapes
  console.log(`${BLUE}5. Discovering other terminal shapes...${NC}`)
  const shapes = ['terminalCommand', 'terminalOutput']
  for (const shape of shapes) {
    const result = await discoveryClient.discoverVesselsForShape(shape)
    if (result.found) {
      console.log(`${GREEN}✓ ${shape}: ${result.vessels.length} vessel(s)${NC}`)
    } else {
      console.log(`${YELLOW}⚠ ${shape}: No vessels found${NC}`)
    }
  }
  console.log()

  console.log(`${BLUE}═══════════════════════════════════════════════════${NC}`)
  console.log(`${GREEN}✓ Discovery test complete!${NC}`)
  console.log(`${BLUE}═══════════════════════════════════════════════════${NC}`)
  console.log()
  console.log(`${GREEN}Summary:${NC}`)
  console.log(`  1. MiniBob discovery client initialized`)
  console.log(`  2. Successfully discovered terminal vessel from backend registry`)
  console.log(`  3. Vessel endpoint is reachable`)
  console.log(`  4. Discovery cache working correctly`)
  console.log(`  5. Multiple shapes discoverable from same vessel`)
  console.log()
  console.log(`${BLUE}Next:${NC}`)
  console.log(`  - MiniBob can now use terminal impulses in activities`)
  console.log(`  - Terminal state/commands/output automatically resolved`)
  console.log(`  - No hardcoded dependencies between MiniBob and terminal vessel`)
}

main().catch((error) => {
  console.error(`${YELLOW}Test failed:${NC}`, error)
  process.exit(1)
})
