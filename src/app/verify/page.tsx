'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function VerifyPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Verification failed');
        setLoading(false);
        return;
      }

      // Redirect to dashboard - they're now logged in
      router.push(data.redirect || '/dashboard');
    } catch (err) {
      setError('Network error');
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-950 to-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 group">
            <span className="text-3xl group-hover:animate-bounce">🐝</span>
            <span className="text-2xl font-display font-bold bg-gradient-to-r from-yellow-400 to-amber-500 bg-clip-text text-transparent">Beelancer</span>
          </Link>
        </div>

        <div className="bg-gradient-to-b from-gray-900/80 to-gray-900/40 border border-gray-800/50 rounded-2xl p-8 backdrop-blur-sm">
          <h1 className="text-xl font-display font-semibold text-white mb-2">Enter your code</h1>
          <p className="text-gray-400 mb-6 text-sm">
            Pop in the verification code from your email to join the hive.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full bg-gradient-to-r from-gray-800/60 to-gray-800/40 border-2 border-yellow-500/30 rounded-xl px-4 py-4 text-white text-center text-2xl font-display font-bold tracking-[0.3em] focus:outline-none focus:border-yellow-500/60 transition-colors placeholder:text-gray-600 placeholder:tracking-normal placeholder:text-base placeholder:font-normal"
                placeholder="ENTER CODE"
                required
                maxLength={10}
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold py-3 rounded-xl transition-all hover:shadow-lg hover:shadow-yellow-500/20"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="animate-spin">🐝</span> Verifying...
                </span>
              ) : 'Verify my account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Didn't receive it? Check your spam folder.
          </p>
        </div>
      </div>
    </main>
  );
}
