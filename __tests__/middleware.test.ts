import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from '../middleware'

describe('Security Middleware', () => {
  describe('CSRF Protection', () => {
    it('allows GET requests without origin', async () => {
      const request = new NextRequest('http://localhost:3000/api/gigs')
      const response = middleware(request)
      expect(response.status).not.toBe(403)
    })

    it('allows API key authenticated requests', async () => {
      const request = new NextRequest('http://localhost:3000/api/gigs', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test_api_key' }
      })
      const response = middleware(request)
      expect(response.status).not.toBe(403)
    })

    it('allows requests with valid origin', async () => {
      const request = new NextRequest('http://localhost:3000/api/gigs', {
        method: 'POST',
        headers: { 'Origin': 'http://localhost:3000' }
      })
      const response = middleware(request)
      expect(response.status).not.toBe(403)
    })

    it('blocks requests with invalid origin', async () => {
      const request = new NextRequest('http://localhost:3000/api/gigs/123/messages', {
        method: 'POST',
        headers: { 
          'Origin': 'http://evil.com',
          'Cookie': 'session=test'
        }
      })
      const response = middleware(request)
      expect(response.status).toBe(403)
    })
  })

  it('sets X-Frame-Options header', async () => {
    const request = new NextRequest('http://localhost:3000/')
    const response = middleware(request)
    expect(response.headers.get('X-Frame-Options')).toBe('DENY')
  })

  it('sets X-Content-Type-Options header', async () => {
    const request = new NextRequest('http://localhost:3000/')
    const response = middleware(request)
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
  })

  it('sets Referrer-Policy header', async () => {
    const request = new NextRequest('http://localhost:3000/')
    const response = middleware(request)
    expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
  })

  it('sets X-XSS-Protection header', async () => {
    const request = new NextRequest('http://localhost:3000/')
    const response = middleware(request)
    expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block')
  })

  it('sets Permissions-Policy header', async () => {
    const request = new NextRequest('http://localhost:3000/')
    const response = middleware(request)
    const policy = response.headers.get('Permissions-Policy')
    expect(policy).toContain('camera=()')
    expect(policy).toContain('microphone=()')
    expect(policy).toContain('geolocation=()')
  })

  it('sets Content-Security-Policy header', async () => {
    const request = new NextRequest('http://localhost:3000/')
    const response = middleware(request)
    const csp = response.headers.get('Content-Security-Policy')
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("frame-ancestors 'none'")
  })

  it('applies to API routes', async () => {
    const request = new NextRequest('http://localhost:3000/api/gigs')
    const response = middleware(request)
    expect(response.headers.get('X-Frame-Options')).toBe('DENY')
  })
})
