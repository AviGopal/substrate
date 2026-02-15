-- Test if changing TYPE array to TYPE array<object> fixes the issue

-- First, check current schema
INFO FOR TABLE activity_executions;

-- Try to manually fix the schema
DEFINE FIELD impulses_used ON activity_executions TYPE array<object> DEFAULT [];
DEFINE FIELD component_changes ON activity_executions TYPE array<object> DEFAULT [];

-- Verify it changed
INFO FOR TABLE activity_executions;
