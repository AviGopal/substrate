# Documentation Percolation Plan (Dry Run)

**Date:** 2026-02-09  
**Mode:** Dry Run (No files modified)  
**Purpose:** Plan to percolate valuable details from recent test docs to foundational documentation  
**Source Analysis:** doc-jiggle-analysis.md (85 test documentation files analyzed)

---

## Executive Summary

This plan identifies key insights from recent test documentation (all < 30 days old) and maps them to foundational documents that should be updated. The focus is on surfacing valuable patterns, new capabilities, and architectural insights discovered through testing.

### Key Findings

- **85 test documents** analyzed, all recent (< 30 days)
- **8 major testing areas** identified with valuable learnings
- **12 foundational documents** need updates
- **Priority percolations** identified for immediate value

---

## Percolation Strategy

### 1. Activity System Testing → Foundational Architecture Docs

#### Source Documents (19 files)
- `.archive/session-logs/2026-02/ACTIVITY_SYSTEM_TEST_FINAL_REPORT.md`
- `.archive/test-reports/2026-02-06/ACTIVITY_SYSTEM_TEST_REPORT_UPDATED.md`
- `.archive/activity-analysis/ACTIVITY_DATA_FLOW_TEST_REPORT.md`

#### Key Insights to Percolate

**✅ Activity System Status (95% Complete)**
- All 9 V2 API endpoints operational and verified
- Database persistence working (activity_executions table)
- Proto-compliant JSON format throughout
- Session management V2-compatible in both API and CLI
- ActivityManager in metabob-cli 90% complete

**🔧 Implementation Details Discovered**
- V2 API endpoints use Bearer token auth (no X-Internal-Request needed)
- Session token extraction from `metadata.session_token`
- Activity template search using `/v2/activities/templates`
- Execution recording via `/record/start`, `/record/step`, `/record/complete`
- Proto compliance: RFC3339 timestamps, string enums, token structure

**📊 Performance Metrics from Testing**
- Session creation: ~100ms
- Template search (3 results): ~150ms
- Full activity execution cycle: ~5s
- Database persistence: <50ms

#### Target Foundational Documents

**PRIORITY 1: `docs-ACTIVITY_EXECUTION_GUIDE.md`**
- **Add:** V2 API endpoints section with verified endpoints table
- **Add:** Session management flow with proto format examples
- **Add:** Performance benchmarks from testing
- **Add:** ActivityManager implementation status and usage examples
- **Update:** Authentication section (Bearer token pattern)

**PRIORITY 2: `EXISTING_EXECUTION_TRACKING.md`**
- **Add:** Backend tracking infrastructure section
- **Add:** Database schema for activity_executions
- **Add:** Recording endpoints and their verified behavior
- **Update:** Persistence verification approach

**PRIORITY 3: `DOCUMENTATION_INDEX.md`**
- **Update:** Activity System section with completion status (95%)
- **Add:** Reference to V2 API migration completion
- **Add:** Link to activity testing final report

**Changes:**
```markdown
## Activity System (UPDATED)

### Status: 95% Complete ✅

**Working Components:**
- V2 API endpoints (9 endpoints, all operational)
- Database persistence (activity_executions table)
- Proto-compliant JSON format
- Session management (V2-compatible)
- Activity template search and retrieval

**Performance:**
- Session creation: ~100ms
- Template search: ~150ms  
- Full execution cycle: ~5s

### Key Resources
- **Implementation Guide:** docs-ACTIVITY_EXECUTION_GUIDE.md
- **Backend Tracking:** EXISTING_EXECUTION_TRACKING.md
- **Test Results:** .archive/session-logs/2026-02/ACTIVITY_SYSTEM_TEST_FINAL_REPORT.md
```

---

### 2. V2 API Testing → API Architecture & Quick References

#### Source Documents (8 files)
- `repos/metabob-rpc-api/tests/v2_api_test_spec.md` (62.1KB comprehensive spec)
- `.archive/v2-migration-analysis/V2_ENDPOINT_TEST_RESULTS_AND_FIXES.md`
- `repos/metabob-rpc-api/tests/V2_API_TEST_IMPLEMENTATION_SUMMARY.md`

#### Key Insights to Percolate

**✅ V2 API Design Principles (Validated Through Testing)**
- Clean authentication flow: API key → session → Bearer token
- Simple CRUD operations for templates, executions, mutations
- No internal headers (removed X-Internal-Request pattern)
- Bearer-only authentication for all v2 endpoints
- Clean REST: standard HTTP verbs, predictable endpoints

**📋 Verified Endpoint Specifications**

| Endpoint | Method | Status | Response Time | Test Coverage |
|----------|--------|--------|---------------|---------------|
| `/v2/session` | POST | ✅ | ~100ms | 100% |
| `/v2/activities/templates` | GET | ✅ | ~150ms | 100% |
| `/v2/activities/templates` | POST | ✅ | ~200ms | 90% |
| `/v2/activities/templates/{id}` | GET | ✅ | ~50ms | 95% |
| `/v2/activities/record/start` | POST | ✅ | ~100ms | 100% |
| `/v2/activities/record/step` | POST | ✅ | ~50ms | 90% |
| `/v2/activities/record/complete` | POST | ✅ | ~100ms | 100% |
| `/v2/activities/mutate/derive` | POST | ✅ | ~250ms | 85% |
| `/v2/activities/mutate/lineage/{id}` | GET | ✅ | ~75ms | 90% |

**🔐 Authentication Pattern (Validated)**
```python
# Step 1: Create session
headers = {"X-API-Key": api_key}
response = requests.post(f"{base_url}/v2/session", headers=headers)
token = response.json()["metadata"]["session_token"]

# Step 2: Use Bearer token for all subsequent requests
headers = {"Authorization": f"Bearer {token}"}
response = requests.get(f"{base_url}/v2/activities/templates", headers=headers)
```

#### Target Foundational Documents

**PRIORITY 1: `repos/metabob-rpc-api/docs/QUICK_REFERENCE.md`**
- **Add:** V2 API Quick Reference section
- **Add:** Verified endpoints table with response times
- **Add:** Authentication flow examples
- **Add:** Proto format examples from tests

**PRIORITY 2: `API_V2_DESIGN.md`**
- **Update:** Design principles with validation results
- **Add:** "Tested and Verified" badge to completed features
- **Add:** Performance metrics section
- **Add:** Migration completion status

**PRIORITY 3: `repos/metabob-rpc-api/docs/activities/ACTIVITY_API_REFERENCE.md`**
- **Add:** Complete endpoint specifications from test spec
- **Add:** Request/response examples from actual tests
- **Add:** Error handling patterns discovered during testing

**Changes:**
```markdown
## V2 API Quick Reference

### Authentication (Tested ✅)

1. **Get Session Token** (~100ms)
   ```bash
   curl -X POST http://localhost:8000/v2/session \
     -H "X-API-Key: your-api-key"
   ```
   Response: `metadata.session_token`

2. **Use Bearer Token**
   ```bash
   curl -X GET http://localhost:8000/v2/activities/templates \
     -H "Authorization: Bearer your-session-token"
   ```

### Endpoints (All Verified ✅)
[Include verified endpoints table with test coverage]

### Performance Benchmarks
- Session creation: ~100ms
- Template search: ~150ms
- Activity execution: ~5s end-to-end
```

---

### 3. Dashboard E2E Testing → Dashboard Documentation

#### Source Documents (8 files)
- `repos/metabob-dashboard/tests/e2e/README.md` (18.4KB)
- `repos/metabob-dashboard/E2E_TESTS_SUMMARY.md`
- `repos/metabob-dashboard/TEST_EXECUTION_GUIDE.md`
- `repos/metabob-dashboard/PLAYWRIGHT_MCP_TESTING.md`

#### Key Insights to Percolate

**✅ E2E Test Suite Status**
- **20+ authentication tests** (OAuth flow, session persistence, token refresh)
- **25+ dashboard tests** (stats, projects, activity feed, charts)
- **Playwright + MSW** for comprehensive mocking
- **Test coverage:** Auth (100%), Dashboard (90%), Projects (planned)

**🎭 Testing Patterns Validated**
- Page Object Model implementation
- MSW handlers for cloud API mocking
- Test fixtures for reusable data
- Accessibility testing (ARIA labels, keyboard nav)
- Responsive design testing (mobile, tablet, desktop)

**📋 Cloud Mode Features Tested**
- OAuth authentication flow (GitHub, GitLab providers)
- Organization dashboard with stats, charts, activity feed
- Session persistence and token refresh
- API error handling and loading states
- Concurrent OAuth handling

#### Target Foundational Documents

**PRIORITY 1: `repos/metabob-dashboard/README.md`**
- **Add:** Testing section with E2E test suite overview
- **Add:** Quick start for running E2E tests
- **Add:** Cloud mode features with test coverage status
- **Update:** Development workflow to include E2E testing

**PRIORITY 2: `DEVBOB_DASHBOARD_V2_SETUP.md`**
- **Add:** E2E testing setup instructions
- **Add:** Playwright configuration reference
- **Add:** MSW mock setup for development

**PRIORITY 3: `DASHBOARD_INTEGRATION_STATUS.md`**
- **Update:** Cloud mode implementation status
- **Add:** Test coverage metrics
- **Add:** Verified features list from E2E tests

**Changes:**
```markdown
## Dashboard Testing

### E2E Test Suite ✅

**Coverage:**
- Authentication: 20+ tests (100% coverage)
- Dashboard: 25+ tests (90% coverage)
- Projects: Planned
- Settings: Planned

**Running Tests:**
```bash
cd repos/metabob-dashboard
npm run test:e2e              # Run all E2E tests
npm run test:e2e:ui           # Open Playwright UI
npm run test:e2e:cloud        # Cloud mode tests only
```

**Test Structure:**
- Playwright for browser automation
- MSW for API mocking
- Page Object Model for maintainability
- Accessibility and responsive testing

**Verified Features:**
- OAuth authentication (GitHub, GitLab)
- Session persistence and token refresh
- Organization dashboard with real-time stats
- Projects summary and navigation
- Error handling and loading states
```

---

### 4. CLI Testing Patterns → CLI Testing Guide

#### Source Documents (7 files)
- `repos/metabob-cli/tests/TESTING_GUIDE.md` (53.9KB - comprehensive!)
- `repos/metabob-cli/tests/TEST_EXPECTATIONS.md`
- `repos/metabob-cli/tests/smoke/README.md`

#### Key Insights to Percolate

**✅ CLI Testing Best Practices (Already Comprehensive)**
- Test directory organized by type (unit, integration, e2e, contract, performance)
- Fixture system with fast fixtures for unit tests
- Timeless path testing for path handling
- Performance testing across repo sizes (empty/small/medium/large/xlarge)

**🔍 Testing Patterns Worth Highlighting**
- TestController system (opt-in, isolated testing)
- Mock controllers for Redis, LLM, Celery, WebSocket
- Fast feedback with <100ms unit tests
- Contract tests for API/interface verification

#### Target Foundational Documents

**PRIORITY 1: `DOCUMENTATION_INDEX.md`**
- **Add:** Testing section with links to comprehensive guides
- **Add:** CLI testing guide as essential resource
- **Highlight:** 53.9KB comprehensive testing guide

**PRIORITY 2: `repos/metabob-cli/README.md`** (if exists)
- **Add:** "Testing" section with quick reference
- **Link:** to TESTING_GUIDE.md for full details

**Changes:**
```markdown
## Testing Resources

### Comprehensive Testing Guides

**metabob-cli Testing Guide** (53.9KB)
- Complete reference for test creation
- Directory structure by test type
- Fixture system and mocking patterns
- Performance testing across repo sizes
- **Location:** repos/metabob-cli/tests/TESTING_GUIDE.md

**metabob-rpc-api Testing Guide**
- TestController system for isolated tests
- Mock controllers for Redis, LLM, Celery
- Proto-compliant test patterns
- **Location:** repos/metabob-rpc-api/tests/TESTING_GUIDE.md
```

---

### 5. RPC API Test Patterns → Backend Architecture

#### Source Documents (21 files)
- `repos/metabob-rpc-api/tests/TEST_PATTERNS.md` (29.1KB)
- `repos/metabob-rpc-api/tests/routes/ANALYSIS_TEST_PATTERNS_SUCCESS_REPORT.md`
- `repos/metabob-rpc-api/docs/testing/TEST_FAILURE_ANALYSIS.md`

#### Key Insights to Percolate

**✅ Backend Testing Architecture**
- TestController opt-in system for new tests
- Mock controllers for external dependencies
- Proto-aligned API test patterns
- Analysis route testing validated
- Docker testing setup documented

**🏗️ Testing Infrastructure Patterns**
- Isolated test execution (pytest.mark.isolated)
- Fine-grained mock control
- Parallel test execution support (pytest -n auto)
- Integration with Redis, Celery, WebSocket mocks

#### Target Foundational Documents

**PRIORITY 1: `repos/metabob-rpc-api/docs/architecture/API_ARCHITECTURE.md`**
- **Add:** Testing architecture section
- **Add:** TestController system overview
- **Add:** Mock infrastructure diagram

**PRIORITY 2: `METABOB_DATAFLOW_ARCHITECTURE.md`**
- **Add:** Testing and validation layer
- **Add:** Mock boundaries for testing

**Changes:**
```markdown
## Testing Architecture

### TestController System

**Purpose:** Isolated, fast, reproducible tests with fine-grained mocking

**Components:**
- MockRedisController: In-memory Redis simulation
- MockLLMController: LLM response simulation
- MockCeleryController: Job queue simulation
- MockWebSocketController: WebSocket event simulation

**Usage:**
```python
@pytest.mark.isolated
def test_new_feature(test_controller):
    # Completely isolated test environment
    session_id = test_controller.redis.create_session("test")
    test_controller.llm.set_detection_response([...])
    # Test implementation
```

**Benefits:**
- Fast execution (<100ms per test)
- No external dependencies
- Parallel test execution
- Full control over mock behavior
```

---

### 6. OpenCode Testing → OpenCode Documentation

#### Source Documents (4 files)
- `repos/metabob-opencode/.opencode/agent/test.md` (16.2KB)
- `repos/metabob-opencode/packages/opencode/test/IMPULSE_TEST_REFACTORING.md`
- `repos/metabob-opencode/packages/opencode/.memory-profiles/LEAK_OPERATION_TESTING.md`

#### Key Insights to Percolate

**✅ OpenCode Testing Focus**
- Impulse memory management testing
- Test storage isolation patterns
- Memory leak detection and prevention
- Session event regression tests

**🧠 Memory Management Insights**
- Memory leak testing framework established
- Impulse lifecycle tracking
- Test storage isolation prevents cross-contamination

#### Target Foundational Documents

**PRIORITY 1: `repos/metabob-opencode/README.md`**
- **Add:** Testing section
- **Add:** Memory management testing reference
- **Add:** Impulse testing patterns

**PRIORITY 2: `repos/metabob-opencode/packages/opencode/README.md`**
- **Add:** Development testing workflow
- **Link:** to test documentation

**Changes:**
```markdown
## Testing

### Memory Management Testing

OpenCode includes comprehensive memory management testing:

**Test Areas:**
- Impulse lifecycle and cleanup
- Session event handling
- Memory leak detection
- Test storage isolation

**Running Tests:**
```bash
cd packages/opencode
npm test                    # All tests
npm run test:memory         # Memory-specific tests
npm run test:impulse        # Impulse management tests
```

**Memory Testing Tools:**
- Leak operation testing framework
- Memory profiling and monitoring
- Automated leak detection

**Resources:**
- Memory leak testing: `.memory-profiles/LEAK_OPERATION_TESTING.md`
- Impulse refactoring: `test/IMPULSE_TEST_REFACTORING.md`
```

---

### 7. Proto Compliance Testing → Proto Integration Guide

#### Source Documents (From test reports)
- `.archive/test-reports/2026-02/PROTO_COMPLIANCE_VALIDATION_PLAN.md`
- V2 API test results showing proto format validation

#### Key Insights to Percolate

**✅ Proto Format Validation**
- Session responses use `metadata.session_token`
- Activity responses use `variant_id`, `variant_name`, `task_steps`
- Timestamps in RFC3339 format
- Enums as strings (e.g., "ENTITY_STATUS_ACTIVE")
- Token structure: `{input_tokens, output_tokens, cache_tokens, total_tokens}`

**🔍 Validated Proto Patterns**
- Consistent field naming across all endpoints
- Proto-compliant JSON serialization
- Backward compatibility maintained

#### Target Foundational Documents

**PRIORITY 1: `PROTO_SCHEMA_REFERENCE.md`**
- **Add:** Validated format examples from tests
- **Add:** "Tested and Verified" badges
- **Add:** JSON serialization patterns

**PRIORITY 2: `repos/metabob-rpc-api/docs/proto/PROTO_INTEGRATION_GUIDE.md`**
- **Add:** Testing validation results
- **Add:** Proto compliance checklist
- **Update:** Examples with verified formats

**Changes:**
```markdown
## Proto Format Validation ✅

All proto formats have been tested and verified through comprehensive integration tests.

### Session Token Format (Verified ✅)
```json
{
  "metadata": {
    "session_token": "eyJ0eXAi...",
    "created_at": "2026-02-09T11:00:00Z"
  }
}
```

### Activity Template Format (Verified ✅)
```json
{
  "variant_id": "act_123abc",
  "variant_name": "Fix Bug",
  "task_steps": [...],
  "status": "ENTITY_STATUS_ACTIVE"
}
```

### Timestamp Format (RFC3339)
- All timestamps: `2026-02-09T11:00:00Z`
- Timezone: UTC (Z suffix)

### Enum Format (String Values)
- Status: `"ENTITY_STATUS_ACTIVE"`, `"ENTITY_STATUS_ARCHIVED"`
- Not integers or numeric codes
```

---

### 8. Documentation Jiggling Process → Documentation Maintenance

#### Source Documents (13 files)
- `JIGGLE_CREATION_AND_TESTING_REPORT.md`
- `.archive/test-reports/2026-02-jiggle/doc-percolation-plan-enhanced.md`
- `.archive/test-reports/2026-02/doc-jiggle-analysis-enhanced.md` (89.9KB)

#### Key Insights to Percolate

**✅ Documentation Jiggling Process Established**
- Automated analysis by modification date
- Age-based categorization (Recent/Medium/Stale/Obsolete)
- Duplicate detection algorithms
- Archive organization patterns
- Percolation strategy for valuable insights

**📋 Jiggling Results**
- 72 files archived successfully
- 51% reduction in root directory clutter
- All documentation < 30 days old (healthy)
- No obsolete files found

#### Target Foundational Documents

**PRIORITY 1: `DOCUMENTATION_INDEX.md`**
- **Update:** Documentation Maintenance section
- **Add:** Jiggling process overview
- **Add:** Last jiggling date and results

**PRIORITY 2: `DOCUMENTATION_ALIGNMENT_PROTOCOL.md`**
- **Add:** Jiggling process as maintenance step
- **Add:** Percolation strategy
- **Add:** Age-based categorization guidelines

**Changes:**
```markdown
## Documentation Maintenance

### Jiggling Process

**Purpose:** Periodic documentation cleanup, organization, and insight percolation

**Last Run:** 2026-02-09
**Results:**
- 85 test docs analyzed (100% recent)
- 72 files archived
- 51% clutter reduction
- Percolation plan created

**Process:**
1. **Analysis:** Scan all .md files by modification date
2. **Categorization:** Recent (<30d), Medium (30-90d), Stale (90-180d), Obsolete (>180d)
3. **Archiving:** Move dated content to `.archive/`
4. **Percolation:** Surface valuable insights to foundational docs
5. **Validation:** Verify documentation aligns with git history

**Running Jiggling:**
```bash
# Analyze documentation
python analyze_docs.py

# Review percolation plan
cat doc-percolation-plan.md

# Execute jiggling (dry run first)
python jiggle_docs.py --dry-run
```

**Next Scheduled:** Every 30 days or when >10 obsolete files detected
```

---

## Priority Percolation Summary

### Immediate Actions (High Impact)

1. **Activity System Completion Status** → `docs-ACTIVITY_EXECUTION_GUIDE.md`
   - Impact: High (developers need current status)
   - Effort: Low (copy from test report)
   - Estimated time: 15 minutes

2. **V2 API Endpoints Table** → `repos/metabob-rpc-api/docs/QUICK_REFERENCE.md`
   - Impact: High (most frequently referenced)
   - Effort: Low (structured data)
   - Estimated time: 20 minutes

3. **Dashboard Testing Overview** → `repos/metabob-dashboard/README.md`
   - Impact: Medium (useful for new developers)
   - Effort: Low (summary section)
   - Estimated time: 10 minutes

4. **Proto Format Validation** → `PROTO_SCHEMA_REFERENCE.md`
   - Impact: Medium (ensures consistency)
   - Effort: Low (examples from tests)
   - Estimated time: 15 minutes

5. **Testing Resources Index** → `DOCUMENTATION_INDEX.md`
   - Impact: Medium (improves discoverability)
   - Effort: Low (links and summaries)
   - Estimated time: 10 minutes

**Total estimated time for immediate actions:** ~70 minutes

### Secondary Actions (Good to Have)

6. **Activity System Backend Tracking** → `EXISTING_EXECUTION_TRACKING.md`
7. **V2 API Design Validation** → `API_V2_DESIGN.md`
8. **Backend Testing Architecture** → `API_ARCHITECTURE.md`
9. **OpenCode Memory Testing** → `repos/metabob-opencode/README.md`
10. **Dashboard Cloud Mode Status** → `DASHBOARD_INTEGRATION_STATUS.md`

**Total estimated time for secondary actions:** ~90 minutes

### Future Actions (Nice to Have)

11. **Testing patterns** → Various architecture docs
12. **Jiggling process documentation** → Alignment protocol

---

## Percolation Execution Plan

### Phase 1: High-Impact Quick Wins (Day 1)
- Activity system completion status
- V2 API endpoints reference
- Documentation index updates

### Phase 2: Architecture Updates (Day 2)
- Backend testing architecture
- Proto format validation
- Dashboard testing overview

### Phase 3: Comprehensive Updates (Week 2)
- All secondary actions
- Cross-reference updates
- Future action items

---

## Cross-Reference Updates

### Files Requiring Cross-Reference Updates

After percolation, update these files to point to newly updated sections:

1. **DOCUMENTATION_INDEX.md**
   - Update all modified document links
   - Add "Updated" badges with date
   - Update "Last Updated" timestamp

2. **README.md** (root)
   - Update quick links
   - Reference testing guides
   - Link to V2 API documentation

3. **BREADCRUMB_QUICK_START.md**
   - Update activity system references
   - Link to V2 API quick reference
   - Update testing quick start

4. **Quick Reference Docs**
   - Cross-link between CLI, API, and Dashboard references
   - Ensure consistent terminology
   - Update code examples

---

## Validation Checklist

After percolation, validate:

- [ ] All links work (no 404s)
- [ ] Code examples are syntactically correct
- [ ] Timestamps are current
- [ ] Status badges are accurate
- [ ] Cross-references are bidirectional
- [ ] Examples match current API/CLI behavior
- [ ] Performance numbers are from recent tests
- [ ] No contradictory information across docs
- [ ] Formatting is consistent
- [ ] New content integrates smoothly with existing content

---

## Metrics & Success Criteria

### Before Percolation
- Activity system status: Scattered across test reports
- V2 API reference: Incomplete or outdated
- Testing guides: Not indexed in main documentation
- Proto validation: Implied but not documented
- Dashboard testing: Only in E2E test README

### After Percolation (Expected)
- **Activity system status:** Clearly documented in execution guide (95% complete)
- **V2 API reference:** Complete verified endpoint table with performance metrics
- **Testing guides:** Indexed and discoverable from DOCUMENTATION_INDEX.md
- **Proto validation:** Documented with verified examples
- **Dashboard testing:** Summarized in main README with test coverage

### Success Metrics
- **Discoverability:** All insights findable from DOCUMENTATION_INDEX.md
- **Accuracy:** All documented information verified by recent tests
- **Completeness:** No missing critical details from test reports
- **Freshness:** All percolated content dated 2026-02-09
- **Usability:** Developers can find answers in <2 minutes

---

## Notes & Considerations

### What NOT to Percolate

1. **Temporary test data:** Test IDs, timestamps, session tokens
2. **Debug output:** Stack traces, error logs (unless illustrating a pattern)
3. **Work-in-progress notes:** Unvalidated assumptions, TODO lists
4. **Duplicate information:** Content already in foundational docs
5. **Overly specific details:** Implementation minutiae not relevant to users

### Percolation Guidelines

1. **Summarize, don't copy:** Extract key insights, not full reports
2. **Add context:** Explain why the insight matters
3. **Include examples:** Show, don't just tell
4. **Date stamp updates:** Mark percolated content with date
5. **Link to source:** Reference original test reports for details
6. **Maintain voice:** Keep foundational doc tone consistent
7. **Test examples:** Ensure all code snippets work

### Archive Strategy

After percolation, test reports remain in archive for:
- Historical reference
- Audit trail
- Detailed investigation
- Pattern analysis

Do NOT delete test reports after percolation.

---

## Execution Mode: Dry Run

**This is a DRY RUN plan.** No files will be modified.

To execute this plan:

1. **Review plan:** Verify all percolation targets are appropriate
2. **Get approval:** Confirm priorities and scope
3. **Execute Phase 1:** Start with high-impact quick wins
4. **Validate updates:** Check links, examples, formatting
5. **Update cross-references:** Ensure bidirectional linking
6. **Mark as complete:** Update DOCUMENTATION_INDEX with percolation date

**To convert to execution mode:**
```bash
# Review this plan
cat doc-percolation-plan.md

# Execute percolation (with approval)
python percolate_docs.py --execute --plan=doc-percolation-plan.md
```

---

## Appendix: File Mapping

### Source → Target Mappings

| Source Test Doc | Target Foundational Doc | Priority | Time |
|----------------|------------------------|----------|------|
| ACTIVITY_SYSTEM_TEST_FINAL_REPORT.md | docs-ACTIVITY_EXECUTION_GUIDE.md | HIGH | 15m |
| ACTIVITY_SYSTEM_TEST_FINAL_REPORT.md | EXISTING_EXECUTION_TRACKING.md | MED | 15m |
| ACTIVITY_SYSTEM_TEST_FINAL_REPORT.md | DOCUMENTATION_INDEX.md | HIGH | 5m |
| v2_api_test_spec.md | QUICK_REFERENCE.md | HIGH | 20m |
| v2_api_test_spec.md | API_V2_DESIGN.md | MED | 15m |
| v2_api_test_spec.md | ACTIVITY_API_REFERENCE.md | MED | 20m |
| E2E_TESTS_SUMMARY.md | metabob-dashboard/README.md | HIGH | 10m |
| E2E_TESTS_SUMMARY.md | DEVBOB_DASHBOARD_V2_SETUP.md | MED | 10m |
| E2E_TESTS_SUMMARY.md | DASHBOARD_INTEGRATION_STATUS.md | LOW | 10m |
| TESTING_GUIDE.md (cli) | DOCUMENTATION_INDEX.md | HIGH | 5m |
| TEST_PATTERNS.md (rpc) | API_ARCHITECTURE.md | MED | 15m |
| test.md (opencode) | metabob-opencode/README.md | MED | 15m |
| PROTO_COMPLIANCE_VALIDATION_PLAN.md | PROTO_SCHEMA_REFERENCE.md | HIGH | 15m |
| PROTO_COMPLIANCE_VALIDATION_PLAN.md | PROTO_INTEGRATION_GUIDE.md | MED | 10m |
| JIGGLE_CREATION_AND_TESTING_REPORT.md | DOCUMENTATION_INDEX.md | MED | 10m |
| doc-percolation-plan-enhanced.md | DOCUMENTATION_ALIGNMENT_PROTOCOL.md | LOW | 15m |

**Total:** 15 percolations, ~185 minutes (~3 hours)

---

**Plan Status:** Ready for Review  
**Next Step:** Review and approve priorities  
**Execution:** Awaiting approval to proceed
