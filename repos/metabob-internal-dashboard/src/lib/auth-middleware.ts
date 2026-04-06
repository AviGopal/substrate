import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, extractTokenFromHeader, getUserById } from './auth';

// Extend Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        role: string;
      };
    }
  }
}

/**
 * Authentication middleware - requires valid JWT token
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'No token provided'
      });
    }

    const payload = verifyAccessToken(token);
    if (!payload) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Token is invalid or expired'
      });
    }

    // Add user info to request
    req.user = {
      id: payload.userId,
      email: payload.email,
      role: payload.role
    };

    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    return res.status(500).json({
      error: 'Authentication error',
      message: 'Internal server error'
    });
  }
}

/**
 * Optional authentication middleware - adds user to request if token is valid
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (token) {
      const payload = verifyAccessToken(token);
      if (payload) {
        req.user = {
          id: payload.userId,
          email: payload.email,
          role: payload.role
        };
      }
    }

    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    // Don't fail, just continue without user
    next();
  }
}

/**
 * Role-based access control middleware
 */
export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'No user information available'
      });
    }

    if (req.user.role !== role) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: `${role} role required`
      });
    }

    next();
  };
}

/**
 * Admin role middleware
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  return requireRole('admin')(req, res, next);
}

/**
 * Rate limiting middleware for auth endpoints
 */
interface RateLimitStore {
  [key: string]: {
    attempts: number;
    resetTime: number;
  };
}

const rateLimitStore: RateLimitStore = {};
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'); // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '5');

export function rateLimitAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();

    // Clean up old entries
    Object.keys(rateLimitStore).forEach(ip => {
      if (rateLimitStore[ip].resetTime < now) {
        delete rateLimitStore[ip];
      }
    });

    // Initialize or get current rate limit data
    if (!rateLimitStore[clientIP]) {
      rateLimitStore[clientIP] = {
        attempts: 0,
        resetTime: now + RATE_LIMIT_WINDOW_MS
      };
    }

    const clientData = rateLimitStore[clientIP];

    // Check if rate limit exceeded
    if (clientData.attempts >= RATE_LIMIT_MAX_REQUESTS) {
      const timeUntilReset = Math.ceil((clientData.resetTime - now) / 1000 / 60);
      
      return res.status(429).json({
        error: 'Too many requests',
        message: `Rate limit exceeded. Try again in ${timeUntilReset} minutes.`,
        retryAfter: timeUntilReset * 60
      });
    }

    // Increment attempt counter
    clientData.attempts++;

    // Add rate limit headers
    res.set({
      'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
      'X-RateLimit-Remaining': Math.max(0, RATE_LIMIT_MAX_REQUESTS - clientData.attempts).toString(),
      'X-RateLimit-Reset': Math.ceil(clientData.resetTime / 1000).toString()
    });

    next();
  } catch (error) {
    console.error('Rate limit middleware error:', error);
    next(); // Continue without rate limiting on error
  }
}

/**
 * Validate request body middleware
 */
export function validateBody(schema: any) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error: any) {
      if (error.errors) {
        const errorMessage = error.errors.map((err: any) => 
          `${err.path.join('.')}: ${err.message}`
        ).join(', ');
        
        return res.status(400).json({
          error: 'Validation failed',
          message: errorMessage,
          details: error.errors
        });
      }

      return res.status(400).json({
        error: 'Invalid request body',
        message: error.message || 'Request validation failed'
      });
    }
  };
}

/**
 * Error handling middleware for auth routes
 */
export function handleAuthError(error: any, req: Request, res: Response, next: NextFunction) {
  console.error('Auth route error:', error);

  // Database errors
  if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return res.status(409).json({
      error: 'Constraint violation',
      message: 'User with this email already exists'
    });
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid token',
      message: 'Token is malformed or invalid'
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expired',
      message: 'Please refresh your token or log in again'
    });
  }

  // Generic server error
  return res.status(500).json({
    error: 'Internal server error',
    message: 'An unexpected error occurred'
  });
}

/**
 * Security headers middleware
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  });
  
  next();
}