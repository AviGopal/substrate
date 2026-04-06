import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getRow, runQuery } from './database';

export interface User {
  id: number;
  email: string;
  fullName: string;
  role: 'admin' | 'user';
  emailVerified: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface JWTPayload {
  userId: number;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// Environment variables with defaults
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';
const JWT_ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '15m';
const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    return await bcrypt.hash(password, BCRYPT_ROUNDS);
  } catch (error) {
    console.error('Error hashing password:', error);
    throw new Error('Password hashing failed');
  }
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    console.error('Error verifying password:', error);
    return false;
  }
}

/**
 * Generate a secure random token
 */
export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate JWT access token
 */
export function generateAccessToken(user: User): string {
  const payload: JWTPayload = {
    userId: user.id,
    email: user.email,
    role: user.role
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_ACCESS_EXPIRY,
    issuer: 'metabob-dashboard',
    audience: 'metabob-users'
  } as jwt.SignOptions);
}

/**
 * Generate JWT refresh token and store in database
 */
export async function generateRefreshToken(userId: number): Promise<string> {
  try {
    const refreshToken = jwt.sign(
      { userId, type: 'refresh' },
      JWT_SECRET,
      {
        expiresIn: JWT_REFRESH_EXPIRY,
        issuer: 'metabob-dashboard',
        audience: 'metabob-users'
      } as jwt.SignOptions
    );

    // Calculate expiry timestamp
    const decoded = jwt.decode(refreshToken) as any;
    const expiresAt = decoded.exp;

    // Store refresh token in database
    await runQuery(
      'INSERT INTO sessions (user_id, refresh_token, expires_at) VALUES (?, ?, ?)',
      [userId, refreshToken, expiresAt]
    );

    return refreshToken;
  } catch (error) {
    console.error('Error generating refresh token:', error);
    throw new Error('Failed to generate refresh token');
  }
}

/**
 * Generate both access and refresh tokens
 */
export async function generateTokenPair(user: User): Promise<TokenPair> {
  const accessToken = generateAccessToken(user);
  const refreshToken = await generateRefreshToken(user.id);
  
  return {
    accessToken,
    refreshToken
  };
}

/**
 * Verify JWT token and return payload
 */
export function verifyAccessToken(token: string): JWTPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET, {
      issuer: 'metabob-dashboard',
      audience: 'metabob-users'
    }) as JWTPayload;
    
    return payload;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

/**
 * Verify refresh token and return user ID
 */
export async function verifyRefreshToken(token: string): Promise<number | null> {
  try {
    // Verify JWT signature and expiry
    const payload = jwt.verify(token, JWT_SECRET, {
      issuer: 'metabob-dashboard',
      audience: 'metabob-users'
    }) as any;

    if (payload.type !== 'refresh') {
      return null;
    }

    // Check if token exists in database and is not expired
    const session = await getRow(
      'SELECT user_id FROM sessions WHERE refresh_token = ? AND expires_at > ?',
      [token, Math.floor(Date.now() / 1000)]
    );

    return session ? session.user_id : null;
  } catch (error) {
    console.error('Refresh token verification failed:', error);
    return null;
  }
}

/**
 * Revoke refresh token (logout)
 */
export async function revokeRefreshToken(token: string): Promise<boolean> {
  try {
    const result = await runQuery(
      'DELETE FROM sessions WHERE refresh_token = ?',
      [token]
    );
    
    return result.changes > 0;
  } catch (error) {
    console.error('Error revoking refresh token:', error);
    return false;
  }
}

/**
 * Revoke all refresh tokens for a user
 */
export async function revokeAllUserTokens(userId: number): Promise<void> {
  try {
    await runQuery(
      'DELETE FROM sessions WHERE user_id = ?',
      [userId]
    );
  } catch (error) {
    console.error('Error revoking user tokens:', error);
    throw new Error('Failed to revoke tokens');
  }
}

/**
 * Generate password reset token
 */
export async function generatePasswordResetToken(email: string): Promise<string | null> {
  try {
    const user = await getRow(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (!user) {
      return null; // User not found
    }

    const resetToken = generateSecureToken();
    const expiresAt = Math.floor(Date.now() / 1000) + (24 * 60 * 60); // 24 hours

    await runQuery(
      'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
      [resetToken, expiresAt, user.id]
    );

    return resetToken;
  } catch (error) {
    console.error('Error generating password reset token:', error);
    throw new Error('Failed to generate reset token');
  }
}

/**
 * Verify password reset token
 */
export async function verifyPasswordResetToken(token: string): Promise<number | null> {
  try {
    const user = await getRow(
      'SELECT id FROM users WHERE reset_token = ? AND reset_token_expires > ?',
      [token, Math.floor(Date.now() / 1000)]
    );

    return user ? user.id : null;
  } catch (error) {
    console.error('Error verifying password reset token:', error);
    return null;
  }
}

/**
 * Reset password using token
 */
export async function resetPassword(token: string, newPassword: string): Promise<boolean> {
  try {
    const userId = await verifyPasswordResetToken(token);
    if (!userId) {
      return false;
    }

    const passwordHash = await hashPassword(newPassword);

    await runQuery(
      'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL, updated_at = ? WHERE id = ?',
      [passwordHash, Math.floor(Date.now() / 1000), userId]
    );

    // Revoke all existing sessions for security
    await revokeAllUserTokens(userId);

    return true;
  } catch (error) {
    console.error('Error resetting password:', error);
    return false;
  }
}

/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  return authHeader.substring(7); // Remove "Bearer " prefix
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  try {
    const row = await getRow(
      'SELECT id, email, full_name, role, email_verified, created_at, updated_at FROM users WHERE email = ?',
      [email]
    );

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      role: row.role,
      emailVerified: Boolean(row.email_verified),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  } catch (error) {
    console.error('Error getting user by email:', error);
    return null;
  }
}

/**
 * Get user by ID
 */
export async function getUserById(id: number): Promise<User | null> {
  try {
    const row = await getRow(
      'SELECT id, email, full_name, role, email_verified, created_at, updated_at FROM users WHERE id = ?',
      [id]
    );

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      role: row.role,
      emailVerified: Boolean(row.email_verified),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  } catch (error) {
    console.error('Error getting user by ID:', error);
    return null;
  }
}