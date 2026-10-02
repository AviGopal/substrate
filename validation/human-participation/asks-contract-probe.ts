// ASKS-CONTRACT falsifier.
//
// The vessel's interaction contract for multi-part questions is the TOP-LEVEL
// pointer field `asks`, whose items must carry `prompt` (impulses.ts:105-119).
// `body` is opaque preserved human content. A fixture that expresses its parts
// as `body.asks` with `text` therefore produces ZERO parts, and per-part
// answering is impossible.
//
// This probe asserts, for every frozen fixture pointer, that the panel the
// vessel returns carries exactly the ask ids the fixture names ANYWHERE:
//     (ptr.asks ?? ptr.body?.asks ?? []).map(a => a.id)
// That spelling is the point. `asks.length > 0` or a comparison against
// `ptr.asks` alone is satisfied vacuously by the broken fixtures.
//
// Runs entirely in-process against a DISPOSABLE workspace. It never touches the
// live substrate.
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";

const workspace = mkdtempSync("/tmp/asks-contract-");
process.env.WORKSPACE_ROOT = workspace;
// Routers must be imported AFTER WORKSPACE_ROOT is set: the store replays its
// journals at module load, so a static import would bind the wrong workspace.
const vessel = new URL("../../repos/human-surface-vessel/", import.meta.url).pathname;
const fixtures = new URL("./fixtures/", import.meta.url).pathname;
const { impulsesRouter } = await import(vessel + "src/routes/impulses.ts");

const read = (name: string) => JSON.parse(readFileSync(fixtures + name, "utf8"));

async function resolve(pointer: Record<string, unknown>) {
  const r = await impulsesRouter.request("/v2/impulses/resolve", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ pointer }),
  });
  return { status: r.status, json: (await r.json()) as any };
}

async function questionView(id: string) {
  const r = await resolve({ type: "uiQuestion", id });
  return r.json.body.questions[0];
}

// ---------------------------------------------------------------- the corpus
type Case = { label: string; pointer: Record<string, unknown> };
const cases: Case[] = [];

const seed = read("seed-panels-v1.json");
for (const p of seed.panels) {
  if (p.pointer) cases.push({ label: `seed-panels ${p.scenario}`, pointer: p.pointer });
  for (const [i, ptr] of (p.pointer_set ?? []).entries())
    cases.push({ label: `seed-panels ${p.scenario}[${i}]`, pointer: ptr });
  if (p.mid_session_revision)
    cases.push({ label: `seed-panels ${p.scenario} mid_session_revision`, pointer: p.mid_session_revision });
}

// The incident handoff fixture is not itself a pointer; it is seeded as the live
// panel `frozen-s6-incident-handoff-v1` (PROGRAM-STATE.md:48) with the handoff
// as the opaque body. Its ask lives at the fixture's top level.
const handoffFx = read("incident-handoff-v1.json");
cases.push({
  label: "incident-handoff-v1",
  pointer: {
    type: "uiQuestion_write", id: "frozen-s6-incident-handoff-v1", kind: "question",
    title: handoffFx.handoff.title, body: handoffFx.handoff, importance: "high",
    ...(handoffFx.asks ? { asks: handoffFx.asks } : {}),
  },
});

// POSITIVE CONTROLS in the same run.
// C1: a pointer that already carries the contract-correct form — must pass
//     BEFORE and AFTER, proving a green result is not "the fix made it green".
cases.push({
  label: "CONTROL correct-form",
  pointer: {
    type: "uiQuestion_write", id: "control-correct-form", kind: "question",
    title: "Control: contract-correct asks",
    asks: [{ id: "ctl-1", prompt: "first part" }, { id: "ctl-2", prompt: "second part" }],
  },
});
// C2: panels with no asks anywhere — [] deep-equal [] proves the assertion
//     actually runs rather than being skipped.
for (const q of read("live-escalation-panels-2026-09-20.json").questions.slice(0, 3))
  cases.push({ label: `CONTROL no-asks ${q.id}`, pointer: { type: "uiQuestion_write", ...q } });

// -------------------------------------------------------- (a) id equivalence
let failures = 0;
const revisions = new Map<string, number>();
for (const { label, pointer } of cases) {
  const expected = ((pointer as any).asks ?? (pointer as any).body?.asks ?? []).map((a: any) => a.id);
  const r = await resolve(pointer);
  assert.equal(r.status, 200, `${label}: write did not return 200`);
  const actual = (r.json.body.asks ?? []).map((a: any) => a.id);
  revisions.set(String(r.json.body.id), r.json.body.revision);
  const ok = JSON.stringify(expected) === JSON.stringify(actual);
  if (!ok) failures++;
  console.log(`(a) ${ok ? "OK  " : "FAIL"} ${label}: expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)} (rev ${r.json.body.revision})`);
}
console.log(`(a) ${cases.length - failures}/${cases.length} pointers carry their declared ask ids`);

// ------------------------------------------- (b) per-part contribution lands
// S2 is the two-part scenario. Answer ONE part at the panel's current revision.
const s2 = "frozen-s2-return-two-part";
const s2Rev = revisions.get(s2)!;
const s2Parts = ((seed.panels.find((p: any) => p.pointer?.id === s2).pointer.asks ??
  seed.panels.find((p: any) => p.pointer?.id === s2).pointer.body?.asks ?? []) as any[]).map(a => a.id);
assert.ok(s2Parts.length >= 2, "S2 fixture must declare at least two parts");
const one = await resolve({
  type: "uiFeedback", panel_id: s2, panel_revision: s2Rev, ask_id: s2Parts[0],
  kind: "answer", value: "yes — declare them optional_input_shapes where the resolver self-grounds",
});
console.log(`(b) per-part POST ask_id=${s2Parts[0]} rev=${s2Rev} -> HTTP ${one.status} ${JSON.stringify(one.json).slice(0, 160)}`);
let view = await questionView(s2);
const recordedOne = view.answers.some((f: any) => f.askId === s2Parts[0]);
console.log(`(b) recorded=${recordedOne} answers=${JSON.stringify(view.answers.map((f: any) => f.askId))} answered=${view.answered}`);

// ------------------------------------------------ (c) all parts -> answered
for (const part of s2Parts.slice(1)) {
  const r = await resolve({ type: "uiFeedback", panel_id: s2, panel_revision: s2Rev, ask_id: part, kind: "answer", value: `answer for ${part}` });
  console.log(`(c) POST ask_id=${part} -> HTTP ${r.status}`);
}
view = await questionView(s2);
console.log(`(c) answered=${view.answered} parts=${JSON.stringify((view.asks ?? []).map((a: any) => a.id))} answeredParts=${JSON.stringify(view.answers.map((f: any) => f.askId))}`);

// --------------------------------------------------------- GAP EVIDENCE only
// These two behaviours are true BEFORE and AFTER this change. They are printed,
// never asserted — folding them into the falsifier would keep it permanently red.
const g1 = await resolve({ type: "uiQuestion_write", id: "gap-silent-drop", kind: "question", title: "malformed item", asks: [{ id: "x", text: "no prompt field" }] });
console.log(`GAP EVIDENCE 1 (silent drop): HTTP ${g1.status} asks=${JSON.stringify(g1.json.body.asks)} — a malformed {id,text} item yields asks:[] with no error`);
const g2 = await resolve({ type: "uiFeedback", panel_id: s2, ask_id: "part-does-not-exist", kind: "answer", value: "bogus part" });
const g2view = await questionView(s2);
// Was "GAP EVIDENCE 2 (revision-less bypass)" when this probe FOUND that bug: a
// bogus ask id with no panel_revision stored 200 because every refusal check sat
// inside `if (f.panelRevision !== undefined)`. That is fixed — the ask-id and
// informational checks now run whenever this store holds the panel, so a 409 here
// is the repaired behaviour. Kept as printed evidence rather than an assertion
// because this probe's subject is the asks CONTRACT; the regression clamp that
// fails on a re-nest lives in repos/human-surface-vessel/test/accept-guard.test.ts.
console.log(`ASK-ID VALIDATION WITHOUT A REVISION (expect 409 — was 200 before the guard hoist): HTTP ${g2.status} stored id=${g2.json.body?.id} askId=${JSON.stringify(g2.json.body?.askId)}`);
console.log(`GAP EVIDENCE 2 (cont): questionView answers now=${JSON.stringify(g2view.answers.map((f: any) => f.askId))} answered=${g2view.answered}`);

rmSync(workspace, { recursive: true, force: true });

if (failures > 0 || !recordedOne || one.status !== 200 || view.answered !== true) {
  console.log(`RED: ${failures} pointer(s) lost their declared asks; per-part POST ${one.status}; recorded=${recordedOne}; answered=${view.answered}`);
  process.exit(1);
}
console.log("GREEN: every frozen fixture pointer carries its declared ask ids; a per-part contribution lands at the current revision; answering all parts reports answered=true");
