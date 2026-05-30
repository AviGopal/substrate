/**
 * seed-claudemd.ts — one-shot bootstrap of constitutional concepts.
 *
 * Reads load-bearing sections from the project's CLAUDE.md files and mints
 * one concept per section into concept-db. Each concept gets:
 *   - source_type: vessel_construction_pattern or impulse_activity_pattern
 *   - pointer: { type: "memo", path: "<file>", section: "<heading>" }
 *   - shape: derived from heading
 *
 * Then writes `description_of` edges between related concepts so the
 * graph has structure from day one.
 *
 * Idempotent-ish: re-running creates duplicates with new ids. Skip the
 * second run, or accept the duplication and let concept-db's
 * prune-irrelevant-neighbors upkeep eventually clean it up.
 *
 * Usage:
 *   docker exec -e CONCEPT_DB_URL=http://127.0.0.1:8260 substrate-live \
 *     bash -c 'set -a; source /etc/substrate/env; set +a; bun /workspace/scripts/concept-seed/seed-claudemd.ts'
 *
 * (Run inside the substrate container because concept-db is only on the
 *  container network without host-mapped 18260 — and we want the substrate's
 *  METABOB_API_KEY for org-scoped writes.)
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";

const CONCEPT_DB_URL = process.env.CONCEPT_DB_URL ?? "http://127.0.0.1:8260";
const API_KEY = process.env.METABOB_API_KEY ?? "";
const REPO_ROOT = process.env.REPO_ROOT ?? "/home/avi/documents/work/exp-repo/metabob-devbob";

if (!API_KEY) {
  console.error("METABOB_API_KEY not set — concept-db will reject org-scoped writes.");
  process.exit(1);
}

interface Section {
  path: string;
  heading: string;
  level: number;
  body: string;
}

interface SourceFile {
  path: string;
  source_type: "vessel_construction_pattern" | "impulse_activity_pattern";
  /** Only mint sections at H2 (##) or shallower. Deeper headings become part
   *  of the parent section's body. */
  max_level?: number;
}

/** Curated list. The skill's principle: mint per *load-bearing section*,
 *  not per paragraph. These are the docs whose H2/H3 sections carry
 *  the substrate's constitutional knowledge. */
const SOURCES: SourceFile[] = [
  { path: "CLAUDE.md", source_type: "vessel_construction_pattern", max_level: 2 },
  { path: "repos/development-vessel/CLAUDE.md", source_type: "vessel_construction_pattern", max_level: 2 },
  { path: "repos/metabob-activity-api/CLAUDE.md", source_type: "vessel_construction_pattern", max_level: 2 },
  { path: "repos/concept-db/CLAUDE.md", source_type: "vessel_construction_pattern", max_level: 2 },
  { path: "repos/metabob-mcp/CLAUDE.md", source_type: "vessel_construction_pattern", max_level: 2 },
  { path: "repos/discovery-vessel/CLAUDE.md", source_type: "vessel_construction_pattern", max_level: 2 },
  { path: "docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md", source_type: "impulse_activity_pattern", max_level: 2 },
];

function parseSections(filePath: string, maxLevel: number): Section[] {
  const absolute = resolve(REPO_ROOT, filePath);
  if (!existsSync(absolute)) {
    console.error(`  skip (missing): ${filePath}`);
    return [];
  }
  const text = readFileSync(absolute, "utf8");
  const lines = text.split("\n");
  const sections: Section[] = [];
  let currentHeading = "Preamble";
  let currentLevel = 0;
  let currentBuf: string[] = [];

  const flush = () => {
    const body = currentBuf.join("\n").trim();
    if (body.length > 50) {
      sections.push({ path: filePath, heading: currentHeading, level: currentLevel, body });
    }
  };

  for (const line of lines) {
    const m = /^(#+)\s+(.+)$/.exec(line);
    if (m && m[1]!.length <= maxLevel + 1) {
      // close previous
      flush();
      currentHeading = m[2]!.trim();
      currentLevel = m[1]!.length;
      currentBuf = [];
    } else {
      currentBuf.push(line);
    }
  }
  flush();
  return sections;
}

function shapeFromHeading(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

function summaryFromBody(body: string, fallback: string): string {
  // First non-empty paragraph, trimmed to 200 chars.
  for (const para of body.split(/\n\n+/)) {
    const p = para.trim();
    if (p.length >= 20 && !p.startsWith("```") && !p.startsWith(">") && !p.startsWith("---")) {
      return p.replace(/[\n`*_]/g, " ").slice(0, 200);
    }
  }
  return fallback.slice(0, 200);
}

async function createConcept(s: Section, sourceType: string): Promise<string | null> {
  const shape = shapeFromHeading(s.heading);
  const summary = summaryFromBody(s.body, s.heading);
  // Cap content to avoid massive concepts; embedded model's window is fine
  // but we don't want a single concept to dominate the graph.
  const content = s.body.slice(0, 4000);

  const res = await fetch(`${CONCEPT_DB_URL}/concepts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `ApiKey ${API_KEY}` },
    body: JSON.stringify({
      shape,
      source_type: sourceType,
      summary,
      content,
      pointer: { type: "memo", path: s.path, section: s.heading },
      budget: 2000,
      priority: 0.6,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`  fail: ${s.path}#${s.heading}: ${res.status} ${text.slice(0, 200)}`);
    return null;
  }
  const concept = (await res.json()) as { id?: string };
  const id = (concept.id ?? "").replace(/^concept:/, "");
  return id || null;
}

async function linkConcepts(fromId: string, toId: string, edgeType: string, desc: string): Promise<void> {
  const res = await fetch(`${CONCEPT_DB_URL}/concepts/${encodeURIComponent(fromId)}/link`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `ApiKey ${API_KEY}` },
    body: JSON.stringify({ to_concept_id: toId, edge_type: edgeType, description: desc, weight: 0.5 }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`  link fail: ${fromId} → ${toId}: ${res.status} ${text.slice(0, 100)}`);
  }
}

async function main(): Promise<void> {
  console.log(`Seeding constitutional concepts from ${SOURCES.length} files...`);
  console.log(`Target: ${CONCEPT_DB_URL}\n`);

  // Track per-file root concept (the file's first section, typically the H1).
  const fileRoots: Map<string, string> = new Map();
  const minted: Array<{ section: Section; id: string; source_type: string }> = [];

  for (const source of SOURCES) {
    console.log(`${source.path}`);
    const sections = parseSections(source.path, source.max_level ?? 2);
    console.log(`  ${sections.length} sections`);

    let rootId: string | null = null;
    for (const s of sections) {
      const id = await createConcept(s, source.source_type);
      if (!id) continue;
      minted.push({ section: s, id, source_type: source.source_type });
      if (rootId === null) rootId = id;
      console.log(`  + ${id}  ${s.heading.slice(0, 60)}`);
    }
    if (rootId) fileRoots.set(source.path, rootId);
  }

  console.log(`\nMinted ${minted.length} concepts. Wiring intra-file description_of edges...`);

  // Edge pass: every non-root section is description_of its file's root.
  let edges = 0;
  for (const m of minted) {
    const root = fileRoots.get(m.section.path);
    if (!root || root === m.id) continue;
    await linkConcepts(m.id, root, "description_of", `Section of ${m.section.path}`);
    edges++;
  }

  console.log(`Wired ${edges} intra-file edges.\n`);

  // Cross-file edges: the impulse-activity foundation is the root that
  // vessel-construction patterns derive_from. Establish that pointer.
  const foundationRoot = fileRoots.get("docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md");
  if (foundationRoot) {
    let crossEdges = 0;
    for (const [path, rootId] of fileRoots) {
      if (path === "docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md") continue;
      await linkConcepts(rootId, foundationRoot, "derived_from", `${path} construction pattern derives from the impulse/activity foundation`);
      crossEdges++;
    }
    console.log(`Wired ${crossEdges} cross-file derived_from edges to the impulse/activity foundation.\n`);
  }

  console.log("Done. Verify via mcp__metabob__concept_search({source_type: 'vessel_construction_pattern'}).");
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
