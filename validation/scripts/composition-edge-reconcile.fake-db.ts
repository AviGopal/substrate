// A fetch-level fake of the SurrealDB /sql endpoint, answering exactly the statements
// scripts/substrate/composition-edge-reconcile.ts issues. Used two ways by
// composition-edge-reconcile.test.ts:
//   - imported: makeFakeDb(fixture).fetch is injected into makeSql (in-process tests);
//   - preloaded: `bun --preload <this file> composition-edge-reconcile.ts` with
//     FAKE_EDGE_DB_FIXTURE set replaces globalThis.fetch, so the script runs exactly as its
//     unit runs it (top level), against the fake. Any non-/sql URL (discovery,
//     development-vessel) is recorded and refused; nothing reaches a real service.
// The fixture, the query log and the resulting state live in files the test names.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

export type ViewRow = {
  id: string; execution_id: string; activity_id?: string; parent_execution_id?: string;
  composition_chain?: string[]; input_impulse_shapes?: string[]; output_impulse_shapes?: string[];
  success?: boolean; executed_at?: string;
};
export type ContentRow = { id: string; execution_id: string; tasks: any[] };
export type Fixture = {
  view: ViewRow[];
  content?: ContentRow[];
  view_count?: number;          // what `count()` on the view answers (default: view.length)
  execution_count?: number;     // what `count()` on execution answers (default: view.length)
  state?: Record<string, any> | null;
  graph?: Record<string, any>;  // rid -> edge record
  fail_view_after_id?: string;  // every page query `WHERE id > <this>` answers an empty body
};
export type Dump = { state: Record<string, any> | null; graph: Record<string, any>; unhandled: string[] };

function parseLines(body: string): Record<string, any> {
  const o: Record<string, any> = {};
  for (const line of body.split("\n")) {
    const m = /^\s*(\w+): (.*?),?\s*$/.exec(line);
    if (!m) continue;
    try { o[m[1]] = JSON.parse(m[2]); } catch { /* time::now() etc. */ }
  }
  return o;
}

function field(q: string, name: string): any {
  const m = new RegExp(`${name}: ("(?:[^"\\\\]|\\\\.)*"|-?[0-9.]+|true|false)`).exec(q);
  return m ? JSON.parse(m[1]) : undefined;
}

export function makeFakeDb(fx: Fixture, dump?: Dump) {
  const view = [...fx.view].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const content = [...(fx.content ?? [])].sort((a, b) => (a.id < b.id ? -1 : 1));
  const db: Dump = dump ?? { state: fx.state ?? null, graph: { ...(fx.graph ?? {}) }, unhandled: [] };
  const queries: string[] = [];
  const otherUrls: string[] = [];
  let failViewAfter = fx.fail_view_after_id;

  const answer = (q: string): any[] | null => {
    const one = (result: any) => [{ status: "OK", result }];
    let m: RegExpExecArray | null;
    if (/^SELECT watermark, recent_ids, last_full_at\b.* FROM reconcile_state:`composition-edge`;$/.test(q)) return one(db.state ? [db.state] : []);
    if (/^SELECT count\(\) FROM v_paradigm_execution_traces GROUP ALL;$/.test(q)) return one([{ count: fx.view_count ?? view.length }]);
    if (/^SELECT count\(\) FROM execution GROUP ALL;$/.test(q)) return one([{ count: fx.execution_count ?? view.length }]);
    if (/^SELECT count\(\) FROM activity_composition_graph GROUP ALL;$/.test(q)) return one([{ count: Object.keys(db.graph).length }]);
    if ((m = /FROM v_paradigm_execution_traces WHERE execution_id INSIDE (\[.*\]);$/.exec(q))) {
      const ids = new Set(JSON.parse(m[1]));
      return one(view.filter((r) => ids.has(r.execution_id)));
    }
    if ((m = /FROM v_paradigm_execution_traces\s+(?:WHERE id > (\S+)\s+)?LIMIT (\d+);$/.exec(q))) {
      const after = m[1] ?? "";
      if (failViewAfter !== undefined && after === failViewAfter) return null;
      return one(view.filter((r) => r.id > after).slice(0, Number(m[2])));
    }
    if ((m = /FROM v_paradigm_execution_traces WHERE executed_at >= type::datetime\((".*?")\) LIMIT (\d+);$/.exec(q))) {
      const from = JSON.parse(m[1]);
      const rows = view.filter((r) => r.executed_at && r.executed_at >= from).sort((a, b) => (a.executed_at! < b.executed_at! ? -1 : 1));
      return one(rows.slice(0, Number(m[2])));
    }
    if ((m = /FROM execution_trace_content WHERE execution_id INSIDE (\[.*?\]) AND array::len/.exec(q))) {
      const ids = new Set(JSON.parse(m[1]));
      return one(content.filter((r) => ids.has(r.execution_id) && r.tasks.length > 0));
    }
    if ((m = /FROM execution_trace_content WHERE array::len\(tasks \?\? \[\]\) > 0\s*(?:AND id > (\S+))?\s*LIMIT (\d+);$/.exec(q))) {
      const after = m[1] ?? "";
      return one(content.filter((r) => r.tasks.length > 0 && r.id > after).slice(0, Number(m[2])));
    }
    if ((m = /^SELECT id, parent_activity_id, child_activity_id, execution_count, success_count FROM \[(.*)\];$/.exec(q))) {
      const rids = [...m[1].matchAll(/activity_composition_graph:`(\w+)`/g)].map((x) => x[1]);
      return one(rids.filter((r) => db.graph[r]).map((r) => ({ id: `activity_composition_graph:${r}`, ...db.graph[r] })));
    }
    if ((m = /^UPSERT activity_composition_graph:`(\w+)` CONTENT \{/.exec(q))) {
      db.graph[m[1]] = {
        parent_activity_id: field(q, "parent_activity_id"), child_activity_id: field(q, "child_activity_id"),
        execution_count: field(q, "execution_count"), success_count: field(q, "success_count"),
        edge_kind: field(q, "edge_kind"), genuine: field(q, "genuine"),
      };
      return one([db.graph[m[1]]]);
    }
    if ((m = /^UPSERT reconcile_state:`composition-edge` (CONTENT|MERGE) \{([\s\S]*)\};$/.exec(q))) {
      const body = parseLines(m[2]);
      db.state = m[1] === "CONTENT" ? body : { ...(db.state ?? {}), ...body };
      return one([db.state]);
    }
    db.unhandled.push(q);
    return [{ status: "ERR", result: "fake: unhandled statement" }];
  };

  async function fakeFetch(input: any, init?: any): Promise<Response> {
    const url = String(input instanceof Request ? input.url : input);
    if (!url.endsWith("/sql")) {
      otherUrls.push(url + " " + String(init?.body ?? "").slice(0, 400));
      throw new Error("fake-db: refused non-/sql request to " + url);
    }
    const q = String(init?.body ?? "");
    queries.push(q);
    const res = answer(q);
    return new Response(res === null ? "" : JSON.stringify(res), { status: 200 });
  }

  return {
    fetch: fakeFetch as unknown as typeof fetch,
    queries, otherUrls, db,
    stopFailing() { failViewAfter = undefined; },
  };
}

// ---- preload mode -------------------------------------------------------------------------
const FX = process.env.FAKE_EDGE_DB_FIXTURE;
if (FX) {
  const LOG = process.env.FAKE_EDGE_DB_LOG!;
  const DUMP = process.env.FAKE_EDGE_DB_DUMP!;
  const fx: Fixture = JSON.parse(readFileSync(FX, "utf8"));
  const prior: Dump | undefined = existsSync(DUMP) ? JSON.parse(readFileSync(DUMP, "utf8")) : undefined;
  const fake = makeFakeDb(fx, prior);
  const save = () => writeFileSync(DUMP, JSON.stringify(fake.db));
  save();
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = String(input instanceof Request ? input.url : input);
    appendFileSync(LOG, JSON.stringify({ url, body: String(init?.body ?? "") }) + "\n");
    try { return await fake.fetch(input, init); } finally { save(); }
  }) as typeof fetch;
}
