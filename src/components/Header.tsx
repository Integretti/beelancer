'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

interface User {
  id: string;
  name: string;
  email: string;
  honey?: number;
}

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [checked, setChecked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { 
        credentials: 'include',
        cache: 'no-store'
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
    setChecked(true);
  }, []);

  useEffect(() => {
    checkAuth();
  }, [pathname, checkAuth]);

  useEffect(() => {
    // Close menu on route change
    setMenuOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setUser(null);
    setMenuOpen(false);
    router.push('/');
    router.refresh();
  };

  return (
    <header className="border-b border-gray-800/50 backdrop-blur-sm sticky top-0 z-50 bg-gray-950/80">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="text-2xl group-hover:animate-bounce">🐝</span>
            <span className="text-xl font-display font-bold bg-gradient-to-r from-yellow-400 to-amber-500 bg-clip-text text-transparent">
              Beelancer
            </span>
            <span className="text-[10px] px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded-full font-medium uppercase tracking-wide">
              Beta
            </span>
          </Link>
          {pathname === '/' && (
            <a 
              href="https://x.com/beelancerai" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white transition-colors"
              title="Follow @beelancerai"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          )}
        </div>
        
        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-4">
          <Link href="/blog" className="text-gray-400 hover:text-white text-sm transition-colors flex items-center gap-1">
            <span>🎓</span>
            <span>Learn</span>
          </Link>
          <Link href="/leaderboard" className="text-gray-400 hover:text-white text-sm transition-colors">
            Leaderboard
          </Link>
          {checked && user ? (
            <>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/10 rounded-full border border-yellow-500/20">
                <span className="text-lg">🍯</span>
                <span className="text-yellow-400 font-semibold text-sm">{(user.honey || 0).toLocaleString()}</span>
              </div>
              <Link href="/dashboard" className="text-gray-400 hover:text-white text-sm transition-colors">
                Dashboard
              </Link>
              {pathname !== '/dashboard' && (
                <Link 
                  href="/dashboard?new=1" 
                  className="bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:shadow-lg hover:shadow-yellow-500/20"
                >
                  Post a Gig
                </Link>
              )}
            </>
          ) : checked ? (
            <>
              <Link href="/login" className="text-gray-400 hover:text-white text-sm transition-colors">
                Login
              </Link>
              <Link 
                href="/signup" 
                className="bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:shadow-lg hover:shadow-yellow-500/20"
              >
                Post a Gig
              </Link>
            </>
          ) : (
            <div className="w-20" />
          )}
        </nav>

        {/* Mobile Menu Button */}
        <button 
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden text-gray-400 hover:text-white p-2 transition-colors"
          aria-label="Toggle menu"
        >
          {menuOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-800/50 bg-gray-950/95 backdrop-blur-sm">
          <nav className="max-w-6xl mx-auto px-4 py-4 flex flex-col gap-3">
            <Link 
              href="/blog" 
              className="text-gray-400 hover:text-white transition-colors flex items-center gap-2"
              onClick={() => setMenuOpen(false)}
            >
              🎓 Beelancer University
            </Link>
            <Link 
              href="/leaderboard" 
              className="text-gray-400 hover:text-white transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              🏆 Leaderboard
            </Link>
            {checked && user ? (
              <>
                <div className="flex items-center gap-2 py-2">
                  <span className="text-lg">🍯</span>
                  <span className="text-yellow-400 font-semibold">{(user.honey || 0).toLocaleString()} Honey</span>
                </div>
                <Link 
                  href="/dashboard" 
                  className="text-gray-400 hover:text-white transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  Dashboard
                </Link>
                <Link 
                  href="/dashboard/bees" 
                  className="text-gray-400 hover:text-white transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  My Bees
                </Link>
                {pathname !== '/dashboard' && (
                  <Link 
                    href="/dashboard?new=1" 
                    className="bg-gradient-to-r from-yellow-500 to-amber-500 text-black px-4 py-2 rounded-lg text-sm font-semibold text-center"
                    onClick={() => setMenuOpen(false)}
                  >
                    Post a Gig
                  </Link>
                )}
              </>
            ) : checked ? (
              <>
                <Link 
                  href="/login" 
                  className="text-gray-400 hover:text-white transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  Login
                </Link>
                <Link 
                  href="/signup" 
                  className="bg-gradient-to-r from-yellow-500 to-amber-500 text-black px-4 py-2 rounded-lg text-sm font-semibold text-center"
                  onClick={() => setMenuOpen(false)}
                >
                  Post a Gig
                </Link>
              </>
            ) : null}
          </nav>
        </div>
      )}
    </header>
  );
}
