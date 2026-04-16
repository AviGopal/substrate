# Archive: 2026-04-14

This directory contains documentation archived during the jiggle-and-prune alignment process.

## Archived Files

### SETUP.md
**Reason**: Duplicated content from CLAUDE.md and README.md with outdated information.

**Issues**:
1. **Redundant**: Setup instructions duplicated across CLAUDE.md, README.md, and SETUP.md
2. **Outdated Auth**: Referenced obsolete `INTERNAL_DASHBOARD_CREDENTIAL_ID` and `INTERNAL_DASHBOARD_SECRET` variables (replaced by Cloudflare Zero Trust model)
3. **Inconsistent Configuration**: Different environment variable tables than STANDARD_CONFIGURATION.md
4. **Confusing Structure**: 331 lines covering setup, architecture, testing, deployment - all better documented in CLAUDE.md

**Replacement**:
- Setup instructions: Now in README.md (quick start) and CLAUDE.md (detailed)
- Environment variables: Consolidated in CLAUDE.md following STANDARD_CONFIGURATION.md
- Architecture: Enhanced in CLAUDE.md with composition learning section
- Testing: Retained in CLAUDE.md
- Deployment: Streamlined in CLAUDE.md

## Jiggle-and-Prune Report

See [JIGGLE_PRUNE_REPORT.md](../../JIGGLE_PRUNE_REPORT.md) for complete analysis.

## Recovery

If you need to recover this content:

```bash
cp .archive/2026-04-14/SETUP.md ./SETUP.md
```

However, the content is better organized in the current documentation structure.
