#!/usr/bin/env bun
/**
 * Seed useful activity templates for vessel development
 * These templates help MiniBob create proper TypeScript modules with Bun APIs
 */

const API_URL = process.env.API_URL || 'http://localhost:9081';

interface TemplateTask {
  id: string;
  subagent: string;
  description: string;
  dependencies: string[];
  prompt: {
    template: string;
    maxTokens?: number;
    variables?: Array<{ name: string; type: string; required: boolean }>;
  };
  validation?: {
    requiredFiles?: string[];
    requiredPatterns?: Array<{ file: string; pattern: string }>;
  };
  retry?: {
    maxAttempts: number;
    strategy: string;
  };
}

interface Template {
  variant_id: string;
  activity_id: string;
  variant_name: string;
  description: string;
  category: 'feature' | 'bugfix' | 'refactor' | 'tool' | 'infrastructure';
  task_steps: TemplateTask[];
  scope: 'global';
}

const templates: Template[] = [
  // Template 1: Create TypeScript file with Bun APIs
  {
    variant_id: 'create-ts-file-bun-v1',
    activity_id: 'vessel-create-file',
    variant_name: 'Create TypeScript File (Bun)',
    description: 'Create a new TypeScript file using Bun APIs instead of Node.js. Used for vessel development.',
    category: 'feature',
    scope: 'global',
    task_steps: [
      {
        id: 'create-file',
        subagent: 'code-writer',
        description: 'Create the TypeScript file with proper structure',
        dependencies: [],
        prompt: {
          template: `Create a TypeScript file at the specified path.

CRITICAL RULES:
1. Use Bun APIs, NOT Node.js APIs:
   - Use Bun.file() instead of fs.readFileSync()
   - Use Bun.write() instead of fs.writeFileSync()
   - Use Bun.spawn() instead of child_process.exec()
2. Use .js extensions in imports (e.g., './types.js')
3. Add JSDoc comments to exported functions
4. Keep the file focused and under 100 lines if possible
5. Export types and functions explicitly

Path: {{filePath}}
Purpose: {{purpose}}
Exports: {{exports}}

Create the file now using the write tool.`,
          maxTokens: 4096,
          variables: [
            { name: 'filePath', type: 'string', required: true },
            { name: 'purpose', type: 'string', required: true },
            { name: 'exports', type: 'string', required: false },
          ],
        },
        validation: {
          requiredFiles: ['{{filePath}}'],
          requiredPatterns: [{ file: '{{filePath}}', pattern: 'export' }],
        },
        retry: { maxAttempts: 2, strategy: 'progressive-context' },
      },
    ],
  },

  // Template 2: Create barrel export (index.ts)
  {
    variant_id: 'create-barrel-export-v1',
    activity_id: 'vessel-create-index',
    variant_name: 'Create Barrel Export',
    description: 'Create or update an index.ts file to re-export modules from a directory',
    category: 'feature',
    scope: 'global',
    task_steps: [
      {
        id: 'scan-modules',
        subagent: 'code-reader',
        description: 'List existing modules in the directory',
        dependencies: [],
        prompt: {
          template: `List all TypeScript files in {{directory}} that should be exported.
Exclude: test files, .d.ts files, index.ts itself.
Output the list of modules found.`,
          maxTokens: 1024,
          variables: [{ name: 'directory', type: 'string', required: true }],
        },
        retry: { maxAttempts: 1, strategy: 'simple' },
      },
      {
        id: 'create-index',
        subagent: 'code-writer',
        description: 'Create the index.ts with all exports',
        dependencies: ['scan-modules'],
        prompt: {
          template: `Create {{directory}}/index.ts with exports from all modules found.

Rules:
1. Use 'export * from' for re-exporting everything
2. Use 'export { specific } from' if only specific items should be public
3. Use .js extensions in import paths
4. Add a header comment describing the module
5. Keep exports alphabetically sorted

Create the index.ts file now.`,
          maxTokens: 2048,
          variables: [{ name: 'directory', type: 'string', required: true }],
        },
        validation: {
          requiredFiles: ['{{directory}}/index.ts'],
          requiredPatterns: [{ file: '{{directory}}/index.ts', pattern: 'export' }],
        },
        retry: { maxAttempts: 2, strategy: 'simple' },
      },
    ],
  },

  // Template 3: Implement stub function
  {
    variant_id: 'implement-stub-function-v1',
    activity_id: 'vessel-implement-stub',
    variant_name: 'Implement Stub Function',
    description: 'Replace a throw new Error("Not implemented") stub with actual implementation',
    category: 'feature',
    scope: 'global',
    task_steps: [
      {
        id: 'read-context',
        subagent: 'code-reader',
        description: 'Read the file and understand the stub context',
        dependencies: [],
        prompt: {
          template: `Read {{filePath}} and find the stub function {{functionName}}.
Analyze:
1. The function signature and return type
2. Related types and interfaces
3. How the function is expected to be used
4. Any similar implemented functions for reference`,
          maxTokens: 2048,
          variables: [
            { name: 'filePath', type: 'string', required: true },
            { name: 'functionName', type: 'string', required: true },
          ],
        },
        retry: { maxAttempts: 1, strategy: 'simple' },
      },
      {
        id: 'implement',
        subagent: 'code-writer',
        description: 'Replace the stub with actual implementation',
        dependencies: ['read-context'],
        prompt: {
          template: `Implement the {{functionName}} function in {{filePath}}.

Requirements:
1. Replace the 'throw new Error' stub with working code
2. Use Bun APIs if file/process operations needed
3. Handle errors appropriately
4. Match the existing code style
5. Keep implementation focused and simple

Edit the file to implement the function.`,
          maxTokens: 4096,
          variables: [
            { name: 'filePath', type: 'string', required: true },
            { name: 'functionName', type: 'string', required: true },
          ],
        },
        validation: {
          requiredPatterns: [
            { file: '{{filePath}}', pattern: '{{functionName}}' },
          ],
        },
        retry: { maxAttempts: 2, strategy: 'progressive-context' },
      },
    ],
  },

  // Template 4: Add type definitions
  {
    variant_id: 'add-type-definitions-v1',
    activity_id: 'vessel-add-types',
    variant_name: 'Add Type Definitions',
    description: 'Create or extend TypeScript type definitions in a types file',
    category: 'feature',
    scope: 'global',
    task_steps: [
      {
        id: 'analyze-existing',
        subagent: 'code-reader',
        description: 'Read existing types if any',
        dependencies: [],
        prompt: {
          template: `Check if {{typesFile}} exists and read its contents.
If it exists, list the existing types to avoid conflicts.
If it doesn't exist, note that we'll create it fresh.`,
          maxTokens: 2048,
          variables: [{ name: 'typesFile', type: 'string', required: true }],
        },
        retry: { maxAttempts: 1, strategy: 'simple' },
      },
      {
        id: 'add-types',
        subagent: 'code-writer',
        description: 'Add the new type definitions',
        dependencies: ['analyze-existing'],
        prompt: {
          template: `Add type definitions to {{typesFile}}.

Types to add: {{typeDescriptions}}

Rules:
1. Use interface for object shapes, type for unions/primitives
2. Export all types
3. Add JSDoc comments explaining each type
4. Use discriminated unions where appropriate
5. If file exists, add to it; otherwise create new file

Create or edit the types file now.`,
          maxTokens: 4096,
          variables: [
            { name: 'typesFile', type: 'string', required: true },
            { name: 'typeDescriptions', type: 'string', required: true },
          ],
        },
        validation: {
          requiredFiles: ['{{typesFile}}'],
          requiredPatterns: [{ file: '{{typesFile}}', pattern: 'export' }],
        },
        retry: { maxAttempts: 2, strategy: 'progressive-context' },
      },
    ],
  },

  // Template 5: Cleanup development artifacts
  {
    variant_id: 'cleanup-dev-artifacts-v1',
    activity_id: 'vessel-cleanup',
    variant_name: 'Cleanup Development Artifacts',
    description: 'Remove temporary files, test outputs, and development debris',
    category: 'tool',
    scope: 'global',
    task_steps: [
      {
        id: 'find-artifacts',
        subagent: 'code-reader',
        description: 'List files that look like development artifacts',
        dependencies: [],
        prompt: {
          template: `In {{directory}}, find files that appear to be development artifacts:
- Files named hello.*, test_*, temp_*, *_test.*
- Files with .tmp, .bak extensions
- Empty files
- Files not referenced by any imports

List what you find.`,
          maxTokens: 2048,
          variables: [{ name: 'directory', type: 'string', required: true }],
        },
        retry: { maxAttempts: 1, strategy: 'simple' },
      },
      {
        id: 'cleanup',
        subagent: 'code-writer',
        description: 'Remove the identified artifacts',
        dependencies: ['find-artifacts'],
        prompt: {
          template: `Remove the development artifacts identified in {{directory}}.

Rules:
1. Only remove files that are clearly temporary
2. Do NOT remove any file that is imported by other code
3. Do NOT remove test files in a proper test/ directory
4. Use git rm if files are tracked, otherwise regular rm
5. Report what was removed

Clean up the artifacts now.`,
          maxTokens: 2048,
          variables: [{ name: 'directory', type: 'string', required: true }],
        },
        retry: { maxAttempts: 1, strategy: 'simple' },
      },
    ],
  },

  // Template 6: Fix TypeScript errors
  {
    variant_id: 'fix-typescript-errors-v1',
    activity_id: 'vessel-fix-types',
    variant_name: 'Fix TypeScript Errors',
    description: 'Run typecheck and fix any TypeScript compilation errors',
    category: 'bugfix',
    scope: 'global',
    task_steps: [
      {
        id: 'run-typecheck',
        subagent: 'code-runner',
        description: 'Run TypeScript compiler to find errors',
        dependencies: [],
        prompt: {
          template: `Run 'bun run typecheck' or 'bunx tsc --noEmit' in {{directory}}.
Capture all TypeScript errors.
List each error with file, line, and message.`,
          maxTokens: 4096,
          variables: [{ name: 'directory', type: 'string', required: true }],
        },
        retry: { maxAttempts: 1, strategy: 'simple' },
      },
      {
        id: 'fix-errors',
        subagent: 'code-writer',
        description: 'Fix each TypeScript error',
        dependencies: ['run-typecheck'],
        prompt: {
          template: `Fix the TypeScript errors found in {{directory}}.

For each error:
1. Read the file context around the error
2. Understand what the type system expects
3. Fix with minimal changes
4. Prefer explicit types over 'any'

Fix all errors now.`,
          maxTokens: 8192,
          variables: [{ name: 'directory', type: 'string', required: true }],
        },
        retry: { maxAttempts: 3, strategy: 'progressive-context' },
      },
      {
        id: 'verify-fix',
        subagent: 'code-runner',
        description: 'Verify all errors are fixed',
        dependencies: ['fix-errors'],
        prompt: {
          template: `Run typecheck again in {{directory}} to verify all errors are fixed.
If errors remain, report them.`,
          maxTokens: 2048,
          variables: [{ name: 'directory', type: 'string', required: true }],
        },
        retry: { maxAttempts: 1, strategy: 'simple' },
      },
    ],
  },
];

async function seedTemplate(template: Template): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/v2/activities/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(template),
    });

    const result = await response.json();

    if (response.ok) {
      console.log(`✓ Seeded: ${template.variant_name}`);
      return true;
    } else if (response.status === 409) {
      console.log(`○ Already exists: ${template.variant_name}`);
      return true;
    } else {
      console.error(`✗ Failed to seed ${template.variant_name}:`, result);
      return false;
    }
  } catch (error) {
    console.error(`✗ Error seeding ${template.variant_name}:`, error);
    return false;
  }
}

async function main() {
  console.log(`Seeding ${templates.length} vessel development templates to ${API_URL}\n`);

  let success = 0;
  let failed = 0;

  for (const template of templates) {
    if (await seedTemplate(template)) {
      success++;
    } else {
      failed++;
    }
  }

  console.log(`\nDone: ${success} succeeded, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
