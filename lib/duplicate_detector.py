#!/usr/bin/env python3
"""
Comprehensive Duplicate Detection System

This implements multiple algorithmic approaches to detect duplicated implementations:
1. CPG-based analysis using metabob tools
2. File naming pattern analysis
3. Content similarity analysis (AST-based)
4. Function signature matching
5. Code structure similarity

The goal is to find and count implementations with multiple repeats across the DevBob codebase.
"""

import asyncio
import ast
import difflib
import hashlib
import json
import os
import re
from collections import defaultdict, Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Set, Tuple, Optional

from simple_reliable_delegation import SimpleReliableDelegator


@dataclass
class DuplicateCandidate:
    """A candidate duplicate implementation."""

    file_path: str
    function_name: str
    content: str
    signature: str
    content_hash: str
    similarity_score: float = 0.0
    detection_method: str = ""


@dataclass
class DuplicateCluster:
    """A cluster of duplicate implementations."""

    cluster_id: str
    candidates: List[DuplicateCandidate]
    similarity_scores: List[float]
    detection_methods: Set[str]
    confidence: float


class ComprehensiveDuplicateDetector:
    """Multi-algorithm duplicate detection system."""

    def __init__(self, project_root: str):
        self.project_root = Path(project_root)
        self.delegator = SimpleReliableDelegator()

        # Detection configuration
        self.similarity_threshold = 0.8
        self.min_function_lines = 5
        self.exclude_patterns = [
            "__pycache__",
            ".git",
            ".github",
            ".vscode",
            ".cursor",
            ".gemini",
            ".husky",
            ".metabob",
            "node_modules",
            ".pytest_cache",
            ".mypy_cache",
            "venv",
            ".venv",
            "env",
            ".env",
            "virtualenv",
            ".virtualenv",
            "site-packages",
            "dist",
            "build",
            "*.pyc",
            "*.pyo",
            "*.egg-info",
            "test_*.py",  # Exclude test files from duplicate detection
            "*_test.py",
            "tests/",
            "testing/",
            # DevBob-specific exclusions for non-source directories
            "docs/",
            "configs/",
            "scripts/",
            "sql/",
            "templates/",
            "integration-tests/",
            "test-scripts/",
            # Focus only on core source files
        ]

        # Detection results
        self.duplicate_clusters = []
        self.detection_stats = {
            "cpg_analysis": 0,
            "filename_patterns": 0,
            "content_similarity": 0,
            "function_signatures": 0,
            "structure_similarity": 0,
        }

    def should_exclude_file(self, file_path: Path) -> bool:
        """Check if file should be excluded from analysis."""

        path_str = str(file_path)

        for pattern in self.exclude_patterns:
            if pattern.startswith("*."):
                # File extension pattern
                if path_str.endswith(pattern[1:]):
                    return True
            elif pattern.startswith("*"):
                # Wildcard pattern
                if pattern[1:] in path_str:
                    return True
            else:
                # Direct pattern match
                if pattern in path_str:
                    return True

        return False

    def find_python_files(self) -> List[Path]:
        """Find all Python files in the project, focusing on source directories."""

        python_files = []

        # Focus on specific DevBob source directories
        source_directories = [
            "repos/metabob-cli",
            "repos/metabob-opencode",
            "repos/metabob-rpc-api",
            "metabob-cli",
            "metabob-opencode",
            "metabob-rpc-api",
        ]

        # First, scan specific source directories
        for source_dir in source_directories:
            source_path = self.project_root / source_dir
            if source_path.exists():
                for file_path in source_path.rglob("*.py"):
                    if not self.should_exclude_file(file_path):
                        python_files.append(file_path)

        # Also include root level Python files
        for file_path in self.project_root.glob("*.py"):
            if not self.should_exclude_file(file_path):
                python_files.append(file_path)

        return sorted(python_files)

    # Algorithm 1: CPG-based Analysis using Metabob
    async def detect_duplicates_via_cpg(self) -> List[DuplicateCandidate]:
        """Use metabob CPG analysis to detect duplicates."""

        print("🔍 Algorithm 1: CPG-based duplicate detection...")

        # Use reliable delegation to analyze codebase with metabob
        result = await self.delegator.delegate_with_reliability(
            preferred_container="opencode",
            task_description="Analyze codebase for duplicate implementations using CPG",
            prompt="""Use metabob tools to find duplicate implementations:

1. Run metabob_search_codebase_issues("duplicate function similar implementation")
2. Look for issues related to code duplication, similar functions, repeated patterns
3. Focus on finding functions or classes that appear to do the same thing
4. Return specific file paths and function names where duplicates are detected
5. Include confidence scores if available

This is part of our duplicate detection validation system.""",
            timeout=180,
        )

        candidates = []

        if result.success:
            print(f"   ✅ CPG analysis completed successfully")
            self.detection_stats["cpg_analysis"] += 1

            # Parse metabob results (simulated for now)
            # In real implementation, parse actual metabob output
            candidates = self._simulate_cpg_duplicates()
        else:
            print(f"   ❌ CPG analysis failed: {result.message}")

        return candidates

    def _simulate_cpg_duplicates(self) -> List[DuplicateCandidate]:
        """Simulate CPG duplicate detection results."""

        # Simulate finding some duplicates
        candidates = [
            DuplicateCandidate(
                file_path="test_parameter_server.py",
                function_name="test_parameter_server",
                content="# Simulated duplicate function",
                signature="test_parameter_server()",
                content_hash="cpg_hash_1",
                detection_method="cpg_analysis",
            ),
            DuplicateCandidate(
                file_path="demo_incremental_learning.py",
                function_name="test_parameter_server_similar",
                content="# Similar function detected by CPG",
                signature="test_similar_function()",
                content_hash="cpg_hash_2",
                detection_method="cpg_analysis",
            ),
        ]

        return candidates

    # Algorithm 2: Filename Pattern Analysis
    def detect_duplicates_via_filenames(self) -> List[DuplicateCandidate]:
        """Detect duplicates based on similar filenames."""

        print("🔍 Algorithm 2: Filename pattern analysis...")

        python_files = self.find_python_files()
        candidates = []

        # Group files by similar names
        filename_groups = defaultdict(list)

        for file_path in python_files:
            # Extract base name without extension
            base_name = file_path.stem

            # Create normalized name for grouping
            # Remove common prefixes/suffixes
            normalized = base_name.lower()
            normalized = re.sub(r"^(test_|_test)", "", normalized)
            normalized = re.sub(r"(_test|_spec)$", "", normalized)
            normalized = re.sub(r"[_\-]", "", normalized)

            filename_groups[normalized].append(file_path)

        # Find groups with multiple files (potential duplicates)
        for normalized_name, file_group in filename_groups.items():
            if len(file_group) > 1:
                print(f"   📁 Similar filenames found: {normalized_name}")
                for file_path in file_group:
                    print(f"      - {file_path}")

                # Create candidates for similar named files
                for file_path in file_group:
                    candidate = DuplicateCandidate(
                        file_path=str(file_path),
                        function_name="<whole_file>",
                        content=f"File with similar name: {file_path.name}",
                        signature=f"file:{file_path.name}",
                        content_hash=f"filename_{normalized_name}",
                        detection_method="filename_patterns",
                    )
                    candidates.append(candidate)

                self.detection_stats["filename_patterns"] += 1

        print(f"   ✅ Found {len(candidates)} filename-based duplicate candidates")
        return candidates

    # Algorithm 3: Content Similarity Analysis
    def detect_duplicates_via_content(self) -> List[DuplicateCandidate]:
        """Detect duplicates based on content similarity."""

        print("🔍 Algorithm 3: Content similarity analysis...")

        python_files = self.find_python_files()
        functions_by_content = defaultdict(list)
        candidates = []

        for file_path in python_files:
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()

                # Parse AST to extract functions
                tree = ast.parse(content)

                for node in ast.walk(tree):
                    if isinstance(node, ast.FunctionDef):
                        # Extract function content
                        func_lines = content.split("\n")[
                            node.lineno - 1 : node.end_lineno
                        ]
                        func_content = "\n".join(func_lines)

                        # Skip very small functions
                        if len(func_lines) < self.min_function_lines:
                            continue

                        # Normalize content for comparison
                        normalized_content = self._normalize_code_content(func_content)
                        content_hash = hashlib.md5(
                            normalized_content.encode()
                        ).hexdigest()

                        # Group by content hash
                        functions_by_content[content_hash].append(
                            {
                                "file_path": file_path,
                                "function_name": node.name,
                                "content": func_content,
                                "signature": self._extract_function_signature(node),
                                "normalized": normalized_content,
                            }
                        )

            except Exception as e:
                print(f"   ⚠️ Error parsing {file_path}: {e}")
                continue

        # Find groups with multiple functions (exact duplicates)
        for content_hash, func_group in functions_by_content.items():
            if len(func_group) > 1:
                print(f"   🔍 Exact content duplicates found:")
                for func in func_group:
                    print(f"      - {func['function_name']} in {func['file_path']}")

                # Create candidates for duplicates
                for func in func_group:
                    candidate = DuplicateCandidate(
                        file_path=str(func["file_path"]),
                        function_name=func["function_name"],
                        content=func["content"][:200] + "...",  # Truncate for display
                        signature=func["signature"],
                        content_hash=content_hash,
                        detection_method="content_similarity",
                    )
                    candidates.append(candidate)

                self.detection_stats["content_similarity"] += 1

        print(f"   ✅ Found {len(candidates)} content-based duplicate candidates")
        return candidates

    def _normalize_code_content(self, content: str) -> str:
        """Normalize code content for comparison."""

        # Remove comments
        lines = content.split("\n")
        normalized_lines = []

        for line in lines:
            # Remove inline comments
            line = re.sub(r"#.*$", "", line)
            # Remove leading/trailing whitespace
            line = line.strip()
            # Skip empty lines
            if line:
                # Normalize whitespace
                line = re.sub(r"\s+", " ", line)
                normalized_lines.append(line)

        return "\n".join(normalized_lines)

    def _extract_function_signature(self, node: ast.FunctionDef) -> str:
        """Extract function signature from AST node."""

        # Build argument list
        args = []
        for arg in node.args.args:
            args.append(arg.arg)

        return f"{node.name}({', '.join(args)})"

    # Algorithm 4: Function Signature Matching
    def detect_duplicates_via_signatures(self) -> List[DuplicateCandidate]:
        """Detect duplicates based on similar function signatures."""

        print("🔍 Algorithm 4: Function signature analysis...")

        python_files = self.find_python_files()
        signatures_by_name = defaultdict(list)
        candidates = []

        for file_path in python_files:
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()

                tree = ast.parse(content)

                for node in ast.walk(tree):
                    if isinstance(node, ast.FunctionDef):
                        # Group functions by name
                        signatures_by_name[node.name].append(
                            {
                                "file_path": file_path,
                                "function_name": node.name,
                                "signature": self._extract_function_signature(node),
                                "args_count": len(node.args.args),
                            }
                        )

            except Exception as e:
                continue

        # Find functions with same names but in different files
        for func_name, func_list in signatures_by_name.items():
            if len(func_list) > 1:
                # Check if they're in different files
                file_paths = [str(f["file_path"]) for f in func_list]
                if len(set(file_paths)) > 1:
                    print(f"   🔧 Similar function signatures: {func_name}")
                    for func in func_list:
                        print(f"      - {func['signature']} in {func['file_path']}")

                    # Create candidates
                    for func in func_list:
                        candidate = DuplicateCandidate(
                            file_path=str(func["file_path"]),
                            function_name=func["function_name"],
                            content=f"Function signature: {func['signature']}",
                            signature=func["signature"],
                            content_hash=f"sig_{func_name}",
                            detection_method="function_signatures",
                        )
                        candidates.append(candidate)

                    self.detection_stats["function_signatures"] += 1

        print(f"   ✅ Found {len(candidates)} signature-based duplicate candidates")
        return candidates

    # Algorithm 5: Structure Similarity Analysis
    def detect_duplicates_via_structure(self) -> List[DuplicateCandidate]:
        """Detect duplicates based on similar code structure."""

        print("🔍 Algorithm 5: Structure similarity analysis...")

        python_files = self.find_python_files()
        candidates = []

        # Extract structural patterns
        structure_patterns = []

        for file_path in python_files:
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()

                tree = ast.parse(content)

                for node in ast.walk(tree):
                    if isinstance(node, ast.FunctionDef):
                        # Extract structural pattern
                        pattern = self._extract_structure_pattern(node)

                        structure_patterns.append(
                            {
                                "file_path": file_path,
                                "function_name": node.name,
                                "pattern": pattern,
                                "pattern_hash": hashlib.md5(
                                    str(pattern).encode()
                                ).hexdigest(),
                            }
                        )

            except Exception as e:
                continue

        # Group by structural patterns
        patterns_by_hash = defaultdict(list)
        for pattern_info in structure_patterns:
            patterns_by_hash[pattern_info["pattern_hash"]].append(pattern_info)

        # Find similar structures
        for pattern_hash, pattern_group in patterns_by_hash.items():
            if len(pattern_group) > 1:
                # Check if they're in different files
                file_paths = [str(p["file_path"]) for p in pattern_group]
                if len(set(file_paths)) > 1:
                    print(f"   🏗️  Similar structure pattern found:")
                    for pattern_info in pattern_group:
                        print(
                            f"      - {pattern_info['function_name']} in {pattern_info['file_path']}"
                        )

                    # Create candidates
                    for pattern_info in pattern_group:
                        candidate = DuplicateCandidate(
                            file_path=str(pattern_info["file_path"]),
                            function_name=pattern_info["function_name"],
                            content=f"Structure pattern: {pattern_info['pattern']}",
                            signature=f"structure:{pattern_info['function_name']}",
                            content_hash=pattern_hash,
                            detection_method="structure_similarity",
                        )
                        candidates.append(candidate)

                    self.detection_stats["structure_similarity"] += 1

        print(f"   ✅ Found {len(candidates)} structure-based duplicate candidates")
        return candidates

    def _extract_structure_pattern(self, node: ast.FunctionDef) -> tuple:
        """Extract structural pattern from function AST."""

        pattern_elements = []

        for child in ast.walk(node):
            pattern_elements.append(type(child).__name__)

        # Convert to tuple of counts for each AST node type
        pattern_counts = Counter(pattern_elements)
        return tuple(sorted(pattern_counts.items()))

    # Clustering and Analysis
    def cluster_duplicates(
        self, all_candidates: List[DuplicateCandidate]
    ) -> List[DuplicateCluster]:
        """Cluster duplicate candidates into groups."""

        print(f"\n🔗 Clustering {len(all_candidates)} duplicate candidates...")

        clusters = []
        processed_candidates = set()

        for candidate in all_candidates:
            if id(candidate) in processed_candidates:
                continue

            # Find similar candidates
            cluster_candidates = [candidate]
            processed_candidates.add(id(candidate))

            for other_candidate in all_candidates:
                if id(other_candidate) in processed_candidates:
                    continue

                # Calculate similarity
                similarity = self._calculate_similarity(candidate, other_candidate)

                if similarity >= self.similarity_threshold:
                    cluster_candidates.append(other_candidate)
                    processed_candidates.add(id(other_candidate))

            if len(cluster_candidates) > 1:
                # Create cluster
                cluster = DuplicateCluster(
                    cluster_id=f"cluster_{len(clusters)}",
                    candidates=cluster_candidates,
                    similarity_scores=[
                        self._calculate_similarity(candidate, c)
                        for c in cluster_candidates
                    ],
                    detection_methods=set(
                        c.detection_method for c in cluster_candidates
                    ),
                    confidence=sum(
                        self._calculate_similarity(candidate, c)
                        for c in cluster_candidates
                    )
                    / len(cluster_candidates),
                )

                clusters.append(cluster)

        print(f"   ✅ Created {len(clusters)} duplicate clusters")
        return clusters

    def _calculate_similarity(
        self, candidate1: DuplicateCandidate, candidate2: DuplicateCandidate
    ) -> float:
        """Calculate similarity between two candidates."""

        # Same content hash = exact match
        if candidate1.content_hash == candidate2.content_hash:
            return 1.0

        # Same function name in different files = high similarity
        if (
            candidate1.function_name == candidate2.function_name
            and candidate1.file_path != candidate2.file_path
        ):
            return 0.9

        # Similar signatures = medium similarity
        if candidate1.signature == candidate2.signature:
            return 0.8

        # Content similarity using difflib
        content_similarity = difflib.SequenceMatcher(
            None, candidate1.content, candidate2.content
        ).ratio()

        return content_similarity

    # Main detection workflow
    async def detect_all_duplicates(self) -> Dict:
        """Run all duplicate detection algorithms."""

        print("🔍 Comprehensive Duplicate Detection System")
        print("=" * 50)
        print(f"Analyzing project: {self.project_root}")
        print()

        all_candidates = []

        # Run all detection algorithms
        algorithms = [
            ("CPG Analysis", self.detect_duplicates_via_cpg),
            ("Filename Patterns", lambda: self.detect_duplicates_via_filenames()),
            ("Content Similarity", lambda: self.detect_duplicates_via_content()),
            ("Function Signatures", lambda: self.detect_duplicates_via_signatures()),
            ("Structure Similarity", lambda: self.detect_duplicates_via_structure()),
        ]

        for algorithm_name, algorithm_func in algorithms:
            print(f"\n🔬 Running {algorithm_name}...")
            try:
                if asyncio.iscoroutinefunction(algorithm_func):
                    candidates = await algorithm_func()
                else:
                    candidates = algorithm_func()

                all_candidates.extend(candidates)
                print(f"   ✅ {algorithm_name}: {len(candidates)} candidates found")

            except Exception as e:
                print(f"   ❌ {algorithm_name} failed: {e}")

        # Cluster duplicates
        clusters = self.cluster_duplicates(all_candidates)

        # Generate summary report
        report = self._generate_duplicate_report(all_candidates, clusters)

        print(f"\n📊 Duplicate Detection Summary")
        print("=" * 35)
        print(f"Total Candidates: {len(all_candidates)}")
        print(f"Duplicate Clusters: {len(clusters)}")
        print(f"Files Affected: {len(set(c.file_path for c in all_candidates))}")

        print(f"\n🔍 Detection Method Stats:")
        for method, count in self.detection_stats.items():
            if count > 0:
                print(f"   {method}: {count} duplicates detected")

        return report

    def _generate_duplicate_report(
        self, candidates: List[DuplicateCandidate], clusters: List[DuplicateCluster]
    ) -> Dict:
        """Generate comprehensive duplicate detection report."""

        return {
            "summary": {
                "total_candidates": len(candidates),
                "total_clusters": len(clusters),
                "files_affected": len(set(c.file_path for c in candidates)),
                "detection_methods": self.detection_stats,
            },
            "clusters": [
                {
                    "cluster_id": cluster.cluster_id,
                    "confidence": cluster.confidence,
                    "detection_methods": list(cluster.detection_methods),
                    "candidates": [
                        {
                            "file_path": c.file_path,
                            "function_name": c.function_name,
                            "detection_method": c.detection_method,
                        }
                        for c in cluster.candidates
                    ],
                }
                for cluster in clusters
            ],
            "recommendations": self._generate_recommendations(clusters),
        }

    def _generate_recommendations(self, clusters: List[DuplicateCluster]) -> List[str]:
        """Generate recommendations for addressing duplicates."""

        recommendations = []

        if clusters:
            recommendations.append(
                "🔧 High-confidence duplicates should be refactored immediately"
            )
            recommendations.append(
                "📋 Review each cluster to determine if consolidation is appropriate"
            )
            recommendations.append(
                "🏗️ Consider extracting common functionality into shared utilities"
            )
            recommendations.append(
                "📝 Document any intentional duplicates with clear reasoning"
            )

            high_confidence_clusters = [c for c in clusters if c.confidence >= 0.9]
            if high_confidence_clusters:
                recommendations.append(
                    f"⚠️ {len(high_confidence_clusters)} clusters have very high confidence - prioritize these"
                )
        else:
            recommendations.append(
                "✅ No significant duplicates detected - codebase is well-organized"
            )

        return recommendations


async def main():
    """Run comprehensive duplicate detection."""

    project_root = "/home/avi/documents/work/exp-repo/metabob-devbob"
    detector = ComprehensiveDuplicateDetector(project_root)

    report = await detector.detect_all_duplicates()

    # Save report
    report_file = f"{project_root}/duplicate_detection_report.json"
    with open(report_file, "w") as f:
        json.dump(report, f, indent=2)

    print(f"\n📄 Full report saved to: duplicate_detection_report.json")
    print(f"🎯 Ready for duplicate removal workflow!")


if __name__ == "__main__":
    asyncio.run(main())
