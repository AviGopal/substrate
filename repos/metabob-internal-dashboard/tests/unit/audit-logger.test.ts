/**
 * Unit tests for audit logger
 */

import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test'
import type { AuditEvent } from '../../src/lib/audit-logger'
import { logAudit, audit } from '../../src/lib/audit-logger'

describe('Audit Logger', () => {
  let consoleLogSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
  })

  describe('logAudit', () => {
    it('should log audit event to console in JSON format', () => {
      const event: AuditEvent = {
        timestamp: '2026-04-10T12:00:00.000Z',
        user: 'test@example.com',
        action: 'test_action',
        resource: 'test_resource',
        success: true
      }

      logAudit(event)

      expect(consoleLogSpy).toHaveBeenCalledTimes(1)
      const logCall = consoleLogSpy.mock.calls[0][0]
      const parsed = JSON.parse(logCall)

      expect(parsed.type).toBe('audit')
      expect(parsed.service).toBe('metabob-internal-dashboard')
      expect(parsed.user).toBe('test@example.com')
      expect(parsed.action).toBe('test_action')
      expect(parsed.resource).toBe('test_resource')
      expect(parsed.success).toBe(true)
    })

    it('should include metadata if provided', () => {
      const event: AuditEvent = {
        timestamp: '2026-04-10T12:00:00.000Z',
        user: 'test@example.com',
        action: 'test_action',
        resource: 'test_resource',
        success: true,
        metadata: { foo: 'bar', count: 42 }
      }

      logAudit(event)

      const logCall = consoleLogSpy.mock.calls[0][0]
      const parsed = JSON.parse(logCall)

      expect(parsed.metadata).toEqual({ foo: 'bar', count: 42 })
    })

    it('should include error if provided', () => {
      const event: AuditEvent = {
        timestamp: '2026-04-10T12:00:00.000Z',
        user: 'test@example.com',
        action: 'test_action',
        resource: 'test_resource',
        success: false,
        error: 'Something went wrong'
      }

      logAudit(event)

      const logCall = consoleLogSpy.mock.calls[0][0]
      const parsed = JSON.parse(logCall)

      expect(parsed.success).toBe(false)
      expect(parsed.error).toBe('Something went wrong')
    })
  })

  describe('audit', () => {
    it('should create and log audit event', () => {
      audit('user@test.com', 'query_execute', 'dashboard', true)

      expect(consoleLogSpy).toHaveBeenCalledTimes(1)
      const logCall = consoleLogSpy.mock.calls[0][0]
      const parsed = JSON.parse(logCall)

      expect(parsed.user).toBe('user@test.com')
      expect(parsed.action).toBe('query_execute')
      expect(parsed.resource).toBe('dashboard')
      expect(parsed.success).toBe(true)
      expect(parsed.timestamp).toBeDefined()
    })

    it('should include metadata and error', () => {
      audit(
        'admin@test.com',
        'delete_action',
        'resource',
        false,
        { itemId: '123' },
        'Permission denied'
      )

      const logCall = consoleLogSpy.mock.calls[0][0]
      const parsed = JSON.parse(logCall)

      expect(parsed.metadata).toEqual({ itemId: '123' })
      expect(parsed.error).toBe('Permission denied')
      expect(parsed.success).toBe(false)
    })

    it('should generate ISO timestamp', () => {
      const beforeTime = new Date().toISOString()
      audit('user@test.com', 'test', 'resource', true)
      const afterTime = new Date().toISOString()

      const logCall = consoleLogSpy.mock.calls[0][0]
      const parsed = JSON.parse(logCall)

      expect(parsed.timestamp).toBeDefined()
      expect(parsed.timestamp >= beforeTime).toBe(true)
      expect(parsed.timestamp <= afterTime).toBe(true)
    })
  })
})
