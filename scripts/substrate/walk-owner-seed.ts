#!/usr/bin/env bun
// walk-owner-seed.ts — write the walk vessels' owner rows (SPEC-V3 §9 step 3.2) from the installation.
//
// The walk runs on what a standard installation provides, so the owner rows the spec has a person write come from
// here, under the node key every vessel uses (METABOB_API_KEY). records treats the node's own key as node-self and
// takes the writer and role it declares; this script declares owner. It runs after records-vessel and before
// described-shape-vessel and walk-vessel (walk-owner-seed.service): described-shape registers the shape_schema targets
// at start and reads each target's newest schema on every produce, and the walk waits for its own arm row.
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
    description: "The answer to what the world_changed row's `what` field asks for. An ask that changes something is " +
      "done only when a hop row shows the change landed (a git_land call that ended). Until then say what you will do " +
      `next, never that it was done. ${JSON_ONLY}`,
    schema: { type: "object", required: ["text"], properties: { text: { type: "string", minLength: 1 } } },
    inputs: ["world_changed"],
    context: ["hop"],
  },
  {
    target: "outcome",
    // records derives the graded cells from the row evidence_refs names, so nothing is copied from a selection.
    // A lapse comes first: reads lists a request's FIRST due row once it has passed with no person's verdict, answered
    // or not (records lapsed()). With answers present the answer branch used to win, so a passed deadline was never
    // graded and the request never closed. A lapse r 0 is a fact about time, not a judgement of the answer.
    description: "How the world_changed row's request went. First: if reads lists a due row of this request, its " +
      "deadline passed with no person's verdict, so the request lapsed: r is 0 and evidence_refs holds that due row's " +
      "id, whether or not an answer row exists. Otherwise, if there is an answer row, r is 1 when it does what `what` " +
      "asks, correctly and completely, and 0 when not, and evidence_refs holds the answer row's id. An answer that " +
      "claims a change with no hop row showing a git_land call that ended is r 0. event_ref is the " +
      `world_changed row's id. ${JSON_ONLY}`,
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
    // hop: so the grader can see whether a change landed (a git_land call that ended) before grading a claim of one.
    context: ["answer", "due", "hop"],
    reads: [{ type: "record_lapsed", deadline_shape: "due", answer_shape: "answer" }],
  },
  {
    target: "request",
    description: "The next call toward what the world_changed row's `what` asks, whether it reads something or changes " +
      "something (a clone made for a change, an edit, a commit, a diff, a landing): pointer.type is the shape to " +
      "resolve, and pointer's other fields are its arguments. The shapes you can call are in reads: shape_descriptions " +
      "says what each does, and shape_inputs gives the JSON Schema of the fields its pointer takes; fill every required " +
      "one. A hop row shows what an earlier call returned, so ask for the step after it, not the same call again; a " +
      "failure row says why one did not. If the ask is already done, or needs no call, write {\"none\": \"<why>\"} " +
      "instead of a pointer. An ask that changes something is done only when a hop row shows the change landed (a " +
      "git_land call that ended); an answer graded r 1 without that does not do it, so ask for the next call. Gaps " +
      "(reads) are failures detectors found, each naming its repo and the failing check (a test file, which is not the " +
      "place to edit: the fix is in the source it checks). A gap whose row says operator_hold is held: leave it. A gap " +
      "with a later row of the same gap_id whose status is closed is already closed. To close an open one, ask for the " +
      "next call toward closing it: first a clone of the repo the gap names. Every later call on that change (an edit, " +
      "a commit, a diff, a landing) works in the clone: its cwd (or a path under it) is the cwd the clone's hop " +
      "returned, never a repos/ path. " + JSON_ONLY,
    // A request either names the next call or declines (none); the walk reads a request without a pointer as a decline.
    schema: {
      type: "object",
      anyOf: [{ required: ["pointer"] }, { required: ["none"] }],
      properties: {
        pointer: { type: "object", required: ["type"], properties: { type: { type: "string", minLength: 1 } } },
        none: { type: "string", minLength: 1 },
      },
    },
    inputs: ["world_changed"],
    // The answer and its grade are here so the producer can see the ask is done; the hops show whether a change landed.
    context: ["hop", "failure", "answer", "outcome"],
    // declared: only shapes whose producer declared their inputs, the ones a request can fill (discovery resolvers.ts).
    // gap: every detector gap row, opening and closing alike, so a closed gap is seen as closed.
    reads: [{ type: "shapeDescriptions", declared: true }, { type: "record_read", shape: "gap" }],
  },
  {
    target: "due",
    // within_ms is the deadline: a producer has no clock, so records sets at = its own t + within_ms, replacing any at
    // given. `at` stays required because the accepted gate fixture asks for it; a due without within_ms is never a
    // deadline to records, and the walk bounds its waits by the `at` records sets.
    description: "How long the person who asked may take to see the result and grade it: the work still to do (a " +
      "change takes several calls: a clone, edits, a commit, a diff, a verdict, a landing) plus their reading time. " +
      "reads lists the grades people gave before, each with its time (t) and what it judged, which is how long they " +
      "took. within_ms is a duration in milliseconds, from 60000 (one minute) to 86400000 (a day), and records sets " +
      `the deadline from its own clock. at may be 0: records replaces it. ${JSON_ONLY}`,
    schema: {
      type: "object",
      required: ["at"],
      properties: { at: { type: "number" }, within_ms: { type: "number", minimum: 60000, maximum: 86400000 } },
    },
    inputs: ["world_changed"],
    // What people took before: their grades, each with its time and what it judged (the evidence for a deadline).
    reads: [{ type: "record_read", shape: "outcome", where: { role: "person" } }],
  },
  {
    target: "land_verdict",
    // git_land (local-tools) pushes a change only on a verdict for its exact tree. A grader's counts only when it was made
    // from exactly the request and the walk's gitDiff of that tree, so this schema reads nothing else: no hop, no answer.
    description: "Whether the change in the gitDiff row does what the world_changed row's `what` asks, correctly and " +
      "completely, and nothing it should not: r is 1 when it does, 0 when it does not, and also 0 when the gitDiff's " +
      "truncated is true, because then you were not shown the whole change. repo and tree are copied exactly from the " +
      `gitDiff row. why says, in a sentence or two, what decided it. ${JSON_ONLY}`,
    schema: {
      type: "object",
      required: ["repo", "tree", "r", "why"],
      properties: {
        repo: { type: "string", minLength: 1 },
        tree: { type: "string", pattern: "^[0-9a-f]{40}$" },
        r: { enum: [0, 1] },
        why: { type: "string", minLength: 1 },
      },
    },
    inputs: ["world_changed", "gitDiff"],
  },
  {
    target: "activity_template",
    description: "A reusable template of the calls that led to the outcome row: sig.in and sig.out are the shapes it " +
      "consumes and produces, and calls lists each call in order: its shape, and in pointer the arguments that call " +
      "takes. Every call's shape must be one of the shapes in reads, and its pointer must fill that shape's shape_inputs. " +
      JSON_ONLY,
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
          items: {
            type: "object", required: ["shape"],
            properties: {
              // Held to the read below by described-shape: only a served, callable shape passes, never the walk's
              // move kinds or a written-only shape such as hop.
              shape: { type: "string", "x-shape-in": { read: "shapeDescriptions", keys_of: "content.shape_descriptions" } },
              pointer: { type: "object" },
            },
          },
        },
      },
    },
    inputs: ["outcome"],
    context: ["hop"],
    // The callable shapes and their inputs, as the request reads them (discovery resolvers.ts, declared: true).
    reads: [{ type: "shapeDescriptions", declared: true }],
  },
];

// Wait until records answers through discovery before writing anything. At boot this runs before records has
// registered, and discovery answers 404 for a shape no vessel serves yet. Failing then failed the walk and described
// units that Require this one, and systemd never started them again when the next try succeeded. So a 404 or a
// connection error is retried here for up to READY_WAIT_MS; anything else, or the wait running out, fails as before.
const READY_WAIT_MS = 300_000;
const READY_RETRY_MS = 2_000;
for (const deadline = Date.now() + READY_WAIT_MS; ; ) {
  try { await read("arm"); break; } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    const notYet = / 404: /.test(msg) || /ECONNREFUSED|Unable to connect|ConnectionRefused|fetch failed/i.test(msg);
    if (!notYet || Date.now() > deadline) throw e;
    console.log(`[walk-owner-seed] records not reachable yet; retrying (${msg.split("\n")[0].slice(0, 120)})`);
    await Bun.sleep(READY_RETRY_MS);
  }
}

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
// What a detector's gap row is. A description, not a shape_schema: described-shape serves every schema target from a
// model, and a gap must only ever be an observation a detector made. records holds shape_description as owner
// configuration, never a request.
await ensure({
  shape: "shape_description", of: "gap", written_by_role: "detector",
  description: "A check a detector made failed (or, with status closed, has stopped failing). gap_id names the failure " +
    "and stays the same while it lasts; status is open or closed; category and severity say what kind and how bad; " +
    "summary says what failed, in at most 2 KiB; meta carries what the detector measured (cut past 4 KiB). The latest " +
    "row for a gap_id, written by a detector, is its state: a gap closes by a later row, never by an edit.",
}, { of: "gap" }, "shape_description gap");
// What a person reads of the rows the surface shows: each description's words name the fields (1 to 4) that say what
// a row is, so the surface draws them from these rows instead of a list of its own.
const SHOWN: Array<{ of: string; words: string[]; description: string }> = [
  { of: "world_changed", words: ["what"], description: "Something a person or the owner asked for, in their own words (what)." },
  { of: "answer", words: ["text"], description: "The walk's answer to a request (text)." },
  { of: "outcome", words: ["r"], description: "A grade of how a request went: r is 1 when it did what was asked, 0 when not." },
];
for (const d of SHOWN) await ensure({ shape: "shape_description", ...d }, { of: d.of }, `shape_description ${d.of}`);
console.log("[walk-owner-seed] owner rows in place");
