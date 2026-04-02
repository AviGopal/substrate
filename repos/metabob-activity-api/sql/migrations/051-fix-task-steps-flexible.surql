-- Migration: Add task_steps nested field definitions to activity_template
-- Issue: Migration 040 added nested fields to activity_registry but not activity_template
-- Solution: Add the same nested field definitions to activity_template table

-- Task step array element fields (matching migration 040 but for activity_template)
DEFINE FIELD IF NOT EXISTS task_steps.*.id ON activity_template TYPE string;
DEFINE FIELD IF NOT EXISTS task_steps.*.description ON activity_template TYPE string;
DEFINE FIELD IF NOT EXISTS task_steps.*.subagent ON activity_template TYPE option<string>;
DEFINE FIELD IF NOT EXISTS task_steps.*.prompt ON activity_template TYPE option<object>;
DEFINE FIELD IF NOT EXISTS task_steps.*.prompt.template ON activity_template TYPE option<string>;
DEFINE FIELD IF NOT EXISTS task_steps.*.prompt.maxTokens ON activity_template TYPE option<int>;
DEFINE FIELD IF NOT EXISTS task_steps.*.prompt.compressionStrategy ON activity_template TYPE option<string>;
DEFINE FIELD IF NOT EXISTS task_steps.*.prompt.variables ON activity_template TYPE option<array>;
DEFINE FIELD IF NOT EXISTS task_steps.*.prompt.variables.* ON activity_template TYPE any;
DEFINE FIELD IF NOT EXISTS task_steps.*.dependencies ON activity_template TYPE option<array<string>>;
DEFINE FIELD IF NOT EXISTS task_steps.*.validation ON activity_template TYPE option<object>;
DEFINE FIELD IF NOT EXISTS task_steps.*.validation.requiredFiles ON activity_template TYPE option<array<string>>;
DEFINE FIELD IF NOT EXISTS task_steps.*.validation.requiredPatterns ON activity_template TYPE option<array>;
DEFINE FIELD IF NOT EXISTS task_steps.*.validation.forbiddenPatterns ON activity_template TYPE option<array>;
DEFINE FIELD IF NOT EXISTS task_steps.*.validation.commands ON activity_template TYPE option<array>;
DEFINE FIELD IF NOT EXISTS task_steps.*.retry ON activity_template TYPE option<object>;
DEFINE FIELD IF NOT EXISTS task_steps.*.retry.maxAttempts ON activity_template TYPE option<int>;
DEFINE FIELD IF NOT EXISTS task_steps.*.retry.strategy ON activity_template TYPE option<string>;
