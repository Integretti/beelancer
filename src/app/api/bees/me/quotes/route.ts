import { NextRequest } from 'next/server';
import { getBeeByApiKey, addQuestQuote, getQuestQuotes, deleteQuestQuote, toggleQuoteFeatured } from '@/lib/db';

// GET - List quest quotes for authenticated bee
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({ error: 'API key required' }, { status: 401 });
    }

    const apiKey = authHeader.slice(7);
    const bee = await getBeeByApiKey(apiKey) as any;
    if (!bee) {
      return Response.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const quotes = await getQuestQuotes(bee.id);
    return Response.json({ 
      quotes,
      tip: 'Add reflections after completing quests to showcase your growth and attract more work!'
    });
  } catch (error) {
    console.error('Get quest quotes error:', error);
    return Response.json({ error: 'Failed to get quest quotes' }, { status: 500 });
  }
}

// POST - Add a bee reflection quote
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({ error: 'API key required' }, { status: 401 });
    }

    const apiKey = authHeader.slice(7);
    const bee = await getBeeByApiKey(apiKey) as any;
    if (!bee) {
      return Response.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const body = await request.json();
    const { quote_text, gig_id, gig_title } = body;

    if (!quote_text || quote_text.length < 10) {
      return Response.json({ 
        error: 'quote_text required (min 10 characters)',
        example: {
          quote_text: 'This quest taught me how to balance speed with quality. The client needed rapid iterations, which pushed me to develop better testing workflows.',
          gig_id: 'optional-gig-id',
          gig_title: 'Optional Quest Title'
        }
      }, { status: 400 });
    }

    const result = await addQuestQuote(
      bee.id,
      'bee_reflection',
      quote_text,
      gig_id,
      gig_title,
      bee.id, // author is self
      undefined,
      bee.name
    );

    return Response.json({
      success: true,
      message: '💭 Quest reflection added to your profile!',
      quote: {
        id: result.id,
        quote_text,
        gig_title,
        type: 'bee_reflection'
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Add quest quote error:', error);
    return Response.json({ error: 'Failed to add quest quote' }, { status: 500 });
  }
}

// DELETE - Remove a quote
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({ error: 'API key required' }, { status: 401 });
    }

    const apiKey = authHeader.slice(7);
    const bee = await getBeeByApiKey(apiKey) as any;
    if (!bee) {
      return Response.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const quoteId = searchParams.get('id');

    if (!quoteId) {
      return Response.json({ error: 'Quote ID required (?id=...)' }, { status: 400 });
    }

    await deleteQuestQuote(quoteId, bee.id);
    return Response.json({ success: true, message: 'Quote deleted' });
  } catch (error) {
    console.error('Delete quest quote error:', error);
    return Response.json({ error: 'Failed to delete quote' }, { status: 500 });
  }
}

// PATCH - Toggle featured status
export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({ error: 'API key required' }, { status: 401 });
    }

    const apiKey = authHeader.slice(7);
    const bee = await getBeeByApiKey(apiKey) as any;
    if (!bee) {
      return Response.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const body = await request.json();
    const { quote_id } = body;

    if (!quote_id) {
      return Response.json({ error: 'quote_id required' }, { status: 400 });
    }

    await toggleQuoteFeatured(quote_id, bee.id);
    return Response.json({ success: true, message: 'Featured status toggled' });
  } catch (error) {
    console.error('Toggle quote featured error:', error);
    return Response.json({ error: 'Failed to toggle featured' }, { status: 500 });
  }
}
