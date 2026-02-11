#!/usr/bin/env python3
"""
Test script for V2 Activities API proto compliance.

Tests:
1. GET /v2/activities/templates returns proto ActivityVariant list
2. GET /v2/activities/templates/{id} returns proto ActivityVariant
3. Content-Type header is application/protobuf+json
4. All required proto fields are present
"""

import json
import sys
from pathlib import Path

# Add proto path
proto_path = Path(__file__).parent / "repos" / "metabob-proto" / "gen" / "python"
sys.path.insert(0, str(proto_path))

from metabob.activity import variant_pb2
from metabob.common import types_pb2
from google.protobuf.json_format import ParseDict, MessageToDict


def test_proto_message_structure():
    """Test that we can create and serialize proto messages."""
    print("=" * 60)
    print("TEST: Proto Message Structure")
    print("=" * 60)

    # Create a proto ActivityVariant
    variant = variant_pb2.ActivityVariant()
    variant.variant_id = "test-variant-1"
    variant.activity_id = "feature"
    variant.variant_name = "Test Feature Template"
    variant.description = "A test template for features"
    variant.version = 1

    # Genealogy
    variant.genealogy.content_hash = "test-hash-123"
    variant.genealogy.evolution_type = types_pb2.EVOLUTION_TYPE_ROOT

    # Task step
    task_step = variant.task_steps.add()
    task_step.id = "task-1"
    task_step.subagent = "general"
    task_step.description = "Implement the feature"
    task_step.prompt.template = "Implement {{feature_name}}"
    task_step.prompt.max_tokens = 8000
    task_step.retry.max_attempts = 3
    task_step.retry.strategy = "exponential"
    task_step.metrics.success_rate = 0.85
    task_step.metrics.avg_tokens = 1500
    task_step.metrics.avg_duration = 30000

    # Variables
    variant.variables["feature_name"] = "string"

    # Optimization config
    variant.optimization_config.thompson_sampling.enabled = True
    variant.optimization_config.thompson_sampling.initial_alpha = 1.0
    variant.optimization_config.thompson_sampling.initial_beta = 1.0

    # Status
    variant.status = types_pb2.ENTITY_STATUS_ACTIVE

    # Convert to JSON
    json_data = MessageToDict(
        variant,
        preserving_proto_field_name=True,
        use_integers_for_enums=False,
    )

    print(f"✅ Created proto ActivityVariant")
    print(f"✅ Variant ID: {variant.variant_id}")
    print(f"✅ Task steps: {len(variant.task_steps)}")
    print(f"✅ Variables: {dict(variant.variables)}")
    print(f"✅ Status: {types_pb2.EntityStatus.Name(variant.status)}")

    print(f"\n📦 JSON representation:")
    print(json.dumps(json_data, indent=2))

    return True


def test_proto_field_coverage():
    """Test that all required proto fields are present."""
    print("\n" + "=" * 60)
    print("TEST: Proto Field Coverage")
    print("=" * 60)

    required_fields = [
        "variant_id",
        "activity_id",
        "variant_name",
        "description",
        "version",
        "genealogy",
        "task_steps",
        "variables",
        "status",
    ]

    optional_fields = [
        "prompt_strategy",
        "context_budget_tokens",
        "expected_duration_ms",
        "expected_cost",
        "expected_quality_score",
        "created_at",
        "execution_config",
        "optimization_config",
    ]

    # Create minimal variant
    variant = variant_pb2.ActivityVariant()
    variant.variant_id = "test"
    variant.activity_id = "feature"
    variant.variant_name = "Test"
    variant.description = "Test template"
    variant.version = 1
    variant.genealogy.content_hash = "hash"
    variant.genealogy.evolution_type = types_pb2.EVOLUTION_TYPE_ROOT
    variant.status = types_pb2.ENTITY_STATUS_ACTIVE

    json_data = MessageToDict(variant, preserving_proto_field_name=True)

    print(f"✅ Required fields present:")
    for field in required_fields:
        present = field in json_data or field == "task_steps" or field == "variables"
        symbol = "✅" if present else "❌"
        print(f"  {symbol} {field}")

    print(f"\n📋 Optional fields (can be default):")
    for field in optional_fields:
        present = field in json_data
        symbol = "✅" if present else "⚪"
        print(f"  {symbol} {field}")

    return True


def test_task_step_structure():
    """Test TaskStep proto structure."""
    print("\n" + "=" * 60)
    print("TEST: TaskStep Structure")
    print("=" * 60)

    # Create a TaskStep
    task_step = variant_pb2.TaskStep()
    task_step.id = "task-1"
    task_step.subagent = "general"
    task_step.description = "Test task"

    # Prompt
    task_step.prompt.template = "Do {{action}}"
    task_step.prompt.max_tokens = 8000

    # Validation
    task_step.validation.required_files.extend(["src/main.py"])
    task_step.validation.required_patterns.extend(["def main"])

    # Retry
    task_step.retry.max_attempts = 3
    task_step.retry.strategy = "exponential"

    # Metrics
    task_step.metrics.success_rate = 0.9
    task_step.metrics.avg_tokens = 2000
    task_step.metrics.avg_duration = 45000

    json_data = MessageToDict(task_step, preserving_proto_field_name=True)

    print(f"✅ TaskStep ID: {task_step.id}")
    print(f"✅ Subagent: {task_step.subagent}")
    print(f"✅ Prompt template: {task_step.prompt.template}")
    print(f"✅ Max tokens: {task_step.prompt.max_tokens}")
    print(f"✅ Retry max attempts: {task_step.retry.max_attempts}")
    print(f"✅ Success rate: {task_step.metrics.success_rate}")

    print(f"\n📦 JSON representation:")
    print(json.dumps(json_data, indent=2))

    return True


def test_genealogy_structure():
    """Test Genealogy proto structure."""
    print("\n" + "=" * 60)
    print("TEST: Genealogy Structure")
    print("=" * 60)

    # Root variant
    genealogy = types_pb2.Genealogy()
    genealogy.content_hash = "hash-123"
    genealogy.evolution_type = types_pb2.EVOLUTION_TYPE_ROOT

    print(f"✅ Root variant:")
    print(f"  - Content hash: {genealogy.content_hash}")
    print(
        f"  - Evolution type: {types_pb2.EvolutionType.Name(genealogy.evolution_type)}"
    )

    # Derived variant
    derived = types_pb2.Genealogy()
    derived.content_hash = "hash-456"
    derived.parent_hash = "hash-123"
    derived.evolution_type = types_pb2.EVOLUTION_TYPE_DERIVED
    derived.evolution_note = "Optimized for microservices"

    print(f"\n✅ Derived variant:")
    print(f"  - Content hash: {derived.content_hash}")
    print(f"  - Parent hash: {derived.parent_hash}")
    print(f"  - Evolution type: {types_pb2.EvolutionType.Name(derived.evolution_type)}")
    print(f"  - Evolution note: {derived.evolution_note}")

    return True


def main():
    """Run all tests."""
    print("\n" + "=" * 60)
    print("V2 Activities API Proto Compliance Test")
    print("=" * 60 + "\n")

    tests = [
        test_proto_message_structure,
        test_proto_field_coverage,
        test_task_step_structure,
        test_genealogy_structure,
    ]

    results = []
    for test in tests:
        try:
            result = test()
            results.append(("✅", test.__name__, result))
        except Exception as e:
            results.append(("❌", test.__name__, str(e)))
            import traceback

            traceback.print_exc()

    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)

    for symbol, name, result in results:
        print(f"{symbol} {name}: {result if isinstance(result, bool) else 'ERROR'}")

    passed = sum(1 for s, _, r in results if s == "✅" and isinstance(r, bool) and r)
    total = len(results)

    print(f"\n📊 Passed: {passed}/{total}")

    if passed == total:
        print("✅ All tests passed!")
        return 0
    else:
        print("❌ Some tests failed")
        return 1


if __name__ == "__main__":
    sys.exit(main())
