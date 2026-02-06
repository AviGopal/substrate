"""Language-specific mappings from tree-sitter node types to CPG node types."""

from cpg_inference.cpg.models import NodeType

# Python tree-sitter node type → CPG node type mappings
PYTHON_NODE_MAPPINGS: dict[str, NodeType] = {
    "module": NodeType.FILE,
    "class_definition": NodeType.CLASS,
    "function_definition": NodeType.FUNCTION,
    "decorated_definition": NodeType.FUNCTION,  # Decorated functions/classes
    "lambda": NodeType.FUNCTION,
    # Statements
    "expression_statement": NodeType.STATEMENT,
    "return_statement": NodeType.STATEMENT,
    "if_statement": NodeType.STATEMENT,
    "while_statement": NodeType.STATEMENT,
    "for_statement": NodeType.STATEMENT,
    "with_statement": NodeType.STATEMENT,
    "try_statement": NodeType.STATEMENT,
    "assert_statement": NodeType.STATEMENT,
    "raise_statement": NodeType.STATEMENT,
    "pass_statement": NodeType.STATEMENT,
    "break_statement": NodeType.STATEMENT,
    "continue_statement": NodeType.STATEMENT,
    "import_statement": NodeType.STATEMENT,
    "import_from_statement": NodeType.STATEMENT,
    "assignment": NodeType.STATEMENT,
    "augmented_assignment": NodeType.STATEMENT,
    "yield_statement": NodeType.STATEMENT,
    "global_statement": NodeType.STATEMENT,
    "nonlocal_statement": NodeType.STATEMENT,
    "delete_statement": NodeType.STATEMENT,
    "match_statement": NodeType.STATEMENT,
    # Expressions
    "call": NodeType.EXPRESSION,
    "binary_operator": NodeType.EXPRESSION,
    "comparison_operator": NodeType.EXPRESSION,
    "unary_operator": NodeType.EXPRESSION,
    "boolean_operator": NodeType.EXPRESSION,
    "conditional_expression": NodeType.EXPRESSION,
    "subscript": NodeType.EXPRESSION,
    "attribute": NodeType.EXPRESSION,
    "await": NodeType.EXPRESSION,
    "yield": NodeType.EXPRESSION,
    "list_comprehension": NodeType.EXPRESSION,
    "dictionary_comprehension": NodeType.EXPRESSION,
    "set_comprehension": NodeType.EXPRESSION,
    "generator_expression": NodeType.EXPRESSION,
    "parenthesized_expression": NodeType.EXPRESSION,
    "tuple": NodeType.EXPRESSION,
    "list": NodeType.EXPRESSION,
    "set": NodeType.EXPRESSION,
    "dictionary": NodeType.EXPRESSION,
}

# Node types that should create CPG nodes (vs just being AST details)
# This controls granularity - start with coarser granularity for performance
PYTHON_INCLUDE_NODE_TYPES = {
    "module",
    "class_definition",
    "function_definition",
    "decorated_definition",
    "lambda",
    # Control flow statements
    "if_statement",
    "while_statement",
    "for_statement",
    "with_statement",
    "try_statement",
    "return_statement",
    "match_statement",
    # Data flow - assignments and operators
    "assignment",
    "augmented_assignment",
    "binary_operator",
    "comparison_operator",
    "boolean_operator",
    "unary_operator",
    # Member access for dependency tracking
    "subscript",
    "attribute",
    "call",
}

# Java tree-sitter node type → CPG node type mappings
JAVA_NODE_MAPPINGS: dict[str, NodeType] = {
    "program": NodeType.FILE,
    "class_declaration": NodeType.CLASS,
    "interface_declaration": NodeType.CLASS,
    "enum_declaration": NodeType.CLASS,
    "annotation_type_declaration": NodeType.CLASS,
    "method_declaration": NodeType.FUNCTION,
    "constructor_declaration": NodeType.FUNCTION,
    "lambda_expression": NodeType.FUNCTION,
    # Statements
    "expression_statement": NodeType.STATEMENT,
    "return_statement": NodeType.STATEMENT,
    "if_statement": NodeType.STATEMENT,
    "while_statement": NodeType.STATEMENT,
    "for_statement": NodeType.STATEMENT,
    "enhanced_for_statement": NodeType.STATEMENT,
    "do_statement": NodeType.STATEMENT,
    "try_statement": NodeType.STATEMENT,
    "try_with_resources_statement": NodeType.STATEMENT,
    "catch_clause": NodeType.STATEMENT,
    "finally_clause": NodeType.STATEMENT,
    "throw_statement": NodeType.STATEMENT,
    "assert_statement": NodeType.STATEMENT,
    "break_statement": NodeType.STATEMENT,
    "continue_statement": NodeType.STATEMENT,
    "synchronized_statement": NodeType.STATEMENT,
    "switch_expression": NodeType.STATEMENT,
    "switch_block": NodeType.STATEMENT,
    "switch_rule": NodeType.STATEMENT,
    "local_variable_declaration": NodeType.STATEMENT,
    "field_declaration": NodeType.STATEMENT,
    # Expressions
    "method_invocation": NodeType.EXPRESSION,
    "object_creation_expression": NodeType.EXPRESSION,
    "binary_expression": NodeType.EXPRESSION,
    "assignment_expression": NodeType.EXPRESSION,
    "unary_expression": NodeType.EXPRESSION,
    "update_expression": NodeType.EXPRESSION,
    "ternary_expression": NodeType.EXPRESSION,
    "instanceof_expression": NodeType.EXPRESSION,
    "cast_expression": NodeType.EXPRESSION,
    "array_creation_expression": NodeType.EXPRESSION,
    "array_access": NodeType.EXPRESSION,
    "array_initializer": NodeType.EXPRESSION,
    "field_access": NodeType.EXPRESSION,
    "method_reference": NodeType.EXPRESSION,
    "parenthesized_expression": NodeType.EXPRESSION,
    "this": NodeType.EXPRESSION,
    "super": NodeType.EXPRESSION,
}

JAVA_INCLUDE_NODE_TYPES = {
    "program",
    "class_declaration",
    "interface_declaration",
    "enum_declaration",
    "method_declaration",
    "constructor_declaration",
    "lambda_expression",
    # Control flow statements
    "if_statement",
    "while_statement",
    "for_statement",
    "enhanced_for_statement",
    "do_statement",
    "try_statement",
    "return_statement",
    "throw_statement",
    "synchronized_statement",
    "switch_expression",
    "switch_block",
    # Data flow - assignments and operators
    "assignment_expression",
    "binary_expression",
    "unary_expression",
    "update_expression",
    # Member access for dependency tracking
    "array_access",
    "field_access",
    "method_invocation",
}

# JavaScript tree-sitter node type → CPG node type mappings
JAVASCRIPT_NODE_MAPPINGS: dict[str, NodeType] = {
    "program": NodeType.FILE,
    "class_declaration": NodeType.CLASS,
    "function_declaration": NodeType.FUNCTION,
    "function": NodeType.FUNCTION,
    "arrow_function": NodeType.FUNCTION,
    "method_definition": NodeType.FUNCTION,
    "generator_function_declaration": NodeType.FUNCTION,
    "generator_function": NodeType.FUNCTION,
    # Statements
    "expression_statement": NodeType.STATEMENT,
    "return_statement": NodeType.STATEMENT,
    "if_statement": NodeType.STATEMENT,
    "while_statement": NodeType.STATEMENT,
    "for_statement": NodeType.STATEMENT,
    "for_in_statement": NodeType.STATEMENT,
    "for_of_statement": NodeType.STATEMENT,
    "do_statement": NodeType.STATEMENT,
    "try_statement": NodeType.STATEMENT,
    "catch_clause": NodeType.STATEMENT,
    "finally_clause": NodeType.STATEMENT,
    "throw_statement": NodeType.STATEMENT,
    "break_statement": NodeType.STATEMENT,
    "continue_statement": NodeType.STATEMENT,
    "switch_statement": NodeType.STATEMENT,
    "switch_case": NodeType.STATEMENT,
    "switch_default": NodeType.STATEMENT,
    "variable_declaration": NodeType.STATEMENT,
    "lexical_declaration": NodeType.STATEMENT,
    "labeled_statement": NodeType.STATEMENT,
    "debugger_statement": NodeType.STATEMENT,
    "with_statement": NodeType.STATEMENT,
    # Expressions
    "call_expression": NodeType.EXPRESSION,
    "new_expression": NodeType.EXPRESSION,
    "binary_expression": NodeType.EXPRESSION,
    "assignment_expression": NodeType.EXPRESSION,
    "unary_expression": NodeType.EXPRESSION,
    "update_expression": NodeType.EXPRESSION,
    "ternary_expression": NodeType.EXPRESSION,
    "await_expression": NodeType.EXPRESSION,
    "yield_expression": NodeType.EXPRESSION,
    "member_expression": NodeType.EXPRESSION,
    "subscript_expression": NodeType.EXPRESSION,
    "template_string": NodeType.EXPRESSION,
    "parenthesized_expression": NodeType.EXPRESSION,
    "array": NodeType.EXPRESSION,
    "object": NodeType.EXPRESSION,
    "spread_element": NodeType.EXPRESSION,
    "this": NodeType.EXPRESSION,
    "super": NodeType.EXPRESSION,
    "class": NodeType.EXPRESSION,
    "function_expression": NodeType.EXPRESSION,
}

JAVASCRIPT_INCLUDE_NODE_TYPES = {
    "program",
    "class_declaration",
    "function_declaration",
    "function",
    "arrow_function",
    "method_definition",
    "generator_function_declaration",
    "generator_function",
    # Control flow statements
    "if_statement",
    "while_statement",
    "for_statement",
    "for_in_statement",
    "for_of_statement",
    "do_statement",
    "try_statement",
    "return_statement",
    "throw_statement",
    "switch_statement",
    "switch_case",
    # Data flow - assignments and operators
    "assignment_expression",
    "binary_expression",
    "unary_expression",
    "update_expression",
    "variable_declaration",
    "lexical_declaration",
    # Member access for dependency tracking
    "member_expression",
    "subscript_expression",
    "call_expression",
    "await_expression",
    "yield_expression",
}

# TypeScript uses same mappings as JavaScript plus type-specific nodes
TYPESCRIPT_NODE_MAPPINGS: dict[str, NodeType] = {
    **JAVASCRIPT_NODE_MAPPINGS,
    "interface_declaration": NodeType.CLASS,
    "type_alias_declaration": NodeType.CLASS,
    "enum_declaration": NodeType.CLASS,
}

TYPESCRIPT_INCLUDE_NODE_TYPES = JAVASCRIPT_INCLUDE_NODE_TYPES | {
    "interface_declaration",
    "type_alias_declaration",
    "enum_declaration",
}

# C tree-sitter node type → CPG node type mappings
C_NODE_MAPPINGS: dict[str, NodeType] = {
    "translation_unit": NodeType.FILE,
    "struct_specifier": NodeType.CLASS,
    "union_specifier": NodeType.CLASS,
    "enum_specifier": NodeType.CLASS,
    "function_definition": NodeType.FUNCTION,
    # Statements
    "expression_statement": NodeType.STATEMENT,
    "return_statement": NodeType.STATEMENT,
    "if_statement": NodeType.STATEMENT,
    "while_statement": NodeType.STATEMENT,
    "for_statement": NodeType.STATEMENT,
    "do_statement": NodeType.STATEMENT,
    "switch_statement": NodeType.STATEMENT,
    "case_statement": NodeType.STATEMENT,
    "default_statement": NodeType.STATEMENT,
    "break_statement": NodeType.STATEMENT,
    "continue_statement": NodeType.STATEMENT,
    "goto_statement": NodeType.STATEMENT,
    "labeled_statement": NodeType.STATEMENT,
    "declaration": NodeType.STATEMENT,
    "compound_statement": NodeType.STATEMENT,
    # Expressions
    "call_expression": NodeType.EXPRESSION,
    "binary_expression": NodeType.EXPRESSION,
    "assignment_expression": NodeType.EXPRESSION,
    "unary_expression": NodeType.EXPRESSION,
    "update_expression": NodeType.EXPRESSION,
    "conditional_expression": NodeType.EXPRESSION,
    "cast_expression": NodeType.EXPRESSION,
    "sizeof_expression": NodeType.EXPRESSION,
    "pointer_expression": NodeType.EXPRESSION,
    "field_expression": NodeType.EXPRESSION,
    "subscript_expression": NodeType.EXPRESSION,
    "comma_expression": NodeType.EXPRESSION,
    "parenthesized_expression": NodeType.EXPRESSION,
    "compound_literal_expression": NodeType.EXPRESSION,
    "initializer_list": NodeType.EXPRESSION,
}

C_INCLUDE_NODE_TYPES = {
    "translation_unit",
    "struct_specifier",
    "union_specifier",
    "enum_specifier",
    "function_definition",
    # Control flow statements
    "if_statement",
    "while_statement",
    "for_statement",
    "do_statement",
    "switch_statement",
    "case_statement",
    "return_statement",
    "goto_statement",
    # Data flow - assignments and operators
    "assignment_expression",
    "binary_expression",
    "unary_expression",
    "update_expression",
    # Member access for dependency tracking
    "field_expression",
    "subscript_expression",
    "pointer_expression",
    "call_expression",
}

# C++ uses same base as C plus C++-specific nodes
CPP_NODE_MAPPINGS: dict[str, NodeType] = {
    **C_NODE_MAPPINGS,
    "class_specifier": NodeType.CLASS,
    "namespace_definition": NodeType.CLASS,
    "template_declaration": NodeType.FUNCTION,
    "lambda_expression": NodeType.FUNCTION,
    # C++-specific statements
    "try_statement": NodeType.STATEMENT,
    "catch_clause": NodeType.STATEMENT,
    "throw_statement": NodeType.STATEMENT,
    "using_declaration": NodeType.STATEMENT,
    "namespace_alias_definition": NodeType.STATEMENT,
    # C++-specific expressions
    "new_expression": NodeType.EXPRESSION,
    "delete_expression": NodeType.EXPRESSION,
    "this": NodeType.EXPRESSION,
    "nullptr": NodeType.EXPRESSION,
    "co_await_expression": NodeType.EXPRESSION,
    "co_yield_expression": NodeType.EXPRESSION,
    "co_return_statement": NodeType.STATEMENT,
    "requires_expression": NodeType.EXPRESSION,
    "fold_expression": NodeType.EXPRESSION,
}

CPP_INCLUDE_NODE_TYPES = C_INCLUDE_NODE_TYPES | {
    "class_specifier",
    "namespace_definition",
    "template_declaration",
    "lambda_expression",
    "try_statement",
    "throw_statement",
    "new_expression",
    "delete_expression",
}

# PHP tree-sitter node type → CPG node type mappings
PHP_NODE_MAPPINGS: dict[str, NodeType] = {
    "program": NodeType.FILE,
    "class_declaration": NodeType.CLASS,
    "interface_declaration": NodeType.CLASS,
    "trait_declaration": NodeType.CLASS,
    "enum_declaration": NodeType.CLASS,
    "function_definition": NodeType.FUNCTION,
    "method_declaration": NodeType.FUNCTION,
    "anonymous_function_creation_expression": NodeType.FUNCTION,
    "arrow_function": NodeType.FUNCTION,
    # Statements
    "expression_statement": NodeType.STATEMENT,
    "return_statement": NodeType.STATEMENT,
    "if_statement": NodeType.STATEMENT,
    "while_statement": NodeType.STATEMENT,
    "for_statement": NodeType.STATEMENT,
    "foreach_statement": NodeType.STATEMENT,
    "do_statement": NodeType.STATEMENT,
    "try_statement": NodeType.STATEMENT,
    "catch_clause": NodeType.STATEMENT,
    "finally_clause": NodeType.STATEMENT,
    "throw_statement": NodeType.STATEMENT,
    "break_statement": NodeType.STATEMENT,
    "continue_statement": NodeType.STATEMENT,
    "switch_statement": NodeType.STATEMENT,
    "case_statement": NodeType.STATEMENT,
    "default_statement": NodeType.STATEMENT,
    "echo_statement": NodeType.STATEMENT,
    "print_statement": NodeType.STATEMENT,
    "include_statement": NodeType.STATEMENT,
    "include_once_statement": NodeType.STATEMENT,
    "require_statement": NodeType.STATEMENT,
    "require_once_statement": NodeType.STATEMENT,
    "global_declaration": NodeType.STATEMENT,
    "static_variable_declaration": NodeType.STATEMENT,
    "declare_statement": NodeType.STATEMENT,
    "goto_statement": NodeType.STATEMENT,
    "labeled_statement": NodeType.STATEMENT,
    # Expressions
    "function_call_expression": NodeType.EXPRESSION,
    "member_call_expression": NodeType.EXPRESSION,
    "binary_expression": NodeType.EXPRESSION,
    "assignment_expression": NodeType.EXPRESSION,
    "unary_op_expression": NodeType.EXPRESSION,
    "update_expression": NodeType.EXPRESSION,
    "conditional_expression": NodeType.EXPRESSION,
    "member_access_expression": NodeType.EXPRESSION,
    "subscript_expression": NodeType.EXPRESSION,
    "scoped_call_expression": NodeType.EXPRESSION,
    "object_creation_expression": NodeType.EXPRESSION,
    "array_creation_expression": NodeType.EXPRESSION,
    "parenthesized_expression": NodeType.EXPRESSION,
    "cast_expression": NodeType.EXPRESSION,
    "clone_expression": NodeType.EXPRESSION,
    "yield_expression": NodeType.EXPRESSION,
}

PHP_INCLUDE_NODE_TYPES = {
    "program",
    "class_declaration",
    "interface_declaration",
    "trait_declaration",
    "function_definition",
    "method_declaration",
    "anonymous_function_creation_expression",
    "arrow_function",
    # Control flow statements
    "if_statement",
    "while_statement",
    "for_statement",
    "foreach_statement",
    "do_statement",
    "try_statement",
    "return_statement",
    "throw_statement",
    "switch_statement",
    "case_statement",
    # PHP-specific includes
    "include_statement",
    "include_once_statement",
    "require_statement",
    "require_once_statement",
    # Data flow - assignments and operators
    "assignment_expression",
    "binary_expression",
    "unary_op_expression",
    "update_expression",
    # Member access for dependency tracking
    "member_access_expression",
    "subscript_expression",
    "function_call_expression",
    "member_call_expression",
}

# Ruby tree-sitter node type → CPG node type mappings
RUBY_NODE_MAPPINGS: dict[str, NodeType] = {
    "program": NodeType.FILE,
    "class": NodeType.CLASS,
    "module": NodeType.CLASS,
    "singleton_class": NodeType.CLASS,
    "method": NodeType.FUNCTION,
    "singleton_method": NodeType.FUNCTION,
    "lambda": NodeType.FUNCTION,
    "block": NodeType.FUNCTION,
    "do_block": NodeType.FUNCTION,
    # Statements
    "return": NodeType.STATEMENT,
    "if": NodeType.STATEMENT,
    "unless": NodeType.STATEMENT,
    "if_modifier": NodeType.STATEMENT,
    "unless_modifier": NodeType.STATEMENT,
    "while": NodeType.STATEMENT,
    "until": NodeType.STATEMENT,
    "while_modifier": NodeType.STATEMENT,
    "until_modifier": NodeType.STATEMENT,
    "for": NodeType.STATEMENT,
    "case": NodeType.STATEMENT,
    "case_match": NodeType.STATEMENT,
    "when": NodeType.STATEMENT,
    "in_clause": NodeType.STATEMENT,
    "begin": NodeType.STATEMENT,
    "rescue": NodeType.STATEMENT,
    "rescue_modifier": NodeType.STATEMENT,
    "ensure": NodeType.STATEMENT,
    "else": NodeType.STATEMENT,
    "elsif": NodeType.STATEMENT,
    "break": NodeType.STATEMENT,
    "next": NodeType.STATEMENT,
    "redo": NodeType.STATEMENT,
    "retry": NodeType.STATEMENT,
    "raise": NodeType.STATEMENT,
    "yield": NodeType.STATEMENT,
    "assignment": NodeType.STATEMENT,
    "operator_assignment": NodeType.STATEMENT,
    # Expressions
    "call": NodeType.EXPRESSION,
    "binary": NodeType.EXPRESSION,
    "unary": NodeType.EXPRESSION,
    "conditional": NodeType.EXPRESSION,
    "element_reference": NodeType.EXPRESSION,
    "scope_resolution": NodeType.EXPRESSION,
    "string_interpolation": NodeType.EXPRESSION,
    "symbol": NodeType.EXPRESSION,
    "hash": NodeType.EXPRESSION,
    "array": NodeType.EXPRESSION,
    "range": NodeType.EXPRESSION,
    "regex": NodeType.EXPRESSION,
    "parenthesized_statements": NodeType.EXPRESSION,
    "method_call": NodeType.EXPRESSION,
    "chained_command_call": NodeType.EXPRESSION,
}

RUBY_INCLUDE_NODE_TYPES = {
    "program",
    "class",
    "module",
    "singleton_class",
    "method",
    "singleton_method",
    "lambda",
    "block",
    # Control flow statements
    "if",
    "unless",
    "if_modifier",
    "unless_modifier",
    "while",
    "until",
    "for",
    "case",
    "case_match",
    "when",
    "begin",
    "return",
    "raise",
    "yield",
    # Data flow - assignments and operators
    "assignment",
    "operator_assignment",
    "binary",
    "unary",
    # Member access for dependency tracking
    "element_reference",
    "scope_resolution",
    "call",
    "method_call",
}

# Mapping from language name to node type mappings
LANGUAGE_MAPPINGS: dict[str, dict[str, NodeType]] = {
    "python": PYTHON_NODE_MAPPINGS,
    "java": JAVA_NODE_MAPPINGS,
    "javascript": JAVASCRIPT_NODE_MAPPINGS,
    "typescript": TYPESCRIPT_NODE_MAPPINGS,
    "c": C_NODE_MAPPINGS,
    "cpp": CPP_NODE_MAPPINGS,
    "php": PHP_NODE_MAPPINGS,
    "ruby": RUBY_NODE_MAPPINGS,
}

# Mapping from language name to included node types
LANGUAGE_INCLUDE_TYPES: dict[str, set[str]] = {
    "python": PYTHON_INCLUDE_NODE_TYPES,
    "java": JAVA_INCLUDE_NODE_TYPES,
    "javascript": JAVASCRIPT_INCLUDE_NODE_TYPES,
    "typescript": TYPESCRIPT_INCLUDE_NODE_TYPES,
    "c": C_INCLUDE_NODE_TYPES,
    "cpp": CPP_INCLUDE_NODE_TYPES,
    "php": PHP_INCLUDE_NODE_TYPES,
    "ruby": RUBY_INCLUDE_NODE_TYPES,
}


def get_cpg_node_type(ts_node_type: str, language: str = "python") -> NodeType | None:
    """Map tree-sitter node type to CPG node type.

    Args:
        ts_node_type: Tree-sitter node type string
        language: Source language

    Returns:
        CPG NodeType if mapped, None if not a CPG node
    """
    mappings = LANGUAGE_MAPPINGS.get(language.lower(), {})
    return mappings.get(ts_node_type)


def should_include_node(ts_node_type: str, language: str = "python") -> bool:
    """Check if a tree-sitter node should be included in CPG.

    Args:
        ts_node_type: Tree-sitter node type string
        language: Source language

    Returns:
        True if node should be included in CPG
    """
    include_types = LANGUAGE_INCLUDE_TYPES.get(language.lower(), set())
    return ts_node_type in include_types
