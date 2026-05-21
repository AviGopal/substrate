# Spec: Team-Lead E2E Rubric

**Status**: DONE — 2026-05-21  
**Source**: `openspec/changes/archive/2026-05-20-team-lead-rubric/`  
**Implementation**: `repos/metabob-cloud-dashboard` commit `fd86428`

## Summary

Six Playwright rubric specs exercise the team-lead flow in standalone mode.
The `rubric` Playwright project carries no `auth.setup.ts` dependency;
`standalone-seed.ts` provisions the test user via HTTP.

## Specs

| Spec | File | What it asserts |
|------|------|-----------------|
| 01-onboard | e2e/rubric/01-onboard.spec.ts | API Keys page renders; create-key UX; revoke removes key |
| 02-observe-agent | e2e/rubric/02-observe-agent.spec.ts | /execution-traces gated in standalone mode; no nav entry |
| 03-observe-mcp-usage | e2e/rubric/03-observe-mcp-usage.spec.ts | /mcp 3 tabs; Tools shows tool; Install shows npx; Usage fires BFF |
| 04-manage-team | e2e/rubric/04-manage-team.spec.ts | /members renders; invite form accepts email |
| 05-budget-check | e2e/rubric/05-budget-check.spec.ts | /usage-analytics gated; no crash on /api-keys |
| 06-cross-project-view | e2e/rubric/06-cross-project-view.spec.ts | org-scoped content on /api-keys; project selector stub |

## Running

```bash
cd repos/metabob-cloud-dashboard
E2E_STANDALONE_MODE=true bun run dev-loop
```

Exits 0 with `passed: 6` when all specs green against canary.
