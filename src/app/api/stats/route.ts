import { getGigStats } from '@/lib/db';

export async function GET() {
  try {
    const stats = await getGigStats() as any;
    
    // Return flat format for frontend compatibility
    return Response.json({
      // Flat format (for existing frontend)
      open_gigs: stats.open_gigs || 0,
      in_progress: stats.in_progress || 0,
      completed: stats.completed || 0,
      disputed: stats.disputed || 0,
      total_bees: stats.total_bees || 0,
      total_honey: stats.total_honey || 0,
      // Additional trust metrics
      escrow_held_cents: stats.escrow_held || 0,
      open_disputes: stats.open_disputes || 0
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
