/**
 * import-operator-memory.ts — one-time seed of operator-side memory files
 * into the substrate's memoryNote store.
 *
 * Reads ~/.claude/projects/-home-avi-documents-work-exp-repo-metabob-devbob/memory/*.md,
 * parses the YAML frontmatter, and writes each note to the development-vessel
 * memoryNote_write resolver (or directly to the workspace file if the vessel
 * is not yet running).
 *
 * Idempotent: notes are upserted by id. Re-running after the substrate starts
 * is safe — existing notes are updated only if body changed.
 *
 * Run:
 *   bun /path/to/import-operator-memory.ts
 *   # or via make target after substrate is seeded:
 *   make -C scripts/substrate import-memory
 *
 * The script writes directly to WORKSPACE/memory/notes.json if
 * DEV_VESSEL_ENDPOINT is not set (offline import path).
 * When DEV_VESSEL_ENDPOINT is set, it uses the memoryNote_write HTTP resolver.
 */

import { readdir, readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { join, basename } from "node:path";
import { homedir } from "node:os";

const MEMORY_DIR = join(
  homedir(),
  ".claude/projects/-home-avi-documents-work-exp-repo-metabob-devbob/memory",
);
const WORKSPACE_DIR = process.env["WORKSPACE_DIR"] ?? join(import.meta.dir, "workspace");
const NOTES_PATH = join(WORKSPACE_DIR, "memory", "notes.json");
const DEV_VESSEL_ENDPOINT = process.env["DEV_VESSEL_ENDPOINT"] ?? "";
const IMPORT_TAG = "provenance:operator-import-2026-05-25";

interface MemoryNote {
  id: string;
  type: "finding" | "feedback" | "reference" | "project";
  title: string;
  body: string;
  provenance_trace_ids?: string[];
  confidence_weight?: number;
  pending_sync?: boolean;
  created_at: string;
  updated_at: string;
}

function parseFrontmatter(content: string): { meta: Record<string, string>; body: string } {
  const lines = content.split("\n");
  if (lines[0]?.trim() !== "---") return { meta: {}, body: content };

  const closingIdx = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
  if (closingIdx < 0) return { meta: {}, body: content };

  const frontmatterLines = lines.slice(1, closingIdx);
  const meta: Record<string, string> = {};
  for (const line of frontmatterLines) {
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim();
    const val = line.slice(colon + 1).trim();
    meta[key] = val;
  }

  const body = lines.slice(closingIdx + 1).join("\n").trim();
  return { meta, body };
}

function typeFromFilename(filename: string): MemoryNote["type"] {
  if (filename.startsWith("feedback_")) return "feedback";
  if (filename.startsWith("percolation_") || filename.startsWith("project_")) return "project";
  return "finding";
}

// Confidence weights by type — operator memory is trusted but not verified.
const CONFIDENCE_BY_TYPE: Record<MemoryNote["type"], number> = {
  feedback: 0.8,
  project: 0.6,
  finding: 0.7,
  reference: 0.7,
};

async function loadExistingNotes(): Promise<MemoryNote[]> {
  try {
    const raw = await readFile(NOTES_PATH, "utf-8");
    return JSON.parse(raw) as MemoryNote[];
  } catch {
    return [];
  }
}

async function saveNotes(notes: MemoryNote[]): Promise<void> {
  await mkdir(join(WORKSPACE_DIR, "memory"), { recursive: true });
  const tmp = NOTES_PATH + ".tmp";
  await writeFile(tmp, JSON.stringify(notes, null, 2), "utf-8");
  await rename(tmp, NOTES_PATH);
}

async function importViaHttp(note: MemoryNote): Promise<void> {
  const res = await fetch(`${DEV_VESSEL_ENDPOINT}/v2/impulses/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ impulse: { type: "memoryNote_write", note } }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`memoryNote_write HTTP ${res.status}: ${text}`);
  }
}

async function main(): Promise<void> {
  const now = new Date().toISOString();

  // Read all .md files from operator memory directory
  let files: string[] = [];
  try {
    const entries = await readdir(MEMORY_DIR, { withFileTypes: true });
    files = entries
      .filter((e) => e.isFile() && e.name.endsWith(".md") && e.name !== "MEMORY.md")
      .map((e) => e.name);
  } catch (err) {
    console.error(`[import-memory] Cannot read memory dir ${MEMORY_DIR}: ${(err as Error).message}`);
    console.error("[import-memory] Run this script from the host (not inside the container).");
    process.exit(1);
  }

  console.log(`[import-memory] Found ${files.length} operator memory files`);

  // Load existing notes for upsert logic
  const existingNotes = await loadExistingNotes();
  const byId = new Map(existingNotes.map((n) => [n.id, n]));

  let imported = 0;
  let skipped = 0;
  let updated = 0;

  for (const filename of files) {
    const content = await readFile(join(MEMORY_DIR, filename), "utf-8");
    const { meta, body } = parseFrontmatter(content);

    if (!body.trim()) { skipped++; continue; }

    const stem = basename(filename, ".md");
    const noteType = (meta["type"] as MemoryNote["type"]) ?? typeFromFilename(stem);
    const title = meta["name"] ?? stem.replace(/_/g, " ");
    const id = `operator-import:${stem}`;

    const note: MemoryNote = {
      id,
      type: noteType,
      title,
      body,
      provenance_trace_ids: [IMPORT_TAG],
      confidence_weight: CONFIDENCE_BY_TYPE[noteType],
      pending_sync: false,
      created_at: now,
      updated_at: now,
    };

    const existing = byId.get(id);
    if (existing?.body === body) {
      skipped++;
      continue;
    }
    if (existing) {
      note.created_at = existing.created_at;
      updated++;
    } else {
      imported++;
    }

    if (DEV_VESSEL_ENDPOINT) {
      try {
        await importViaHttp(note);
      } catch (err) {
        console.warn(`[import-memory] HTTP write failed for ${id}: ${(err as Error).message}`);
        // Fall through to direct write
        byId.set(id, note);
      }
    } else {
      byId.set(id, note);
    }
  }

  // If not using HTTP, write the collected notes to disk
  if (!DEV_VESSEL_ENDPOINT) {
    const merged = Array.from(byId.values());
    await saveNotes(merged);
    console.log(`[import-memory] Wrote ${merged.length} notes to ${NOTES_PATH}`);
  }

  console.log(`[import-memory] Done. imported=${imported} updated=${updated} skipped=${skipped}`);
}

await main();
