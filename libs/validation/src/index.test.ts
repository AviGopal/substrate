/**
 * Milestone 5 Tests: @metabob/validation
 * Tests for validation schemas and utilities
 */

import { describe, test, expect } from 'bun:test';
import {
  PaginationSchema,
  SeverityFilterSchema,
  CategoryFilterSchema,
  ScopeSchema,
  FilePatternSchema,
  BaseFilterSchema,
  IdParamSchema,
  formatZodError,
  formatZodErrorDetails,
  createValidationError,
  safeParse,
  validate,
  z,
} from './index';

describe('Milestone 5: @metabob/validation', () => {
  describe('PaginationSchema', () => {
    test('accepts valid pagination', () => {
      const result = PaginationSchema.safeParse({ limit: 10, offset: 0 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(10);
        expect(result.data.offset).toBe(0);
      }
    });

    test('applies defaults', () => {
      const result = PaginationSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(10);
        expect(result.data.offset).toBe(0);
      }
    });

    test('rejects invalid limit', () => {
      const result = PaginationSchema.safeParse({ limit: 200 });
      expect(result.success).toBe(false);
    });

    test('rejects negative offset', () => {
      const result = PaginationSchema.safeParse({ offset: -1 });
      expect(result.success).toBe(false);
    });
  });

  describe('SeverityFilterSchema', () => {
    test('accepts valid severities', () => {
      const result = SeverityFilterSchema.safeParse(['HIGH', 'MEDIUM', 'LOW']);
      expect(result.success).toBe(true);
    });

    test('accepts empty array', () => {
      const result = SeverityFilterSchema.safeParse([]);
      expect(result.success).toBe(true);
    });

    test('accepts undefined', () => {
      const result = SeverityFilterSchema.safeParse(undefined);
      expect(result.success).toBe(true);
    });

    test('rejects invalid severity', () => {
      const result = SeverityFilterSchema.safeParse(['INVALID']);
      expect(result.success).toBe(false);
    });
  });

  describe('CategoryFilterSchema', () => {
    test('accepts valid categories', () => {
      const result = CategoryFilterSchema.safeParse(['security', 'performance']);
      expect(result.success).toBe(true);
    });

    test('rejects invalid category', () => {
      const result = CategoryFilterSchema.safeParse(['invalid_category']);
      expect(result.success).toBe(false);
    });
  });

  describe('ScopeSchema', () => {
    test('accepts valid scopes', () => {
      expect(ScopeSchema.safeParse('session').success).toBe(true);
      expect(ScopeSchema.safeParse('project').success).toBe(true);
      expect(ScopeSchema.safeParse('org').success).toBe(true);
    });

    test('defaults to session', () => {
      const result = ScopeSchema.safeParse(undefined);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('session');
      }
    });

    test('rejects invalid scope', () => {
      const result = ScopeSchema.safeParse('global');
      expect(result.success).toBe(false);
    });
  });

  describe('FilePatternSchema', () => {
    test('accepts valid patterns', () => {
      expect(FilePatternSchema.safeParse('**/*.ts').success).toBe(true);
      expect(FilePatternSchema.safeParse('src/**/*.js').success).toBe(true);
    });

    test('accepts undefined', () => {
      expect(FilePatternSchema.safeParse(undefined).success).toBe(true);
    });
  });

  describe('BaseFilterSchema', () => {
    test('accepts complete filter', () => {
      const result = BaseFilterSchema.safeParse({
        severity: ['HIGH', 'MEDIUM'],
        category: ['security'],
        file_pattern: '**/*.ts',
        scope: 'project',
      });
      expect(result.success).toBe(true);
    });

    test('accepts partial filter with defaults', () => {
      const result = BaseFilterSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.scope).toBe('session');
      }
    });
  });

  describe('IdParamSchema', () => {
    test('accepts valid ID', () => {
      const result = IdParamSchema.safeParse({ id: 'problem-123' });
      expect(result.success).toBe(true);
    });

    test('rejects empty ID', () => {
      const result = IdParamSchema.safeParse({ id: '' });
      expect(result.success).toBe(false);
    });

    test('rejects missing ID', () => {
      const result = IdParamSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('Error Formatting', () => {
    test('formatZodError returns comma-separated errors', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const result = schema.safeParse({ name: 123, age: 'not a number' });
      expect(result.success).toBe(false);

      if (!result.success) {
        const formatted = formatZodError(result.error);
        expect(formatted).toContain('name');
        expect(formatted).toContain('age');
      }
    });

    test('formatZodErrorDetails returns structured errors', () => {
      const schema = z.object({
        email: z.string().email(),
      });

      const result = schema.safeParse({ email: 'invalid' });
      expect(result.success).toBe(false);

      if (!result.success) {
        const details = formatZodErrorDetails(result.error);
        expect(details.length).toBeGreaterThan(0);
        expect(details[0].path).toBe('email');
        expect(details[0].message).toBeDefined();
        expect(details[0].code).toBeDefined();
      }
    });

    test('createValidationError creates proper response', () => {
      const schema = z.object({
        id: z.string().min(5),
      });

      const result = schema.safeParse({ id: 'ab' });
      expect(result.success).toBe(false);

      if (!result.success) {
        const response = createValidationError(result.error);
        expect(response.error).toBe('Validation failed');
        expect(response.code).toBe('VALIDATION_ERROR');
        expect(response.details.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Validation Utilities', () => {
    test('safeParse returns success with data', () => {
      const schema = z.object({ name: z.string() });
      const result = safeParse(schema, { name: 'test' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('test');
      }
    });

    test('safeParse returns failure with error', () => {
      const schema = z.object({ name: z.string() });
      const result = safeParse(schema, { name: 123 });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(result.details).toBeDefined();
      }
    });

    test('validate returns data on success', () => {
      const schema = z.object({ id: z.number() });
      const data = validate(schema, { id: 42 });
      expect(data.id).toBe(42);
    });

    test('validate throws on failure', () => {
      const schema = z.object({ id: z.number() });
      expect(() => validate(schema, { id: 'not a number' })).toThrow();
    });
  });

  describe('Re-exported Zod', () => {
    test('z is available for custom schemas', () => {
      const customSchema = z.object({
        custom: z.string().min(1),
      });

      const result = customSchema.safeParse({ custom: 'value' });
      expect(result.success).toBe(true);
    });
  });
});
