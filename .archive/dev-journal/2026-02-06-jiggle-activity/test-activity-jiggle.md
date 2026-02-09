# Activity System Test: Jiggle Documentation

## Test Objective
Test the activity system by creating and running the "jiggle-documentation" activity template.

## What is "Jiggle Documentation"?
A systematic process to organize documentation by:
1. **Analyzing** docs by last modified date
2. **Percolating** newer details backwards into foundational docs
3. **Deleting** truly obsolete documentation
4. **Creating** a summary report

## Activity Template Structure

The jiggle-documentation activity has 4 tasks:
1. `analyze-docs-by-date` - Scan and categorize docs by age
2. `percolate-content` - Move recent details to foundational docs
3. `delete-obsolete-docs` - Remove truly obsolete files (safely)
4. `create-jiggle-summary` - Create comprehensive summary

## Variables
- `scope`: "entire repo" | "docs/" | specific path
- `recentDays`: Age threshold for "recent" docs (default: 30)
- `mediumDays`: Age threshold for "medium" docs (default: 90)
- `obsoleteDays`: Age threshold for "obsolete" docs (default: 180)
- `mode`: "dryRun" | "apply" (default: dryRun for safety)
- `archiveInsteadOfDelete`: true | false (default: true)

## Test Status

✅ **Template Created**: `templates/custom/jiggle-documentation.json` exists
✅ **Template Structure**: Valid JSON with 4 tasks, proper dependencies
✅ **Template Location**: Also in built-in templates
❌ **Registration**: Requires Metabob backend (SurrealDB)
❓ **Execution**: Requires activity tool with registered template

## Next Steps

To fully test:
1. Start Metabob backend services (SurrealDB)
2. Run `python scripts/init-db.py` to seed templates
3. Register template: `opencode activity template register sync`
4. Execute: Use `activity` tool with activityId="jiggle-documentation"

## Alternative Test (Without Backend)
Could test by:
- Direct file system operations simulating activity execution
- Manual execution of each task step
- Validation of template JSON schema

