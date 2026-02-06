"""Convert tree-sitter AST to Code Property Graph."""

from typing import Any

from tree_sitter import Node as TSNode
from tree_sitter import Tree

from cpg_inference.cpg.models import CodePropertyGraph, CPGEdge, CPGNode, EdgeType, NodeType
from cpg_inference.cpg.node_mappings import get_cpg_node_type, should_include_node
from cpg_inference.cpg.symbol_table import SymbolTable

# Language-specific node types for semantic edge extraction
CALL_NODE_TYPES = {
    "python": ["call"],
    "java": ["method_invocation", "object_creation_expression"],
    "javascript": ["call_expression", "new_expression"],
    "typescript": ["call_expression", "new_expression"],
    "c": ["call_expression"],
    "cpp": ["call_expression", "new_expression"],
    "php": ["function_call_expression", "member_call_expression", "scoped_call_expression"],
    "ruby": ["call", "method_call"],
}

MEMBER_ACCESS_TYPES = {
    "python": ["attribute", "subscript"],
    "java": ["field_access", "array_access", "method_reference"],
    "javascript": ["member_expression", "subscript_expression"],
    "typescript": ["member_expression", "subscript_expression"],
    "c": ["field_expression", "subscript_expression", "pointer_expression"],
    "cpp": ["field_expression", "subscript_expression", "pointer_expression"],
    "php": ["member_access_expression", "subscript_expression"],
    "ruby": ["element_reference", "scope_resolution"],
}


class ASTToCPGConverter:
    """Convert tree-sitter AST to Code Property Graph.

    This converter is language-agnostic and uses node mappings
    to determine which AST nodes become CPG nodes.
    """

    def __init__(self, language: str = "python"):
        """Initialize converter.

        Args:
            language: Source language
        """
        self.language = language
        self._node_counter = 0
        self._source_code = ""

    def convert(self, tree: Tree, source_code: str) -> CodePropertyGraph:
        """Convert tree-sitter Tree to CPG.

        Args:
            tree: tree-sitter Tree object
            source_code: Original source code

        Returns:
            CodePropertyGraph
        """
        self._source_code = source_code
        self._node_counter = 0

        cpg = CodePropertyGraph(language=self.language)

        # Pass 1: Convert nodes and build containment edges
        root_ts_node = tree.root_node
        root_cpg_node = self._convert_node(root_ts_node, depth=0)

        if root_cpg_node:
            cpg.add_node(root_cpg_node)
            cpg.root_id = root_cpg_node.id

            # Recursively convert children and build containment edges
            self._convert_children(root_ts_node, root_cpg_node, cpg, depth=1)

        # Build symbol table for efficient lookups
        symbol_table = SymbolTable(cpg)

        # Pass 2: Extract CALLS edges (function calls)
        self._extract_call_edges(tree, cpg, symbol_table)

        # Pass 3: Extract DEPENDS edges (data dependencies)
        self._extract_depends_edges(tree, cpg, symbol_table)

        # Pass 4: Extract INHERITS edges (class inheritance)
        self._extract_inherits_edges(tree, cpg, symbol_table)
        
        # Pass 5: Extract imports (for cross-file resolution)
        # Store in metadata for progressive parser to use
        imports = self._extract_imports(tree)
        if imports:
            cpg.file_imports = imports

        return cpg

    def _convert_node(self, ts_node: TSNode, depth: int, parent_id: str | None = None) -> CPGNode | None:
        """Convert a tree-sitter node to CPG node.

        Args:
            ts_node: tree-sitter node
            depth: Depth in hierarchy
            parent_id: ID of parent CPG node

        Returns:
            CPGNode if node should be included, None otherwise
        """
        # Check if this node type should be included
        if not should_include_node(ts_node.type, self.language):
            return None

        # Get CPG node type
        cpg_type = get_cpg_node_type(ts_node.type, self.language)
        if cpg_type is None:
            return None

        # Generate unique ID
        node_id = self._gen_id()

        # Extract node name
        name = self._extract_name(ts_node, cpg_type)

        # Get source text
        source_text = self._get_source_text(ts_node)

        # Create CPG node
        cpg_node = CPGNode(
            id=node_id,
            type=cpg_type,
            name=name,
            start_line=ts_node.start_point[0] + 1,  # 1-indexed
            end_line=ts_node.end_point[0] + 1,
            start_byte=ts_node.start_byte,
            end_byte=ts_node.end_byte,
            source_text=source_text,
            language=self.language,
            parent_id=parent_id,
            depth=depth,
            lines_of_code=self._count_loc(source_text),
            complexity=self._estimate_complexity(ts_node),
        )

        # Store tree-sitter node type in metadata
        cpg_node.ast_metadata["ts_node_type"] = ts_node.type

        return cpg_node

    def _convert_children(
        self, ts_node: TSNode, parent_cpg_node: CPGNode, cpg: CodePropertyGraph, depth: int
    ) -> None:
        """Recursively convert children and add to CPG.

        Args:
            ts_node: Parent tree-sitter node
            parent_cpg_node: Parent CPG node
            cpg: CPG to add nodes to
            depth: Current depth
        """
        for child_ts_node in ts_node.children:
            # Try to convert child
            child_cpg_node = self._convert_node(child_ts_node, depth, parent_cpg_node.id)

            if child_cpg_node:
                # Add child node to CPG
                cpg.add_node(child_cpg_node)

                # Add containment edge
                edge = CPGEdge(
                    source_id=parent_cpg_node.id,
                    target_id=child_cpg_node.id,
                    type=EdgeType.CONTAINS,
                )
                cpg.add_edge(edge)

                # Recursively process grandchildren
                self._convert_children(child_ts_node, child_cpg_node, cpg, depth + 1)
            else:
                # Child not included, but check its children
                # (e.g., decorated_definition wraps function_definition)
                self._convert_children(child_ts_node, parent_cpg_node, cpg, depth)

    def _extract_name(self, ts_node: TSNode, cpg_type: NodeType) -> str:
        """Extract meaningful name from tree-sitter node.

        Args:
            ts_node: tree-sitter node
            cpg_type: CPG node type

        Returns:
            Name string
        """
        # For FILE nodes, use filename or "module"
        if cpg_type == NodeType.FILE:
            return "module"

        # Try to find 'name' or 'identifier' child
        for child in ts_node.children:
            if child.type == "identifier" or child.type == "name":
                return self._get_source_text(child)

        # For statements, use a generic name
        if cpg_type == NodeType.STATEMENT:
            return ts_node.type.replace("_", " ")

        # Default to node type
        return ts_node.type

    def _get_source_text(self, ts_node: TSNode) -> str:
        """Get source code text for a node.

        Args:
            ts_node: tree-sitter node

        Returns:
            Source code string
        """
        return self._source_code[ts_node.start_byte : ts_node.end_byte]

    def _count_loc(self, source_text: str) -> int:
        """Count lines of code (non-blank).

        Args:
            source_text: Source code

        Returns:
            Number of non-blank lines
        """
        lines = source_text.split("\n")
        return sum(1 for line in lines if line.strip())

    def _estimate_complexity(self, ts_node: TSNode) -> int:
        """Estimate cyclomatic complexity.

        Args:
            ts_node: tree-sitter node

        Returns:
            Estimated complexity (starts at 1)
        """
        # Start with base complexity of 1
        complexity = 1

        # Add 1 for each decision point
        decision_nodes = {
            "if_statement",
            "elif_clause",
            "else_clause",
            "while_statement",
            "for_statement",
            "except_clause",
            "and",
            "or",
        }

        # Count decision points in subtree
        def count_decisions(node: TSNode) -> int:
            count = 1 if node.type in decision_nodes else 0
            for child in node.children:
                count += count_decisions(child)
            return count

        complexity += count_decisions(ts_node)

        return complexity

    def _gen_id(self) -> str:
        """Generate unique node ID.

        Returns:
            Unique ID string
        """
        self._node_counter += 1
        return f"node_{self._node_counter}"

    def _extract_call_edges(self, tree: Tree, cpg: CodePropertyGraph, symbol_table: SymbolTable) -> None:
        """Extract CALLS edges from function calls in the AST.

        Args:
            tree: tree-sitter Tree
            cpg: Code property graph to add edges to
            symbol_table: Symbol table for O(1) lookups
        """
        # Get language-specific call node types
        call_types = CALL_NODE_TYPES.get(self.language, ["call"])
        
        # Find all call expressions for this language
        call_nodes = []
        for call_type in call_types:
            call_nodes.extend(self._find_all_nodes(tree.root_node, call_type))

        for call_node in call_nodes:
            # Find the containing function/method
            caller_cpg_node = self._find_containing_function(call_node, cpg)
            if not caller_cpg_node:
                continue

            # Extract the function being called
            callee_name = self._extract_callee_name(call_node)
            if not callee_name:
                continue

            # Resolve using symbol table (O(1) lookup)
            callee_symbols = symbol_table.find_function(callee_name, caller_cpg_node.id)
            if not callee_symbols:
                continue
            
            # Use first match (could be enhanced with better resolution)
            callee_cpg_node = cpg.get_node(callee_symbols[0].node_id)
            if not callee_cpg_node:
                continue

            # Avoid self-calls and duplicate edges
            if caller_cpg_node.id == callee_cpg_node.id:
                continue

            # Check if edge already exists
            edge_exists = any(
                e.source_id == caller_cpg_node.id
                and e.target_id == callee_cpg_node.id
                and e.type == EdgeType.CALLS
                for e in cpg.edges
            )

            if not edge_exists:
                # Add CALLS edge
                edge = CPGEdge(
                    source_id=caller_cpg_node.id,
                    target_id=callee_cpg_node.id,
                    type=EdgeType.CALLS,
                )
                cpg.add_edge(edge)

    def _extract_depends_edges(self, tree: Tree, cpg: CodePropertyGraph, symbol_table: SymbolTable) -> None:
        """Extract DEPENDS edges from member access, variable usage, and assignments.

        Args:
            tree: tree-sitter Tree
            cpg: Code property graph to add edges to
            symbol_table: Symbol table for O(1) lookups
        """
        # 1. Member access dependencies (existing)
        self._extract_member_access_depends(tree, cpg, symbol_table)
        
        # 2. Assignment flow dependencies (new)
        self._extract_assignment_depends(tree, cpg, symbol_table)
        
        # 3. Parameter flow dependencies (new)
        self._extract_parameter_depends(tree, cpg, symbol_table)
        
        # 4. Return flow dependencies (new)
        self._extract_return_depends(tree, cpg, symbol_table)
    
    def _extract_member_access_depends(self, tree: Tree, cpg: CodePropertyGraph, symbol_table: SymbolTable) -> None:
        """Extract DEPENDS edges from member access patterns.
        
        Args:
            tree: tree-sitter Tree
            cpg: Code property graph
            symbol_table: Symbol table
        """
        # Get language-specific member access node types
        access_types = MEMBER_ACCESS_TYPES.get(self.language, ["attribute"])
        
        # Find all member access nodes
        access_nodes = []
        for access_type in access_types:
            access_nodes.extend(self._find_all_nodes(tree.root_node, access_type))
        
        for access_node in access_nodes:
            # Find the containing function
            func_node = self._find_containing_function(access_node, cpg)
            if not func_node:
                continue
            
            # Extract the target identifier being accessed
            target_name = self._extract_access_target(access_node)
            if not target_name:
                continue
            
            # Try to resolve to a class (for class.field access)
            target_symbol = symbol_table.find_class(target_name)
            if target_symbol:
                target_cpg_node = cpg.get_node(target_symbol.node_id)
                if target_cpg_node and target_cpg_node.id != func_node.id:
                    self._add_depends_edge(cpg, func_node.id, target_cpg_node.id)
    
    def _extract_assignment_depends(self, tree: Tree, cpg: CodePropertyGraph, symbol_table: SymbolTable) -> None:
        """Extract DEPENDS edges from variable assignments.
        
        Tracks: variable = function_call() dependencies
        
        Args:
            tree: tree-sitter Tree
            cpg: Code property graph
            symbol_table: Symbol table
        """
        # Language-specific assignment node types
        assignment_types = {
            "python": ["assignment"],
            "java": ["local_variable_declaration", "assignment_expression"],
            "javascript": ["variable_declarator", "assignment_expression"],
            "typescript": ["variable_declarator", "assignment_expression"],
            "c": ["init_declarator", "assignment_expression"],
            "cpp": ["init_declarator", "assignment_expression"],
            "php": ["assignment_expression"],
            "ruby": ["assignment"],
        }
        
        assign_node_types = assignment_types.get(self.language, ["assignment"])
        
        # Find all assignment nodes
        assignment_nodes = []
        for assign_type in assign_node_types:
            assignment_nodes.extend(self._find_all_nodes(tree.root_node, assign_type))
        
        for assign_node in assignment_nodes:
            # Find containing function
            func_node = self._find_containing_function(assign_node, cpg)
            if not func_node:
                continue
            
            # Look for function call on right-hand side
            call_types = CALL_NODE_TYPES.get(self.language, ["call"])
            calls_in_assignment = []
            for call_type in call_types:
                calls_in_assignment.extend(self._find_all_nodes(assign_node, call_type))
            
            for call_node in calls_in_assignment:
                callee_name = self._extract_callee_name(call_node)
                if not callee_name:
                    continue
                
                # Resolve callee
                callee_symbols = symbol_table.find_function(callee_name, func_node.id)
                if not callee_symbols:
                    continue
                
                callee_cpg_node = cpg.get_node(callee_symbols[0].node_id)
                if callee_cpg_node and callee_cpg_node.id != func_node.id:
                    self._add_depends_edge(cpg, func_node.id, callee_cpg_node.id)
    
    def _extract_parameter_depends(self, tree: Tree, cpg: CodePropertyGraph, symbol_table: SymbolTable) -> None:
        """Extract DEPENDS edges from parameter flow.
        
        Tracks: func(other_func()) - dependency on other_func
        
        Args:
            tree: tree-sitter Tree
            cpg: Code property graph
            symbol_table: Symbol table
        """
        # Find all function calls
        call_types = CALL_NODE_TYPES.get(self.language, ["call"])
        call_nodes = []
        for call_type in call_types:
            call_nodes.extend(self._find_all_nodes(tree.root_node, call_type))
        
        for call_node in call_nodes:
            # Find containing function
            func_node = self._find_containing_function(call_node, cpg)
            if not func_node:
                continue
            
            # Look for nested calls in arguments
            nested_calls = []
            for call_type in call_types:
                nested_calls.extend(self._find_all_nodes(call_node, call_type))
            
            # Remove the current call itself
            nested_calls = [c for c in nested_calls if c != call_node]
            
            for nested_call in nested_calls:
                callee_name = self._extract_callee_name(nested_call)
                if not callee_name:
                    continue
                
                # Resolve callee
                callee_symbols = symbol_table.find_function(callee_name, func_node.id)
                if not callee_symbols:
                    continue
                
                callee_cpg_node = cpg.get_node(callee_symbols[0].node_id)
                if callee_cpg_node and callee_cpg_node.id != func_node.id:
                    self._add_depends_edge(cpg, func_node.id, callee_cpg_node.id)
    
    def _extract_return_depends(self, tree: Tree, cpg: CodePropertyGraph, symbol_table: SymbolTable) -> None:
        """Extract DEPENDS edges from return statements.
        
        Tracks: return other_func() - dependency on other_func
        
        Args:
            tree: tree-sitter Tree
            cpg: Code property graph
            symbol_table: Symbol table
        """
        # Language-specific return statement types
        return_types = {
            "python": ["return_statement"],
            "java": ["return_statement"],
            "javascript": ["return_statement"],
            "typescript": ["return_statement"],
            "c": ["return_statement"],
            "cpp": ["return_statement"],
            "php": ["return_statement"],
            "ruby": ["return"],
        }
        
        ret_node_types = return_types.get(self.language, ["return_statement"])
        
        # Find all return statements
        return_nodes = []
        for ret_type in ret_node_types:
            return_nodes.extend(self._find_all_nodes(tree.root_node, ret_type))
        
        for return_node in return_nodes:
            # Find containing function
            func_node = self._find_containing_function(return_node, cpg)
            if not func_node:
                continue
            
            # Look for function calls in return value
            call_types = CALL_NODE_TYPES.get(self.language, ["call"])
            calls_in_return = []
            for call_type in call_types:
                calls_in_return.extend(self._find_all_nodes(return_node, call_type))
            
            for call_node in calls_in_return:
                callee_name = self._extract_callee_name(call_node)
                if not callee_name:
                    continue
                
                # Resolve callee
                callee_symbols = symbol_table.find_function(callee_name, func_node.id)
                if not callee_symbols:
                    continue
                
                callee_cpg_node = cpg.get_node(callee_symbols[0].node_id)
                if callee_cpg_node and callee_cpg_node.id != func_node.id:
                    self._add_depends_edge(cpg, func_node.id, callee_cpg_node.id)
    
    def _add_depends_edge(self, cpg: CodePropertyGraph, source_id: str, target_id: str) -> None:
        """Add DEPENDS edge if it doesn't exist.
        
        Args:
            cpg: Code property graph
            source_id: Source node ID
            target_id: Target node ID
        """
        # Avoid duplicate edges
        edge_exists = any(
            e.source_id == source_id
            and e.target_id == target_id
            and e.type == EdgeType.DEPENDS
            for e in cpg.edges
        )
        
        if not edge_exists:
            edge = CPGEdge(
                source_id=source_id,
                target_id=target_id,
                type=EdgeType.DEPENDS,
            )
            cpg.add_edge(edge)

    def _extract_inherits_edges(self, tree: Tree, cpg: CodePropertyGraph, symbol_table: SymbolTable) -> None:
        """Extract INHERITS edges from class inheritance relationships.

        Args:
            tree: tree-sitter Tree
            cpg: Code property graph to add edges to
            symbol_table: Symbol table for O(1) lookups
        """
        # Find all class nodes in CPG
        for class_node in cpg.get_nodes_by_type(NodeType.CLASS):
            # Find corresponding tree-sitter node
            ts_class_node = self._find_ts_node_by_byte_range(
                tree.root_node, class_node.start_byte, class_node.end_byte
            )
            if not ts_class_node:
                continue
            
            # Extract parent class names (language-specific)
            parent_names = self._extract_parent_classes(ts_class_node)
            
            # Resolve each parent to a CPG class node
            for parent_name in parent_names:
                parent_symbol = symbol_table.find_class(parent_name)
                if parent_symbol:
                    parent_node = cpg.get_node(parent_symbol.node_id)
                    if parent_node and parent_node.id != class_node.id:
                        # Avoid duplicate edges
                        edge_exists = any(
                            e.source_id == class_node.id
                            and e.target_id == parent_node.id
                            and e.type == EdgeType.INHERITS
                            for e in cpg.edges
                        )
                        
                        if not edge_exists:
                            edge = CPGEdge(
                                source_id=class_node.id,
                                target_id=parent_node.id,
                                type=EdgeType.INHERITS,
                            )
                            cpg.add_edge(edge)

    def _extract_access_target(self, access_node: TSNode) -> str | None:
        """Extract target identifier from member access node.

        Args:
            access_node: tree-sitter member access node

        Returns:
            Target identifier or None
        """
        # Try to extract identifier from first child
        for child in access_node.children:
            if child.type == "identifier":
                return self._get_source_text(child)
        
        # Fallback: extract from source text
        source = self._get_source_text(access_node)
        if source:
            # Simple heuristic: get first identifier before dot/arrow
            parts = source.split('.')[0].split('->')[0].strip()
            if parts:
                return parts
        
        return None

    def _extract_parent_classes(self, class_node: TSNode) -> list[str]:
        """Extract parent class names from class definition.

        Args:
            class_node: tree-sitter class node

        Returns:
            List of parent class names
        """
        parent_names = []
        
        # Language-specific extraction
        for child in class_node.children:
            # Python: class Foo(Bar, Baz)
            if child.type == "argument_list":
                for arg in child.children:
                    if arg.type == "identifier":
                        parent_names.append(self._get_source_text(arg))
            
            # Java: class Foo extends Bar
            elif child.type == "superclass":
                for grandchild in child.children:
                    if grandchild.type == "type_identifier":
                        parent_names.append(self._get_source_text(grandchild))
            
            # JavaScript/TypeScript: class Foo extends Bar
            elif child.type == "class_heritage":
                for grandchild in child.children:
                    if grandchild.type == "identifier":
                        parent_names.append(self._get_source_text(grandchild))
            
            # C++: class Foo : public Bar
            elif child.type == "base_class_clause":
                for grandchild in child.children:
                    if grandchild.type in ["type_identifier", "identifier"]:
                        parent_names.append(self._get_source_text(grandchild))
            
            # Ruby: class Foo < Bar
            elif child.type == "superclass":
                for grandchild in child.children:
                    if grandchild.type in ["constant", "identifier"]:
                        parent_names.append(self._get_source_text(grandchild))
        
        return parent_names

    def _find_ts_node_by_byte_range(self, root: TSNode, start_byte: int, end_byte: int) -> TSNode | None:
        """Find tree-sitter node by byte range.

        Args:
            root: Root tree-sitter node
            start_byte: Start byte offset
            end_byte: End byte offset

        Returns:
            Matching tree-sitter node or None
        """
        if root.start_byte == start_byte and root.end_byte == end_byte:
            return root
        
        for child in root.children:
            result = self._find_ts_node_by_byte_range(child, start_byte, end_byte)
            if result:
                return result
        
        return None

    def _find_all_nodes(self, root: TSNode, node_type: str) -> list[TSNode]:
        """Find all nodes of a specific type in the AST.

        Args:
            root: Root tree-sitter node
            node_type: Node type to find

        Returns:
            List of matching tree-sitter nodes
        """
        matches = []

        def traverse(node: TSNode):
            if node_type in node.type:  # Partial match (e.g., "call" matches "call_expression")
                matches.append(node)
            for child in node.children:
                traverse(child)

        traverse(root)
        return matches

    def _extract_imports(self, tree: Tree) -> list[dict[str, Any]]:
        """Extract import statements from the AST.
        
        Returns list of import info dicts with:
        - module: Module/package name being imported
        - symbols: List of specific symbols imported (empty for wildcard)
        - alias_map: Dict of import_name -> local_alias
        - is_wildcard: Whether this is a wildcard import
        - line: Line number of import statement
        
        Args:
            tree: tree-sitter Tree
            
        Returns:
            List of import information dicts
        """
        imports = []
        
        # Language-specific import node types
        import_types = {
            "python": ["import_statement", "import_from_statement"],
            "java": ["import_declaration"],
            "javascript": ["import_statement"],
            "typescript": ["import_statement"],
            "c": ["preproc_include"],
            "cpp": ["preproc_include"],
            "php": ["namespace_use_declaration"],
            "ruby": ["require", "require_relative"],
        }
        
        import_node_types = import_types.get(self.language, [])
        
        for import_type in import_node_types:
            import_nodes = self._find_all_nodes(tree.root_node, import_type)
            
            for import_node in import_nodes:
                import_info = self._parse_import_node(import_node)
                if import_info:
                    imports.append(import_info)
        
        return imports
    
    def _parse_import_node(self, import_node: TSNode) -> dict[str, Any] | None:
        """Parse an import statement node.
        
        Args:
            import_node: tree-sitter import node
            
        Returns:
            Import info dict or None
        """
        node_type = import_node.type
        
        # Python imports
        if self.language == "python":
            if node_type == "import_statement":
                # import foo, bar as baz
                return self._parse_python_import(import_node)
            elif node_type == "import_from_statement":
                # from foo import bar, baz as qux
                return self._parse_python_from_import(import_node)
        
        # Java imports
        elif self.language == "java":
            # import com.example.Foo;
            return self._parse_java_import(import_node)
        
        # JavaScript/TypeScript imports
        elif self.language in ["javascript", "typescript"]:
            # import { foo, bar } from 'module'
            return self._parse_js_import(import_node)
        
        # C/C++ includes
        elif self.language in ["c", "cpp"]:
            # #include <stdio.h> or #include "my_header.h"
            return self._parse_c_include(import_node)
        
        return None
    
    def _parse_python_import(self, import_node: TSNode) -> dict[str, Any] | None:
        """Parse Python 'import' statement.
        
        Args:
            import_node: Python import_statement node
            
        Returns:
            Import info dict
        """
        module_names = []
        alias_map = {}
        
        # Extract module names and aliases
        for child in import_node.children:
            if child.type == "dotted_name":
                module_name = self._get_source_text(child)
                module_names.append(module_name)
            elif child.type == "aliased_import":
                # import foo as bar
                name_child = child.child_by_field_name("name")
                alias_child = child.child_by_field_name("alias")
                if name_child and alias_child:
                    module_name = self._get_source_text(name_child)
                    alias = self._get_source_text(alias_child)
                    module_names.append(module_name)
                    alias_map[module_name] = alias
        
        if not module_names:
            return None
        
        # Create import info for each module
        return {
            "module": module_names[0] if module_names else "",
            "symbols": [],  # Whole module imported
            "alias_map": alias_map,
            "is_wildcard": False,
            "line": import_node.start_point[0] + 1,
        }
    
    def _parse_python_from_import(self, import_node: TSNode) -> dict[str, Any] | None:
        """Parse Python 'from X import Y' statement.
        
        Args:
            import_node: Python import_from_statement node
            
        Returns:
            Import info dict
        """
        module = ""
        symbols = []
        alias_map = {}
        is_wildcard = False
        
        for child in import_node.children:
            if child.type in ["dotted_name", "relative_import"]:
                module = self._get_source_text(child)
            elif child.type == "wildcard_import":
                is_wildcard = True
            elif child.type == "imported_import":
                # from foo import bar, baz
                for grandchild in child.children:
                    if grandchild.type == "identifier":
                        symbol = self._get_source_text(grandchild)
                        symbols.append(symbol)
                    elif grandchild.type == "aliased_import":
                        name_child = grandchild.child_by_field_name("name")
                        alias_child = grandchild.child_by_field_name("alias")
                        if name_child and alias_child:
                            symbol = self._get_source_text(name_child)
                            alias = self._get_source_text(alias_child)
                            symbols.append(symbol)
                            alias_map[symbol] = alias
        
        return {
            "module": module,
            "symbols": symbols,
            "alias_map": alias_map,
            "is_wildcard": is_wildcard,
            "line": import_node.start_point[0] + 1,
        }
    
    def _parse_java_import(self, import_node: TSNode) -> dict[str, Any] | None:
        """Parse Java import statement.
        
        Args:
            import_node: Java import_declaration node
            
        Returns:
            Import info dict
        """
        # Find scoped_identifier or asterisk
        module = ""
        is_wildcard = False
        
        for child in import_node.children:
            if child.type == "scoped_identifier":
                module = self._get_source_text(child)
            elif child.type == "asterisk":
                is_wildcard = True
        
        if not module:
            return None
        
        return {
            "module": module,
            "symbols": [],
            "alias_map": {},
            "is_wildcard": is_wildcard,
            "line": import_node.start_point[0] + 1,
        }
    
    def _parse_js_import(self, import_node: TSNode) -> dict[str, Any] | None:
        """Parse JavaScript/TypeScript import statement.
        
        Args:
            import_node: JS import_statement node
            
        Returns:
            Import info dict
        """
        module = ""
        symbols = []
        alias_map = {}
        
        for child in import_node.children:
            if child.type == "string":
                # Module path in quotes
                module_text = self._get_source_text(child)
                module = module_text.strip("'\"")
            elif child.type == "import_clause":
                # Extract imported symbols
                for grandchild in child.children:
                    if grandchild.type == "named_imports":
                        # import { foo, bar }
                        for import_spec in grandchild.children:
                            if import_spec.type == "import_specifier":
                                # Could have alias: foo as bar
                                name_node = import_spec.child_by_field_name("name")
                                alias_node = import_spec.child_by_field_name("alias")
                                if name_node:
                                    symbol = self._get_source_text(name_node)
                                    symbols.append(symbol)
                                    if alias_node:
                                        alias = self._get_source_text(alias_node)
                                        alias_map[symbol] = alias
                    elif grandchild.type == "identifier":
                        # Default import: import Foo
                        symbol = self._get_source_text(grandchild)
                        symbols.append(symbol)
        
        return {
            "module": module,
            "symbols": symbols,
            "alias_map": alias_map,
            "is_wildcard": False,
            "line": import_node.start_point[0] + 1,
        }
    
    def _parse_c_include(self, import_node: TSNode) -> dict[str, Any] | None:
        """Parse C/C++ #include directive.
        
        Args:
            import_node: C preproc_include node
            
        Returns:
            Import info dict
        """
        module = ""
        
        for child in import_node.children:
            if child.type in ["string_literal", "system_lib_string"]:
                module_text = self._get_source_text(child)
                # Remove quotes or angle brackets
                module = module_text.strip('<>"')
        
        return {
            "module": module,
            "symbols": [],
            "alias_map": {},
            "is_wildcard": True,  # C includes everything
            "line": import_node.start_point[0] + 1,
        }
    
    def _find_containing_function(self, ts_node: TSNode, cpg: CodePropertyGraph) -> CPGNode | None:
        """Find the CPG function node containing a tree-sitter node.

        Args:
            ts_node: tree-sitter node
            cpg: Code property graph

        Returns:
            Containing function CPG node, or None
        """
        # Find all function nodes and check if ts_node is within their byte range
        for cpg_node in cpg.nodes.values():
            if cpg_node.type == NodeType.FUNCTION:
                # Check if ts_node is within this function's byte range
                if cpg_node.start_byte <= ts_node.start_byte <= cpg_node.end_byte:
                    return cpg_node

        return None

    def _extract_callee_name(self, call_node: TSNode) -> str | None:
        """Extract the name of the function being called.

        Args:
            call_node: tree-sitter call expression node

        Returns:
            Function name string, or None
        """
        # Look for the function being called
        # In Python: call(function, arguments)
        # The function can be: identifier, attribute, etc.

        for child in call_node.children:
            if child.type == "identifier":
                return self._get_source_text(child)
            elif child.type == "attribute":
                # For obj.method(), extract 'method'
                for attr_child in child.children:
                    if attr_child.type == "identifier" and attr_child != child.children[0]:
                        return self._get_source_text(attr_child)

        return None

    def _resolve_function_name(
        self, name: str, cpg: CodePropertyGraph, caller: CPGNode
    ) -> CPGNode | None:
        """Resolve a function name to a CPG node.

        Args:
            name: Function name
            cpg: Code property graph
            caller: Calling function node (for context)

        Returns:
            CPG node for the function, or None
        """
        # Priority 1: Exact name match in same class
        caller_parent = cpg.get_node(caller.parent_id) if caller.parent_id else None
        if caller_parent and caller_parent.type == NodeType.CLASS:
            # Look for sibling functions in same class
            for sibling_id in caller_parent.children_ids:
                sibling = cpg.get_node(sibling_id)
                if sibling and sibling.type == NodeType.FUNCTION and sibling.name == name:
                    return sibling

        # Priority 2: Exact name match anywhere in the file
        for node in cpg.nodes.values():
            if node.type == NodeType.FUNCTION and node.name == name:
                return node

        return None

    def _extract_identifiers_from_source(self, source_text: str) -> set[str]:
        """Extract identifier names from source code.

        Args:
            source_text: Source code string

        Returns:
            Set of identifier names
        """
        import re

        # Simple pattern: word characters that look like identifiers
        pattern = r"\b[a-zA-Z_][a-zA-Z0-9_]*\b"
        identifiers = re.findall(pattern, source_text)

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
            "self",  # Common but not a dependency target
        }

        return set(identifiers) - keywords

    def _resolve_identifier_to_node(
        self, identifier: str, cpg: CodePropertyGraph, context: CPGNode
    ) -> CPGNode | None:
        """Resolve an identifier to a CPG node (function or class).

        Args:
            identifier: Identifier name
            cpg: Code property graph
            context: Context node (for scoping)

        Returns:
            CPG node, or None
        """
        # Look for functions or classes with this name
        for node in cpg.nodes.values():
            if node.type in [NodeType.FUNCTION, NodeType.CLASS] and node.name == identifier:
                return node

        return None
