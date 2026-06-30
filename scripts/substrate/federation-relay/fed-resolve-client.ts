// fed-resolve-client.ts — a consumer that resolves a shape FROM the running
// federation-transport vessel over libp2p (through the relay), proving the integrated
// in-substrate path. Target peerId is provided via env (obtained from the vessel /health).
import { createVesselLibp2p, resolveViaHttp } from './vessel-libp2p.ts'
const cli = await createVesselLibp2p({ vesselId: 'goal-host@substrate-a-client', relayMultiaddr: process.env.RELAY_MULTIADDR, enableHttp: true })
await new Promise((r) => setTimeout(r, 1500)) // let the client get its own relay reservation
const res = await resolveViaHttp(cli, process.env.TARGET_PEER!, { type: 'federation_probe' })
console.log('RESOLVED:', JSON.stringify(res))
console.log(res?.content?.produced_by ? 'INTEGRATED-RESOLVE-PASS' : 'INTEGRATED-RESOLVE-FAIL')
await cli.stop(); process.exit(0)
