import { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { createGig, createEscrow } from '@/lib/db';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-01-28.clover',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return Response.json({ error: 'No signature' }, { status: 400 });
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return Response.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // Handle the checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      
      // Extract gig details from metadata
      const metadata = session.metadata || {};
      const {
        pending_gig_id,
        user_id,
        title,
        description,
        requirements,
        price_cents,
        category,
        deadline,
      } = metadata;

      if (!user_id || !title || !price_cents) {
        console.error('Missing required metadata:', metadata);
        return Response.json({ error: 'Missing metadata' }, { status: 400 });
      }

      // Create the gig
      const gig = await createGig(user_id, {
        title,
        description: description || undefined,
        requirements: requirements || undefined,
        price_cents: parseInt(price_cents),
        category: category || undefined,
        deadline: deadline || undefined,
      });

      // Create escrow record with Stripe payment ID
      await createEscrowWithStripe(
        gig.id, 
        user_id, 
        parseInt(price_cents),
        session.payment_intent as string
      );

      // Update gig status to open (payment confirmed)
      await updateGigStatus(gig.id, user_id, 'open');

      console.log('Gig created after payment:', gig.id, 'Payment:', session.payment_intent);

      return Response.json({ 
        received: true, 
        gig_id: gig.id,
        payment_intent: session.payment_intent 
      });
    }

    // Handle refund events
    if (event.type === 'charge.refunded') {
      const charge = event.data.object as Stripe.Charge;
      console.log('Refund processed:', charge.id);
      // TODO: Update escrow status to refunded
    }

    return Response.json({ received: true });

  } catch (error: any) {
    console.error('Webhook error:', error);
    return Response.json({ error: 'Webhook failed' }, { status: 500 });
  }
}

// Helper to create escrow with Stripe payment reference
async function createEscrowWithStripe(gigId: string, userId: string, amountCents: number, paymentIntent: string) {
  const { v4: uuidv4 } = require('uuid');
  const id = uuidv4();

  // Check if we're using Postgres or SQLite
  if (process.env.POSTGRES_URL) {
    const { sql } = require('@vercel/postgres');
    await sql`
      INSERT INTO escrow (id, gig_id, user_id, amount_cents, status, note)
      VALUES (${id}, ${gigId}, ${userId}, ${amountCents}, 'held', ${`stripe:${paymentIntent}`})
    `;
  } else {
    const Database = require('better-sqlite3');
    const path = require('path');
    const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'beelancer.db');
    const db = new Database(dbPath);
    db.prepare(`
      INSERT INTO escrow (id, gig_id, user_id, amount_cents, status, note)
      VALUES (?, ?, ?, ?, 'held', ?)
    `).run(id, gigId, userId, amountCents, `stripe:${paymentIntent}`);
  }

  return { id };
}

// Helper to update gig status
async function updateGigStatus(gigId: string, userId: string, status: string) {
  if (process.env.POSTGRES_URL) {
    const { sql } = require('@vercel/postgres');
    await sql`UPDATE gigs SET status = ${status}, updated_at = NOW() WHERE id = ${gigId}`;
  } else {
    const Database = require('better-sqlite3');
    const path = require('path');
    const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'beelancer.db');
    const db = new Database(dbPath);
    db.prepare(`UPDATE gigs SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(status, gigId);
  }
}
