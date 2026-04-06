#!/usr/bin/env bun
/**
 * Register Meta-Activity Templates in Production Database
 *
 * Reads meta-activity templates from JSON and inserts them into the
 * production SurrealDB `activity` table with proper schema transformation.
 */

import { readFileSync } from "fs";

const SURREALDB_URL = process.env.SURREALDB_URL || "http://localhost:8000";
const SURREALDB_USER = process.env.SURREALDB_USER || "root";
const SURREALDB_PASS = process.env.SURREALDB_PASS || "FJKokzYmiEIxGtTkrVvCI6VTaTfGR26x";
const SURREALDB_NS = process.env.SURREALDB_NS || "activity-system";
const SURREALDB_DB = process.env.SURREALDB_DB || "learning_loop";

interface TemplateTask {
  id: string;
  subagent?: string;
  description: string;
  dependencies: string[];
  impulseReferences?: string[];
  prompt: {
    template: string;
    max_tokens?: number;
  };
  validation?: {
    required_files?: string[];
    required_patterns?: Array<{ pattern: string; description: string }>;
    forbidden_patterns?: Array<{ pattern: string; description: string }>;
    commands?: Array<{ command: string; expected_exit_code: number }>;
  };
  tools?: {
    required: string[];
    optional: string[];
  };
  retry?: {
    maxAttempts: number;
    strategy: string;
  };
}

interface MetaTemplate {
  id: string;
  name: string;
  version: number;
  description: string;
  category: string;
  tags: string[];
  scope: string;
  input_shapes: string[];
  output_shapes: string[];
  variables?: Array<{
    name: string;
    type: string;
    required: boolean;
    default?: unknown;
    description: string;
  }>;
  impulses?: Array<{
    id: string;
    pointer: Record<string, unknown>;
    budget: number;
    priority: string;
    description: string;
  }>;
  tasks: TemplateTask[];
  metadata?: Record<string, unknown>;
}

interface MetaTemplatesFile {
  $schema: string;
  description: string;
  templates: MetaTemplate[];
}

/**
 * Compute tag prefixes from tags for hierarchical queries
 * e.g., "meta.activity" -> ["meta", "meta.activity"]
 */
function computeTagPrefixes(tags: string[]): string[] {
  const prefixes = new Set<string>();

  for (const tag of tags) {
    const parts = tag.split(".");
    let current = "";
    for (const part of parts) {
      current = current ? `${current}.${part}` : part;
      prefixes.add(current);
    }
  }

  return Array.from(prefixes);
}

/**
 * Transform JSON template to activity table schema
 */
function transformTemplate(template: MetaTemplate): Record<string, unknown> {
  // Map scope: "system" to "global" (schema constraint)
  const scope = template.scope === "system" ? "global" : template.scope;

  // Transform tasks - map max_tokens to maxTokens for schema compatibility
  // Also convert pattern objects to simple strings (the description is informational only)
  const tasks = template.tasks.map(task => ({
    id: task.id,
    subagent: task.subagent || "general",
    description: task.description,
    dependencies: task.dependencies,
    impulseReferences: task.impulseReferences,
    prompt: {
      template: task.prompt.template,
      maxTokens: task.prompt.max_tokens,
    },
    validation: task.validation ? {
      requiredFiles: task.validation.required_files,
      // Convert pattern objects to simple strings (schema expects string array)
      requiredPatterns: task.validation.required_patterns?.map(p =>
        typeof p === "string" ? p : p.pattern
      ),
      forbiddenPatterns: task.validation.forbidden_patterns?.map(p =>
        typeof p === "string" ? p : p.pattern
      ),
      commands: task.validation.commands,
    } : undefined,
    tools: task.tools,
    retry: task.retry,
  }));

  return {
    id: template.id,
    name: template.name,
    description: template.description,
    category: template.category,
    tags: template.tags,
    tag_prefixes: computeTagPrefixes(template.tags),
    scope,
    public: true, // System templates should be public
    execution_type: "template",
    input_shapes: template.input_shapes,
    output_shapes: template.output_shapes,
    tasks,
    org_id: "metabob", // System org
    // Store extra metadata that doesn't fit schema in a metadata field if needed
    // Note: The activity table doesn't have a general metadata field,
    // but these templates are self-contained
  };
}

/**
 * Execute SurrealQL query
 */
async function executeQuery(query: string): Promise<unknown> {
  const response = await fetch(`${SURREALDB_URL}/sql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "surreal-ns": SURREALDB_NS,
      "surreal-db": SURREALDB_DB,
      Authorization: `Basic ${Buffer.from(`${SURREALDB_USER}:${SURREALDB_PASS}`).toString("base64")}`,
    },
    body: query,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SurrealDB error: ${response.status} ${text}`);
  }

  return response.json();
}

/**
 * Insert a single activity template
 */
async function insertTemplate(template: Record<string, unknown>): Promise<{ success: boolean; id: string; error?: string }> {
  const id = template.id as string;

  // Use UPSERT to avoid duplicates
  const query = `UPSERT activity:\`${id}\` CONTENT ${JSON.stringify(template)};`;

  try {
    const result = await executeQuery(query) as Array<{ status: string; result?: unknown; detail?: string }>;

    if (result[0]?.status === "OK") {
      return { success: true, id };
    } else {
      return { success: false, id, error: result[0]?.detail || JSON.stringify(result[0]) || "Unknown error" };
    }
  } catch (error) {
    return { success: false, id, error: String(error) };
  }
}

/**
 * Main execution
 */
async function main() {
  console.log("=== Meta-Activity Template Registration ===\n");
  console.log(`Database: ${SURREALDB_URL}`);
  console.log(`Namespace: ${SURREALDB_NS}`);
  console.log(`Database: ${SURREALDB_DB}`);
  console.log();

  // Read templates file
  const templatesPath = new URL(
    "../repos/metabob-activity-api/sql/data/meta-activity-templates.json",
    import.meta.url
  ).pathname;

  console.log(`Reading templates from: ${templatesPath}\n`);

  const templatesFile: MetaTemplatesFile = JSON.parse(readFileSync(templatesPath, "utf-8"));
  console.log(`Found ${templatesFile.templates.length} templates to register\n`);

  // Transform and insert each template
  const results: Array<{ id: string; success: boolean; error?: string }> = [];

  for (const template of templatesFile.templates) {
    console.log(`Processing: ${template.id} (${template.name})`);

    const transformed = transformTemplate(template);
    const result = await insertTemplate(transformed);
    results.push(result);

    if (result.success) {
      console.log(`  [OK] Registered successfully`);
    } else {
      console.log(`  [FAIL] ${result.error}`);
    }
  }

  console.log("\n=== Registration Summary ===\n");

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`Total: ${results.length}`);
  console.log(`Successful: ${successful.length}`);
  console.log(`Failed: ${failed.length}`);

  if (successful.length > 0) {
    console.log("\nSuccessfully registered:");
    for (const r of successful) {
      console.log(`  - ${r.id}`);
    }
  }

  if (failed.length > 0) {
    console.log("\nFailed to register:");
    for (const r of failed) {
      console.log(`  - ${r.id}: ${r.error}`);
    }
  }

  // Verify by querying for meta.activity tags
  console.log("\n=== Verification ===\n");
  console.log("Querying for templates with 'meta.activity' tag...\n");

  const verifyQuery = `SELECT id, name, tags FROM activity WHERE 'meta.activity' IN tags;`;
  const verifyResult = await executeQuery(verifyQuery) as Array<{ status: string; result: Array<{ id: string; name: string; tags: string[] }> }>;

  if (verifyResult[0]?.status === "OK" && verifyResult[0].result) {
    console.log(`Found ${verifyResult[0].result.length} meta-activity templates in database:\n`);
    for (const t of verifyResult[0].result) {
      console.log(`  - ${t.id}`);
      console.log(`    Name: ${t.name}`);
      console.log(`    Tags: ${t.tags.join(", ")}`);
      console.log();
    }
  } else {
    console.log("Verification query failed or returned no results");
  }
}

main().catch(console.error);
