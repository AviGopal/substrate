# Archive: 2026-04-22 Jiggle and Prune

Documents archived as part of the 2026-04-22 `/jiggle-and-prune` pass.

Each was a date-stamped report or snapshot that reflected the state of the system at a specific point in April 2026. The issues they describe have been addressed by:

- activity-api v1.3–v1.5 (schema, metrics, feedback endpoint)
- identity-vessel key format overhaul
- discovery-vessel integration rollout

Content worth preserving was absorbed into:

- `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md` (canonical model, including `composition_chain`)
- `docs/architecture/RUNTIME_ACTIVITY_TRACING.md` (tracer status + L1/L2 meta-traces)
- `docs/guides/ACTIVITY_LIFECYCLE_DEPRECATION.md` (new)
- `docs/guides/DASHBOARD_ANALYTICS.md` (new)

## Archived files

| File | Original date | Status at archive |
|------|---------------|-------------------|
| `PRODUCTION_ALIGNMENT_PLAN.md` | 2026-04-06 | All listed gaps resolved in v1.3+ |
| `IMPLEMENTATION_AUDIT_2026-04-08.md` | 2026-04-08 | Point-in-time audit; current state has diverged |
| `IMPLEMENTATION_REALITY_QUICK_REF.md` | 2026-04-08 | Companion to the audit; same reason |
| `API_KEY_FORMAT_COMPATIBILITY_REPORT.md` | 2026-04-09 | Decision made: formats compatible; documented in identity-vessel |
| `API_KEY_FORMAT_COMPATIBILITY_SUMMARY.md` | 2026-04-09 | Summary of the above report |
| `EXTERNAL_VALIDATION_IMPLEMENTATION_SUMMARY.md` | 2026-04-08 | Point-in-time "we shipped this" report; canonical guide now at `docs/guides/EXTERNAL_VALIDATION.md` |

## Doc moves (not archives)

Two docs were relocated rather than archived:

- `docs/EXTERNAL_VALIDATION_GUIDE.md` → `docs/guides/EXTERNAL_VALIDATION.md`
- `docs/EXTERNAL_VALIDATION_INTEGRATION.md` → `docs/guides/EXTERNAL_VALIDATION_INTEGRATION.md`

These files are kept for historical reference. If you need the decisions they captured, go to the canonical docs listed above first.
