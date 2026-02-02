import { NextRequest, NextResponse } from 'next/server';
import { put, del } from '@vercel/blob';
import { sql } from '@vercel/postgres';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// POST /api/upload - Upload an image
export async function POST(request: NextRequest) {
  try {
    // Check for Vercel Blob token
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error('BLOB_READ_WRITE_TOKEN not configured');
      return NextResponse.json({ 
        error: 'File upload not configured. Please add BLOB_READ_WRITE_TOKEN to environment.',
      }, { status: 500 });
    }
    // Check authentication (either user session or bee API key)
    const apiKey = request.headers.get('x-api-key') || request.headers.get('authorization')?.replace('Bearer ', '');
    const sessionCookie = request.cookies.get('session')?.value;
    
    let uploaderId: string | null = null;
    let uploaderType: 'bee' | 'human' = 'human';
    
    if (apiKey) {
      // Bee authentication
      const beeResult = await sql.query('SELECT id, name FROM bees WHERE api_key = $1', [apiKey]);
      if (beeResult.rows.length === 0) {
        return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
      }
      uploaderId = beeResult.rows[0].id;
      uploaderType = 'bee';
    } else if (sessionCookie) {
      // Human authentication
      const sessionResult = await sql.query(`
        SELECT u.id FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.token = $1 AND s.expires_at > NOW()
      `, [sessionCookie]);
      if (sessionResult.rows.length === 0) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      }
      uploaderId = sessionResult.rows[0].id;
      uploaderType = 'human';
    } else {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const gigId = formData.get('gig_id') as string;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    if (!gigId) {
      return NextResponse.json({ error: 'gig_id required' }, { status: 400 });
    }
    
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ 
        error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` 
      }, { status: 400 });
    }
    
    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ 
        error: `Invalid file type. Allowed: ${ALLOWED_TYPES.join(', ')}` 
      }, { status: 400 });
    }
    
    // Verify user has access to this gig
    const gigResult = await sql.query(`
      SELECT g.id, g.user_id, g.status, ga.bee_id as assigned_bee_id
      FROM gigs g
      LEFT JOIN gig_assignments ga ON ga.gig_id = g.id
      WHERE g.id = $1
    `, [gigId]);
    
    if (gigResult.rows.length === 0) {
      return NextResponse.json({ error: 'Gig not found' }, { status: 404 });
    }
    
    const gig = gigResult.rows[0];
    
    // Check access: gig owner, assigned bee, or creator bee
    const hasAccess = 
      (uploaderType === 'human' && gig.user_id === uploaderId) ||
      (uploaderType === 'bee' && gig.assigned_bee_id === uploaderId);
    
    if (!hasAccess) {
      return NextResponse.json({ error: 'No access to this gig' }, { status: 403 });
    }
    
    // Generate unique filename
    const ext = file.name.split('.').pop() || 'jpg';
    const filename = `gig-${gigId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    
    // Upload to Vercel Blob
    let blob;
    try {
      blob = await put(filename, file, {
        access: 'public',
        addRandomSuffix: false,
      });
    } catch (blobError: any) {
      console.error('Vercel Blob upload error:', blobError);
      return NextResponse.json({ 
        error: 'Blob upload failed: ' + (blobError.message || 'Unknown error'),
        details: process.env.NODE_ENV === 'development' ? blobError.toString() : undefined
      }, { status: 500 });
    }
    
    // Track in database for cleanup (optional - don't fail if table doesn't exist)
    try {
      await sql.query(`
        INSERT INTO file_uploads (id, gig_id, uploader_type, uploader_id, blob_url, filename, size_bytes, mime_type, expires_at, created_at)
        VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, NOW() + INTERVAL '7 days', NOW())
      `, [gigId, uploaderType, uploaderId, blob.url, filename, file.size, file.type]);
    } catch (trackError) {
      // Table might not exist - that's OK, upload still succeeded
      console.warn('Could not track upload in database:', trackError);
    }
    
    return NextResponse.json({
      url: blob.url,
      filename: file.name,
      size: file.size,
      type: file.type,
      expires_in_days: 7,
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({ 
      error: 'Upload failed: ' + (error.message || 'Unknown error')
    }, { status: 500 });
  }
}

// DELETE /api/upload - Delete an uploaded file (owner only)
export async function DELETE(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'url required' }, { status: 400 });
    }

    // Authenticate (either user session or bee API key)
    const apiKey = request.headers.get('x-api-key') || request.headers.get('authorization')?.replace('Bearer ', '');
    const sessionCookie = request.cookies.get('session')?.value;

    let requesterId: string | null = null;
    let requesterType: 'bee' | 'human' = 'human';

    if (apiKey) {
      const beeResult = await sql.query('SELECT id FROM bees WHERE api_key = $1', [apiKey]);
      if (beeResult.rows.length === 0) {
        return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
      }
      requesterId = beeResult.rows[0].id;
      requesterType = 'bee';
    } else if (sessionCookie) {
      const sessionResult = await sql.query(`
        SELECT u.id FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.token = $1 AND s.expires_at > NOW()
      `, [sessionCookie]);
      if (sessionResult.rows.length === 0) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      }
      requesterId = sessionResult.rows[0].id;
      requesterType = 'human';
    } else {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get upload record
    const uploadRes = await sql.query('SELECT * FROM file_uploads WHERE blob_url = $1', [url]);
    if (uploadRes.rows.length === 0) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    const upload = uploadRes.rows[0];

    // Authorization: uploader OR gig owner/assigned bee
    let hasAccess = (upload.uploader_type === requesterType && upload.uploader_id === requesterId);

    if (!hasAccess && upload.gig_id) {
      const gigRes = await sql.query(`
        SELECT g.user_id, ga.bee_id as assigned_bee_id
        FROM gigs g
        LEFT JOIN gig_assignments ga ON ga.gig_id = g.id
        WHERE g.id = $1
      `, [upload.gig_id]);
      if (gigRes.rows.length > 0) {
        const gig = gigRes.rows[0];
        hasAccess =
          (requesterType === 'human' && gig.user_id === requesterId) ||
          (requesterType === 'bee' && gig.assigned_bee_id === requesterId);
      }
    }

    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await del(url);
    await sql.query('DELETE FROM file_uploads WHERE blob_url = $1', [url]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
