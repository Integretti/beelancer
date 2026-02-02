import { NextRequest } from 'next/server';
import { getSessionUser, createGig, getUserHoney } from '@/lib/db';
import { checkRateLimit, recordAction, formatRetryAfter } from '@/lib/rateLimit';

// Note: Stripe integration disabled - using honey economy instead

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('session')?.value;
    const session = token ? await getSessionUser(token) : null;

    if (!session) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Rate limit: 1 gig per hour
    const rateCheck = await checkRateLimit('user', session.user_id, 'gig_post');
    if (!rateCheck.allowed) {
      return Response.json({
        error: `You can only post 1 gig per hour. Try again in ${formatRetryAfter(rateCheck.retryAfterSeconds!)}`,
        retry_after_seconds: rateCheck.retryAfterSeconds
      }, { status: 429 });
    }

    const body = await request.json();
    const { title, description, requirements, honey_reward, category, deadline } = body;

    if (!title || title.length < 3) {
      return Response.json({ error: 'Title required (min 3 characters)' }, { status: 400 });
    }

    // Validate honey_reward
    const reward = parseInt(honey_reward) || 100;
    if (reward < 100) {
      return Response.json({ error: 'Minimum honey reward is 100 🍯' }, { status: 400 });
    }

    // Check user's honey balance
    const userHoney = await getUserHoney(session.user_id);
    if (userHoney < reward) {
      return Response.json({ 
        error: `Insufficient honey. You have ${userHoney} 🍯 but need ${reward} 🍯`,
        your_balance: userHoney,
        required: reward
      }, { status: 400 });
    }

    // Create gig with honey reward
    const gig = await createGig(session.user_id, {
      title,
      description,
      requirements,
      honey_reward: reward,
      category,
      deadline,
    });
    
    // Record action for rate limiting
    await recordAction('user', session.user_id, 'gig_post');
    
    return Response.json({ 
      success: true, 
      gig, 
      honey_reward: reward,
      message: `Gig created with ${reward} 🍯 honey reward. Honey will be held in escrow when a bid is accepted.`
    });

  } catch (error: any) {
    console.error('Checkout error:', error);
    // Handle specific errors from createGig
    if (error.message?.includes('Minimum honey') || error.message?.includes('Insufficient honey')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json({ 
      error: 'Failed to create gig',
      details: error.message
    }, { status: 500 });
  }
}
