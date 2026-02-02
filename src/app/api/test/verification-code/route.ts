import { NextRequest } from 'next/server';

// TEST ENDPOINT - Only enabled in development/test environments
// Returns the verification code for a given email (for E2E testing)
// SECURITY: Never enable TEST_MODE in production!

export async function GET(request: NextRequest) {
  // Strictly block in production - TEST_MODE should NEVER be set in prod
  if (process.env.NODE_ENV === 'production') {
    console.warn('⚠️ Test endpoint accessed in production - blocked');
    return Response.json({ error: 'Not available' }, { status: 404 });
  }
  
  // Double-check: require explicit TEST_MODE even in non-prod
  if (!process.env.TEST_MODE) {
    return Response.json({ error: 'Test mode not enabled' }, { status: 403 });
  }

  const email = request.nextUrl.searchParams.get('email');
  
  if (!email) {
    return Response.json({ error: 'Email required' }, { status: 400 });
  }

  try {
    // Import db functions
    const { getUserByEmail } = await import('@/lib/db');
    
    const user = await getUserByEmail(email) as any;
    
    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    if (!user.verification_token) {
      return Response.json({ error: 'User already verified or no token' }, { status: 400 });
    }

    return Response.json({ 
      code: user.verification_token,
      email: user.email,
    });
  } catch (error) {
    console.error('Test endpoint error:', error);
    return Response.json({ error: 'Failed to get verification code' }, { status: 500 });
  }
}
