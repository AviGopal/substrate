// A fetch-level fake of everything scripts/substrate/joint-liveness-tick.ts talks to, for
// joint-liveness-tick.test.ts. Preloaded (`bun --preload <this file> joint-liveness-tick.ts`) with
// FAKE_JOINT_FIXTURE set, it replaces globalThis.fetch, so the tick runs exactly as its unit runs it
// (top level) against the fixture:
//   - the store's /sql: the DB clock, and a newest `execution` / `decision_outcome` row FRESH_SEC old;
//   - development-vessel's /v2/impulses/resolve: the jointBinding records, the registry observer's
//     answer (missing_count as the fixture says), the fixture instrument a binding's declared check
//     names (a stand-in: no instrument for those kinds exists yet), substrateGap_write (recorded,
//     answered ok);
//   - discovery's /resolve: the vesselRegistry rows.
// Every request is appended to FAKE_JOINT_LOG; any other request is recorded and refused, so nothing
// reaches a real service.
import { appendFileSync, readFileSync } from "node:fs";

export type JointFixture = {
  now: string;
  bindings: Array<Record<string, unknown>>;
  registry: Array<{ vesselId: string; endpoint?: string }>;
  /** What the observer's missing_count answers for a vessel_ids read; null leaves the field out. */
  observer_missing: number | null;
  /** A stand-in instrument for a binding's declared check: resolving `shape` answers `field` = `value` (null leaves it out). */
  instrument?: { shape: string; field: string; value: number | null };
};

const FX = process.env.FAKE_JOINT_FIXTURE;
if (FX) {
  const LOG = process.env.FAKE_JOINT_LOG!;
  const fx: JointFixture = JSON.parse(readFileSync(FX, "utf8"));
  const fresh = new Date(Date.parse(fx.now) - 10_000).toISOString();
  const json = (v: unknown) => new Response(JSON.stringify(v), { status: 200, headers: { "Content-Type": "application/json" } });
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = String(input instanceof Request ? input.url : input);
    const body = String(init?.body ?? "");
    appendFileSync(LOG, JSON.stringify({ url, body }) + "\n");
    if (url.endsWith("/sql")) {
      if (body.includes("time::now()")) return json([{ status: "OK", result: [{ t: fx.now }] }]);
      if (/FROM (execution|decision_outcome) /.test(body)) return json([{ status: "OK", result: [{ executed_at: fresh }] }]);
      return json([{ status: "OK", result: [] }]);
    }
    if (url.endsWith("/v2/impulses/resolve")) {
      const p = (JSON.parse(body)?.impulse?.pointer ?? {}) as Record<string, unknown>;
      if (p.type === "poolImpulse" && p.shape === "jointBinding") return json({ success: true, body: { impulses: fx.bindings.map((b) => ({ status: "open", body: b })) } });
      if (p.type === "discovery_vessel_registry_observer") {
        return json({ success: true, shape: "discoveryRegistryState", body: { reachable: true, ...(fx.observer_missing === null ? {} : { missing_count: fx.observer_missing }) } });
      }
      if (fx.instrument && p.type === fx.instrument.shape) {
        return json({ success: true, body: { ...(fx.instrument.value === null ? {} : { [fx.instrument.field]: fx.instrument.value }) } });
      }
      if (p.type === "substrateGap_write") return json({ success: true, shape: "substrateGap", body: {} });
      if (p.type === "substrateGap") return json({ success: true, body: { gaps: [] } });
      throw new Error("joint fake: refused resolve of " + String(p.type));
    }
    if (url.endsWith("/resolve")) return json({ content: { vessels: fx.registry } });
    throw new Error("joint fake: refused request to " + url);
  }) as typeof fetch;
}
