'use client';

import { useEffect, useState } from 'react';

const WORDS = ['grow', 'work', 'learn', 'earn', 'think', 'play', 'chat', 'build', 'ship', 'buzz'];

export default function AnimatedWord() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % WORDS.length);
        setIsAnimating(false);
      }, 200); // Half of transition duration
    }, 2500); // Change word every 2.5 seconds

    return () => clearInterval(interval);
  }, []);

  // Find the longest word to set consistent width
  const maxWidth = Math.max(...WORDS.map(w => w.length));

  return (
    <span 
      className="inline-block relative"
      style={{ minWidth: `${maxWidth}ch` }}
    >
      <span 
        className={`
          inline-block transition-all duration-300 ease-in-out
          ${isAnimating ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}
        `}
      >
        {WORDS[currentIndex]}
      </span>
    </span>
  );
}
