// scripts/substrate/joint-liveness-tick.ts — a severed joint's row carries the check the detector
// measured, or says why it cannot.
//
// Two kinds of case:
//   - "unit run" cases run the tick exactly as joint-liveness.service does (`bun <script>`, top
//     level), with validation/scripts/joint-liveness-tick.fake.ts preloaded in place of fetch. They
//     need nothing from the module's exports, so they judge any version of the script.
//   - "module" cases import the module and drive its exported pure parts.
// No case reaches a real service: every endpoint is a .invalid name the fake answers or refuses.
//
// What admission needs (development-vessel, read at the time of writing): classifyFalsifier stamps
// "class2" for a usable evidence_resolve.shape when no hardcoded_url / expected_literal precedes it
// (resolvers/substrate-gap.ts); gap-admission admits class2 only when evidence_resolve names a
// zero_field / nonzero_field / defect_field (judge/gap-admission.ts); and the observer's response
// contract lists missing_count, measured only when input.vessel_ids is non-empty
// (RESPONSE_CONTRACTS.discovery_vessel_registry_observer). The assertions below check exactly that.
//
// The other kinds (sql_newest, gap_count, discovery_health, the seed table bindings) are armed from what
// their binding record declares: `check` { shape, input?, field }, read live and armed only when > 0, and
// `edit_site`, carried when it is on the vessel tree. No instrument returns those kinds' readings as a
// top-level field yet, so the unit runs use a stand-in shape the fake answers (FIXTURE_SHAPE): what is
// tested is the detector's arming path, not an instrument.
import { describe, expect, it, spyOn } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { JointFixture } from "./joint-liveness-tick.fake.ts";

const SUPER = resolve(import.meta.dir, "..", "..");
const SCRIPT = join(SUPER, "scripts", "substrate", "joint-liveness-tick.ts");
const FAKE = join(import.meta.dir, "joint-liveness-tick.fake.ts");
const NOW = "2026-10-19T12:00:00.000Z";
const ABSENT = "joint-fixture-absent-vessel";
const PRESENT = "joint-fixture-present-vessel";

const REG_JOINT = { name: "fixture-registered", kind: "discovery_registered", vesselIds: [ABSENT], reader: "a fixture reader" };

type Logged = { url: string; body: string };
function unitRun(fx: Partial<JointFixture>) {
  const dir = mkdtempSync(join(tmpdir(), "joint-liveness-"));
  const fxFile = join(dir, "fixture.json");
  writeFileSync(fxFile, JSON.stringify({ now: NOW, bindings: [], registry: [{ vesselId: PRESENT }], observer_missing: null, ...fx }));
  const logFile = join(dir, "log.jsonl");
  const p = Bun.spawnSync([process.execPath, "--preload", FAKE, SCRIPT], {
    cwd: dir,
    env: {
      PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", TZ: "UTC",
      FAKE_JOINT_FIXTURE: fxFile, FAKE_JOINT_LOG: logFile,
      SURREALDB_URL: "http://db.invalid", DEV_VESSEL_ENDPOINT: "http://dev.invalid", DISCOVERY_VESSEL_ENDPOINT: "http://disc.invalid",
    },
    stdout: "pipe", stderr: "pipe",
  });
  const log: Logged[] = existsSync(logFile) ? readFileSync(logFile, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
  const writes = log
    .filter((l) => l.url.endsWith("/v2/impulses/resolve"))
    .map((l) => JSON.parse(l.body)?.impulse?.pointer)
    .filter((ptr) => ptr?.type === "substrateGap_write")
    .map((ptr) => ptr.gap as { id: string; classification_metadata?: Record<string, any> });
  const readsOf = (shape: string) => log.filter((l) => l.url.endsWith("/v2/impulses/resolve") && JSON.parse(l.body)?.impulse?.pointer?.type === shape);
  const observerReads = readsOf("discovery_vessel_registry_observer");
  const fixtureReads = readsOf("joint_fixture_instrument");
  return { code: p.exitCode, stdout: p.stdout.toString(), stderr: p.stderr.toString(), writes, observerReads, fixtureReads };
}
const severedRow = (r: ReturnType<typeof unitRun>, name: string) => r.writes.find((g) => g.id === `severed-joint-${name}`);

const FIXTURE_SHAPE = "joint_fixture_instrument";
const CHECK = { shape: FIXTURE_SHAPE, input: { probe: "fixture" }, field: "severed_count" };
// One severed binding of every non-registration kind the detector reads.
const OTHER_KINDS: Array<{ binding: Record<string, unknown>; reading: string; fx?: Partial<JointFixture> }> = [
  { binding: { name: "fixture-newest", kind: "sql_newest", sql: "SELECT 1 AS t FROM fixture_table;", maxLagSec: 60, reader: "a fixture reader" }, reading: "newest record lags the newest execution by ∞ (none) (allowed 60s)" },
  { binding: { name: "fixture-count", kind: "gap_count", where: [], min: 1, reader: "a fixture reader" }, reading: "0 open gaps match (expected at least 1)" },
  { binding: { name: "fixture-health", kind: "discovery_health", reader: "a fixture reader" }, reading: "registered endpoints that do not answer /health: fixture-dead-vessel@http://dead.invalid (no answer)", fx: { registry: [{ vesselId: "fixture-dead-vessel", endpoint: "http://dead.invalid" }] } },
];


describe("joint-liveness-tick (unit run, top level)", () => {
  it("MUST-FAIL: a severed registration joint files a row armed class2 on the registry observer's missing_count", () => {
    const r = unitRun({ bindings: [REG_JOINT], observer_missing: 1 });
    expect(r.code).toBe(0);
    const row = severedRow(r, "fixture-registered");
    expect(row).toBeDefined();
    const m = row!.classification_metadata ?? {};
    // class2 by the classification rule: a usable evidence_resolve.shape, and nothing that precedes it.
    expect(m.hardcoded_url).toBeUndefined();
    expect(m.expected_literal).toBeUndefined();
    expect(m.evidence_resolve).toEqual({ shape: "discovery_vessel_registry_observer", input: { vessel_ids: [ABSENT] }, zero_field: "missing_count" });
    // admissible: a measured field the observer's contract declares, with the input it needs.
    expect(m.arming_skipped).toBeUndefined();
    // the arming was read live, for exactly the missing vessels, before the write.
    expect(r.observerReads.length).toBe(1);
    expect(JSON.parse(r.observerReads[0]!.body).impulse.pointer.vessel_ids).toEqual([ABSENT]);
    expect(m.reading).toBe(`not registered in discovery: ${ABSENT}`);
    expect(r.stdout).toContain("[joint-liveness] severed: fixture-registered (discovery_registered) armed discovery_vessel_registry_observer missing_count=1");
  }, 30_000);

  it("CONTROL: a healthy registration joint files nothing and reads no arming instrument", () => {
    const r = unitRun({ bindings: [{ ...REG_JOINT, vesselIds: [PRESENT] }], observer_missing: 1 });
    expect(r.code).toBe(0);
    expect(r.writes).toEqual([]);
    expect(r.observerReads).toEqual([]);
    expect(r.stdout).toContain("[joint-liveness] ok: fixture-registered (discovery_registered)");
  }, 30_000);

  it("FAIL CLOSED: a live arming read that is not > 0 files the row unarmed, saying why", () => {
    for (const observer_missing of [0, null]) {
      const r = unitRun({ bindings: [REG_JOINT], observer_missing });
      const m = severedRow(r, "fixture-registered")?.classification_metadata ?? {};
      expect(m.evidence_resolve).toBeUndefined();
      expect(String(m.arming_skipped)).toContain(`returned missing_count ${observer_missing === null ? "unmeasured" : 0}, not > 0`);
    }
  }, 30_000);

  it("a joint kind no instrument measures as a top-level field says so, with its reading attached", () => {
    const r = unitRun({ bindings: [{ name: "fixture-count", kind: "gap_count", where: [], min: 1, reader: "a fixture reader" }] });
    const m = severedRow(r, "fixture-count")?.classification_metadata ?? {};
    expect(m.evidence_resolve).toBeUndefined();
    expect(String(m.arming_skipped)).toContain("no instrument returns a gap_count joint's reading as a top-level field");
    expect(m.reading).toBe("0 open gaps match (expected at least 1)");
    expect(m.edit_site_unset_reason).toBeDefined();
  }, 30_000);

  it("CONTROL: a registration joint is armed on the registry observer whatever check its binding declares", () => {
    const r = unitRun({ bindings: [{ ...REG_JOINT, check: CHECK }], observer_missing: 1, instrument: { shape: FIXTURE_SHAPE, field: "severed_count", value: 5 } });
    const m = severedRow(r, "fixture-registered")?.classification_metadata ?? {};
    expect(m.evidence_resolve).toEqual({ shape: "discovery_vessel_registry_observer", input: { vessel_ids: [ABSENT] }, zero_field: "missing_count" });
    expect(r.fixtureReads).toEqual([]);
    expect(m.edit_site_unset_reason).toBe(`repos/${ABSENT}/src/index.ts is not on the vessel tree (/vessels)`);
  }, 30_000);

  for (const k of OTHER_KINDS) {
    const kind = String(k.binding.kind);
    const name = String(k.binding.name);
    it(`MUST-FAIL: a severed ${kind} joint whose binding declares a check files a row armed class2 on that check's live read`, () => {
      const r = unitRun({ ...k.fx, bindings: [{ ...k.binding, check: CHECK }], instrument: { shape: FIXTURE_SHAPE, field: "severed_count", value: 2 } });
      expect(r.code).toBe(0);
      const m = severedRow(r, name)?.classification_metadata ?? {};
      expect(m.hardcoded_url).toBeUndefined();
      expect(m.expected_literal).toBeUndefined();
      expect(m.evidence_resolve).toEqual({ shape: FIXTURE_SHAPE, input: { probe: "fixture" }, zero_field: "severed_count" });
      expect(m.arming_skipped).toBeUndefined();
      // read live, once, with exactly the declared input
      expect(r.fixtureReads.length).toBe(1);
      expect(JSON.parse(r.fixtureReads[0]!.body).impulse.pointer).toEqual({ probe: "fixture", type: FIXTURE_SHAPE });
      expect(r.observerReads).toEqual([]);
      expect(m.reading).toBe(k.reading);
      expect(r.stdout).toContain(`[joint-liveness] severed: ${name} (${kind}) armed ${FIXTURE_SHAPE} severed_count=2`);
    }, 30_000);

    it(`FAIL CLOSED: a ${kind} joint's declared check read at 0 or unmeasured files the row unarmed, saying why`, () => {
      for (const value of [0, null]) {
        const r = unitRun({ ...k.fx, bindings: [{ ...k.binding, check: CHECK }], instrument: { shape: FIXTURE_SHAPE, field: "severed_count", value } });
        const m = severedRow(r, name)?.classification_metadata ?? {};
        expect(m.evidence_resolve).toBeUndefined();
        expect(String(m.arming_skipped)).toContain(`the live ${FIXTURE_SHAPE} read returned severed_count ${value === null ? "unmeasured" : 0}, not > 0`);
        expect(r.stdout).toContain(`[joint-liveness] severed: ${name} (${kind}) unarmed`);
      }
    }, 30_000);
  }

  it("a declared check that names a write shape is never resolved, and the row says why", () => {
    const k = OTHER_KINDS[1]!;
    const r = unitRun({ bindings: [{ ...k.binding, check: { shape: "substrateGap_write", field: "n" } }] });
    const m = severedRow(r, "fixture-count")?.classification_metadata ?? {};
    expect(m.evidence_resolve).toBeUndefined();
    expect(String(m.arming_skipped)).toContain("the binding's check names a write shape (substrateGap_write); a check is a read");
    expect(r.writes.length).toBe(1);
  }, 30_000);

  it("severity is the joint's declared weight, or the row says it is unset", () => {
    const declared = severedRow(unitRun({ bindings: [{ ...REG_JOINT, severity: "high" }], observer_missing: 1 }), "fixture-registered");
    expect(declared?.classification_metadata?.severity).toBe("high");
    const unset = severedRow(unitRun({ bindings: [REG_JOINT], observer_missing: 1 }), "fixture-registered");
    expect(unset?.classification_metadata?.severity).toBeUndefined();
    expect(unset?.classification_metadata?.severity_unset_reason).toBe("the joint binding declares no severity");
  }, 30_000);
});

describe("joint-liveness-tick (module)", () => {
  it("MUST-FAIL: every non-registration kind carries its binding's declared edit_site and its armed check", async () => {
    const { declaredEditSite, declaredCheck, severedJointMeta } = await import(SCRIPT);
    const root = mkdtempSync(join(tmpdir(), "joint-site-"));
    mkdirSync(join(root, "writer-vessel", "src", "lib"), { recursive: true });
    writeFileSync(join(root, "writer-vessel", "src", "lib", "writer.ts"), "export {};\n");
    const site = declaredEditSite("repos/writer-vessel/src/lib/writer.ts", root);
    expect(site).toEqual({ edit_site: "repos/writer-vessel/src/lib/writer.ts" });
    for (const kind of ["table_newest", "sql_newest", "gap_count", "discovery_health"]) {
      const m = severedJointMeta({ name: `fixture-${kind}`, kind, reader: "r", reading: "x", severity: "high", missing: null, armRead: 3, editSite: null, check: declaredCheck(CHECK), declaredSite: site });
      expect(m.edit_site).toBe("repos/writer-vessel/src/lib/writer.ts");
      expect(m.edit_site_unset_reason).toBeUndefined();
      expect(m.evidence_resolve).toEqual({ shape: FIXTURE_SHAPE, input: { probe: "fixture" }, zero_field: "severed_count" });
      expect(m.severity).toBe("high");
      // undeclared: the row says what it lacks
      const bare = severedJointMeta({ name: `fixture-${kind}`, kind, reader: "r", reading: "x", missing: null, armRead: null, editSite: null });
      expect(bare.edit_site).toBeUndefined();
      expect(String(bare.edit_site_unset_reason)).toContain("its binding declares no edit_site");
      expect(String(bare.arming_skipped)).toContain("the binding declares no check {shape, input?, field}");
    }
    // a declared site off the tree, or outside repos/, is not carried
    expect(String(declaredEditSite("repos/writer-vessel/src/gone.ts", root).edit_site_unset_reason)).toContain("is not on the vessel tree");
    expect(String(declaredEditSite("scripts/x.ts", root).edit_site_unset_reason)).toContain("is not a repos/<vessel>/<path> file");
    expect(String(declaredEditSite("repos/writer-vessel/../../etc/passwd", root).edit_site_unset_reason)).toContain("is not a repos/<vessel>/<path> file");
    expect(declaredEditSite(undefined, root)).toBeNull();
  });

  it("CONTROL: a registration joint's metadata is unchanged by a declared site or check", async () => {
    const { severedJointMeta } = await import(SCRIPT);
    const base = { name: "r", kind: "discovery_registered", reader: "r", reading: "x", missing: [ABSENT], armRead: 1, editSite: { edit_site: `repos/${ABSENT}/src/index.ts` } };
    const plain = severedJointMeta(base);
    expect(severedJointMeta({ ...base, check: { check: CHECK }, declaredSite: { edit_site: "repos/other/src/a.ts" } })).toEqual(plain);
    expect(plain.evidence_resolve).toEqual({ shape: "discovery_vessel_registry_observer", input: { vessel_ids: [ABSENT] }, zero_field: "missing_count" });
    expect(plain.edit_site).toBe(`repos/${ABSENT}/src/index.ts`);
  });

  it("edit_site is the vessel's registration call site where its index.ts constructs the shared loop, else the reason", async () => {
    const { registrationEditSite } = await import(SCRIPT);
    const root = mkdtempSync(join(tmpdir(), "joint-tree-"));
    mkdirSync(join(root, "loop-vessel", "src"), { recursive: true });
    writeFileSync(join(root, "loop-vessel", "src", "index.ts"), "const r = new DiscoveryRegistrationLoop({});\n");
    mkdirSync(join(root, "plain-vessel", "src"), { recursive: true });
    writeFileSync(join(root, "plain-vessel", "src", "index.ts"), "export {};\n");
    expect(registrationEditSite("loop-vessel", root)).toEqual({ edit_site: "repos/loop-vessel/src/index.ts" });
    expect(registrationEditSite("plain-vessel", root)).toEqual({ edit_site_unset_reason: "repos/plain-vessel/src/index.ts does not construct the shared DiscoveryRegistrationLoop" });
    expect(String((registrationEditSite("gone-vessel", root) as { edit_site_unset_reason: string }).edit_site_unset_reason)).toContain("is not on the vessel tree");
  });

  // The inventory's "registers": false is the one exemption (development-vessel's health tick reads the same flag).
  const SILENT = "joint-fixture-silent-vessel";
  const SILENT_JOINT = { name: "fixture-silent", kind: "discovery_registered", vesselIds: [SILENT], reader: "a fixture reader" };
  const inventoryWith = (row: Record<string, unknown>) => () => ({ vessels: [{ unit: `${SILENT}.service`, repo: SILENT, health_port: 1, ...row }] });

  it("MUST-FAIL: a vessel whose inventory row says registers:false, absent from the registry, reads NOT severed, with the reason logged", async () => {
    const { evaluate } = await import(SCRIPT);
    const log = spyOn(console, "log").mockImplementation(() => {});
    try {
      const detail = await evaluate(SILENT_JOINT, 0, 0, async () => [{ vesselId: PRESENT }], inventoryWith({ registers: false }));
      expect(detail).toBeNull();
      expect(log.mock.calls.map((c) => String(c[0]))).toContain(`[joint-liveness] expected unregistered: ${SILENT} (fixture-silent): its inventory row says registers: false`);
      // the flag exempts only its own vessel
      expect(await evaluate({ ...SILENT_JOINT, vesselIds: [SILENT, ABSENT] }, 0, 0, async () => [], inventoryWith({ registers: false }))).toBe(`not registered in discovery: ${ABSENT}`);
    } finally { log.mockRestore(); }
  });

  it("CONTROL: the same vessel without the flag, absent from the registry, still reads severed", async () => {
    const { evaluate } = await import(SCRIPT);
    for (const row of [{}, { registers: true }]) {
      expect(await evaluate(SILENT_JOINT, 0, 0, async () => [{ vesselId: PRESENT }], inventoryWith(row))).toBe(`not registered in discovery: ${SILENT}`);
    }
  });
});
