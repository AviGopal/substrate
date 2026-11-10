#!/usr/bin/env bun
// walk-owner-seed.ts — write the walk vessels' owner rows (SPEC-V3 §9 step 3.2) from the installation.
//
// The walk runs on what a standard installation provides, so the owner rows the spec has a person write come from
// here, under the node key every vessel uses (METABOB_API_KEY). records treats the node's own key as node-self and
// takes the writer and role it declares; this script declares owner. It runs after records-vessel and before
// described-shape-vessel and walk-vessel (walk-owner-seed.service): described-shape reads the shape_schema targets
// once at start, and the walk waits for its own arm row.
//
// Idempotent: each row is written only when records holds no row that already says the same thing, so a reboot
// writes nothing new. Every row goes through discovery's /resolve by shape, which places it, as the walk vessels'
// own calls do; no address is read or written.
//
// Usage: bun /vessels/walk-owner-seed.ts   (DISCOVERY_URL from the unit, METABOB_API_KEY from /etc/substrate/env)

const DISCOVERY_URL = process.env.DISCOVERY_URL ?? "http://127.0.0.1:8100";
const KEY = process.env.METABOB_API_KEY;
if (!KEY) throw new Error("METABOB_API_KEY is not set: the node key comes from /etc/substrate/env");
const OWNER = "owner";
// Two LLM channels with different requested models (§9 step 3.2). The producer is the model the resolver reports, so
// two channels share a producer while the resolver serves both from one fallback model.
const CHANNEL_MODELS = ["google/gemini-2.5-flash", "deepseek/deepseek-v4.1-flash-1017"];
const MAX_SEQ = 9007199254740991;

type Row = Record<string, unknown>;

async function post(url: string, payload: object): Promise<unknown> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `ApiKey ${KEY}` },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) throw new Error(`${url} ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r.json();
}

const records = (shape: string, pointer: object): Promise<unknown> =>
  post(new URL("/resolve", DISCOVERY_URL).href, { pointer: { ...pointer, type: shape } });

const read = async (shape: string, where?: Row): Promise<Row[]> =>
  (await records("record_read", { shape, ...(where ? { where } : {}) })) as Row[];

// A row "already says it" when every field we write equals the latest matching row's (JSON-compared).
async function ensure(row: Row, where: Row | undefined, label: string): Promise<void> {
  const rows = await read(row.shape as string, where);
  const same = (r: Row) => Object.keys(row).every((k) => JSON.stringify(r[k]) === JSON.stringify(row[k]));
  const latest = where ? rows[rows.length - 1] : rows.find(same);
  if (latest && same(latest)) { console.log(`[walk-owner-seed] ${label}: present (${latest.id})`); return; }
  const w = (await records("record_write", { row: { ...row, input_refs: [] }, writer: OWNER, role: OWNER })) as Row;
  console.log(`[walk-owner-seed] ${label}: wrote ${w.id ?? JSON.stringify(w).slice(0, 80)}`);
}

const JSON_ONLY = "Reply with only the JSON object: no prose, no code fence.";
const SCHEMAS: Row[] = [
  {
    target: "answer",
    description: `The answer to what the world_changed row's \`what\` field asks for. ${JSON_ONLY}`,
    schema: { type: "object", required: ["text"], properties: { text: { type: "string", minLength: 1 } } },
    inputs: ["world_changed"],
    context: ["hop"],
  },
  {
    target: "outcome",
    // records derives the graded cells from the row evidence_refs names, so nothing is copied from a selection.
    // A request that lapsed (reads lists its due row: past its time, unanswered, ungraded) is graded too, as r 0.
    description: "How the world_changed row's request went. If there is an answer row, r is 1 when it does what " +
      "`what` asks, correctly and completely, and 0 when not, and evidence_refs holds the answer row's id. If there is " +
      "no answer row and reads lists a due row of this request, the request lapsed: r is 0 and evidence_refs holds " +
      `that due row's id. event_ref is the world_changed row's id. ${JSON_ONLY}`,
    schema: {
      type: "object",
      required: ["event_ref", "r", "evidence_refs"],
      properties: {
        event_ref: { type: "string", minLength: 1 },
        r: { enum: [0, 1] },
        evidence_refs: { type: "array", minItems: 1, items: { type: "string" } },
      },
    },
    inputs: ["world_changed"],
    context: ["answer", "due"],
    reads: [{ type: "record_lapsed", deadline_shape: "due", answer_shape: "answer" }],
  },
  {
    target: "request",
    description: "A request for data the world_changed row's `what` needs from a vessel: pointer.type is the shape to " +
      "resolve, and pointer's other fields are its arguments. The shapes that exist, and what each produces, are in " +
      `reads; a failure row says why an earlier call did not answer. ${JSON_ONLY}`,
    schema: {
      type: "object",
      required: ["pointer"],
      properties: { pointer: { type: "object", required: ["type"], properties: { type: { type: "string", minLength: 1 } } } },
    },
    inputs: ["world_changed"],
    context: ["hop", "failure"],
    reads: [{ type: "shapeDescriptions" }],
  },
  {
    target: "due",
    // at, not t: records stamps every row's t with its write time, and the walk's wait-until reads due.at.
    description: "When the world_changed row's `what` should be settled by: at is a Unix time in milliseconds, no " +
      `later than 30 minutes after the world_changed row's t. ${JSON_ONLY}`,
    schema: { type: "object", required: ["at"], properties: { at: { type: "number" } } },
    inputs: ["world_changed"],
  },
  {
    target: "activity_template",
    description: "A reusable template of the calls that led to the outcome row: sig.in and sig.out are the shapes it " +
      `consumes and produces, and calls lists each call in order: its shape, and in pointer the arguments that call ` +
      `takes. ${JSON_ONLY}`,
    schema: {
      type: "object",
      required: ["sig", "calls"],
      properties: {
        sig: {
          type: "object", required: ["in", "out"],
          properties: { in: { type: "array", items: { type: "string" } }, out: { type: "array", items: { type: "string" } } },
        },
        calls: {
          type: "array", minItems: 1,
          items: { type: "object", required: ["shape"], properties: { shape: { type: "string" }, pointer: { type: "object" } } },
        },
      },
    },
    inputs: ["outcome"],
    context: ["hop"],
  },
];

// A channel names a shape and its arguments; discovery places each call, so the row holds no address.
for (const model of CHANNEL_MODELS) {
  const calls = [{
    pointer: { type: "llm_completion", model },
    input_field: "prompt", output_field: "content", producer_field: "model",
  }];
  await ensure({ shape: "channel", calls }, undefined, `channel ${model}`);
}
for (const s of SCHEMAS) await ensure({ shape: "shape_schema", ...s }, { target: s.target }, `shape_schema ${s.target}`);
await ensure({ shape: "arm", vessel_id: "walk-vessel", arm: "treated", as_of_seq: MAX_SEQ }, { vessel_id: "walk-vessel" }, "arm walk-vessel");
console.log("[walk-owner-seed] owner rows in place");
