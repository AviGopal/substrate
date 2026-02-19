#!/usr/bin/env python3
"""
Analyze activity template performance from local storage.
Generates improvement gradients for stable/candidate A/B testing system.
"""

import json
import sys
from pathlib import Path
from collections import defaultdict
from dataclasses import dataclass
from typing import List, Dict, Optional
from datetime import datetime


@dataclass
class ActivityExecution:
    """Represents a single activity execution."""

    id: str
    template_id: str
    template_name: str
    status: str
    cost_total: float
    duration_ms: float
    started_at: str
    completed_at: Optional[str]
    task_count: int
    failed_tasks: int
    success_rate: float


@dataclass
class TemplateMetrics:
    """Aggregated metrics for a template."""

    template_id: str
    template_name: str
    version: str
    category: str
    parent_template_id: Optional[str]

    # Execution counts
    total_executions: int
    successful: int
    failed: int

    # Success metrics
    success_rate: float
    avg_task_success_rate: float

    # Cost metrics
    total_cost: float
    avg_cost: float
    min_cost: float
    max_cost: float

    # Duration metrics
    avg_duration_ms: float
    min_duration_ms: float
    max_duration_ms: float

    # First/last execution
    first_execution: str
    last_execution: str

    # Improvement gradient
    trend: str  # "improving", "stable", "degrading"
    recent_success_rate: float  # Last 10 executions


def load_storage_data(storage_path: Path):
    """Load activity templates and executions from storage."""

    templates = {}
    template_dir = storage_path / "activity-template"
    if template_dir.exists():
        for template_file in template_dir.glob("*.json"):
            try:
                with open(template_file) as f:
                    data = json.load(f)
                    templates[data.get("id")] = data
            except Exception as e:
                print(
                    f"⚠️  Error loading template {template_file}: {e}", file=sys.stderr
                )

    executions = []
    activity_dir = storage_path / "activity"
    if activity_dir.exists():
        for activity_file in activity_dir.glob("*.json"):
            try:
                with open(activity_file) as f:
                    data = json.load(f)

                    # Extract metrics
                    template_id = data.get("templateId", "unknown")
                    template_name = data.get("templateName", "unknown")
                    status = data.get("status", "unknown")

                    stats = data.get("stats", {})
                    cost_total = stats.get("cost", {}).get("total", 0.0)
                    duration_ms = stats.get("duration", 0.0)

                    started_at = data.get("startedAt")
                    completed_at = data.get("completedAt")

                    # Task analysis from executionEvidence
                    execution_evidence = data.get("executionEvidence", {})
                    sessions_spawned = execution_evidence.get("sessionsSpawned", [])
                    task_count = len(sessions_spawned)

                    # Count successful tasks (sessions that completed without errors)
                    # Note: We don't have explicit task status, so we infer from session completion
                    # A more sophisticated approach would check correctnessVerdict
                    successful_tasks = task_count  # Assume success if session spawned

                    # Check correctnessVerdict for more accurate success measurement
                    correctness = data.get("correctnessVerdict", {})
                    if correctness.get("computed"):
                        # If verdict is incorrect, mark all tasks as potentially problematic
                        verdict = correctness.get("verdict", "")
                        if verdict == "incorrect":
                            # Use confidence to estimate success rate
                            confidence = correctness.get("confidence", 0.0)
                            successful_tasks = int(task_count * confidence)

                    failed_tasks = task_count - successful_tasks
                    success_rate = (
                        successful_tasks / task_count if task_count > 0 else 0.0
                    )

                    executions.append(
                        ActivityExecution(
                            id=data.get("id"),
                            template_id=template_id,
                            template_name=template_name,
                            status=status,
                            cost_total=cost_total,
                            duration_ms=duration_ms,
                            started_at=started_at,
                            completed_at=completed_at,
                            task_count=task_count,
                            failed_tasks=failed_tasks,
                            success_rate=success_rate,
                        )
                    )
            except Exception as e:
                print(
                    f"⚠️  Error loading activity {activity_file}: {e}", file=sys.stderr
                )

    return templates, executions


def calculate_metrics(
    templates: Dict, executions: List[ActivityExecution]
) -> List[TemplateMetrics]:
    """Calculate aggregated metrics for each template."""

    # Group executions by template
    by_template = defaultdict(list)
    for exec in executions:
        by_template[exec.template_id].append(exec)

    metrics = []
    for template_id, execs in by_template.items():
        if not execs:
            continue

        template = templates.get(template_id, {})

        # Sort by started_at
        execs_sorted = sorted(execs, key=lambda e: e.started_at or "")

        # Execution counts
        total = len(execs)
        successful = sum(1 for e in execs if e.status == "done")
        failed = total - successful

        # Success rates
        success_rate = successful / total if total > 0 else 0.0
        avg_task_success_rate = (
            sum(e.success_rate for e in execs) / total if total > 0 else 0.0
        )

        # Recent success rate (last 10)
        recent_execs = execs_sorted[-10:]
        recent_successful = sum(1 for e in recent_execs if e.status == "done")
        recent_success_rate = (
            recent_successful / len(recent_execs) if recent_execs else 0.0
        )

        # Cost metrics
        costs = [e.cost_total for e in execs if e.cost_total > 0]
        total_cost = sum(costs)
        avg_cost = total_cost / len(costs) if costs else 0.0
        min_cost = min(costs) if costs else 0.0
        max_cost = max(costs) if costs else 0.0

        # Duration metrics
        durations = [e.duration_ms for e in execs if e.duration_ms > 0]
        avg_duration_ms = sum(durations) / len(durations) if durations else 0.0
        min_duration_ms = min(durations) if durations else 0.0
        max_duration_ms = max(durations) if durations else 0.0

        # Trend analysis
        if recent_success_rate > success_rate + 0.1:
            trend = "improving"
        elif recent_success_rate < success_rate - 0.1:
            trend = "degrading"
        else:
            trend = "stable"

        metrics.append(
            TemplateMetrics(
                template_id=template_id,
                template_name=template.get("name", template_id),
                version=template.get("version", {}).get("generation", "1"),
                category=template.get("category", "unknown"),
                parent_template_id=template.get("parentTemplateId"),
                total_executions=total,
                successful=successful,
                failed=failed,
                success_rate=success_rate,
                avg_task_success_rate=avg_task_success_rate,
                total_cost=total_cost,
                avg_cost=avg_cost,
                min_cost=min_cost,
                max_cost=max_cost,
                avg_duration_ms=avg_duration_ms,
                min_duration_ms=min_duration_ms,
                max_duration_ms=max_duration_ms,
                first_execution=execs_sorted[0].started_at if execs_sorted else "",
                last_execution=execs_sorted[-1].started_at if execs_sorted else "",
                trend=trend,
                recent_success_rate=recent_success_rate,
            )
        )

    return sorted(metrics, key=lambda m: m.total_executions, reverse=True)


def identify_stable_candidate_pairs(metrics: List[TemplateMetrics]) -> Dict[str, Dict]:
    """
    Identify which templates should be stable vs candidate.

    Rules:
    1. If template has parent_template_id, it's a candidate
    2. Parent is the stable version
    3. Compare metrics to recommend promotion/pruning
    """

    stable_templates = {}
    candidate_templates = {}
    recommendations = {}

    # Build parent-child relationships
    for m in metrics:
        if m.parent_template_id:
            # This is a candidate
            candidate_templates[m.template_id] = m

            # Find stable parent
            parent_metrics = next(
                (p for p in metrics if p.template_id == m.parent_template_id), None
            )
            if parent_metrics:
                stable_templates[m.parent_template_id] = parent_metrics

                # Compare and recommend
                rec = {
                    "stable": parent_metrics.template_id,
                    "candidate": m.template_id,
                    "comparison": {
                        "success_rate_diff": m.success_rate
                        - parent_metrics.success_rate,
                        "cost_diff_pct": (
                            (m.avg_cost - parent_metrics.avg_cost)
                            / parent_metrics.avg_cost
                            * 100
                        )
                        if parent_metrics.avg_cost > 0
                        else 0,
                        "duration_diff_pct": (
                            (m.avg_duration_ms - parent_metrics.avg_duration_ms)
                            / parent_metrics.avg_duration_ms
                            * 100
                        )
                        if parent_metrics.avg_duration_ms > 0
                        else 0,
                    },
                }

                # Determine action
                success_improved = m.success_rate > parent_metrics.success_rate
                cost_improved = m.avg_cost < parent_metrics.avg_cost
                duration_improved = m.avg_duration_ms < parent_metrics.avg_duration_ms

                # Scoring: success_rate is most important
                score = 0
                if success_improved:
                    score += 3
                if cost_improved:
                    score += 1
                if duration_improved:
                    score += 1

                if score >= 3:
                    rec["action"] = "PROMOTE"
                    rec["reason"] = f"Candidate outperforms stable (score: {score}/5)"
                elif m.total_executions < 5:
                    rec["action"] = "CONTINUE_TESTING"
                    rec["reason"] = (
                        f"Insufficient data ({m.total_executions} executions)"
                    )
                elif m.success_rate < 0.5:
                    rec["action"] = "PRUNE"
                    rec["reason"] = f"Low success rate ({m.success_rate:.1%})"
                else:
                    rec["action"] = "CONTINUE_TESTING"
                    rec["reason"] = "Needs more data for confident decision"

                recommendations[m.template_id] = rec
        else:
            # No parent, assume stable
            stable_templates[m.template_id] = m

    return {
        "stable": stable_templates,
        "candidate": candidate_templates,
        "recommendations": recommendations,
    }


def print_report(metrics: List[TemplateMetrics], ab_analysis: Dict):
    """Print comprehensive performance report."""

    print("=" * 100)
    print("ACTIVITY TEMPLATE PERFORMANCE ANALYSIS")
    print("=" * 100)
    print()

    print(f"📊 Total Templates: {len(metrics)}")
    print(f"📊 Total Executions: {sum(m.total_executions for m in metrics)}")
    print()

    # Summary by category
    by_category = defaultdict(list)
    for m in metrics:
        by_category[m.category].append(m)

    print("=" * 100)
    print("BY CATEGORY")
    print("=" * 100)
    for category, templates in sorted(by_category.items()):
        total_execs = sum(t.total_executions for t in templates)
        avg_success = (
            sum(t.success_rate * t.total_executions for t in templates) / total_execs
            if total_execs > 0
            else 0
        )
        print(
            f"\n{category.upper():20s} {len(templates):3d} templates  {total_execs:4d} executions  {avg_success:.1%} avg success"
        )

    print("\n" + "=" * 100)
    print("TOP TEMPLATES BY USAGE")
    print("=" * 100)
    print(
        f"{'Template Name':45s} {'Runs':>6s} {'Success':>8s} {'Avg Cost':>10s} {'Avg Duration':>12s} {'Trend':>10s}"
    )
    print("-" * 100)

    for m in metrics[:20]:
        print(
            f"{m.template_name[:44]:45s} {m.total_executions:6d} {m.success_rate:7.1%} ${m.avg_cost:9.4f} {m.avg_duration_ms / 1000:11.1f}s {m.trend:>10s}"
        )

    # Stable/Candidate Analysis
    print("\n" + "=" * 100)
    print("STABLE vs CANDIDATE ANALYSIS")
    print("=" * 100)

    stable = ab_analysis["stable"]
    candidate = ab_analysis["candidate"]
    recommendations = ab_analysis["recommendations"]

    print(f"\n✅ Stable Templates: {len(stable)}")
    print(f"🧪 Candidate Templates: {len(candidate)}")
    print(f"📊 A/B Test Pairs: {len(recommendations)}")

    if recommendations:
        print("\n" + "=" * 100)
        print("A/B TEST RECOMMENDATIONS")
        print("=" * 100)

        for candidate_id, rec in recommendations.items():
            candidate_m = candidate[candidate_id]
            stable_m = stable.get(rec["stable"])

            if not stable_m:
                continue

            print(f"\n🔬 Test Pair: {stable_m.template_name}")
            print(f"   Stable:    {stable_m.template_id} (v{stable_m.version})")
            print(f"   Candidate: {candidate_m.template_id} (v{candidate_m.version})")
            print(f"   ")
            print(
                f"   Executions:   {stable_m.total_executions:4d} stable  vs  {candidate_m.total_executions:4d} candidate"
            )
            print(
                f"   Success Rate: {stable_m.success_rate:6.1%} stable  vs  {candidate_m.success_rate:6.1%} candidate  ({rec['comparison']['success_rate_diff']:+.1%})"
            )
            print(
                f"   Avg Cost:     ${stable_m.avg_cost:.4f} vs ${candidate_m.avg_cost:.4f}  ({rec['comparison']['cost_diff_pct']:+.1f}%)"
            )
            print(
                f"   Avg Duration: {stable_m.avg_duration_ms / 1000:.1f}s vs {candidate_m.avg_duration_ms / 1000:.1f}s  ({rec['comparison']['duration_diff_pct']:+.1f}%)"
            )
            print(f"   ")
            print(f"   🎯 ACTION: {rec['action']}")
            print(f"   📝 REASON: {rec['reason']}")

    # Improvement gradients
    print("\n" + "=" * 100)
    print("IMPROVEMENT GRADIENTS")
    print("=" * 100)

    improving = [m for m in metrics if m.trend == "improving"]
    degrading = [m for m in metrics if m.trend == "degrading"]

    if improving:
        print(f"\n📈 IMPROVING Templates ({len(improving)}):")
        for m in improving[:10]:
            print(
                f"   {m.template_name:45s} {m.success_rate:.1%} overall → {m.recent_success_rate:.1%} recent"
            )

    if degrading:
        print(f"\n📉 DEGRADING Templates ({len(degrading)}):")
        for m in degrading[:10]:
            print(
                f"   {m.template_name:45s} {m.success_rate:.1%} overall → {m.recent_success_rate:.1%} recent"
            )

    # Templates needing candidates
    print("\n" + "=" * 100)
    print("TEMPLATES NEEDING IMPROVEMENT CANDIDATES")
    print("=" * 100)

    needs_candidates = [
        m
        for m in stable.values()
        if m.template_id not in [rec["stable"] for rec in recommendations.values()]
        and (m.success_rate < 0.8 or m.trend == "degrading")
    ]

    if needs_candidates:
        print(
            f"\n⚠️  {len(needs_candidates)} stable templates could benefit from candidates:\n"
        )
        for m in sorted(needs_candidates, key=lambda x: x.success_rate)[:10]:
            print(
                f"   {m.template_name:45s} {m.success_rate:6.1%} success  {m.total_executions:4d} runs  [{m.trend}]"
            )
            print(
                f"      💡 Suggestion: Create candidate to address {m.failed} failures"
            )
    else:
        print("\n✅ All low-performing templates have active candidates!")


def main():
    storage_path = Path.home() / ".local/share/opencode/storage"

    if not storage_path.exists():
        print(f"❌ Storage path not found: {storage_path}", file=sys.stderr)
        return 1

    print(f"📂 Loading data from {storage_path}...\n")

    templates, executions = load_storage_data(storage_path)

    print(f"✅ Loaded {len(templates)} templates")
    print(f"✅ Loaded {len(executions)} executions\n")

    metrics = calculate_metrics(templates, executions)
    ab_analysis = identify_stable_candidate_pairs(metrics)

    print_report(metrics, ab_analysis)

    # Export detailed data
    output_file = Path("template_performance_analysis.json")
    with open(output_file, "w") as f:
        json.dump(
            {
                "metrics": [vars(m) for m in metrics],
                "ab_analysis": {
                    "stable": {k: vars(v) for k, v in ab_analysis["stable"].items()},
                    "candidate": {
                        k: vars(v) for k, v in ab_analysis["candidate"].items()
                    },
                    "recommendations": ab_analysis["recommendations"],
                },
            },
            f,
            indent=2,
        )

    print(f"\n\n📄 Detailed analysis exported to: {output_file}")
    print("\n" + "=" * 100)

    return 0


if __name__ == "__main__":
    sys.exit(main())
