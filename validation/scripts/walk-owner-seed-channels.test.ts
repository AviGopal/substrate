// walk-owner-seed-channels.test.ts — LLM channel reconciliation in walk-owner-seed.ts (concept_Drrlom22CRUC / agf_p3oa3153cx4e).
//
// WHAT IS JUDGED.
//   Pure planner (planChannelWrites / channelKey / channelCallsFor / CHANNEL_MODELS / CHANNEL_MAX_TOKENS) and end-to-end
//   seeder runs against a loopback stub store:
//   - [MUST-FAIL] CHANNEL_MODELS is the 2-channel SOTA paid lineup (google/gemini-3.8-flash, z-ai/glm-5.3)
//     and every desired channel carries max_tokens: 16384;
//   - [MUST-FAIL] dropped llm_completion models (e.g., google/gemini-2.5-flash, deepseek/deepseek-v4.1-flash-1017) emit
//     { shape: "channel", calls: latest.calls, retired: true };
//   - [MUST-FAIL] an active model with an older pointer (missing or differing max_tokens) emits a superseding active row
//     with max_tokens: 16384;
//   - [MUST-FAIL] a previously retired model re-added to CHANNEL_MODELS emits a new active row even when an older
//     pre-retirement active row with identical calls exists in history (and regardless of input seq order);
//   - [GUARD] applying planned writes and reconciling again emits 0 writes (strictly idempotent);
//   - [GUARD] non-LLM channels (pointer.type !== "llm_completion") are not retired, and already-retired channels are not
//     retired again.
//
// SAFETY and NEEDS: loopback only (stub store), a private temp dir.
import { afterAll, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

type Row = Record<string, any>
const ROOT = resolve(import.meta.dir, "../..")
const SEED = join(ROOT, "scripts/substrate/walk-owner-seed.ts")
const INVENTORY = join(ROOT, "scripts/substrate/vessels.inventory.json")

const EXPECTED_MODELS = [
  "google/gemini-3.8-flash",
  "z-ai/glm-5.3",
] as const
const EXPECTED_MAX_TOKENS = 16384

const T = mkdtempSync(join(tmpdir(), "wos-channels-"))
afterAll(() => rmSync(T, { recursive: true, force: true }))

const seedOver = async (initial: Row[]): Promise<{ code: number; rows: Row[]; out: string }> => {
  const rows: Row[] = initial.map((r) => ({ ...r }))
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: async (req) => {
      const p = (((await req.json().catch(() => ({}))) as Row).pointer ?? {}) as Row
      if (p.type === "record_read") {
        const where = (p.where ?? {}) as Row
        return Response.json(
          rows
            .filter((r) => r.shape === p.shape)
            .filter((r) => Object.entries(where).every(([k, v]) => String(r[k]) === String(v))),
        )
      }
      if (p.type === "record_write") {
        const nextSeq = rows.reduce((m, r) => Math.max(m, typeof r.seq === "number" ? r.seq : 0), 0) + 1
        const r = { ...p.row, id: `o${rows.length + 1}`, seq: nextSeq, writer: p.writer, role: p.role }
        rows.push(r)
        return Response.json(r)
      }
      return Response.json({ error: "Not found", shape: p.type }, { status: 404 })
    },
  })
  await Bun.write(join(T, "walk-owner-seed.ts"), Bun.file(SEED))
  await Bun.write(join(T, "vessels.inventory.json"), Bun.file(INVENTORY))
  const proc = Bun.spawn([process.execPath, join(T, "walk-owner-seed.ts")], {
    env: {
      PATH: process.env.PATH ?? "",
      DISCOVERY_URL: `http://127.0.0.1:${server.port}`,
      METABOB_API_KEY: `mb-channeltest-${"k".repeat(32)}`,
    },
    stdout: "pipe",
    stderr: "pipe",
  })
  const code = await proc.exited
  const out = (await new Response(proc.stdout).text()) + (await new Response(proc.stderr).text())
  server.stop(true)
  return { code, rows, out }
}

const llmRow = (model: string, seq: number, opts?: { maxTokens?: number; retired?: boolean }): Row => ({
  shape: "channel",
  id: `ch-${seq}`,
  seq,
  role: "owner",
  writer: "owner",
  calls: [{
    pointer: {
      type: "llm_completion",
      model,
      ...(opts?.maxTokens !== undefined ? { max_tokens: opts.maxTokens } : {}),
    },
    input_field: "prompt",
    output_field: "content",
    producer_field: "model",
  }],
  ...(opts?.retired ? { retired: true } : {}),
})

describe("channel reconciliation planner (pure)", () => {
  test("[MUST-FAIL] CHANNEL_MODELS has the exact 2 SOTA slugs and desired channels carry max_tokens: 16384", async () => {
    const mod = await import(SEED)
    expect(mod.CHANNEL_MODELS).toEqual([...EXPECTED_MODELS])
    expect(mod.CHANNEL_MAX_TOKENS).toBe(EXPECTED_MAX_TOKENS)
    const planned = mod.planChannelWrites([], mod.CHANNEL_MODELS, mod.CHANNEL_MAX_TOKENS)
    expect(planned).toHaveLength(2)
    for (let i = 0; i < EXPECTED_MODELS.length; i++) {
      expect(planned[i].row).toEqual({
        shape: "channel",
        calls: [{
          pointer: {
            type: "llm_completion",
            model: EXPECTED_MODELS[i],
            max_tokens: EXPECTED_MAX_TOKENS,
          },
          input_field: "prompt",
          output_field: "content",
          producer_field: "model",
        }],
      })
    }
  })

  test("[MUST-FAIL] dropped llm_completion models emit { shape: 'channel', calls: latest.calls, retired: true }", async () => {
    const mod = await import(SEED)
    const oldGemini = llmRow("google/gemini-2.5-flash", 1)
    const oldDeepseek = llmRow("deepseek/deepseek-v4.1-flash-1017", 2)
    const planned = mod.planChannelWrites([oldGemini, oldDeepseek], mod.CHANNEL_MODELS, mod.CHANNEL_MAX_TOKENS)

    const retired = planned.filter((p: Row) => p.row.retired === true)
    expect(retired).toHaveLength(2)
    expect(retired.map((p: Row) => p.row)).toEqual([
      { shape: "channel", calls: oldGemini.calls, retired: true },
      { shape: "channel", calls: oldDeepseek.calls, retired: true },
    ])

    const active = planned.filter((p: Row) => p.row.retired !== true)
    expect(active.map((p: Row) => p.row.calls[0].pointer.model)).toEqual([...EXPECTED_MODELS])
  })

  test("[MUST-FAIL] active model with older pointer (missing or older max_tokens) emits superseding active row with max_tokens: 16384", async () => {
    const mod = await import(SEED)
    const missingMax = llmRow(EXPECTED_MODELS[0], 1)
    const lowerMax = llmRow(EXPECTED_MODELS[1], 2, { maxTokens: 4096 })
    const planned = mod.planChannelWrites([missingMax, lowerMax], mod.CHANNEL_MODELS, mod.CHANNEL_MAX_TOKENS)

    expect(planned).toHaveLength(2)
    expect(planned.every((p: Row) => p.row.retired === undefined)).toBe(true)
    expect(planned.map((p: Row) => p.row.calls[0].pointer)).toEqual([
      { type: "llm_completion", model: EXPECTED_MODELS[0], max_tokens: EXPECTED_MAX_TOKENS },
      { type: "llm_completion", model: EXPECTED_MODELS[1], max_tokens: EXPECTED_MAX_TOKENS },
    ])
  })

  test("[MUST-FAIL] previously retired model re-added to CHANNEL_MODELS emits a new active row despite older matching history (even out of seq order)", async () => {
    const mod = await import(SEED)
    // Out-of-order seq: retired (seq 5) precedes earlier identical active (seq 1) in array order.
    const earlierActive = llmRow(EXPECTED_MODELS[0], 1, { maxTokens: EXPECTED_MAX_TOKENS })
    const laterRetired = llmRow(EXPECTED_MODELS[0], 5, { maxTokens: EXPECTED_MAX_TOKENS, retired: true })
    const currentSecond = llmRow(EXPECTED_MODELS[1], 3, { maxTokens: EXPECTED_MAX_TOKENS })

    const planned = mod.planChannelWrites(
      [laterRetired, earlierActive, currentSecond],
      mod.CHANNEL_MODELS,
      mod.CHANNEL_MAX_TOKENS,
    )

    expect(planned).toHaveLength(1)
    expect(planned[0].row).toEqual({
      shape: "channel",
      calls: [{
        pointer: { type: "llm_completion", model: EXPECTED_MODELS[0], max_tokens: EXPECTED_MAX_TOKENS },
        input_field: "prompt",
        output_field: "content",
        producer_field: "model",
      }],
    })
    expect(planned[0].row.retired).toBeUndefined()
  })

  test("[GUARD] reconciling a second time after applying planned writes emits 0 writes (strictly idempotent)", async () => {
    const mod = await import(SEED)
    const initial: Row[] = [
      llmRow("google/gemini-2.5-flash", 1),
      llmRow("deepseek/deepseek-v4.1-flash-1017", 2),
      llmRow(EXPECTED_MODELS[0], 3, { maxTokens: 4096 }),
    ]
    const first = mod.planChannelWrites(initial, mod.CHANNEL_MODELS, mod.CHANNEL_MAX_TOKENS)
    expect(first.length).toBeGreaterThan(0)

    let seq = 10
    const afterFirst = [
      ...initial,
      ...first.map((w: Row) => ({ ...w.row, id: `w-${seq}`, seq: seq++, role: "owner", writer: "owner" })),
    ]
    const second = mod.planChannelWrites(afterFirst, mod.CHANNEL_MODELS, mod.CHANNEL_MAX_TOKENS)
    expect(second).toEqual([])
  })

  test("[GUARD] non-LLM channels (pointer.type !== 'llm_completion') are never retired, and already-retired channels are not retired again", async () => {
    const mod = await import(SEED)
    const nonLlmWithModel: Row = {
      shape: "channel",
      id: "non-llm-1",
      seq: 1,
      calls: [{ pointer: { type: "embedding_completion", model: "text-embedding-3-large" }, input_field: "text", output_field: "vector" }],
    }
    const nonLlmNoModel: Row = {
      shape: "channel",
      id: "non-llm-2",
      seq: 2,
      calls: [{ pointer: { type: "custom_tool" }, input_field: "in", output_field: "out" }],
    }
    const alreadyRetired = llmRow("google/gemini-2.5-flash", 3, { retired: true })
    const active0 = llmRow(EXPECTED_MODELS[0], 4, { maxTokens: EXPECTED_MAX_TOKENS })
    const active1 = llmRow(EXPECTED_MODELS[1], 5, { maxTokens: EXPECTED_MAX_TOKENS })

    const planned = mod.planChannelWrites(
      [nonLlmWithModel, nonLlmNoModel, alreadyRetired, active0, active1],
      mod.CHANNEL_MODELS,
      mod.CHANNEL_MAX_TOKENS,
    )
    expect(planned).toEqual([])
  })
})

describe("walk-owner-seed end-to-end channel reconciliation", () => {
  test("[MUST-FAIL] upgrades live-like store: writes 2 SOTA channels with max_tokens 16384 and retires dropped models, then second run writes 0 channel rows", async () => {
    const oldGemini = llmRow("google/gemini-2.5-flash", 1)
    const oldDeepseek = llmRow("deepseek/deepseek-v4.1-flash-1017", 2)
    const nonLlm: Row = {
      shape: "channel",
      id: "non-llm",
      seq: 3,
      role: "owner",
      writer: "owner",
      calls: [{ pointer: { type: "custom_channel", model: "custom/v1" }, input_field: "in", output_field: "out" }],
    }

    const first = await seedOver([oldGemini, oldDeepseek, nonLlm])
    expect(first.code).toBe(0)

    const writtenChannels = first.rows.slice(3).filter((r) => r.shape === "channel")
    expect(writtenChannels).toHaveLength(4)

    const activeWritten = writtenChannels.filter((r) => r.retired !== true)
    expect(activeWritten.map((r) => r.calls[0].pointer)).toEqual([
      { type: "llm_completion", model: EXPECTED_MODELS[0], max_tokens: EXPECTED_MAX_TOKENS },
      { type: "llm_completion", model: EXPECTED_MODELS[1], max_tokens: EXPECTED_MAX_TOKENS },
    ])
    expect(activeWritten.every((r) => r.role === "owner" && r.writer === "owner")).toBe(true)

    const retiredWritten = writtenChannels.filter((r) => r.retired === true)
    expect(retiredWritten.map((r) => r.calls)).toEqual([oldGemini.calls, oldDeepseek.calls])
    expect(retiredWritten.every((r) => r.role === "owner" && r.writer === "owner")).toBe(true)

    // Second run is strictly idempotent: zero new rows of any shape.
    const beforeSecond = first.rows.length
    const second = await seedOver(first.rows)
    expect(second.code).toBe(0)
    expect(second.rows.length).toBe(beforeSecond)
  })

  test("[MUST-FAIL] re-enables a previously retired desired model even when an identical pre-retirement row exists in history", async () => {
    const initial: Row[] = [
      llmRow(EXPECTED_MODELS[0], 1, { maxTokens: EXPECTED_MAX_TOKENS }),
      llmRow(EXPECTED_MODELS[0], 2, { maxTokens: EXPECTED_MAX_TOKENS, retired: true }),
      llmRow(EXPECTED_MODELS[1], 3, { maxTokens: EXPECTED_MAX_TOKENS }),
    ]
    const res = await seedOver(initial)
    expect(res.code).toBe(0)
    const writtenChannels = res.rows.slice(initial.length).filter((r) => r.shape === "channel")
    expect(writtenChannels).toHaveLength(1)
    expect(writtenChannels[0].calls[0].pointer).toEqual({
      type: "llm_completion",
      model: EXPECTED_MODELS[0],
      max_tokens: EXPECTED_MAX_TOKENS,
    })
    expect(writtenChannels[0].retired).toBeUndefined()
  })
})
