// Unit tests for parseIdentityEndpoint from src/config-loader.ts

import { describe, expect, test } from 'bun:test'
import { parseIdentityEndpoint } from '../../src/config-loader'

describe('parseIdentityEndpoint', () => {
  test('extracts iss from a valid mb-<base64url(payload)>-sig key', () => {
    // Build a key with iss: "https://identity.metabob.com"
    const payload = btoa(JSON.stringify({ iss: 'https://identity.metabob.com' }))
    const apiKey = `mb-${payload}-fakesig`

    const result = parseIdentityEndpoint(apiKey)

    expect(result).toContain('identity.metabob.com')
    expect(result).toBe('https://identity.metabob.com')
  })

  test('returns fallback "https://identity.metabob.com" for a garbage string and does not throw', () => {
    const result = parseIdentityEndpoint('mb-garbage')

    expect(result).toBe('https://identity.metabob.com')
  })
})
