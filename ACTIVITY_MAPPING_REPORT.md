# Activity Invocation Mapping Report

Generated: 2026-03-07T08:32:57.109Z

## Summary

| Metric | Value |
|--------|-------|
| Total Executions | 484 |
| Total Templates | 87 |
| Total Cost | $380.0402 |
| Total Tokens | 153,442,646 |
| Total Duration | 4271.96 min |
| Avg Success Rate | 74.8% |
| Date Range | 2/27/2026 - 3/7/2026 |

## Executions by Template

### trace-enforce-validate-loop

**Template ID**: `trace-enforce-validate-loop`

**Category**: infrastructure

**Description**: Self-verifying functional state transformation: trace spec/rule/flow through codebase → enforce via code mutations → validate externally via impulses → aggregate conflicts → ripple changes

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 102 |
| Success | 99 |
| Failures | 3 |
| Success Rate | 97.1% |
| Total Cost | $255.5121 |
| Avg Cost | $2.5050 |
| Total Tokens | 78,782,654 |
| Avg Tokens | 772,379 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `trace-specification` | general | Trace how a specification, rule, or user flow is i... | None |
| `enforce-specification` | general | Enforce the specification through code mutations b... | trace-specification |
| `create-validation-harness` | general | Create external validation harness using impulses ... | trace-specification |
| `run-validation` | general | Execute validation harness and collect results... | create-validation-harness, enforce-specification |
| `aggregate-conflicts` | general | Aggregate validation results across all specificat... | run-validation |
| `ripple-changes` | general | Ripple changes across all affected components to e... | aggregate-conflicts |
| `commit-functional-state-transition` | general | Commit the functional state transition with compre... | ripple-changes |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5o3rct...` | done | 51.30m | $2.9391 | 886,767 | 2/27/2026 |
| `act_mm5o9og5...` | done | 22.37m | $2.5138 | 773,756 | 2/27/2026 |
| `act_mm5oonwm...` | done | 26.17m | $2.8208 | 869,272 | 2/27/2026 |
| `act_mm5qmjoc...` | done | 50.78m | $2.5739 | 808,338 | 2/27/2026 |
| `act_mm61evvw...` | done | 24.94m | $2.4346 | 774,110 | 2/28/2026 |
| `act_mm62ovjz...` | done | 22.35m | $2.6862 | 827,865 | 2/28/2026 |
| `act_mm62titn...` | done | 22.86m | $2.7774 | 877,570 | 2/28/2026 |
| `act_mm63nalh...` | done | 24.51m | $2.8141 | 873,363 | 2/28/2026 |
| `act_mm64j3rs...` | done | 23.83m | $2.7080 | 845,872 | 2/28/2026 |
| `act_mm65gbxt...` | done | 18.20m | $2.8518 | 812,821 | 2/28/2026 |
| ... | ... | ... | ... | ... | ... |
| *92 more executions* | | | | | |

---

### trace-data-flow-single-feature

**Template ID**: `trace-data-flow-single-feature`

**Category**: infrastructure

**Description**: Systematically trace how data flows through a feature from entry point to exit point, documenting transformations, validations, and architectural decisions

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 23 |
| Success | 22 |
| Failures | 1 |
| Success Rate | 95.7% |
| Total Cost | $48.3082 |
| Avg Cost | $2.1004 |
| Total Tokens | 12,909,757 |
| Avg Tokens | 561,294 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `identify-entry-point` | general | Identify the entry point(s) for the feature... | None |
| `trace-dependencies` | general | Use CPG to trace dependencies from entry point... | identify-entry-point |
| `document-transformations` | general | Document data transformations and business rules... | trace-dependencies |
| `identify-boundaries` | general | Identify architectural boundaries and integration ... | trace-dependencies |
| `check-related-issues` | general | Check for code quality issues in the data flow... | trace-dependencies |
| `annotate-key-components` | general | Annotate key components with flow documentation... | document-transformations, identify-boundaries |
| `create-flow-diagram` | general | Generate comprehensive flow documentation... | document-transformations, identify-boundaries, check-related-issues |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5o47jm...` | done | 17.99m | $2.0744 | 525,753 | 2/27/2026 |
| `act_mm5owpmk...` | done | 14.53m | $1.8686 | 504,644 | 2/27/2026 |
| `act_mm5pg1m0...` | done | 17.94m | $2.2589 | 631,864 | 2/27/2026 |
| `act_mm5qn5l4...` | done | 22.00m | $2.6305 | 593,405 | 2/27/2026 |
| `act_mm62wg10...` | done | 15.36m | $2.0495 | 523,775 | 2/28/2026 |
| `act_mm70dlqb...` | done | 13.20m | $1.7931 | 462,935 | 2/28/2026 |
| `act_mm75tv3q...` | done | 13.96m | $1.7925 | 473,136 | 2/28/2026 |
| `act_mm77dfte...` | done | 20.77m | $2.3247 | 572,866 | 2/28/2026 |
| `act_mm7lq3qw...` | done | 24.09m | $2.7800 | 819,334 | 3/1/2026 |
| `act_mm8xut2g...` | done | 14.93m | $1.6513 | 412,000 | 3/2/2026 |
| ... | ... | ... | ... | ... | ... |
| *13 more executions* | | | | | |

---

### Test Co-Change Template

**Template ID**: `test-cochange-1772244205250-4mp9n2r9tv4`

**Category**: feature

**Description**: A test template for co-change workflow

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofwlh...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Co-Change Template

**Template ID**: `test-cochange-1772244205254-gwlauuhgxyh`

**Category**: feature

**Description**: A test template for co-change workflow

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofwlk...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Co-Change Template

**Template ID**: `test-cochange-1772244205257-fr241w1b46p`

**Category**: feature

**Description**: A test template for co-change workflow

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofwlm...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Co-Change Template

**Template ID**: `test-cochange-1772244205259-jlpqlxpogwa`

**Category**: feature

**Description**: A test template for co-change workflow

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofwlq...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Co-Change Template

**Template ID**: `test-cochange-1772244205262-weyso3fh91f`

**Category**: feature

**Description**: A test template for co-change workflow

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofwlt...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Co-Change Template

**Template ID**: `test-cochange-1772244205265-326u2ytgu49`

**Category**: feature

**Description**: A test template for co-change workflow

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofwlw...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Co-Change Template

**Template ID**: `test-cochange-1772244205269-h2lxjhyfj5l`

**Category**: feature

**Description**: A test template for co-change workflow

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofwlz...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Co-Change Template

**Template ID**: `test-cochange-1772244205271-b29r0sjjt9a`

**Category**: feature

**Description**: A test template for co-change workflow

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofwm2...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Co-Change Template

**Template ID**: `test-cochange-1772244205275-32i6e1ui0gk`

**Category**: feature

**Description**: A test template for co-change workflow

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofwm5...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Co-Change Template

**Template ID**: `test-cochange-1772244205278-3py5dhliyvx`

**Category**: feature

**Description**: A test template for co-change workflow

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofwm9...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Co-Change Template

**Template ID**: `test-cochange-1772244205281-bg9x5d6o6t6`

**Category**: feature

**Description**: A test template for co-change workflow

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofwmc...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Co-Change Template

**Template ID**: `test-cochange-1772244205285-3zzwpmv2dqs`

**Category**: feature

**Description**: A test template for co-change workflow

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofwmf...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Co-Change Template

**Template ID**: `test-cochange-1772244205288-8o8hzgxvuj2`

**Category**: feature

**Description**: A test template for co-change workflow

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofwmi...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Co-Change Template

**Template ID**: `test-cochange-1772244205291-0i0qfad31h`

**Category**: feature

**Description**: A test template for co-change workflow

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofwmn...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Co-Change Template

**Template ID**: `test-cochange-1772244205296-vg3q4495olf`

**Category**: feature

**Description**: A test template for co-change workflow

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |
| `task-2` | config | Task task-2... | task-1 |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofwmq...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Co-Change Template

**Template ID**: `test-cochange-1772244205299-ozlounhc2un`

**Category**: feature

**Description**: A test template for co-change workflow

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofwmt...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Co-Change Template

**Template ID**: `test-cochange-1772244205302-064ngh3feb3e`

**Category**: feature

**Description**: A test template for co-change workflow

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofwmw...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Co-Change Template

**Template ID**: `test-cochange-1772244205305-x4lfnesft9`

**Category**: feature

**Description**: A test template for co-change workflow

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofwmz...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Co-Change Template

**Template ID**: `test-cochange-1772244205308-f6u3tir6cqf`

**Category**: feature

**Description**: A test template for co-change workflow

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofwn4...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Co-Change Template

**Template ID**: `test-cochange-1772244205313-hsa7oms7hlo`

**Category**: feature

**Description**: A test template for co-change workflow

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofwn8...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Co-Change Template

**Template ID**: `test-cochange-1772244205316-lkd97d4tt2`

**Category**: feature

**Description**: A test template for co-change workflow

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofwnb...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Template

**Template ID**: `test-template-1772244205341-hvqddf7xo9`

**Category**: feature

**Description**: A test template

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |
| `task-2` | config | Task task-2... | None |
| `task-3` | config | Task task-3... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofwo1...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Template

**Template ID**: `test-template-1772244205346-1pu0uo1etrk`

**Category**: feature

**Description**: A test template

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |
| `task-2` | config | Task task-2... | task-1 |
| `task-3` | config | Task task-3... | task-2 |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofwo4...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Template

**Template ID**: `test-template-1772244205349-mbi6vkmhmua`

**Category**: feature

**Description**: A test template

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |
| `task-2` | config | Task task-2... | task-1 |
| `task-3` | config | Task task-3... | task-1 |
| `task-4` | config | Task task-4... | task-2, task-3 |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofwo7...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Template

**Template ID**: `test-template-1772244205352-pvm4eekid39`

**Category**: feature

**Description**: A test template

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofwoa...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Template

**Template ID**: `test-template-1772244205355-tar36su2vp`

**Category**: feature

**Description**: A test template

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofwod...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Template

**Template ID**: `test-template-1772244205358-6nm6lpujyw`

**Category**: feature

**Description**: A test template

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofwok...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Template

**Template ID**: `test-template-1772244205364-r7iwtfw8mrs`

**Category**: feature

**Description**: A test template

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofwom...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Template

**Template ID**: `test-template-1772244205367-bl597xgfupe`

**Category**: feature

**Description**: A test template

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofwop...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Template

**Template ID**: `test-template-1772244205370-cu9s3jhyn0j`

**Category**: feature

**Description**: A test template

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofwot...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Co-Change Template

**Template ID**: `test-cochange-1772244206076-314jl6sdxu7`

**Category**: feature

**Description**: A test template for co-change workflow

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofx8g...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Co-Change Template

**Template ID**: `test-cochange-1772244206081-4ym4ak3htgt`

**Category**: feature

**Description**: A test template for co-change workflow

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofx8j...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Co-Change Template

**Template ID**: `test-cochange-1772244206084-fhuz3w862n`

**Category**: feature

**Description**: A test template for co-change workflow

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofx8n...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Co-Change Template

**Template ID**: `test-cochange-1772244206087-9d3aim3nrkq`

**Category**: feature

**Description**: A test template for co-change workflow

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofx8p...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Co-Change Template

**Template ID**: `test-cochange-1772244206090-66tunx7z0il`

**Category**: feature

**Description**: A test template for co-change workflow

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofx8s...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Co-Change Template

**Template ID**: `test-cochange-1772244206093-r9368z5hw1m`

**Category**: feature

**Description**: A test template for co-change workflow

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofx8y...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Co-Change Template

**Template ID**: `test-cochange-1772244206099-co2nl2kcxja`

**Category**: feature

**Description**: A test template for co-change workflow

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofx92...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Co-Change Template

**Template ID**: `test-cochange-1772244206102-0c6jgqyxr4c5`

**Category**: feature

**Description**: A test template for co-change workflow

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofx95...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Co-Change Template

**Template ID**: `test-cochange-1772244206106-tiq1egflscd`

**Category**: feature

**Description**: A test template for co-change workflow

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofx98...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Co-Change Template

**Template ID**: `test-cochange-1772244206109-89xd4fs0e0w`

**Category**: feature

**Description**: A test template for co-change workflow

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofx9e...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Co-Change Template

**Template ID**: `test-cochange-1772244206115-gycmmv7xiq6`

**Category**: feature

**Description**: A test template for co-change workflow

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofx9i...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Co-Change Template

**Template ID**: `test-cochange-1772244206119-vhrh1660e3`

**Category**: feature

**Description**: A test template for co-change workflow

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofx9l...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Co-Change Template

**Template ID**: `test-cochange-1772244206122-t3hazzi6k5r`

**Category**: feature

**Description**: A test template for co-change workflow

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofx9o...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Co-Change Template

**Template ID**: `test-cochange-1772244206125-wzm8am5bubc`

**Category**: feature

**Description**: A test template for co-change workflow

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofx9s...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Co-Change Template

**Template ID**: `test-cochange-1772244206129-fanj57y1s7`

**Category**: feature

**Description**: A test template for co-change workflow

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |
| `task-2` | config | Task task-2... | task-1 |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofx9v...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Co-Change Template

**Template ID**: `test-cochange-1772244206132-o6qh7slbf8`

**Category**: feature

**Description**: A test template for co-change workflow

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofx9z...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Co-Change Template

**Template ID**: `test-cochange-1772244206136-fmq3uhcip0i`

**Category**: feature

**Description**: A test template for co-change workflow

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofxa2...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Co-Change Template

**Template ID**: `test-cochange-1772244206139-g8c34xuay2c`

**Category**: feature

**Description**: A test template for co-change workflow

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofxa6...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Co-Change Template

**Template ID**: `test-cochange-1772244206143-j9t9wgsz2af`

**Category**: feature

**Description**: A test template for co-change workflow

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofxac...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Co-Change Template

**Template ID**: `test-cochange-1772244206148-3ahyp8m27jx`

**Category**: feature

**Description**: A test template for co-change workflow

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofxae...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Co-Change Template

**Template ID**: `test-cochange-1772244206151-quo35l44s3`

**Category**: feature

**Description**: A test template for co-change workflow

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofxai...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Template

**Template ID**: `test-template-1772244206174-8etwhfbhhqf`

**Category**: feature

**Description**: A test template

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |
| `task-2` | config | Task task-2... | None |
| `task-3` | config | Task task-3... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofxb6...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Template

**Template ID**: `test-template-1772244206179-l4jy8lpgj8`

**Category**: feature

**Description**: A test template

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |
| `task-2` | config | Task task-2... | task-1 |
| `task-3` | config | Task task-3... | task-2 |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofxb9...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Template

**Template ID**: `test-template-1772244206183-e8sqia5lyq7`

**Category**: feature

**Description**: A test template

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |
| `task-2` | config | Task task-2... | task-1 |
| `task-3` | config | Task task-3... | task-1 |
| `task-4` | config | Task task-4... | task-2, task-3 |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofxbd...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Template

**Template ID**: `test-template-1772244206186-5xrb899klek`

**Category**: feature

**Description**: A test template

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofxbg...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Template

**Template ID**: `test-template-1772244206189-g4m7k7jm82`

**Category**: feature

**Description**: A test template

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofxbj...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Template

**Template ID**: `test-template-1772244206191-bfk9um2slki`

**Category**: feature

**Description**: A test template

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofxbo...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Template

**Template ID**: `test-template-1772244206197-31ifwyu7lra`

**Category**: feature

**Description**: A test template

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofxbr...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Template

**Template ID**: `test-template-1772244206201-jd27jyjghbm`

**Category**: feature

**Description**: A test template

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofxbw...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Test Template

**Template ID**: `test-template-1772244206205-4xn2mpqi5cm`

**Category**: feature

**Description**: A test template

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | config | Task task-1... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofxc0...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### End-to-End Activity Execution Validation

**Template ID**: `undefined`

**Category**: infrastructure

**Description**: Comprehensive validation of complete activity execution data flow: CLI → Backend → Redis → Thompson Sampling → Metrics. Tests template registration, execution recording, and metrics retrieval.

**Status**: unknown

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 10 |
| Success | 0 |
| Failures | 10 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | general | Verify backend connectivity and Redis availability... | None |
| `task-2` | general | Create test activity template and verify registrat... | task-1 |
| `task-3` | general | Execute test template and verify execution recordi... | task-2 |
| `task-4` | general | Verify end-to-end metrics flow and create validati... | task-3 |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ofycy...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |
| `act_mm5ofydd...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |
| `act_mm5ofydn...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |
| `act_mm5ofydq...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |
| `act_mm5ofydq...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |
| `act_mm5ofyx8...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |
| `act_mm5ofyxj...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |
| `act_mm5ofyxr...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |
| `act_mm5ofyxs...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |
| `act_mm5ofyxs...` | setup | 0.00m | $0.0000 | 0 | 2/27/2026 |

---

### Manage Session Memory

**Template ID**: `manage-session-memory`

**Category**: infrastructure

**Description**: Pre-turn memory management: analyze user intent, create impulses, load context, prioritize, compress. Runs before main agent to prepare optimal context.

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 248 |
| Success | 233 |
| Failures | 15 |
| Success Rate | 94.0% |
| Total Cost | $64.0498 |
| Avg Cost | $0.2583 |
| Total Tokens | 58,109,231 |
| Avg Tokens | 234,311 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `analyze-intent` | memory | Analyze user intent and determine what context is ... | None |
| `create-impulses` | memory | Create impulses from analysis (unloaded state)... | analyze-intent |
| `review-context-space` | memory | Review context space and decide what to load... | create-impulses |
| `optimize-if-needed` | memory | Compress or reorder if context is too tight... | review-context-space |
| `finalize-context` | memory | Final context space review and summary... | optimize-if-needed |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5ongud...` | done | 0.67m | $0.2908 | 217,537 | 2/27/2026 |
| `act_mm5osea8...` | done | 2.60m | $0.3499 | 304,901 | 2/27/2026 |
| `act_mm5q1959...` | done | 1.37m | $0.2713 | 250,884 | 2/27/2026 |
| `act_mm5qfz4u...` | done | 1.72m | $0.3118 | 266,044 | 2/27/2026 |
| `act_mm5qgkdl...` | done | 1.07m | $0.2544 | 240,052 | 2/27/2026 |
| `act_mm5qk66m...` | done | 1.64m | $0.2688 | 251,941 | 2/27/2026 |
| `act_mm5qzwvo...` | done | 2.77m | $0.3298 | 304,995 | 2/27/2026 |
| `act_mm5r1zy6...` | done | 1.55m | $0.2516 | 237,898 | 2/27/2026 |
| `act_mm615qxm...` | done | 0.84m | $0.2405 | 222,143 | 2/27/2026 |
| `act_mm618929...` | done | 0.79m | $0.2340 | 217,444 | 2/28/2026 |
| ... | ... | ... | ... | ... | ... |
| *238 more executions* | | | | | |

---

### create-activity

**Template ID**: `create-activity`

**Category**: unknown

**Description**: N/A

**Status**: unknown

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 14 |
| Success | 1 |
| Failures | 13 |
| Success Rate | 7.1% |
| Total Cost | $2.9265 |
| Avg Cost | $0.2090 |
| Total Tokens | 854,965 |
| Avg Tokens | 61,069 |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5qnh4k...` | failed | 1.26m | $0.1593 | 40,896 | 2/27/2026 |
| `act_mm6257td...` | failed | 4.67m | $0.1844 | 59,109 | 2/28/2026 |
| `act_mm7qk5uc...` | failed | 1.50m | $0.1832 | 44,720 | 3/1/2026 |
| `act_mm7qmglo...` | failed | 2.32m | $0.2008 | 49,617 | 3/1/2026 |
| `act_mm8470r0...` | failed | 0.72m | $0.1132 | 34,484 | 3/1/2026 |
| `act_mm8fhud5...` | failed | 2.13m | $0.2063 | 57,649 | 3/1/2026 |
| `act_mm8fum5v...` | failed | 0.79m | $0.1530 | 40,250 | 3/1/2026 |
| `act_mm9wsjqn...` | failed | 1.09m | $0.1610 | 41,431 | 3/2/2026 |
| `act_mmakw9rt...` | failed | 5.46m | $0.2671 | 85,327 | 3/3/2026 |
| `act_mmausxov...` | failed | 0.96m | $0.1249 | 36,305 | 3/3/2026 |
| ... | ... | ... | ... | ... | ... |
| *4 more executions* | | | | | |

---

### Verify Metabob Data Sources

**Template ID**: `verify-metabob-data-sources`

**Category**: infrastructure

**Description**: Systematically verify all Metabob MCP tools trace back to documented data sources with evidence. Detects tools that return empty/invalid responses and enforces validation conditions.

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `list-all-metabob-tools` | general | Enumerate all Metabob MCP tools and their claimed ... | None |
| `trace-each-tool` | general | Trace data flow for each high-priority tool using ... | list-all-metabob-tools |
| `verify-claims-vs-reality` | general | Compare claimed capabilities against actual implem... | trace-each-tool |
| `test-for-empty-responses` | general | Execute each tool and detect empty/invalid respons... | list-all-metabob-tools |
| `create-validation-enforcement` | general | Add response validation to tools that return empty... | test-for-empty-responses, verify-claims-vs-reality |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5r7bzh...` | failed | 0.11m | $0.0000 | 0 | 2/27/2026 |

---

### Improve Metabob Search with Embeddings

**Template ID**: `improve-metabob-search-with-embeddings`

**Category**: feature

**Description**: Replace keyword-based search in metabob_search_codebase_issues with real semantic search using CPG cochange embeddings. Integrates CoChangePredictor for ML-based similarity.

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 2 |
| Success | 0 |
| Failures | 2 |
| Success Rate | 0.0% |
| Total Cost | $0.4509 |
| Avg Cost | $0.2255 |
| Total Tokens | 133,468 |
| Avg Tokens | 66,734 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `analyze-current-search` | general | Document current keyword search implementation... | None |
| `design-embedding-integration` | general | Design how to integrate CoChangePredictor for sema... | analyze-current-search |
| `implement-semantic-search` | general | Implement SemanticIssueSearch class with embedding... | design-embedding-integration |
| `add-tests` | general | Add tests comparing keyword vs embedding search qu... | implement-semantic-search |
| `update-documentation` | general | Update system prompt to reflect actual semantic se... | implement-semantic-search, add-tests |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm5rbdjl...` | failed | 1.80m | $0.2475 | 68,823 | 2/27/2026 |
| `act_mm6177ke...` | failed | 3.01m | $0.2035 | 64,645 | 2/28/2026 |

---

### Complete Metabob Search Embedding Integration

**Template ID**: `complete-metabob-search-embedding-integration`

**Category**: feature

**Description**: Complete the remaining tasks (2-5) from improve-metabob-search-with-embeddings: design, implement, test, and document semantic search with CPG embeddings

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 2 |
| Success | 0 |
| Failures | 2 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `design-embedding-integration` | general | Design how to integrate CoChangePredictor for sema... | None |
| `implement-semantic-search` | general | Implement SemanticIssueSearch class with embedding... | design-embedding-integration |
| `add-tests` | general | Add tests comparing keyword vs embedding search qu... | implement-semantic-search |
| `update-documentation` | general | Update system prompts and docs to reflect actual s... | implement-semantic-search, add-tests |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm61jqs6...` | failed | 0.12m | $0.0000 | 0 | 2/28/2026 |
| `act_mm61muue...` | failed | 0.12m | $0.0000 | 0 | 2/28/2026 |

---

### Initialize Database Schema in Kubernetes

**Template ID**: `initialize-database-schema-in-kubernetes`

**Category**: infrastructure

**Description**: Initialize SurrealDB schema in a Kubernetes deployment by executing the schema SQL file via a pod with database access. Handles both devbob and metabob-rpc-api pods.

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 2 |
| Success | 0 |
| Failures | 2 |
| Success Rate | 0.0% |
| Total Cost | $0.4875 |
| Avg Cost | $0.2438 |
| Total Tokens | 150,561 |
| Avg Tokens | 75,281 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `task-1` | general | Verify Kubernetes context and locate target pod fo... | None |
| `task-2` | general | Read and prepare the schema SQL for execution... | task-1 |
| `task-3` | general | Execute schema initialization via kubectl exec... | task-2 |
| `task-4` | general | Verify schema was created successfully... | task-3 |
| `task-5` | general | Document initialization and update deployment note... | task-4 |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm61p1i2...` | failed | 1.32m | $0.2288 | 72,605 | 2/28/2026 |
| `act_mm62rin5...` | failed | 1.96m | $0.2587 | 77,956 | 2/28/2026 |

---

### Enforce Architecture Separation: Metabob Components

**Template ID**: `enforce-architecture-separation-metabob-components`

**Category**: refactor

**Description**: Enforce separation of concerns between metabob-opencode, metabob-cli, and metabob-rpc-api. Each task uses trace-enforce-validate-loop to define constraints and enforce them across the architecture.

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 4 |
| Success | 2 |
| Failures | 2 |
| Success Rate | 50.0% |
| Total Cost | $2.5797 |
| Avg Cost | $0.6449 |
| Total Tokens | 794,587 |
| Avg Tokens | 198,647 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `phase-1-remove-ml-from-opencode` | general | Remove all ML/learning logic from metabob-opencode... | None |
| `phase-2-complete-learning-loop-rpc-api` | general | Complete the learning loop implementation in metab... | phase-1-remove-ml-from-opencode |
| `phase-3-storage-consolidation` | general | Consolidate storage with SurrealDB as primary, Red... | phase-2-complete-learning-loop-rpc-api |
| `phase-4-validate-separation` | general | Validate complete architecture separation across a... | phase-3-storage-consolidation |
| `commit-architecture-refactor` | general | Commit all architecture changes with comprehensive... | phase-4-validate-separation |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm62rnbl...` | done | 199.90m | $1.1222 | 351,908 | 2/28/2026 |
| `act_mm6i4zsi...` | executing | 0.00m | $0.0000 | 0 | 2/28/2026 |
| `act_mm6zhphh...` | executing | 0.00m | $0.0000 | 0 | 2/28/2026 |
| `act_mm73mjdt...` | done | 214.10m | $1.4575 | 442,679 | 2/28/2026 |

---

### Test Delegation to K8s Pods

**Template ID**: `test-delegation-to-k8s-pods`

**Category**: infrastructure

**Description**: Quick validation of acp_delegate with devbob pods in Kubernetes

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `test-basic-delegation` | general | Test basic delegation to devbob-0 pod... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm76wdct...` | executing | 0.00m | $0.0000 | 0 | 2/28/2026 |

---

### Test TCP Delegation to K8s Devbob Pods

**Template ID**: `test-tcp-delegation-to-k8s-devbob-pods`

**Category**: infrastructure

**Description**: Test acp_delegate using TCP transport to devbob pods running ACP servers on port 3000

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 1 |
| Failures | 0 |
| Success Rate | 100.0% |
| Total Cost | $0.3824 |
| Avg Cost | $0.3824 |
| Total Tokens | 112,136 |
| Avg Tokens | 112,136 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `test-tcp-delegation` | general | Test TCP delegation to devbob pods via headless se... | None |
| `test-impulse-sharing` | general | Test impulse sharing via TCP delegation... | test-tcp-delegation |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm774rb7...` | done | 5.96m | $0.3824 | 112,136 | 2/28/2026 |

---

### Build and Test SurrealDB HTTP RPC Fix

**Template ID**: `build-and-test-surrealdb-http-rpc-fix`

**Category**: infrastructure

**Description**: Build Docker image with HTTP RPC client fix, run local tests to verify persistence works correctly, validate template CRUD operations

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.7376 |
| Avg Cost | $0.7376 |
| Total Tokens | 224,765 |
| Avg Tokens | 224,765 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `verify-prerequisites` | general | Check that Docker is installed and running, verify... | None |
| `build-docker-image` | general | Build Docker image with HTTP RPC client fix and ta... | verify-prerequisites |
| `start-test-environment` | general | Launch Docker containers with the fixed image and ... | build-docker-image |
| `run-persistence-tests` | general | Execute comprehensive CRUD tests to validate templ... | start-test-environment |
| `cleanup-environment` | general | Stop and remove test containers, preserve logs for... | run-persistence-tests |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm7qrryb...` | failed | 17.46m | $0.7376 | 224,765 | 3/1/2026 |

---

### Retest HTTP RPC Fix with Activity ID Lookup

**Template ID**: `retest-http-rpc-fix-with-activity-id-lookup`

**Category**: infrastructure

**Description**: Rebuild Docker image with activity_id lookup fix and run comprehensive tests to verify templates are retrievable by both variant_id and activity_id

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.8618 |
| Avg Cost | $0.8618 |
| Total Tokens | 203,471 |
| Avg Tokens | 203,471 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `rebuild-docker-image` | general | Rebuild Docker image with the latest activity_id l... | None |
| `restart-test-environment` | general | Restart test environment with the newly built imag... | rebuild-docker-image |
| `test-activity-id-lookup` | general | Run comprehensive tests to verify activity_id look... | restart-test-environment |
| `generate-test-report` | general | Generate comprehensive test report and cleanup env... | test-activity-id-lookup |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm7zk2tt...` | failed | 39.65m | $0.8618 | 203,471 | 3/1/2026 |

---

### Deploy HTTP RPC Fix to Kubernetes

**Template ID**: `deploy-http-rpc-fix-to-kubernetes`

**Category**: infrastructure

**Description**: Build final Docker image with complete HTTP RPC fix, push to registry, update helmfile values, deploy to K8s, and test all constraints

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 3 |
| Success | 0 |
| Failures | 3 |
| Success Rate | 0.0% |
| Total Cost | $1.0723 |
| Avg Cost | $0.3574 |
| Total Tokens | 341,043 |
| Avg Tokens | 113,681 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `build-and-push-image` | general | Build final Docker image with both fixes and push ... | None |
| `update-helmfile-values` | general | Update helmfile values to use new image tag... | build-and-push-image |
| `deploy-to-k8s` | general | Deploy RPC API to Kubernetes using helmfile... | update-helmfile-values |
| `test-constraints` | general | Run comprehensive constraint tests to verify all f... | deploy-to-k8s |
| `generate-final-report` | general | Generate comprehensive deployment report with all ... | test-constraints |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm81gi0j...` | failed | 25.52m | $0.1642 | 51,207 | 3/1/2026 |
| `act_mm82lb6p...` | failed | 34.61m | $0.9082 | 289,836 | 3/1/2026 |
| `act_mm8q536x...` | failed | 2.82m | $0.0000 | 0 | 3/1/2026 |

---

### Investigate SurrealDB Database State in K8s

**Template ID**: `investigate-surrealdb-database-state-in-k8s`

**Category**: infrastructure

**Description**: Connect to SurrealDB pod in K8s, check database/namespace configuration, verify table structure, query activity_template table, identify why queries return empty

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.3072 |
| Avg Cost | $0.3072 |
| Total Tokens | 93,363 |
| Avg Tokens | 93,363 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `check-surrealdb-pod-status` | general | Verify SurrealDB pod is running and accessible... | None |
| `query-database-structure` | general | Connect to SurrealDB and check what namespaces, da... | check-surrealdb-pod-status |
| `analyze-configuration-mismatch` | general | Compare RPC API configuration with actual database... | query-database-structure |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm84cnoa...` | failed | 3.68m | $0.3072 | 93,363 | 3/1/2026 |

---

### Fix SurrealDB Persistent Storage Configuration

**Template ID**: `fix-surrealdb-persistent-storage-configuration`

**Category**: infrastructure

**Description**: Configure SurrealDB to use persistent storage (PVC) instead of in-memory mode, update helm values to use RocksDB/SurrealKV, redeploy, and verify data persistence across restarts

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 1 |
| Failures | 0 |
| Success Rate | 100.0% |
| Total Cost | $0.5812 |
| Avg Cost | $0.5812 |
| Total Tokens | 171,820 |
| Avg Tokens | 171,820 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `backup-current-config` | general | Backup current SurrealDB configuration and deploym... | None |
| `create-pvc-and-update-helm` | general | Create PVC for SurrealDB and update helm values to... | backup-current-config |
| `deploy-with-persistent-storage` | general | Apply the persistent storage configuration and red... | create-pvc-and-update-helm |
| `initialize-schema-and-verify` | general | Initialize database schema and verify data persist... | deploy-with-persistent-storage |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm84m7od...` | done | 3.06m | $0.5812 | 171,820 | 3/1/2026 |

---

### Verify HTTP RPC and Persistence End-to-End

**Template ID**: `verify-http-rpc-and-persistence-end-to-end`

**Category**: infrastructure

**Description**: Complete end-to-end verification of the HTTP RPC fix and persistent storage: register template via HTTP RPC, retrieve by activity_id, restart pod, verify template still exists

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 1 |
| Failures | 0 |
| Success Rate | 100.0% |
| Total Cost | $0.5795 |
| Avg Cost | $0.5795 |
| Total Tokens | 179,716 |
| Avg Tokens | 179,716 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `verify-http-rpc-registration` | general | Test template registration via HTTP RPC endpoints... | None |
| `verify-persistence-across-restart` | general | Restart SurrealDB pod and verify template still ex... | verify-http-rpc-registration |
| `create-final-report` | general | Generate comprehensive end-to-end verification rep... | verify-persistence-across-restart |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm84stm9...` | done | 6.28m | $0.5795 | 179,716 | 3/1/2026 |

---

### Create Demo Utility Function

**Template ID**: `create-demo-utility-function`

**Category**: feature

**Description**: Create a simple utility function with tests to demonstrate activity execution and git workflow

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 1 |
| Failures | 0 |
| Success Rate | 100.0% |
| Total Cost | $0.1038 |
| Avg Cost | $0.1038 |
| Total Tokens | 33,624 |
| Avg Tokens | 33,624 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `create-utility-function` | general | Create a simple utility function for demonstration... | None |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm8ctzjn...` | done | 0.51m | $0.1038 | 33,624 | 3/1/2026 |

---

### Rebuild and Deploy with Helmfile

**Template ID**: `rebuild-and-deploy-with-helmfile`

**Category**: infrastructure

**Description**: Rebuild Docker images and deploy to local/production using the helmfile DRY deployment pattern in repos/platform/metabob-apps/

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 2 |
| Success | 0 |
| Failures | 2 |
| Success Rate | 0.0% |
| Total Cost | $0.2485 |
| Avg Cost | $0.1243 |
| Total Tokens | 78,294 |
| Avg Tokens | 39,147 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `verify-environment` | general | Verify helmfile environment configuration and clus... | None |
| `build-images` | general | Build Docker images for deployment... | verify-environment |
| `push-images` | general | Push images to container registry (skip for local)... | build-images |
| `helmfile-diff` | general | Preview deployment changes with helmfile diff... | push-images |
| `helmfile-sync` | general | Apply deployment with helmfile sync... | helmfile-diff |
| `validate-deployment` | general | Validate deployment health and pod readiness... | helmfile-sync |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm8qgkex...` | failed | 0.44m | $0.1063 | 33,582 | 3/1/2026 |
| `act_mm8qhf6s...` | failed | 1.30m | $0.1422 | 44,712 | 3/1/2026 |

---

### Fix Bug Complete

**Template ID**: `fix-bug-complete`

**Category**: bugfix

**Description**: Complete bug fix workflow: reproduce, analyze root cause, fix, test, commit, and annotate. Systematic debugging approach for reliable fixes.

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.0000 |
| Avg Cost | $0.0000 |
| Total Tokens | 0 |
| Avg Tokens | 0 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `reproduce-and-analyze` | general | Reproduce the bug and analyze root cause... | None |
| `implement-fix` | general | Implement the bug fix... | reproduce-and-analyze |
| `test-and-verify` | general | Test the fix and verify bug is resolved... | implement-fix |
| `commit-and-document` | general | Commit the fix and document the resolution... | test-and-verify |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mm9xa0lt...` | failed | 0.34m | $0.0000 | 0 | 3/2/2026 |

---

### Evolve Activity Template (Self-Contained)

**Template ID**: `evolve-activity-self-contained`

**Category**: infrastructure

**Description**: Improve existing activity templates based on execution metrics and learnings without requiring git history or local files - fully self-contained

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 0 |
| Failures | 1 |
| Success Rate | 0.0% |
| Total Cost | $0.4738 |
| Avg Cost | $0.4738 |
| Total Tokens | 148,924 |
| Avg Tokens | 148,924 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `fetch-template-and-metrics` | general | Fetch template definition and execution metrics fr... | None |
| `identify-improvements` | general | Analyze metrics to identify specific, high-impact ... | fetch-template-and-metrics |
| `create-improved-template` | general | Generate new template variant with improvements ap... | identify-improvements |
| `document-evolution` | general | Create evolution report documenting changes, ratio... | create-improved-template |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mmav204n...` | failed | 14.48m | $0.4738 | 148,924 | 3/3/2026 |

---

### Debug Activity Execution (Self-Contained)

**Template ID**: `debug-activity-self-contained`

**Category**: infrastructure

**Description**: Debug failed activity executions using activity_error_inspector MCP tool - follows architecture compliance

**Status**: stable

**Template Metrics**:

| Metric | Value |
|--------|-------|
| Executions | 1 |
| Success | 1 |
| Failures | 0 |
| Success Rate | 100.0% |
| Total Cost | $0.3772 |
| Avg Cost | $0.3772 |
| Total Tokens | 120,267 |
| Avg Tokens | 120,267 |

**Task Composition**:

| Task ID | Subagent | Description | Dependencies |
|---------|----------|-------------|--------------|
| `inspect-execution-errors` | general | Use activity_error_inspector tool to get comprehen... | None |
| `generate-fix-recommendations` | general | Generate concrete fixes based on error analysis... | inspect-execution-errors |

**Individual Executions**:

| ID | Status | Duration | Cost | Tokens | Date |
|----|--------|----------|------|--------|------|
| `act_mmbwhm2g...` | done | 10.04m | $0.3772 | 120,267 | 3/4/2026 |

---

## Impulse Usage Patterns

| Impulse ID | Usage Count | Activities |
|------------|-------------|------------|
| `imp_1` | 4 | 4 activities |
| `imp_2` | 2 | 2 activities |
| `imp_low` | 2 | 2 activities |
| `imp_high` | 2 | 2 activities |
| `errorContext-file-0` | 1 | 1 activities |
| `errorContext-file-1` | 1 | 1 activities |
| `errorContext-bash-2` | 1 | 1 activities |
| `errorContext-bash-3` | 1 | 1 activities |
| `errorContext-bash-4` | 1 | 1 activities |
| `errorContext-memo-5` | 1 | 1 activities |
| `errorContext-memo-6` | 1 | 1 activities |
| `errorContext-memo-7` | 1 | 1 activities |
| `affectedCode-file-0` | 1 | 1 activities |
| `affectedCode-file-1` | 1 | 1 activities |
| `affectedCode-file-2` | 1 | 1 activities |
| `affectedCode-bash-3` | 1 | 1 activities |
| `affectedCode-bash-4` | 1 | 1 activities |
| `affectedCode-bash-5` | 1 | 1 activities |
| `affectedCode-memo-6` | 1 | 1 activities |
| `affectedCode-memo-7` | 1 | 1 activities |

## Tool Usage Patterns

| Tool | Usage Count | Activities |
|------|-------------|------------|
| `bash` | 210 | 5 activities |
| `read` | 146 | 5 activities |
| `grep` | 70 | 1 activities |
| `list` | 30 | 1 activities |
| `activity` | 28 | 3 activities |
| `glob` | 15 | 1 activities |
| `metabob_list_file_components` | 12 | 1 activities |
| `impulse_create` | 4 | 1 activities |
| `metabob_search_codebase_issues` | 2 | 1 activities |
| `impulse_list` | 1 | 1 activities |
| `search_activities` | 1 | 1 activities |
| `write` | 1 | 1 activities |
| `invalid` | 1 | 1 activities |

## Activity Composition Patterns

Activities that invoke other activities:

| Activity ID | Nested Activities | Depth |
|-------------|-------------------|-------|
| `act_mm6i4zsi...` | 11 | 11 |
| `act_mm6zhphh...` | 15 | 15 |
| `act_mmazyn16...` | 2 | 2 |
