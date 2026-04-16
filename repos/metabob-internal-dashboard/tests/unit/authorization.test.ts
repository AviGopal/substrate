/**
 * Unit tests for authorization module
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import {
  getUserRole,
  isAdmin,
  requireAdmin,
  isAdminAction,
  authorizeQuery
} from '../../src/lib/authorization'

describe('Authorization', () => {
  const originalEnv = process.env.ADMIN_EMAILS

  beforeEach(() => {
    // Set up test admin emails
    process.env.ADMIN_EMAILS = 'admin@test.com,super@test.com'
  })

  afterEach(() => {
    // Restore original env
    process.env.ADMIN_EMAILS = originalEnv
  })

  describe('getUserRole', () => {
    it('should return admin for users in ADMIN_EMAILS', () => {
      expect(getUserRole('admin@test.com')).toBe('admin')
      expect(getUserRole('super@test.com')).toBe('admin')
    })

    it('should be case insensitive', () => {
      expect(getUserRole('ADMIN@TEST.COM')).toBe('admin')
      expect(getUserRole('Admin@Test.Com')).toBe('admin')
    })

    it('should trim whitespace', () => {
      expect(getUserRole('  admin@test.com  ')).toBe('admin')
    })

    it('should return viewer for non-admin users', () => {
      expect(getUserRole('user@test.com')).toBe('viewer')
      expect(getUserRole('random@example.com')).toBe('viewer')
    })

    it('should return viewer when ADMIN_EMAILS is empty', () => {
      process.env.ADMIN_EMAILS = ''
      expect(getUserRole('anyone@test.com')).toBe('viewer')
    })
  })

  describe('isAdmin', () => {
    it('should return true for admin users', () => {
      expect(isAdmin('admin@test.com')).toBe(true)
    })

    it('should return false for non-admin users', () => {
      expect(isAdmin('user@test.com')).toBe(false)
    })
  })

  describe('requireAdmin', () => {
    it('should not throw for admin users', () => {
      expect(() => {
        requireAdmin('admin@test.com', 'test action')
      }).not.toThrow()
    })

    it('should throw for non-admin users', () => {
      expect(() => {
        requireAdmin('user@test.com', 'test action')
      }).toThrow('Unauthorized')
    })

    it('should include action in error message', () => {
      try {
        requireAdmin('user@test.com', 'delete database')
      } catch (error: any) {
        expect(error.message).toContain('delete database')
        expect(error.message).toContain('user@test.com')
      }
    })
  })

  describe('isAdminAction', () => {
    it('should identify DELETE as admin action', () => {
      expect(isAdminAction('DELETE FROM table')).toBe(true)
      expect(isAdminAction('delete from table')).toBe(true)
    })

    it('should identify UPDATE as admin action', () => {
      expect(isAdminAction('UPDATE table SET field = value')).toBe(true)
      expect(isAdminAction('update table set field = value')).toBe(true)
    })

    it('should identify CREATE as admin action', () => {
      expect(isAdminAction('CREATE TABLE test')).toBe(true)
      expect(isAdminAction('create table test')).toBe(true)
    })

    it('should NOT identify CREATE...AS SELECT as admin action', () => {
      expect(isAdminAction('CREATE VIEW test AS SELECT * FROM table')).toBe(false)
    })

    it('should identify DROP as admin action', () => {
      expect(isAdminAction('DROP TABLE test')).toBe(true)
    })

    it('should identify TRUNCATE as admin action', () => {
      expect(isAdminAction('TRUNCATE TABLE test')).toBe(true)
    })

    it('should identify ALTER as admin action', () => {
      expect(isAdminAction('ALTER TABLE test ADD COLUMN')).toBe(true)
    })

    it('should NOT identify SELECT as admin action', () => {
      expect(isAdminAction('SELECT * FROM table')).toBe(false)
    })

    it('should NOT identify SHOW as admin action', () => {
      expect(isAdminAction('SHOW TABLES')).toBe(false)
    })
  })

  describe('authorizeQuery', () => {
    it('should allow SELECT queries for any user', () => {
      expect(() => {
        authorizeQuery('user@test.com', 'SELECT * FROM table')
      }).not.toThrow()
    })

    it('should allow admin queries for admin users', () => {
      expect(() => {
        authorizeQuery('admin@test.com', 'DELETE FROM table')
      }).not.toThrow()
    })

    it('should deny admin queries for non-admin users', () => {
      expect(() => {
        authorizeQuery('user@test.com', 'DELETE FROM table')
      }).toThrow('Unauthorized')
    })

    it('should return true for authorized queries', () => {
      expect(authorizeQuery('admin@test.com', 'DELETE FROM table')).toBe(true)
      expect(authorizeQuery('user@test.com', 'SELECT * FROM table')).toBe(true)
    })
  })
})
