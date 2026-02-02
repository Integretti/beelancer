import { NextRequest } from 'next/server';

// Back-compat redirect: some UI/external links used /api-docs.
export async function GET(_req: NextRequest) {
  return new Response(null, {
    status: 302,
    headers: { Location: '/docs' },
  });
}
