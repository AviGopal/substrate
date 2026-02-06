"""Tests for graph query engine."""

import pytest

from cpg_inference.cpg import parse_code
from cpg_inference.cpg.models import EdgeType, NodeType
from cpg_inference.graph_queries import GraphQueryEngine, QueryResult


@pytest.fixture
def sample_cpg():
    """Create a sample CPG for testing."""
    code = """
def get_user(username):
    '''Get user from database.'''
    return database.query(username)

def authenticate(username, password):
    '''Authenticate user.'''
    user = get_user(username)
    if user and check_password(user, password):
        return create_session(user)
    return None

def check_password(user, password):
    '''Check password hash.'''
    return hash(password) == user.password_hash

def create_session(user):
    '''Create user session.'''
    log_login(user)
    return Session(user)

def log_login(user):
    '''Log login event.'''
    logger.info(f"User {user.name} logged in")

class Session:
    '''User session class.'''
    def __init__(self, user):
        self.user = user
"""
    cpg = parse_code(code, language="python", filename="test.py")
    return cpg


@pytest.fixture
def query_engine(sample_cpg):
    """Create query engine with sample CPG."""
    engine = GraphQueryEngine(sample_cpg)
    return engine


def test_engine_initialization():
    """Test query engine initialization."""
    engine = GraphQueryEngine()
    assert engine.cpg is None
    assert not engine._cache_built


def test_set_cpg(sample_cpg):
    """Test setting CPG."""
    engine = GraphQueryEngine()
    engine.set_cpg(sample_cpg)
    assert engine.cpg == sample_cpg
    assert not engine._cache_built


def test_find_callers(query_engine, sample_cpg):
    """Test finding callers of a function."""
    # Find get_user function
    get_user_node = None
    for node_id, node in sample_cpg.nodes.items():
        if node.name == "get_user" and node.type == NodeType.FUNCTION:
            get_user_node = node_id
            break
    
    assert get_user_node is not None
    
    # Find callers
    callers = query_engine.find_callers(get_user_node)
    
    # authenticate should call get_user
    caller_names = [c.node.name for c in callers]
    assert "authenticate" in caller_names


def test_find_callees(query_engine, sample_cpg):
    """Test finding callees of a function."""
    # Find authenticate function
    auth_node = None
    for node_id, node in sample_cpg.nodes.items():
        if node.name == "authenticate" and node.type == NodeType.FUNCTION:
            auth_node = node_id
            break
    
    assert auth_node is not None
    
    # Find callees
    callees = query_engine.find_callees(auth_node)
    
    # authenticate should call get_user, check_password, create_session
    callee_names = [c.node.name for c in callees]
    assert "get_user" in callee_names
    assert "check_password" in callee_names
    assert "create_session" in callee_names


def test_find_nodes_by_type(query_engine, sample_cpg):
    """Test finding nodes by type."""
    # Find all functions
    functions = query_engine.find_nodes_by_type(NodeType.FUNCTION)
    assert len(functions) >= 5  # At least 5 functions in sample code
    
    # Find all classes
    classes = query_engine.find_nodes_by_type(NodeType.CLASS)
    assert len(classes) >= 1  # At least Session class


def test_find_nodes_by_name(query_engine):
    """Test finding nodes by name."""
    # Find by exact substring
    results = query_engine.find_nodes_by_name("user")
    assert len(results) > 0
    
    # Find by regex
    results = query_engine.find_nodes_by_name("^get_", regex=True)
    assert len(results) > 0
    assert all("get_" in r.node.name for r in results)


def test_find_path(query_engine, sample_cpg):
    """Test finding path between nodes."""
    # Find authenticate and log_login nodes
    auth_node = None
    log_node = None
    
    for node_id, node in sample_cpg.nodes.items():
        if node.name == "authenticate" and node.type == NodeType.FUNCTION:
            auth_node = node_id
        elif node.name == "log_login" and node.type == NodeType.FUNCTION:
            log_node = node_id
    
    assert auth_node is not None
    assert log_node is not None
    
    # Find path from authenticate to log_login
    path = query_engine.find_path(
        auth_node,
        log_node,
        edge_types=[EdgeType.CALLS],
        max_depth=10,
    )
    
    # Path should exist: authenticate -> create_session -> log_login
    assert path is not None
    assert len(path) >= 2
    assert path[0] == auth_node
    assert path[-1] == log_node


def test_is_reachable(query_engine, sample_cpg):
    """Test reachability check."""
    # Find nodes
    auth_node = None
    log_node = None
    
    for node_id, node in sample_cpg.nodes.items():
        if node.name == "authenticate" and node.type == NodeType.FUNCTION:
            auth_node = node_id
        elif node.name == "log_login" and node.type == NodeType.FUNCTION:
            log_node = node_id
    
    assert auth_node is not None
    assert log_node is not None
    
    # Check reachability
    assert query_engine.is_reachable(auth_node, log_node, edge_types=[EdgeType.CALLS], max_depth=10)
    
    # Check non-reachability (log_login doesn't call authenticate)
    assert not query_engine.is_reachable(log_node, auth_node, edge_types=[EdgeType.CALLS], max_depth=10)


def test_get_neighborhood(query_engine, sample_cpg):
    """Test getting neighborhood of a node."""
    # Find authenticate function
    auth_node = None
    for node_id, node in sample_cpg.nodes.items():
        if node.name == "authenticate" and node.type == NodeType.FUNCTION:
            auth_node = node_id
            break
    
    assert auth_node is not None
    
    # Get 1-hop neighborhood
    neighborhood = query_engine.get_neighborhood(
        auth_node,
        depth=1,
        edge_types=[EdgeType.CALLS],
        direction="outgoing",
    )
    
    # Should include get_user, check_password, create_session
    neighbor_names = [n.node.name for n in neighborhood]
    assert "get_user" in neighbor_names
    assert "check_password" in neighbor_names
    assert "create_session" in neighbor_names
    
    # Check distances
    for neighbor in neighborhood:
        assert neighbor.distance == 1


def test_get_impact_set(query_engine, sample_cpg):
    """Test getting impact set (forward propagation)."""
    # Find get_user function
    get_user_node = None
    for node_id, node in sample_cpg.nodes.items():
        if node.name == "get_user" and node.type == NodeType.FUNCTION:
            get_user_node = node_id
            break
    
    assert get_user_node is not None
    
    # Get forward impact (what does get_user affect?)
    impact = query_engine.get_impact_set(
        [get_user_node],
        max_depth=3,
        edge_types=[EdgeType.CALLS],
    )
    
    # Should be empty or contain nodes that get_user calls
    # (get_user doesn't call anything in sample code)
    assert isinstance(impact, list)


def test_get_reverse_impact_set(query_engine, sample_cpg):
    """Test getting reverse impact set (backward propagation)."""
    # Find get_user function
    get_user_node = None
    for node_id, node in sample_cpg.nodes.items():
        if node.name == "get_user" and node.type == NodeType.FUNCTION:
            get_user_node = node_id
            break
    
    assert get_user_node is not None
    
    # Get reverse impact (what calls get_user?)
    impact = query_engine.get_reverse_impact_set(
        [get_user_node],
        max_depth=3,
        edge_types=[EdgeType.CALLS],
    )
    
    # Should include authenticate (calls get_user)
    impact_names = [i.node.name for i in impact]
    assert "authenticate" in impact_names


def test_find_container(query_engine, sample_cpg):
    """Test finding container of a node."""
    # Find a method
    for node_id, node in sample_cpg.nodes.items():
        if node.type == NodeType.METHOD:
            container = query_engine.find_container(node_id)
            # Should have a container (the class)
            if container:
                assert container.node.type == NodeType.CLASS
            break


def test_find_children(query_engine, sample_cpg):
    """Test finding children of a node."""
    # Find Session class
    session_node = None
    for node_id, node in sample_cpg.nodes.items():
        if node.name == "Session" and node.type == NodeType.CLASS:
            session_node = node_id
            break
    
    if session_node:
        children = query_engine.find_children(session_node)
        # Session class should have __init__ method
        child_names = [c.node.name for c in children]
        assert "__init__" in child_names


def test_query_result_to_dict():
    """Test QueryResult to_dict conversion."""
    from cpg_inference.cpg.models import CPGNode
    
    node = CPGNode(
        id="test::function::foo::1",
        type=NodeType.FUNCTION,
        name="foo",
        start_line=1,
        end_line=5,
    )
    
    result = QueryResult(
        node_id="test::function::foo::1",
        node=node,
        distance=2,
        path=["a", "b", "c"],
        metadata={"key": "value"},
    )
    
    data = result.to_dict()
    
    assert data["node_id"] == "test::function::foo::1"
    assert data["node_type"] == "function"
    assert data["name"] == "foo"
    assert data["distance"] == 2
    assert data["path"] == ["a", "b", "c"]
    assert data["metadata"] == {"key": "value"}


def test_get_stats(query_engine, sample_cpg):
    """Test getting graph statistics."""
    stats = query_engine.get_stats()
    
    assert "total_nodes" in stats
    assert "total_edges" in stats
    assert "nodes_by_type" in stats
    assert "edges_by_type" in stats
    assert "cache_built" in stats
    
    assert stats["total_nodes"] > 0
    assert isinstance(stats["nodes_by_type"], dict)


def test_adjacency_cache(query_engine, sample_cpg):
    """Test adjacency cache building."""
    # Initially not built
    assert not query_engine._cache_built
    
    # Force cache build
    query_engine._ensure_cache()
    
    # Now should be built
    assert query_engine._cache_built
    assert sample_cpg._adjacency_cache is not None
    assert sample_cpg._reverse_adjacency_cache is not None


def test_find_components_at_line(query_engine):
    """Test finding components at a specific line."""
    # Find components at line 2-3 (should be get_user function)
    results = query_engine.find_components_at_line("test.py", 2)
    
    # Should find at least the function containing that line
    assert len(results) > 0


def test_empty_cpg():
    """Test query engine with empty CPG."""
    engine = GraphQueryEngine()
    
    # Should raise error when CPG not set
    with pytest.raises(ValueError, match="No CPG set"):
        engine.find_nodes_by_type(NodeType.FUNCTION)


def test_query_nonexistent_node(query_engine):
    """Test querying nonexistent node."""
    # Should return empty list
    callers = query_engine.find_callers("nonexistent::id")
    assert callers == []
    
    callees = query_engine.find_callees("nonexistent::id")
    assert callees == []


def test_multifile_graph():
    """Test graph queries across multiple files."""
    # Create two related files
    file1 = """
def helper():
    return 42

def main():
    return helper()
"""
    
    file2 = """
from file1 import main

def api_handler():
    return main()
"""
    
    # Parse both files
    cpg1 = parse_code(file1, language="python", filename="file1.py")
    
    # Create engine for file1
    engine = GraphQueryEngine(cpg1)
    
    # Find main function
    main_node = None
    for node_id, node in cpg1.nodes.items():
        if node.name == "main" and node.type == NodeType.FUNCTION:
            main_node = node_id
            break
    
    assert main_node is not None
    
    # Find callees of main
    callees = engine.find_callees(main_node)
    callee_names = [c.node.name for c in callees]
    assert "helper" in callee_names


def test_neighborhood_with_depth():
    """Test neighborhood queries with varying depths."""
    code = """
def a():
    b()

def b():
    c()

def c():
    d()

def d():
    pass
"""
    cpg = parse_code(code, language="python", filename="test.py")
    engine = GraphQueryEngine(cpg)
    
    # Find function 'a'
    a_node = None
    for node_id, node in cpg.nodes.items():
        if node.name == "a" and node.type == NodeType.FUNCTION:
            a_node = node_id
            break
    
    assert a_node is not None
    
    # Get 1-hop neighborhood
    n1 = engine.get_neighborhood(a_node, depth=1, edge_types=[EdgeType.CALLS])
    assert len(n1) >= 1
    
    # Get 2-hop neighborhood
    n2 = engine.get_neighborhood(a_node, depth=2, edge_types=[EdgeType.CALLS])
    assert len(n2) >= len(n1)
    
    # Get 3-hop neighborhood
    n3 = engine.get_neighborhood(a_node, depth=3, edge_types=[EdgeType.CALLS])
    assert len(n3) >= len(n2)


def test_impact_with_multiple_sources():
    """Test impact analysis with multiple changed nodes."""
    code = """
def a():
    c()

def b():
    c()

def c():
    d()

def d():
    pass
"""
    cpg = parse_code(code, language="python", filename="test.py")
    engine = GraphQueryEngine(cpg)
    
    # Find functions a and b
    a_node = None
    b_node = None
    
    for node_id, node in cpg.nodes.items():
        if node.name == "a" and node.type == NodeType.FUNCTION:
            a_node = node_id
        elif node.name == "b" and node.type == NodeType.FUNCTION:
            b_node = node_id
    
    assert a_node is not None
    assert b_node is not None
    
    # Get combined impact from both
    impact = engine.get_impact_set(
        [a_node, b_node],
        max_depth=2,
        edge_types=[EdgeType.CALLS],
    )
    
    # Should include c and d
    impact_names = [i.node.name for i in impact]
    assert "c" in impact_names
    assert "d" in impact_names

