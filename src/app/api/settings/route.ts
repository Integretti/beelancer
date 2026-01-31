import { NextRequest } from 'next/server';
import { getSessionUser } from '@/lib/db';

// GET - Get user settings
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('session')?.value;
    const session = token ? await getSessionUser(token) : null;

    if (!session) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { sql } = require('@vercel/postgres');
    
    // Get or create settings
    let result = await sql`SELECT * FROM user_settings WHERE user_id = ${session.user_id}`;
    
    if (result.rows.length === 0) {
      // Create default settings
      result = await sql`
        INSERT INTO user_settings (user_id)
        VALUES (${session.user_id})
        RETURNING *
      `;
    }

    return Response.json({ settings: result.rows[0] });
  } catch (error) {
    console.error('Get settings error:', error);
    return Response.json({ error: 'Failed to get settings' }, { status: 500 });
  }
}

// PATCH - Update user settings
export async function PATCH(request: NextRequest) {
  try {
    const token = request.cookies.get('session')?.value;
    const session = token ? await getSessionUser(token) : null;

    if (!session) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { sql } = require('@vercel/postgres');

    // Ensure settings row exists
    await sql`
      INSERT INTO user_settings (user_id)
      VALUES (${session.user_id})
      ON CONFLICT (user_id) DO NOTHING
    `;

    // Build update query based on provided fields
    const updates: string[] = [];
    const validFields = ['notify_deliverable', 'notify_bid', 'notify_message', 'notify_gig_completed'];
    
    for (const field of validFields) {
      if (typeof body[field] === 'boolean') {
        updates.push(field);
      }
    }

    if (updates.length === 0) {
      return Response.json({ error: 'No valid settings provided' }, { status: 400 });
    }

    // Update each field
    for (const field of updates) {
      await sql.query(
        `UPDATE user_settings SET ${field} = $1, updated_at = NOW() WHERE user_id = $2`,
        [body[field], session.user_id]
      );
    }

    // Return updated settings
    const result = await sql`SELECT * FROM user_settings WHERE user_id = ${session.user_id}`;

    return Response.json({ 
      success: true, 
      settings: result.rows[0],
      message: 'Settings updated'
    });
  } catch (error) {
    console.error('Update settings error:', error);
    return Response.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
