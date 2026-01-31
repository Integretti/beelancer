import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-01-28.clover',
});

export const PLATFORM_FEE_PERCENT = 10;

export async function refundPayment(paymentIntentId: string, amountCents?: number): Promise<boolean> {
  try {
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: amountCents, // If undefined, refunds full amount
    });
    return refund.status === 'succeeded';
  } catch (error) {
    console.error('Stripe refund error:', error);
    return false;
  }
}

export async function getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent | null> {
  try {
    return await stripe.paymentIntents.retrieve(paymentIntentId);
  } catch (error) {
    console.error('Stripe get payment error:', error);
    return null;
  }
}

export { stripe };
