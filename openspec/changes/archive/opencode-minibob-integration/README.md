# OpenCode ↔ MiniBob Integration

**Status:** Draft
**Created:** 2026-03-23
**Type:** System Integration (Learning Loop)

---

## Overview

Integrate MiniBob's observation and learning capabilities into OpenCode (Anthropic CLI fork) to enable:
- Continuous learning from development sessions
- Activity recommendations via Thompson Sampling
- Template extraction through ribosome pattern
- Closed-loop improvement of development workflows

## Documents

- [proposal.md](./proposal.md) - Problem statement and solution approach
- [design.md](./design.md) - Architecture and data flow
- [specs/](./specs/) - Detailed component specifications
  - [observer.md](./specs/observer.md) - Bus event observation (OpenCode)
  - [static-skill.md](./specs/static-skill.md) - ONE `/minibob` skill (OpenCode)
  - [recommendation.md](./specs/recommendation.md) - Backend intelligence (MCP endpoints)
  - [ribosome.md](./specs/ribosome.md) - Template extraction (backend)
- [tasks.md](./tasks.md) - Implementation task breakdown

## Key Insights

**1. Minimal OpenCode Changes (~100 LOC total):**
- Observer: Watch Bus events → send to backend
- Static skill: ONE `/minibob` command → call backend
- Backend client: Thin MCP wrapper

**2. All Intelligence in Backend:**
- Intent detection
- Thompson Sampling recommendations
- Response formatting
- Template execution
- Trace conversion
- Ribosome extraction
- Learning loops

**3. Clean Separation of Concerns:**
OpenCode handles UI/execution, MiniBob handles intelligence/learning. Easy to disable, easy to evolve.

## References

- [OPENCODE_INTEGRATION_NOTES.md](../../../OPENCODE_INTEGRATION_NOTES.md) - Original integration design notes
- [openspec/meta/goal-seeking-architecture.md](../../meta/goal-seeking-architecture.md) - Goal-seeking implementation
- [openspec/meta/improvisation-spectrum.md](../../meta/improvisation-spectrum.md) - Execution modes
- [openspec/meta/ontology-foundation.md](../../meta/ontology-foundation.md) - Three-state model
