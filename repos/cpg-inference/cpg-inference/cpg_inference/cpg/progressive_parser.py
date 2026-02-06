"""Progressive CPG parser for incremental updates.

Manages global CPG with add/update/delete operations for files.
Handles cross-file symbol resolution and import tracking.
"""

from __future__ import annotations

import hashlib
import logging
from datetime import datetime
from typing import Any

from cpg_inference.cpg.converter import ASTToCPGConverter
from cpg_inference.cpg.import_graph import ImportGraph
from cpg_inference.cpg.import_resolver import ImportResolver
from cpg_inference.cpg.models import CodePropertyGraph, CPGNode, FileMetadata, EdgeType, CPGEdge
from cpg_inference.cpg.parsers import get_parser
from cpg_inference.cpg.symbol_table import GlobalSymbolTable

logger = logging.getLogger(__name__)


class ProgressiveCPGParser:
    """Manages incremental CPG updates.
    
    Progressive parser that:
    - Maintains a global CPG across all files
    - Supports add/update/delete operations
    - Resolves cross-file symbols via imports
    - Tracks file dependencies for incremental updates
    """
    
    def __init__(self, language: str = "python", project_root: str = "."):
        """Initialize progressive parser.
        
        Args:
            language: Default programming language
            project_root: Root directory of project
        """
        self.language = language
        self.project_root = project_root
        
        # Core components
        self.cpg = CodePropertyGraph(language=language)
        self.symbol_table = GlobalSymbolTable(self.cpg)
        self.import_graph = ImportGraph()
        self.import_resolver = ImportResolver(project_root)
        
        # Wire up references
        self.cpg.symbol_table = self.symbol_table
        self.cpg.import_graph = self.import_graph
        
        # Parser cache (reuse per language)
        self._parser_cache: dict[str, Any] = {}
        self._converter_cache: dict[str, ASTToCPGConverter] = {}
    
    def add_file(self, file_path: str, content: str, language: str | None = None) -> dict:
        """Parse file and integrate into global CPG.
        
        Workflow:
        1. Parse file to CPG nodes/edges
        2. Add nodes to global graph
        3. Extract imports
        4. Update symbol table
        5. Update file index
        6. Build adjacency cache
        
        Args:
            file_path: Path to file
            content: File content
            language: Language override (uses default if None)
            
        Returns:
            Stats dict with counts
        """
        lang = language or self.language
        
        # Compute content hash for change detection
        content_hash = hashlib.sha256(content.encode()).hexdigest()
        
        # Check if file already exists (should be update, not add)
        if file_path in self.cpg.file_index:
            return self.update_file(file_path, content, language)
        
        # Parse file
        file_cpg = self._parse_file(file_path, content, lang)
        if not file_cpg:
            return {"error": "Failed to parse file", "file_path": file_path}
        
        # Track file's nodes
        file_node_ids = set()
        
        # Add nodes to global CPG
        for node_id, node in file_cpg.nodes.items():
            self.cpg.add_node(node)
            file_node_ids.add(node_id)
        
        # Add edges to global CPG
        for edge in file_cpg.edges:
            self.cpg.add_edge(edge)
        
        # Create file metadata
        file_metadata = FileMetadata(
            file_path=file_path,
            content_hash=content_hash,
            node_ids=file_node_ids,
            imports=[],
            exports=set(),
            last_updated=datetime.now(),
        )
        
        self.cpg.file_index[file_path] = file_metadata
        
        # Add symbols to global symbol table
        file_nodes = {nid: self.cpg.nodes[nid] for nid in file_node_ids}
        symbols = self.symbol_table.add_file_symbols(file_path, file_nodes)
        
        # Track exported symbols
        file_metadata.exports = {s.node_id for s in symbols}
        
        # Process imports
        if hasattr(file_cpg, 'file_imports') and file_cpg.file_imports:
            self._process_imports(file_path, file_cpg.file_imports, lang)
        
        # Add file to import resolver
        self.import_resolver.add_file(file_path)
        
        # Rebuild adjacency cache (incremental would be better)
        self.cpg._adjacency_cache = None
        self.cpg._reverse_adjacency_cache = None
        self.cpg.build_adjacency_cache()
        
        return {
            "file_path": file_path,
            "nodes_added": len(file_node_ids),
            "edges_added": len(file_cpg.edges),
            "symbols_added": len(symbols),
        }
    
    def update_file(self, file_path: str, content: str, language: str | None = None) -> dict:
        """Handle file modification.
        
        Workflow:
        1. Remove old nodes and edges
        2. Parse updated file
        3. Add new nodes and edges
        4. Update symbol table
        5. Re-resolve dependent files (TODO)
        
        Args:
            file_path: Path to file
            content: Updated content
            language: Language override
            
        Returns:
            Stats dict
        """
        # Compute new hash
        content_hash = hashlib.sha256(content.encode()).hexdigest()
        
        # Check if file exists
        if file_path not in self.cpg.file_index:
            # File doesn't exist, add it
            return self.add_file(file_path, content, language)
        
        # Check if content changed
        old_metadata = self.cpg.file_index[file_path]
        if old_metadata.content_hash == content_hash:
            # No change
            return {"file_path": file_path, "changed": False}
        
        # Remove old version
        old_stats = self._remove_file_internal(file_path)
        
        # Add new version
        new_stats = self.add_file(file_path, content, language)
        
        return {
            "file_path": file_path,
            "changed": True,
            "removed": old_stats,
            "added": new_stats,
        }
    
    def delete_file(self, file_path: str) -> dict:
        """Remove file from graph.
        
        Workflow:
        1. Remove all nodes from this file
        2. Remove edges touching those nodes
        3. Update symbol table
        4. Mark dependent files as needing re-resolution (TODO)
        5. Remove from import graph
        
        Args:
            file_path: Path to removed file
            
        Returns:
            Stats dict
        """
        return self._remove_file_internal(file_path)
    
    def _remove_file_internal(self, file_path: str) -> dict:
        """Internal method to remove file data.
        
        Args:
            file_path: File to remove
            
        Returns:
            Stats dict
        """
        if file_path not in self.cpg.file_index:
            return {"error": "File not found", "file_path": file_path}
        
        file_metadata = self.cpg.file_index[file_path]
        node_ids = file_metadata.node_ids
        
        # Remove nodes
        for node_id in node_ids:
            self.cpg.nodes.pop(node_id, None)
        
        # Remove edges touching these nodes
        edges_before = len(self.cpg.edges)
        self.cpg.edges = [
            e for e in self.cpg.edges
            if e.source_id not in node_ids and e.target_id not in node_ids
        ]
        edges_removed = edges_before - len(self.cpg.edges)
        
        # Remove symbols
        symbols_removed = self.symbol_table.remove_file_symbols(file_path)
        
        # Remove from import graph
        self.import_graph.remove_file(file_path)
        
        # Remove file metadata
        del self.cpg.file_index[file_path]
        
        # Invalidate adjacency caches
        self.cpg._adjacency_cache = None
        self.cpg._reverse_adjacency_cache = None
        
        return {
            "file_path": file_path,
            "nodes_removed": len(node_ids),
            "edges_removed": edges_removed,
            "symbols_removed": symbols_removed,
        }
    
    def _parse_file(self, file_path: str, content: str, language: str) -> CodePropertyGraph | None:
        """Parse a single file into a CPG.
        
        Args:
            file_path: File path for node IDs
            content: File content
            language: Programming language
            
        Returns:
            CodePropertyGraph or None on error
        """
        try:
            # Get or create parser (LanguageParser instance)
            if language not in self._parser_cache:
                self._parser_cache[language] = get_parser(language)
            language_parser = self._parser_cache[language]
            
            # Get or create converter
            if language not in self._converter_cache:
                self._converter_cache[language] = ASTToCPGConverter(language)
            converter = self._converter_cache[language]
            
            # Parse - LanguageParser.parse() returns a Tree
            tree = language_parser.parse(content)
            
            # Convert to CPG
            cpg = converter.convert(tree, content)
            
            # Update node IDs to include file path for global uniqueness
            self._make_node_ids_global(cpg, file_path)
            
            return cpg
            
        except Exception as e:
            # Log error but don't crash - use logger instead of print to avoid stdout contamination
            logger.warning("Failed to parse file %s: %s", file_path, e, exc_info=True)
            return None
    
    def _make_node_ids_global(self, cpg: CodePropertyGraph, file_path: str) -> None:
        """Make node IDs globally unique by prepending file path.
        
        Modifies CPG in-place to update all node IDs and edge references.
        
        Args:
            cpg: CPG with local node IDs
            file_path: File path to prepend
        """
        # Create mapping of old ID -> new ID
        id_map = {}
        for old_id in cpg.nodes.keys():
            new_id = f"{file_path}::{old_id}"
            id_map[old_id] = new_id
        
        # Update node IDs
        new_nodes = {}
        for old_id, node in cpg.nodes.items():
            new_id = id_map[old_id]
            node.id = new_id
            
            # Update parent_id
            if node.parent_id and node.parent_id in id_map:
                node.parent_id = id_map[node.parent_id]
            
            # Update children_ids
            node.children_ids = [
                id_map.get(child_id, child_id)
                for child_id in node.children_ids
            ]
            
            new_nodes[new_id] = node
        
        cpg.nodes = new_nodes
        
        # Update edges
        for edge in cpg.edges:
            if edge.source_id in id_map:
                edge.source_id = id_map[edge.source_id]
            if edge.target_id in id_map:
                edge.target_id = id_map[edge.target_id]
        
        # Update root_id
        if cpg.root_id and cpg.root_id in id_map:
            cpg.root_id = id_map[cpg.root_id]
    
    def _process_imports(self, file_path: str, imports: list[dict[str, Any]], language: str) -> None:
        """Process import statements for a file.
        
        Updates import graph and symbol table import contexts.
        
        Args:
            file_path: Path to file
            imports: List of import info dicts
            language: Programming language
        """
        # Get import context for this file
        import_ctx = self.symbol_table.get_import_context(file_path)
        
        # Store imports in file metadata
        file_metadata = self.cpg.file_index.get(file_path)
        if file_metadata:
            file_metadata.imports = [imp["module"] for imp in imports]
        
        # Process each import
        for import_info in imports:
            module = import_info["module"]
            symbols = import_info.get("symbols", [])
            alias_map = import_info.get("alias_map", {})
            is_wildcard = import_info.get("is_wildcard", False)
            
            # Resolve module to file path
            resolved_path = self.import_resolver.resolve(module, file_path, language)
            
            if resolved_path:
                # Add to import graph
                self.import_graph.add_import(
                    from_file=file_path,
                    to_file=resolved_path,
                    imported_symbols=symbols,
                    is_wildcard=is_wildcard,
                )
                
                # Update symbol table import context
                if is_wildcard:
                    import_ctx.add_wildcard_import(resolved_path)
                else:
                    # Add specific imports
                    for symbol in symbols:
                        alias = alias_map.get(symbol, symbol)
                        import_ctx.add_import(alias, resolved_path, symbol)
                    
                    # If no specific symbols, it's a module-level import
                    if not symbols:
                        # Module imported as itself
                        module_name = module.split('.')[-1]  # Last part
                        alias = alias_map.get(module_name, module_name)
                        import_ctx.add_import(alias, resolved_path, module_name)
                
                # Create IMPORTS edge (file node to file node)
                # Find file nodes
                source_file_node = None
                target_file_node = None
                
                for node in self.cpg.nodes.values():
                    if node.type.value == "file":
                        # Check if node belongs to source or target file
                        if node.id.startswith(file_path + "::"):
                            source_file_node = node
                        elif node.id.startswith(resolved_path + "::"):
                            target_file_node = node
                
                if source_file_node and target_file_node:
                    # Create IMPORTS edge
                    edge = CPGEdge(
                        source_id=source_file_node.id,
                        target_id=target_file_node.id,
                        type=EdgeType.IMPORTS,
                        metadata={
                            "module": module,
                            "symbols": symbols,
                            "is_wildcard": is_wildcard,
                        },
                    )
                    self.cpg.add_edge(edge)
    
    def resolve_pending(self) -> dict:
        """Resolve all pending cross-file references.
        
        Called after batch of add/update operations.
        Uses import graph to resolve in dependency order.
        
        Returns:
            Stats about resolution
        """
        # Cross-file resolution handled during add_file via import processing
        # This is a placeholder for future enhancements
        return {
            "files_resolved": len(self.cpg.file_index),
            "cross_file_edges": len([
                e for e in self.cpg.edges
                if e.type == EdgeType.IMPORTS
            ]),
        }
    
    def get_stats(self) -> dict:
        """Get parser statistics.
        
        Returns:
            Dict with counts
        """
        return {
            "total_nodes": len(self.cpg.nodes),
            "total_edges": len(self.cpg.edges),
            "total_files": len(self.cpg.file_index),
            "total_symbols": len(self.symbol_table),
            "import_edges": len(self.import_graph),
        }
    
    def clear(self) -> None:
        """Clear all data."""
        self.cpg.nodes.clear()
        self.cpg.edges.clear()
        self.cpg.file_index.clear()
        self.cpg._adjacency_cache = None
        self.cpg._reverse_adjacency_cache = None
        
        self.symbol_table.by_name.clear()
        self.symbol_table.by_qualified.clear()
        self.symbol_table.by_node_id.clear()
        self.symbol_table.by_file.clear()
        self.symbol_table.import_contexts.clear()
        
        self.import_graph.clear()

