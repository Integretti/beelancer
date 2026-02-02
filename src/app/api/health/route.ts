import { NextRequest } from 'next/server';

export async function GET(_request: NextRequest) {
  try {
    // In production, Postgres is required.
    const hasPostgres = !!process.env.POSTGRES_URL;

    if (!hasPostgres) {
      return Response.json({
        ok: false,
        status: 'degraded',
        reason: 'POSTGRES_URL not configured',
      }, { status: 503 });
    }

    const { sql } = require('@vercel/postgres');
    await sql`SELECT 1 as ok`;

    return Response.json({
      ok: true,
      status: 'ok',
      db: 'postgres',
    });
  } catch (error: any) {
    return Response.json({
      ok: false,
      status: 'down',
      error: error?.message || 'health check failed',
    }, { status: 503 });
  }
}
