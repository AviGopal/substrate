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

// What records answers a read with: its rows, as a list (or under content). A records that is starting or restarting
// can answer anything else: that is not an answer, and is read again until READY_WAIT_MS has passed. Taking it as rows
// failed a rerun mid-way, and the vessels that Require this unit stopped with it.
const read = async (shape: string, where?: Row): Promise<Row[]> => {
  for (const deadline = Date.now() + READY_WAIT_MS; ; ) {
    const a = await records("record_read", { shape, ...(where ? { where } : {}) });
    const rows = Array.isArray(a) ? a : (a as { content?: unknown } | null)?.content;
    if (Array.isArray(rows)) return rows as Row[];
    if (Date.now() > deadline) throw new Error(`records answered no list of ${shape} rows for ${READY_WAIT_MS} ms`);
    console.log(`[walk-owner-seed] records answered no list of ${shape} rows; reading again`);
    await Bun.sleep(READY_RETRY_MS);
  }
};

// A row "already says it" when every field we write equals the latest matching row's (JSON-compared).
async function ensure(row: Row, where: Row | undefined, label: string): Promise<void> {
  const rows = await read(row.shape as string, where);
  const same = (r: Row) => Object.keys(row).every((k) => JSON.stringify(r[k]) === JSON.stringify(row[k]));
  const latest = where ? rows[rows.length - 1] : rows.find(same);
  if (latest && same(latest)) { console.log(`[walk-owner-seed] ${label}: present (${latest.id})`); return; }
  const w = (await records("record_write", { row: { ...row, input_refs: [] }, writer: OWNER, role: OWNER })) as Row;
  console.log(`[walk-owner-seed] ${label}: wrote ${w.id ?? JSON.stringify(w).slice(0, 80)}`);
}

// The clone's newest tree (the newest-tree landing ruling): the tree of the newest row of these shapes a tool recorded on the
// request's clone (the same cwd) that names one; a newer moving row naming none leaves it unknown, and unknown meets
// nothing; a gap opened again takes the clone of the earlier gap with its gap_id. Read by the walk and described alike.
const NEWEST_TREE = { "x-latest": { shapes: ["gitCommitResult", "gitWorktree", "gitDiff"], moves: ["gitCommitResult", "gitWorktree"], same: "cwd", field: "tree", continues: "gap_id" } };
// The clone's newest COMMITTED tree: what a diff can judge, since a diff reads commits only. The tree some commit names
// (committed_tree: a commit's tree, or a clean clone's as handed out), on the newest row of these shapes a tool recorded
// on the request's clone. An edit that changed a file there (its answer names the clone, cwd) moves the clone without
// naming one, so after an edit newer than every commit the value is unknown and meets nothing. The clone is located by
// its handout (at: gitWorktree), so a clone handed out before its answers named a committed tree still finds its clone
// and takes its newest commit's. Read for requirements only; NEWEST_TREE stays what a landing and its verdict read.
// committed_tree is advisory: it orders the steps, and the landing and its verdict still judge from their own reading.
const EDIT_RESULTS = ["fileEditResult", "fileWriteResult", "codeInsertResult", "codeReplaceResult", "codeAddImportResult"];
const COMMITTED_TREE = { "x-latest": { shapes: ["gitCommitResult", "gitWorktree", ...EDIT_RESULTS], moves: ["gitCommitResult", ...EDIT_RESULTS],
  at: ["gitWorktree"], same: "cwd", field: "committed_tree", continues: "gap_id" } };
const JSON_ONLY = "Reply with only the JSON object: no prose, no code fence.";
// What a produced row used: the ids of the rows it was shown that it relies on. Credit travels back only through what
// a step used (records' fold), never through what it was merely shown, so a produce names its own. Each id is held to
// the rows shown (x-shown: described-shape refuses anything else). It is not required: a row naming none passes no
// credit back past itself.
const USES = { type: "array", items: { type: "string", "x-shown": true } };
const USES_WORDS = "uses lists the id of each row you were shown that this relies on, and only those.";
// Who is answering (the USER: "Both, after promise checks"): the producer is one step of a walk that acts, so "I
// cannot act" is false while a gated tool is still uncalled. request_acts (in context) says which were called.
const WHO_ANSWERS = "You are one step of the walk. The walk acts through the tools the owner gates on a wanted change " +
  "(request_acts lists which were called here and which were not). While a gated tool is still uncalled here, saying " +
  "you cannot act is false.";
const SCHEMAS: Row[] = [
  {
    target: "answer",
    description: `${WHO_ANSWERS} ` + "The answer to what the world_changed row's `what` field asks for. An ask that changes something is " +
      "done only when a hop row shows the change landed (a git_land call that ended). Until then say what you will do " +
      `next, never that it was done. ${USES_WORDS} ${JSON_ONLY}`,
    schema: { type: "object", required: ["text"], properties: {
      text: { type: "string", minLength: 1 },
      uses: USES,
      // A promise records checks against what the walk does next (records settles it); never read from the text.
      next_act: {
        type: "object", required: ["tool", "target"],
        description: "Optional. When the ask wants a change that hasn't landed: the next call you will make toward it. tool is " +
          "the shape you will call; target is what it acts on (the file path, or the clone). Leave it out when no change is wanted. " +
          "It is a promise, and it is graded by what happens next: if that call starts within the request's next few steps it " +
          "counts for you, and if it does not, it counts against you. Promise only a call you will actually make next.",
        properties: { tool: { type: "string", minLength: 1 }, target: { type: "string", minLength: 1 } },
      },
    } },
    inputs: ["world_changed"],
    // As the grader sees them: each hop with the tool it called, joined from its started hop, so a change's edit, commit
    // and landing hops are told apart from its reads.
    // What this request has already done (the walk's request_acts: acts, tools never called here, repeats), kept in view
    // however much newer context there is: an answer claiming a landing on a request with none is the class it answers.
    // A file this request read whole is shown whole, in place of its cut hop (agf_ydcn9zrw4z8h: answers saw only the
    // 16 KB cut and kept saying they would read the file). request_acts is one growing row per act: only the newest is
    // kept (latest_by shape: the single newest row), so it never fills the keep share on its own.
    // Why a step could not be taken (the walk's skips: a call whose preconditions were not met, a template that could not
    // run), kept in view, so an answer does not say it will make a call its request was just told it cannot make yet
    // (agf_lapiolp0a1wt: answers kept saying "I will call git_land next" over a git_land skip). Bounded: the newest skip
    // per request call (latest_by request_ref; a template's skip, which names none, is its newest one). Skips only: a
    // too_big answer and the other failure kinds are agf_buhnyrdqy24o's.
    context: [{ shape: "hop", join: { on: "call_id", take: ["pointer_type"] } },
      { shape: "fileContent", whole: true, latest_by: "path", covers: { shape: "hop", on: "call_id" } },
      { shape: "request_acts", latest_by: "shape", keep: true },
      { shape: "failure", where: { kind: "skip" }, latest_by: "request_ref", keep: true }],
    keep_share: 0.25,
  },
  {
    target: "outcome",
    // Which answers promise rather than claim a result: one carrying next_act (the USER: "Accurate, not done"; "Exempt
    // until deadline"; its promise is graded by what happens next). records reads it (a person's Right on a promise does
    // not close the request; the grader's grade of one before its ask's first deadline does not count).
    evidence: [{ shape: "answer", deferred_by: "next_act" }],
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
        // x-shown: a ref must name a row the grader was shown (an input, a context row, or a row a read returned), so
        // the grade's evidence is among what it saw; one naming another row is refused by the producer.
        evidence_refs: { type: "array", minItems: 1, items: { type: "string", "x-shown": true } },
      },
    },
    inputs: ["world_changed"],
    // The hops given are what tool calls returned (ended call and run hops, each with the shape it called joined from
    // its started hop), so the grader can see whether a change landed (a git_land call that ended) before grading a
    // claim of one. The walk's own steps (produce and wait hops, started hops) are not given: records reads this same
    // entry to count a grade that saw only these as clean.
    // Besides the answer and deadline: its own schema refusals (a refused grade is offered again, never held, and reads
    // why), and what the request has done (request_acts) as given
    // evidence (where: {}), so a grader shown "no gated tool ended ok" cannot honestly say reached, and stays clean.
    context: ["answer", "due", { shape: "hop", where: { phase: "ended", kind: ["call", "run"] }, join: { on: "call_id", take: ["pointer_type"] } },
      { shape: "failure", where: { refused: "schema" } }, { shape: "request_acts", where: {}, keep: true }],
    keep_share: 0.25,

    // asks {x-inputs}: described-shape binds it to the world_changed row it was given, so the read names only this
    // request's lapsed deadline, never another request's.
    reads: [{ type: "record_lapsed", deadline_shape: "due", answer_shape: "answer", asks: { "x-inputs": true } }],
  },
  {
    target: "request",
    description: `${WHO_ANSWERS} ` + "The next call toward what the world_changed row's `what` asks, whether it reads something or changes " +
      "something (a clone made for a change, an edit, a commit, a diff, a landing): pointer.type is the shape to " +
      "resolve, and pointer's other fields are its arguments. The shapes you can call are in reads: shape_descriptions " +
      "says what each does, and shape_inputs gives the JSON Schema of the fields its pointer takes; fill every required " +
      "one. A hop row shows what an earlier call returned, so ask for the step after it, not the same call again; a " +
      "failure row says why one did not. If the ask is already done, or needs no call, write {\"none\": \"<why>\"} " +
      "instead of a pointer. An ask that changes something is done only when a hop row shows the change landed (a " +
      "git_land call that ended); an answer graded r 1 without that does not do it, so ask for the next call. Gaps " +
      "(reads) are failures detectors found, each naming its repo and the failing check. Edit where the gap's " +
      "meta.edit_site names (a repos/<repo>/ path: the same path in the clone); with none, the files its " +
      "meta.sources names (what the check imports), never the check's test file. A gap whose row says localized false " +
      "names no edit site yet: find it first (code_search, code_find_function, code_read_lines, bounded_shell) before " +
      "an edit; it is work, not held. A gap " +
      "with a later row of the same gap_id whose status is closed is already closed. To close an open one, ask for the " +
      "next call toward closing it: first a clone of the repo the gap names. Every later call on that change (an edit, " +
      "a commit, a diff, a landing) works in the clone: its cwd (or a path under it) is the cwd the clone's hop " +
      "returned, never a repos/ path. A gitWorktree row is this request's own clone (its cwd is the clone); with none, " +
      "this request has no clone yet. An edit needs that file read in this clone first: a fileContent row is a read of " +
      "the path it names, so a read of the same file in an earlier clone (another cwd) does not count, and an edit " +
      "drafted from it is held; when a failure row says the call's path differs from a fileContent's, read the file at " +
      "the call's path. A change_wanted row is this request's own judgment of which repository a change " +
      "belongs in. " + USES_WORDS + " " + JSON_ONLY,
    // A request either names the next call or declines (none); the walk reads a request without a pointer as a decline.
    schema: {
      type: "object",
      anyOf: [{ required: ["pointer"] }, { required: ["none"] }],
      properties: {
        pointer: { type: "object", required: ["type"], properties: { type: { type: "string", minLength: 1 } } },
        none: { type: "string", minLength: 1 },
        uses: USES,
      },
    },
    // ask: true declares what an ask is (records reads it): a person's, the owner's or an operator's row of this shape
    // opens a root, and every other owner row is configuration the walk is given, so no list of shapes decides it.
    inputs: [{ shape: "world_changed", ask: true }],
    // The answer and its grade are here so the producer can see the ask is done; the hops show whether a change landed.
    // A file read is shown whole (an edit quotes text from it, so a cut copy cannot be quoted), only its newest read per
    // path (a read after an edit replaces the older one), and in place of the hop that fetched it.
    // Its own clone (what its own git_worktree call answered with) and its own change_wanted judgment: records builds a
    // root's context from that root's own episode, so these are this request's, newest per repository; small, and kept
    // when older hops fall out of the context budget.
    context: ["hop", "failure", "answer", "outcome", { shape: "fileContent", whole: true, latest_by: "path", covers: { shape: "hop", on: "call_id" } },
      { shape: "gitWorktree", latest_by: "repo", keep: true }, { shape: "change_wanted", latest_by: "repo", keep: true },
      // The request's newest commit (its sha and tree) is kept like its clone: without it a request whose clone row
      // survived still asked for a new clone (d929). request_acts: only the newest row (latest_by shape), since each
      // restates every act so far and 76 of them filled the keep share before the clone row could fit (qa, database).
      { shape: "gitCommitResult", latest_by: "shape", keep: true }, { shape: "request_acts", latest_by: "shape", keep: true },
      // The clone's newest diff, with what its check said (the drafter-context ruling): an edit drafted after a failing
      // check is drafted seeing why it failed. Whole, since the check follows the diff text in the row and an 8 KB cut
      // lost it. Kept, as the clone is: by the time the next edit is drafted, most requests have far more newer rows than
      // the context holds, so a newest-first fill would rarely reach the diff. The git_diff call's own hop carries the same
      // row: covered.
      // ORDER IS KEEP PRIORITY: described fits kept rows entry by entry in the order listed here, so the clone, its
      // change_wanted, its commit and its acts are fitted before the diff, and a large diff never pushes them out; when
      // the share is spent, the diff is the one left out, and named, never cut. List a new kept entry where it ranks.
      { shape: "gitDiff", latest_by: "shape", where: { tree: NEWEST_TREE, role: "walk" }, whole: true, keep: true, covers: { shape: "hop", on: "call_id" } },
      // The verdict on that same newest tree, beside the diff it judges: a request drafted after an r 0 verdict sees why the
      // tree was refused, so it is not drafted toward that tree again. The same x-latest the diff and git_land's requires
      // use, so all three agree on which tree is meant; newest per tree. The grader's verdict only: a person's mark grades
      // the page, not the code, and a newer one on the same tree would otherwise take the grader's place.
      { shape: "land_verdict", latest_by: "tree", where: { tree: NEWEST_TREE, role: "described" }, keep: true },
      // Every explanation of this root's refused attempts, whatever tree it was of: what failed, in the check's own words,
      // and what the next attempt must do. A verdict is shown only beside the newest tree's diff, so after the next
      // commit the refusal it carried drops out of view and the drafter tries the same fix again. Listed after the
      // request's own rows: a root refused many times has more explanations than the share holds, and listed first they
      // would push out its clone and diff; here they take what share is left, newest first.
      { shape: "attempt_explanation", keep: true },
      // What was installed (an owner infra_window row naming what each install put in, and into which vessel): the walk
      // makes a held request again once over an install bearing on it, and this is how its producer sees what went in.
      // The walk weighs these rows itself and takes none of them as news otherwise, so reading them here makes no
      // request due. Not kept: shown in the newest-first fill, one row per window.
      { shape: "infra_window", latest_by: "window_id" },
      // What came back from each call this root made, success or failure, newest per call: an answer is shown with the
      // request that made it, whatever its shape, so a new tool's answer needs no entry of its own. Listed last: the named
      // entries above keep their own rules, and this catches every answer they do not name. described keeps an answer only
      // until a request is drafted after it; older ones go to the newest-first fill.
      { answers_a_call: true, latest_by: "call_id", keep: true }],
    // keep: true has described-shape fit those rows first, within keep_share of its context budget, so an hour-old
    // request's clone stays in view (the USER: "Build now, first (Recommended)"); a quarter is room for one small row per
    // repository each without crowding out the newest failure a retry reads.
    keep_share: 0.25,

    // declared: only shapes whose producer declared their inputs, the ones a request can fill (discovery resolvers.ts).
    // gap: each detector gap's latest row, by gap_id, so a closed gap is seen as closed (its latest row says so) and an
    // open one as it stands now. Not each gap's history: every row of every gap, on every prompt, grew with the store.
    reads: [{ type: "shapeDescriptions", declared: true }, { type: "record_read", shape: "gap", latest_by: "gap_id" }],
  },
  {
    target: "due",
    // within_ms is the deadline: a producer has no clock, so records sets at = its own t + within_ms, replacing any at
    // given. `at` stays required because the accepted gate fixture asks for it; a due without within_ms is never a
    // deadline to records, and the walk bounds its waits by the `at` records sets.
    description: "How long the person who asked may take to see the result and grade it: the work still to do (a " +
      "change takes several calls: a clone, edits, a commit, a diff, a verdict, a landing) plus their reading time. " +
      "reads lists the grades people gave before, each with its time (t) and what it judged, which is how long they " +
      "took. The context shows this request's own answer and its grade, what it has done (request_acts), the calls the " +
      "walk could not make for it and why (failure rows of kind skip), and its ended steps with their times; reads also " +
      "lists the deadlines this request has already missed. within_ms is a duration in milliseconds, from 60000 (one " +
      `minute) to 86400000 (a day), and records sets the deadline from its own clock. at may be 0: records replaces it. ${JSON_ONLY}`,
    schema: {
      type: "object",
      required: ["at"],
      properties: { at: { type: "number" }, within_ms: { type: "number", minimum: 60000, maximum: 86400000 } },
    },
    inputs: ["world_changed"],
    // What this request has met so far, so a deadline is set from what the request has done and what stopped it: its
    // own answer and grade, its acts, the calls refused before they ran (a skip names what the call required and which
    // row it compared), and its ended steps with their times. The walk builds each root's pool from that root's rows, so
    // these are this request's alone. Kept, in this order (described fits kept rows entry by entry
    // as listed): a long-running request has far more ended steps than the context holds, and fitted newest first they
    // would push its answer and grade out. The grades first, the newest per role (a person's and a grader's), then only
    // the newest answer (each row is shown cut to its first 8 KB, so these few fit the share), then the acts. Only rows
    // citing the ask are kept first, so the skips (which cite the call request they held) are not kept: they and the
    // ended steps are fitted newest first in the rest of the context, the newest steps showing how long steps take.
    context: [{ shape: "outcome", latest_by: "role", keep: true }, { shape: "answer", latest_by: "shape", keep: true },
      { shape: "request_acts", latest_by: "shape", keep: true },
      { shape: "failure", where: { kind: "skip" }, latest_by: "request_ref" },
      { shape: "hop", where: { phase: "ended", kind: ["call", "run"] }, join: { on: "call_id", take: ["pointer_type"] } }],
    keep_share: 0.25,
    // What people took before: their grades, each with its time and what it judged (the evidence for a deadline). And the
    // deadlines this request already missed: asks {x-inputs} binds the read to the world_changed row given, so it names
    // only this request's lapses, never another's.
    reads: [{ type: "record_read", shape: "outcome", where: { role: "person" } },
      { type: "record_lapsed", deadline_shape: "due", answer_shape: "answer", asks: { "x-inputs": true } }],
  },
  {
    target: "land_verdict",
    // Two verdicts judge the same thing when they name the same tree, and the same way when their r is equal: the walk's
    // request_acts counts such a run as a repeat (repeat_key, repeat_value), with no shape named in its code.
    repeat_key: "tree",
    repeat_value: "r",
    // git_land (local-tools) pushes a change only on a verdict for its exact tree. A grader's counts only when it was made
    // from exactly the request and the walk's gitDiff of that tree, so this schema reads nothing else: no hop, no answer.
    // What else the grader must know of the tree rides on the gitDiff row, made with the tree: whether it typechecks.
    description: "Whether the change in the gitDiff row does what the world_changed row's `what` asks, correctly and " +
      "completely, and nothing it should not: r is 1 when it does, 0 when it does not, and also 0 when the gitDiff's " +
      "truncated is true, because then you were not shown the whole change, and 0 when its typecheck ran and did not " +
      "pass, because that tree does not compile. repo, tree and typecheck_ran (its typecheck.ran) are copied exactly " +
      "from the gitDiff row; when typecheck_ran is false the typecheck did not run (its why says why): say that, never " +
      `that it failed or passed. why says, in a sentence or two, what decided it. ${USES_WORDS} ${JSON_ONLY}`,
    // x-equals: what the grader states about the diff is held to the diff row it was shown (described-shape refuses
    // anything else), so a verdict cannot name another tree or say a check ran that did not.
    schema: {
      type: "object",
      required: ["repo", "tree", "typecheck_ran", "r", "why"],
      properties: {
        repo: { type: "string", minLength: 1, "x-equals": { shape: "gitDiff", path: "repo" } },
        tree: { type: "string", pattern: "^[0-9a-f]{40}$", "x-equals": { shape: "gitDiff", path: "tree" } },
        typecheck_ran: { type: "boolean", "x-equals": { shape: "gitDiff", path: "typecheck.ran" } },
        r: { enum: [0, 1] },
        why: { type: "string", minLength: 1 },
        uses: USES,
      },
    },
    // Only the root's newest gitDiff (latest_by over a field every gitDiff shares: one per root): a grader shown an older
    // diff beside it judged that one instead.
    // The diff judged is of the clone's newest tree, recorded by a tool (x-latest: read by the walk and described alike),
    // so an older tree's diff is never judged as the change to land (the newest-tree landing ruling).
    inputs: ["world_changed", { shape: "gitDiff", latest_by: "shape", where: { tree: NEWEST_TREE, role: "walk" } }],
  },
  {
    target: "activity_template",
    description: "A reusable template of the calls that led to the outcome row: sig.in and sig.out are the shapes it " +
      "consumes and produces, and calls lists each call in order: its shape, and in pointer the arguments that call " +
      "takes. Every call's shape must be one of the shapes in reads, and its pointer must fill that shape's shape_inputs. " +
      "A value that belongs to one request (its clone's cwd, a path inside it) is written as a placeholder, bound anew in " +
      "every run. \"{{ sig.in[i].field }}\" is a field of the template's own i-th input: the row of shape sig.in[i] that a " +
      "call recorded for this request. With sig.in [\"gitWorktree\"], \"{{ sig.in[0].cwd }}\" is this request's clone. " +
      "\"{{ calls.N.output.field }}\" is a field of the answer of this run's call N (from 0): after a first call to " +
      "git_worktree, \"{{ calls.0.output.cwd }}\". Write a literal only for what is the same in every run (a tool's " +
      "mode, a fixed flag): a literal copied from the run you saw makes the template fail everywhere else. " +
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
    // The newest grade only (latest_by shape): inputs are shown whole and never fitted to the prompt budget, so every
    // grade of a long root went into each fill until it passed the model's ceiling (d929, 489: prompt_too_large).
    inputs: [{ shape: "outcome", latest_by: "shape" }],
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
// A schema row may name a variant: another way to make the same target, from other inputs. A request can come from a
// detector's gap as well as from a person's ask, with the same words and checks: the gap row carries its specifics.
// Whether an ask wants a change at all, judged from the ask and the repositories this fleet holds: nothing the walk has
// done is in view, so the judgment cannot be steered by a call already planned. A person names what they see (a vessel,
// what it does), never a repository or a file, so without the repository rows "not files" was the reasonable reading of
// nearly every ask.
SCHEMAS.push({
  target: "change_wanted",
  description: "Whether the world_changed row's `what` asks for a change to files in a repository (wanted true) or for " +
    "anything else (wanted false). The repository rows are the repositories this fleet holds, each with the units built " +
    "from it and their roles: an ask to change any of them, or what one of them does or shows, is a change to files in " +
    "it. what says the change in a few words, and repo is the repository row's repo it is about, or super when it is " +
    "about the super-repo itself (its scripts, docs or configuration); a change wanted with no repo opens no clone. " +
    JSON_ONLY,
  schema: {
    type: "object",
    required: ["wanted"],
    // repo may be null or absent when no change is wanted; a wanted change must name its repo. The refusal a judge can
    // then get is only the true one (a wanted change with no repo), not a stricter-than-meant type error on null.
    properties: { wanted: { type: "boolean" }, what: { type: "string" }, repo: { type: ["string", "null"] } },
    if: { properties: { wanted: { const: true } }, required: ["wanted"] },
    then: { required: ["repo"], properties: { repo: { type: "string", minLength: 1 } } },
  },
  inputs: ["world_changed"],
  // Its own refusals too: the walk offers a refused judgment again (never held), and it reads why.
  context: [{ shape: "repository", latest_by: "repo" }, { shape: "failure", where: { refused: "schema" } }],
});
const asked = SCHEMAS.find((s) => s.target === "request") as Row;
SCHEMAS.push({ ...asked, variant: "gap", inputs: ["gap"] });
// Where a gap's change belongs, when no stack named it (the "The system finds it" ruling): the gap names its repo and
// failing tests, and its row says localized false. The walk's own calls find the source file (code search and reads),
// and this judgment names it, citing the answers that show it; the held-gap release reads it as the gap's edit site.
// It is made only once a code search answered on the root (an input), so "cannot find it" is never said before
// anything was searched. Saying it hands the gap to a person, with why.
SCHEMAS.push({
  target: "change_wanted",
  variant: "gap",
  description: "Where the change that makes the gap row's failing tests pass belongs. The gap names its repo and its " +
    "failing tests, and no stack named the source file to change (localized false). The codeSearchResult row and the " +
    "call answers shown are what this request's own calls found. When they show the source file the failure comes " +
    "from, wanted is true, repo is the gap's repo, edit_site is that file as repos/<repo>/<its path in the repo> " +
    "(never the gap's test file: a change must not edit the check that verifies it), and evidence_refs lists the ids of " +
    "the shown rows that show it. When they show that no file of the repo can be the place (searched, and the failure " +
    "comes from no source file there), wanted is false, why says what was searched and what was found, and " +
    "evidence_refs lists those rows: the gap then waits for a person. When they show neither yet, still name the " +
    "likeliest file they point to: the walk's next calls on that file check it. A change_wanted row shown already " +
    "naming an edit_site is answered the same unless the answers shown since say otherwise. The land_verdict (r 0) " +
    "and attempt_explanation rows shown are changes already made for this gap and refused, with why: a site whose " +
    "change was refused because the gap's own check still failed is not named again unless the answers shown since say " +
    "what that change missed there. When the changes refused show the failing test asks for what the source does on " +
    "purpose (the test, not the source, looks wrong), wanted is false and why says so, citing them: a person decides. " +
    `${USES_WORDS} ${JSON_ONLY}`,
  schema: {
    type: "object",
    required: ["wanted", "evidence_refs"],
    properties: {
      wanted: { type: "boolean" },
      repo: { type: ["string", "null"] },
      edit_site: { type: "string", pattern: "^repos/[^/]+/.+" },
      why: { type: "string", minLength: 1, maxLength: 800 },
      evidence_refs: { type: "array", minItems: 1, items: { type: "string", "x-shown": true } },
      uses: USES,
    },
    if: { properties: { wanted: { const: true } }, required: ["wanted"] },
    then: { required: ["repo", "edit_site"], properties: { repo: { type: "string", minLength: 1 } } },
    else: { required: ["why"] },
  },
  // localized false is the row's top-level fact (the held-gap release writes it there, where the walk's input where reads)
  inputs: [{ shape: "gap", latest_by: "gap_id", where: { localized: false } }, { shape: "codeSearchResult", latest_by: "shape" }],
  // The changes already refused for this gap, with why (the grader's verdict per tree and each explanation): a gap
  // written again is a new root of the same episode, whose rows these entries read, so a site refused before is seen
  // before it is named again. Kept after the judgment's own rows, as the drafter keeps them after its clone and diff.
  context: [{ answers_a_call: true, latest_by: "call_id", keep: true }, "hop", { shape: "change_wanted", keep: true },
    { shape: "land_verdict", latest_by: "tree", where: { r: 0, role: "described" }, keep: true },
    { shape: "attempt_explanation", keep: true },
    { shape: "failure", where: { refused: "schema" } }],
  keep_share: 0.25,
});
// A change made for a gap is judged from the gap row in place of an ask: whether it fixes what the gap's check says is
// failing. git_land takes a grader's r 1 on a gap's change only when the gap's own check passed on the tree (the
// gitDiff row carries it, made with the tree), so the words here are the grader's hint, not the gate.
// The "An explanation shape is required" ruling: a refused attempt is explained in a row of its own, which the request
// keeps in view (above) after the verdict it explains has dropped out with its tree. Made from the newest tree's diff and
// the grader's r 0 verdict on that tree; what_failed quotes the diff's own words (x-quotes: its check's and typecheck's
// output, or why each did not run), never the verdict's why, which is a reading of them. Its earlier explanations and its
// acts are in view, so next_must can say what this change already did and what it did not. The acts are listed first: a
// root refused many times has more explanations than the share holds, and listed first they would push out the one row
// saying what the change did. The kept rows are fitted first only with a share; the explainer reads no other rows, so
// its size decides how many explanations are fitted first, not which are shown.
const EXPLAINED = [{ shape: "gitDiff", latest_by: "shape", where: { tree: NEWEST_TREE, role: "walk" } },
  { shape: "land_verdict", latest_by: "tree", where: { tree: NEWEST_TREE, r: 0, role: "described" } }];
const explained: Row = {
  target: "attempt_explanation",
  description: "Why the attempt in the gitDiff row was refused, for whoever drafts the next one. The land_verdict row " +
    "says it was refused (r 0) and why, in the grader's reading. what_failed copies, character for character, the lines " +
    "of the gitDiff row that show the failure: from its check.out or typecheck.out (a failing assertion, an error with " +
    "its file and line), or, when the check or typecheck did not run, its check.why or typecheck.why; at least 20 " +
    "characters copied exactly, and never the verdict's words. next_must says what the next attempt must do that this " +
    "one did not, and what this change already did on its clone that the next attempt must not redo or undo (the " +
    "request_acts row lists it); the earlier attempt_explanation rows say what earlier attempts tried, so do not send the " +
    `next one back to a fix already refused. tree is copied from the gitDiff row. ${USES_WORDS} ${JSON_ONLY}`,
  schema: {
    type: "object",
    required: ["tree", "what_failed", "next_must"],
    properties: {
      tree: { type: "string", pattern: "^[0-9a-f]{40}$", "x-equals": { shape: "gitDiff", path: "tree" } },
      what_failed: { type: "string", minLength: 20, maxLength: 1200,
        "x-quotes": { shape: "gitDiff", paths: ["check.out", "typecheck.out", "check.why", "typecheck.why"], min: 20 } },
      next_must: { type: "string", minLength: 1, maxLength: 800 },
      uses: USES,
    },
  },
  inputs: ["world_changed", ...EXPLAINED],
  // Its own refusals too, as every judgment's: an explanation refused (a what_failed not quoted from the diff) is offered
  // again, never held, and reads why.
  context: [{ shape: "request_acts", latest_by: "shape", keep: true }, { shape: "attempt_explanation", keep: true },
    { shape: "failure", where: { refused: "schema" } }],
  keep_share: 0.25,
};
SCHEMAS.push(explained, { ...explained, variant: "gap", inputs: [{ shape: "gap", latest_by: "gap_id" }, ...EXPLAINED] });
const landed = SCHEMAS.find((s) => s.target === "land_verdict") as Row;
SCHEMAS.push({
  ...landed,
  variant: "gap",
  // The gap as it stands now (its newest row of the gap_id), as the request's gap variant reads it: a detector rewrites a
  // gap while it stays open, and a verdict shown every rewrite cites them all, which git_land never takes (a grader's r 1
  // counts only from exactly the request and the diff).
  inputs: [{ shape: "gap", latest_by: "gap_id" }, { shape: "gitDiff", latest_by: "shape", where: { tree: NEWEST_TREE, role: "walk" } }],
  description: "Whether the change in the gitDiff row fixes what the gap row says is failing, by changing the code its " +
    "check tests, and nothing it should not: r is 1 when it does, 0 when it does not, and also 0 when the gitDiff's " +
    "truncated is true, because then you were not shown the whole change, when its typecheck did not pass, or when its " +
    "check (the gap's own check, run on that tree) did not pass. repo, tree and typecheck_ran (its typecheck.ran) are " +
    "copied exactly from the gitDiff row; when typecheck_ran is false the typecheck did not run (its why says why): say " +
    `that, never that it failed or passed. why says, in a sentence or two, what decided it. ${USES_WORDS} ${JSON_ONLY}`,
});
// Each target and variant is its own row; the plain one is the variant "" (records matches it exactly, so a row
// written before variants is rewritten once with it, and the two request rows never rewrite each other).
for (const s of SCHEMAS) {
  const variant = String(s.variant ?? "");
  await ensure({ shape: "shape_schema", ...s, variant }, { target: s.target, variant }, `shape_schema ${s.target}${variant ? `/${variant}` : ""}`);
}

// The calls that change something are made only for a root that wants a change: an ask judged to want one, or a gap a
// detector opened (its check failing is the change wanted). The walk reads these rows where it chooses (records shares
// them with every root); the tools are named here, by the owner, not in the walk. Each gap speaks for itself, so a gap
// requirement reads the latest row of each gap_id (latest_by), never another gap's.
// A clone is made only of the repository the root wants changed: git_worktree's repo must be the repo the change_wanted
// judgment or the open gap names ({"x-pointer": "repo"} is the call's own repo). A root that names no repository opens
// no clone. Each row replaces the one before it for the same tool and shape (the walk counts only the latest).
const CLONE = "git_worktree";
const sameRepo = (tool: string): Row => (tool === CLONE ? { repo: { "x-pointer": "repo" } } : {});
const CHANGE_TOOLS = ["git_worktree", "fs_edit", "fs_write", "code_replace_lines", "code_insert_after_line", "code_add_import", "git_commit", "git_land"];
for (const tool of CHANGE_TOOLS) {
  await ensure({ shape: "requires", for: tool, needs: "change_wanted", where: { wanted: true, ...sameRepo(tool) } }, { for: tool, needs: "change_wanted" }, `requires ${tool} change_wanted`);
  await ensure({ shape: "requires", for: tool, needs: "gap", where: { status: "open", ...sameRepo(tool) }, latest_by: "gap_id" }, { for: tool, needs: "gap" }, `requires ${tool} gap`);
}
// A landing waits for a verdict as well: git_land is called only once the root holds a land_verdict at r 1 (the latest
// for its tree), so a change is diffed, then judged, then landed. Its own group: it is needed besides a wanted change or
// an open gap, not instead of one. git_land still decides from the verdict rows themselves.
await ensure({ shape: "requires", for: "git_land", needs: "land_verdict", where: { r: 1, tree: NEWEST_TREE }, latest_by: "tree", group: "verdict" },
  { for: "git_land", needs: "land_verdict" }, "requires git_land land_verdict");
// A diff waits for a commit of the clone's newest edit, since it reads commits only: git_diff is called only once
// the clone's newest committed tree is known, from a commit newer than every edit there, or a clean clone handed out and
// not edited since. So after an edit the step named is git_commit, and planning puts the existing commit before the
// check. Alternatives in their own group (either row meets it), needed besides a wanted change or an open gap; each
// counts the newest row per clone (latest_by cwd), so another clone's newer row never hides this one's. Nothing about
// what git_diff answers or how it is graded changes.
await ensure({ shape: "requires", for: "git_diff", needs: "gitCommitResult", where: { committed_tree: COMMITTED_TREE }, latest_by: "cwd", group: "committed" },
  { for: "git_diff", needs: "gitCommitResult" }, "requires git_diff gitCommitResult");
await ensure({ shape: "requires", for: "git_diff", needs: "gitWorktree", where: { committed_tree: COMMITTED_TREE }, latest_by: "cwd", group: "committed" },
  { for: "git_diff", needs: "gitWorktree" }, "requires git_diff gitWorktree");
// An edit waits for a read of the very file it changes: the root's whole-file read (fileContent) of the path the edit
// names (bound to the edit's own pointer). A clone's files sit under the clone's own directory, so a read made in an
// older clone, or none, does not open an edit in a fresh one. A line-range read does not count: an edit's old text must
// come from the file as it is. Its own group: needed besides a wanted change or an open gap.
await ensure({ shape: "requires", for: "fs_edit", needs: "fileContent", where: { path: { "x-pointer": "path" } }, latest_by: "path", group: "read" },
  { for: "fs_edit", needs: "fileContent" }, "requires fs_edit fileContent");
// A change is written in its clone: a tool that writes a file is called only once the root holds a clone git_worktree
// handed out (a gitWorktree row), so a root that wants a change asks for its clone first, and no write is offered while
// the only paths it could name are the live checkout's. Its own group: needed besides a wanted change or an open gap.
const WRITERS = CHANGE_TOOLS.filter((t) => !t.startsWith("git_"));
for (const tool of WRITERS) {
  await ensure({ shape: "requires", for: tool, needs: "gitWorktree", where: {}, latest_by: "cwd", group: "clone" },
    { for: tool, needs: "gitWorktree" }, `requires ${tool} gitWorktree`);
}
// walk_trees_reclaim removes clones: it is called only for the root of the gap whose work it is (pull-sync's walk-trees
// check), while that gap is open.
await ensure({ shape: "requires", for: "walk_trees_reclaim", needs: "gap", where: { gap_id: "pull-sync-walk-trees-unreclaimed", status: "open" }, latest_by: "gap_id" },
  { for: "walk_trees_reclaim", needs: "gap" }, "requires walk_trees_reclaim gap");
// A root that offers no move is said, as a stall row naming it, once every after_rows store rows it sits (walk loop.ts
// stalls; its producer is offered again once per row). Counted in store rows, the unit a detector's quiet window uses,
// sized to about one round of the walk's selections over the open roots.
await ensure({ shape: "stall_rule", after_rows: 240 }, {}, "stall_rule");
// What makes a diff news to the root that asked for it: its tree, whether each check ran and passed, and what the clone
// held uncommitted, not the check's timings (walk applicable.ts repeats, by the owner's news_key). A re-run diff of an
// unchanged tree is then no news, and the root stops judging the same tree again (544972ef judged one tree r 0 ten
// times); a diff of the same tree whose uncommitted files differ is news, since what is left to commit changed.
await ensure({ shape: "news_key", of: "gitDiff", fields: ["tree", "check.ran", "check.passed", "typecheck.ran", "typecheck.passed", "uncommitted"] },
  { of: "gitDiff" }, "news_key gitDiff");
// What makes an edit news: the file it edited and the bytes it left there (local-tools answers every ok edit with
// `after`, the sha256 of the file on disk after the call), not the rest of its answer. Every ok edit of one file
// otherwise answers alike, so a different edit, a revert included, read as a repeat and was never diffed or judged
// (90b4); and an edit already made says so in its answer, so compared whole it would read as news once. Keyed on these
// two, an edit that leaves different bytes is news and one that leaves the same bytes is not. Seeded only once live
// edit answers carry `after`: a row naming a field no answer holds would compare every edit of a file as one.
await ensure({ shape: "news_key", of: "fileEditResult", fields: ["path", "after"] },
  { of: "fileEditResult" }, "news_key fileEditResult");
// What makes a gap news: whether it is open, localized, held, waiting on a person, runnable, where its change belongs,
// whose judgment moved it, and which test fails, as the held-gap release and the failing-test generator write them. Not
// the claim's or the summary's wording: a gap restated with only those changed was judged again on every restatement,
// each its own root (a tree already refused re-judged on three later roots). The walk weighs a detector's row by this
// key (applicable.ts repeats) only because the owner names one here.
await ensure({ shape: "news_key", of: "gap", fields: ["gap_id", "status", "localized", "waits_for", "check_runnable",
  "meta.edit_site", "meta.localized_by", "meta.claim_rejected_by", "meta.unlocalized_by", "meta.operator_hold", "meta.operator_hold_reason",
  "meta.check_runnable", "meta.protected_files", "meta.sources", "meta.evidence_resolve.input.test_file", "meta.evidence_resolve.input.only_tests"] },
  { of: "gap" }, "news_key gap");
// Which clone a request holding clones of more than one repo binds, when a template names no repo (walk applicable.ts,
// bind.ts inputsOf): the clone of the repo the request's own newest change_wanted names, its judgment of where the change
// belongs. Without it such a request binds no clone at all and can neither diff, commit nor land (two asks did so, each
// after its change_wanted switched repos). Only change_wanted is listed: no gap has ever held two clones. A newest
// change_wanted naming no repo binds nothing.
await ensure({ shape: "clone_binding", of: "gitWorktree", by: [{ shape: "change_wanted", field: "repo" }] },
  { of: "gitWorktree" }, "clone_binding gitWorktree");
await ensure({ shape: "arm", vessel_id: "walk-vessel", arm: "treated", as_of_seq: MAX_SEQ }, { vessel_id: "walk-vessel" }, "arm walk-vessel");
// What a detector's gap row is. A description, not a shape_schema: described-shape serves every schema target from a
// model, and a gap must only ever be an observation a detector made. records holds shape_description as owner
// configuration, never a request. Its words name the field that says what a gap is, so the surface draws a gap row by
// its summary, as it draws every shown row by its owner's words (below), never by its shape's name alone.
await ensure({
  shape: "shape_description", of: "gap", written_by_role: "detector", words: ["summary"],
  description: "A check a detector made failed (or, with status closed, has stopped failing). gap_id names the failure " +
    "and stays the same while it lasts; status is open or closed; category and severity say what kind and how bad; " +
    "summary says what failed, in at most 2 KiB; repo, when the check belongs to one repository, names it (a " +
    "vessel's name, or super), and only a gap naming one can have a clone made for it; meta carries what the detector " +
    "measured (cut past 4 KiB). The latest row for a gap_id, written by a detector, is its state: a gap closes by a later row, never by an edit.",
}, { of: "gap" }, "shape_description gap");
// What a gap's closing credits: no one grades the walk's work on a gap, so records counts the detector closing it as the
// grade, but only when a call of this shape ended among the walk's steps on it first (the walk changed something there).
// Configuration records reads (its fold), never a request.
await ensure({ shape: "credits", target: "gap", by_call: "git_land" }, { target: "gap" }, "credits gap");
// How credit travels to the walk's selections (records' fold): the weight a person's verdict, a lapse and a gap's
// closing each carry, the discount per step back along what each step used (gamma) and how many steps it goes (depth).
// w_check and promise_window settle an answer's promised next act (records: kept r 1, broken r 0, at w_check, judged
// over the request's next promise_window selections; the USER: "Credit kept, penalise broken"). Both values are a
// starting guess, not a finding: w_check sits below w_close, so an early horizon never outweighs the landing it leads to.
// prior_count caps how much of its move's coarser record a cell inherits (records' nested levels; the USER: "Cap
// inheritance"). Uncapped, a move's record from every request swamped a cell's own: the request move fell from .25 to
// .03 on failures inherited from other requests. The value is the USER's: "4 grades".
await ensure({ shape: "credits", target: "selection", w_person: 1, w_lapse: 1, w_close: 1, gamma: 0.7, depth: 12, w_check: 0.5, promise_window: 6, prior_count: 4 },
  { target: "selection" }, "credits selection");
// A hold the owner reads as a fact (records' hold_fact; the USER, relayed first-hand: "Read as facts"). pull-sync's
// failing-test generator once held each gap no stack localizes (operator_hold, its reason "needs_localization: ..."):
// that hold says only that no source frame names the edit site, so it is read as localized false, and the gap is work
// (the walk finds the edit site). The generator now files that fact itself and no hold, so this row reads only older
// rows; once no open gap carries such a hold, the owner may retire it. Any other hold stays a hold.
await ensure({ shape: "hold_fact", reason_prefix: "needs_localization", fact: { localized: false },
  description: "The USER: read the failing-test generator's needs_localization holds as facts (not localized), not holds." },
  { reason_prefix: "needs_localization" }, "hold_fact needs_localization");
// How long a wait the walk makes with nothing ahead is held before records answers it with nothing (records' wait_bound;
// the USER: "Record the recovery"). A shape served again ends such a wait by its own row (discovery's shape_served); the
// bound ends one no row ever comes for: a recovery discovery did not see (before its restart, or on a peer) or a stall
// with no waker at all. 15 minutes is three times discovery's registration lifetime (5 minutes), so a vessel that came
// back has re-registered, and its row been written, well before the bound; and one ended wait costs the walk one choice,
// against a stall that held a root for hours. A starting value, read by effect: waits ended by the bound against waits
// ended by a row.
await ensure({ shape: "wait_bound", within_ms: 900_000 }, {}, "wait_bound");
// What a person reads of the rows the surface shows: each description's words name the fields (1 to 4) that say what
// a row is, so the surface draws them from these rows instead of a list of its own.
const SHOWN: Array<{ of: string; words: string[]; description: string }> = [
  { of: "world_changed", words: ["what"], description: "Something a person or the owner asked for, in their own words (what)." },
  { of: "answer", words: ["text"], description: "The walk's answer to a request (text)." },
  { of: "outcome", words: ["r"], description: "A grade of how a request went: r is 1 when it did what was asked, 0 when not." },
];
for (const d of SHOWN) await ensure({ shape: "shape_description", ...d }, { of: d.of }, `shape_description ${d.of}`);
// The repositories this fleet holds, one row per repository: the units built from it, their roles, and whether every
// one of them is retired. The one source is the fleet's vessels.inventory.json beside this script, which the boot seed
// copies from the accepted gate tree into the run dir. No repository is named here. A repository the inventory changes
// gets a new row on the next run (the latest row per repo is its state); an unchanged one gets none. A repository the
// inventory no longer names (removal is how this fleet retires most things) gets a row saying it is retired, with no
// units, so the judge is never shown a repository that is gone as one that is live. With no inventory beside the script,
// or one that names no repository at all, nothing is written or retired, and the run says so.
// Each row also names the branch the repository takes landings on (git_land refuses any other: the dev-only push ruling):
// a unit's own `branch` in the inventory, else the inventory's branch_default; with neither, none is named and git_land
// refuses that repository's landings by name.
const repositoryRows = (inventory: unknown): Row[] => {
  const inv = inventory as { vessels?: unknown; branch_default?: unknown } | null;
  const fallback = typeof inv?.branch_default === "string" && inv.branch_default !== "" ? inv.branch_default : undefined;
  const branchOf = (us: Row[]): Row => {
    const own = us.map((u) => u.branch).find((b) => typeof b === "string" && b !== "");
    const b = own ?? fallback;
    return b === undefined ? {} : { branch: b };
  };
  const by = new Map<string, Row[]>();
  for (const u of Array.isArray(inv?.vessels) ? (inv.vessels as Row[]) : []) {
    if (typeof u?.repo !== "string" || u.repo === "" || typeof u.unit !== "string") continue;
    by.set(u.repo, [...(by.get(u.repo) ?? []), u]);
  }
  return [...by.entries()].sort(([x], [y]) => x.localeCompare(y)).map(([repo, us]): Row => ({
    shape: "repository",
    repo,
    units: us.map((u) => String(u.unit)).sort(),
    roles: [...new Set(us.map((u) => String(u.role ?? "")).filter((r) => r !== ""))].sort(),
    retired: us.every((u) => u.retired === true),
    ...branchOf(us),
  }));
};
const inventoryFile = Bun.file(new URL("./vessels.inventory.json", import.meta.url));
if (await inventoryFile.exists()) {
  const repos = repositoryRows(await inventoryFile.json());
  if (repos.length === 0) console.log("[walk-owner-seed] vessels.inventory.json names no repository: no repository rows");
  for (const r of repos) await ensure(r, { repo: r.repo }, `repository ${r.repo}`);
  if (repos.length > 0) {
    const named = new Set(repos.map((r) => r.repo));
    const latest = new Map<string, Row>();
    for (const r of await read("repository")) if (typeof r.repo === "string") latest.set(r.repo, r);
    for (const [repo, r] of latest) {
      if (named.has(repo) || r.retired === true) continue;
      await ensure({ shape: "repository", repo, units: [], roles: [], retired: true }, { repo }, `repository ${repo} (no longer in the inventory)`);
    }
  }
} else {
  console.log("[walk-owner-seed] no vessels.inventory.json beside this script: no repository rows");
}
// The owner's model denial (the USER, 11-15: "No free endpoints"): llm-resolver's shaped llmModelPolicy holds
// denied_models, and a model whose id contains an entry is never drawn, walked to or called. The policy has no class
// field, so the class is named by its own marker: the free-tier suffix providers put on those endpoints, not a list of
// tonight's models. Written once, on a first install, and never again: after its one write (or on finding a value the
// owner already set) the seed leaves an owner row saying so (owner_seeded, what: denied_models), and on every later boot
// it finds that row and writes nothing. So the owner's later value stands, whatever it is, including null ("deny
// nothing", which llm-resolver stores by deleting the field, indistinguishable from never set): the policy and not this
// file is the config (research: a value reasserted every boot is config in code; deployment and qa: an owner's null was
// undone at every boot). A policy that cannot be read (llm-resolver answers resolved:false) is not taken as never set:
// nothing is written and the next boot tries again. A node with no llm-resolver, or one that cannot take the field yet,
// is logged and skipped: the walk's owner rows above do not wait on it.
const DENIED_MODELS = [":free"];
const SEEDED = { shape: "owner_seeded", what: "denied_models" };
const markSeeded = async (): Promise<void> => {
  const m = (await records("record_write", { row: { ...SEEDED, input_refs: [] }, writer: OWNER, role: OWNER })) as Row;
  // A marker not stored leaves the next boot free to write again: said, so it is seen (qa).
  if (m.resolved === false || (m.failure as Row | undefined) !== undefined) {
    console.log(`[walk-owner-seed] model denial: the once-only marker was not stored (${String(m.error ?? JSON.stringify(m.failure ?? "")).slice(0, 200)}); the next boot may write the denial again`);
  }
};
try {
  const once = await read(SEEDED.shape, { what: SEEDED.what });
  const got = once.length > 0 ? undefined : (await records("llmModelPolicy", {})) as Row;
  const body = got === undefined ? undefined : (got.body ?? (got.content as Row | undefined)?.body ?? got) as Row;
  if (once.length > 0) {
    console.log(`[walk-owner-seed] model denial: seeded once before (${String(once[once.length - 1]?.id ?? "")}); the owner's value since stands`);
  } else if (got?.resolved === false) {
    console.log(`[walk-owner-seed] model denial: llm-resolver's policy could not be read (${String(got.error ?? "").slice(0, 200)}); nothing written, the next boot tries again`);
  } else if (body?.denied_models !== undefined && body?.denied_models !== null) {
    console.log(`[walk-owner-seed] model denial: already set by the owner (${JSON.stringify(body.denied_models).slice(0, 120)}); left as it is`);
    await markSeeded();
  } else {
    const w = (await records("llmModelPolicy_write", { denied_models: DENIED_MODELS })) as Row;
    if (w.resolved === false) {
      console.log(`[walk-owner-seed] model denial: refused by llm-resolver (${String(w.error ?? "").slice(0, 200)})`);
    } else {
      console.log(`[walk-owner-seed] model denial: written ${JSON.stringify(DENIED_MODELS)}`);
      await markSeeded();
    }
  }
} catch (e) {
  console.log(`[walk-owner-seed] model denial: not set (${String((e as Error)?.message ?? e).slice(0, 200)})`);
}
console.log("[walk-owner-seed] owner rows in place");
