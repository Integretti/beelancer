import { NextRequest } from 'next/server';
import { addQuestQuote, getSessionUser, getBeeById, getBeeByApiKey } from '@/lib/db';
import { cookies } from 'next/headers';

// POST - Add a client testimonial for a bee
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: beeId } = await params;
    
    // Verify bee exists
    const bee = await getBeeById(beeId) as any;
    if (!bee) {
      return Response.json({ error: 'Bee not found' }, { status: 404 });
    }
    
    // Check for human auth (cookie) or bee auth (API key)
    const authHeader = request.headers.get('authorization');
    let authorUserId: string | undefined;
    let authorBeeId: string | undefined;
    let authorName: string;
    
    if (authHeader?.startsWith('Bearer ')) {
      // Another bee giving a testimonial
      const apiKey = authHeader.slice(7);
      const authorBee = await getBeeByApiKey(apiKey) as any;
      if (!authorBee) {
        return Response.json({ error: 'Invalid API key' }, { status: 401 });
      }
      if (authorBee.id === beeId) {
        return Response.json({ error: 'Cannot write testimonial for yourself' }, { status: 400 });
      }
      authorBeeId = authorBee.id;
      authorName = authorBee.name;
    } else {
      // Human giving a testimonial
      const cookieStore = await cookies();
      const token = cookieStore.get('session')?.value;
      
      if (!token) {
        return Response.json({ error: 'Authentication required (login or API key)' }, { status: 401 });
      }
      
      const user = await getSessionUser(token) as any;
      if (!user) {
        return Response.json({ error: 'Invalid session' }, { status: 401 });
      }
      authorUserId = user.id;
      authorName = user.name;
    }
    
    const body = await request.json();
    const { quote_text, gig_id, gig_title } = body;

    if (!quote_text || quote_text.length < 10) {
      return Response.json({ 
        error: 'quote_text required (min 10 characters)',
        example: {
          quote_text: 'Outstanding work! Delivered ahead of schedule and exceeded expectations. Will definitely hire again.',
          gig_id: 'optional-gig-id',
          gig_title: 'Optional Quest Title'
        }
      }, { status: 400 });
    }

    const result = await addQuestQuote(
      beeId,
      'client_testimonial',
      quote_text,
      gig_id,
      gig_title,
      authorBeeId,
      authorUserId,
      authorName
    );

    return Response.json({
      success: true,
      message: '⭐ Testimonial added! This helps the bee attract more work.',
      quote: {
        id: result.id,
        quote_text,
        gig_title,
        type: 'client_testimonial',
        author: authorName
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Add testimonial error:', error);
    return Response.json({ error: 'Failed to add testimonial' }, { status: 500 });
  }
}
