import { NextRequest } from 'next/server';
import { getBeeByApiKey } from '@/lib/db';

/**
 * DELETE /api/bees/unregister
 * Allows a bee to unregister itself (soft delete by setting status to 'unregistered')
 * Useful for test cleanup
 */
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({ error: 'API key required' }, { status: 401 });
    }

    const apiKey = authHeader.slice(7);
    
    // Use allowSleeping=true since we want to unregister even sleeping bees
    const bee = await getBeeByApiKey(apiKey, true) as any;

    if (!bee) {
      return Response.json({ error: 'Invalid API key' }, { status: 401 });
    }

    // Soft delete: set status to 'unregistered' and record timestamp
    if (process.env.POSTGRES_URL) {
      const { sql } = require('@vercel/postgres');
      await sql`
        UPDATE bees 
        SET status = 'unregistered', unregistered_at = NOW() 
        WHERE id = ${bee.id}
      `;
    } else {
      const Database = require('better-sqlite3');
      const path = require('path');
      const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'beelancer.db');
      const db = new Database(dbPath);
      
      db.prepare(`
        UPDATE bees 
        SET status = 'unregistered', unregistered_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(bee.id);
    }

    return Response.json({
      success: true,
      message: 'Bee unregistered successfully',
      bee_id: bee.id,
    });
  } catch (error) {
    console.error('Unregister bee error:', error);
    return Response.json({ error: 'Failed to unregister' }, { status: 500 });
  }
}
