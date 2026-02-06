"""Import graph for tracking file dependencies.

Maintains directed graph of file import relationships for:
- Incremental update propagation
- Dependency resolution order
- Cycle detection
"""

from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass, field


@dataclass
class ImportInfo:
    """Information about an import relationship."""
    
    from_file: str
    to_file: str
    imported_symbols: list[str] = field(default_factory=list)
    is_wildcard: bool = False
    
    def __hash__(self) -> int:
        """Make hashable by file pair."""
        return hash((self.from_file, self.to_file))


class ImportGraph:
    """Directed graph of file dependencies.
    
    Tracks which files import which other files for:
    - Determining update order (topological sort)
    - Finding dependents when file changes
    - Detecting import cycles
    """
    
    def __init__(self):
        """Initialize empty import graph."""
        # Forward graph: file -> files it imports
        self.graph: dict[str, set[str]] = defaultdict(set)
        
        # Reverse graph: file -> files that import it
        self.reverse: dict[str, set[str]] = defaultdict(set)
        
        # Detailed import information
        self.import_details: dict[tuple[str, str], ImportInfo] = {}
    
    def add_import(self, from_file: str, to_file: str, 
                   imported_symbols: list[str] | None = None,
                   is_wildcard: bool = False) -> None:
        """Record that from_file imports to_file.
        
        Args:
            from_file: File doing the importing
            to_file: File being imported
            imported_symbols: List of specific symbols imported
            is_wildcard: Whether this is a wildcard import
        """
        self.graph[from_file].add(to_file)
        self.reverse[to_file].add(from_file)
        
        # Store detailed info
        self.import_details[(from_file, to_file)] = ImportInfo(
            from_file=from_file,
            to_file=to_file,
            imported_symbols=imported_symbols or [],
            is_wildcard=is_wildcard,
        )
    
    def remove_file(self, file_path: str) -> None:
        """Remove file and all its import edges.
        
        Args:
            file_path: Path to removed file
        """
        # Remove forward edges (what this file imports)
        if file_path in self.graph:
            for imported_file in self.graph[file_path]:
                # Remove from reverse graph
                if imported_file in self.reverse:
                    self.reverse[imported_file].discard(file_path)
                # Remove import details
                self.import_details.pop((file_path, imported_file), None)
            del self.graph[file_path]
        
        # Remove reverse edges (files that import this)
        if file_path in self.reverse:
            for importing_file in self.reverse[file_path]:
                # Remove from forward graph
                if importing_file in self.graph:
                    self.graph[importing_file].discard(file_path)
                # Remove import details
                self.import_details.pop((importing_file, file_path), None)
            del self.reverse[file_path]
    
    def get_imports(self, file_path: str) -> set[str]:
        """Get files imported by this file.
        
        Args:
            file_path: File path
            
        Returns:
            Set of imported file paths
        """
        return self.graph.get(file_path, set())
    
    def get_importers(self, file_path: str) -> set[str]:
        """Get files that import this file (direct importers only).
        
        Args:
            file_path: File path
            
        Returns:
            Set of file paths that import this file
        """
        return self.reverse.get(file_path, set())
    
    def get_dependents(self, file_path: str) -> set[str]:
        """Get all files that depend on this file (transitive).
        
        Uses BFS to find all files reachable via reverse edges.
        
        Args:
            file_path: File path
            
        Returns:
            Set of all files that transitively depend on this file
        """
        dependents = set()
        queue = deque([file_path])
        visited = {file_path}
        
        while queue:
            current = queue.popleft()
            
            # Get direct importers
            for importer in self.reverse.get(current, set()):
                if importer not in visited:
                    visited.add(importer)
                    dependents.add(importer)
                    queue.append(importer)
        
        return dependents
    
    def get_dependencies(self, file_path: str) -> set[str]:
        """Get all files this file depends on (transitive).
        
        Uses BFS to find all files reachable via forward edges.
        
        Args:
            file_path: File path
            
        Returns:
            Set of all files this file transitively depends on
        """
        dependencies = set()
        queue = deque([file_path])
        visited = {file_path}
        
        while queue:
            current = queue.popleft()
            
            # Get direct imports
            for imported in self.graph.get(current, set()):
                if imported not in visited:
                    visited.add(imported)
                    dependencies.add(imported)
                    queue.append(imported)
        
        return dependencies
    
    def topological_sort(self) -> list[str]:
        """Get processing order (dependencies first).
        
        Uses Kahn's algorithm for topological sort.
        Handles cycles by returning partial order.
        
        Returns:
            List of files in dependency order (safe processing order)
        """
        # Calculate in-degrees based on imports (forward edges)
        # in_degree[file] = number of files that file imports
        in_degree = defaultdict(int)
        all_files = set(self.graph.keys()) | set(self.reverse.keys())
        
        for file in all_files:
            in_degree[file] = len(self.graph.get(file, set()))
        
        # Start with files that import nothing (pure dependencies)
        queue = deque([f for f in all_files if in_degree[f] == 0])
        result = []
        
        while queue:
            current = queue.popleft()
            result.append(current)
            
            # Reduce in-degree for files that THIS file is imported by
            for importer in self.reverse.get(current, set()):
                in_degree[importer] -= 1
                if in_degree[importer] == 0:
                    queue.append(importer)
        
        # If not all files processed, there are cycles
        if len(result) < len(all_files):
            # Add remaining files (in cycle) in arbitrary order
            remaining = all_files - set(result)
            result.extend(sorted(remaining))
        
        return result
    
    def detect_cycles(self) -> list[list[str]]:
        """Find strongly connected components (cycles).
        
        Uses Tarjan's algorithm to find SCCs.
        
        Returns:
            List of cycles (each cycle is a list of file paths)
        """
        index = 0
        stack = []
        indices = {}
        lowlinks = {}
        on_stack = set()
        sccs = []
        
        def strongconnect(node: str) -> None:
            nonlocal index
            
            indices[node] = index
            lowlinks[node] = index
            index += 1
            stack.append(node)
            on_stack.add(node)
            
            # Consider successors
            for successor in self.graph.get(node, set()):
                if successor not in indices:
                    strongconnect(successor)
                    lowlinks[node] = min(lowlinks[node], lowlinks[successor])
                elif successor in on_stack:
                    lowlinks[node] = min(lowlinks[node], indices[successor])
            
            # If node is a root, pop the stack and generate SCC
            if lowlinks[node] == indices[node]:
                scc = []
                while True:
                    w = stack.pop()
                    on_stack.remove(w)
                    scc.append(w)
                    if w == node:
                        break
                # Only report cycles (SCCs with more than one node or self-loop)
                if len(scc) > 1 or (len(scc) == 1 and node in self.graph.get(node, set())):
                    sccs.append(scc)
        
        # Run algorithm on all nodes
        all_files = set(self.graph.keys()) | set(self.reverse.keys())
        for file in all_files:
            if file not in indices:
                strongconnect(file)
        
        return sccs
    
    def has_path(self, from_file: str, to_file: str) -> bool:
        """Check if there's an import path from from_file to to_file.
        
        Args:
            from_file: Source file
            to_file: Target file
            
        Returns:
            True if path exists
        """
        if from_file == to_file:
            return True
        
        visited = set()
        queue = deque([from_file])
        
        while queue:
            current = queue.popleft()
            if current in visited:
                continue
            
            visited.add(current)
            
            if current == to_file:
                return True
            
            for imported in self.graph.get(current, set()):
                if imported not in visited:
                    queue.append(imported)
        
        return False
    
    def get_import_info(self, from_file: str, to_file: str) -> ImportInfo | None:
        """Get detailed information about an import.
        
        Args:
            from_file: Importing file
            to_file: Imported file
            
        Returns:
            ImportInfo or None if no such import
        """
        return self.import_details.get((from_file, to_file))
    
    def clear(self) -> None:
        """Clear all import data."""
        self.graph.clear()
        self.reverse.clear()
        self.import_details.clear()
    
    def __len__(self) -> int:
        """Return number of unique files in graph."""
        return len(set(self.graph.keys()) | set(self.reverse.keys()))
    
    def __repr__(self) -> str:
        """String representation."""
        num_edges = sum(len(imports) for imports in self.graph.values())
        return f"ImportGraph({len(self)} files, {num_edges} edges)"

