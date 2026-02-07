# Project Setup Complete - Shared Backend Configuration

## ✅ Status Summary

Successfully configured a unified Metabob environment with:
- **Backend Server**: Running on http://localhost:8080
- **SurrealDB**: Running with fresh database
- **Organization**: `exp-repo` (ID: `org_3d81e2afde6e`)
- **Project**: `exp-repo-dev` (ID: `proj_2770097f339d`)

## 🏗️ Infrastructure

### Backend Services (Running)
```
✅ API Server:  http://localhost:8080
✅ SurrealDB:   ws://localhost:8000  (user: local, db: development)
✅ Redis:       redis://localhost:6379
✅ Worker:      Celery worker running
```

### Organization & Project
```
Organization
├─ Name: exp-repo
├─ ID: org_3d81e2afde6e
├─ Seat Limit: 10
└─ Members: 0

Project
├─ Name: exp-repo-dev
├─ ID: proj_2770097f339d
├─ Organization: org_3d81e2afde6e
├─ Description: Experimental repository development project
└─ Codebases: 0
```

## 📋 Configuration Files

### Host Machine (Local Development)

**OpenCode Config**: `~/.opencode/opencode.json`
```json
{
  "metabob": {
    "enabled": true,
    "base_url": "http://localhost:8080",
    "project_id": "proj_2770097f339d",
    "cli_path": "metabob-cli"
  }
}
```

**metabob-cli Config**: `repos/metabob-cli/.metabob/config.json`
```json
{
    "base_url": "http://localhost:8080",
    "project_id": "proj_2770097f339d",
    "state_directory": ".metabob",
    "watch_files": true,
    "batch_size": 5
}
```

### DevBob Containers

**OpenCode Config**: `configs/opencode.devbob.json`
```json
{
  "metabob": {
    "enabled": true,
    "base_url": "http://host.docker.internal:8080",
    "project_id": "proj_2770097f339d",
    "cli_path": "metabob-cli",
    "enable_cli_mcp": true
  }
}
```

## 🌐 API Documentation

The API documentation is available at: http://localhost:8080/docs

### Available Endpoints

**Organizations**
- `POST /auth/admin/provision/organization` - Create organization
- `GET /costs/organization` - Get organization costs

**Projects**
- `GET /api/projects/{project_id}/stats` - Get project statistics
- `GET /api/projects/{project_id}/problems` - Get code problems
- `GET /api/projects/{project_id}/annotations` - Get component annotations
- `POST /api/projects/{project_id}/snapshot` - Create code snapshot
- `POST /api/projects/{project_id}/sync` - Sync project data

**Activities**
- `POST /activities` - Create activity
- `GET /activities` - List activities
- `GET /activities/stats` - Get activity statistics
- `POST /activities/{activity_id}/outcome` - Record activity outcome

**Analysis**
- `POST /repository/submit` - Submit repository for analysis
- `POST /api/analyze` - Analyze code
- `GET /metrics` - Get analysis metrics

## 🔧 Admin CLI Usage

The admin CLI provides direct database access:

```bash
cd repos/metabob-rpc-api

# Set credentials
export SURREAL_USER=local
export SURREAL_PASS=testing
export SURREAL_DATABASE=development

# List organizations
./admin-cli.sh orgs list

# List projects
./admin-cli.sh projects list

# Get project details
./admin-cli.sh projects get proj_2770097f339d

# Database queries
./admin-cli.sh db query "SELECT * FROM projects"
```

## 🚀 Quick Start Guide

### 1. Start Backend Services

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-rpc-api
./dev.sh start
```

### 2. Verify Services

```bash
# Check API health
curl http://localhost:8080/

# Check SurrealDB
curl http://localhost:8000/health

# Run configuration tests
cd /home/avi/documents/work/exp-repo/metabob-devbob
./TEST_SHARED_BACKEND.sh
```

### 3. Update Configs (Optional)

If you need to update configurations with the actual project ID:

```bash
# Update host config
sed -i 's/"project_id": "exp-repo-dev"/"project_id": "proj_2770097f339d"/g' ~/.opencode/opencode.json

# Update devbob config
sed -i 's/"project_id": "exp-repo-dev"/"project_id": "proj_2770097f339d"/g' configs/opencode.devbob.json

# Update metabob-cli configs
sed -i 's/"project_id": "exp-repo-dev"/"project_id": "proj_2770097f339d"/g' repos/*/**.metabob/config.json
```

### 4. Start DevBob Containers

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
./devbob start
```

### 5. Use Locally

```bash
# metabob-cli
cd repos/metabob-cli
metabob-cli analyze --path .

# OpenCode
cd repos/metabob-opencode
opencode
```

## 📊 Database Structure

### SurrealDB Tables

The backend uses the following table structure:

```
metabob namespace
└── development database
    ├── organizations (org_*)
    ├── projects (proj_*)
    ├── activities
    ├── activity_variants
    ├── problems
    ├── annotations
    ├── snapshots
    └── metrics
```

### Query Examples

```bash
# View all projects
./admin-cli.sh db query "SELECT * FROM projects"

# View organization details
./admin-cli.sh db query "SELECT * FROM organizations WHERE id = 'org_3d81e2afde6e'"

# Count activities
./admin-cli.sh db query "SELECT count() FROM activities GROUP BY project_id"
```

## 🔍 Verification in Browser

1. **Open API Documentation**
   ```
   http://localhost:8080/docs
   ```

2. **View Available Endpoints**
   - Scroll through the Swagger UI
   - See all organization, project, and activity endpoints
   - Test endpoints directly from the UI

3. **Check Project Data**
   ```bash
   # Get project stats (requires authentication)
   curl -H "Authorization: Bearer YOUR_TOKEN" \
        http://localhost:8080/api/projects/proj_2770097f339d/stats
   ```

## 📝 Next Steps

1. **Add Codebases to Project**
   - Register each codebase (metabob-cli, metabob-rpc-api, metabob-opencode)
   - Associate them with project `proj_2770097f339d`

2. **Set Up Authentication**
   - Create API keys for programmatic access
   - Configure authentication in metabob-cli and OpenCode

3. **Test Activity Execution**
   - Run activities from host machine
   - Run same activities from DevBob containers
   - Verify they share the same project context

4. **Monitor & Analyze**
   - Track activity execution metrics
   - View code analysis results
   - Monitor cross-repository patterns

## 🎯 Success Criteria Met

✅ Backend server running and accessible
✅ SurrealDB running with clean database
✅ Organization "exp-repo" created
✅ Project "exp-repo-dev" created
✅ API documentation accessible
✅ All configurations updated with project_id
✅ Host can access via localhost:8080
✅ Containers can access via host.docker.internal:8080
✅ Ready for unified development across all codebases

---

**Environment**: exp-repo Development  
**Organization**: exp-repo (org_3d81e2afde6e)  
**Project**: exp-repo-dev (proj_2770097f339d)  
**Backend**: http://localhost:8080  
**Status**: ✅ READY
