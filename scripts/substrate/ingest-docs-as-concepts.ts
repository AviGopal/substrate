/**
 * ingest-docs-as-concepts (2026-06-28) — wire the DOCS learning channel.
 *
 * The architecture docs (SUBSTRATE_AS_*, IMPULSE_ACTIVITY_FOUNDATION) are operator
 * prose the substrate could READ but not LEARN FROM — they weren't impulses with a
 * shape the planner consults. This ingests them into concept-db: each doc section
 * becomes a concept (embedded by concept-db's MiniLM), so architectural principles
 * ("reuse before mint", the reach-gate, the shape lattice, lambda1 >= rho_grow)
 * become resolvable/searchable shapes. A planner/author can then dense-search the
 * relevant principle before acting — the docs analogue of grounding resolving code
 * structure. This is the INGESTION half; planner-consultation (resolve relevant
 * concepts before authoring) is the follow-on wire.
 *
 * Idempotency: each concept carries metadata.section_key = "<doc>#<slug>"; re-runs
 * are additive (concept-db does not dedup on this yet), so run deliberately.
 */
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.env["SUBSTRATE_ROOT"] ?? process.cwd();
const CONCEPT_DB = (process.env["CONCEPT_DB_ENDPOINT"] || "http://127.0.0.1:8260").replace(/\/$/, "");
const ARCH_DIR = join(ROOT, "docs", "architecture");
const EXTRA_DOCS = ["IMPULSE_ACTIVITY_FOUNDATION.md"];
const MIN_SECTION_CHARS = 200;
const MAX_CONTENT_CHARS = 2400;

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

// Split a markdown doc into (heading, body) sections on level-2 headers.
function sections(md: string): Array<{ heading: string; body: string }> {
  const out: Array<{ heading: string; body: string }> = [];
  const parts = md.split(/\n(?=## )/);
  for (const part of parts) {
    const m = part.match(/^#{2,3}\s+(.+)$/m);
    const heading = m?.[1]?.trim() ?? "(intro)";
    const body = part.replace(/^#{2,3}\s+.+$/m, "").trim();
    if (body.length >= MIN_SECTION_CHARS) out.push({ heading, body: body.slice(0, MAX_CONTENT_CHARS) });
  }
  return out;
}

async function createConcept(doc: string, heading: string, body: string): Promise<boolean> {
  const sectionKey = `${doc}#${slug(heading)}`;
  try {
    const res = await fetch(`${CONCEPT_DB}/v2/impulses/resolve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Send the substrate key so concepts land in the substrate's org (not the
        // unauthenticated "default" org), where the substrate's search/priming reads.
        ...(process.env["METABOB_API_KEY"] ? { Authorization: `ApiKey ${process.env["METABOB_API_KEY"]}` } : {}),
      },
      body: JSON.stringify({
        impulse: {
          type: "concept_create_write",
          pointer: {
            type: "concept_create_write",
            conceptData: {
              source_type: "architecture_doc",
              content: `${heading}\n\n${body}`,
              shape: "architecturePrinciple",
              summary: `${doc}: ${heading}`.slice(0, 160),
              metadata: { doc, heading, section_key: sectionKey, source: "architecture-docs-ingest" },
            },
          },
        },
      }),
      signal: AbortSignal.timeout(30_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  let files: string[] = [];
  try {
    files = (await readdir(ARCH_DIR)).filter((f) => f.startsWith("SUBSTRATE_AS_") && f.endsWith(".md"));
  } catch (e) {
    console.error(`[ingest-docs] cannot read ${ARCH_DIR}: ${(e as Error).message}`);
    process.exit(1);
  }
  for (const extra of EXTRA_DOCS) if (!files.includes(extra)) files.push(extra);

  let created = 0, failed = 0, scanned = 0;
  for (const f of files) {
    let md: string;
    try { md = await readFile(join(ARCH_DIR, f), "utf8"); } catch { continue; }
    const secs = sections(md);
    for (const s of secs) {
      scanned++;
      const ok = await createConcept(f, s.heading, s.body);
      if (ok) created++; else failed++;
    }
    console.log(`[ingest-docs] ${f}: ${secs.length} sections`);
  }
  console.log(`[ingest-docs] done: scanned=${scanned} created=${created} failed=${failed} across ${files.length} docs`);
}

main().catch((e) => { console.error("[ingest-docs] fatal", e); process.exit(1); });
