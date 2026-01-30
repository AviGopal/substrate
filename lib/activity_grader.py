#!/usr/bin/env python3
"""
Simple Activity Grading System - Incremental Implementation

This implements basic activity execution grading to learn from outcomes.
The system analyzes activity executions and assigns grades based on:

1. Correctness: Did it accomplish the goal?
2. Efficiency: Was it reasonably fast and cost-effective?
3. Quality: Did it improve code quality?
4. Reliability: Did it work without errors?

This serves as the foundation for learning which activities work best
in different contexts, enabling our self-improving DevBob system.
"""

import json
from datetime import datetime, timezone
from enum import Enum
from typing import Dict, List, Optional, Tuple


class GradeCategory(Enum):
    """Categories for grading activity executions."""

    CORRECTNESS = "correctness"  # Did it solve the problem?
    EFFICIENCY = "efficiency"  # Fast and cost-effective?
    QUALITY = "quality"  # Improved code quality?
    RELIABILITY = "reliability"  # Worked without errors?


class ActivityGrade:
    """Grade for an activity execution."""

    def __init__(
        self,
        execution_id: str,
        activity_id: str,
        overall_score: float,
        correctness_score: float,
        efficiency_score: float,
        quality_score: float,
        reliability_score: float,
        learning_notes: str,
        graded_at: Optional[datetime] = None,
    ):
        self.execution_id = execution_id
        self.activity_id = activity_id
        self.overall_score = overall_score
        self.correctness_score = correctness_score
        self.efficiency_score = efficiency_score
        self.quality_score = quality_score
        self.reliability_score = reliability_score
        self.learning_notes = learning_notes
        self.graded_at = (
            graded_at if graded_at is not None else datetime.now(timezone.utc)
        )

    def to_dict(self) -> Dict:
        """Convert to dictionary for storage/serialization."""
        return {
            "execution_id": self.execution_id,
            "activity_id": self.activity_id,
            "overall_score": self.overall_score,
            "correctness_score": self.correctness_score,
            "efficiency_score": self.efficiency_score,
            "quality_score": self.quality_score,
            "reliability_score": self.reliability_score,
            "learning_notes": self.learning_notes,
            "graded_at": self.graded_at.isoformat(),
        }


class SimpleActivityGrader:
    """Simple activity grading system for incremental learning."""

    def __init__(self):
        self.grades = []
        self.activity_baselines = self._load_activity_baselines()

    def _load_activity_baselines(self) -> Dict:
        """Load baseline expectations for different activity types."""
        return {
            "add-feature-complete": {
                "expected_duration_ms": 60000,  # 1 minute
                "expected_cost_usd": 0.20,
                "expected_success_rate": 0.80,
                "quality_improvement_threshold": 0.1,
            },
            "fix-bug-complete": {
                "expected_duration_ms": 90000,  # 1.5 minutes
                "expected_cost_usd": 0.30,
                "expected_success_rate": 0.75,
                "quality_improvement_threshold": 0.2,
            },
            "refactor-with-tests": {
                "expected_duration_ms": 120000,  # 2 minutes
                "expected_cost_usd": 0.40,
                "expected_success_rate": 0.85,
                "quality_improvement_threshold": 0.3,
            },
            "optimize-performance": {
                "expected_duration_ms": 100000,  # 1.67 minutes
                "expected_cost_usd": 0.35,
                "expected_success_rate": 0.70,
                "quality_improvement_threshold": 0.25,
            },
        }

    def grade_execution(
        self,
        execution_metrics: Dict,
        before_state: Optional[Dict] = None,
        after_state: Optional[Dict] = None,
    ) -> ActivityGrade:
        """Grade an activity execution based on multiple criteria."""

        execution_id = execution_metrics["execution_id"]
        activity_id = execution_metrics["activity_id"]

        print(f"🎓 Grading execution {execution_id} ({activity_id})")

        # Grade each category
        correctness = self._grade_correctness(
            execution_metrics, before_state, after_state
        )
        efficiency = self._grade_efficiency(execution_metrics)
        quality = self._grade_quality(execution_metrics, before_state, after_state)
        reliability = self._grade_reliability(execution_metrics)

        # Calculate overall score with weights
        # Correctness is most important (40%), then others
        overall = (
            correctness * 0.40 + efficiency * 0.25 + quality * 0.20 + reliability * 0.15
        )

        # Generate learning notes
        learning_notes = self._generate_learning_notes(
            execution_metrics, correctness, efficiency, quality, reliability
        )

        grade = ActivityGrade(
            execution_id=execution_id,
            activity_id=activity_id,
            overall_score=overall,
            correctness_score=correctness,
            efficiency_score=efficiency,
            quality_score=quality,
            reliability_score=reliability,
            learning_notes=learning_notes,
        )

        self.grades.append(grade)

        print(f"   📊 Overall Score: {overall:.3f}")
        print(
            f"   📋 Breakdown: Correctness={correctness:.2f}, Efficiency={efficiency:.2f}, Quality={quality:.2f}, Reliability={reliability:.2f}"
        )
        print(f"   💡 Learning: {learning_notes}")
        print()

        return grade

    def _grade_correctness(
        self, metrics: Dict, before: Optional[Dict], after: Optional[Dict]
    ) -> float:
        """Grade correctness: Did the activity accomplish its goal?"""

        score = 0.0

        # Basic success indicator
        if metrics.get("success", False):
            score += 0.6  # Base score for reported success
        else:
            # Partial credit if we have more context
            if metrics.get("error_message"):
                # Some partial credit for informative error messages
                score += 0.1
            return score

        # Additional correctness indicators if we have before/after state
        if before and after:
            # Check if issues were resolved
            issues_before = before.get("issue_count", 0)
            issues_after = after.get("issue_count", 0)

            if issues_before > issues_after:
                improvement = (issues_before - issues_after) / max(issues_before, 1)
                score += 0.3 * improvement

            # Check if tests were added or improved
            tests_before = before.get("test_count", 0)
            tests_after = after.get("test_count", 0)

            if tests_after > tests_before:
                score += 0.1  # Bonus for adding tests

        return min(1.0, score)

    def _grade_efficiency(self, metrics: Dict) -> float:
        """Grade efficiency: Was it reasonably fast and cost-effective?"""

        activity_id = metrics["activity_id"]
        baseline = self.activity_baselines.get(activity_id, {})

        duration_ms = metrics.get("duration_ms", 0)
        cost_usd = metrics.get("cost_usd", 0.0)

        expected_duration = baseline.get(
            "expected_duration_ms", 120000
        )  # 2 min default
        expected_cost = baseline.get("expected_cost_usd", 0.50)  # $0.50 default

        # Score based on how close to or better than expected
        duration_score = max(0, min(1.0, expected_duration / max(duration_ms, 1000)))
        cost_score = max(0, min(1.0, expected_cost / max(cost_usd, 0.01)))

        # Combined efficiency score
        efficiency_score = duration_score * 0.6 + cost_score * 0.4

        return efficiency_score

    def _grade_quality(
        self, metrics: Dict, before: Optional[Dict], after: Optional[Dict]
    ) -> float:
        """Grade quality: Did it improve code quality?"""

        score = 0.5  # Baseline - no harm done

        if not before or not after:
            # If no before/after state, use execution success as proxy
            if metrics.get("success", False):
                score = 0.7
            return score

        # Check quality metrics improvements
        quality_before = before.get("quality_score", 0)
        quality_after = after.get("quality_score", 0)

        if quality_after > quality_before:
            improvement = (quality_after - quality_before) / max(quality_before, 0.1)
            activity_id = metrics["activity_id"]
            threshold = self.activity_baselines.get(activity_id, {}).get(
                "quality_improvement_threshold", 0.2
            )

            if improvement >= threshold:
                score += 0.3  # Good improvement
            else:
                score += 0.1  # Some improvement

        # Check if critical issues were introduced
        critical_before = before.get("critical_issues", 0)
        critical_after = after.get("critical_issues", 0)

        if critical_after > critical_before:
            score -= 0.3  # Penalty for introducing critical issues

        return max(0.0, min(1.0, score))

    def _grade_reliability(self, metrics: Dict) -> float:
        """Grade reliability: Did it work without errors?"""

        score = 0.0

        # Basic reliability from success/failure
        if metrics.get("success", False):
            score += 0.8
        else:
            # Check if error was recoverable
            error_msg = metrics.get("error_message", "").lower()
            if any(
                keyword in error_msg for keyword in ["timeout", "network", "temporary"]
            ):
                score += 0.3  # Recoverable errors get some credit
            elif "merge conflict" in error_msg:
                score += 0.4  # Merge conflicts are somewhat expected
            else:
                score += 0.1  # At least it failed gracefully

        # Bonus for clean execution (no warnings, etc.)
        if metrics.get("warnings", 0) == 0:
            score += 0.2

        return min(1.0, score)

    def _generate_learning_notes(
        self,
        metrics: Dict,
        correctness: float,
        efficiency: float,
        quality: float,
        reliability: float,
    ) -> str:
        """Generate learning notes from the grading analysis."""

        notes = []

        # Correctness insights
        if correctness >= 0.9:
            notes.append("Excellent execution - goal fully achieved")
        elif correctness >= 0.7:
            notes.append("Good execution - mostly achieved goal")
        elif correctness >= 0.5:
            notes.append("Partial success - some issues remain")
        else:
            notes.append("Poor execution - major issues")

        # Efficiency insights
        if efficiency >= 0.8:
            notes.append("Very efficient - fast and cost-effective")
        elif efficiency >= 0.6:
            notes.append("Reasonably efficient")
        elif efficiency >= 0.4:
            notes.append("Somewhat inefficient - could be optimized")
        else:
            notes.append("Inefficient - needs significant optimization")

        # Quality insights
        if quality >= 0.8:
            notes.append("High quality - improved codebase")
        elif quality >= 0.6:
            notes.append("Good quality - maintained standards")
        elif quality >= 0.4:
            notes.append("Acceptable quality - no major harm")
        else:
            notes.append("Quality concerns - may have introduced issues")

        # Reliability insights
        if reliability >= 0.8:
            notes.append("Reliable execution - worked smoothly")
        elif reliability >= 0.6:
            notes.append("Mostly reliable - minor issues")
        else:
            notes.append("Reliability issues - needs investigation")

        # Overall recommendation
        overall = (
            correctness * 0.40 + efficiency * 0.25 + quality * 0.20 + reliability * 0.15
        )
        if overall >= 0.8:
            notes.append("RECOMMEND: Use this variant more often")
        elif overall >= 0.6:
            notes.append("NEUTRAL: Acceptable performance")
        else:
            notes.append("AVOID: Consider alternative approach")

        return "; ".join(notes)

    def get_activity_insights(self, activity_id: str) -> Dict:
        """Get learning insights for a specific activity type."""

        activity_grades = [g for g in self.grades if g.activity_id == activity_id]

        if not activity_grades:
            return {"activity_id": activity_id, "message": "No grades available yet"}

        # Calculate average scores
        avg_overall = sum(g.overall_score for g in activity_grades) / len(
            activity_grades
        )
        avg_correctness = sum(g.correctness_score for g in activity_grades) / len(
            activity_grades
        )
        avg_efficiency = sum(g.efficiency_score for g in activity_grades) / len(
            activity_grades
        )
        avg_quality = sum(g.quality_score for g in activity_grades) / len(
            activity_grades
        )
        avg_reliability = sum(g.reliability_score for g in activity_grades) / len(
            activity_grades
        )

        # Find strengths and weaknesses
        scores = {
            "correctness": avg_correctness,
            "efficiency": avg_efficiency,
            "quality": avg_quality,
            "reliability": avg_reliability,
        }

        strongest = max(scores.items(), key=lambda x: x[1])
        weakest = min(scores.items(), key=lambda x: x[1])

        return {
            "activity_id": activity_id,
            "total_graded_executions": len(activity_grades),
            "average_overall_score": avg_overall,
            "strongest_area": {"category": strongest[0], "score": strongest[1]},
            "weakest_area": {"category": weakest[0], "score": weakest[1]},
            "recommendation": self._generate_activity_recommendation(
                avg_overall, strongest, weakest
            ),
            "recent_trends": self._analyze_recent_trends(activity_grades),
        }

    def _generate_activity_recommendation(
        self, avg_overall: float, strongest: Tuple, weakest: Tuple
    ) -> str:
        """Generate recommendations for improving activity performance."""

        recommendations = []

        if avg_overall >= 0.8:
            recommendations.append(
                "High-performing activity - consider as template for others"
            )
        elif avg_overall >= 0.6:
            recommendations.append(
                "Solid performer - focus on addressing weakest areas"
            )
        else:
            recommendations.append(
                "Needs improvement - consider alternative implementations"
            )

        # Specific recommendations based on weakest area
        weak_category, weak_score = weakest
        if weak_score < 0.6:
            if weak_category == "correctness":
                recommendations.append(
                    "Improve goal achievement - better validation and testing"
                )
            elif weak_category == "efficiency":
                recommendations.append(
                    "Optimize for speed and cost - review implementation approach"
                )
            elif weak_category == "quality":
                recommendations.append(
                    "Focus on code quality improvements and standards"
                )
            elif weak_category == "reliability":
                recommendations.append(
                    "Add better error handling and recovery mechanisms"
                )

        return "; ".join(recommendations)

    def _analyze_recent_trends(self, grades: List[ActivityGrade]) -> Dict:
        """Analyze trends in recent executions."""

        if len(grades) < 3:
            return {"message": "Insufficient data for trend analysis"}

        # Sort by graded time
        sorted_grades = sorted(grades, key=lambda g: g.graded_at)

        # Compare first third vs last third
        n = len(sorted_grades)
        early_grades = sorted_grades[: n // 3] if n >= 6 else sorted_grades[:1]
        recent_grades = sorted_grades[-n // 3 :] if n >= 6 else sorted_grades[-1:]

        early_avg = sum(g.overall_score for g in early_grades) / len(early_grades)
        recent_avg = sum(g.overall_score for g in recent_grades) / len(recent_grades)

        trend = recent_avg - early_avg

        if trend > 0.1:
            trend_desc = f"Improving (+{trend:.3f})"
        elif trend < -0.1:
            trend_desc = f"Declining ({trend:.3f})"
        else:
            trend_desc = f"Stable ({trend:+.3f})"

        return {
            "trend": trend_desc,
            "early_period_avg": early_avg,
            "recent_period_avg": recent_avg,
            "change": trend,
        }


def demo_activity_grading():
    """Demonstrate the activity grading system."""

    print("🎓 Simple Activity Grading System - Demonstration")
    print("=" * 55)
    print("Learning from activity execution outcomes to improve recommendations")
    print()

    grader = SimpleActivityGrader()

    # Sample execution metrics with varying performance
    sample_executions = [
        {
            "execution_id": "exec_001",
            "activity_id": "add-feature-complete",
            "success": True,
            "duration_ms": 45000,  # Faster than expected
            "cost_usd": 0.15,  # Cheaper than expected
            "warnings": 0,
        },
        {
            "execution_id": "exec_002",
            "activity_id": "add-feature-complete",
            "success": False,
            "duration_ms": 120000,  # Much slower
            "cost_usd": 0.35,  # More expensive
            "error_message": "Merge conflict in feature branch",
            "warnings": 2,
        },
        {
            "execution_id": "exec_003",
            "activity_id": "fix-bug-complete",
            "success": True,
            "duration_ms": 75000,  # About expected
            "cost_usd": 0.28,  # About expected
            "warnings": 1,
        },
        {
            "execution_id": "exec_004",
            "activity_id": "add-feature-complete",
            "success": True,
            "duration_ms": 50000,
            "cost_usd": 0.18,
            "warnings": 0,
        },
    ]

    # Sample before/after states for quality grading
    sample_states = [
        (
            {"issue_count": 5, "quality_score": 0.7, "test_count": 10},
            {"issue_count": 3, "quality_score": 0.8, "test_count": 12},
        ),
        (
            {"issue_count": 3, "quality_score": 0.6, "test_count": 8},
            {"issue_count": 3, "quality_score": 0.6, "test_count": 8},
        ),  # No improvement
        (
            {"issue_count": 2, "quality_score": 0.8, "test_count": 15},
            {"issue_count": 1, "quality_score": 0.85, "test_count": 17},
        ),
        (
            {"issue_count": 4, "quality_score": 0.75, "test_count": 12},
            {"issue_count": 2, "quality_score": 0.85, "test_count": 14},
        ),
    ]

    # Grade each execution
    for i, execution in enumerate(sample_executions):
        before_state = sample_states[i][0] if i < len(sample_states) else None
        after_state = sample_states[i][1] if i < len(sample_states) else None

        grade = grader.grade_execution(execution, before_state, after_state)

    # Show insights for each activity type
    print("\n📈 Activity Performance Insights")
    print("=" * 35)

    activity_types = set(g.activity_id for g in grader.grades)

    for activity_id in activity_types:
        insights = grader.get_activity_insights(activity_id)
        print(f"\n🔧 {activity_id}:")
        print(f"   Executions Graded: {insights['total_graded_executions']}")
        print(f"   Average Score: {insights['average_overall_score']:.3f}")
        print(
            f"   Strongest: {insights['strongest_area']['category']} ({insights['strongest_area']['score']:.2f})"
        )
        print(
            f"   Weakest: {insights['weakest_area']['category']} ({insights['weakest_area']['score']:.2f})"
        )
        print(f"   Recommendation: {insights['recommendation']}")
        print(f"   Trends: {insights['recent_trends'].get('trend', 'N/A')}")

    print("\n🎯 Key Learning Points:")
    print("=" * 25)
    print("1. 🎓 Grading provides detailed feedback on activity performance")
    print(
        "2. 📊 Multi-dimensional scoring (correctness, efficiency, quality, reliability)"
    )
    print("3. 💡 Learning notes explain strengths and improvement areas")
    print("4. 📈 Trend analysis shows if activities are improving over time")
    print("5. 🎯 Recommendations guide optimization efforts")
    print()
    print("💭 This grading system enables continuous learning and improvement!")
    print(
        "   Next: Integrate with parameter server → Combine with predictions → Deploy"
    )


if __name__ == "__main__":
    demo_activity_grading()
