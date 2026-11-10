#!/usr/bin/env bun
// walk-owner-seed.ts — write the walk vessels' owner rows (SPEC-V3 §9 step 3.2) from the installation.
//
// The walk runs on what a standard installation provides (user ruling 2026-11-09), so the owner rows the spec has a
// person write come from here, under the owner key seed-identity minted (walk-owner; RECORDS_OWNER_KEY_ID). It runs
// after records-vessel and before described-shape-vessel and walk-vessel (walk-owner-seed.service): described-shape
// reads the shape_schema targets once at start, and the walk waits for its own arm row.
//
// Idempotent: each row is written only when records holds no row that already says the same thing, so a reboot
// writes nothing new, and a key re-issued by seed-identity gets a fresh vessel_key row (records reads the latest).
// Rows go through discovery to whichever vessel serves record_read / record_write, as the walk vessels' own calls do.
//
// Usage: bun /vessels/walk-owner-seed.ts   (DISCOVERY_URL from the unit; the owner key is bound at /run/walk-owner.key)

import { readFileSync } from "node:fs";

const DISCOVERY_URL = process.env.DISCOVERY_URL ?? "http://127.0.0.1:8100";
const KEY = readFileSync("/run/walk-owner.key", "utf-8").trim();
const KEY_IDS_FILE = "/workspace/substrate/walk-vessels/key-ids.json";
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

async function producer(shape: string): Promise<{ endpoint: string; resolve_endpoint: string }> {
  const d = (await post(new URL("/resolve", DISCOVERY_URL).href, { pointer: { type: "vesselCapability", shape } })) as {
    content: { vessels: { endpoint: string; resolve_endpoint: string }[] };
  };
  const [e] = d.content.vessels;
  if (!e) throw new Error(`discovery names no producer of ${shape}`);
  return e;
}

async function records(shape: string, pointer: object): Promise<unknown> {
  const e = await producer(shape);
  return post(new URL(e.resolve_endpoint, e.endpoint).href, { impulse: { pointer: { ...pointer, type: shape } } });
}

const read = async (shape: string, where?: Row): Promise<Row[]> =>
  (await records("record_read", { shape, ...(where ? { where } : {}) })) as Row[];

// A row "already says it" when every field we write equals the latest matching row's (JSON-compared).
async function ensure(row: Row, where: Row | undefined, label: string): Promise<void> {
  const rows = await read(row.shape as string, where);
  const same = (r: Row) => Object.keys(row).every((k) => JSON.stringify(r[k]) === JSON.stringify(row[k]));
  const latest = where ? rows[rows.length - 1] : rows.find(same);
  if (latest && same(latest)) { console.log(`[walk-owner-seed] ${label}: present (${latest.id})`); return; }
  const w = (await records("record_write", { row: { ...row, input_refs: [] } })) as Row;
  console.log(`[walk-owner-seed] ${label}: wrote ${w.id ?? JSON.stringify(w).slice(0, 80)}`);
}

const JSON_ONLY = "Reply with only the JSON object: no prose, no code fence.";
const SCHEMAS: Row[] = [
  {
    target: "answer",
    description: `The answer to what the world_changed row's \`what\` field asks for. ${JSON_ONLY}`,
    schema: { type: "object", required: ["text"], properties: { text: { type: "string", minLength: 1 } } },
    inputs: ["world_changed"],
  },
  {
    target: "outcome",
    // cell is what records folds the outcome into (fold.ts: outcome.cell === selection.cell), so it must be the
    // chosen selection's own cell string, copied, never the selection's id.
    description: "Whether the answer row does what the world_changed row's `what` asks, correctly and completely: " +
      "r is 1 if it does and 0 if not. event_ref is the world_changed row's id, evidence_refs holds the answer row's " +
      "id, and cell is copied exactly, character for character, from the `cell` field of the selection row whose id " +
      `equals the answer row's selection_ref (not that id itself). ${JSON_ONLY}`,
    schema: {
      type: "object",
      required: ["cell", "event_ref", "r", "evidence_refs"],
      properties: {
        cell: { type: "string", minLength: 1 },
        event_ref: { type: "string", minLength: 1 },
        r: { enum: [0, 1] },
        evidence_refs: { type: "array", minItems: 1, items: { type: "string" } },
      },
    },
    inputs: ["world_changed", "answer"],
  },
  {
    target: "request",
    description: "A request for data the world_changed row's `what` needs from a vessel: pointer.type is the shape to " +
      `resolve, and pointer's other fields are its arguments. ${JSON_ONLY}`,
    schema: {
      type: "object",
      required: ["pointer"],
      properties: { pointer: { type: "object", required: ["type"], properties: { type: { type: "string", minLength: 1 } } } },
    },
    inputs: ["world_changed"],
  },
  {
    target: "due",
    description: `When the world_changed row's \`what\` should be settled by: t is a Unix time in milliseconds. ${JSON_ONLY}`,
    schema: { type: "object", required: ["t"], properties: { t: { type: "number" } } },
    inputs: ["world_changed"],
  },
  {
    target: "activity_template",
    description: "A reusable template of the calls that led to the outcome row: sig.in and sig.out are the shapes it " +
      `consumes and produces, and calls lists each call's shape and vessel_id in order. ${JSON_ONLY}`,
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
          items: { type: "object", required: ["shape", "vessel_id"], properties: { shape: { type: "string" }, vessel_id: { type: "string" } } },
        },
      },
    },
    inputs: ["outcome"],
  },
];

const ids = JSON.parse(readFileSync(KEY_IDS_FILE, "utf-8")) as Record<string, string>;
const VESSEL_KEYS: [string, string][] = [["records-vessel", "records"], ["described-shape-vessel", "described"], ["walk-vessel", "walk"]];

for (const [vessel_id, role] of VESSEL_KEYS) {
  if (!ids[vessel_id]) throw new Error(`no key id for ${vessel_id} in ${KEY_IDS_FILE}`);
  // vessel_role, not role: records stamps every row's role with its writer's (auth.ts reads vessel_role).
  await ensure({ shape: "vessel_key", vessel_id, key_id: ids[vessel_id], vessel_role: role }, { vessel_id }, `vessel_key ${vessel_id}`);
}
// The channel names the llm_completion producer discovery gives now; the row is rewritten when that changes.
const llm = await producer("llm_completion");
for (const model of CHANNEL_MODELS) {
  const calls = [{
    endpoint: llm.endpoint, resolve_endpoint: llm.resolve_endpoint, pointer: { type: "llm_completion", model },
    input_field: "prompt", output_field: "content", producer_field: "model",
  }];
  await ensure({ shape: "channel", calls }, undefined, `channel ${model}`);
}
for (const s of SCHEMAS) await ensure({ shape: "shape_schema", ...s }, { target: s.target }, `shape_schema ${s.target}`);
await ensure({ shape: "arm", vessel_id: "walk-vessel", arm: "treated", as_of_seq: MAX_SEQ }, { vessel_id: "walk-vessel" }, "arm walk-vessel");
console.log("[walk-owner-seed] owner rows in place");
