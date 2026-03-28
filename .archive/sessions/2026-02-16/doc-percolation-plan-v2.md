# Documentation Percolation Plan V2 (Dry Run)

**Generated**: 2026-02-09 13:50:08
**Mode**: Dry Run (No files will be modified)
**Analysis Source**: doc-jiggle-analysis.md (683 markdown files analyzed)

---

## Executive Summary

This plan identifies valuable content from recent documentation (< 30 days) and creates a systematic percolation strategy to update foundational documents. The goal is to ensure that important discoveries, fixes, and architectural decisions flow from detailed implementation docs into the documents developers actually read.

### Key Metrics
- **Total docs analyzed**: 683 markdown files
- **Recent docs** (< 30 days): 644 files (94%)
- **Foundational docs identified**: 13 files
- **Source docs for percolation**: 17 high-value recent files
- **Planned percolations**: 26 content updates
- **Cross-references to add**: 50+

### Percolation Philosophy

**"Information should flow downhill"** - Detailed implementation notes → Architecture docs → Quick references → Index

---

## Part 1: Foundational Documents (Targets)

### 1.1 Navigation Hub
- **File**: `DOCUMENTATION_INDEX.md`
- **Purpose**: Central entry point for all documentation
- **Current age**: 0 days (recently updated)
- **Percolations needed**: 16 updates
- **Priority**: HIGH

### 1.2 Architecture References
- **File**: `QUICK_ARCHITECTURE_REFERENCE.md`
- **Purpose**: Developer quick reference
- **Current age**: 3 days
- **Percolations needed**: 3 updates
- **Priority**: HIGH

- **File**: `README_ARCHITECTURE_DOCS.md`
- **Purpose**: Architecture documentation index
- **Current age**: 0 days
- **Percolations needed**: 4 updates
- **Priority**: MEDIUM

- **File**: `CORRECT_ARCHITECTURE_DESIGN.md`
- **Purpose**: Correct architecture patterns
- **Current age**: 0 days
- **Percolations needed**: Reference updates
- **Priority**: MEDIUM

### 1.3 Component Documentation
- **File**: `repos/metabob-cli/README.md`
- **Purpose**: CLI tool overview
- **Current age**: 0 days
- **Percolations needed**: 1 update
- **Priority**: MEDIUM

- **File**: `repos/metabob-rpc-api/README.md`
- **Purpose**: RPC API documentation
- **Current age**: Currently missing specific location
- **Percolations needed**: 2 updates
- **Priority**: MEDIUM

- **File**: `repos/metabob-opencode/README.md`
- **Purpose**: OpenCode project overview
- **Current age**: 0 days
- **Percolations needed**: Link updates
- **Priority**: LOW

---

## Part 2: Source Documents (Origins)

### Category A: Session & MCP Implementation (2 docs)

#### A1. MCP_SESSION_INITIALIZATION_FIX.md
- **Size**: 11,241 bytes
- **Age**: 0 days
- **Value**: MCP session flow, initialization patterns, error handling
- **Target docs**: QUICK_ARCHITECTURE_REFERENCE.md, DOCUMENTATION_INDEX.md

**Key content to extract**:
- Session initialization sequence
- Common initialization errors and solutions
- MCP handshake protocol
- Timeout handling patterns

#### A2. SESSION_CREATION_FIX_SUMMARY.md
- **Size**: 5,890 bytes
- **Age**: 0 days
- **Value**: Session creation fixes, lessons learned
- **Target docs**: QUICK_ARCHITECTURE_REFERENCE.md, DOCUMENTATION_INDEX.md

**Key content to extract**:
- Session creation checklist
- Fixed issues and their solutions
- Best practices

---

### Category B: Activity System (3 docs)

#### B1. ACTIVITY_EXECUTION_DIAGNOSIS.md
- **Size**: 7,471 bytes
- **Age**: 0 days
- **Value**: Activity execution troubleshooting
- **Target docs**: README_ARCHITECTURE_DOCS.md, DOCUMENTATION_INDEX.md

**Key content to extract**:
- Common activity execution failures
- Diagnostic procedures
- Resolution patterns

#### B2. ACTIVITY_RELIABILITY_SOLUTION.md
- **Size**: 18,886 bytes
- **Age**: 2 days
- **Value**: Comprehensive reliability patterns
- **Target docs**: README_ARCHITECTURE_DOCS.md, DOCUMENTATION_INDEX.md

**Key content to extract**:
- Reliability best practices
- Error handling patterns
- Recovery strategies
- Testing approaches

#### B3. UNIFIED_ACTIVITY_TEMPLATE_ARCHITECTURE.md
- **Size**: 29,805 bytes
- **Age**: 2 days
- **Value**: Complete activity template architecture
- **Target docs**: README_ARCHITECTURE_DOCS.md, DOCUMENTATION_INDEX.md

**Key content to extract**:
- Template structure
- Proto-first design
- Variant resolution
- Learning system integration

---

### Category C: Architecture & Design (3 docs)

#### C1. CORRECT_ARCHITECTURE_DESIGN.md
- **Size**: 23,525 bytes
- **Age**: 0 days
- **Value**: Authoritative architecture patterns
- **Target docs**: README_ARCHITECTURE_DOCS.md, QUICK_ARCHITECTURE_REFERENCE.md

**Key content to extract**:
- Data flow diagrams
- Component relationships
- Design decisions and rationale
- Anti-patterns to avoid

#### C2. SCHEMA_MISMATCH_ROOT_CAUSE.md
- **Size**: 15,080 bytes
- **Age**: 0 days
- **Value**: Schema alignment lessons
- **Target docs**: DOCUMENTATION_INDEX.md

**Key content to extract**:
- Common schema mismatches
- Alignment strategies
- Proto usage patterns
- Validation approaches

#### C3. PROTO_DATA_STRUCTURE_ALIGNMENT.md
- **Size**: 7,655 bytes
- **Age**: 1 day
- **Value**: Proto as canonical source
- **Target docs**: DOCUMENTATION_INDEX.md

**Key content to extract**:
- Proto-first approach
- Type safety patterns
- Data structure guidelines

---

### Category D: Implementation Summaries (2 docs)

#### D1. PHASE2_FINAL_SUMMARY.md
- **Size**: 16,225 bytes
- **Age**: 0 days
- **Value**: Phase 2 completion details
- **Target docs**: DOCUMENTATION_INDEX.md

**Key content to extract**:
- Completed features
- Learning system status
- Integration points
- Next phase preview

#### D2. V2_MIGRATION_FINAL_SUMMARY.md
- **Size**: 10,830 bytes
- **Age**: 1 day
- **Value**: V2 API migration guide
- **Target docs**: repos/metabob-rpc-api/README.md, DOCUMENTATION_INDEX.md

**Key content to extract**:
- Migration checklist
- Breaking changes
- Compatibility notes
- Deprecation timeline

---

### Category E: Quick Starts (4 docs)

#### E1. BREADCRUMB_QUICK_START.md
- **Size**: 9,467 bytes
- **Age**: 0 days
- **Value**: Debugging with breadcrumbs
- **Target docs**: DOCUMENTATION_INDEX.md

**Key content to extract**:
- Breadcrumb logging setup
- Debugging workflows
- Common patterns

#### E2. DOC_ALIGNMENT_QUICK_START.md
- **Size**: 15,637 bytes
- **Age**: 0 days
- **Value**: Documentation process
- **Target docs**: DOCUMENTATION_INDEX.md

**Key content to extract**:
- Documentation workflow
- Alignment protocols
- Quality standards

#### E3. QUICK_START_V2_API.md
- **Size**: 1,070 bytes
- **Age**: 1 day
- **Value**: V2 API getting started
- **Target docs**: repos/metabob-rpc-api/README.md, DOCUMENTATION_INDEX.md

**Key content to extract**:
- Quick start steps
- Example requests
- Authentication basics

#### E4. QUICK_START_DASHBOARD.md
- **Size**: 2,799 bytes
- **Age**: 1 day
- **Value**: Dashboard setup
- **Target docs**: DOCUMENTATION_INDEX.md

**Key content to extract**:
- Dashboard setup steps
- Cloud mode configuration
- Troubleshooting

---

### Category F: CLI & Tools (1 doc)

#### F1. CLI_PROTO_HANDLING_UPDATE.md
- **Size**: 10,238 bytes
- **Age**: 1 day
- **Value**: CLI proto integration
- **Target docs**: repos/metabob-cli/README.md, DOCUMENTATION_INDEX.md

**Key content to extract**:
- Proto handling updates
- Breaking changes
- Migration examples
- CLI usage patterns

---

### Category G: Performance & Optimization (2 docs)

#### G1. CACHE_THRASHING_FIX.md
- **Size**: 4,159 bytes
- **Age**: 1 day
- **Value**: Cache management solution
- **Target docs**: DOCUMENTATION_INDEX.md

**Key content to extract**:
- Cache thrashing symptoms
- Root cause analysis
- Solution implementation
- Performance improvements

#### G2. CONTEXT_OVERFLOW_PREVENTION_IMPL.md
- **Size**: 26,700 bytes
- **Age**: 2 days
- **Value**: Memory management strategy
- **Target docs**: DOCUMENTATION_INDEX.md

**Key content to extract**:
- Context overflow prevention
- Memory budget management
- Token optimization
- Best practices

---

## Part 3: Percolation Mapping

### 3.1 DOCUMENTATION_INDEX.md (16 percolations)

**Section: Recent Updates (NEW)**
```markdown
## Recent Updates

### February 2026

#### Session & MCP
- [MCP Session Initialization Fix](MCP_SESSION_INITIALIZATION_FIX.md) - Resolved timing issues in MCP session setup
- [Session Creation Fix Summary](SESSION_CREATION_FIX_SUMMARY.md) - Session creation improvements and best practices

#### Activity System
- [Activity Execution Diagnosis](ACTIVITY_EXECUTION_DIAGNOSIS.md) - Troubleshooting guide for activity execution
- [Activity Reliability Solution](ACTIVITY_RELIABILITY_SOLUTION.md) - Comprehensive reliability patterns
- [Unified Activity Template Architecture](UNIFIED_ACTIVITY_TEMPLATE_ARCHITECTURE.md) - Complete activity system design

#### Architecture & Proto
- [Schema Mismatch Root Cause](SCHEMA_MISMATCH_ROOT_CAUSE.md) - Common schema issues and solutions
- [Proto Data Structure Alignment](PROTO_DATA_STRUCTURE_ALIGNMENT.md) - Proto-first design guide
- [Phase 2 Final Summary](PHASE2_FINAL_SUMMARY.md) - Execution & learning system completion

#### API & CLI
- [V2 Migration Final Summary](V2_MIGRATION_FINAL_SUMMARY.md) - Guide to migrating to V2 API
- [CLI Proto Handling Update](CLI_PROTO_HANDLING_UPDATE.md) - CLI proto integration details

#### Quick Starts
- [Breadcrumb Quick Start](BREADCRUMB_QUICK_START.md) - Debugging with breadcrumb logging
- [Doc Alignment Quick Start](DOC_ALIGNMENT_QUICK_START.md) - Documentation workflow guide
- [Quick Start V2 API](QUICK_START_V2_API.md) - Getting started with V2 API
- [Quick Start Dashboard](QUICK_START_DASHBOARD.md) - Dashboard setup and configuration

#### Performance
- [Cache Thrashing Fix](CACHE_THRASHING_FIX.md) - Cache management improvements
- [Context Overflow Prevention](CONTEXT_OVERFLOW_PREVENTION_IMPL.md) - Memory management strategy
```

**Section: By Topic (UPDATE)**
Add cross-references to new content in existing topic sections

---

### 3.2 QUICK_ARCHITECTURE_REFERENCE.md (3 percolations)

**Section: Session Management (NEW/UPDATE)**
```markdown
## Session Management

### MCP Session Initialization

**Flow**:
1. Client connects to MCP server
2. Capabilities negotiation
3. Session context establishment
4. Ready for operations

**Common Issues**:
- Timeout during handshake → Check network and server availability
- Session token not found → Verify metadata.session_token extraction
- Context overflow → Implement token budgeting

**See**: [MCP Session Initialization Fix](../MCP_SESSION_INITIALIZATION_FIX.md) for detailed troubleshooting

### Session Creation Pattern

**Best Practices**:
- Always validate session tokens before use
- Implement proper timeout handling
- Use breadcrumb logging for debugging
- Cache session metadata appropriately

**See**: [Session Creation Fix Summary](../SESSION_CREATION_FIX_SUMMARY.md)
```

**Section: Data Flow (UPDATE)**
```markdown
## Data Flow Architecture

### Correct Design Patterns

The activity system follows a clean data flow:
```
User Request → Activity Manager → V2 API → SurrealDB
                     ↓
              Execution Recording
                     ↓
              Learning System
```

**Key Principles**:
- Proto-first for type safety
- Single source of truth in database
- Immutable event log
- Asynchronous learning

**See**: [Correct Architecture Design](../CORRECT_ARCHITECTURE_DESIGN.md) for complete diagrams
```

---

### 3.3 README_ARCHITECTURE_DOCS.md (4 percolations)

**Section: Activity System (NEW/UPDATE)**
```markdown
## Activity System Architecture

### Overview
The activity system enables template-based workflow execution with learning and optimization.

### Key Documents
- [Unified Activity Template Architecture](../UNIFIED_ACTIVITY_TEMPLATE_ARCHITECTURE.md) - Complete system design
- [Activity Reliability Solution](../ACTIVITY_RELIABILITY_SOLUTION.md) - Reliability patterns and best practices
- [Activity Execution Diagnosis](../ACTIVITY_EXECUTION_DIAGNOSIS.md) - Troubleshooting guide

### Core Concepts
- **Templates**: Reusable workflow definitions in proto format
- **Variants**: Template specializations with success tracking
- **Execution**: Recorded steps with breadcrumb trail
- **Learning**: Thompson sampling for variant selection

### Reliability Best Practices
✅ Validate templates before execution
✅ Implement comprehensive error handling
✅ Use breadcrumb logging throughout
✅ Record all execution steps
✅ Track success metrics

**Last Updated**: Feb 2026
```

**Section: Data Architecture (UPDATE)**
```markdown
## Data Architecture

### Proto-First Design

All data structures are defined in Protocol Buffers as the canonical source of truth.

**Why Proto?**
- Type safety across languages
- Backward compatibility
- Efficient serialization
- Clear contracts

**Key Documents**:
- [Correct Architecture Design](../CORRECT_ARCHITECTURE_DESIGN.md) - Complete data flow diagrams
- [Proto Data Structure Alignment](../PROTO_DATA_STRUCTURE_ALIGNMENT.md) - Proto usage guide

**Last Updated**: Feb 2026
```

---

### 3.4 repos/metabob-cli/README.md (1 percolation)

**Section: Recent Changes (NEW)**
```markdown
## Recent Changes

### February 2026: Proto Integration

The CLI now uses Protocol Buffers for all API communication, providing better type safety and compatibility.

**Key Updates**:
- Proto-compliant request/response handling
- Improved error messages with structured data
- Better V2 API integration

**Migration Guide**: See [CLI Proto Handling Update](../../CLI_PROTO_HANDLING_UPDATE.md) for details

**Breaking Changes**:
- Session token extraction changed to `metadata.session_token`
- Error responses now use structured proto format
- Timestamps use RFC3339 format

**Last Updated**: Feb 9, 2026
```

---

### 3.5 repos/metabob-rpc-api/README.md (2 percolations)

**Section: API Version 2 (NEW)**
```markdown
## API Version 2

### Overview
V2 API provides improved type safety, better error handling, and proto-compliant formats.

**Quick Start**: [Quick Start V2 API](../../QUICK_START_V2_API.md)

**Migration Guide**: [V2 Migration Final Summary](../../V2_MIGRATION_FINAL_SUMMARY.md)

### Key Improvements
- Proto-based request/response formats
- Enhanced authentication flow
- Better error messages
- Improved performance

### Breaking Changes
- Request format changed to proto JSON
- Response structure uses proto field names
- Timestamps now RFC3339 format
- Enum values are strings (not integers)

### Migration Checklist
- [ ] Update request serialization to proto format
- [ ] Update response parsing for proto fields
- [ ] Change timestamp handling to RFC3339
- [ ] Update enum usage to string values
- [ ] Test authentication flow
- [ ] Update error handling

**Last Updated**: Feb 9, 2026
```

---

## Part 4: Cross-Reference Strategy

### 4.1 Bi-directional Links

For each percolation, add:

**In SOURCE document**:
```markdown
> **Note**: Key concepts from this document have been integrated into:
> - [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md#recent-updates)
> - [QUICK_ARCHITECTURE_REFERENCE.md](QUICK_ARCHITECTURE_REFERENCE.md#session-management)
```

**In TARGET document**:
```markdown
**See also**: [Detailed Implementation](SOURCE_DOC.md)
```

### 4.2 Topic Clusters

Create "See Also" sections linking related documents:

```markdown
### See Also: Session Management
- [MCP Session Initialization Fix](MCP_SESSION_INITIALIZATION_FIX.md)
- [Session Creation Fix Summary](SESSION_CREATION_FIX_SUMMARY.md)
- [Quick Architecture Reference: Sessions](QUICK_ARCHITECTURE_REFERENCE.md#session-management)
```

### 4.3 Update Timestamps

Add to all modified sections:
```markdown
**Last Updated**: Feb 9, 2026 | [Change History](CHANGELOG.md)
```

---

## Part 5: Archive Strategy

### 5.1 Keep in Root
Documents that provide ongoing value:
- All QUICK_START_*.md files
- All architecture reference files
- All FINAL_SUMMARY.md files
- Index and navigation files

### 5.2 Move to Archive
Documents that are primarily historical:
- Debug and diagnosis reports (after percolation)
- Intermediate test reports
- Session logs and temporary analyses
- Draft documents

### 5.3 Archive Structure
```
.archive/
  2026-02/
    session-management/
      - MCP_SESSION_INITIALIZATION_FIX.md (copy)
      - SESSION_CREATION_FIX_SUMMARY.md (copy)
    activity-system/
      - ACTIVITY_EXECUTION_DIAGNOSIS.md (copy)
    performance/
      - CACHE_THRASHING_FIX.md (copy)
```

**Important**: Keep originals in root until percolation is complete and verified

---

## Part 6: Implementation Plan

### Phase 1: Preparation (Estimated: 30 min)
1. ✅ Review this plan
2. ✅ Validate all source documents exist
3. ✅ Check foundational docs are readable
4. ✅ Create backup branch in git

### Phase 2: Index Update (Estimated: 45 min)
1. Update DOCUMENTATION_INDEX.md
   - Add "Recent Updates" section
   - Add 16 new entries
   - Update topic navigation
   - Add timestamps

### Phase 3: Quick Reference Update (Estimated: 30 min)
1. Update QUICK_ARCHITECTURE_REFERENCE.md
   - Add Session Management section
   - Update Data Flow section
   - Add troubleshooting entries

### Phase 4: Architecture Docs Update (Estimated: 45 min)
1. Update README_ARCHITECTURE_DOCS.md
   - Add Activity System section
   - Update Data Architecture section
   - Add reliability guidelines

### Phase 5: Component READMEs (Estimated: 30 min)
1. Update repos/metabob-cli/README.md
   - Add Recent Changes section
   - Add migration notes
2. Update repos/metabob-rpc-api/README.md (if exists)
   - Add API V2 section
   - Add migration checklist

### Phase 6: Cross-References (Estimated: 30 min)
1. Add bi-directional links
2. Create topic clusters
3. Add "See Also" sections
4. Update timestamps

### Phase 7: Validation (Estimated: 20 min)
1. Check all links resolve
2. Verify no duplicate content
3. Check formatting consistency
4. Test navigation flow

**Total Estimated Time**: 3.5 hours

---

## Part 7: Quality Checklist

### Before Starting
- [ ] Git branch created for changes
- [ ] All source documents exist and readable
- [ ] Foundational docs backed up
- [ ] Plan reviewed and approved

### During Percolation
- [ ] Preserve original author intent
- [ ] Maintain consistent formatting
- [ ] Add proper attribution
- [ ] Include timestamps
- [ ] Test links as you go

### After Completion
- [ ] All planned updates completed
- [ ] All links verified working
- [ ] No duplicate content
- [ ] Consistent markdown formatting
- [ ] Timestamps added
- [ ] Cross-references complete
- [ ] Git commit with clear message
- [ ] Original docs preserved (not deleted)

### Final Validation
- [ ] Can navigate from index to all content
- [ ] Quick references are truly quick
- [ ] Architecture docs are complete
- [ ] No broken links
- [ ] Content flows logically
- [ ] Update dates are accurate

---

## Part 8: Success Metrics

### Quantitative
- ✅ All 13 foundational docs updated
- ✅ 26 percolations completed
- ✅ 50+ cross-references added
- ✅ 0 broken links
- ✅ 100% of recent valuable content integrated

### Qualitative
- ✅ Developers can find information quickly
- ✅ Documentation tells a coherent story
- ✅ Recent improvements are discoverable
- ✅ Navigation is intuitive
- ✅ Architecture is well documented

---

## Appendix A: File Size Summary

### Source Documents (Total: ~180 KB)
| Category | Files | Total Size |
|----------|-------|------------|
| Session & MCP | 2 | 17 KB |
| Activity System | 3 | 56 KB |
| Architecture | 3 | 46 KB |
| Summaries | 2 | 27 KB |
| Quick Starts | 4 | 29 KB |
| CLI & Tools | 1 | 10 KB |
| Performance | 2 | 31 KB |

### Target Documents
| Document | Current Size | Expected Growth |
|----------|--------------|-----------------|
| DOCUMENTATION_INDEX.md | 5 KB | +3 KB |
| QUICK_ARCHITECTURE_REFERENCE.md | 23 KB | +2 KB |
| README_ARCHITECTURE_DOCS.md | 14 KB | +2 KB |
| CLI README.md | 25 KB | +1 KB |
| API README.md | Unknown | +2 KB |

---

## Appendix B: Markdown Format Standards

### Headers
- Use `##` for main sections
- Use `###` for subsections
- Use `####` for details

### Links
- Relative paths: `[Text](../path/file.md#section)`
- Absolute paths for external: `[Text](https://example.com)`
- Always include anchor for specific sections

### Code Blocks
```markdown
Use fenced code blocks with language
```

### Lists
- Unordered: Use `-` consistently
- Ordered: Use `1.` and let markdown auto-number
- Checkboxes: Use `- [ ]` for tasks

### Callouts
```markdown
> **Note**: Important information

> **Warning**: Caution needed

> ⚠️ **Deprecated**: Use new method instead
```

---

**Status**: Ready for Review
**Mode**: Dry Run - No files modified
**Next Step**: Review plan → Approve → Execute Phase 1

**Contact**: For questions about this plan, see [DOC_ALIGNMENT_QUICK_START.md](DOC_ALIGNMENT_QUICK_START.md)
