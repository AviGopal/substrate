#!/usr/bin/env bun
/**
 * surgical-gap-scan.ts — SUPPLY of localized, single-edit, landable gaps for the
 * autonomous gap-compose loop (the last lever for unaided self-development).
 *
 * The autonomous loop (gap_to_feature -> feature_compose -> cutover) LANDS a fix
 * on origin/dev when handed a SURGICAL gap (a concrete existing edit-site + a
 * single-file fix). The substrate's own detectors emit mostly hard/architectural
 * gaps, so the loop starves. This scanner manufactures a high-PRECISION supply of
 * surgical gaps from a deterministic source scan.
 *
 * DETECTION (high precision over recall — a false positive wastes a loop cycle):
 *   Pattern HARDCODED_FETCH_ENDPOINT — an INLINE hardcoded `fetch("http://host:port…")`
 *   (or `ws://…`) string literal in vessel src. This is genuine drift risk (a
 *   port/host change silently breaks the call) and violates the foundation's "no
 *   hardcoded endpoints, route via discovery/env" principle. The fix is a single-line
 *   edit: replace the literal with the env-defaulted endpoint constant the file
 *   ALREADY defines (ACTIVITY_API_ENDPOINT / DISCOVERY_ENDPOINT / DEV_VESSEL_ENDPOINT /
 *   LIGHT_DISPATCH_ENDPOINT / …). We only flag literals that are NOT already a
 *   `const NAME = "http://…"` named default and NOT behind a `?? ` env fallback —
 *   i.e. genuinely inline, genuinely surgical.
 *
 * SCOPE (broadened 2026-06-29): the scan covers EVERY vessel under <repos>/<v>/src
 * (auto-discovered), not a fixed 3-vessel list. The fetch-anchoring + idiomatic
 * exclusions (named-default const, `?? ` fallback) are what keep this high-precision
 * fleet-wide — a bare "any localhost literal" scan was measured noisy (121 survivors,
 * dominated by comments / doc-strings / `||`-defaults / object-property defaults),
 * whereas the fetch-anchored form yields only genuine runtime call-sites (e.g. the
 * boredom-vessel `fetch(\`http://127.0.0.1:8280/dispatch\`)` whose file already defines
 * LIGHT_DISPATCH_ENDPOINT for :8280). Two structural candidate patterns were
 * considered and REJECTED on this codebase: `new WebSocket(...)`/`new URL(...)` inline
 * literals (0 hits — WS urls all derive from a base via `.replace`), and a hardcoded
 * `.listen(NNNN)` / `port: NNNN` server port (no `.listen(literal)` sites; the
 * `port:` hits are domain config / examples / idiomatic config-defaults → <90%
 * precision). Endpoint literals remain the one high-precision pattern.
 *
 * Each genuine hit -> ONE `systematic_failure` substrateGap with:
 *   - deterministic id (hex content hash; NEVER a 10/13-digit number, which
 *     gapClassKey would strip and collapse distinct gaps) -> re-runs UPSERT, no dupes,
 *   - classification_metadata { file_path, edit_site (file:line), suspected_real_location,
 *     single_file:true, proposed_fix, line } — exactly the fields localizeGap (path b)
 *     + landabilityScore reward (+0.3 edit-site, +0.1 single_file, +0.15 surgical cat).
 *
 * READ-ONLY: scans source, writes gaps. The downstream typecheck + semantic +
 * cutover gates catch a bad fix (-> UNFAVORABLE, no land), so a low-quality gap
 * costs a cycle but cannot land breakage. Precision still matters: keep it tight.
 *
 * Bounded: scans a fixed small vessel set, caps total gaps per run. Idempotent.
 *
 * Env:
 *   DEV_VESSEL_ENDPOINT   dev-vessel resolve endpoint (default http://127.0.0.1:8090)
 *   SURGICAL_SCAN_VESSELS comma list of vessels to scan (default: ALL vessels with a src/ dir under <repos>)
 *   SURGICAL_SCAN_CAP     max gaps to emit per run (default 4)
 *   SURGICAL_SCAN_REPOS   repos root (default <super-repo>/repos)
 *   SURGICAL_SCAN_DRYRUN  =1 -> print gaps, do not write
 */

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const DEV_VESSEL = process.env.DEV_VESSEL_ENDPOINT ?? "http://127.0.0.1:8090";
const CAP = Number(process.env.SURGICAL_SCAN_CAP ?? "4");
const DRYRUN = process.env.SURGICAL_SCAN_DRYRUN === "1";
// Default repos root: this script lives at <repo>/scripts/substrate/, so repos is ../../repos.
const REPOS_ROOT = process.env.SURGICAL_SCAN_REPOS ?? join(import.meta.dir, "..", "..", "repos");
// Default to EVERY vessel that has a src/ dir under the repos root (fleet-wide).
// An explicit SURGICAL_SCAN_VESSELS override still pins a subset. The fetch-anchoring
// + idiomatic exclusions keep precision high regardless of how many vessels we walk.
function discoverVessels(): string[] {
  try {
    return readdirSync(REPOS_ROOT)
      .filter((v) => !v.startsWith(".") && existsSync(join(REPOS_ROOT, v, "src")))
      .sort();
  } catch {
    return [];
  }
}
const VESSELS = (process.env.SURGICAL_SCAN_VESSELS
  ? process.env.SURGICAL_SCAN_VESSELS.split(",").map((s) => s.trim()).filter(Boolean)
  : discoverVessels());

// Known local-substrate port -> (vessel role, the env-defaulted const a file SHOULD use).
// Used only to make the proposed_fix concrete; absence is fine (generic fix text).
const PORT_ROLE: Record<string, { role: string; constName: string; envVar: string }> = {
  "8080": { role: "activity-api", constName: "ACTIVITY_API_ENDPOINT", envVar: "ACTIVITY_API_ENDPOINT" },
  "8090": { role: "development-vessel", constName: "DEV_VESSEL_ENDPOINT", envVar: "DEVELOPMENT_VESSEL_ENDPOINT" },
  "8100": { role: "discovery-vessel", constName: "DISCOVERY_ENDPOINT", envVar: "DISCOVERY_VESSEL_ENDPOINT" },
  "8210": { role: "goal-host-vessel", constName: "GOAL_HOST_ENDPOINT", envVar: "GOAL_HOST_VESSEL_ENDPOINT" },
  "8220": { role: "llm-resolver-vessel", constName: "LLM_VESSEL_ENDPOINT", envVar: "LLM_VESSEL_ENDPOINT" },
  "8240": { role: "ribosome-vessel", constName: "RIBOSOME_ENDPOINT", envVar: "RIBOSOME_VESSEL_ENDPOINT" },
  "8250": { role: "analysis-vessel", constName: "ANALYSIS_ENDPOINT", envVar: "ANALYSIS_VESSEL_ENDPOINT" },
  "8260": { role: "concept-db", constName: "CONCEPT_DB_ENDPOINT", envVar: "CONCEPT_DB_ENDPOINT" },
};

// INLINE hardcoded fetch URL literal: fetch( "http://host:port..." (or ws://). We
// require the literal to be the first argument of a fetch() call (so it is genuinely a
// runtime endpoint, not a doc/example string), and exclude:
//   - lines defining a named default ( const X = "http://..." ) — idiomatic, NOT a gap,
//   - lines with a `?? ` env fallback on the SAME line — already env-driven.
const FETCH_LITERAL = /fetch\(\s*(["'`])((?:https?|ws):\/\/(?:localhost|127\.0\.0\.1):(\d{4,5})[^"'`]*)\1/;

interface Hit {
  vessel: string;
  repoRel: string;      // repos/<vessel>/src/...
  line: number;         // 1-based
  port: string;
  url: string;
  lineText: string;
  existingConst?: string;  // name of an env-defaulted const in the SAME file for this port, if any
}

// In a file, find a `const NAME = process.env... ?? "http(s)://host:<port>"` (or
// `|| "..."`) declaration matching this port — the const the inline literal SHOULD
// reference. Makes the proposed_fix exact + single-line when the const already exists.
function findExistingConstForPort(content: string, port: string): string | undefined {
  const re = new RegExp(
    `const\\s+(\\w+)\\s*=\\s*(?:process\\.env\\.\\w+\\s*(?:\\?\\?|\\|\\|)\\s*)?["'\`](?:https?|ws):\\/\\/(?:localhost|127\\.0\\.0\\.1):${port}\\b`,
    "m",
  );
  return re.exec(content)?.[1];
}

function walk(dir: string, cap = 4000): string[] {
  const out: string[] = [];
  const stack = [dir];
  while (stack.length && out.length < cap) {
    const d = stack.pop()!;
    let entries: string[];
    try { entries = readdirSync(d); } catch { continue; }
    for (const e of entries) {
      if (e === "node_modules" || e === ".git" || e === "dist" || e.startsWith(".")) continue;
      const p = join(d, e);
      let st;
      try { st = statSync(p); } catch { continue; }
      if (st.isDirectory()) stack.push(p);
      else if (/\.(ts|tsx)$/.test(e) && !/\.(test|spec)\.tsx?$/.test(e)) out.push(p);
    }
  }
  return out;
}

function scanVessel(vessel: string): Hit[] {
  const srcAbs = join(REPOS_ROOT, vessel, "src");
  if (!existsSync(srcAbs)) return [];
  const hits: Hit[] = [];
  for (const abs of walk(srcAbs)) {
    let content: string;
    try { content = readFileSync(abs, "utf8"); } catch { continue; }
    if (!content.includes("fetch(")) continue;
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const text = lines[i]!;
      const m = FETCH_LITERAL.exec(text);
      if (!m) continue;
      // Exclude idiomatic forms:
      //  - a NAMED DEFAULT: `const NAME = "http://…"` (a string assigned to a const —
      //    the idiomatic env-default pattern). NOT `const r = await fetch(…)`, which
      //    assigns the RESPONSE and is still an inline hardcoded endpoint we want.
      //  - an env fallback on the same line (`?? "http://…"`) — already env-driven.
      if (/const\s+\w+\s*=\s*(["'`])https?:\/\//.test(text)) continue;
      if (/\?\?/.test(text)) continue;
      // repos/<vessel>/<relative under repo root>
      const rel = "repos/" + vessel + abs.slice(join(REPOS_ROOT, vessel).length);
      hits.push({
        vessel,
        repoRel: rel.replace(/\\/g, "/"),
        line: i + 1,
        port: m[3]!,
        url: m[2]!,
        lineText: text.trim().slice(0, 200),
        existingConst: findExistingConstForPort(content, m[3]!),
      });
    }
  }
  return hits;
}

function gapFromHit(h: Hit) {
  // Deterministic id: hex hash of the stable locus (vessel+file+port+url). Hex avoids
  // gapClassKey's 10/13-digit stripping that would collapse distinct gaps onto one row.
  const hash = createHash("sha256").update(`${h.repoRel}|${h.line}|${h.port}|${h.url}`).digest("hex").slice(0, 10);
  const id = `surgical-hardcoded-endpoint-${h.vessel}-${hash}`;
  const role = PORT_ROLE[h.port];
  // Best case: the file ALREADY declares an env-defaulted const for this port — the
  // fix is then a pure single-line substitution (reference the const, no new decl).
  const fixConst = h.existingConst
    ? `the env-defaulted endpoint constant \`${h.existingConst}\` ALREADY declared in this file (build the URL from it, e.g. \`\${${h.existingConst}}${(() => { try { return new URL(h.url).pathname; } catch { return ""; } })()}\`) instead of the inline literal — a pure single-line substitution, no new declaration needed`
    : role
    ? `the env-defaulted endpoint constant for ${role.role} (define/use \`const ${role.constName} = process.env.${role.envVar} ?? "http://127.0.0.1:${h.port}"\` and reference it here)`
    : `an env-defaulted endpoint constant (\`process.env.<VAR> ?? "http://127.0.0.1:${h.port}"\`) instead of the inline literal`;
  const proposed_fix =
    `Replace the inline hardcoded endpoint literal \`${h.url}\` on line ${h.line} of ${h.repoRel} with ${fixConst}. ` +
    `Single-line edit; behaviour-preserving in the local substrate (the env default equals the current literal) but removes the drift risk and honours the "no hardcoded endpoints — route via discovery/env" foundation principle.`;
  const summary =
    `Inline hardcoded endpoint literal "${h.url}" in ${h.repoRel}:${h.line}` +
    (role ? ` (the ${role.role} port :${h.port})` : "") +
    `. A hardcoded host:port in a fetch() call silently breaks if the endpoint moves and violates the route-via-env/discovery principle. ` +
    `Fix: replace the literal with the env-defaulted endpoint constant.`;
  return {
    id,
    category: "systematic_failure" as const,
    source: "substrate_detected" as const,
    summary,
    detected_at: new Date().toISOString(),
    status: "open" as const,
    classification_metadata: {
      detector: "surgical-gap-scan",
      pattern: "hardcoded_fetch_endpoint",
      vessel: h.vessel,
      file_path: h.repoRel,
      edit_site: `${h.repoRel}:${h.line}`,
      suspected_real_location: `${h.repoRel}:${h.line}`,
      single_file: true,
      line: h.line,
      hardcoded_url: h.url,
      port: h.port,
      existing_const: h.existingConst ?? null,
      proposed_fix,
    },
  };
}

async function writeGap(gap: ReturnType<typeof gapFromHit>): Promise<{ ok: boolean; action?: string; error?: string }> {
  try {
    const resp = await fetch(`${DEV_VESSEL}/v2/impulses/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ impulse: { type: "substrateGap_write", gap } }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) return { ok: false, error: `http ${resp.status}` };
    const body = (await resp.json())?.body ?? {};
    return { ok: true, action: body.action };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function main(): Promise<void> {
  const allHits: Hit[] = [];
  for (const v of VESSELS) allHits.push(...scanVessel(v));
  // Stable order (file, line) so the capped slice is deterministic across runs.
  allHits.sort((a, b) => a.repoRel.localeCompare(b.repoRel) || a.line - b.line);
  const selected = allHits.slice(0, Math.max(0, CAP));

  const emitted: Array<Record<string, unknown>> = [];
  for (const h of selected) {
    const gap = gapFromHit(h);
    if (DRYRUN) {
      emitted.push({ id: gap.id, edit_site: gap.classification_metadata.edit_site, dryrun: true });
      continue;
    }
    const res = await writeGap(gap);
    emitted.push({ id: gap.id, edit_site: gap.classification_metadata.edit_site, ...res });
  }

  console.log(JSON.stringify({
    detector: "surgical-gap-scan",
    pattern: "hardcoded_fetch_endpoint",
    vessels: VESSELS,
    total_hits: allHits.length,
    cap: CAP,
    emitted_count: emitted.length,
    dryrun: DRYRUN,
    emitted,
  }, null, 2));
}

await main();
