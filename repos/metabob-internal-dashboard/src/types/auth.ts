// User types
export interface User {
  id: number;
  email: string;
  fullName: string;
  role: 'admin' | 'user';
  emailVerified: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface PublicUser {
  id: number;
  email: string;
  fullName: string;
  role: string;
  emailVerified: boolean;
}

// Authentication request/response types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
  role?: 'admin' | 'user';
}

export interface AuthResponse {
  message: string;
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  message: string;
  accessToken: string;
  refreshToken: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface UpdateProfileRequest {
  fullName?: string;
}

// JWT payload type
export interface JWTPayload {
  userId: number;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

// Authentication context types
export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<boolean>;
  updateProfile: (data: UpdateProfileRequest) => Promise<void>;
  changePassword: (data: ChangePasswordRequest) => Promise<void>;
}

// Hook return types
export interface UseAuthReturn extends AuthContextType {}

// Error types
export interface AuthError {
  error: string;
  message: string;
  details?: any[];
}

// API response wrapper
export interface ApiResponse<T = any> {
  message?: string;
  data?: T;
  error?: string;
  success?: boolean;
}

// Local storage keys
export const AUTH_STORAGE_KEYS = {
  ACCESS_TOKEN: 'auth_access_token',
  REFRESH_TOKEN: 'auth_refresh_token',
  USER: 'auth_user'
} as const;

// Token validation states
export enum TokenValidationState {
  VALID = 'valid',
  EXPIRED = 'expired',
  INVALID = 'invalid',
  MISSING = 'missing'
}

// Authentication states
export enum AuthState {
  LOADING = 'loading',
  AUTHENTICATED = 'authenticated',
  UNAUTHENTICATED = 'unauthenticated',
  ERROR = 'error'
}

// Route protection types
export interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'user';
  fallback?: React.ReactNode;
  redirectTo?: string;
}

// Form validation types
export interface FormFieldError {
  field: string;
  message: string;
}

export interface FormState {
  isSubmitting: boolean;
  errors: FormFieldError[];
  touched: Record<string, boolean>;
}

// Session management types
export interface SessionInfo {
  isActive: boolean;
  expiresAt: number;
  lastActivity: number;
}

// Rate limiting types
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: number;
}

// Email verification types
export interface EmailVerificationRequest {
  token: string;
}

// Password strength types
export interface PasswordStrength {
  score: number; // 0-4
  feedback: {
    warning?: string;
    suggestions: string[];
  };
  isValid: boolean;
}

// Multi-factor authentication types (for future extension)
export interface MFASetupRequest {
  method: 'totp' | 'sms' | 'email';
}

export interface MFAVerifyRequest {
  code: string;
  token?: string;
}

// Audit log types (for future extension)
export interface AuthAuditLog {
  id: number;
  userId: number;
  action: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  createdAt: number;
}

// Permission types (for future RBAC extension)
export interface Permission {
  id: number;
  name: string;
  description: string;
  resource: string;
  action: string;
}

export interface Role {
  id: number;
  name: string;
  description: string;
  permissions: Permission[];
}

// Utility types
export type AuthAction = 
  | 'login'
  | 'logout'
  | 'register'
  | 'refresh'
  | 'forgot-password'
  | 'reset-password'
  | 'change-password'
  | 'update-profile'
  | 'verify-email';

export type AuthEventType = 
  | 'auth:login'
  | 'auth:logout'
  | 'auth:register'
  | 'auth:token-refresh'
  | 'auth:password-change'
  | 'auth:profile-update'
  | 'auth:error';

export interface AuthEvent {
  type: AuthEventType;
  payload?: any;
  timestamp: number;
}

// Configuration types
export interface AuthConfig {
  apiBaseUrl: string;
  tokenRefreshThreshold: number; // seconds before expiry to refresh
  sessionTimeout: number; // minutes of inactivity
  passwordMinLength: number;
  enableRegistration: boolean;
  enablePasswordReset: boolean;
  enableEmailVerification: boolean;
}

// Default configuration
export const DEFAULT_AUTH_CONFIG: AuthConfig = {
  apiBaseUrl: '/api/auth',
  tokenRefreshThreshold: 300, // 5 minutes
  sessionTimeout: 60, // 1 hour
  passwordMinLength: 8,
  enableRegistration: true,
  enablePasswordReset: true,
  enableEmailVerification: false
};