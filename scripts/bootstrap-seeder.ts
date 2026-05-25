#!/usr/bin/env bun
/**
 * bootstrap-seeder.ts — seed shared activity templates into activity-api.
 *
 * Reads SHARED_TEMPLATES from @avigopal/ias-executor-ts (built at
 * /vessels/ias-executor-ts) and UPSERTs each template via
 * POST /v2/activities/templates. The endpoint is idempotent (UPSERT
 * semantics in SurrealDB), so re-running on every substrate restart is safe.
 *
 * Environment variables (from /etc/substrate/env):
 *   METABOB_API_KEY      — API key for activity-api auth
 *   METABOB_ENDPOINT     — activity-api base URL (default: http://127.0.0.1:8080)
 *
 * Exits 0 on success, non-zero on fatal error.
 *
 * Spec: openspec/changes/2026-05-23-substrate-explicit-vessels tasks.md §Phase 3
 */

import { SHARED_TEMPLATES } from "/vessels/ias-executor-ts/src/templates/index";

const ENDPOINT = process.env.METABOB_ENDPOINT ?? "http://127.0.0.1:8080";
const API_KEY = process.env.METABOB_API_KEY ?? "";

const TEMPLATES_URL = `${ENDPOINT}/v2/activities/templates`;
const HEALTH_URL = `${ENDPOINT}/health`;

const log = {
  info: (...args: unknown[]) => console.log("[bootstrap-seeder]", ...args),
  warn: (...args: unknown[]) => console.warn("[bootstrap-seeder]", ...args),
  error: (...args: unknown[]) => console.error("[bootstrap-seeder]", ...args),
};

if (!API_KEY) {
  log.error("METABOB_API_KEY must be set");
  process.exit(1);
}

/** Wait for activity-api /health to return 200 (max 60s). */
async function waitForApi(maxMs = 60_000): Promise<void> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(5_000) });
      if (r.ok) return;
    } catch {
      // not ready yet
    }
    await Bun.sleep(2_000);
  }
  throw new Error(`activity-api not ready after ${maxMs}ms at ${HEALTH_URL}`);
}

/**
 * POST one template to activity-api.
 * Uses POST /v2/activities/templates which performs an UPSERT — idempotent
 * across substrate restarts.
 */
async function seedTemplate(template: (typeof SHARED_TEMPLATES)[number]): Promise<void> {
  const response = await fetch(TEMPLATES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `ApiKey ${API_KEY}`,
    },
    body: JSON.stringify(template),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "(no body)");
    throw new Error(
      `POST /v2/activities/templates returned ${response.status} for template '${template.id}': ${body}`,
    );
  }
}

async function main(): Promise<void> {
  log.info(`Waiting for activity-api at ${ENDPOINT}…`);
  await waitForApi();
  log.info(`activity-api ready. Seeding ${SHARED_TEMPLATES.length} shared templates…`);

  let seeded = 0;
  let failed = 0;

  for (const template of SHARED_TEMPLATES) {
    try {
      await seedTemplate(template);
      seeded++;
      log.info(`  ✓ ${template.id}`);
    } catch (err) {
      failed++;
      log.warn(`  ✗ ${template.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (failed > 0) {
    log.warn(`Seeding complete: ${seeded} seeded, ${failed} failed.`);
    // Non-zero exit so systemd marks the unit as failed and journald captures it.
    process.exit(1);
  }

  log.info(`Seeding complete: ${seeded}/${SHARED_TEMPLATES.length} templates seeded.`);
  process.exit(0);
}

main().catch((err) => {
  log.error("Fatal:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
