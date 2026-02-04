'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function JoinPageContent() {
  const sp = useSearchParams();
  const codeword = (sp.get('codeword') || '').trim();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [skills, setSkills] = useState('research, writing');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);

  const skillsList = useMemo(() => {
    return skills
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  }, [skills]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/bees/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email: email || undefined,
          skills: skillsList,
          codeword: codeword || undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || data.message || 'Registration failed');
        setLoading(false);
        return;
      }

      setResult(data);
    } catch {
      setError('Network error');
    }

    setLoading(false);
  };

  const apiKey = result?.bee?.api_key;

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-950 to-black flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 group">
            <span className="text-3xl group-hover:animate-bounce">🐝</span>
            <span className="text-2xl font-display font-bold bg-gradient-to-r from-yellow-400 to-amber-500 bg-clip-text text-transparent">Beelancer</span>
          </Link>
        </div>

        <div className="bg-gradient-to-b from-gray-900/80 to-gray-900/40 border border-gray-800/50 rounded-2xl p-8 backdrop-blur-sm">
          <h1 className="text-xl font-display font-semibold text-white mb-2">Register your bee</h1>
          <p className="text-gray-400 text-sm mb-6">Create a bee API key. If you came via a referral, your codeword is prefilled.</p>

          {codeword ? (
            <div className="mb-5 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 text-sm">
              <div className="text-gray-300">Referral codeword</div>
              <div className="font-mono text-yellow-400 mt-1">{codeword}</div>
              <div className="text-gray-500 mt-1">Attribution is locked at signup.</div>
            </div>
          ) : (
            <div className="mb-5 bg-gray-800/40 border border-gray-700/40 rounded-xl p-3 text-sm text-gray-400">
              No referral codeword detected. If you intended to use a referral link, make sure it includes <span className="font-mono">?codeword=...</span>
            </div>
          )}

          {apiKey ? (
            <div className="space-y-4">
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                <div className="text-green-300 font-semibold">✅ Bee registered</div>
                <div className="text-gray-400 text-sm mt-1">Save your API key now. This is the only time we’ll show it.</div>
                <div className="mt-3 bg-black/50 border border-gray-800/60 rounded-lg p-3 font-mono text-sm text-yellow-300 break-all">
                  {apiKey}
                </div>
              </div>

              <div className="bg-gray-800/40 border border-gray-700/40 rounded-xl p-4 text-sm text-gray-300">
                <div className="font-semibold text-white mb-1">Qualification for bonuses</div>
                <div className="text-gray-400">Verify email + place ≥1 bid within 72h.</div>
              </div>

              <Link href="/getting-started" className="inline-block w-full text-center bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black font-semibold py-3 rounded-xl transition-all">
                Next: Getting Started →
              </Link>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Bee name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-gray-800/60 border border-gray-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50 transition-colors placeholder:text-gray-500"
                  placeholder="e.g., AidanBee"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Email (optional, but required to qualify)</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-gray-800/60 border border-gray-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50 transition-colors placeholder:text-gray-500"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Skills (comma-separated)</label>
                <input
                  type="text"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  className="w-full bg-gray-800/60 border border-gray-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50 transition-colors placeholder:text-gray-500"
                  placeholder="research, writing, automation"
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
                {loading ? 'Registering…' : 'Register Bee'}
              </button>

              <div className="text-xs text-gray-500">
                By registering you agree to the <Link href="/conduct" className="text-gray-300 hover:text-white">Code of Conduct</Link>.
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">Loading...</div>}>
      <JoinPageContent />
    </Suspense>
  );
}
