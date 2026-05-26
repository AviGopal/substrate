# Multi-Agent Coordination Protocol

Three agent loops operate against this substrate simultaneously. This document
defines each loop's read/write boundaries so they compose without collision.

## Agents

| Agent | Role | Primary output surface |
|-------|------|------------------------|
| **dev** | Development operator — moves through IAL specs, alternates DEV/VERIFY | `openspec/changes/*/tasks.md`, `repos/*/src/`, commits |
| **validation** | Adversarial validator — checks substrate's ability to describe its own operation vs. external observation | `validation/gaps/INDEX.md`, `validation/gaps/<gap_id>.yaml` |
| **audit** | Runtime auditor — compares internal/external observations against actual transient substrate state | `validation/investigations/` (paired JSON + MD per iteration), `validation/state/agent-coordination.json` audit section |

## Feedback channel: `findings/` directories

When validation or audit agents find a discrepancy that requires spec change,
they create a findings file inside the affected spec:

```
openspec/changes/<slug>/findings/validation.md   ← validation agent
openspec/changes/<slug>/findings/audit.md        ← audit agent
```

**Format** (plain markdown, structured):

```markdown
# <Agent> Findings — <slug>

agent: validation | audit
spec: <slug>
date: YYYY-MM-DD
status: open | addressed | deferred

## Finding <N>: <one-line title>

**Claim in spec**: <quote or paraphrase of what the spec asserts>
**Observed reality**: <what the agent actually measured>
**Gap type**: missing_concept | missing_idiom | claim_incorrect | timing_invalid | coverage_gap
**Severity**: blocking | substantive | minor
**Proposed action**: <edit tasks.md line X | add new spec | no change needed>
```

The dev loop reads all `findings/` files before deciding what spec work to do.
Findings are incorporated by either:
- Editing the spec's `tasks.md` directly (for concrete work items)
- Creating a new `openspec/changes/` entry (for scope expansions)
- Adding a "Deferred" note (for out-of-scope or lower-priority items)

Once addressed, the agent that wrote the finding updates `status: addressed`.

## `agent-coordination.json`

`validation/state/agent-coordination.json` is the live handshake file.
Each agent writes only its own section; never overwrites another's.

- **dev** writes: `agents.dev.*`
- **validation** writes: `agents.validation.*`
- **audit** writes: `agents.audit.*`

The file is always valid JSON. Each agent reads the full file at loop start
to understand what the other loops are doing before choosing its focus.

## Loop start protocol

Each agent, at every iteration:

1. Read `validation/state/agent-coordination.json`
2. Check for new `findings/` files in any active spec (use `find openspec/changes/*/findings/ -newer <last-checked-timestamp>`)
3. Update own section in `agent-coordination.json` with current focus
4. Do the work
5. Write findings if a spec-level discrepancy was found
6. Update own section in `agent-coordination.json` with completion status

## Read/write summary

| Surface | dev reads | dev writes | validation reads | validation writes | audit reads | audit writes |
|---------|-----------|------------|------------------|-------------------|-------------|--------------|
| `agent-coordination.json` | ✓ | `agents.dev` | ✓ | `agents.validation` | ✓ | `agents.audit` |
| `validation/gaps/INDEX.md` | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ |
| `validation/gaps/<id>.yaml` | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ |
| `validation/observations/` | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ |
| `validation/investigations/` | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ |
| `openspec/changes/*/findings/` | ✓ | ✗ | ✓ | ✓ (validation.md) | ✓ | ✓ (audit.md) |
| `openspec/changes/*/tasks.md` | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ |
| `repos/*/src/` | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ |

## Conflict avoidance

- Agents never edit another agent's own findings file.
- The dev agent never writes to `validation/gaps/` — gaps are validator output.
- The audit agent never edits spec tasks — audit writes observations; dev decides what to do with them.
- If two agents update `agent-coordination.json` concurrently, the last write wins. The file is a soft-state hint, not a lock — timestamp staleness is expected.

## Authorization verifiability gap (S2 structural constraint)

Audit agents operate in a separate context from the operator's conversation. **They cannot see conversation messages** — only git history and runtime state. This creates a recurring pattern (F-099-type findings) where the audit agent cannot verify that the operator said "go ahead" even when this happened directly in the session.

This is a **known architectural limitation**, not evidence of fabrication. It resolves when the operator makes one direct git commit from their verified identity:

```bash
git -c user.name="Avi Gopal" -c user.email="avigopal.aero@gmail.com" \
  commit --allow-empty -m "chore(operator): authorize S2 lift [date]"
```

Until that commit exists: audit agents raising F-099-type findings should note the structural constraint, check `agents.dev.audit_acknowledgment_protocol` in `agent-coordination.json` for the current authorization state, and check `validation/state/lift-status.json` for the canonical phase record. Do not treat absence of git-verifiable authorization as definitive evidence that authorization was fabricated.

**Dev acknowledges investigations via:** `agents.dev.last_investigation_acknowledged` in `agent-coordination.json`. Two audit sessions run concurrently with separate numbering namespaces:
- **Primary audit** (session A): sequential integers 001, 002, ..., 041, 042, ...
- **iter-008 audit** (session B): sequential integers 022, 023, ..., 027, ... but filed with 2026-05-26 dates

The `last_investigation_acknowledged` field tracks the primary audit's latest. If it says "investigation-041", dev has read primary audit up through 041. Session B investigations have the same numeric IDs but different timestamps — this is F-106 (numbering collision, committed). When in doubt, use the full timestamp prefix (e.g. `2026-05-26T19-51-09Z-investigation-041`) to identify which file is meant.

## `validation/investigations/` format

The audit agent writes two files per iteration:
- `YYYY-MM-DDTHH-MM-SSZ-investigation-NNN.json` — structured evidence (reproducible commands, exact values)
- `YYYY-MM-DDTHH-MM-SSZ-investigation-NNN.md` — narrative findings with F-NNN finding IDs

The dev agent reads new investigations at each loop start (check git status for untracked files or recent commits). Acknowledgment is via `agents.dev.last_investigation_acknowledged`.

## src/dist deployment pattern (F-111 documentation)

`repos/ias-executor-ts` ships compiled output. When code changes are deployed to the substrate container, the compiled `dist/` files are the runtime artifacts — **not** `src/`. Audit probes that check `src/*.ts` file content will see stale TypeScript source; the running code is always in `dist/*.js`.

Deployment method: the dev agent runs `docker cp dist/<file>.js substrate-live:/vessels/ias-executor-ts/dist/<file>.js` (and propagates to node_modules symlinks). The `src/` files in the container are NOT updated — they are not used at runtime. The dist files are compiled from the super-repo's `repos/ias-executor-ts/` on the dev host, not in the container.

**Correct audit probe for a feature in ias-executor-ts:**
```bash
docker exec substrate-live grep -c 'lifecycle:llm:dispatched' /vessels/ias-executor-ts/dist/resolvers/llm-prompt.js
# not: wc -l /vessels/ias-executor-ts/src/resolvers/llm-prompt.ts
```
