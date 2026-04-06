import { Router, Request, Response } from 'express';
import { UserModel } from '../models/User';
import {
  generateTokenPair,
  verifyRefreshToken,
  revokeRefreshToken,
  generatePasswordResetToken,
  resetPassword,
  getUserById
} from '../lib/auth';
import {
  rateLimitAuth,
  validateBody,
  handleAuthError,
  requireAuth
} from '../lib/auth-middleware';
import {
  sendPasswordResetEmail,
  sendWelcomeEmail
} from '../lib/email';
import { 
  CreateUserSchema,
  LoginSchema
} from '../models/User';
import { z } from 'zod';

const router = Router();

// Validation schemas for route-specific inputs
const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required')
});

const ForgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format')
});

const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters')
});

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register',
  rateLimitAuth,
  validateBody(CreateUserSchema),
  async (req: Request, res: Response) => {
    try {
      const result = await UserModel.create(req.body);

      if (!result.success) {
        return res.status(400).json({
          error: 'Registration failed',
          message: result.error
        });
      }

      // Generate tokens
      const tokens = await generateTokenPair(result.user!);

      // Send welcome email (non-blocking)
      sendWelcomeEmail(result.user!.email, result.user!.fullName)
        .catch(error => console.error('Failed to send welcome email:', error));

      // Return success response
      res.status(201).json({
        message: 'Registration successful',
        user: {
          id: result.user!.id,
          email: result.user!.email,
          fullName: result.user!.fullName,
          role: result.user!.role,
          emailVerified: result.user!.emailVerified
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      });

    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        error: 'Registration failed',
        message: 'Internal server error'
      });
    }
  }
);

/**
 * POST /api/auth/login
 * Authenticate user and return tokens
 */
router.post('/login',
  rateLimitAuth,
  validateBody(LoginSchema),
  async (req: Request, res: Response) => {
    try {
      const result = await UserModel.authenticate(req.body);

      if (!result.success) {
        return res.status(401).json({
          error: 'Authentication failed',
          message: result.error
        });
      }

      // Generate tokens
      const tokens = await generateTokenPair(result.user!);

      // Return success response
      res.json({
        message: 'Login successful',
        user: {
          id: result.user!.id,
          email: result.user!.email,
          fullName: result.user!.fullName,
          role: result.user!.role,
          emailVerified: result.user!.emailVerified
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        error: 'Login failed',
        message: 'Internal server error'
      });
    }
  }
);

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh',
  validateBody(RefreshTokenSchema),
  async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body;

      // Verify refresh token
      const userId = await verifyRefreshToken(refreshToken);
      if (!userId) {
        return res.status(401).json({
          error: 'Invalid refresh token',
          message: 'Token is invalid or expired'
        });
      }

      // Get user
      const user = await getUserById(userId);
      if (!user) {
        return res.status(404).json({
          error: 'User not found',
          message: 'User associated with token no longer exists'
        });
      }

      // Generate new tokens
      const tokens = await generateTokenPair(user);

      // Revoke old refresh token
      await revokeRefreshToken(refreshToken);

      res.json({
        message: 'Token refreshed successfully',
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      });

    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(500).json({
        error: 'Token refresh failed',
        message: 'Internal server error'
      });
    }
  }
);

/**
 * POST /api/auth/logout
 * Logout user and revoke refresh token
 */
router.post('/logout',
  validateBody(RefreshTokenSchema),
  async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body;

      // Revoke refresh token
      const revoked = await revokeRefreshToken(refreshToken);

      if (!revoked) {
        return res.status(400).json({
          error: 'Logout failed',
          message: 'Invalid refresh token'
        });
      }

      res.json({
        message: 'Logged out successfully'
      });

    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        error: 'Logout failed',
        message: 'Internal server error'
      });
    }
  }
);

/**
 * POST /api/auth/forgot-password
 * Send password reset email
 */
router.post('/forgot-password',
  rateLimitAuth,
  validateBody(ForgotPasswordSchema),
  async (req: Request, res: Response) => {
    try {
      const { email } = req.body;

      // Get user to check if email exists
      const user = await UserModel.getByEmail(email);
      
      // Always return success to prevent email enumeration
      // but only send email if user exists
      if (user) {
        const resetToken = await generatePasswordResetToken(email);
        
        if (resetToken) {
          // Send password reset email (non-blocking)
          const baseUrl = process.env.CLIENT_URL || 'http://localhost:3000';
          sendPasswordResetEmail(email, user.fullName, resetToken, baseUrl)
            .catch(error => console.error('Failed to send password reset email:', error));
        }
      }

      // Always return success response
      res.json({
        message: 'If an account with that email exists, a password reset link has been sent'
      });

    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({
        error: 'Password reset failed',
        message: 'Internal server error'
      });
    }
  }
);

/**
 * POST /api/auth/reset-password
 * Reset password using reset token
 */
router.post('/reset-password',
  rateLimitAuth,
  validateBody(ResetPasswordSchema),
  async (req: Request, res: Response) => {
    try {
      const { token, newPassword } = req.body;

      const success = await resetPassword(token, newPassword);

      if (!success) {
        return res.status(400).json({
          error: 'Password reset failed',
          message: 'Invalid or expired reset token'
        });
      }

      res.json({
        message: 'Password reset successful'
      });

    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({
        error: 'Password reset failed',
        message: 'Internal server error'
      });
    }
  }
);

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get('/me',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const user = await getUserById(req.user!.id);

      if (!user) {
        return res.status(404).json({
          error: 'User not found',
          message: 'User profile not available'
        });
      }

      res.json({
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          emailVerified: user.emailVerified,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      });

    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        error: 'Failed to get profile',
        message: 'Internal server error'
      });
    }
  }
);

/**
 * PUT /api/auth/me
 * Update current user profile
 */
router.put('/me',
  requireAuth,
  validateBody(z.object({
    fullName: z.string().min(2, 'Full name must be at least 2 characters').optional()
  })),
  async (req: Request, res: Response) => {
    try {
      const result = await UserModel.update(req.user!.id, req.body);

      if (!result.success) {
        return res.status(400).json({
          error: 'Update failed',
          message: result.error
        });
      }

      res.json({
        message: 'Profile updated successfully',
        user: {
          id: result.user!.id,
          email: result.user!.email,
          fullName: result.user!.fullName,
          role: result.user!.role,
          emailVerified: result.user!.emailVerified,
          createdAt: result.user!.createdAt,
          updatedAt: result.user!.updatedAt
        }
      });

    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        error: 'Update failed',
        message: 'Internal server error'
      });
    }
  }
);

/**
 * POST /api/auth/change-password
 * Change user password
 */
router.post('/change-password',
  requireAuth,
  validateBody(z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters')
  })),
  async (req: Request, res: Response) => {
    try {
      const result = await UserModel.changePassword(req.user!.id, req.body);

      if (!result.success) {
        return res.status(400).json({
          error: 'Password change failed',
          message: result.error
        });
      }

      res.json({
        message: 'Password changed successfully'
      });

    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        error: 'Password change failed',
        message: 'Internal server error'
      });
    }
  }
);

// Error handling middleware
router.use(handleAuthError);

export default router;