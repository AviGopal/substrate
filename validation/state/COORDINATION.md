# Multi-Agent Coordination Protocol

Three agent loops operate against this substrate simultaneously. This document
defines each loop's read/write boundaries so they compose without collision.

## Agents

| Agent | Role | Primary output surface |
|-------|------|------------------------|
| **dev** | Development operator — moves through IAL specs, alternates DEV/VERIFY | `openspec/changes/*/tasks.md`, `repos/*/src/`, commits |
| **validation** | Adversarial validator — checks substrate's ability to describe its own operation vs. external observation | `validation/gaps/INDEX.md`, `validation/gaps/<gap_id>.yaml` |
| **audit** | Runtime auditor — compares internal/external observations against actual transient substrate state | `validation/observations/`, `validation/state/agent-coordination.json` audit section |

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
| `openspec/changes/*/findings/` | ✓ | ✗ | ✓ | ✓ (validation.md) | ✓ | ✓ (audit.md) |
| `openspec/changes/*/tasks.md` | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ |
| `repos/*/src/` | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ |

## Conflict avoidance

- Agents never edit another agent's own findings file.
- The dev agent never writes to `validation/gaps/` — gaps are validator output.
- The audit agent never edits spec tasks — audit writes observations; dev decides what to do with them.
- If two agents update `agent-coordination.json` concurrently, the last write wins. The file is a soft-state hint, not a lock — timestamp staleness is expected.
