#!/usr/bin/env bun
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
export {};
//# sourceMappingURL=ingest-doc-mint-from-file.d.ts.map