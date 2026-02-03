import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// CSRF validation for state-changing requests
function validateCsrfInMiddleware(request: NextRequest): { valid: boolean; error?: string } {
  const method = request.method.toUpperCase();
  
  // Safe methods don't need CSRF protection
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return { valid: true };
  }

  // API key auth (bees) is not vulnerable to CSRF
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ') || request.headers.get('x-api-key')) {
    return { valid: true };
  }

  // Check if this is an API route that needs CSRF protection
  const pathname = request.nextUrl.pathname;
  if (!pathname.startsWith('/api/')) {
    return { valid: true };
  }

  // Skip CSRF for auth endpoints (login/signup need to work without prior session)
  if (pathname.startsWith('/api/auth/')) {
    return { valid: true };
  }

  // Origin validation
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  
  if (origin) {
    try {
      const originUrl = new URL(origin);
      const validHosts = ['localhost:3000', 'localhost', 'beelancer.ai', 'www.beelancer.ai'];
      if (host) validHosts.push(host.split(':')[0]);
      
      if (validHosts.some(h => originUrl.hostname === h || originUrl.host === h)) {
        return { valid: true };
      }
    } catch {
      // Invalid origin
    }
    return { valid: false, error: 'Invalid request origin' };
  }

  // Referer validation (fallback)
  const referer = request.headers.get('referer');
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      const validHosts = ['localhost:3000', 'localhost', 'beelancer.ai', 'www.beelancer.ai'];
      if (host) validHosts.push(host.split(':')[0]);
      
      if (validHosts.some(h => refererUrl.hostname === h || refererUrl.host === h)) {
        return { valid: true };
      }
    } catch {
      // Invalid referer
    }
    return { valid: false, error: 'Invalid request referer' };
  }

  // No origin or referer on state-changing request from browser = suspicious
  // But allow for non-browser clients (curl, etc) that might not send these
  // Check for session cookie - if present, this is likely a browser
  const hasSessionCookie = request.cookies.has('session');
  if (hasSessionCookie) {
    return { valid: false, error: 'CSRF validation failed' };
  }

  return { valid: true };
}

export function middleware(request: NextRequest) {
  // CSRF validation temporarily disabled for debugging
  // TODO: Re-enable after fixing accept bid issue
  // const csrfResult = validateCsrfInMiddleware(request);
  // if (!csrfResult.valid) {
  //   return NextResponse.json(
  //     { error: csrfResult.error || 'CSRF validation failed' },
  //     { status: 403 }
  //   );
  // }

  const response = NextResponse.next()

  // Security headers
  const headers = response.headers

  // Prevent clickjacking
  headers.set('X-Frame-Options', 'DENY')

  // Prevent MIME type sniffing
  headers.set('X-Content-Type-Options', 'nosniff')

  // Control referrer information
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // Legacy XSS protection (for older browsers)
  headers.set('X-XSS-Protection', '1; mode=block')

  // Restrict browser features
  headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  )

  // Strict Transport Security (HTTPS only in production)
  if (process.env.NODE_ENV === 'production') {
    headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains'
    )
  }

  // Content Security Policy
  // Starting permissive, can tighten later
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js needs these
    "style-src 'self' 'unsafe-inline'", // For inline styles
    "img-src 'self' data: https: blob:", // Allow images from HTTPS sources
    "font-src 'self' data:",
    "connect-src 'self' https:", // API calls
    "frame-ancestors 'none'", // Reinforces X-Frame-Options
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')

  headers.set('Content-Security-Policy', csp)

  return response
}

// Run middleware on all routes except static files and images
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
