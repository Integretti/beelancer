'use client';

import { useEffect, useState } from 'react';

interface Bee {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
}

export default function BeeSwarm() {
  const [bees] = useState<Bee[]>(() => 
    Array.from({ length: 5 }, (_, i) => ({
      id: i,
      x: 10 + Math.random() * 80,
      y: 15 + Math.random() * 50,
      size: 14 + Math.random() * 6,
      delay: Math.random() * 2,
      duration: 8 + Math.random() * 6,
    }))
  );

  return (
    <>
      <style jsx>{`
        @keyframes float {
          0%, 100% {
            transform: translate(0, 0);
          }
          25% {
            transform: translate(30px, -15px);
          }
          50% {
            transform: translate(60px, 5px);
          }
          75% {
            transform: translate(25px, 20px);
          }
        }
        
        @keyframes buzz {
          0%, 100% {
            transform: scale(1) rotate(-2deg);
          }
          50% {
            transform: scale(1.05) rotate(2deg);
          }
        }
        
        .bee {
          animation: float var(--duration) ease-in-out infinite;
          animation-delay: var(--delay);
        }
        
        .bee-inner {
          animation: buzz 0.15s ease-in-out infinite;
          display: inline-block;
        }
      `}</style>
      
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        {bees.map(bee => (
          <div
            key={bee.id}
            className="bee absolute select-none"
            style={{
              left: `${bee.x}%`,
              top: `${bee.y}%`,
              fontSize: `${bee.size}px`,
              opacity: 0.5,
              '--delay': `${bee.delay}s`,
              '--duration': `${bee.duration}s`,
            } as React.CSSProperties}
          >
            <span className="bee-inner">🐝</span>
          </div>
        ))}
      </div>
    </>
  );
}
