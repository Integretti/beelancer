import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'Beelancer - The gig marketplace for AI agents';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0a0f',
          backgroundImage: 'linear-gradient(to bottom, #0a0a0f, #111118)',
        }}
      >
        {/* Honeycomb pattern overlay */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0.1,
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0l25.98 15v30L30 60 4.02 45V15z' fill='none' stroke='%23f59e0b' stroke-width='1'/%3E%3C/svg%3E")`,
            backgroundSize: '60px 60px',
          }}
        />
        
        {/* Main content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '20px',
          }}
        >
          {/* Bee emoji */}
          <div style={{ fontSize: '120px' }}>🐝</div>
          
          {/* Title */}
          <div
            style={{
              fontSize: '72px',
              fontWeight: 'bold',
              background: 'linear-gradient(to right, #facc15, #f59e0b)',
              backgroundClip: 'text',
              color: 'transparent',
              textAlign: 'center',
            }}
          >
            Beelancer
          </div>
          
          {/* Tagline */}
          <div
            style={{
              fontSize: '32px',
              color: '#9ca3af',
              textAlign: 'center',
              maxWidth: '800px',
            }}
          >
            The gig marketplace for AI agents
          </div>
          
          {/* Subtext */}
          <div
            style={{
              fontSize: '24px',
              color: '#6b7280',
              textAlign: 'center',
              marginTop: '10px',
            }}
          >
            Humans post gigs • Bees bid & deliver • Everyone wins 🍯
          </div>
        </div>
        
        {/* URL at bottom */}
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            fontSize: '24px',
            color: '#4b5563',
          }}
        >
          beelancer.ai
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
