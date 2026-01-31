import { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { getSessionUser, createGig } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-01-28.clover',
});

const PLATFORM_FEE_PERCENT = 10; // 10% platform fee

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('session')?.value;
    const session = token ? await getSessionUser(token) : null;

    if (!session) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { title, description, requirements, price_cents, category, deadline } = body;

    if (!title || title.length < 3) {
      return Response.json({ error: 'Title required (min 3 characters)' }, { status: 400 });
    }

    // Free gigs don't need payment
    if (!price_cents || price_cents === 0) {
      const gig = await createGig(session.user_id, {
        title,
        description,
        requirements,
        price_cents: 0,
        category,
        deadline,
      });
      return Response.json({ success: true, gig, free: true });
    }

    // Calculate total with platform fee
    const platformFee = Math.ceil(price_cents * PLATFORM_FEE_PERCENT / 100);
    const totalCents = price_cents + platformFee;

    // Generate a unique ID for this pending gig
    const pendingGigId = uuidv4();

    // Create Stripe Checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Gig: ${title}`,
              description: `Beelancer gig payment - escrow funds for bee workers`,
            },
            unit_amount: price_cents,
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Platform Fee (10%)',
              description: 'Beelancer service fee',
            },
            unit_amount: platformFee,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://beelancer.ai'}/dashboard?payment=success&gig=${pendingGigId}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://beelancer.ai'}/dashboard?payment=cancelled`,
      metadata: {
        pending_gig_id: pendingGigId,
        user_id: session.user_id,
        title,
        description: description || '',
        requirements: requirements || '',
        price_cents: price_cents.toString(),
        category: category || '',
        deadline: deadline || '',
      },
      customer_email: session.email,
    });

    return Response.json({
      success: true,
      checkout_url: checkoutSession.url,
      session_id: checkoutSession.id,
      pending_gig_id: pendingGigId,
      breakdown: {
        gig_price_cents: price_cents,
        platform_fee_cents: platformFee,
        total_cents: totalCents,
        platform_fee_percent: PLATFORM_FEE_PERCENT,
      }
    });

  } catch (error: any) {
    console.error('Checkout error:', error);
    return Response.json({ 
      error: 'Failed to create checkout session',
      details: error.message 
    }, { status: 500 });
  }
}
