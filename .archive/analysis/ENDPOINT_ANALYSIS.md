# REST Endpoint Analysis: GET /api/users/:id

**Date**: 2026-02-15  
**Purpose**: Document existing codebase conventions for implementing a new user profile endpoint

---

## 1. Framework and Routing Pattern

### Framework
**FastAPI** (Python) - Modern async web framework with automatic OpenAPI documentation

**Evidence**:
- `repos/metabob-rpc-api/requirements.txt` includes FastAPI
- All route files use `from fastapi import APIRouter`
- Routes use FastAPI decorators: `@router.get()`, `@router.post()`, etc.

### Routing Structure
```python
from fastapi import APIRouter

router = APIRouter(prefix="/v2/activities", tags=["activities-v2"])

@router.get("/templates/{template_id}")
async def get_template(...):
    """Endpoint implementation"""
```

**Location**: `repos/metabob-rpc-api/server/routes/`

**Pattern**:
- Each route file creates an `APIRouter` with a prefix
- Routes are async functions with type hints
- Path parameters use `{param}` syntax in decorator
- Route functions are registered with `@router.<method>()` decorators

---

## 2. Validation Pattern

### Request/Response Models
**Pydantic** models for validation and serialization

**Example from** `auth.py:2261-2316`:
```python
from pydantic import BaseModel, Field, field_validator
from fastapi import Path, Query, Body

# Response model
class UserResponse(BaseModel):
    user_id: str
    org_id: str
    email: str
    role: str
    created_at: datetime
    last_login_at: Optional[datetime]
    metadata: dict = Field(default_factory=dict)

# Endpoint with validation
@router.get("/orgs/{org_id}/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str = Path(..., description="User ID"),
    org_id: str = Path(..., description="Organization ID"),
    ...
) -> UserResponse:
    """Get user details"""
```

**Validation Features**:
- `Field()` for default values and descriptions
- `Path(...)` for required path parameters with descriptions
- `Query()` for query parameters with defaults
- `Body()` for request body validation
- `field_validator` for custom validation logic
- `response_model` in decorator for automatic serialization

**Key Pattern**: Type hints + Pydantic = automatic validation and OpenAPI docs

---

## 3. Error Handling Convention

### Standard Error Pattern
**HTTPException** with appropriate status codes and detail messages

**Examples from** `auth.py`:

```python
from fastapi import HTTPException

# 404 - Not Found
if not user:
    raise HTTPException(
        status_code=404, 
        detail="User not found"
    )

# 401 - Unauthorized
if not credentials:
    raise HTTPException(
        status_code=401,
        detail="Authentication required. Provide Authorization: Bearer <token>"
    )

# 403 - Forbidden
if user.org_id != org_id:
    raise HTTPException(
        status_code=403,
        detail="User doesn't have access to this organization"
    )

# 400 - Bad Request
if not validate_input(data):
    raise HTTPException(
        status_code=400,
        detail="Invalid input data"
    )

# 500 - Internal Server Error (with logging)
try:
    result = await operation()
except Exception as e:
    logger.error(f"Operation failed: {e}")
    raise HTTPException(
        status_code=500,
        detail=f"Failed to complete operation: {str(e)}"
    )
```

**Error Codes Used**:
- `401` - Authentication required/invalid
- `403` - Forbidden (lacks permission)
- `404` - Resource not found
- `400` - Bad request/validation error
- `422` - Unprocessable entity (Pydantic validation)
- `500` - Internal server error
- `501` - Not implemented

**Pattern**: Raise HTTPException early, let FastAPI handle serialization

---

## 4. Test Location and Pattern

### Test Structure
**Location**: `repos/metabob-rpc-api/tests/routes/`

**Test File Naming**: `test_routes_<module>.py`  
Example: `test_routes_auth.py` for `routes/auth.py`

### Test Pattern (from `test_routes_auth.py`):

```python
import pytest
from unittest.mock import patch, AsyncMock

def test_get_user_success(route_client, mock_auth_session):
    """Test successful user retrieval"""
    # Arrange
    user_id = "user_123"
    org_id = "org_456"
    
    # Act
    response = route_client.get(
        f"/auth/orgs/{org_id}/users/{user_id}",
        headers={"Authorization": f"Bearer {mock_auth_session['token']}"}
    )
    
    # Assert
    assert response.status_code == 200
    data = response.json()
    assert data["user_id"] == user_id
    assert "email" in data

def test_get_user_not_found(route_client, mock_auth_session):
    """Test 404 when user doesn't exist"""
    response = route_client.get(
        "/auth/orgs/org_123/users/nonexistent",
        headers={"Authorization": f"Bearer {mock_auth_session['token']}"}
    )
    
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()

def test_get_user_unauthorized(route_client):
    """Test 401 without authentication"""
    response = route_client.get("/auth/orgs/org_123/users/user_123")
    
    assert response.status_code == 401
```

**Test Patterns**:
- Use `route_client` fixture (TestClient from FastAPI)
- Test success cases (200, 201)
- Test validation errors (400, 422)
- Test authentication (401)
- Test authorization (403)
- Test not found (404)
- Use helper functions for setup (register_user, login_user)
- Mock external dependencies (database, Redis)

---

## 5. Authentication Requirements

### Authentication Flow
**Bearer Token** (session-based) with two-tier architecture

**Pattern from** `v2_session.py:100-143`:

```python
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

SESSION_TOKEN = HTTPBearer(description="Session Token", auto_error=False)

async def get_session_from_token(
    request: Request,
    redis: StrictRedis,
    credentials: HTTPAuthorizationCredentials,
) -> SessionData:
    """Authenticate request via session token"""
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=401,
            detail="Authentication required. Provide Authorization: Bearer <token>"
        )
    
    session = await fetch_session_model(credentials.credentials, redis)
    if not session:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired session token"
        )
    
    return session
```

**Usage in Endpoints**:

```python
from fastapi import Depends

async def require_auth(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Security(SESSION_TOKEN),
    redis: StrictRedis = Depends(get_redis_connection),
) -> SessionData:
    """Dependency that enforces authentication"""
    return await get_session_from_token(request, redis, credentials)

@router.get("/me", response_model=UserResponse)
async def get_current_user(
    session: SessionData = Depends(require_auth),
    db: SurrealDBClient = Depends(get_surreal_connection),
) -> UserResponse:
    """Protected endpoint - requires authentication"""
```

**Auth Dependency Functions**:
- `require_auth` - Basic authentication (returns SessionData)
- `require_org_access` - Verifies org access (returns tuple[org_id, session])
- `require_org_admin` - Requires admin role

**Key Components**:
1. **API Key → Session**: Client calls `POST /v2/session` with API key
2. **Session Token**: Backend returns JWT/token for subsequent requests
3. **Bearer Auth**: All protected endpoints use `Authorization: Bearer <token>`
4. **Redis Sessions**: Session data stored in Redis with expiration

---

## 6. Similar Endpoints for Reference

### Best Reference: GET user by ID
**File**: `repos/metabob-rpc-api/server/routes/auth.py:2261-2316`

```python
@router.get("/orgs/{org_id}/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str = Path(..., description="User ID"),
    org_id_session: tuple[str, SessionData] = Depends(require_org_access),
    redis: StrictRedis = Depends(get_redis_connection),
    db: "SurrealDBClient" = Depends(get_surreal_connection),
) -> UserResponse:
    """Get user details.
    
    Args:
        user_id: User ID
        org_id_session: Tuple of (org_id, session) from dependency
        redis: Redis connection
        db: SurrealDB connection
        
    Returns:
        UserResponse: User details
        
    Raises:
        HTTPException: 501 if auth_db not yet implemented
        HTTPException: 404 if user not found
    """
    org_id, session = org_id_session
    logger.info(f"Get user {user_id} from organization {org_id}")
    
    # Check if implementation is available
    if get_user_by_id is None:
        raise HTTPException(
            status_code=501, 
            detail="User management not yet implemented"
        )
    
    try:
        # Fetch user from database
        user = await get_user_by_id(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Verify user belongs to organization (authorization)
        if user.org_id != org_id:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Return validated response
        return UserResponse(
            user_id=user.user_id,
            org_id=user.org_id,
            email=user.email,
            role=user.role,
            created_at=user.created_at,
            last_login_at=user.last_login_at,
            metadata=user.metadata,
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get user error: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to get user: {str(e)}"
        )
```

**Why This is the Best Reference**:
1. ✅ GET endpoint with path parameter (`:id`)
2. ✅ Returns single resource (not a list)
3. ✅ Requires authentication
4. ✅ Validates resource exists (404 handling)
5. ✅ Authorization check (org membership)
6. ✅ Proper error handling with logging
7. ✅ Type-safe with Pydantic models
8. ✅ Async database operations
9. ✅ Comprehensive docstring

### Other Reference Endpoints

**GET with query parameters**:
- `v2_activities.py:513` - `GET /templates` with pagination
  ```python
  @router.get("/templates")
  async def list_templates(
      limit: int = Query(10, ge=1, le=100),
      offset: int = Query(0, ge=0),
      ...
  )
  ```

**Simple GET (no auth)**:
- `health.py:10` - `GET /health` for health checks
  ```python
  @router.get("/health")
  async def health_check() -> dict:
      return {"status": "healthy"}
  ```

---

## 7. Implementation Checklist for GET /api/users/:id

Based on codebase conventions:

### Route Definition
- [ ] Create route in appropriate file (e.g., `routes/users.py` or add to `routes/auth.py`)
- [ ] Use `@router.get("/users/{user_id}")` decorator
- [ ] Add to existing router or create new `APIRouter(prefix="/api", tags=["users"])`

### Request/Response Models
- [ ] Define `UserProfileResponse` Pydantic model
- [ ] Use `Field()` for descriptions and defaults
- [ ] Include all required user fields (id, email, name, etc.)

### Authentication
- [ ] Add `session: SessionData = Depends(require_auth)` parameter
- [ ] Or use `require_org_access` if org-scoped

### Validation
- [ ] Use `user_id: str = Path(..., description="User ID")`
- [ ] Validate ID format if needed (field_validator)

### Database
- [ ] Add `db: SurrealDBClient = Depends(get_surreal_connection)`
- [ ] Create/use `get_user_by_id(db, user_id)` function

### Error Handling
- [ ] 401 if not authenticated (handled by dependency)
- [ ] 404 if user not found
- [ ] 403 if user lacks permission (if org-scoped)
- [ ] 500 with logging for unexpected errors
- [ ] Try-except block with re-raise pattern

### Logging
- [ ] Import logger: `logger = logging.getLogger(__name__)`
- [ ] Log entry: `logger.info(f"Get user profile {user_id}")`
- [ ] Log errors: `logger.error(f"Error: {e}")`

### Testing
- [ ] Create `test_users.py` in `tests/routes/`
- [ ] Test success (200)
- [ ] Test not found (404)
- [ ] Test unauthorized (401)
- [ ] Test forbidden if applicable (403)
- [ ] Mock database and Redis

### Documentation
- [ ] Add comprehensive docstring with Args/Returns/Raises
- [ ] FastAPI will auto-generate OpenAPI docs from decorators

---

## 8. Database Layer Pattern

### Database Operations
**SurrealDB** with async client

**Pattern**:
```python
from server.utils.surreal_client import SurrealDBClient, get_surreal_connection
from fastapi import Depends

@router.get("/users/{user_id}")
async def get_user_profile(
    user_id: str = Path(...),
    db: SurrealDBClient = Depends(get_surreal_connection),
):
    # Query database
    query = "SELECT * FROM users WHERE id = $user_id"
    result = await db.query(query, {"user_id": user_id})
    
    if not result:
        raise HTTPException(status_code=404, detail="User not found")
    
    return result[0]
```

**Database Functions** (from `server/actions/auth_db.py`):
- Follow pattern: `async def get_user_by_id(db: SurrealDBClient, user_id: str) -> User | None`
- Return typed objects or None
- Let route handle HTTPException

---

## 9. Recommended File Structure

```
repos/metabob-rpc-api/
├── server/
│   ├── routes/
│   │   └── auth.py (add to existing file under /me endpoint)
│   │   OR
│   │   └── users.py (new file if users deserve separate module)
│   ├── actions/
│   │   └── auth_db.py (database functions already exist here)
│   └── models/
│       └── auth.py (UserResponse already defined)
└── tests/
    └── routes/
        └── test_routes_auth.py (add tests here)
        OR
        └── test_routes_users.py (new test file)
```

**Recommendation**: Add to `auth.py` since user profile is authentication-related and `get_user_by_id` already exists in `auth_db.py`.

---

## 10. Summary

### Quick Start Template

```python
# In repos/metabob-rpc-api/server/routes/auth.py

@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user_profile(
    user_id: str = Path(..., description="User ID to retrieve"),
    session: SessionData = Depends(require_auth),
    db: SurrealDBClient = Depends(get_surreal_connection),
) -> UserResponse:
    """
    Retrieve user profile by ID.
    
    Requires authentication. Users can only access their own profile
    or profiles within their organization if they have appropriate permissions.
    
    Args:
        user_id: Unique user identifier
        session: Authenticated session data
        db: Database connection
        
    Returns:
        UserResponse: User profile information
        
    Raises:
        HTTPException 401: Authentication required
        HTTPException 403: User lacks permission to access this profile
        HTTPException 404: User not found
        HTTPException 500: Internal server error
    """
    logger.info(f"Get user profile {user_id} (requested by {session.user_id})")
    
    try:
        # Fetch user from database
        user = await get_user_by_id(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Authorization: Can only view own profile or org members
        if user.user_id != session.user_id and user.org_id != session.org_id:
            raise HTTPException(
                status_code=403,
                detail="Not authorized to view this user profile"
            )
        
        # Return validated response
        return UserResponse(
            user_id=user.user_id,
            org_id=user.org_id,
            email=user.email,
            role=user.role,
            created_at=user.created_at,
            last_login_at=user.last_login_at,
            metadata=user.metadata,
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get user profile error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve user profile: {str(e)}"
        )
```

### Key Takeaways

1. **Framework**: FastAPI with async/await
2. **Validation**: Pydantic models everywhere
3. **Auth**: Bearer token via `Depends(require_auth)`
4. **Errors**: HTTPException with specific status codes
5. **Database**: SurrealDB via dependency injection
6. **Testing**: Separate test files in `tests/routes/`
7. **Logging**: Use module logger for info/error
8. **Pattern**: Match `get_user` endpoint in `auth.py:2261`

**Next Steps**: Implement endpoint following this pattern, then create tests.
