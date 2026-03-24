# OpenSpec Meta Documentation

**Status:** ✅ Foundational documentation complete (ontology) + 🔜 Closed-loop architecture (Phase 0)

## Purpose

The `openspec/meta/` directory contains **system-wide foundational documentation** that bridges philosophical foundation to operational implementation. It includes:

1. **Ontological foundation** (what things ARE)
2. **Closed-loop architecture** (OpenSpec ↔ MiniBob integration)
3. **Implementation roadmap** (path to proven reliability)

Meta documentation is:
- **Cross-cutting**: Applies to all domains and components
- **Conceptual**: Defines what things ARE, not how they work
- **Foundational**: Must be understood before writing or reading other specs
- **Honest**: Clearly marks what works (✅), what's partial (⚠️), and what doesn't exist (❌)

## What Meta Is NOT

### vs. Contracts (`openspec/contracts/`)
- **Contracts**: Define interfaces, APIs, data schemas
- **Meta**: Defines concepts those interfaces implement
- **Example**: Contracts specify the `/recommend` endpoint; Meta explains what "goal-seeking" means

### vs. Changes (`openspec/changes/`)
- **Changes**: Document implementation decisions, migrations, evolution
- **Meta**: Establishes unchanging principles that guide those decisions
- **Example**: Changes track vessel refactoring; Meta defines what a "vessel" is

### vs. Architecture Docs (`docs/architecture/`)
- **Architecture**: Deep dives into specific patterns and implementations
- **Meta**: High-level ontology that architecture builds upon
- **Example**: Architecture explains ribosome implementation; Meta defines the improvisation→template principle

## Core Meta Documents

### I. Ontological Foundation (Philosophical Grounding)

#### 1. [Ontology Foundation](./ontology-foundation.md) ✅
**Purpose:** Establish the three-state model (Vessel/Becoming/Instance)

**You need this when:**
- Writing any spec that involves execution or state
- Confused about "what runs" vs "what's running" vs "what ran"
- Deciding where functionality belongs (MiniBob vs backend vs other)

**Key concepts:**
- Vessel = instructional state (capacity to execute)
- Becoming = transient state (the transformation itself)
- Instance = functional state (the realized result)
- MiniBob = minimal substrate for the becoming

#### 2. [Ideogram Catalog](./ideogram-catalog.md) ✅
**Purpose:** Define universal patterns (ideograms) that manifest across domains

**You need this when:**
- Validating system design against universal principles
- Understanding cross-domain patterns
- Communicating concepts across disciplines

**Key concepts:**
- Six core ideograms: Vessel, Becoming, Instance, Impulse, Improvisation, Goal-Seeking
- Manifestations across software, biology, business, chemistry, music
- Why ideograms matter for design validation and predictive power

#### 3. [Improvisation Spectrum](./improvisation-spectrum.md) ✅
**Purpose:** Explain the four modes of execution from constrained to creative

**You need this when:**
- Designing new execution workflows
- Choosing between template-driven vs goal-seeking approaches
- Understanding when to extract templates (ribosome pattern)

**Key concepts:**
- Template-Driven: Known path, constrained execution
- Goal-Seeking: Adaptive path-finding toward intent
- Search-First: Hybrid reuse + improvisation
- Pure Improvisation: Step-by-step creative emergence
- Ribosome: Successful improvisation → template extraction

#### 4. [Terminology Glossary](./terminology-glossary.md) ✅
**Purpose:** Canonical definitions of all system terms

**You need this when:**
- Writing ANY specification
- Reviewing code or documentation
- Unsure of precise meaning or usage

**Key concepts:**
- Definitions of: Vessel, Becoming, Instance, MiniBob, Activity, Impulse, Improvisation, Goal-seeking, Ribosome, Thompson Sampling
- What each IS and what it's NOT
- Common misuses to avoid

#### 5. [Alignment Checklist](./alignment-checklist.md) ✅
**Purpose:** Ensure specs align with foundational ontology

**You need this when:**
- Writing a new spec
- Reviewing existing specs
- Refactoring components

**Key concepts:**
- Pre-flight questions before creating specs
- Review checklist for existing work
- How to verify ontological alignment

---

### II. Operational Architecture (System Integration)

#### 6. [Goal-Seeking Architecture](./goal-seeking-architecture.md) ✅ IMPLEMENTED
**Purpose:** Document adaptive path-finding implementation (WORKING TODAY)

**You need this when:**
- Understanding how goals become executions
- Integrating with Thompson Sampling recommendations
- Implementing objective goal verification

**Key concepts:**
- Goal-seeking IS adaptive path finding (NOT search or planning)
- GoalProcessor implementation details
- Backend integration via MCP
- Objective verification prevents LLM hallucination
- Learning from goal executions

**Status:** ✅ IMPLEMENTED and VALIDATED (`repos/minibob/src/goal-processor.ts`)

#### 7. [Domain Mappings](./domain-mappings.md) 📋
**Purpose:** Show how ideograms manifest across five operational domains

**You need this when:**
- Understanding domain-specific patterns
- Designing activities for different domains
- Implementing cross-domain composition

**Key concepts:**
- Five domains: Development, Analysis, Deployment, Learning, Validation
- Same substrate (MiniBob), different tools/impulses per domain
- Cross-domain composition patterns

**Status:** DESIGN DOCUMENT (Development domain ✅ works, others ⚠️ partial)

#### 8. [Closed-Loop Architecture](./closed-loop-architecture.md) ⚠️ EXPERIMENTAL
**Purpose:** Define OpenSpec ↔ MiniBob integration (FUTURE)

**You need this when:**
- Understanding the vision for spec-driven development
- Planning closed-loop integration work
- Designing OpenSpec documents

**Key concepts:**
- Six phases: Planning → Compilation → Execution → Observation → Validation → Realignment
- Integration points (OpenSpec → Activity Template → Runtime → Compliance)
- Current limitations (meta-activities don't exist)

**Status:** ⚠️ EXPERIMENTAL - Phase 0 (design only, NOT operational)
**CRITICAL:** Meta-activities are ❌ NOT IMPLEMENTED except extract-template (untested)

---

### III. Implementation Planning (Roadmap to Reliability)

#### 9. [Reliability Roadmap](./reliability-roadmap.md) 🔜
**Purpose:** Honest path to proven autonomous closed-loop

**You need this when:**
- Planning implementation work
- Understanding project timeline
- Setting realistic expectations

**Key concepts:**
- Reality check: 0/6 phases complete
- Phase 1 (2 weeks): Prove compilation pattern (compile-spec-to-activity)
- Phases 2-6: Manual loop → Auto validation → Auto realignment → Continuous → Proven
- Timeline: 6-9 months estimated

**Status:** ROADMAP (next step: Phase 1)

#### 10. [Meta-Activities Catalog](./meta-activities-catalog.md) 📋
**Purpose:** Track status of all meta-activities (activities operating on system)

**You need this when:**
- Understanding what meta-activities exist
- Checking implementation status
- Planning meta-activity development

**Key concepts:**
- Closed-loop meta-activities (plan, compile, observe, validate, realign)
- Learning meta-activities (extract-template, optimize-template)
- Status for each: ✅ proven, ⚠️ exists untested, ❌ not started
- Implementation priorities and dependencies

**Status:** CATALOG (most ❌ NOT STARTED)

#### 11. [Validation Contracts](./validation-contracts.md) 📋
**Purpose:** Define OpenSpec format requirements for executability

**You need this when:**
- Writing OpenSpec documents
- Implementing compilation logic
- Designing validation system

**Key concepts:**
- Required sections: Metadata, Functional, Performance, Validation, Drift Thresholds
- Compilation metadata format
- Compliance report format
- How drift is measured (functional, performance, overall)

**Status:** DESIGN SPECIFICATION (not yet enforced)

## Document Status Markers

Meta docs use consistent status markers:

- ✅ **Proven**: Implemented and validated in production
- ⚠️ **Implemented**: Code exists but not thoroughly validated
- ❌ **Not Built**: Concept defined but no implementation
- 🔴 **Experimental**: Active research, may change significantly

## How to Use Meta Documentation

### When Writing a New Spec

**Ontological Foundation:**
1. Read [Ontology Foundation](./ontology-foundation.md) to understand the three-state model
2. Review [Terminology Glossary](./terminology-glossary.md) for precise definitions
3. Check [Improvisation Spectrum](./improvisation-spectrum.md) if spec involves execution modes
4. Use [Alignment Checklist](./alignment-checklist.md) before publishing

**For OpenSpec Documents:**
1. Follow [Validation Contracts](./validation-contracts.md) format
2. Check [Closed-Loop Architecture](./closed-loop-architecture.md) for integration points
3. Reference [Domain Mappings](./domain-mappings.md) for domain-specific patterns

### When Reviewing Existing Specs

1. Verify terminology matches [Terminology Glossary](./terminology-glossary.md)
2. Check ontological alignment with [Alignment Checklist](./alignment-checklist.md)
3. Ensure execution modes match [Improvisation Spectrum](./improvisation-spectrum.md)
4. Validate OpenSpec format against [Validation Contracts](./validation-contracts.md)

### When Implementing Features

**Current Capabilities:**
1. Start with [Goal-Seeking Architecture](./goal-seeking-architecture.md) (✅ works today)
2. Use goal-driven execution for development work

**Future Capabilities:**
1. Check [Reliability Roadmap](./reliability-roadmap.md) for implementation phases
2. Review [Meta-Activities Catalog](./meta-activities-catalog.md) for status
3. Reference [Closed-Loop Architecture](./closed-loop-architecture.md) for vision
4. Document implementation decisions in changes/

### When Planning Work

1. Review [Reliability Roadmap](./reliability-roadmap.md) for priorities
2. Check [Meta-Activities Catalog](./meta-activities-catalog.md) for dependencies
3. Understand [Domain Mappings](./domain-mappings.md) for domain-specific work

## Principles

### 1. Precision Over Poetry
Use exact terminology from the glossary. "Executor" and "substrate" mean different things.

### 2. Brutal Honesty Over Aspiration
Use status markers honestly:
- ✅ PROVEN: Implemented, tested, works reliably
- ⚠️ EXISTS UNTESTED: Code exists but not validated
- 🔜 IN PROGRESS: Currently being implemented
- 📋 DESIGNED: Specification exists, not implemented
- ❌ NOT STARTED: Planned but no work done
- 🔍 RESEARCH: Exploring feasibility, design uncertain

Unbuilt features are marked ❌, not presented as working.

### 3. Concepts Over Code
Meta docs explain ideas that persist across implementations, not specific code patterns.

### 4. Foundation Over Details
Meta docs establish what things ARE. Architecture docs explain how they work.

### 5. Measured Behavior Over Reasoning
Optimization happens from measured outcomes (Thompson Sampling), not from LLM or human reasoning about what "should" work.

## Maintenance

Meta documentation changes infrequently because it defines foundational concepts. When changes are needed:

1. Propose change in discussion (Slack, issues, etc.)
2. Update affected meta docs
3. Update glossary with new/changed terms
4. Audit existing specs for alignment
5. Document the change in `openspec/changes/`

## Reality Check: What Works Today

**✅ OPERATIONAL:**
- Goal-seeking (GoalProcessor with Thompson Sampling)
- Activity execution (standard templates)
- Execution trace capture
- Backend learning and storage
- Impulse resolution (local types)
- Basic dashboard observability

**⚠️ PARTIAL:**
- Domain mappings (Development works, others incomplete)
- Template extraction (code exists, untested)
- Meta-activities (only extract-template exists)

**❌ NOT IMPLEMENTED:**
- OpenSpec → Activity compilation
- Spec compliance validation
- Automatic realignment
- Continuous closed-loop
- All validation domain activities
- All deployment domain activities

## Common Questions

**Q: Can I use closed-loop today?**
A: No. Phase 0 only (design). Phase 1 starts with implementing compile-spec-to-activity.

**Q: What actually works right now?**
A: Goal-seeking (GoalProcessor), activity execution, Thompson Sampling, backend learning. See [Goal-Seeking Architecture](./goal-seeking-architecture.md).

**Q: When will closed-loop be ready?**
A: Realistic estimate: 6-9 months. See [Reliability Roadmap](./reliability-roadmap.md) for phases.

**Q: Should I write OpenSpec documents now?**
A: You can experiment with the format from [Validation Contracts](./validation-contracts.md), but compilation and validation don't exist yet.

**Q: What's the most important thing to build first?**
A: compile-spec-to-activity.json (Phase 1 critical path).

**Q: Where do ideograms come from?**
A: They're universal patterns that exist independently. See [Ideogram Catalog](./ideogram-catalog.md) for philosophical foundation.

## Questions or Confusion?

If meta documentation doesn't answer your conceptual questions:

1. Check if it belongs in architecture docs (implementation-specific)
2. Check if it belongs in contracts (interface-specific)
3. If truly cross-cutting and foundational, propose new meta doc

Meta exists to eliminate ambiguity, not create it. Clarity is the goal.
