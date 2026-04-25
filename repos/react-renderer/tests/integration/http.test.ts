import { spawnVessel, type VesselHandle } from "@metabob/test-helpers"
import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { resolve } from "path"

const REACT_RENDERER_DIR = resolve(import.meta.dir, "../../")

describe("react-renderer HTTP API", () => {
  let vessel: VesselHandle

  beforeAll(async () => {
    vessel = await spawnVessel({
      cmd: ["bun", "src/index.ts"],
      cwd: REACT_RENDERER_DIR,
      port: 13001,
      env: { DISCOVERY_ENABLED: "false" },
      timeout: 15_000,
    })
  })

  afterAll(async () => {
    await vessel.stop()
  })

  // (a) GET /health returns 200 with status: "ok"
  test("GET /health returns 200 with status ok", async () => {
    const res = await fetch(`${vessel.baseUrl}/health`)
    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(body.status).toBe("ok")
  })

  // (b) POST /impulses with a data-table primitive returns 201 with id field
  test("POST /impulses creates a data-table impulse and returns 201 with id", async () => {
    const res = await fetch(`${vessel.baseUrl}/impulses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        primitive: {
          type: "data-table",
          columns: [
            { key: "name", header: "Name" },
            { key: "value", header: "Value" },
          ],
          data: [{ name: "foo", value: 1 }],
        },
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json() as { impulse: { id: string } }
    expect(body.impulse).toBeDefined()
    expect(typeof body.impulse.id).toBe("string")
    expect(body.impulse.id.length).toBeGreaterThan(0)
  })

  // (c) GET /impulses after a POST includes the newly created impulse
  test("GET /impulses includes newly created impulse by id", async () => {
    // Create a fresh impulse
    const createRes = await fetch(`${vessel.baseUrl}/impulses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        primitive: {
          type: "text",
          content: "hello from integration test",
          variant: "body",
        },
      }),
    })
    expect(createRes.status).toBe(201)
    const created = await createRes.json() as { impulse: { id: string } }
    const id = created.impulse.id

    const listRes = await fetch(`${vessel.baseUrl}/impulses`)
    expect(listRes.status).toBe(200)
    const listBody = await listRes.json() as { impulses: Array<{ id: string }> }
    expect(Array.isArray(listBody.impulses)).toBe(true)
    const found = listBody.impulses.some((imp) => imp.id === id)
    expect(found).toBe(true)
  })

  // (d) DELETE /impulses/:id removes it; subsequent GET returns 404
  test("DELETE /impulses/:id removes impulse; GET /impulses/:id returns 404", async () => {
    // Create impulse to delete
    const createRes = await fetch(`${vessel.baseUrl}/impulses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        primitive: {
          type: "badge",
          text: "to-delete",
          variant: "info",
        },
        deletable: true,
      }),
    })
    expect(createRes.status).toBe(201)
    const created = await createRes.json() as { impulse: { id: string } }
    const id = created.impulse.id

    // Delete it
    const delRes = await fetch(`${vessel.baseUrl}/impulses/${id}`, {
      method: "DELETE",
    })
    expect(delRes.status).toBe(200)
    const delBody = await delRes.json() as { success: boolean }
    expect(delBody.success).toBe(true)

    // Verify it's gone
    const getRes = await fetch(`${vessel.baseUrl}/impulses/${id}`)
    expect(getRes.status).toBe(404)
  })

  // (e) POST /impulses with unknown primitive type — graceful (no 5xx)
  test("POST /impulses with unknown primitive type returns 2xx (graceful degradation)", async () => {
    const res = await fetch(`${vessel.baseUrl}/impulses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        primitive: {
          type: "totally-unknown-xyz",
          props: {},
        },
      }),
    })
    // The server accepts the primitive as-is (no type validation on create)
    // and should not throw a 5xx
    expect(res.status).toBeLessThan(500)
  })

  test("POST /validate-spec accepts valid data-table spec", async () => {
    const res = await fetch(`${vessel.baseUrl}/validate-spec`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ primitive: { type: "data-table", columns: ["A"], data: [] } }),
    })
    const body = await res.json() as { valid: boolean; errors: unknown[] }
    expect(body.valid).toBe(true)
    expect(body.errors).toHaveLength(0)
  })

  test("POST /validate-spec rejects spec missing primitive field", async () => {
    const res = await fetch(`${vessel.baseUrl}/validate-spec`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
    const body = await res.json() as { valid: boolean }
    expect(body.valid).toBe(false)
  })
})
