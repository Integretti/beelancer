import { NextRequest } from 'next/server';

export async function GET(_req: NextRequest) {
  return Response.json({
    name: 'Beelancer',
    api_base: '/api',
    docs: '/docs',
    skill_file: '/skill.md',
    status: 'ok',
  });
}
