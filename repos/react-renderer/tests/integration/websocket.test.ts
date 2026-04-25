import { spawnVessel, connectWS, type VesselHandle } from "@metabob/test-helpers"
import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { resolve } from "path"

const REACT_RENDERER_DIR = resolve(import.meta.dir, "../../")
const WS_URL = "ws://localhost:13002/ws"
const BASE_URL = "http://localhost:13002"

describe("react-renderer WebSocket protocol", () => {
  let vessel: VesselHandle

  beforeAll(async () => {
    vessel = await spawnVessel({
      cmd: ["bun", "src/index.ts"],
      cwd: REACT_RENDERER_DIR,
      port: 13002,
      env: { DISCOVERY_ENABLED: "false" },
      timeout: 15_000,
    })
  })

  afterAll(async () => {
    await vessel.stop()
  })

  // (a) On connect, client receives "connected" message immediately
  test("on connect, client receives a 'connected' message within 5s", async () => {
    const client = await connectWS(WS_URL)
    try {
      const msg = await client.waitFor("connected", 5_000) as Record<string, unknown>
      expect(msg.type).toBe("connected")
      expect(typeof msg.sessionId).toBe("string")
      expect(Array.isArray(msg.capabilities)).toBe(true)
    } finally {
      client.close()
    }
  })

  // (b) After POST /impulses, WS client receives "impulse_create" with the impulse id
  test("after POST /impulses, WS client receives impulse_create containing the impulse id", async () => {
    const client = await connectWS(WS_URL)
    // Wait for the connected handshake first so we don't miss any messages
    await client.waitFor("connected", 5_000)

    try {
      const res = await fetch(`${BASE_URL}/impulses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primitive: {
            type: "text",
            content: "ws-test-create",
            variant: "body",
          },
        }),
      })
      expect(res.status).toBe(201)
      const created = await res.json() as { impulse: { id: string } }
      const id = created.impulse.id

      const msg = await client.waitFor("impulse_create", 8_000) as Record<string, unknown>
      expect(msg.type).toBe("impulse_create")
      const impulse = msg.impulse as Record<string, unknown>
      expect(impulse.id).toBe(id)
    } finally {
      client.close()
    }
  })

  // (c) After PUT /impulses/:id, WS client receives "impulse_update"
  test("after PUT /impulses/:id, WS client receives impulse_update", async () => {
    // First create an impulse
    const createRes = await fetch(`${BASE_URL}/impulses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        primitive: {
          type: "badge",
          text: "original",
          variant: "info",
        },
      }),
    })
    expect(createRes.status).toBe(201)
    const created = await createRes.json() as { impulse: { id: string } }
    const id = created.impulse.id

    // Now connect WS and wait for connected
    const client = await connectWS(WS_URL)
    await client.waitFor("connected", 5_000)
    // Also consume any state_sync that may arrive
    // (store is non-empty at this point, so state_sync is sent on connect)

    try {
      // Update the impulse
      const updateRes = await fetch(`${BASE_URL}/impulses/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority: "high" }),
      })
      expect(updateRes.status).toBe(200)

      const msg = await client.waitFor("impulse_update", 8_000) as Record<string, unknown>
      expect(msg.type).toBe("impulse_update")
      expect(msg.id).toBe(id)
    } finally {
      client.close()
    }
  })

  // (d) After DELETE /impulses/:id, WS client receives "impulse_delete"
  test("after DELETE /impulses/:id, WS client receives impulse_delete", async () => {
    // Create an impulse to delete
    const createRes = await fetch(`${BASE_URL}/impulses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        primitive: {
          type: "badge",
          text: "to-delete-ws",
          variant: "warning",
        },
        deletable: true,
      }),
    })
    expect(createRes.status).toBe(201)
    const created = await createRes.json() as { impulse: { id: string } }
    const id = created.impulse.id

    const client = await connectWS(WS_URL)
    await client.waitFor("connected", 5_000)

    try {
      const delRes = await fetch(`${BASE_URL}/impulses/${id}`, {
        method: "DELETE",
      })
      expect(delRes.status).toBe(200)

      const msg = await client.waitFor("impulse_delete", 8_000) as Record<string, unknown>
      expect(msg.type).toBe("impulse_delete")
      expect(msg.id).toBe(id)
    } finally {
      client.close()
    }
  })

  // (e) State-sync on reconnect: create impulse, disconnect, reconnect — new client
  //     receives state_sync containing that impulse id
  test("on reconnect with non-empty store, new WS client receives state_sync containing prior impulse", async () => {
    // Create an impulse so the store is non-empty
    const createRes = await fetch(`${BASE_URL}/impulses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        primitive: {
          type: "text",
          content: "state-sync-probe",
          variant: "caption",
        },
      }),
    })
    expect(createRes.status).toBe(201)
    const created = await createRes.json() as { impulse: { id: string } }
    const id = created.impulse.id

    // Connect, close, reconnect
    const first = await connectWS(WS_URL)
    await first.waitFor("connected", 5_000)
    first.close()

    const second = await connectWS(WS_URL)
    try {
      // The handler sends state_sync after connected when impulses.length > 0
      const sync = await second.waitFor("state_sync", 8_000) as Record<string, unknown>
      expect(sync.type).toBe("state_sync")
      const impulses = sync.impulses as Array<{ id: string }>
      expect(Array.isArray(impulses)).toBe(true)
      const found = impulses.some((imp) => imp.id === id)
      expect(found).toBe(true)
    } finally {
      second.close()
    }
  })
})
