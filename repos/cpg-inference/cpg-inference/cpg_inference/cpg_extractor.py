"""Extract semantic components from code files."""

from pathlib import Path

from cpg_inference.cpg import parse_code
from cpg_inference.cpg.models import CodePropertyGraph, NodeType
from cpg_inference.models import CPGComponent


class CPGComponentExtractor:
    """Extract semantic components (functions, classes) from code."""
    
    def __init__(self, component_types: list[str] | None = None):
        """Initialize extractor.
        
        Args:
            component_types: Types to extract (default: function, method, class)
        """
        if component_types is None:
            component_types = ["function", "method", "class"]
        
        # Convert strings to NodeType enum
        self.component_types = set()
        for ct in component_types:
            ct_lower = ct.lower()
            if ct_lower == "function":
                self.component_types.add(NodeType.FUNCTION)
            elif ct_lower == "method":
                self.component_types.add(NodeType.METHOD)
            elif ct_lower == "class":
                self.component_types.add(NodeType.CLASS)
            else:
                raise ValueError(f"Unknown component type: {ct}")
    
    def extract_from_file(self, file_path: str, content: str) -> tuple[list[CPGComponent], CodePropertyGraph]:
        """Extract components from a single file.
        
        Args:
            file_path: Path to file (used for IDs)
            content: File content
            
        Returns:
            Tuple of (components, cpg)
        """
        # Parse code to CPG
        cpg = parse_code(content, filename=file_path)
        
        # Extract components
        components = self._extract_components(cpg, file_path)
        
        return components, cpg
    
    def extract_from_files(
        self,
        files: dict[str, str],
    ) -> tuple[dict[str, list[CPGComponent]], dict[str, CodePropertyGraph]]:
        """Extract components from multiple files.
        
        Args:
            files: Mapping of file_path -> content
            
        Returns:
            Tuple of (file_components, file_cpgs)
            - file_components: file_path -> list of components
            - file_cpgs: file_path -> CPG
        """
        file_components = {}
        file_cpgs = {}
        
        for file_path, content in files.items():
            try:
                components, cpg = self.extract_from_file(file_path, content)
                file_components[file_path] = components
                file_cpgs[file_path] = cpg
            except Exception:
                # Skip files that fail to parse
                file_components[file_path] = []
                file_cpgs[file_path] = None
        
        return file_components, file_cpgs
    
    def _extract_components(
        self,
        cpg: CodePropertyGraph,
        file_path: str,
    ) -> list[CPGComponent]:
        """Extract components from CPG.
        
        Args:
            cpg: Code property graph
            file_path: Path to source file
            
        Returns:
            List of components
        """
        components = []
        
        for node_id, node in cpg.nodes.items():
            # Filter by component type
            if node.type not in self.component_types:
                continue
            
            # Create component
            component = CPGComponent.from_cpg_node(
                node=node,
                file_path=file_path,
                cpg_node_id=node_id,
            )
            components.append(component)
        
        return components
    
    def get_component_by_id(
        self,
        component_id: str,
        files: dict[str, str],
    ) -> CPGComponent | None:
        """Get a specific component by ID.
        
        Args:
            component_id: Component ID
            files: Available files
            
        Returns:
            Component if found, None otherwise
        """
        # Parse component ID to get file path
        parts = component_id.split("::")
        if len(parts) < 4:
            return None
        
        file_path = parts[0]
        
        # Check if file exists
        if file_path not in files:
            return None
        
        # Extract components from file
        components, _ = self.extract_from_file(file_path, files[file_path])
        
        # Find matching component
        for component in components:
            if component.id == component_id:
                return component
        
        return None

