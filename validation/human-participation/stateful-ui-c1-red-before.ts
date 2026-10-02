// RED-BEFORE probe for SPEC C-1. Spawns stateful-ui-vessel against a DISPOSABLE
// UI_STORE_PATH under mkdtemp, a dead discovery endpoint, and a free port.
// Never touches /workspace/state/ui-panel-store.json or :8270.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "statefului-red-"));
const storePath = join(dir, "ui-panel-store.json");
const port = 9270 + Math.floor(Math.random() * 300);
const base = `http://127.0.0.1:${port}`;

const proc = Bun.spawn(["bun", "run", "src/index.ts"], {
  cwd: "/home/avi/documents/work/substrate/repos/stateful-ui-vessel",
  env: {
    ...process.env,
    UI_STORE_PATH: storePath,
    PORT: String(port),
    HOST: "127.0.0.1",
    DISCOVERY_VESSEL_ENDPOINT: "http://127.0.0.1:1", // dead on purpose
  },
  stdout: "pipe",
  stderr: "pipe",
});

async function up(): Promise<boolean> {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${base}/health`);
      if (r.ok) return true;
    } catch { /* not yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

const resolve = async (pointer: Record<string, unknown>) => {
  const r = await fetch(`${base}/resolve`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ impulse: { pointer } }),
  });
  return { status: r.status, json: await r.json() as any };
};
const live = async (id: string) => {
  const r = await fetch(`${base}/api/state`);
  const d = await r.json() as any;
  return d.panels.find((p: any) => p.id === id);
};

try {
  if (!await up()) {
    console.log("PROBE COULD NOT COVER: vessel never became healthy on", base);
    console.log(await new Response(proc.stderr).text());
    process.exit(2);
  }
  console.log("STORE_PATH (disposable) =", storePath);
  console.log("HEALTH =", await (await fetch(`${base}/health`)).text());

  // ── case A: defaulted write over an existing panel
  const id = "frozen-s6-incident-handoff-v1-repro";
  const seeded = { claims: ["c1", "c2", "c3", "c4", "c5", "c6"], handoff: "incident 4471" };
  const seed = await resolve({
    type: "uiQuestion_write", id, title: "S6 incident handoff", body: seeded,
    kind: "question", importance: "high",
    asks: [{ id: "a1", prompt: "Which claim is wrong?", type: "text" }],
  });
  console.log("A/seed status=%d stored=%j", seed.status, await live(id));
  const destructive = await resolve({ type: "uiQuestion_write", id });
  console.log("A/destructive status=%d resp=%j", destructive.status, destructive.json);
  console.log("A/after stored=%j", await live(id));

  // ── case B: object body coerced while claiming success
  const oid = "object-body-coercion-repro";
  const ob = await resolve({ type: "uiQuestion_write", id: oid, title: "T", body: { a: 1 } });
  console.log("B/status=%d resolved=%j storedBody=%j", ob.status, ob.json.resolved, (await live(oid))?.body);

  // ── case C: positive control — absent vs explicit null are indistinguishable
  const nid = "null-vs-absent-repro";
  await resolve({ type: "uiQuestion_write", id: nid, title: "Real title", body: "keep" });
  const withNull = await resolve({ type: "uiQuestion_write", id: nid, title: null });
  console.log("C/status=%d storedTitle=%j storedBody=%j", withNull.status, (await live(nid))?.title, (await live(nid))?.body);

  // ── case D: positive control — fresh id creation still works
  const fid = "fresh-id-defaults-repro";
  const fresh = await resolve({ type: "uiQuestion_write", id: fid });
  console.log("D/status=%d stored=%j", fresh.status, await live(fid));
} finally {
  proc.kill();
}
