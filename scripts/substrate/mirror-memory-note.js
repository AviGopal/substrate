"use strict";
/**
 * mirror-memory-note.ts — mirror a single operator memory file into the
 * substrate's memoryNote store. Called by the substrate-memory-mirror
 * PostToolUse hook, but also runnable by hand:
 *
 *   DEV_VESSEL_ENDPOINT=http://localhost:18090 bun mirror-memory-note.ts <file.md>
 *
 * Id scheme matches import-operator-memory.ts (`operator-import:<stem>`) so a
 * later edit upserts the same note rather than creating a duplicate. Provenance
 * is tagged `harness-mirror` to distinguish hook-written notes from the one-shot
 * import. Fail-open: any error is logged to stderr and the process exits 0 — a
 * memory mirror must never break the caller.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const DEV_VESSEL_ENDPOINT = process.env["DEV_VESSEL_ENDPOINT"] ?? "http://localhost:18090";
function parseFrontmatter(content) {
    const lines = content.split("\n");
    if (lines[0]?.trim() !== "---")
        return { meta: {}, body: content };
    const closingIdx = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
    if (closingIdx < 0)
        return { meta: {}, body: content };
    const meta = {};
    for (const line of lines.slice(1, closingIdx)) {
        const colon = line.indexOf(":");
        if (colon < 0)
            continue;
        meta[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
    }
    return { meta, body: lines.slice(closingIdx + 1).join("\n").trim() };
}
function typeFromFilename(stem) {
    if (stem.startsWith("feedback_"))
        return "feedback";
    if (stem.startsWith("percolation_") || stem.startsWith("project_"))
        return "project";
    if (stem.startsWith("reference_"))
        return "reference";
    return "finding";
}
const CONFIDENCE = { feedback: 0.8, project: 0.6, finding: 0.7, reference: 0.7 };
async function main() {
    const filePath = process.argv[2];
    if (!filePath) {
        console.error("[mirror-memory-note] usage: bun mirror-memory-note.ts <file.md>");
        process.exit(0);
    }
    let content;
    try {
        content = await (0, promises_1.readFile)(filePath, "utf-8");
    }
    catch (err) {
        console.error(`[mirror-memory-note] cannot read ${filePath}: ${err.message}`);
        process.exit(0);
    }
    const { meta, body } = parseFrontmatter(content);
    if (!body.trim()) {
        console.error(`[mirror-memory-note] ${filePath} has empty body; skipping`);
        process.exit(0);
    }
    const stem = (0, node_path_1.basename)(filePath, ".md");
    const type = meta["type"] ?? typeFromFilename(stem);
    const title = meta["name"] ?? stem.replace(/_/g, " ");
    const id = `operator-import:${stem}`;
    const note = {
        id,
        type,
        title,
        body,
        provenance_trace_ids: ["harness-mirror"],
        confidence_weight: CONFIDENCE[type] ?? 0.7,
        pending_sync: false,
    };
    try {
        const res = await fetch(`${DEV_VESSEL_ENDPOINT}/v2/impulses/resolve`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ impulse: { type: "memoryNote_write", note } }),
        });
        if (!res.ok) {
            console.error(`[mirror-memory-note] ${id}: HTTP ${res.status} ${await res.text()}`);
            process.exit(0);
        }
        const json = (await res.json());
        console.error(`[mirror-memory-note] ${id}: ${json?.body?.action ?? "ok"}`);
    }
    catch (err) {
        console.error(`[mirror-memory-note] ${id}: ${err.message} (substrate down? fail-open)`);
    }
    process.exit(0);
}
await main();
//# sourceMappingURL=mirror-memory-note.js.map