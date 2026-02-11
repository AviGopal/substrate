# Project ID Fix - Complete

## Problem

Previously, the admin CLI was generating random project IDs like `proj_2770097f339d` and organization IDs like `org_3d81e2afde6e`, which didn't match the client-configured IDs like `exp-repo-dev`.

## Solution

Modified the admin CLI to:
1. Accept explicit `--project-id` and `--org-id` parameters
2. Default to using the name as the ID if not provided
3. No longer generate random UUIDs with prefixes

## Changes Made

### 1. Organization Creation (`admin/commands/orgs.py`)

**Before:**
```python
@orgs.command("create")
@click.argument("name")
@click.option("--seat-limit", default=5, help="Maximum number of members")
async def create_org(name, seat_limit):
    org_id = f"org_{uuid.uuid4().hex[:12]}"  # Generated random ID
```

**After:**
```python
@orgs.command("create")
@click.argument("name")
@click.option("--org-id", help="Organization ID (uses name if not provided)")
@click.option("--seat-limit", default=5, help="Maximum number of members")
async def create_org(name, org_id, seat_limit):
    if not org_id:
        org_id = name  # Use name as ID
```

### 2. Project Creation (`admin/commands/projects.py`)

**Before:**
```python
@projects.command("create")
@click.argument("name")
@click.option("--org-id", required=True, help="Organization ID")
@click.option("--description", help="Project description")
async def create_project(name, org_id, description):
    project_id = f"proj_{uuid.uuid4().hex[:12]}"  # Generated random ID
```

**After:**
```python
@projects.command("create")
@click.argument("name")
@click.option("--org-id", required=True, help="Organization ID")
@click.option("--project-id", help="Project ID (uses name if not provided)")
@click.option("--description", help="Project description")
async def create_project(name, org_id, project_id, description):
    if not project_id:
        project_id = name  # Use name as ID
```

## New Database State

### Organization
```
Org ID:      exp-repo
Name:        exp-repo
Members:     0
Seat Limit:  10
```

### Project
```
Project ID:   exp-repo-dev
Name:         exp-repo-dev
Org ID:       exp-repo
Codebases:    0
Description:  Experimental repository development project
```

## Configuration Alignment

Now all client configurations are perfectly aligned:

**Host OpenCode** (`~/.opencode/opencode.json`):
```json
{
  "metabob": {
    "project_id": "exp-repo-dev"  ✅ Matches database
  }
}
```

**DevBob OpenCode** (`configs/opencode.devbob.json`):
```json
{
  "metabob": {
    "project_id": "exp-repo-dev"  ✅ Matches database
  }
}
```

**metabob-cli** (`.metabob/config.json`):
```json
{
  "project_id": "exp-repo-dev"  ✅ Matches database
}
```

## Session Creation Flow

When a client creates a session:

1. **Client sends**: `{ "project": "exp-repo-dev" }`
2. **Session route receives**: `project_id = "exp-repo-dev"`
3. **Database lookup**: Finds project with `project_id = "exp-repo-dev"` ✅
4. **No mismatch**: Everything works correctly

## Usage Examples

### Create Organization with Specific ID
```bash
./admin-cli.sh orgs create "My Org" --org-id my-org --seat-limit 10
# Creates: org_id = "my-org"
```

### Create Organization (ID defaults to name)
```bash
./admin-cli.sh orgs create my-org --seat-limit 10
# Creates: org_id = "my-org"
```

### Create Project with Specific ID
```bash
./admin-cli.sh projects create "My Project" \
  --org-id my-org \
  --project-id my-project \
  --description "My project description"
# Creates: project_id = "my-project"
```

### Create Project (ID defaults to name)
```bash
./admin-cli.sh projects create my-project --org-id my-org
# Creates: project_id = "my-project"
```

## Benefits

✅ **Predictable IDs**: No more random strings
✅ **Client Alignment**: IDs match client configurations exactly
✅ **Human Readable**: IDs are meaningful and easy to reference
✅ **Flexibility**: Can still specify custom IDs when needed
✅ **No Migration Needed**: Old projects with random IDs still work

## Verification

```bash
cd repos/metabob-rpc-api

# List organizations
SURREAL_USER=local SURREAL_PASS=testing SURREAL_DATABASE=development \
  ./admin-cli.sh orgs list

# List projects
SURREAL_USER=local SURREAL_PASS=testing SURREAL_DATABASE=development \
  ./admin-cli.sh projects list

# Get project details
SURREAL_USER=local SURREAL_PASS=testing SURREAL_DATABASE=development \
  ./admin-cli.sh projects get exp-repo-dev
```

## Testing

When a session is created with the configured `project_id`, it should now correctly match the database:

```bash
# Create session with project_id
curl -X POST http://localhost:8080/session \
  -H "Content-Type: application/json" \
  -d '{"project": "exp-repo-dev"}'

# The session will use project_id = "exp-repo-dev"
# Which matches the actual project in the database ✅
```

## Status

✅ Admin CLI updated (orgs and projects)
✅ Database recreated with clean IDs
✅ Organization: `exp-repo`
✅ Project: `exp-repo-dev`
✅ All client configs already aligned
✅ No additional configuration changes needed

**The project ID system now works exactly as expected!**
