#!/usr/bin/env bash
# walk-owner-seed-alignment.test.sh: Wave 4 alignment checks for walk-owner-seed.ts:
#   (a) SOTA 2-family channels: google/gemini-3.8-flash and z-ai/glm-5.3 (length 2, max_tokens 16384), retiring dropped models;
#   (b) request ("", "gap"): rank_context true, context_budget 98304, conceptSearch + docSection/vessel_construction_pattern/
#       impulse_activity_pattern/rejected_approach/uses guidance;
#   (c) activity_template (""): inputs [{shape: outcome, where: {r: 1}, latest_by: shape}], x-shape-in also ["activity_template"],
#       composition guidance with template_ref;
#   (d) activity_template ("gap"): inputs [{shape: gap, where: {status: closed}, latest_by: gap_id}],
#       context ["hop", "gitDiff", "land_verdict"], reads [{type: shapeDescriptions, declared: true}],
#       x-shape-in also ["activity_template"];
#   (e) second run is strictly idempotent (0 additional rows written);
#   (f) conditional once-only fallback_order refresh: prepends SOTA order and strips :free when stale fallback_order is served
#       (idempotent on second run), and writes nothing extra when policy has no fallback_order.
# Driven against a stand-in discovery (loopback only, no fleet key).
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SEED="$ROOT/scripts/substrate/walk-owner-seed.ts"
BUN="$(command -v bun || echo /usr/local/bin/bun)"
[ -n "$("$BUN" -e 'console.log(process.versions.bun ?? "")' 2>/dev/null)" ] || { echo "FAIL - cannot judge: no bun at $BUN"; exit 1; }
W="$(mktemp -d "${TMPDIR:-/tmp}/seed-alignment.XXXXXX")" || { echo "FAIL - mktemp"; exit 1; }
trap 'rm -rf "$W"' EXIT
cp "$SEED" "$W/walk-owner-seed.ts"
cat > "$W/drive.ts" <<'TS'
type Row = Record<string, any>;
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

const runScenario = async (initialRows: Row[], policy: Row | null) => {
  const rows: Row[] = initialRows.map((r) => ({ ...r }));
  const policyWrites: Row[] = [];
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(req) {
      const pointer = (((await req.json().catch(() => ({}))) as Row).pointer ?? {}) as Row;
      if (pointer.type === "record_read") {
        return json(rows.filter((r) => r.shape === pointer.shape
          && Object.entries((pointer.where ?? {}) as Row).every(([k, v]) => String(r[k]) === String(v))));
      }
      if (pointer.type === "record_write") {
        const nextSeq = rows.reduce((m, r) => Math.max(m, typeof r.seq === "number" ? r.seq : 0), 0) + 1;
        const row = { ...pointer.row, id: `row-${rows.length + 1}`, seq: nextSeq, writer: pointer.writer, role: pointer.role };
        rows.push(row);
        return json(row);
      }
      if (pointer.type === "llmModelPolicy" && policy !== null) {
        return json({ resolved: true, shape: "llmModelPolicy", body: policy });
      }
      if (pointer.type === "llmModelPolicy_write" && policy !== null) {
        policyWrites.push(pointer);
        if ("denied_models" in pointer) policy.denied_models = pointer.denied_models;
        if ("fallback_order" in pointer) policy.fallback_order = pointer.fallback_order;
        return json({ resolved: true, shape: "llmModelPolicyWriteResult", body: { rev: policyWrites.length + 1 } });
      }
      return json({ error: "Not found" }, 404);
    },
  });
  const seed = async () => {
    const p = Bun.spawn([process.execPath, `${import.meta.dir}/walk-owner-seed.ts`], {
      env: { PATH: process.env.PATH ?? "", DISCOVERY_URL: `http://127.0.0.1:${server.port}`, METABOB_API_KEY: "mb-align-" + "k".repeat(32) },
      stdout: "pipe",
      stderr: "pipe",
    });
    const killer = setTimeout(() => p.kill(), 60_000);
    const code = await p.exited;
    clearTimeout(killer);
    return code;
  };
  const firstCode = await seed();
  const afterFirst = rows.length;
  const writesAfterFirst = policyWrites.length;
  const secondCode = await seed();
  const afterSecond = rows.length;
  const writesAfterSecond = policyWrites.length;
  server.stop(true);
  return { firstCode, secondCode, rows, afterFirst, afterSecond, policyWrites, writesAfterFirst, writesAfterSecond };
};

let failed = 0;
const leg = (ok: boolean, what: string) => { console.log(`${ok ? "ok  " : "FAIL"} - ${what}`); if (!ok) failed++; };

// Scenario 1: stale channel (deepseek-v4-pro-0813) + stale fallback_order with :free entry
const oldDeepseek: Row = {
  shape: "channel", id: "ch-old", seq: 1, writer: "owner", role: "owner",
  calls: [{ pointer: { type: "llm_completion", model: "deepseek/deepseek-v4-pro-0813", max_tokens: 16384 }, input_field: "prompt", output_field: "content", producer_field: "model" }],
};
const stalePolicy: Row = {
  rev: 1,
  denied_models: [":free"],
  fallback_order: ["google/gemini-2.5-flash", "vendor/trial:free", "vendor/custom-paid"],
};
const s1 = await runScenario([oldDeepseek], stalePolicy);
const schemaOf = (rows: Row[], target: string, variant = "") =>
  rows.filter((r) => r.shape === "shape_schema" && r.target === target && String(r.variant ?? "") === variant).at(-1);

const newChannels = s1.rows.slice(1).filter((r) => r.shape === "channel");
const activeChannels = newChannels.filter((r) => r.retired !== true);
const retiredChannels = newChannels.filter((r) => r.retired === true);
leg(
  s1.firstCode === 0
    && activeChannels.length === 2
    && JSON.stringify(activeChannels.map((c) => c.calls?.[0]?.pointer)) === JSON.stringify([
      { type: "llm_completion", model: "google/gemini-3.8-flash", max_tokens: 16384 },
      { type: "llm_completion", model: "z-ai/glm-5.3", max_tokens: 16384 },
    ])
    && retiredChannels.length === 1
    && retiredChannels[0].calls?.[0]?.pointer?.model === "deepseek/deepseek-v4-pro-0813",
  "(a) SOTA 2-family channels written (google/gemini-3.8-flash, z-ai/glm-5.3, max_tokens 16384) and dropped deepseek retired",
);

const req = schemaOf(s1.rows, "request", "");
const reqGap = schemaOf(s1.rows, "request", "gap");
const hasConceptWords = (s: Row | undefined) => {
  const d = String(s?.description ?? "");
  return ["conceptSearch", "docSection", "vessel_construction_pattern", "impulse_activity_pattern", "rejected_approach", "uses"].every((w) => d.includes(w));
};
leg(
  [req, reqGap].every((r) => r?.rank_context === true && r?.context_budget === 98304 && hasConceptWords(r)),
  "(b) request ('' and 'gap') carry rank_context: true, context_budget: 98304, and conceptSearch polarity guidance",
);

const tmpl = schemaOf(s1.rows, "activity_template", "");
const tmplShapeIn = tmpl?.schema?.properties?.calls?.items?.properties?.shape?.["x-shape-in"];
leg(
  JSON.stringify(tmpl?.inputs) === JSON.stringify([{ shape: "outcome", where: { r: 1 }, latest_by: "shape" }])
    && JSON.stringify(tmplShapeIn) === JSON.stringify({ read: "shapeDescriptions", keys_of: "content.shape_descriptions", also: ["activity_template"] })
    && String(tmpl?.description ?? "").includes("template_ref"),
  "(c) activity_template ('') requires outcome r: 1, allows also: ['activity_template'], and describes template_ref composition",
);

const tmplGap = schemaOf(s1.rows, "activity_template", "gap");
const tmplGapShapeIn = tmplGap?.schema?.properties?.calls?.items?.properties?.shape?.["x-shape-in"];
leg(
  !!tmplGap
    && JSON.stringify(tmplGap.inputs) === JSON.stringify([{ shape: "gap", where: { status: "closed" }, latest_by: "gap_id" }])
    && JSON.stringify(tmplGap.context) === JSON.stringify(["hop", "gitDiff", "land_verdict"])
    && JSON.stringify(tmplGap.reads) === JSON.stringify([{ type: "shapeDescriptions", declared: true }])
    && JSON.stringify(tmplGapShapeIn) === JSON.stringify({ read: "shapeDescriptions", keys_of: "content.shape_descriptions", also: ["activity_template"] })
    && String(tmplGap.description ?? "").includes("template_ref"),
  "(d) activity_template ('gap') extracts from closed gaps with hop/gitDiff/land_verdict context and also: ['activity_template']",
);

leg(
  s1.secondCode === 0 && s1.afterSecond === s1.afterFirst,
  `(e) second run is strictly idempotent (${s1.afterFirst} then ${s1.afterSecond} rows)`,
);

const fbWrite = s1.policyWrites.find((w) => "fallback_order" in w);
const expectedPrefix = [
  "google/gemini-3.8-flash",
  "z-ai/glm-5.3",
  "qwen/qwen3.8-flash",
  "google/gemini-4-hydrogen",
  "deepseek/deepseek-v4-pro-0813",
  "qwen/qwen4-max",
];
leg(
  s1.writesAfterFirst === 1
    && s1.writesAfterSecond === 1
    && Array.isArray(fbWrite?.fallback_order)
    && JSON.stringify(fbWrite.fallback_order.slice(0, expectedPrefix.length)) === JSON.stringify(expectedPrefix)
    && fbWrite.fallback_order.includes("vendor/custom-paid")
    && fbWrite.fallback_order.every((m: string) => !m.includes(":free"))
    && s1.rows.some((r) => r.shape === "owner_seeded" && r.what === "fallback_order_sota_v1"),
  "(f1) stale fallback_order refreshed once with SOTA prefix and :free entries removed, idempotent on second run",
);

// Scenario 2: policy without fallback_order field -> zero fallback_order writes
const noFallbackPolicy: Row = { rev: 1, denied_models: [":free"] };
const s2 = await runScenario([], noFallbackPolicy);
leg(
  s2.firstCode === 0 && s2.writesAfterFirst === 0 && s2.writesAfterSecond === 0
    && !s2.rows.some((r) => r.shape === "owner_seeded" && r.what === "fallback_order_sota_v1"),
  "(f2) policy without fallback_order triggers zero fallback_order writes",
);

process.exit(failed === 0 ? 0 : 1);
TS
out="$(cd "$W" && "$BUN" "$W/drive.ts" 2>&1)"; rc=$?
printf '%s\n' "$out" | grep -E '^(ok  |FAIL) - '
[ "$rc" -eq 0 ] && { echo; echo PASS; exit 0; }
echo; echo "FAILED"; exit 1
