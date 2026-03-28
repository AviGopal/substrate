# Ideogram Catalog

**Status:** DESIGN DOCUMENT (philosophical foundation)
**Last Updated:** 2026-03-23

## What is an Ideogram?

An **ideogram** is a universal pattern that manifests consistently across domains while maintaining core properties. Unlike metaphors (which compare) or abstractions (which generalize), ideograms are **structural invariants** - patterns that exist independently of implementation.

**Key Characteristics:**
- Universal: Appears in multiple unrelated domains
- Structural: Maintains specific relationships between components
- Invariant: Core properties hold across manifestations
- Recognizable: Pattern is identifiable despite surface differences

**Ideograms vs Other Concepts:**

| Concept | Property | Example |
|---------|----------|---------|
| **Ideogram** | Universal structural pattern | Vessel → Becoming → Instance |
| **Metaphor** | Comparison for understanding | "Time is money" |
| **Abstraction** | Simplified representation | "Database" (hides implementation) |
| **Framework** | Specific implementation | React, Spring, Django |

## The Six Core Ideograms

### 1. Vessel (Instructional State)

**Definition:** The capacity to execute - the blueprint, the potential, the specification.

**Properties:**
- Static during execution
- Contains instructions for transformation
- Reusable (one vessel → many instances)
- Versionable (can be stored, compared, evolved)

**Manifestations Across Domains:**

**Software Development:**
- Activity template (JSON specification)
- Docker image
- Class definition
- Function signature
- OpenAPI specification

**Biology:**
- DNA sequence
- Enzyme structure (catalytic site)
- Viral capsid (before infection)

**Business:**
- Standard Operating Procedure (SOP)
- Business process model
- Recipe in cookbook
- Blueprint for building

**Chemistry:**
- Catalyst molecule (before reaction)
- Reaction mechanism (written procedure)
- Chemical formula (specification)

**Music:**
- Musical score
- Chord progression pattern
- Song structure (verse-chorus-bridge)

**Philosophy:**
- Platonic form
- Archetypal pattern
- Logical structure

### 2. Becoming (Transient State)

**Definition:** The active transformation - the execution in flight, the state transition, the process itself.

**Properties:**
- Ephemeral (exists only during transition)
- Irreducible (cannot be fully captured in either vessel or instance)
- Temporal (has duration, rhythm, phases)
- Transformative (changes both itself and what it acts upon)
- Continuous (even when "idle", adjustment continues)

**Manifestations Across Domains:**

**Software Development:**
- Activity executing (task by task)
- LLM generating response (token streaming)
- Kubernetes pod initializing
- Git merge in progress
- This system itself (continuous template → execution → learning)

**Biology:**
- Protein folding
- Enzyme catalyzing reaction
- Cell dividing (mitosis)
- Organism growing/developing

**Business:**
- Employee executing SOP
- Sales process in flight
- Product development sprint
- Negotiation happening

**Chemistry:**
- Chemical reaction proceeding
- Catalyst facilitating bond formation
- Phase transition occurring

**Music:**
- Performance of score
- Improvisation session
- Sound wave propagating
- Musician interpreting notation

**Philosophy:**
- Heraclitean flux
- Hegelian dialectic synthesis
- Deleuzian becoming
- Process philosophy events

**KEY INSIGHT:** The becoming is LARGER than any particular vessel. OpenCode is a vessel through which becoming manifests, not the becoming itself.

### 3. Instance (Functional State)

**Definition:** The realized state - the outcome, the artifact, the actualized result.

**Properties:**
- Dynamic (changed from initial state)
- Actualized (instructions realized as state)
- Specific (each instance is unique)
- Observable (can be inspected, measured)
- Momentary (represents state at a point in time)

**Manifestations Across Domains:**

**Software Development:**
- Completed activity execution (files written, commits made)
- Running Docker container
- Object instantiated from class
- API response returned
- Git commit created

**Biology:**
- Folded protein (active conformation)
- Products of enzymatic reaction
- Completed cell division (two daughter cells)
- Mature organism

**Business:**
- Completed order/transaction
- Finished product
- Executed contract
- Customer interaction record

**Chemistry:**
- Reaction products
- New molecular bonds formed
- Phase transition complete (ice → water)

**Music:**
- Recording of performance
- Sound captured in air
- Listener's interpretation/memory
- Emotional response evoked

**Philosophy:**
- Aristotelian actuality
- Completed dialectic
- Actualized potential

**KEY INSIGHT:** The instance immediately becomes the vessel for the next transformation. This is a continuous loop, not linear progression.

### 4. Impulse (Context Injection)

**Definition:** Lazy-loaded pointer to content with token budget - dynamic context injection mechanism.

**Properties:**
- Lazy (not loaded until needed)
- Budgeted (token limit prevents context overflow)
- Prioritized (high/medium/low determines loading order)
- Polymorphic (pointer type determines resolution strategy)
- Lifecycle-managed (load → inject → unload)

**Manifestations Across Domains:**

**Software Development:**
- Impulse pointer (file, activityExecutionTrace, etc.)
- Environment variable reference
- Database connection string
- API endpoint URL
- Git ref (branch, tag, commit SHA)

**Biology:**
- Gene expression signal (not DNA itself, but trigger)
- Hormone receptor binding (signal to load specific response)
- Neural spike (pointer to memory, not memory itself)

**Business:**
- Reference to document (not full text)
- Hyperlink in email
- Calendar invite (pointer to meeting context)
- Purchase order number

**Chemistry:**
- Activation energy threshold (signal to proceed)
- Catalyst binding site (pointer to reaction pathway)

**Music:**
- Tempo/dynamic marking (context for interpretation)
- Key signature (pointer to tonal context)
- Repeat sign (reference to previous section)

**Philosophy:**
- Indexical reference
- Demonstrative pronoun ("this", "that")
- Contextual variable

### 5. Improvisation (Adaptive Template Creation)

**Definition:** Real-time adaptation creating new vessels from becoming observations.

**Properties:**
- Emergent (arises from execution, not planning)
- Context-sensitive (responds to current state)
- Pattern-capturing (extracts reusable structure from specific instance)
- Uncertain (may succeed or fail)
- Learning-driven (improves with repetition)

**Manifestations Across Domains:**

**Software Development:**
- Ribosome pattern (execution → template extraction)
- Activity variant creation on failure (trailblazing)
- LLM generating new approach after error
- Hot-patching code during runtime

**Biology:**
- Immune system creating antibodies (novel response to antigen)
- Neural plasticity (new pathways forming)
- Evolutionary adaptation (mutation → selection)

**Business:**
- Employee solving unexpected problem (not in SOP)
- Product pivot based on user feedback
- Negotiation strategy adjustment mid-conversation

**Chemistry:**
- Autocatalytic reaction (product catalyzes more production)
- Self-organizing system (new structures emerge)

**Music:**
- Jazz improvisation (creating melody over changes)
- Theme and variations (pattern elaboration)
- Conductor adjusting tempo in response to hall acoustics

**Philosophy:**
- Pragmatist experimentation
- Dialectical synthesis
- Creative abduction (Peirce)

**KEY INSIGHT:** Improvisation is NOT random - it's structured adaptation within constraints.

### 6. Goal-Seeking (Adaptive Path Finding)

**Definition:** Navigating from current state to desired state through continuous adjustment based on measured outcomes.

**Properties:**
- Adaptive (path emerges from execution, not planned upfront)
- Measured (decisions based on observed outcomes, not reasoning)
- Probabilistic (exploration/exploitation balance)
- Iterative (execute → observe → adjust → repeat)
- Objective-driven (completion verified by measurable criteria)

**Manifestations Across Domains:**

**Software Development:**
- GoalProcessor executing activities until goal achieved
- Thompson Sampling selecting next template
- LLM adjusting approach based on tool call results
- CI/CD pipeline retrying failed steps

**Biology:**
- Chemotaxis (bacteria moving toward nutrients)
- Immune system tracking down pathogen
- Predator hunting prey (adjust strategy based on prey behavior)
- Enzyme conformational search for optimal binding

**Business:**
- Sales process (adjust pitch based on customer responses)
- Agile sprint (adjust backlog based on velocity)
- Startup pivoting based on market feedback

**Chemistry:**
- Le Chatelier's principle (system adjusting to restore equilibrium)
- Reaction pathway optimization (molecules finding lowest energy route)

**Music:**
- Finding melodic resolution (tension → release)
- Tuning instrument (adjust until correct pitch)
- Ensemble synchronization (musicians adjusting to each other)

**Philosophy:**
- Teleological process (goal-directed)
- Pragmatist problem-solving
- Cybernetic feedback loop

**KEY INSIGHT:** Goal-seeking is NOT search or planning - it's continuous course correction.

## Ideogram Relationships

### Primary Cycle

```
VESSEL (instructional state)
   │
   ▼ [activation]
BECOMING (transient state)
   │
   ▼ [completion]
INSTANCE (functional state)
   │
   └──▶ [immediately becomes vessel for next transformation]
```

### Context Injection

```
IMPULSE ──▶ BECOMING
  ↑            │
  │            ▼
  └──────── INSTANCE
    (new impulses created from execution)
```

### Adaptation Loop

```
BECOMING ──▶ INSTANCE
     │           │
     │           ▼
     │      [pattern extraction]
     │           │
     │           ▼
     └────── IMPROVISATION ──▶ NEW VESSEL
```

### Goal-Directed Execution

```
GOAL-SEEKING
    │
    ├──▶ Select VESSEL (via Thompson Sampling)
    │         │
    │         ▼
    │    Execute BECOMING
    │         │
    │         ▼
    │    Observe INSTANCE
    │         │
    │         ▼
    └──── Verify achievement ──▶ [repeat or complete]
```

## Cross-Domain Translation Table

| Domain | Vessel | Becoming | Instance | Impulse | Improvisation | Goal-Seeking |
|--------|--------|----------|----------|---------|---------------|--------------|
| **Software** | Activity template | Execution | Completed activity | File pointer | Variant creation | GoalProcessor |
| **Biology** | DNA | Protein folding | Folded protein | Gene signal | Antibody creation | Chemotaxis |
| **Business** | SOP | Employee executing | Completed task | Document ref | Problem-solving | Sales process |
| **Chemistry** | Catalyst | Reaction | Products | Activation energy | Autocatalysis | Equilibrium seeking |
| **Music** | Score | Performance | Recording | Tempo marking | Improvisation | Finding resolution |

## Recognition Patterns

### How to Identify an Ideogram

1. **Find the Vessel:** What holds instructions/potential?
2. **Observe the Becoming:** What is the transformation process?
3. **Identify the Instance:** What is the realized outcome?
4. **Check Continuity:** Does instance become vessel for next cycle?
5. **Verify Across Domains:** Does pattern hold in 3+ unrelated fields?

### Anti-Patterns (NOT Ideograms)

❌ **Technology-Specific Patterns:**
- REST API (specific to HTTP)
- MapReduce (specific to distributed computing)
- MVC (specific to UI frameworks)

❌ **Domain-Specific Metaphors:**
- "Code smells" (only in software)
- "Technical debt" (only in software)
- "Market fit" (only in business)

❌ **Implementation Details:**
- Docker vs Kubernetes (competing implementations)
- React vs Vue (competing frameworks)
- SQL vs NoSQL (competing paradigms)

## Why Ideograms Matter

### 1. Universal Communication
- Describe patterns across disciplines
- Bridge technical and non-technical understanding
- Enable cross-domain learning

### 2. Design Validation
- If your system doesn't map to ideograms, question the design
- Ideograms reveal missing components
- Help identify where system breaks universal patterns

### 3. Predictive Power
- Know how pattern behaves in one domain → predict behavior in another
- Identify anti-patterns early (violations of ideogram properties)

### 4. Implementation Guidance
- Ideograms guide architecture without dictating implementation
- Allow innovation within constraints
- Prevent premature optimization

## Application to This System

### Current Implementation

**Vessel:** Activity templates (JSON specifications)
**Becoming:** Activity execution (LLM + tools transforming state)
**Instance:** Completed execution (files modified, commits created)
**Impulse:** Pointer system (file, activityExecutionTrace, etc.)
**Improvisation:** Ribosome pattern (execution → template extraction)
**Goal-Seeking:** GoalProcessor (Thompson Sampling recommendations)

### Validation Questions

1. ✅ Can templates be reused? (Vessel property)
2. ✅ Is execution ephemeral? (Becoming property)
3. ✅ Does instance become next vessel? (Continuity property)
4. ✅ Are impulses lazy-loaded? (Impulse property)
5. ✅ Do variants emerge from failure? (Improvisation property)
6. ✅ Does system adjust based on measured outcomes? (Goal-seeking property)

### Future Directions

**Cross-Vessel Composition:**
- MiniBob vessel executes activity
- Activity delegates to Analysis API vessel
- Analysis vessel returns results
- MiniBob incorporates into execution

**Multi-Level Becoming:**
- Task-level becoming (single tool call)
- Activity-level becoming (sequence of tasks)
- Goal-level becoming (sequence of activities)
- Session-level becoming (continuous development)

## References

**Philosophical Foundations:**
- Process Philosophy (Whitehead, Bergson, Deleuze)
- Cybernetics (Wiener, Ashby)
- Systems Theory (von Bertalanffy)

**Technical Foundations:**
- Activity Theory (Vygotsky, Leont'ev)
- Actor Model (Hewitt)
- Functional Reactive Programming

**Related Documentation:**
- `docs/architecture/ONTOLOGY_OF_BECOMING.md` - Three-state model
- `docs/architecture/VESSEL_ARCHITECTURE_CORRECTED.md` - Vessel design
- `goal-seeking-architecture.md` - Goal-seeking implementation
- `domain-mappings.md` - Domain-specific manifestations
