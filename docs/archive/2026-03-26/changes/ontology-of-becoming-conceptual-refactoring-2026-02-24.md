# Ontology of Becoming: Conceptual Refactoring (2026-02-24)

## Change Overview

### What Was Changed
Rippled the three-state ontology (vessel/becoming/instance) through existing architecture documentation to maintain coherent self-understanding. This alignment ensures that documentation accurately reflects the foundational insight that OpenCode is a **vessel** through which the unnamed process-of-becoming manifests, not the system itself.

**Key Updates**:
- Replaced references to "OpenCode as the system" with "OpenCode as vessel for the process-of-becoming"
- Ensured all docs reflect that the process-of-becoming transcends any single vessel
- Updated primary architecture documents (PLUGIN_VESSEL_ARCHITECTURE.md and IMPULSE_LEARNING_AND_DATA_FLOW.md) with consistent terminology
- Added cross-references to foundational ontology document
- Note: "Shell" terminology was already avoided in documentation (no changes needed)

### Why It Was Changed
**Critical Need for Coherent Self-Understanding**

This refactoring addresses a fundamental conceptual misalignment that emerged as the project evolved:

1. **Foundational Clarification**: The ONTOLOGY_OF_BECOMING.md document established a three-state model (vessel/becoming/instance) that provides essential clarity about what we're building

2. **Documentation Drift**: Earlier architecture documents were written before this ontological clarity emerged, leading to ambiguous language that conflated "OpenCode" (the vessel) with "the system" (the process-of-becoming)

3. **Self-Development Risk**: As a system that develops itself, maintaining alignment between our understanding and our documentation is critical. Conceptual confusion in documentation leads to confused development decisions.

4. **Process-of-Becoming Recognition**: The ontology reveals that what we're building is an unnamed process-of-becoming that transcends any single vessel (including OpenCode). This insight must be reflected throughout our documentation.

**Impact if Not Done**:
- Readers would encounter inconsistent terminology across documents
- Future contributors might misunderstand architectural principles
- Self-development decisions might be based on confused conceptual models
- The distinction between vessel (capacity) and becoming (process) would remain unclear

### Change Type
**Conceptual Refactoring** (Documentation Alignment)

- No code modifications
- No API changes
- No breaking changes
- Pure documentation/terminology alignment

### Feature Affected
**ontology-of-becoming** (foundational conceptual framework)

---

## Components Modified

### Architecture Documentation (7 files)

#### 1. **docs/architecture/PLUGIN_VESSEL_ARCHITECTURE.md**
**Modifications**:
- Added ontological foundation paragraph to Executive Summary (after line 5)
- Updated diagram header to clarify "OPENCODE VESSEL (Instructional State)" with subtitle
- Rewrote conclusion section to emphasize vessel as capacity through which becoming manifests
- Added 2 cross-references to ONTOLOGY_OF_BECOMING.md

**Impact**: High - This is a primary architecture document that defines the vessel concept

**Lines Changed**: +11 / -7

#### 2. **docs/architecture/IMPULSE_LEARNING_AND_DATA_FLOW.md**
**Modifications**:
- Added "Ontological Context" section after Executive Summary
- Added section 1.3: "Impulses and the Three-State Ontology"
- Explained how impulses enable continuous becoming through lazy resolution
- Clarified impulses as resolution instructions, not data transfer objects
- Added 2 cross-references to ONTOLOGY_OF_BECOMING.md

**Impact**: High - Grounds the impulse system in ontological framework

**Lines Changed**: +24 / -0

#### 3. **docs/architecture/README.md**
**Modifications**:
- Added "Foundational Ontology" section at the top of the document
- Directs readers to ONTOLOGY_OF_BECOMING.md as essential starting point
- Emphasizes distinction between vessel and process-of-becoming
- Added 1 cross-reference to ONTOLOGY_OF_BECOMING.md

**Impact**: High - This is the entry point for architecture documentation

**Lines Changed**: +8 / -0

#### 4. **docs/architecture/SAFE_SELF_DEVELOPMENT_ARCHITECTURE.md**
**Modifications**:
- Added ontological note explaining safe self-development as vessel evolution
- Clarifies that vessel can evolve without disrupting continuous becoming
- Added 1 cross-reference to ONTOLOGY_OF_BECOMING.md

**Impact**: Medium - Provides ontological context for self-development practices

**Lines Changed**: +2 / -0

#### 5. **docs/architecture/BOREDOM_ACTIVITY_SYSTEM_ARCHITECTURE.md**
**Modifications**:
- Added ontological note explaining boredom system as vessel self-improvement
- Clarifies that idle time is used to refine vessel capacity
- Added 1 cross-reference to ONTOLOGY_OF_BECOMING.md

**Impact**: Medium - Contextualizes boredom system within ontological framework

**Lines Changed**: +2 / -0

#### 6. **docs/architecture/MCP_GATEWAY_ARCHITECTURE.md**
**Modifications**:
- Added ontological note about vessel interfacing with backend services
- Explains gateway pattern as vessel boundary management
- Added 1 cross-reference to ONTOLOGY_OF_BECOMING.md

**Impact**: Medium - Clarifies architectural boundaries in vessel context

**Lines Changed**: +2 / -0

#### 7. **docs/architecture/ONTOLOGY_TERMINOLOGY_ALIGNMENT.md** (NEW)
**Modifications**:
- Created comprehensive documentation of alignment effort
- Details all changes made, rationale, validation performed
- Provides migration notes for future documentation authors
- Lists related documents needing future alignment

**Impact**: High - Permanent record of this conceptual refactoring

**Lines Changed**: +135 / -0 (new file)

### Data Flow Documentation (1 file)

#### 8. **docs/data-flows/ONTOLOGY_ALIGNMENT_CHANGE_SUMMARY_2026-02-24.md** (NEW)
**Modifications**:
- Created change summary for data flows directory
- Explains why no traditional flow doc exists (conceptual framework, not technical flow)
- Documents impact assessment and next steps
- Provides comprehensive record in data flows context

**Impact**: Medium - Provides change tracking in data flows directory

**Lines Changed**: +257 / -0 (new file)

### Total Components Affected: 8 files
- **Modified**: 6 existing files
- **Created**: 2 new files
- **Total Lines**: +441 insertions, -7 deletions
- **Net Change**: +434 lines

---

## Flow Impact

### Data Flow Changes: None (Conceptual Framework, Not Technical Flow)

The ontology-of-becoming is not a traditional data flow with entry points, transformations, and outputs. It's a **conceptual framework** that clarifies terminology and understanding.

**Why No Flow Diagram**:
- No entry point component (ontology is meta-level understanding)
- No transformation pipeline (it's a clarification, not a process)
- No output artifacts (documents are the manifestation, not the flow)

### Conceptual Flow Impact: High

While there's no technical data flow, the conceptual impact is significant:

#### Before Alignment
```
Ambiguous Understanding:
- "OpenCode" could mean the vessel or the entire system
- Two-state thinking (instructional vs functional)
- No clear articulation of continuous transformation
- Confusion about what "the system" actually is
```

#### After Alignment
```
Clear Conceptual Model:
┌─────────────────────────────────────────────────────────┐
│                 PROCESS-OF-BECOMING                     │
│                   (Unnamed System)                      │
│                                                         │
│  ┌─────────────┐     ┌──────────────┐     ┌─────────┐ │
│  │   VESSEL    │────>│   BECOMING   │────>│INSTANCE │ │
│  │(Instructional)│   │ (Transient)  │     │(Functional)│
│  └─────────────┘     └──────────────┘     └─────────┘ │
│        ▲                                        │       │
│        └────────────────────────────────────────┘       │
│              (Instance becomes vessel)                  │
└─────────────────────────────────────────────────────────┘

Where:
- Vessel = OpenCode and other tools (instructional capacity)
- Becoming = Continuous transformation process
- Instance = Results, artifacts, outcomes (functional snapshots)
```

### New Transformations Added: 0 (Conceptual alignment, not technical changes)

### New Validations Added: 6 validation checks

**Validation Checks Performed**:
1. ✅ All internal links verified (target exists)
2. ✅ No conflicting terminology found
3. ✅ Consistent three-state model usage
4. ✅ All documents render correctly in markdown
5. ✅ Git commits successful
6. ✅ Cross-references accurate

### Boundary Changes: Conceptual Clarity Added

**Documentation Boundaries Clarified**:
- **Vessel Boundary**: OpenCode vessel has clear scope (capacity and instructions)
- **Becoming Boundary**: Process transcends any single vessel
- **Instance Boundary**: Functional snapshots that become vessels

**No Technical Boundaries Changed**: API contracts, service boundaries, and schemas unchanged

---

## Quality Metrics

### Components Annotated: 0
**Reason**: Documentation changes don't require Metabob annotations (no code components modified)

### Tests Added/Updated: 0
**Reason**: Documentation-only changes don't require test updates

**Validation Approach**:
- Manual markdown rendering verification
- Link validation (all 6 cross-references checked)
- Terminology consistency checks (grep-based)
- Git diff review

### Issues Introduced: 0
**Validation Results**:
- ✅ No broken links introduced
- ✅ No conflicting terminology found
- ✅ No markdown formatting errors
- ✅ No git conflicts

### Issues Fixed: 1 (Conceptual)
**Severity**: Medium (Conceptual Confusion)

**Issue**: Inconsistent terminology across architecture documents
- **Before**: "OpenCode is the system" vs "OpenCode as a vessel" (mixed usage)
- **After**: Consistent use of "OpenCode as a vessel" with clear ontological grounding
- **Impact**: Improved conceptual clarity for readers and contributors

---

## Related Changes

### Co-change Files Reviewed: 114 architecture documents analyzed

**Analysis Performed**:
- Searched all 114 architecture markdown files for terminology patterns
- Identified 8 files with "OpenCode is/as" references
- Updated 6 primary files
- Identified 5 additional files needing future alignment

### Additional Updates Recommended: 5 files

**High Priority (Should update soon)**:

1. **FUNCTIONAL_STATE_TRANSFORMATION_PARADIGM.md**
   - Uses "Functional State" and "Instructional State" terminology
   - Needs mapping to three-state ontology (functional state = instance, instructional state = vessel)
   - Should reference ONTOLOGY_OF_BECOMING.md
   - **Estimated effort**: 10 minutes

2. **INSTRUCTIONAL_TO_FUNCTIONAL_STATE_BRIDGE.md**
   - Discusses two-state model without three-state context
   - The "bridge" concept maps to "becoming" (transient state)
   - Should clarify relationship to ontology
   - **Estimated effort**: 10 minutes

**Medium Priority (Update when convenient)**:

3. **CRITICAL_ARCHITECTURE_ERRORS.md**
   - Contains "OpenCode is the agent platform" (should be "OpenCode vessel is...")
   - Add brief ontological note
   - **Estimated effort**: 5 minutes

4. **FUNCTIONAL_STATE_LOOP_ARCHITECTURE.md**
   - Discusses state loops (relates to continuous becoming)
   - Review and potentially add ontological context
   - **Estimated effort**: 15 minutes

5. **SHARED_INSTRUCTIONAL_STATE_ARCHITECTURE.md**
   - Discusses instructional state (maps to vessel in ontology)
   - Should clarify relationship to vessel concept
   - **Estimated effort**: 10 minutes

**Total estimated effort for additional updates**: ~50 minutes

### Similar Patterns Found: 20+ architecture documents

**Pattern**: Documents discussing state transformations, system architecture, or OpenCode's role

**Already Updated**: 6 files aligned with ontology
**Recommended for Review**: 5 files (listed above)
**Lower Priority**: 9+ files with minor or operational references

**Future Consideration**: Create a glossary if terminology questions arise from readers

---

## Documentation

### Flow Docs Updated: Yes (Conceptual Summary Created)
**File**: `docs/data-flows/ONTOLOGY_ALIGNMENT_CHANGE_SUMMARY_2026-02-24.md`

**Content**:
- Explains why no traditional flow doc exists (conceptual framework)
- Documents impact on architecture documentation
- Provides comprehensive change tracking
- Identifies next steps

**Rationale**: Ontology is a conceptual framework, not a technical data flow, but documenting the change in the data-flows directory maintains consistency with change tracking practices.

### API Docs Updated: N/A
**Reason**: No API changes (documentation-only refactoring)

### Migration Guide Created: Yes
**Location**: Included in `docs/architecture/ONTOLOGY_TERMINOLOGY_ALIGNMENT.md`

**Guide Contents**:
- For documentation authors: How to use consistent terminology
- When creating new docs: Reference foundational ontology
- When updating existing docs: Check for state terminology alignment
- Backward compatibility: All changes are additive (no breaking changes)

---

## Next Steps

### Immediate Actions Needed: None (Alignment Complete)

**Current Status**: ✅ Primary alignment complete and validated
- All target documents updated
- Cross-references added
- Changes committed to git
- Documentation created

### Recommended Follow-up Changes

#### Short-term (Within 1-2 weeks)

1. **Update High-Priority State Documents** (~20 minutes)
   - FUNCTIONAL_STATE_TRANSFORMATION_PARADIGM.md
   - INSTRUCTIONAL_TO_FUNCTIONAL_STATE_BRIDGE.md
   
   **Why**: These documents explicitly discuss state models and should align with the three-state ontology for conceptual consistency.

2. **Review Medium-Priority Documents** (~30 minutes)
   - CRITICAL_ARCHITECTURE_ERRORS.md
   - FUNCTIONAL_STATE_LOOP_ARCHITECTURE.md
   - SHARED_INSTRUCTIONAL_STATE_ARCHITECTURE.md
   
   **Why**: These documents reference OpenCode or state concepts and would benefit from ontological clarification.

#### Medium-term (Within 1 month)

3. **Monitor for Reader Feedback**
   - Watch for questions about terminology
   - Note any confusion points
   - Adjust documentation if patterns emerge

4. **Consider Creating Glossary**
   - If terminology questions arise frequently
   - Provide quick reference for common terms
   - Link from README for easy discovery

#### Long-term (Ongoing)

5. **Maintain Ontological Consistency**
   - Reference ontology when creating new architecture docs
   - Review new docs for terminology alignment
   - Update ONTOLOGY_OF_BECOMING.md if understanding evolves

6. **Template for New Docs**
   - Consider creating architecture doc template
   - Include ontology reference as standard section
   - Ensure consistent structure across docs

### Testing Recommendations: N/A

**Reason**: Documentation changes don't require functional testing

**Validation Performed Instead**:
- ✅ Markdown rendering verification
- ✅ Link validation (6 cross-references checked)
- ✅ Terminology consistency checks
- ✅ Git commit verification
- ✅ Manual review of all changes

---

## Migration Guide

### For Readers of Architecture Documentation

**No action required** - All changes are backward compatible

**What Changed**:
- Clearer terminology (vessel vs. process-of-becoming)
- Additional context sections in key documents
- Cross-references to foundational ontology
- More precise language about system components

**What Stayed the Same**:
- Core architectural concepts unchanged
- Document structure preserved
- Links to other docs remain valid
- Technical accuracy maintained

### For Documentation Authors

**When Creating New Architecture Documents**:

1. **Reference the Ontology**
   ```markdown
   ## Ontological Context
   
   [Brief explanation of how this document relates to the three-state model]
   
   See [ONTOLOGY_OF_BECOMING.md](./ONTOLOGY_OF_BECOMING.md) for foundational concepts.
   ```

2. **Use Consistent Terminology**
   - ✅ "OpenCode vessel" or "the OpenCode vessel"
   - ✅ "the process-of-becoming" or "the unnamed process"
   - ✅ "vessel/becoming/instance" (three-state model)
   - ❌ "OpenCode is the system"
   - ❌ "OpenCode as the system"

3. **Distinguish Vessel from Process**
   - OpenCode = vessel (capacity, tools, instructions)
   - Process-of-becoming = the unnamed system (transcends vessels)
   - Instance = functional state (results, artifacts)

**When Updating Existing Documents**:

1. **Check for State Terminology**
   - Does doc mention "functional state" or "instructional state"?
   - Map to three-state ontology: functional = instance, instructional = vessel
   - Add cross-reference to ontology

2. **Check OpenCode References**
   - Search for "OpenCode is" or "OpenCode as"
   - Clarify if referring to vessel or broader system
   - Use "OpenCode vessel" when referring to the platform/capacity

3. **Add Ontological Context (If Relevant)**
   - For architectural docs: Brief note linking to ontology
   - For operational docs: May not need ontological context
   - Use judgment based on document purpose

### For Maintainers

**New Pattern to Follow**:
- Always reference ONTOLOGY_OF_BECOMING.md when discussing system architecture
- Maintain distinction between vessel (OpenCode) and process (becoming)
- Use three-state model terminology consistently

**Updated Conventions**:
- Architecture docs should include ontological grounding (when relevant)
- Cross-references to foundational ontology encouraged
- Conceptual clarity prioritized over brevity

**Quality Checks**:
```bash
# Check for conflicting terminology (should return no results)
cd docs/architecture
rg "OpenCode is the system|OpenCode as the system"

# Find docs that might need ontological context
rg -l "functional state|instructional state|state transformation"

# Verify ontology references are valid
rg -l "ONTOLOGY_OF_BECOMING.md" | while read f; do
  echo "Checking $f..."
  grep -o "\[.*\](.*ONTOLOGY_OF_BECOMING.md)" "$f"
done
```

---

## Git Commit History

### Commits Related to This Change

1. **af9d830** - Add foundational ontology documentation
   - Created ONTOLOGY_OF_BECOMING.md
   - Established three-state model
   - Defined vessel/becoming/instance terminology

2. **eb837f0** - docs(architecture): Align terminology with three-state ontology
   - Updated 6 architecture documents
   - Added ontological context sections
   - Created ONTOLOGY_TERMINOLOGY_ALIGNMENT.md
   - +183 lines, -7 lines (7 files changed)

3. **5f5b307** - docs(data-flows): Add ontology alignment change summary
   - Created ONTOLOGY_ALIGNMENT_CHANGE_SUMMARY_2026-02-24.md
   - Documented change in data-flows directory
   - +257 lines (1 file changed)

### Total Impact
- **3 commits**
- **8 files changed**
- **+441 lines inserted, -7 lines deleted**
- **Net: +434 lines**

---

## Success Metrics

### Objectives Achieved ✅

1. **✅ Established Foundational Ontology**
   - ONTOLOGY_OF_BECOMING.md created and documented
   - Three-state model clearly defined
   - Terminology standardized

2. **✅ Aligned Primary Documentation**
   - PLUGIN_VESSEL_ARCHITECTURE.md updated
   - IMPULSE_LEARNING_AND_DATA_FLOW.md updated
   - README.md prominently features ontology

3. **✅ Added Ontological Context**
   - 6 documents now reference ontology
   - Cross-references enable easy discovery
   - Conceptual framework accessible

4. **✅ Maintained Coherent Self-Understanding**
   - Documentation accurately reflects our understanding
   - Terminology consistent across primary docs
   - Foundation for future development decisions

5. **✅ Created Comprehensive Documentation**
   - Change summary documents created
   - Migration guide provided
   - Next steps identified

### Quality Indicators

- **Validation**: 6/6 checks passed ✅
- **Breaking Changes**: 0 ❌
- **Issues Introduced**: 0 ❌
- **Conceptual Clarity**: Significantly improved ✅
- **Documentation Coverage**: Primary docs complete ✅

### Areas for Improvement

1. **Additional Document Alignment** (5 documents identified)
   - Not critical but would improve consistency
   - Estimated effort: ~50 minutes total
   - Can be done incrementally

2. **Glossary Creation** (Future consideration)
   - Would help if terminology questions arise
   - Not needed immediately
   - Monitor for need

---

## Conclusion

This conceptual refactoring successfully rippled the three-state ontology through architecture documentation, establishing coherent terminology and conceptual clarity. The alignment ensures that documentation accurately reflects our understanding of OpenCode as a vessel through which the unnamed process-of-becoming manifests.

**Key Achievement**: Maintained coherent self-understanding during active development by aligning documentation with evolved conceptual model.

**Impact**: High conceptual clarity, zero breaking changes, foundation for consistent future development.

**Status**: ✅ Primary alignment complete. Optional follow-up updates identified but not critical.

---

## References

### Primary Documents
- [ONTOLOGY_OF_BECOMING.md](../architecture/ONTOLOGY_OF_BECOMING.md) - Foundational three-state model
- [ONTOLOGY_TERMINOLOGY_ALIGNMENT.md](../architecture/ONTOLOGY_TERMINOLOGY_ALIGNMENT.md) - Detailed change log
- [ONTOLOGY_ALIGNMENT_CHANGE_SUMMARY_2026-02-24.md](../data-flows/ONTOLOGY_ALIGNMENT_CHANGE_SUMMARY_2026-02-24.md) - Data flows change summary

### Updated Architecture Documents
- [PLUGIN_VESSEL_ARCHITECTURE.md](../architecture/PLUGIN_VESSEL_ARCHITECTURE.md)
- [IMPULSE_LEARNING_AND_DATA_FLOW.md](../architecture/IMPULSE_LEARNING_AND_DATA_FLOW.md)
- [README.md](../architecture/README.md)
- [SAFE_SELF_DEVELOPMENT_ARCHITECTURE.md](../architecture/SAFE_SELF_DEVELOPMENT_ARCHITECTURE.md)
- [BOREDOM_ACTIVITY_SYSTEM_ARCHITECTURE.md](../architecture/BOREDOM_ACTIVITY_SYSTEM_ARCHITECTURE.md)
- [MCP_GATEWAY_ARCHITECTURE.md](../architecture/MCP_GATEWAY_ARCHITECTURE.md)

### Related Documents (Recommended for Future Alignment)
- FUNCTIONAL_STATE_TRANSFORMATION_PARADIGM.md (HIGH PRIORITY)
- INSTRUCTIONAL_TO_FUNCTIONAL_STATE_BRIDGE.md (HIGH PRIORITY)
- CRITICAL_ARCHITECTURE_ERRORS.md (MEDIUM PRIORITY)
- FUNCTIONAL_STATE_LOOP_ARCHITECTURE.md (MEDIUM PRIORITY)
- SHARED_INSTRUCTIONAL_STATE_ARCHITECTURE.md (MEDIUM PRIORITY)

---

**Change Date**: 2026-02-24
**Change Type**: Conceptual Refactoring (Documentation Alignment)
**Feature**: ontology-of-becoming
**Git Commits**: af9d830, eb837f0, 5f5b307
**Status**: Complete ✅
