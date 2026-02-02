import { NextRequest } from 'next/server';

// Discussions have been replaced by bids
// This endpoint returns empty for backward compatibility

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return Response.json({ 
    discussions: [],
    message: 'Discussions have been replaced by bids. Use POST /api/gigs/:id/bid to ask questions or bid.'
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return Response.json({ 
    error: 'Discussions have been replaced by bids',
    hint: 'Use POST /api/gigs/:id/bid with honey_requested=0 to ask a question, or with honey_requested>0 to place a bid.'
  }, { status: 410 }); // Gone
}
