/**
 * @metabob/validation
 * Validation schemas and utilities for Metabob services
 */

import { z, ZodError } from 'zod';

// ===== Base Schemas =====

/**
 * Pagination schema for list endpoints
 */
export const PaginationSchema = z.object({
  limit: z.number().int().positive().max(100).default(10),
  offset: z.number().int().nonnegative().default(0),
});

export type Pagination = z.infer<typeof PaginationSchema>;

/**
 * Severity filter schema
 */
export const SeverityFilterSchema = z.array(
  z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'])
).optional();

export type SeverityFilter = z.infer<typeof SeverityFilterSchema>;

/**
 * Category filter schema
 */
export const CategoryFilterSchema = z.array(
  z.enum(['security', 'performance', 'maintainability', 'correctness'])
).optional();

export type CategoryFilter = z.infer<typeof CategoryFilterSchema>;

/**
 * Scope schema
 */
export const ScopeSchema = z.enum(['session', 'project', 'org']).default('session');

export type Scope = z.infer<typeof ScopeSchema>;

/**
 * File pattern schema (glob-like)
 */
export const FilePatternSchema = z.string().optional();

export type FilePattern = z.infer<typeof FilePatternSchema>;

// ===== Common Request Schemas =====

/**
 * Base filter schema for analysis queries
 */
export const BaseFilterSchema = z.object({
  severity: SeverityFilterSchema,
  category: CategoryFilterSchema,
  file_pattern: FilePatternSchema,
  scope: ScopeSchema,
});

export type BaseFilter = z.infer<typeof BaseFilterSchema>;

/**
 * ID parameter schema
 */
export const IdParamSchema = z.object({
  id: z.string().min(1, 'ID is required'),
});

export type IdParam = z.infer<typeof IdParamSchema>;

// ===== Error Formatting =====

/**
 * Format Zod validation errors for user-friendly display
 */
export function formatZodError(error: ZodError): string {
  return error.errors
    .map((e) => {
      const path = e.path.join('.');
      return path ? `${path}: ${e.message}` : e.message;
    })
    .join(', ');
}

/**
 * Format Zod validation errors as structured object
 */
export function formatZodErrorDetails(error: ZodError): Array<{
  path: string;
  message: string;
  code: string;
}> {
  return error.errors.map((e) => ({
    path: e.path.join('.'),
    message: e.message,
    code: e.code,
  }));
}

/**
 * Create validation error response
 */
export function createValidationError(error: ZodError): {
  error: string;
  code: string;
  details: Array<{ path: string; message: string; code: string }>;
} {
  return {
    error: 'Validation failed',
    code: 'VALIDATION_ERROR',
    details: formatZodErrorDetails(error),
  };
}

// ===== Validation Utilities =====

/**
 * Safe parse with error formatting
 */
export function safeParse<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string; details: ZodError } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    error: formatZodError(result.error),
    details: result.error,
  };
}

/**
 * Validate and throw on error
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

// Re-export zod for convenience
export { z, ZodError };
