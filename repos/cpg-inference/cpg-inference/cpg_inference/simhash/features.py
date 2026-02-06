"""Feature extraction strategies for SimHash computation."""

from abc import ABC, abstractmethod

from cpg_inference.cpg.models import CPGNode, CodePropertyGraph, NodeType


class FeatureExtractor(ABC):
    """Abstract base class for feature extraction strategies.

    Subclasses implement different strategies for extracting
    features from CPG nodes for SimHash computation.
    """

    @abstractmethod
    def extract(self, node: CPGNode, cpg: CodePropertyGraph) -> list[str]:
        """Extract features from a CPG node.

        Args:
            node: CPG node to extract features from
            cpg: Full CPG (for context)

        Returns:
            List of feature strings
        """
        pass

    @property
    @abstractmethod
    def name(self) -> str:
        """Get name of this extraction strategy.

        Returns:
            Strategy name
        """
        pass


class StructuralFeatureExtractor(FeatureExtractor):
    """Extract structural features from CPG nodes.

    Features:
    - Node type
    - Depth in hierarchy
    - Number of children
    - Cyclomatic complexity
    - Control flow patterns
    """

    @property
    def name(self) -> str:
        """Get strategy name."""
        return "structural"

    def extract(self, node: CPGNode, cpg: CodePropertyGraph) -> list[str]:
        """Extract structural features.

        Args:
            node: CPG node
            cpg: Full CPG

        Returns:
            List of structural features
        """
        features = []

        # Node type
        features.append(f"type:{node.type.value}")

        # Depth
        features.append(f"depth:{node.depth}")

        # Number of children (indicates structure complexity)
        num_children = len(node.children_ids)
        features.append(f"children:{min(num_children, 10)}")  # Cap at 10

        # Complexity
        complexity_bucket = self._bucket_complexity(node.complexity)
        features.append(f"complexity:{complexity_bucket}")

        # Size
        loc_bucket = self._bucket_loc(node.lines_of_code)
        features.append(f"loc:{loc_bucket}")

        # Extract control flow patterns from source
        control_flow = self._extract_control_flow(node)
        features.extend(control_flow)

        return features

    def _bucket_complexity(self, complexity: int) -> str:
        """Bucket complexity into ranges.

        Args:
            complexity: Complexity value

        Returns:
            Bucket label
        """
        if complexity <= 1:
            return "trivial"
        if complexity <= 5:
            return "simple"
        if complexity <= 10:
            return "moderate"
        if complexity <= 20:
            return "complex"
        return "very_complex"

    def _bucket_loc(self, loc: int) -> str:
        """Bucket lines of code into ranges.

        Args:
            loc: Lines of code

        Returns:
            Bucket label
        """
        if loc <= 5:
            return "tiny"
        if loc <= 20:
            return "small"
        if loc <= 50:
            return "medium"
        if loc <= 100:
            return "large"
        return "very_large"

    def _extract_control_flow(self, node: CPGNode) -> list[str]:
        """Extract control flow keywords from source.

        Args:
            node: CPG node

        Returns:
            List of control flow features
        """
        features = []
        source = node.source_text.lower()

        # Count control flow keywords
        keywords = ["if", "for", "while", "try", "with", "return", "yield"]
        for keyword in keywords:
            count = source.count(keyword)
            if count > 0:
                features.append(f"cf:{keyword}")

        return features


class SemanticFeatureExtractor(FeatureExtractor):
    """Extract semantic features from CPG nodes.

    Features:
    - Variable/function names (tokenized)
    - Type information
    - Documentation strings
    - String literals
    """

    @property
    def name(self) -> str:
        """Get strategy name."""
        return "semantic"

    def extract(self, node: CPGNode, cpg: CodePropertyGraph) -> list[str]:
        """Extract semantic features.

        Args:
            node: CPG node
            cpg: Full CPG

        Returns:
            List of semantic features
        """
        features = []

        # Node name (tokenized)
        if node.name:
            features.extend(self._tokenize_identifier(node.name))

        # Extract identifiers from source code
        identifiers = self._extract_identifiers(node.source_text)
        features.extend(identifiers)

        return features

    def _tokenize_identifier(self, identifier: str) -> list[str]:
        """Tokenize an identifier (camelCase, snake_case, etc.).

        Args:
            identifier: Identifier string

        Returns:
            List of tokens
        """
        import re

        # Split on underscores and camelCase boundaries
        # e.g., "getUserName" → ["get", "User", "Name"]
        # e.g., "get_user_name" → ["get", "user", "name"]

        tokens = []

        # Split on underscores
        parts = identifier.split("_")

        for part in parts:
            # Split camelCase
            subparts = re.findall(r"[A-Z]?[a-z]+|[A-Z]+(?=[A-Z][a-z]|\b)", part)
            tokens.extend(token.lower() for token in subparts if token)

        # Add prefix for token type
        return [f"token:{token}" for token in tokens if token]

    def _extract_identifiers(self, source: str) -> list[str]:
        """Extract identifier-like tokens from source code.

        Args:
            source: Source code

        Returns:
            List of identifier features
        """
        import re

        # Simple pattern: sequences of word characters
        pattern = r"\b[a-zA-Z_][a-zA-Z0-9_]*\b"
        identifiers = re.findall(pattern, source)

        # Filter out Python keywords
        keywords = {
            "def",
            "class",
            "if",
            "else",
            "elif",
            "for",
            "while",
            "return",
            "yield",
            "import",
            "from",
            "as",
            "try",
            "except",
            "finally",
            "with",
            "lambda",
            "pass",
            "break",
            "continue",
            "raise",
            "assert",
            "in",
            "is",
            "not",
            "and",
            "or",
            "True",
            "False",
            "None",
        }

        # Keep unique non-keyword identifiers
        unique_ids = set(identifiers) - keywords

        return [f"id:{id_}" for id_ in unique_ids]


class MetricFeatureExtractor(FeatureExtractor):
    """Extract metric-based features from CPG nodes.

    Features:
    - Complexity buckets
    - Size metrics
    - Fan-in / fan-out (from edges)
    - Depth metrics
    """

    @property
    def name(self) -> str:
        """Get strategy name."""
        return "metric"

    def extract(self, node: CPGNode, cpg: CodePropertyGraph) -> list[str]:
        """Extract metric features.

        Args:
            node: CPG node
            cpg: Full CPG

        Returns:
            List of metric features
        """
        features = []

        # Complexity ratio (complexity per LOC)
        if node.lines_of_code > 0:
            complexity_ratio = node.complexity / node.lines_of_code
            features.append(f"complexity_ratio:{self._bucket_ratio(complexity_ratio)}")

        # Absolute metrics (bucketed)
        features.append(f"complexity:{node.complexity // 5 * 5}")  # Round to nearest 5
        features.append(f"loc:{node.lines_of_code // 10 * 10}")  # Round to nearest 10

        # Tree depth
        features.append(f"depth:{node.depth}")

        # Number of descendants
        num_descendants = len(self._get_all_descendants(node, cpg))
        features.append(f"descendants:{min(num_descendants, 20)}")

        return features

    def _bucket_ratio(self, ratio: float) -> str:
        """Bucket a ratio value.

        Args:
            ratio: Ratio value

        Returns:
            Bucket label
        """
        if ratio < 0.1:
            return "very_low"
        if ratio < 0.3:
            return "low"
        if ratio < 0.5:
            return "medium"
        if ratio < 1.0:
            return "high"
        return "very_high"

    def _get_all_descendants(self, node: CPGNode, cpg: CodePropertyGraph) -> list[CPGNode]:
        """Get all descendants of a node.

        Args:
            node: Parent node
            cpg: Full CPG

        Returns:
            List of all descendant nodes
        """
        descendants = []
        children = cpg.get_children(node.id)

        for child in children:
            descendants.append(child)
            descendants.extend(self._get_all_descendants(child, cpg))

        return descendants


class HybridFeatureExtractor(FeatureExtractor):
    """Hybrid feature extractor combining multiple strategies.

    Combines structural, semantic, and metric features with
    configurable weights.
    """

    def __init__(
        self,
        use_structural: bool = True,
        use_semantic: bool = True,
        use_metric: bool = True,
    ):
        """Initialize hybrid extractor.

        Args:
            use_structural: Include structural features
            use_semantic: Include semantic features
            use_metric: Include metric features
        """
        self.use_structural = use_structural
        self.use_semantic = use_semantic
        self.use_metric = use_metric

        self._structural = StructuralFeatureExtractor()
        self._semantic = SemanticFeatureExtractor()
        self._metric = MetricFeatureExtractor()

    @property
    def name(self) -> str:
        """Get strategy name."""
        parts = []
        if self.use_structural:
            parts.append("structural")
        if self.use_semantic:
            parts.append("semantic")
        if self.use_metric:
            parts.append("metric")
        return "hybrid_" + "_".join(parts)

    def extract(self, node: CPGNode, cpg: CodePropertyGraph) -> list[str]:
        """Extract hybrid features.

        Args:
            node: CPG node
            cpg: Full CPG

        Returns:
            Combined list of features
        """
        features = []

        if self.use_structural:
            features.extend(self._structural.extract(node, cpg))

        if self.use_semantic:
            features.extend(self._semantic.extract(node, cpg))

        if self.use_metric:
            features.extend(self._metric.extract(node, cpg))

        return features

