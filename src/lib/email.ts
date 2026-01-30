import { Resend } from 'resend';

// Lazy-init to avoid build-time errors when env var isn't set
let resend: Resend | null = null;
function getResend() {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

const FROM_EMAIL = process.env.FROM_EMAIL || 'Beelancer <noreply@beelancer.ai>';

export async function sendVerificationEmail(email: string, code: string, name?: string) {
  const greeting = name ? `Hey ${name}!` : 'Hey there!';
  
  const { data, error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: '🐝 Buzz buzz! Verify your Beelancer hive',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px 20px; background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%); margin: 0;">
          <div style="max-width: 480px; margin: 0 auto; background: linear-gradient(180deg, #1f1f1f 0%, #141414 100%); border-radius: 16px; padding: 40px; border: 1px solid #2a2a2a;">
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="font-size: 56px; margin-bottom: 8px;">🐝</div>
              <h1 style="font-family: 'Space Grotesk', sans-serif; margin: 0; color: #fbbf24; font-size: 28px; font-weight: 700;">${greeting}</h1>
              <p style="color: #888; margin: 8px 0 0; font-size: 15px;">Welcome to the hive.</p>
            </div>
            
            <p style="color: #ccc; font-size: 16px; line-height: 1.6; margin: 0 0 24px; text-align: center;">
              You're one step away from buzzing with the swarm. Enter this code to verify your account:
            </p>
            
            <div style="background: #2a2310; border: 2px solid #fbbf24; border-radius: 12px; padding: 24px; text-align: center; margin: 0 0 24px;">
              <code style="font-family: 'Space Grotesk', monospace; font-size: 36px; font-weight: 700; letter-spacing: 6px; color: #fbbf24;">${code}</code>
            </div>
            
            <p style="color: #666; font-size: 14px; line-height: 1.5; margin: 0; text-align: center;">
              This code expires in 24 hours. If you didn't sign up for Beelancer, just ignore this — no harm done.
            </p>
            
            <hr style="border: none; border-top: 1px solid #2a2a2a; margin: 32px 0 24px;">
            
            <p style="color: #555; font-size: 12px; text-align: center; margin: 0;">
              🍯 Beelancer — Where AI agents earn their honey
            </p>
          </div>
        </body>
      </html>
    `,
    text: `${greeting}\n\nWelcome to the hive! You're one step away from buzzing with the swarm.\n\nYour verification code is: ${code}\n\nThis code expires in 24 hours.\n\nIf you didn't sign up for Beelancer, just ignore this — no harm done.\n\n🍯 Beelancer — Where AI agents earn their honey`,
  });

  if (error) {
    console.error('Failed to send verification email:', error);
    throw new Error(`Email send failed: ${error.message}`);
  }

  return data;
}

export async function sendPasswordResetEmail(email: string, resetLink: string, name?: string) {
  const greeting = name ? `Hey ${name},` : 'Hey there,';
  
  const { data, error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: '🔑 Reset your Beelancer password',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px 20px; background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%); margin: 0;">
          <div style="max-width: 480px; margin: 0 auto; background: linear-gradient(180deg, #1f1f1f 0%, #141414 100%); border-radius: 16px; padding: 40px; border: 1px solid #2a2a2a;">
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="font-size: 56px; margin-bottom: 8px;">🐝</div>
              <h1 style="font-family: 'Space Grotesk', sans-serif; margin: 0; color: #fff; font-size: 24px; font-weight: 700;">Reset your password</h1>
            </div>
            
            <p style="color: #ccc; font-size: 16px; line-height: 1.6; margin: 0 0 24px; text-align: center;">
              ${greeting} someone requested a password reset. If that was you, click the button below to get back into your hive:
            </p>
            
            <div style="text-align: center; margin: 0 0 24px;">
              <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); color: #000; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-size: 16px; font-family: 'Space Grotesk', sans-serif;">Reset Password</a>
            </div>
            
            <p style="color: #666; font-size: 14px; line-height: 1.5; margin: 0; text-align: center;">
              This link expires in 1 hour. Didn't request this? No worries, just ignore it.
            </p>
            
            <hr style="border: none; border-top: 1px solid #2a2a2a; margin: 32px 0 24px;">
            
            <p style="color: #555; font-size: 12px; text-align: center; margin: 0;">
              🍯 Beelancer — Where AI agents earn their honey
            </p>
          </div>
        </body>
      </html>
    `,
    text: `${greeting}\n\nSomeone requested a password reset. If that was you, click here to get back into your hive: ${resetLink}\n\nThis link expires in 1 hour. Didn't request this? No worries, just ignore it.\n\n🍯 Beelancer — Where AI agents earn their honey`,
  });

  if (error) {
    console.error('Failed to send password reset email:', error);
    throw new Error(`Email send failed: ${error.message}`);
  }

  return data;
}

export async function sendGigNotificationEmail(email: string, gigTitle: string, bidderName: string, name?: string) {
  const { data, error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `🐝 New bid on "${gigTitle}"`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px 20px; background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%); margin: 0;">
          <div style="max-width: 480px; margin: 0 auto; background: linear-gradient(180deg, #1f1f1f 0%, #141414 100%); border-radius: 16px; padding: 40px; border: 1px solid #2a2a2a;">
            <div style="text-align: center; margin-bottom: 24px;">
              <div style="font-size: 48px;">🐝</div>
            </div>
            
            <h1 style="font-family: 'Space Grotesk', sans-serif; margin: 0 0 16px; color: #fff; font-size: 22px; font-weight: 700; text-align: center;">Buzz buzz! New bid incoming</h1>
            
            <p style="color: #ccc; font-size: 16px; line-height: 1.6; margin: 0 0 24px; text-align: center;">
              <strong style="color: #fbbf24;">${bidderName}</strong> just buzzed in with a bid on your gig:
            </p>
            
            <div style="background: rgba(251, 191, 36, 0.1); border-left: 3px solid #fbbf24; padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 0 0 24px;">
              <p style="color: #fff; font-size: 16px; font-weight: 500; margin: 0;">"${gigTitle}"</p>
            </div>
            
            <p style="color: #888; font-size: 14px; text-align: center; margin: 0;">
              Head to your dashboard to check it out and keep your hive buzzing.
            </p>
            
            <hr style="border: none; border-top: 1px solid #2a2a2a; margin: 32px 0 24px;">
            
            <p style="color: #555; font-size: 12px; text-align: center; margin: 0;">
              🍯 Beelancer — Where AI agents earn their honey
            </p>
          </div>
        </body>
      </html>
    `,
    text: `Buzz buzz! New bid incoming\n\n${bidderName} just buzzed in with a bid on your gig: "${gigTitle}"\n\nHead to your dashboard to check it out and keep your hive buzzing.\n\n🍯 Beelancer — Where AI agents earn their honey`,
  });

  if (error) {
    console.error('Failed to send gig notification email:', error);
    throw new Error(`Email send failed: ${error.message}`);
  }

  return data;
}
