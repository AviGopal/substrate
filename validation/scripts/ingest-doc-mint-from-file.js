#!/usr/bin/env bun
"use strict";
/**
 * ingest-doc-mint-from-file — Phase B of the doc-ingestion pipeline.
 *
 * Reads a JSON array of concept-shaped entries (produced by the
 * `ingest-doc-as-concepts` template) and POSTs each entry to concept-db's
 * /concepts endpoint with idempotency by metadata.signature.
 *
 * Idempotency: each entry's metadata.signature is `<doc_path>__<heading_slug>`.
 * Before minting, the script searches concept-db for any concept with that
 * signature in its summary or metadata; if found, skip.
 *
 * Spec: openspec/changes/2026-05-30-doc-ingestion-and-concept-management/
 *
 * Usage:
 *   bun validation/scripts/ingest-doc-mint-from-file.ts \
 *     --file /home/avi/.../scripts/substrate/workspace/concept-ingest/sections-latest.json
 *
 * Auth: reads METABOB_API_KEY from ~/.metabob/config.json.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = require("node:fs/promises");
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
const CONCEPT_DB_URL = process.env.CONCEPT_DB_URL || "http://127.0.0.1:18260";
async function loadApiKey() {
    const configPath = (0, node_path_1.join)((0, node_os_1.homedir)(), ".metabob", "config.json");
    const raw = await (0, promises_1.readFile)(configPath, "utf-8");
    const cfg = JSON.parse(raw);
    const key = cfg?.metabob?.apiKey;
    if (typeof key !== "string")
        throw new Error("METABOB_API_KEY not found in config");
    return key;
}
async function findExistingBySignature(apiKey, signature) {
    // Search concepts by the signature substring; concept-db indexes summary
    // and content but not metadata directly, so we list and filter in-script.
    // A targeted query path would be a future concept-db enhancement.
    const url = `${CONCEPT_DB_URL}/concepts/search?limit=500`;
    const resp = await fetch(url, {
        headers: { Authorization: `ApiKey ${apiKey}` },
    });
    if (!resp.ok)
        return null;
    const body = (await resp.json());
    for (const c of body.concepts ?? []) {
        if (c.pointer?.metadata?.signature === signature)
            return c.id;
    }
    return null;
}
async function mintConcept(apiKey, section) {
    const existing = await findExistingBySignature(apiKey, section.metadata.signature);
    if (existing)
        return { minted: false, id: existing, skipped: true };
    const resp = await fetch(`${CONCEPT_DB_URL}/concepts`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `ApiKey ${apiKey}`,
        },
        body: JSON.stringify(section),
    });
    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`POST /concepts ${resp.status}: ${text.slice(0, 200)}`);
    }
    const body = (await resp.json());
    return { minted: true, id: body.id };
}
function stripFences(text) {
    return text.replace(/^```(?:json|JSON)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
}
async function main() {
    const args = process.argv.slice(2);
    let filePath;
    for (let i = 0; i < args.length; i++) {
        if (args[i] === "--file" && i + 1 < args.length)
            filePath = args[i + 1];
    }
    if (!filePath) {
        console.error("usage: ingest-doc-mint-from-file --file <path>");
        process.exit(2);
    }
    const apiKey = await loadApiKey();
    const raw = stripFences(await (0, promises_1.readFile)(filePath, "utf-8"));
    let entries;
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed))
            throw new Error("expected a JSON array at the file root");
        entries = parsed;
    }
    catch (err) {
        console.error(`failed to parse ${filePath}: ${err.message}`);
        process.exit(1);
    }
    let minted = 0;
    let skipped = 0;
    let failed = 0;
    for (const section of entries) {
        if (!section?.metadata?.signature) {
            console.warn(`skipping entry without metadata.signature: ${JSON.stringify(section).slice(0, 80)}`);
            failed++;
            continue;
        }
        try {
            const r = await mintConcept(apiKey, section);
            if (r.skipped) {
                skipped++;
                console.log(`SKIP ${section.metadata.heading_slug} -> ${r.id} (signature match)`);
            }
            else {
                minted++;
                console.log(`MINT ${section.metadata.heading_slug} -> ${r.id}`);
            }
        }
        catch (err) {
            failed++;
            console.error(`FAIL ${section.metadata?.heading_slug ?? "?"}: ${err.message}`);
        }
    }
    console.log(JSON.stringify({ minted, skipped, failed, total: entries.length }));
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=ingest-doc-mint-from-file.js.map