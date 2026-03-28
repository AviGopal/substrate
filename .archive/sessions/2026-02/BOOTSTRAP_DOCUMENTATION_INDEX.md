# Activity System Bootstrap Documentation - Index

**Last Updated**: February 16, 2026  
**Status**: Complete and Production-Ready

---

## Quick Start: I Need To...

### 🚀 Bootstrap a Fresh Installation
**→ Start Here**: [`ACTIVITY_SYSTEM_COLD_START_GUIDE.md`](./ACTIVITY_SYSTEM_COLD_START_GUIDE.md)

Choose your method:
- **Method 1 - Admin CLI** (Interactive, recommended for developers)
- **Method 2 - Python Scripts** (Automated, recommended for CI/CD)
- **Method 3 - Docker Init** (Zero-touch, recommended for production)

**Time**: 10-15 minutes  
**Result**: Fully functional activity system

---

### 🔧 Use the Admin CLI
**→ Start Here**: [`METABOB_ADMIN_CLI_GUIDE.md`](./METABOB_ADMIN_CLI_GUIDE.md)

Complete reference for:
- User management (`users` commands)
- Organization management (`orgs` commands)
- API key management (`apikeys` commands)
- Activity template management (`activities` commands)
- Database operations (`db` commands)

**Quick Commands**:
```bash
# Database stats
python -m admin.cli db stats

# List templates
python -m admin.cli activities list

# Create organization
python -m admin.cli orgs create --name "Org" --org-id "org-id"
```

---

### 📚 Understand Bootstrap Methods
**→ Start Here**: [`BOOTSTRAP_QUICK_START.md`](./BOOTSTRAP_QUICK_START.md)

Python script-based bootstrap (Method 2):
- Step 1: Create session token
- Step 2: Bootstrap core templates
- Step 3: Verify templates loaded

**Time**: 5 minutes  
**Automation**: Fully scriptable for CI/CD

---

### 📋 Review Strategy & Planning
**→ Start Here**: [`COLD_START_BOOTSTRAP_PLAN.md`](./COLD_START_BOOTSTRAP_PLAN.md)

Strategic planning document covering:
- Problem statement and goals
- Current state analysis
- Bootstrap approaches comparison
- Implementation phases
- Testing checklist
- Risk assessment

**Audience**: Technical leads, architects, platform engineers

---

## Documentation Hierarchy

```
📚 BOOTSTRAP DOCUMENTATION
│
├── 🎯 ACTIVITY_SYSTEM_COLD_START_GUIDE.md ← MASTER GUIDE
│   ├── Prerequisites and setup
│   ├── Method 1: Admin CLI (detailed procedure)
│   ├── Method 2: Python Scripts (references BOOTSTRAP_QUICK_START.md)
│   ├── Method 3: Docker Init (docker-compose integration)
│   ├── Verification procedures
│   ├── Troubleshooting (6 common issues)
│   ├── Database schema reference
│   ├── Post-bootstrap operations
│   └── Production considerations
│
├── 🔧 METABOB_ADMIN_CLI_GUIDE.md ← CLI REFERENCE
│   ├── Installation methods (3 ways)
│   ├── Command reference (8 groups)
│   ├── Common workflows (5 scenarios)
│   ├── Database management
│   └── Quick reference card
│
├── 🚀 BOOTSTRAP_QUICK_START.md ← PYTHON SCRIPTS METHOD
│   ├── 3-step bootstrap procedure
│   ├── Core templates overview (5 templates)
│   ├── Verification script
│   └── Troubleshooting
│
├── 📋 COLD_START_BOOTSTRAP_PLAN.md ← STRATEGY DOCUMENT
│   ├── Problem analysis
│   ├── Current state assessment
│   ├── Implementation phases
│   └── Testing checklist
│
├── ✅ BOOTSTRAP_VALIDATION_REPORT.md ← TEMPLATE VALIDATION
│   ├── Template quality analysis
│   ├── Schema compliance results
│   └── Recommendations
│
└── 📖 BOOTSTRAP_DOCUMENTATION_INDEX.md ← YOU ARE HERE
    └── Navigation guide and quick reference
```

---

## User Personas & Recommended Paths

### 👨‍💻 New Developer
**Goal**: Get up and running quickly

**Path**:
1. Read [`ACTIVITY_SYSTEM_COLD_START_GUIDE.md`](./ACTIVITY_SYSTEM_COLD_START_GUIDE.md) - Overview section
2. Follow Method 1 (Admin CLI) - Step-by-step
3. Run verification tests
4. Bookmark [`METABOB_ADMIN_CLI_GUIDE.md`](./METABOB_ADMIN_CLI_GUIDE.md) for daily use

**Time**: 15 minutes

---

### 🤖 DevOps Engineer
**Goal**: Automate bootstrap in CI/CD pipeline

**Path**:
1. Read [`ACTIVITY_SYSTEM_COLD_START_GUIDE.md`](./ACTIVITY_SYSTEM_COLD_START_GUIDE.md) - Method 2 section
2. Review [`BOOTSTRAP_QUICK_START.md`](./BOOTSTRAP_QUICK_START.md) for script details
3. Adapt scripts for CI/CD environment
4. Add to deployment pipeline

**Time**: 30 minutes (initial setup), then automated

---

### 🏗️ Platform Engineer
**Goal**: Production deployment with HA and security

**Path**:
1. Read [`COLD_START_BOOTSTRAP_PLAN.md`](./COLD_START_BOOTSTRAP_PLAN.md) - Strategy overview
2. Read [`ACTIVITY_SYSTEM_COLD_START_GUIDE.md`](./ACTIVITY_SYSTEM_COLD_START_GUIDE.md) - Method 3 + Production section
3. Implement Helm charts based on Docker Init example
4. Configure monitoring and backups

**Time**: 2-4 hours (initial setup), then automated

---

### 🐛 Troubleshooter
**Goal**: Fix bootstrap issues quickly

**Path**:
1. Identify symptom
2. Jump to [`ACTIVITY_SYSTEM_COLD_START_GUIDE.md`](./ACTIVITY_SYSTEM_COLD_START_GUIDE.md) - Troubleshooting section
3. Follow diagnostic steps
4. Apply fix
5. If not resolved, check [`METABOB_ADMIN_CLI_GUIDE.md`](./METABOB_ADMIN_CLI_GUIDE.md) - Troubleshooting

**Time**: 5-10 minutes per issue

---

### 👔 Product Manager / Non-Technical
**Goal**: Understand what the bootstrap system does

**Path**:
1. Read this index (you are here!)
2. Read [`ACTIVITY_SYSTEM_COLD_START_GUIDE.md`](./ACTIVITY_SYSTEM_COLD_START_GUIDE.md) - Overview section only
3. Review success criteria and metrics

**Time**: 5 minutes

---

## Quick Command Reference

### Bootstrap Commands

```bash
# === Method 1: Admin CLI ===
cd repos/metabob-rpc-api

# Database setup
python -m admin.cli orgs create --name "Org" --org-id "org-id"
python -m admin.cli users create --email "user@ex.com" --password "pass" --org-id "org-id" --role "owner"
python -m admin.cli apikeys create --name "Key" --org-id "org-id" --scopes "read,write,admin"

# Template seeding
python -m admin.cli activities seed --source ../metabob-proto/activities/bootstrap

# Verification
python -m admin.cli db stats
python -m admin.cli activities list
```

```bash
# === Method 2: Python Scripts ===
cd /path/to/metabob-devbob

# Bootstrap
python3 scripts/create_session_state.py
python3 scripts/bootstrap_core_templates.py

# Verify
curl -H "Authorization: Bearer $(cat .metabob/state | jq -r .session_metadata.session_token)" \
  http://localhost:8080/v2/activities/templates | jq '.templates | length'
```

```bash
# === Method 3: Docker Init ===
# Just start services - bootstrap happens automatically
docker-compose up -d

# Verify
docker logs metabob-db-init-1
docker exec metabob-rpc-api-server-dev-1 python -m admin.cli activities list
```

---

## Common Verification Checks

### Check Services Running
```bash
docker ps --filter name=surreal --filter name=redis --filter name=api
curl http://localhost:8080/status
```

### Check Database Populated
```bash
cd repos/metabob-rpc-api
python -m admin.cli db stats
# Expected: Organizations: 1, Users: 1, API Keys: 1, Templates: 16+
```

### Check Templates Available
```bash
cd repos/metabob-rpc-api
python -m admin.cli activities list
# Expected: 16+ templates, including activity-create, feature-impl, bug-fix, refactor
```

### Check MCP Connection
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | \
  METABOB_API_URL=http://localhost:8080 \
  METABOB_API_KEY=mb_xxx \
  METABOB_PROJECT_ID=org-id \
  metabob-cli mcp | jq '.result.tools[] | .name' | grep metabob
# Expected: metabob_search_activities, metabob_activity, etc.
```

---

## Troubleshooting Quick Links

| Issue | Document | Section |
|-------|----------|---------|
| Services won't start | [Cold-Start Guide](./ACTIVITY_SYSTEM_COLD_START_GUIDE.md) | Prerequisites |
| Org/User creation fails | [Cold-Start Guide](./ACTIVITY_SYSTEM_COLD_START_GUIDE.md) | Troubleshooting: "Organization already exists" |
| Template upload fails | [Cold-Start Guide](./ACTIVITY_SYSTEM_COLD_START_GUIDE.md) | Troubleshooting: "Template upload failed" |
| MCP returns empty | [Cold-Start Guide](./ACTIVITY_SYSTEM_COLD_START_GUIDE.md) | Troubleshooting: "MCP search_activities returns empty" |
| Activity execution fails | [Cold-Start Guide](./ACTIVITY_SYSTEM_COLD_START_GUIDE.md) | Troubleshooting: "Activity execution fails immediately" |
| CLI command not found | [Admin CLI Guide](./METABOB_ADMIN_CLI_GUIDE.md) | Installation & Setup |
| Permission denied | [Cold-Start Guide](./ACTIVITY_SYSTEM_COLD_START_GUIDE.md) | Troubleshooting: "Permission denied on API operations" |

---

## Success Criteria Checklist

After completing bootstrap, you should have:

### Database Setup ✓
- [ ] Organization created
- [ ] Admin user created with owner role
- [ ] API key created with full scopes
- [ ] API key saved to config file
- [ ] `db stats` shows 1 org, 1 user, 1+ keys

### Template System ✓
- [ ] 16+ templates loaded in database
- [ ] Core templates present (activity-create, feature-impl, bug-fix, refactor)
- [ ] Templates have V2 format (tasks field with 4-7 tasks)
- [ ] `activities list` shows all templates

### MCP Integration ✓
- [ ] OpenCode configured with MCP server
- [ ] `tools/list` returns metabob tools
- [ ] `search_activities` returns template results
- [ ] `activity` tool can execute activities

### End-to-End Verification ✓
- [ ] Agent can search for activities
- [ ] Agent can execute activity (dry-run)
- [ ] Activity execution recorded in database
- [ ] Results visible via admin CLI

---

## Next Steps After Bootstrap

### 1. Create Your First Template
Use the activity-create template to create a new template:

```javascript
// From OpenCode
activity({
  activityId: "activity-create",
  variables: {
    activity_name: "My Custom Workflow",
    activity_id: "my-workflow-v1",
    target_category: "custom"
  },
  reason: "Formalize our team's workflow into a template"
})
```

### 2. Set Up Monitoring
- Configure Prometheus metrics export
- Set up Grafana dashboards
- Create alert rules for failures

See: [`ACTIVITY_SYSTEM_COLD_START_GUIDE.md`](./ACTIVITY_SYSTEM_COLD_START_GUIDE.md) - Production Considerations

### 3. Configure Backups
- Set up automated database backups
- Configure template export/import
- Test restore procedures

See: [`ACTIVITY_SYSTEM_COLD_START_GUIDE.md`](./ACTIVITY_SYSTEM_COLD_START_GUIDE.md) - Backup & Restore

### 4. Onboard Team Members
- Share this documentation index
- Walk through bootstrap procedure
- Set up user accounts via admin CLI

See: [`METABOB_ADMIN_CLI_GUIDE.md`](./METABOB_ADMIN_CLI_GUIDE.md) - User Management

---

## Documentation Maintenance

### When to Update

Update these docs when:
- ✅ New bootstrap method added
- ✅ Admin CLI commands change
- ✅ Database schema evolves
- ✅ Production requirements change
- ✅ Common issues discovered

### How to Contribute

1. Make changes to relevant document
2. Update cross-references if needed
3. Update this index if new docs added
4. Test procedures still work
5. Commit with clear message

---

## Related Systems Documentation

### Deployment
- [`SURREALDB_FIX_EXECUTION_COMPLETE.md`](./SURREALDB_FIX_EXECUTION_COMPLETE.md) - SurrealDB Helm configuration
- [`DEPLOYMENT_SUMMARY.md`](./DEPLOYMENT_SUMMARY.md) - Deployment state analysis
- Platform deployment docs in `repos/platform/`

### Activity System
- [`ACTIVITY_SYSTEM_WORKING.md`](./ACTIVITY_SYSTEM_WORKING.md) - System architecture
- [`ACTIVITY_CATALOG.md`](./ACTIVITY_CATALOG.md) - Available templates
- [`ACTIVITY_TEMPLATE_CREATION_GUIDE.md`](./ACTIVITY_TEMPLATE_CREATION_GUIDE.md) - Creating templates

### Development
- [`DEVBOB_ENVIRONMENT_GUIDE.md`](./DEVBOB_ENVIRONMENT_GUIDE.md) - Development environment setup
- [`BACKEND_TEMPLATES_ARCHITECTURE_COMPLETE.md`](./BACKEND_TEMPLATES_ARCHITECTURE_COMPLETE.md) - Backend architecture

---

## Support & Contact

### For Bootstrap Issues
1. Check troubleshooting sections in docs above
2. Review backend logs: `docker logs metabob-rpc-api-server-dev-1`
3. Check database state: `python -m admin.cli db stats`
4. Search existing issues in repository

### For Documentation Issues
1. File issue with "documentation" label
2. Include which document and section
3. Describe what's unclear or incorrect
4. Suggest improvement if possible

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Feb 16, 2026 | Initial comprehensive documentation set |
| | | - Added ACTIVITY_SYSTEM_COLD_START_GUIDE.md |
| | | - Added METABOB_ADMIN_CLI_GUIDE.md |
| | | - Added BOOTSTRAP_DOCUMENTATION_INDEX.md |
| | | - Integrated with existing bootstrap docs |

---

**Status**: 🟢 Complete and Production-Ready  
**Last Reviewed**: February 16, 2026  
**Next Review**: March 2026 or when major changes occur

---

## Appendix: Document Sizes

| Document | Lines | Est. Reading Time | Audience |
|----------|-------|-------------------|----------|
| ACTIVITY_SYSTEM_COLD_START_GUIDE.md | 1,300+ | 30 min | All users |
| METABOB_ADMIN_CLI_GUIDE.md | 800+ | 20 min | Admins, DevOps |
| BOOTSTRAP_QUICK_START.md | 400+ | 10 min | Developers |
| COLD_START_BOOTSTRAP_PLAN.md | 450+ | 15 min | Tech leads |
| BOOTSTRAP_VALIDATION_REPORT.md | 600+ | 15 min | Quality assurance |
| BOOTSTRAP_DOCUMENTATION_INDEX.md | 500+ | 10 min | Everyone (start here) |

**Total**: ~4,000+ lines of documentation  
**Total Reading Time**: ~2 hours (complete reference)  
**Time to Bootstrap**: 10-15 minutes (with guide)

