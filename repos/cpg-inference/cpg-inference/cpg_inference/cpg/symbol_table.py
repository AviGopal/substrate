"""Symbol table for efficient symbol lookup across CPG.

Provides O(1) indexed lookups for functions, classes, and other symbols
to enable performant cross-reference resolution.

GlobalSymbolTable extends this to support import-aware resolution across
an entire codebase with progressive file addition/removal.
"""

from dataclasses import dataclass, field
from typing import Any

from cpg_inference.cpg.models import CodePropertyGraph, NodeType


@dataclass
class Symbol:
    """A symbol in the codebase (function, class, method, etc.)."""
    
    name: str  # Simple name (e.g., "calculate")
    node_id: str  # CPG node ID
    node_type: NodeType  # Type of symbol
    file_path: str | None  # File path if known
    qualified_name: str  # Fully qualified name (e.g., "Calculator.calculate")
    scope: str | None  # Parent scope (class/module name)
    parent_id: str | None  # Parent node ID
    
    def __hash__(self) -> int:
        """Make symbol hashable by node_id."""
        return hash(self.node_id)


class SymbolTable:
    """Fast indexed lookup table for symbols across CPG.
    
    Provides O(1) lookups by name, qualified name, and node ID.
    Built in O(n) time where n = number of nodes in CPG.
    """
    
    def __init__(self, cpg: CodePropertyGraph):
        """Build symbol table from CPG.
        
        Args:
            cpg: Code property graph
        """
        self.cpg = cpg
        
        # Indexed lookups
        self.by_name: dict[str, list[Symbol]] = {}  # name -> [symbols]
        self.by_qualified_name: dict[str, Symbol] = {}  # qualified_name -> symbol
        self.by_node_id: dict[str, Symbol] = {}  # node_id -> symbol
        
        # Build indexes
        self._build_table()
    
    def _build_table(self) -> None:
        """Build symbol table indexes from CPG nodes."""
        # First pass: Create symbols for functions and classes
        for node_id, node in self.cpg.nodes.items():
            if node.type in [NodeType.FUNCTION, NodeType.METHOD, NodeType.CLASS]:
                symbol = self._create_symbol(node_id, node)
                
                # Index by node_id
                self.by_node_id[node_id] = symbol
                
                # Index by name (multiple symbols can have same name)
                if symbol.name not in self.by_name:
                    self.by_name[symbol.name] = []
                self.by_name[symbol.name].append(symbol)
                
                # Index by qualified name (should be unique)
                self.by_qualified_name[symbol.qualified_name] = symbol
    
    def _create_symbol(self, node_id: str, node: Any) -> Symbol:
        """Create a symbol from a CPG node.
        
        Args:
            node_id: Node ID
            node: CPG node
            
        Returns:
            Symbol instance
        """
        # Determine scope and qualified name
        scope = None
        qualified_name = node.name
        
        if node.parent_id:
            parent = self.cpg.get_node(node.parent_id)
            if parent and parent.type in [NodeType.CLASS, NodeType.FILE]:
                scope = parent.name
                qualified_name = f"{parent.name}.{node.name}"
        
        return Symbol(
            name=node.name,
            node_id=node_id,
            node_type=node.type,
            file_path=None,  # Can be added if needed
            qualified_name=qualified_name,
            scope=scope,
            parent_id=node.parent_id,
        )
    
    def find_function(self, name: str, context_node_id: str | None = None) -> list[Symbol]:
        """Find functions by name with optional context.
        
        Args:
            name: Function name to find
            context_node_id: Optional context node for scoped lookup
            
        Returns:
            List of matching function symbols
        """
        candidates = self.by_name.get(name, [])
        
        # Filter to functions only
        functions = [s for s in candidates if s.node_type in [NodeType.FUNCTION, NodeType.METHOD]]
        
        if not context_node_id or not functions:
            return functions
        
        # If context provided, prioritize same-scope functions
        context_node = self.cpg.get_node(context_node_id)
        if not context_node:
            return functions
        
        # Find context scope (parent class/module)
        context_scope = None
        if context_node.parent_id:
            parent = self.cpg.get_node(context_node.parent_id)
            if parent and parent.type in [NodeType.CLASS, NodeType.FILE]:
                context_scope = parent.name
        
        # Prioritize functions in same scope
        same_scope = [f for f in functions if f.scope == context_scope]
        if same_scope:
            return same_scope
        
        return functions
    
    def find_class(self, name: str) -> Symbol | None:
        """Find class by name.
        
        Args:
            name: Class name to find
            
        Returns:
            Class symbol or None
        """
        candidates = self.by_name.get(name, [])
        classes = [s for s in candidates if s.node_type == NodeType.CLASS]
        return classes[0] if classes else None
    
    def find_by_qualified_name(self, qualified_name: str) -> Symbol | None:
        """Find symbol by fully qualified name.
        
        Args:
            qualified_name: Qualified name (e.g., "MyClass.myMethod")
            
        Returns:
            Symbol or None
        """
        return self.by_qualified_name.get(qualified_name)
    
    def find_in_scope(self, name: str, scope: str) -> Symbol | None:
        """Find symbol in specific scope.
        
        Args:
            name: Symbol name
            scope: Scope name (class/module)
            
        Returns:
            Symbol or None
        """
        candidates = self.by_name.get(name, [])
        in_scope = [s for s in candidates if s.scope == scope]
        return in_scope[0] if in_scope else None
    
    def get_symbol(self, node_id: str) -> Symbol | None:
        """Get symbol by node ID.
        
        Args:
            node_id: CPG node ID
            
        Returns:
            Symbol or None
        """
        return self.by_node_id.get(node_id)
    
    def __len__(self) -> int:
        """Return number of symbols in table."""
        return len(self.by_node_id)
    
    def __repr__(self) -> str:
        """String representation."""
        return f"SymbolTable({len(self)} symbols)"


@dataclass
class ImportContext:
    """Import context for a single file."""
    
    file_path: str
    # Map: imported_name -> (source_file, original_name)
    imports: dict[str, tuple[str, str]] = field(default_factory=dict)
    # Wildcard imports: set of file paths
    wildcard_imports: set[str] = field(default_factory=set)
    
    def add_import(self, imported_name: str, source_file: str, original_name: str | None = None) -> None:
        """Add an import mapping.
        
        Args:
            imported_name: Name as used in this file
            source_file: File where symbol is defined
            original_name: Original name in source file (if different from imported_name)
        """
        self.imports[imported_name] = (source_file, original_name or imported_name)
    
    def add_wildcard_import(self, source_file: str) -> None:
        """Add a wildcard import (from X import *).
        
        Args:
            source_file: File to import all symbols from
        """
        self.wildcard_imports.add(source_file)
    
    def resolve_import(self, name: str) -> tuple[str, str] | None:
        """Resolve an imported name to its source.
        
        Args:
            name: Name to resolve
            
        Returns:
            (source_file, original_name) or None if not imported
        """
        return self.imports.get(name)


class GlobalSymbolTable:
    """Global symbol table with import-aware resolution.
    
    Unified symbol resolution across entire codebase. Supports:
    - Progressive file addition/removal
    - Import-aware symbol resolution
    - Multiple files defining same symbol name
    - Incremental updates without full rebuild
    """
    
    def __init__(self, cpg: CodePropertyGraph):
        """Initialize global symbol table.
        
        Args:
            cpg: Global code property graph
        """
        self.cpg = cpg
        
        # Primary indexes
        self.by_name: dict[str, list[Symbol]] = {}  # name -> symbols (multiple files)
        self.by_qualified: dict[str, Symbol] = {}  # qualified_name -> symbol (unique)
        self.by_node_id: dict[str, Symbol] = {}  # node_id -> symbol
        self.by_file: dict[str, list[Symbol]] = {}  # file_path -> symbols from that file
        
        # Import tracking
        self.import_contexts: dict[str, ImportContext] = {}  # file_path -> import context
    
    def add_file_symbols(self, file_path: str, nodes: dict[str, Any]) -> list[Symbol]:
        """Add symbols from a newly parsed file.
        
        Args:
            file_path: Path to file
            nodes: Dictionary of node_id -> CPGNode from this file
            
        Returns:
            List of created symbols
        """
        symbols = []
        
        for node_id, node in nodes.items():
            if node.type in [NodeType.FUNCTION, NodeType.METHOD, NodeType.CLASS]:
                symbol = self._create_symbol_from_node(node_id, node, file_path)
                symbols.append(symbol)
                
                # Index by node_id
                self.by_node_id[node_id] = symbol
                
                # Index by name (multiple symbols can have same name)
                if symbol.name not in self.by_name:
                    self.by_name[symbol.name] = []
                self.by_name[symbol.name].append(symbol)
                
                # Index by qualified name
                self.by_qualified[symbol.qualified_name] = symbol
        
        # Index by file
        self.by_file[file_path] = symbols
        
        return symbols
    
    def remove_file_symbols(self, file_path: str) -> int:
        """Remove all symbols from a deleted file.
        
        Args:
            file_path: Path to removed file
            
        Returns:
            Number of symbols removed
        """
        if file_path not in self.by_file:
            return 0
        
        symbols = self.by_file[file_path]
        count = len(symbols)
        
        for symbol in symbols:
            # Remove from by_node_id
            self.by_node_id.pop(symbol.node_id, None)
            
            # Remove from by_name
            if symbol.name in self.by_name:
                self.by_name[symbol.name] = [
                    s for s in self.by_name[symbol.name] 
                    if s.node_id != symbol.node_id
                ]
                if not self.by_name[symbol.name]:
                    del self.by_name[symbol.name]
            
            # Remove from by_qualified
            self.by_qualified.pop(symbol.qualified_name, None)
        
        # Remove file from index
        del self.by_file[file_path]
        
        # Remove import context
        self.import_contexts.pop(file_path, None)
        
        return count
    
    def resolve(self, name: str, context_file: str | None = None) -> list[Symbol]:
        """Resolve symbol considering import context.
        
        Resolution order with context_file:
        1. Local symbols in that file (highest priority)
        2. Explicitly imported symbols
        3. Wildcard imported symbols
        4. Global symbols (fallback)
        
        Without context_file: Returns all matching symbols globally.
        
        Args:
            name: Symbol name to resolve
            context_file: File path for import context
            
        Returns:
            List of matching symbols, prioritized by resolution order
        """
        if not context_file:
            # No context: return all matching symbols globally
            return self.by_name.get(name, [])
        
        results = []
        
        # 1. Check local symbols (same file)
        local_symbols = [
            s for s in self.by_file.get(context_file, [])
            if s.name == name
        ]
        if local_symbols:
            results.extend(local_symbols)
        
        # 2. Check explicit imports
        import_ctx = self.import_contexts.get(context_file)
        if import_ctx:
            import_info = import_ctx.resolve_import(name)
            if import_info:
                source_file, original_name = import_info
                # Find symbol in source file
                imported_symbols = [
                    s for s in self.by_file.get(source_file, [])
                    if s.name == original_name
                ]
                results.extend(imported_symbols)
            
            # 3. Check wildcard imports
            if not results:
                for wildcard_file in import_ctx.wildcard_imports:
                    wildcard_symbols = [
                        s for s in self.by_file.get(wildcard_file, [])
                        if s.name == name
                    ]
                    results.extend(wildcard_symbols)
        
        # 4. Fallback to global
        if not results:
            results = self.by_name.get(name, [])
        
        return results
    
    def get_import_context(self, file_path: str) -> ImportContext:
        """Get or create import context for a file.
        
        Args:
            file_path: Path to file
            
        Returns:
            Import context for the file
        """
        if file_path not in self.import_contexts:
            self.import_contexts[file_path] = ImportContext(file_path)
        return self.import_contexts[file_path]
    
    def _create_symbol_from_node(self, node_id: str, node: Any, file_path: str) -> Symbol:
        """Create a symbol from a CPG node.
        
        Args:
            node_id: Node ID
            node: CPG node
            file_path: File path
            
        Returns:
            Symbol instance
        """
        # Determine scope and qualified name
        scope = None
        qualified_name = f"{file_path}::{node.name}"
        
        if node.parent_id:
            parent = self.cpg.get_node(node.parent_id)
            if parent and parent.type in [NodeType.CLASS]:
                scope = parent.name
                qualified_name = f"{file_path}::{parent.name}.{node.name}"
        
        return Symbol(
            name=node.name,
            node_id=node_id,
            node_type=node.type,
            file_path=file_path,
            qualified_name=qualified_name,
            scope=scope,
            parent_id=node.parent_id,
        )
    
    def find_function(self, name: str, context_file: str | None = None) -> list[Symbol]:
        """Find functions by name with optional context.
        
        Args:
            name: Function name to find
            context_file: Optional file path for scoped lookup
            
        Returns:
            List of matching function symbols
        """
        candidates = self.resolve(name, context_file)
        return [s for s in candidates if s.node_type in [NodeType.FUNCTION, NodeType.METHOD]]
    
    def find_class(self, name: str, context_file: str | None = None) -> list[Symbol]:
        """Find classes by name with optional context.
        
        Args:
            name: Class name to find
            context_file: Optional file path for scoped lookup
            
        Returns:
            List of matching class symbols
        """
        candidates = self.resolve(name, context_file)
        return [s for s in candidates if s.node_type == NodeType.CLASS]
    
    def get_symbol(self, node_id: str) -> Symbol | None:
        """Get symbol by node ID.
        
        Args:
            node_id: CPG node ID
            
        Returns:
            Symbol or None
        """
        return self.by_node_id.get(node_id)
    
    def get_file_symbols(self, file_path: str) -> list[Symbol]:
        """Get all symbols from a specific file.
        
        Args:
            file_path: Path to file
            
        Returns:
            List of symbols from that file
        """
        return self.by_file.get(file_path, [])
    
    def __len__(self) -> int:
        """Return total number of symbols."""
        return len(self.by_node_id)
    
    def __repr__(self) -> str:
        """String representation."""
        return f"GlobalSymbolTable({len(self)} symbols, {len(self.by_file)} files)"

