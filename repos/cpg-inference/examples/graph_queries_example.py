"""Example demonstrating graph query capabilities for impact analysis.

This example shows how to use the graph query engine to:
1. Query structural dependencies (calls, data dependencies)
2. Perform impact analysis (what breaks if X changes?)
3. Combine graph structure with embedding similarity
4. Real-time monitoring use cases
"""

from cpg_inference import CoChangePredictor, InferenceConfig, get_model_path


def main():
    """Run graph queries example."""
    
    # ==================== Setup ====================
    
    print("=" * 70)
    print("Graph Queries Example - Impact Analysis")
    print("=" * 70)
    
    # Initialize predictor with bundled model
    config = InferenceConfig(
        model_path=get_model_path("default"),
        simhash_bits=128,
        neighborhood_depth=1,
        edge_filter_mode="all",
        embedding_dim=32,
        top_k=10,
    )
    
    predictor = CoChangePredictor(config)
    
    # ==================== Sample Code ====================
    
    # Create sample Python code for analysis
    files = {
        "auth.py": """
def authenticate(username, password):
    '''Authenticate user with credentials.'''
    user = get_user(username)
    if user and check_password(user, password):
        return create_session(user)
    return None

def get_user(username):
    '''Retrieve user from database.'''
    return database.query(username)

def check_password(user, password):
    '''Verify password hash.'''
    return hash(password) == user.password_hash

def create_session(user):
    '''Create user session.'''
    session = Session(user)
    log_login(user)
    return session

def log_login(user):
    '''Log user login event.'''
    logger.info(f"User {user.name} logged in")
""",
        
        "api.py": """
from auth import authenticate

def login_handler(request):
    '''Handle login API request.'''
    username = request.get('username')
    password = request.get('password')
    
    session = authenticate(username, password)
    
    if session:
        return success_response(session)
    return error_response("Authentication failed")

def success_response(data):
    '''Format success response.'''
    return {"status": "ok", "data": data}

def error_response(message):
    '''Format error response.'''
    return {"status": "error", "message": message}
""",
        
        "database.py": """
class Database:
    '''Simple database interface.'''
    
    def query(self, username):
        '''Query user by username.'''
        return self._execute_query(f"SELECT * FROM users WHERE username='{username}'")
    
    def _execute_query(self, sql):
        '''Execute raw SQL query.'''
        # Database logic here
        pass

database = Database()
""",
    }
    
    # Index the files
    print("\n" + "=" * 70)
    print("Indexing Files")
    print("=" * 70)
    
    stats = predictor.update_index(files)
    print(f"Files processed: {stats['files_processed']}")
    print(f"Components added: {stats['components_added']}")
    
    # ==================== Example 1: Find Callers ====================
    
    print("\n" + "=" * 70)
    print("Example 1: Find What Calls authenticate()")
    print("=" * 70)
    
    # Get graph query engine for auth.py
    query = predictor.query_graph("auth.py")
    
    # Find the authenticate component
    auth_components = query.find_nodes_by_name("authenticate")
    if auth_components:
        auth_id = auth_components[0].node_id
        print(f"Found component: {auth_id}")
        
        # Find callers
        callers = query.find_callers(auth_id)
        print(f"\nFunctions that call authenticate(): {len(callers)}")
        for caller in callers:
            print(f"  - {caller.node.name} (line {caller.node.start_line})")
    
    # ==================== Example 2: Find Dependencies ====================
    
    print("\n" + "=" * 70)
    print("Example 2: Find Dependencies of authenticate()")
    print("=" * 70)
    
    if auth_components:
        # What does authenticate depend on?
        deps = query.find_dependencies(auth_id)
        print(f"\nauthenticate() depends on: {len(deps)}")
        for dep in deps:
            print(f"  - {dep.node.name} (line {dep.node.start_line})")
        
        # What does authenticate call?
        callees = query.find_callees(auth_id)
        print(f"\nauthenticate() calls: {len(callees)}")
        for callee in callees:
            print(f"  - {callee.node.name} (line {callee.node.start_line})")
    
    # ==================== Example 3: Impact Analysis ====================
    
    print("\n" + "=" * 70)
    print("Example 3: Impact Analysis - What breaks if get_user() changes?")
    print("=" * 70)
    
    # Find get_user component
    get_user_components = query.find_nodes_by_name("get_user")
    if get_user_components:
        get_user_id = get_user_components[0].node_id
        print(f"Analyzing impact of changes to: {get_user_id}")
        
        # Use the new analyze_change_impact method
        impact = predictor.analyze_change_impact(
            component_ids=[get_user_id],
            max_depth=3,
            combine_with_embeddings=False,  # Graph only for this example
        )
        
        print(f"\nImpact Statistics:")
        print(f"  Forward impact (calls/depends): {impact['stats']['graph_forward_count']}")
        print(f"  Reverse impact (called by): {impact['stats']['graph_reverse_count']}")
        print(f"  Total unique impacts: {impact['stats']['total_impacted']}")
        
        print(f"\nTop 5 Impacted Components (by risk score):")
        for i, item in enumerate(impact['combined'][:5], 1):
            print(f"  {i}. {item['name']} (risk: {item['risk_score']:.2f}, sources: {item['sources']})")
    
    # ==================== Example 4: Neighborhood Analysis ====================
    
    print("\n" + "=" * 70)
    print("Example 4: Get 2-hop Neighborhood of authenticate()")
    print("=" * 70)
    
    if auth_components:
        from cpg_inference.cpg.models import EdgeType
        
        # Get 2-hop neighborhood following CALLS edges
        neighborhood = query.get_neighborhood(
            auth_id,
            depth=2,
            edge_types=[EdgeType.CALLS],
            direction="outgoing",
        )
        
        print(f"\nComponents within 2 hops: {len(neighborhood)}")
        
        # Group by distance
        by_distance = {}
        for node in neighborhood:
            dist = node.distance
            if dist not in by_distance:
                by_distance[dist] = []
            by_distance[dist].append(node)
        
        for dist in sorted(by_distance.keys()):
            print(f"\nDistance {dist}:")
            for node in by_distance[dist]:
                print(f"  - {node.node.name}")
    
    # ==================== Example 5: Call Graph Export ====================
    
    print("\n" + "=" * 70)
    print("Example 5: Export Call Graph for Visualization")
    print("=" * 70)
    
    call_graph = predictor.get_call_graph(["auth.py", "api.py"])
    
    print(f"\nCall Graph Statistics:")
    print(f"  Files: {call_graph['stats']['num_files']}")
    print(f"  Nodes: {call_graph['stats']['num_nodes']}")
    print(f"  Call Edges: {call_graph['stats']['num_edges']}")
    
    print(f"\nSample call edges:")
    for edge in call_graph['edges'][:5]:
        source_name = edge['source'].split('::')[2] if '::' in edge['source'] else edge['source']
        target_name = edge['target'].split('::')[2] if '::' in edge['target'] else edge['target']
        print(f"  {source_name} -> {target_name}")
    
    # ==================== Example 6: Find Components at Line ====================
    
    print("\n" + "=" * 70)
    print("Example 6: Find Component at Specific Line")
    print("=" * 70)
    
    # Find what component is at line 5 of auth.py
    components_at_line = query.find_components_at_line("auth.py", 5)
    
    if components_at_line:
        print(f"\nComponents containing line 5:")
        for comp in components_at_line:
            print(f"  - {comp.node.name} ({comp.node.type.value}, lines {comp.node.start_line}-{comp.node.end_line})")
    
    # ==================== Example 7: Path Finding ====================
    
    print("\n" + "=" * 70)
    print("Example 7: Find Execution Path")
    print("=" * 70)
    
    # Find path from login_handler to log_login
    api_query = predictor.query_graph("api.py")
    login_handler_nodes = api_query.find_nodes_by_name("login_handler")
    log_login_nodes = query.find_nodes_by_name("log_login")
    
    if login_handler_nodes and log_login_nodes:
        # Note: This would require cross-file path finding
        # For now, show intra-file paths
        print("\nFinding path within auth.py from authenticate to log_login:")
        
        path = query.find_path(
            auth_id,
            log_login_nodes[0].node_id,
            edge_types=[EdgeType.CALLS],
            max_depth=5,
        )
        
        if path:
            print(f"Path found ({len(path)} steps):")
            for i, node_id in enumerate(path):
                node = query.cpg.nodes.get(node_id)
                if node:
                    print(f"  {i}. {node.name}")
        else:
            print("No path found")
    
    # ==================== Real-Time Monitoring Use Case ====================
    
    print("\n" + "=" * 70)
    print("Real-Time Monitoring: Analyze Risk of Proposed Change")
    print("=" * 70)
    
    # Simulate a developer about to change get_user()
    print("\n📝 Developer is about to modify: get_user() in auth.py")
    print("\n⚠️  Risk Analysis:")
    
    if get_user_components:
        # Quick impact check
        impact = predictor.analyze_change_impact(
            component_ids=[get_user_id],
            max_depth=2,
        )
        
        affected_count = impact['stats']['total_impacted']
        
        # Calculate risk level
        if affected_count == 0:
            risk_level = "LOW"
            risk_emoji = "✅"
        elif affected_count <= 3:
            risk_level = "MEDIUM"
            risk_emoji = "⚠️"
        else:
            risk_level = "HIGH"
            risk_emoji = "🔴"
        
        print(f"\n{risk_emoji} Risk Level: {risk_level}")
        print(f"   - {affected_count} components will be impacted")
        print(f"   - {impact['stats']['graph_reverse_count']} direct callers")
        print(f"   - {impact['stats']['graph_forward_count']} dependencies affected")
        
        if affected_count > 0:
            print(f"\n   Components that need review:")
            for item in impact['combined'][:3]:
                print(f"     • {item['name']} ({item['node_type']})")
    
    # ==================== Summary ====================
    
    print("\n" + "=" * 70)
    print("Summary")
    print("=" * 70)
    
    predictor_stats = predictor.get_stats()
    print(f"\nPredictor Statistics:")
    print(f"  Files indexed: {predictor_stats['num_files']}")
    print(f"  Components: {predictor_stats['num_components']}")
    print(f"  CPGs cached: {predictor_stats['num_cached_cpgs']}")
    
    print("\n✨ Graph queries enable:")
    print("  1. Real-time impact analysis")
    print("  2. Dependency tracking")
    print("  3. Call chain visualization")
    print("  4. Risk assessment for changes")
    print("  5. Refactoring safety checks")


if __name__ == "__main__":
    main()

