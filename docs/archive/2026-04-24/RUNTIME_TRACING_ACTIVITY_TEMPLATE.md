# Runtime Tracing Analysis Activity Template

## Summary

Successfully created a comprehensive activity template that codifies the runtime tracing analysis workflow we executed. This template enables MiniBob to analyze its own performance through systematic trace collection and analysis.

## Template Details

**Location:** `/home/avi/documents/work/exp-repo/metabob-devbob/repos/minibob/activities/analysis/runtime-tracing-analysis.json`

**Template ID:** `runtime-tracing-analysis`

**Category:** Analysis

**Version:** 1.0.0

## Template Structure

### Tasks (8 Total)

1. **prepare-environment** - Create directories, verify dependencies (jq, MiniBob)
2. **configure-tracing** - Set environment variables for runtime tracing
3. **execute-test-goals** - Run diverse MiniBob goals with tracing enabled
4. **collect-traces** - Gather and validate trace files
5. **analyze-trace-data** - Comprehensive trace analysis using jq
6. **generate-report** - Create detailed markdown analysis report
7. **identify-optimizations** - Extract top 3-5 actionable improvements
8. **cleanup-and-archive** - Archive traces and clean up artifacts

### Variables (5 Total)

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `tracePath` | string | `./.metabob/traces` | Directory for trace storage |
| `vesselId` | string | `runtime-analysis-vessel` | Vessel identifier for tracing |
| `sampleRate` | number | `1.0` | Trace sampling rate (0.0-1.0) |
| `reportOutputPath` | string | `./RUNTIME_TRACE_ANALYSIS.md` | Output path for report |
| `testGoals` | array | 3 default goals | Test scenarios to execute |

### Output Impulses (3 Total)

1. **analysis-report** - Comprehensive markdown report with insights
2. **trace-archive** - Archived trace files with timestamp
3. **optimization-recommendations** - Prioritized improvement list

### Hooks

**Pre-Execution:**
- Verify MiniBob is installed
- Verify jq is available

**Post-Execution:**
- Log completion message with report location

**On-Failure:**
- Preserve trace files for manual analysis

## Analysis Metrics

The template analyzes the following performance dimensions:

### 1. Hot Paths Analysis
- Most frequently executed activities
- Execution counts per activity
- Success rates by activity

### 2. Resolver Performance Analysis
- Average duration by resolver type
- Total time spent in each resolver
- Frequency of resolver usage

### 3. Bottleneck Identification
- **Bottleneck Score** = Frequency × Average Duration
- Identifies slow + frequent operations
- Prioritizes optimization targets

### 4. Success/Failure Patterns
- Overall success rate
- Success rate by resolver type
- Success rate by activity

### 5. Cost Analysis
- Total token usage
- Cost breakdown by resolver tier (deterministic vs LLM)
- Most expensive operations

## Generated Report Structure

The activity generates a comprehensive markdown report with:

```markdown
# Runtime Trace Analysis Report

## Executive Summary
- Analysis period, trace count, success rate, total time

## Key Findings
1. Hot Paths (Most Frequent Activities)
2. Performance Bottlenecks
3. Success/Failure Analysis
4. Cost Analysis

## Insights & Recommendations
- Top 3-5 Actionable Optimizations (prioritized)
- Each with: current state, proposed solution, expected impact, effort, priority score

## Appendix: Raw Data
- Trace locations, analysis commands, environment config
```

## Example Usage

### Basic Usage
```bash
minibob --activity runtime-tracing-analysis
```

### Custom Configuration
```bash
minibob --activity runtime-tracing-analysis \
  --var tracePath=/custom/traces \
  --var reportOutputPath=/tmp/analysis-$(date +%Y%m%d).md \
  --var sampleRate=0.1
```

### Production Monitoring
```bash
# Daily analysis with low sample rate
minibob --activity runtime-tracing-analysis \
  --var sampleRate=0.1 \
  --var vesselId=production-vessel-01 \
  --var reportOutputPath=/var/reports/daily-$(date +%Y%m%d).md
```

## Success Criteria

The activity is considered successful when:

1. ✅ Report file created at `{{reportOutputPath}}`
2. ✅ Report contains "Key Findings" section
3. ✅ Report contains at least 3 actionable optimizations
4. ✅ At least one trace file analyzed successfully
5. ✅ Bottleneck analysis includes resolver statistics

## Validation Features

Each task includes:
- **Required files** - Files that must exist after task completion
- **Required patterns** - Content patterns that must appear in output
- **Forbidden patterns** - Content that should NOT appear (error indicators)
- **Retry configuration** - Max attempts and backoff strategy

## Real-World Application

This template was created based on our actual runtime tracing analysis session where we:

1. Enabled runtime tracing in MiniBob
2. Generated 47 trace files from diverse test goals
3. Analyzed traces to discover:
   - **bash resolver** is the primary bottleneck (53% of time, 50% failure rate)
   - Hot path: file operations (18 executions, 94% success)
   - Cost: $0.64 for 127k tokens
4. Identified 5 prioritized optimizations:
   - Improve bash error handling (priority 8.5/10)
   - Cache file read operations (priority 7.2/10)
   - Optimize LLM tool selection (priority 6.8/10)
   - Parallelize bash operations (priority 5.5/10)
   - Add bash operation timeout (priority 5.0/10)

## Supporting Documentation

Created three supporting files:

1. **`README.md`** - Overview of analysis activities directory
2. **`EXAMPLE_USAGE.md`** - Detailed usage examples and troubleshooting
3. **`runtime-tracing-analysis.json`** - The activity template itself

## Directory Structure

```
repos/minibob/activities/analysis/
├── README.md                          # Directory overview
├── EXAMPLE_USAGE.md                   # Usage guide and examples
└── runtime-tracing-analysis.json     # Activity template (14 KB)
```

## Integration with Learning Loop

This template demonstrates the **ribosome pattern** in action:

1. **Manual Workflow** - We performed runtime tracing analysis manually
2. **Template Extraction** - Codified the workflow into a reusable template
3. **Autonomous Execution** - MiniBob can now analyze itself autonomously
4. **Learning** - Execution traces feed back into Thompson Sampling

The template enables:
- **Self-improvement loops** - MiniBob analyzes its own performance
- **Continuous monitoring** - Regular performance analysis via scheduled runs
- **A/B testing** - Compare before/after optimization impact
- **Pattern recognition** - Learn which optimizations work best

## Next Steps

### Immediate Actions
1. Test the template with MiniBob
2. Validate report generation
3. Verify analysis accuracy against manual analysis

### Future Enhancements
1. Add visualization generation (charts, graphs)
2. Integrate with CI/CD for automated performance regression detection
3. Create variant templates for specific analysis types:
   - `activity-effectiveness-analysis.json` - Activity success rates
   - `impulse-resolution-analysis.json` - Impulse resolution patterns
   - `cost-optimization-analysis.json` - Deep cost analysis

### Learning Opportunities
1. Track which optimizations have highest impact
2. Learn optimal sample rates for different scenarios
3. Identify which test goals reveal most bottlenecks
4. Build corpus of analysis patterns for Thompson Sampling

## Key Design Principles Applied

✅ **Activities Constrain Search** - Template provides structured workflow vs. ad-hoc analysis

✅ **Record Everything** - All analysis steps are traced for learning

✅ **Metadata First** - Variables describe what to analyze before loading trace content

✅ **Resolvers Where Data Lives** - Uses bash/jq for local trace analysis

✅ **Reserve Improvisation** - Template can be adapted for different scenarios via variables

✅ **Learn From Traces** - Execution of this template creates traces that improve future analyses

## Validation Status

✅ **JSON Structure** - Valid JSON, parses correctly
✅ **Required Fields** - id, name, category, tasks, variables present
✅ **Task Structure** - 8 tasks with proper prompt templates
✅ **Variable Definitions** - 5 variables with types and defaults
✅ **Output Impulses** - 3 output impulses defined
✅ **Hooks** - Pre/post/failure hooks configured
✅ **Success Criteria** - 5 measurable success criteria

## Template Capabilities

This template demonstrates several advanced activity features:

1. **Dynamic Variables** - Customizable paths, sample rates, vessel IDs
2. **Complex Analysis** - Multi-step jq pipelines for trace analysis
3. **Report Generation** - Structured markdown with actionable insights
4. **Priority Scoring** - Algorithmic ranking of optimization opportunities
5. **Archival** - Timestamped trace archives for historical analysis
6. **Validation** - Pattern-based success validation
7. **Error Handling** - Retry strategies per task complexity

## Impact

This template enables MiniBob to:

1. **Self-monitor** - Continuously analyze its own performance
2. **Self-optimize** - Identify and prioritize improvements
3. **Self-document** - Generate performance reports automatically
4. **Self-improve** - Feed analysis results into learning loop

The template transforms runtime tracing from a manual debugging task into an autonomous, repeatable, and continuously improving process.

## Files Created

| File | Size | Purpose |
|------|------|---------|
| `runtime-tracing-analysis.json` | 14 KB | Main activity template |
| `README.md` | 3.3 KB | Directory overview |
| `EXAMPLE_USAGE.md` | 9.7 KB | Usage guide and troubleshooting |
| **Total** | **27 KB** | Complete activity package |

---

**Created:** 2026-04-20
**Author:** metabob-devbob (with Claude Code)
**Version:** 1.0.0
**Status:** Ready for testing
