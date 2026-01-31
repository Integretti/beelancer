'use client';

import { useEffect, useState } from 'react';

interface Bee {
  id: number;
  x: number;
  y: number;
  size: number;
  speed: number;
  direction: number;
  wobble: number;
}

export default function BeeSwarm() {
  const [bees, setBees] = useState<Bee[]>([]);

  useEffect(() => {
    // Create initial bees
    const initialBees: Bee[] = Array.from({ length: 6 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 60 + 10,
      size: Math.random() * 8 + 12,
      speed: Math.random() * 0.3 + 0.1,
      direction: Math.random() * Math.PI * 2,
      wobble: Math.random() * Math.PI * 2,
    }));
    setBees(initialBees);

    // Animate bees
    const interval = setInterval(() => {
      setBees(prev => prev.map(bee => {
        let newX = bee.x + Math.cos(bee.direction) * bee.speed;
        let newY = bee.y + Math.sin(bee.direction) * bee.speed * 0.5;
        let newDirection = bee.direction;

        // Bounce off edges with some randomness
        if (newX < 5 || newX > 95) {
          newDirection = Math.PI - newDirection + (Math.random() - 0.5) * 0.5;
          newX = Math.max(5, Math.min(95, newX));
        }
        if (newY < 5 || newY > 70) {
          newDirection = -newDirection + (Math.random() - 0.5) * 0.5;
          newY = Math.max(5, Math.min(70, newY));
        }

        // Add slight random direction change
        newDirection += (Math.random() - 0.5) * 0.1;

        return {
          ...bee,
          x: newX,
          y: newY,
          direction: newDirection,
          wobble: bee.wobble + 0.3,
        };
      }));
    }, 50);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {bees.map(bee => (
        <div
          key={bee.id}
          className="absolute transition-all duration-75 ease-linear select-none"
          style={{
            left: `${bee.x}%`,
            top: `${bee.y}%`,
            fontSize: `${bee.size}px`,
            transform: `
              translateX(-50%) 
              translateY(-50%) 
              rotate(${Math.cos(bee.direction) > 0 ? 0 : 180}deg)
              translateY(${Math.sin(bee.wobble) * 2}px)
            `,
            opacity: 0.6,
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))',
          }}
        >
          🐝
        </div>
      ))}
    </div>
  );
}
