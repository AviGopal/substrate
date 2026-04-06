import { z } from 'zod';
import { runQuery, getRow } from '../lib/database';
import { hashPassword, verifyPassword, User } from '../lib/auth';

// Validation schemas
export const CreateUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  role: z.enum(['admin', 'user']).optional().default('user')
});

export const LoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required')
});

export const UpdateUserSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').optional(),
  role: z.enum(['admin', 'user']).optional(),
  emailVerified: z.boolean().optional()
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters')
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;

export interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
}

export interface LoginResult extends AuthResult {
  accessToken?: string;
  refreshToken?: string;
}

export class UserModel {
  /**
   * Create a new user
   */
  static async create(input: CreateUserInput): Promise<AuthResult> {
    try {
      // Validate input
      const validated = CreateUserSchema.parse(input);
      
      // Check if user already exists
      const existingUser = await getRow(
        'SELECT id FROM users WHERE email = ?',
        [validated.email.toLowerCase()]
      );

      if (existingUser) {
        return {
          success: false,
          error: 'User with this email already exists'
        };
      }

      // Hash password
      const passwordHash = await hashPassword(validated.password);
      const now = Math.floor(Date.now() / 1000);

      // Insert user
      const result = await runQuery(
        `INSERT INTO users (email, password_hash, full_name, role, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          validated.email.toLowerCase(),
          passwordHash,
          validated.fullName,
          validated.role,
          now,
          now
        ]
      );

      // Get created user
      const user = await this.getById(result.lastID);
      if (!user) {
        return {
          success: false,
          error: 'Failed to create user'
        };
      }

      return {
        success: true,
        user
      };
    } catch (error) {
      console.error('Error creating user:', error);
      
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: error.errors[0]?.message || 'Validation failed'
        };
      }

      return {
        success: false,
        error: 'Failed to create user'
      };
    }
  }

  /**
   * Authenticate user with email and password
   */
  static async authenticate(input: LoginInput): Promise<AuthResult> {
    try {
      // Validate input
      const validated = LoginSchema.parse(input);

      // Get user with password hash
      const row = await getRow(
        `SELECT id, email, password_hash, full_name, role, email_verified, created_at, updated_at
         FROM users WHERE email = ?`,
        [validated.email.toLowerCase()]
      );

      if (!row) {
        return {
          success: false,
          error: 'Invalid email or password'
        };
      }

      // Verify password
      const isValidPassword = await verifyPassword(validated.password, row.password_hash);
      
      if (!isValidPassword) {
        return {
          success: false,
          error: 'Invalid email or password'
        };
      }

      const user: User = {
        id: row.id,
        email: row.email,
        fullName: row.full_name,
        role: row.role,
        emailVerified: Boolean(row.email_verified),
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };

      return {
        success: true,
        user
      };
    } catch (error) {
      console.error('Error authenticating user:', error);
      
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: error.errors[0]?.message || 'Validation failed'
        };
      }

      return {
        success: false,
        error: 'Authentication failed'
      };
    }
  }

  /**
   * Get user by ID
   */
  static async getById(id: number): Promise<User | null> {
    try {
      const row = await getRow(
        `SELECT id, email, full_name, role, email_verified, created_at, updated_at
         FROM users WHERE id = ?`,
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

  /**
   * Get user by email
   */
  static async getByEmail(email: string): Promise<User | null> {
    try {
      const row = await getRow(
        `SELECT id, email, full_name, role, email_verified, created_at, updated_at
         FROM users WHERE email = ?`,
        [email.toLowerCase()]
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
   * Update user information
   */
  static async update(id: number, input: UpdateUserInput): Promise<AuthResult> {
    try {
      // Validate input
      const validated = UpdateUserSchema.parse(input);

      // Check if user exists
      const existingUser = await this.getById(id);
      if (!existingUser) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      // Build update query dynamically
      const updateFields: string[] = [];
      const updateValues: any[] = [];

      if (validated.fullName) {
        updateFields.push('full_name = ?');
        updateValues.push(validated.fullName);
      }

      if (validated.role) {
        updateFields.push('role = ?');
        updateValues.push(validated.role);
      }

      if (typeof validated.emailVerified === 'boolean') {
        updateFields.push('email_verified = ?');
        updateValues.push(validated.emailVerified);
      }

      if (updateFields.length === 0) {
        return {
          success: true,
          user: existingUser
        };
      }

      // Add updated_at timestamp
      updateFields.push('updated_at = ?');
      updateValues.push(Math.floor(Date.now() / 1000));
      updateValues.push(id);

      await runQuery(
        `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );

      // Get updated user
      const updatedUser = await this.getById(id);
      if (!updatedUser) {
        return {
          success: false,
          error: 'Failed to update user'
        };
      }

      return {
        success: true,
        user: updatedUser
      };
    } catch (error) {
      console.error('Error updating user:', error);
      
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: error.errors[0]?.message || 'Validation failed'
        };
      }

      return {
        success: false,
        error: 'Failed to update user'
      };
    }
  }

  /**
   * Change user password
   */
  static async changePassword(id: number, input: ChangePasswordInput): Promise<AuthResult> {
    try {
      // Validate input
      const validated = ChangePasswordSchema.parse(input);

      // Get user with current password hash
      const row = await getRow(
        'SELECT id, password_hash FROM users WHERE id = ?',
        [id]
      );

      if (!row) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      // Verify current password
      const isValidPassword = await verifyPassword(validated.currentPassword, row.password_hash);
      
      if (!isValidPassword) {
        return {
          success: false,
          error: 'Current password is incorrect'
        };
      }

      // Hash new password
      const newPasswordHash = await hashPassword(validated.newPassword);

      // Update password
      await runQuery(
        'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?',
        [newPasswordHash, Math.floor(Date.now() / 1000), id]
      );

      // Get updated user
      const user = await this.getById(id);
      
      return {
        success: true,
        user: user!
      };
    } catch (error) {
      console.error('Error changing password:', error);
      
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: error.errors[0]?.message || 'Validation failed'
        };
      }

      return {
        success: false,
        error: 'Failed to change password'
      };
    }
  }

  /**
   * Delete user
   */
  static async delete(id: number): Promise<AuthResult> {
    try {
      // Check if user exists
      const user = await this.getById(id);
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      // Delete user (sessions will be cascade deleted)
      await runQuery('DELETE FROM users WHERE id = ?', [id]);

      return {
        success: true,
        user
      };
    } catch (error) {
      console.error('Error deleting user:', error);
      return {
        success: false,
        error: 'Failed to delete user'
      };
    }
  }

  /**
   * List all users with pagination
   */
  static async list(page = 1, limit = 10): Promise<{ users: User[], total: number }> {
    try {
      const offset = (page - 1) * limit;

      const [users, totalResult] = await Promise.all([
        runQuery(
          `SELECT id, email, full_name, role, email_verified, created_at, updated_at
           FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?`,
          [limit, offset]
        ),
        getRow('SELECT COUNT(*) as count FROM users')
      ]);

      const userList: User[] = (users as any[]).map(row => ({
        id: row.id,
        email: row.email,
        fullName: row.full_name,
        role: row.role,
        emailVerified: Boolean(row.email_verified),
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));

      return {
        users: userList,
        total: totalResult?.count || 0
      };
    } catch (error) {
      console.error('Error listing users:', error);
      return {
        users: [],
        total: 0
      };
    }
  }
}