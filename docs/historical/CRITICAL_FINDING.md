# CRITICAL FINDING: Two Activity Systems

## The Real Problem

Activity tool is routing to LEGACY directory-based system, NOT the NEW template-based system where my fix exists.

## Evidence

**ALL devbob activities use LEGACY schema**:
- `directory`, `prompts[]`, `todos[]`  
- NO `tasks[]`, NO proper `contextRequirements`, NO `executionEvidence`

**My fix targets NEW schema**:
- Location: `tool/activity.ts` lines 598-706
- Loads impulses from contextRequirements
- Maps to template variables
- **Never executed in devbob!**

## The One Exception

`act_mlu7mnhl` (Feb 19) - Used NEW system, shows exact bug I fixed:
- `loaded: false` on all impulses
- `sessionsSpawned: []`
- Created BEFORE my fix

## Next Step

Find routing logic: Why does devbob get LEGACY instead of NEW system?
