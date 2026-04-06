# Feature Implementation Plan: User Authentication System

## Requirements

### What we're building
A comprehensive JWT-based authentication system for the Metabob Internal Dashboard with the following capabilities:
- User registration and login with email/password
- JWT token generation and validation
- Password reset via email
- Session management
- Role-based access control (Admin, User roles)
- Secure password hashing with bcrypt
- Protected routes and middleware
- Frontend login/logout UI components

### Who will use it
- Internal Metabob team members
- Dashboard administrators
- System operators who need secure access to the internal dashboard

### Inputs and Outputs
**Inputs:**
- User registration: email, password, full name
- User login: email, password
- Password reset: email
- JWT tokens for authentication

**Outputs:**
- JWT access tokens (15min expiry)
- JWT refresh tokens (7 day expiry)
- User profile information
- Authentication status
- Error messages for invalid credentials

## Technology Stack Analysis

**Current Stack:**
- **Backend**: Bun.js with WebSocket support
- **Frontend**: React 19 with TypeScript
- **Database**: None currently (need to add)
- **State Management**: React hooks/context
- **Styling**: Tailwind CSS with Radix UI components

**Recommended Additions:**
- **Database**: SQLite with Bun's built-in sqlite3 support (lightweight, file-based)
- **Auth Library**: jsonwebtoken for JWT handling
- **Password Hashing**: bcrypt for secure password storage
- **Email**: nodemailer for password reset emails
- **Validation**: zod for input validation

## Files to Modify/Create

### Backend Files
- **src/lib/database.ts**: SQLite database setup and connection
- **src/lib/auth.ts**: JWT utilities, password hashing, token validation
- **src/lib/auth-middleware.ts**: Authentication middleware for routes
- **src/models/User.ts**: User model and database operations
- **src/routes/auth.ts**: Authentication API routes (login, register, reset)
- **src/lib/email.ts**: Email service for password reset
- **src/index.ts**: Update to include auth routes and middleware

### Frontend Files
- **src/components/auth/LoginForm.tsx**: Login form component
- **src/components/auth/RegisterForm.tsx**: Registration form component
- **src/components/auth/PasswordResetForm.tsx**: Password reset form
- **src/components/auth/AuthLayout.tsx**: Layout for auth pages
- **src/components/auth/ProtectedRoute.tsx**: Route guard component
- **src/contexts/AuthContext.tsx**: Authentication context and provider
- **src/hooks/useAuth.ts**: Authentication hook
- **src/types/auth.ts**: TypeScript types for auth
- **src/App.tsx**: Update to include auth routing and context

### Database Files
- **migrations/001_create_users_table.sql**: Initial user table schema
- **migrations/002_create_sessions_table.sql**: Session management table
- **src/lib/migrations.ts**: Database migration runner

### Configuration Files
- **.env.example**: Update with auth-related environment variables
- **package.json**: Add new dependencies

## Implementation Steps

### Phase 1: Database Setup (Day 1)
1. **Install dependencies**
   ```bash
   bun add sqlite3 bcrypt jsonwebtoken zod nodemailer
   bun add -d @types/bcrypt @types/jsonwebtoken @types/nodemailer
   ```

2. **Create database utilities**
   - Set up SQLite database connection
   - Create migration system
   - Create User and Session tables

3. **Create User model**
   - User CRUD operations
   - Password hashing utilities
   - Email validation

### Phase 2: Backend Authentication (Day 2)
1. **Create JWT utilities**
   - Token generation (access + refresh)
   - Token validation middleware
   - Token refresh logic

2. **Create authentication routes**
   - POST /api/auth/register
   - POST /api/auth/login
   - POST /api/auth/refresh
   - POST /api/auth/logout
   - POST /api/auth/forgot-password
   - POST /api/auth/reset-password

3. **Add authentication middleware**
   - Protect existing dashboard routes
   - Add user context to requests

### Phase 3: Frontend Authentication (Day 3)
1. **Create auth context and hooks**
   - AuthContext for global auth state
   - useAuth hook for components
   - Token storage in localStorage

2. **Create authentication components**
   - LoginForm with validation
   - RegisterForm with validation
   - PasswordResetForm

3. **Add route protection**
   - ProtectedRoute component
   - Redirect logic for unauthenticated users

### Phase 4: Integration & Testing (Day 4)
1. **Update main application**
   - Integrate auth context into App.tsx
   - Update WebSocket connection to include auth
   - Add login/logout to main UI

2. **Testing and refinement**
   - Test all auth flows
   - Error handling
   - UI/UX improvements

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT DEFAULT 'user' CHECK(role IN ('admin', 'user')),
  email_verified BOOLEAN DEFAULT FALSE,
  reset_token TEXT,
  reset_token_expires INTEGER,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);
```

### Sessions Table
```sql
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  refresh_token TEXT UNIQUE NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
```

## API Endpoints

### Authentication Routes
- **POST /api/auth/register**
  - Body: `{ email, password, fullName }`
  - Response: `{ user, accessToken, refreshToken }`

- **POST /api/auth/login**
  - Body: `{ email, password }`
  - Response: `{ user, accessToken, refreshToken }`

- **POST /api/auth/refresh**
  - Body: `{ refreshToken }`
  - Response: `{ accessToken }`

- **POST /api/auth/logout**
  - Body: `{ refreshToken }`
  - Response: `{ message: 'Logged out' }`

- **POST /api/auth/forgot-password**
  - Body: `{ email }`
  - Response: `{ message: 'Reset email sent' }`

- **POST /api/auth/reset-password**
  - Body: `{ token, newPassword }`
  - Response: `{ message: 'Password reset successful' }`

## Test Cases

### Backend Tests
- **Registration Flow**
  - Valid registration creates user
  - Duplicate email returns error
  - Invalid email format returns error
  - Weak password returns error

- **Login Flow**
  - Valid credentials return tokens
  - Invalid credentials return error
  - Returns user profile data

- **Token Management**
  - Access token validates correctly
  - Expired access token fails validation
  - Refresh token generates new access token
  - Invalid refresh token returns error

- **Password Reset**
  - Valid email sends reset token
  - Invalid email returns error
  - Reset token validates correctly
  - Expired reset token fails

### Frontend Tests
- **Login Component**
  - Form validation works
  - Successful login redirects to dashboard
  - Failed login shows error message

- **Registration Component**
  - Form validation works
  - Successful registration logs user in
  - Failed registration shows errors

- **Protected Routes**
  - Unauthenticated users redirected to login
  - Authenticated users can access dashboard
  - Token expiry redirects to login

## Edge Cases

### Security Edge Cases
- **Token Security**
  - Handle token tampering attempts
  - Secure token storage (httpOnly cookies vs localStorage)
  - Token rotation on suspicious activity

- **Rate Limiting**
  - Prevent brute force login attempts
  - Limit password reset requests
  - Protect registration endpoint from spam

- **Input Validation**
  - SQL injection prevention (parameterized queries)
  - XSS prevention (input sanitization)
  - CSRF protection for state-changing operations

### User Experience Edge Cases
- **Session Management**
  - Handle multiple tabs/windows
  - Graceful handling of network disconnections
  - Auto-logout on token expiry

- **Error States**
  - Network errors during auth requests
  - Server unavailable scenarios
  - Malformed API responses

- **Password Reset**
  - Expired reset tokens
  - Multiple reset requests
  - Invalid reset tokens

## Environment Variables

Update `.env.example`:
```bash
# Authentication
JWT_SECRET=your-super-secret-jwt-key-here
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Database
DATABASE_PATH=./data/dashboard.db

# Email Service (for password reset)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@company.com
SMTP_PASS=your-app-password
FROM_EMAIL=noreply@metabob.com

# Security
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=5
```

## Security Considerations

1. **Password Security**
   - Minimum 8 characters with complexity requirements
   - bcrypt with 12 rounds for hashing
   - No password storage in plain text

2. **Token Security**
   - Short-lived access tokens (15 minutes)
   - Secure refresh token rotation
   - JWT secret rotation capability

3. **Network Security**
   - HTTPS enforcement in production
   - Secure cookie settings
   - CORS configuration

4. **Database Security**
   - Parameterized queries to prevent SQL injection
   - Database encryption at rest
   - Regular security backups

## Performance Considerations

1. **Database Optimization**
   - Indexes on email and session tokens
   - Connection pooling
   - Query optimization

2. **Token Management**
   - Efficient token validation
   - Token blacklist for logout
   - Session cleanup job

3. **Frontend Optimization**
   - Lazy loading of auth components
   - Efficient state management
   - Minimal re-renders on auth state changes

This implementation provides a robust, secure, and scalable authentication system that integrates seamlessly with the existing Metabob Internal Dashboard architecture.