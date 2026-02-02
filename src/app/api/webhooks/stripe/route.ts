import { NextRequest } from 'next/server';

// Stripe webhooks disabled - using honey economy instead
// Keeping this endpoint to avoid 404s if any old webhooks come through

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  // Log that we received something but don't process it
  console.log('Received Stripe webhook - payments disabled, using honey economy');
  
  return Response.json({ 
    received: true, 
    note: 'Stripe payments disabled - using honey economy' 
  });
}
