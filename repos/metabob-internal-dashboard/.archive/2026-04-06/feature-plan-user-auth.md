# Feature Implementation Plan: User Authentication

## Requirements

### What we're building
A JWT-based authentication system for the Metabob Internal Dashboard with core functionality:
- User login with email/password
- JWT token generation and validation 
- Session management with access tokens
- Protected routes that require authentication
- Simple logout functionality
- Frontend login/logout UI

### Who will use it
- Internal Metabob team members who need secure access to the dashboard
- System administrators managing the internal observability tools

### Inputs and Outputs
**Inputs:**
- User login: email, password
- JWT tokens for route protection
- User authentication status

**Outputs:**
- JWT access tokens (configurable expiry)
- User profile information (id, email, role)
- Authentication status (authenticated/unauthenticated)
- Error messages for invalid credentials

## Files to Modify/Create

### Backend Files
- **src/lib/auth.ts**: JWT utilities, token generation/validation
- **src/lib/auth-middleware.ts**: Authentication middleware for protected routes
- **src/models/User.ts**: Simple user model (could use in-memory or file-based storage initially)
- **src/routes/auth.ts**: Authentication API routes (login, logout, verify)
- **src/index.ts**: Update server to include auth routes and middleware

### Frontend Files
- **src/components/auth/LoginForm.tsx**: Login form component
- **src/components/auth/ProtectedRoute.tsx**: Route guard component
- **src/contexts/AuthContext.tsx**: Authentication context and provider
- **src/hooks/useAuth.ts**: Authentication hook
- **src/types/auth.ts**: TypeScript types for authentication
- **src/App.tsx**: Update to include auth routing and context

### Configuration Files
- **.env.example**: Add JWT_SECRET and related auth environment variables
- **package.json**: Add jsonwebtoken dependency

## Implementation Steps

### Phase 1: Backend JWT Infrastructure (Day 1)
1. **Install JWT dependency**
   ```bash
   bun add jsonwebtoken bcrypt
   bun add -d @types/jsonwebtoken @types/bcrypt
   ```

2. **Create JWT utilities** (`src/lib/auth.ts`)
   - Token generation function
   - Token validation function 
   - Password hashing utilities
   - User authentication logic

3. **Create simple user store** (`src/models/User.ts`)
   - In-memory user storage initially
   - User lookup by email
   - Password verification

### Phase 2: Authentication Routes (Day 1-2)
1. **Create auth routes** (`src/routes/auth.ts`)
   - POST /api/auth/login
   - POST /api/auth/logout  
   - GET /api/auth/verify (check token validity)

2. **Create auth middleware** (`src/lib/auth-middleware.ts`)
   - JWT token extraction from headers
   - Token validation
   - User context injection

3. **Update main server** (`src/index.ts`)
   - Add auth routes
   - Apply auth middleware to protected endpoints

### Phase 3: Frontend Authentication (Day 2)
1. **Create auth types** (`src/types/auth.ts`)
   - User interface
   - Auth state interface
   - API response types

2. **Create auth context** (`src/contexts/AuthContext.tsx`)
   - Authentication state management
   - Login/logout functions
   - Token storage (localStorage)

3. **Create auth hook** (`src/hooks/useAuth.ts`)
   - Convenient auth state access
   - Authentication actions

### Phase 4: UI Components (Day 2-3)
1. **Create login form** (`src/components/auth/LoginForm.tsx`)
   - Email/password form
   - Form validation
   - Error handling
   - Loading states

2. **Create protected route** (`src/components/auth/ProtectedRoute.tsx`)
   - Route guard logic
   - Redirect to login for unauthenticated users
   - Loading state while checking auth

3. **Update main app** (`src/App.tsx`)
   - Wrap app in AuthProvider
   - Add conditional rendering for auth state
   - Include login form when not authenticated

### Phase 5: Integration & Testing (Day 3)
1. **Integration testing**
   - Login flow end-to-end
   - Protected route access
   - Token validation

2. **Error handling**
   - Invalid credentials
   - Expired tokens
   - Network errors

3. **UI polish**
   - Loading states
   - Error messages
   - Responsive design

## Test Cases

### Backend Tests
- **JWT Token Generation**
  - Valid user credentials generate token
  - Invalid credentials return error
  - Generated tokens can be validated

- **Authentication Middleware**  
  - Valid tokens allow access to protected routes
  - Invalid tokens return 401 Unauthorized
  - Missing tokens return 401 Unauthorized

- **Auth Routes**
  - Login with valid credentials returns token
  - Login with invalid credentials returns error
  - Logout invalidates token (if implemented)

### Frontend Tests
- **Login Component**
  - Form validation prevents empty submission
  - Successful login updates auth state
  - Failed login shows error message
  - Loading state shows during authentication

- **Protected Route**
  - Unauthenticated users redirected to login
  - Authenticated users see protected content
  - Auth state changes update route access

- **Auth Context**
  - Login function updates state correctly
  - Logout function clears state
  - Token persistence works across browser sessions

## Edge Cases

### Security Edge Cases
- **Token Security**
  - Handle malformed JWT tokens gracefully
  - Prevent token tampering
  - Secure token storage considerations

- **Input Validation**
  - Email format validation
  - Password minimum requirements
  - Prevent injection attacks

### User Experience Edge Cases
- **Session Management**
  - Handle expired tokens gracefully
  - Auto-logout on token expiry
  - Preserve login state across browser refresh

- **Error States**
  - Network errors during login
  - Server unavailable scenarios
  - Malformed API responses

- **Loading States**
  - Show loading indicator during authentication
  - Prevent multiple login attempts
  - Handle slow network conditions

## Environment Variables

Add to `.env.example`:
```bash
# JWT Authentication
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRY=24h

# Default Admin User (for initial setup)
DEFAULT_ADMIN_EMAIL=admin@metabob.com
DEFAULT_ADMIN_PASSWORD=change-me-in-production
```

## Initial User Setup

For MVP, create a simple default user in the system:
- Email: admin@metabob.com
- Password: admin123 (configurable via environment)
- Role: admin

This allows immediate testing without user registration functionality.

## Security Considerations

1. **JWT Secret Management**
   - Use strong, random JWT secret
   - Keep secret out of version control
   - Consider secret rotation in production

2. **Password Security**
   - Hash passwords with bcrypt
   - Minimum password requirements
   - No plain text password storage

3. **Token Management**
   - Reasonable token expiry (24 hours)
   - Secure token transmission
   - Consider httpOnly cookies vs localStorage

## Performance Considerations

1. **Token Validation**
   - Efficient JWT verification
   - Consider token caching if needed
   - Minimize database lookups

2. **Frontend State**
   - Efficient auth state management
   - Minimal re-renders on auth changes
   - Lazy loading of auth components

This implementation provides a solid foundation for JWT-based authentication that can be extended with additional features like user registration, password reset, and role-based access control as needed.