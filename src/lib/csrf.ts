import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';

const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const TOKEN_LENGTH = 32;

// Generate a new CSRF token
export function generateCsrfToken(): string {
  return crypto.randomBytes(TOKEN_LENGTH).toString('hex');
}

// Set CSRF token cookie (call on login/session creation)
export async function setCsrfCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // Must be readable by JS to send in header
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
  });
}

// Validate CSRF token for state-changing requests
export async function validateCsrf(request: NextRequest): Promise<{ valid: boolean; error?: string }> {
  // Skip CSRF check for:
  // 1. GET, HEAD, OPTIONS requests (safe methods)
  // 2. API key authenticated requests (bees) - not vulnerable to CSRF
  // 3. Requests with valid Origin header matching our domain
  
  const method = request.method.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return { valid: true };
  }

  // If request has API key auth, skip CSRF (bees are not vulnerable)
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ') || request.headers.get('x-api-key')) {
    return { valid: true };
  }

  // Origin validation (primary defense)
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  
  if (origin) {
    try {
      const originUrl = new URL(origin);
      const expectedHosts = [
        'localhost:3000',
        'beelancer.ai',
        'www.beelancer.ai',
        host, // Allow current host
      ].filter(Boolean);
      
      if (expectedHosts.some(h => originUrl.host === h)) {
        return { valid: true };
      }
    } catch {
      // Invalid origin URL
    }
    return { valid: false, error: 'Invalid request origin' };
  }

  // Referer validation (fallback for browsers that don't send Origin)
  const referer = request.headers.get('referer');
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      const expectedHosts = [
        'localhost:3000',
        'beelancer.ai',
        'www.beelancer.ai',
        host,
      ].filter(Boolean);
      
      if (expectedHosts.some(h => refererUrl.host === h)) {
        return { valid: true };
      }
    } catch {
      // Invalid referer URL
    }
    return { valid: false, error: 'Invalid request referer' };
  }

  // Double-submit cookie validation (last resort)
  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
  const headerToken = request.headers.get(CSRF_HEADER_NAME);

  if (!cookieToken || !headerToken) {
    return { valid: false, error: 'CSRF token missing' };
  }

  if (cookieToken !== headerToken) {
    return { valid: false, error: 'CSRF token mismatch' };
  }

  return { valid: true };
}

// Get or create CSRF token for client
export async function getOrCreateCsrfToken(): Promise<string> {
  const cookieStore = await cookies();
  let token = cookieStore.get(CSRF_COOKIE_NAME)?.value;
  
  if (!token) {
    token = generateCsrfToken();
    await setCsrfCookie(token);
  }
  
  return token;
}
