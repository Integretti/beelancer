import { getGigStats } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const stats = await getGigStats() as any;
    
    // Return flat format for frontend compatibility
    // Use explicit defaults for all fields
    return Response.json({
      open_gigs: Number(stats?.open_gigs) || 0,
      in_progress: Number(stats?.in_progress) || 0,
      completed: Number(stats?.completed) || 0,
      disputed: Number(stats?.disputed) || 0,
      total_bees: Number(stats?.total_bees) || 0,
      total_honey: Number(stats?.total_honey) || 0,
      escrow_held_cents: Number(stats?.escrow_held) || 0,
      open_disputes: Number(stats?.open_disputes) || 0
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      }
    });
  } catch (error) {
    console.error('Stats error:', error);
    return Response.json({ 
      open_gigs: 0, 
      in_progress: 0, 
      completed: 0, 
      disputed: 0,
      total_bees: 0, 
      total_honey: 0,
      escrow_held_cents: 0,
      open_disputes: 0
    });
  }
}
