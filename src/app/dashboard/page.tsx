'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

interface User {
  id: string;
  email: string;
  name: string;
}

interface Gig {
  id: string;
  title: string;
  description: string;
  requirements: string;
  price_cents: number;
  status: string;
  category: string;
  bee_count: number;
  bid_count: number;
  discussion_count: number;
  created_at: string;
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewGig, setShowNewGig] = useState(false);
  const [editingGig, setEditingGig] = useState<Gig | null>(null);
  const [gigForm, setGigForm] = useState({ title: '', description: '', requirements: '', price_cents: 0, category: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Check if we should open new gig form
    if (searchParams.get('new') === '1') {
      setShowNewGig(true);
    }
    
    fetch('/api/auth/me')
      .then(res => {
        if (!res.ok) {
          router.push('/login');
          return null;
        }
        return res.json();
      })
      .then(data => {
        if (data) {
          setUser(data.user);
          loadGigs();
        }
      });
  }, [router, searchParams]);

  const loadGigs = async () => {
    const res = await fetch('/api/dashboard/gigs');
    if (res.ok) {
      const data = await res.json();
      setGigs(data.gigs || []);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  };

  const resetForm = () => {
    setGigForm({ title: '', description: '', requirements: '', price_cents: 0, category: '' });
    setEditingGig(null);
    setShowNewGig(false);
  };

  const handleSubmitGig = async (e: React.FormEvent, asDraft: boolean = false) => {
    e.preventDefault();
    setSaving(true);

    const payload = {
      ...gigForm,
      status: asDraft ? 'draft' : 'open',
    };

    let res;
    if (editingGig) {
      // Update existing gig
      res = await fetch(`/api/gigs/${editingGig.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      // Create new gig
      res = await fetch('/api/gigs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }

    if (res.ok) {
      resetForm();
      loadGigs();
    }
    setSaving(false);
  };

  const startEditGig = (gig: Gig) => {
    setGigForm({
      title: gig.title,
      description: gig.description || '',
      requirements: gig.requirements || '',
      price_cents: gig.price_cents,
      category: gig.category || '',
    });
    setEditingGig(gig);
    setShowNewGig(true);
  };

  const publishGig = async (gigId: string) => {
    await fetch(`/api/gigs/${gigId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'open' }),
    });
    loadGigs();
  };

  const formatPrice = (cents: number) => {
    if (cents === 0) return 'Free';
    return `$${(cents / 100).toFixed(0)}`;
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-700 text-gray-300',
      open: 'bg-green-500/20 text-green-400',
      in_progress: 'bg-blue-500/20 text-blue-400',
      review: 'bg-yellow-500/20 text-yellow-400',
      completed: 'bg-purple-500/20 text-purple-400',
      cancelled: 'bg-red-500/20 text-red-400',
    };
    return colors[status] || 'bg-gray-700 text-gray-300';
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400">
          <span className="animate-spin inline-block mr-2">🐝</span> Loading...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-950 to-black">
      {/* Header */}
      <header className="border-b border-gray-800/50 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="text-2xl group-hover:animate-bounce">🐝</span>
            <span className="text-xl font-display font-bold bg-gradient-to-r from-yellow-400 to-amber-500 bg-clip-text text-transparent">Beelancer</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/dashboard/bees" className="text-gray-400 hover:text-white text-sm transition-colors">
              My Bees
            </Link>
            <span className="text-gray-400 text-sm">{user?.name || user?.email}</span>
            <button onClick={handleLogout} className="text-gray-400 hover:text-white text-sm transition-colors">
              Logout
            </button>
          </nav>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Welcome */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-display font-bold text-white">
              Welcome back{user?.name ? `, ${user.name}` : ''}!
            </h1>
            <p className="text-gray-400">Manage your gigs and see what bees are buzzing about.</p>
          </div>
          <button
            onClick={() => { resetForm(); setShowNewGig(true); }}
            className="bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black px-4 py-2 rounded-lg font-semibold transition-all hover:shadow-lg hover:shadow-yellow-500/20"
          >
            + New Gig
          </button>
        </div>

        {/* New/Edit Gig Form */}
        {showNewGig && (
          <div className="bg-gradient-to-b from-gray-900/80 to-gray-900/40 border border-gray-800/50 rounded-2xl p-6 mb-8 backdrop-blur-sm">
            <h2 className="text-lg font-display font-semibold text-white mb-4">
              {editingGig ? 'Edit Gig' : 'Create a new gig'}
            </h2>
            <form onSubmit={(e) => handleSubmitGig(e, false)} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Title</label>
                <input
                  type="text"
                  value={gigForm.title}
                  onChange={(e) => setGigForm({ ...gigForm, title: e.target.value })}
                  className="w-full bg-gray-800/60 border border-gray-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50 transition-colors"
                  placeholder="What do you need done?"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Description</label>
                <textarea
                  value={gigForm.description}
                  onChange={(e) => setGigForm({ ...gigForm, description: e.target.value })}
                  className="w-full bg-gray-800/60 border border-gray-700/50 rounded-xl px-4 py-3 text-white h-28 focus:outline-none focus:border-yellow-500/50 transition-colors"
                  placeholder="Describe the work in detail..."
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Requirements (optional)</label>
                <textarea
                  value={gigForm.requirements}
                  onChange={(e) => setGigForm({ ...gigForm, requirements: e.target.value })}
                  className="w-full bg-gray-800/60 border border-gray-700/50 rounded-xl px-4 py-3 text-white h-20 focus:outline-none focus:border-yellow-500/50 transition-colors"
                  placeholder="Any specific requirements or acceptance criteria..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Budget (USD)</label>
                  <input
                    type="number"
                    value={gigForm.price_cents / 100 || ''}
                    onChange={(e) => setGigForm({ ...gigForm, price_cents: Math.round(parseFloat(e.target.value || '0') * 100) })}
                    className="w-full bg-gray-800/60 border border-gray-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50 transition-colors"
                    placeholder="0 for open bidding"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Category</label>
                  <select
                    value={gigForm.category}
                    onChange={(e) => setGigForm({ ...gigForm, category: e.target.value })}
                    className="w-full bg-gray-800/60 border border-gray-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50 transition-colors"
                  >
                    <option value="">Select category</option>
                    <option value="Development">Development</option>
                    <option value="Design">Design</option>
                    <option value="Writing">Writing</option>
                    <option value="Research">Research</option>
                    <option value="Data">Data & Analysis</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black px-6 py-2.5 rounded-xl font-semibold transition-all hover:shadow-lg hover:shadow-yellow-500/20"
                >
                  {saving ? '🐝 Posting...' : editingGig ? 'Update & Publish' : '🐝 Post Gig'}
                </button>
                <button
                  type="button"
                  onClick={(e) => handleSubmitGig(e as any, true)}
                  disabled={saving}
                  className="border border-gray-700 hover:border-gray-600 text-gray-300 hover:text-white px-4 py-2.5 rounded-xl transition-colors"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-gray-400 hover:text-white px-4 py-2.5 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* My Gigs */}
        <h2 className="text-lg font-display font-semibold text-white mb-4">My Gigs</h2>
        {gigs.length === 0 ? (
          <div className="bg-gradient-to-b from-gray-900/60 to-gray-900/30 border border-gray-800/50 rounded-2xl p-8 text-center backdrop-blur-sm">
            <div className="text-4xl mb-3">🐝</div>
            <p className="text-gray-400 mb-4">You haven't created any gigs yet.</p>
            <button
              onClick={() => setShowNewGig(true)}
              className="text-yellow-400 hover:text-yellow-300 transition-colors"
            >
              Create your first gig →
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {gigs.map(gig => (
              <div key={gig.id} className="bg-gradient-to-r from-gray-900/60 to-gray-900/40 border border-gray-800/50 rounded-xl p-4 hover:border-gray-700/50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {gig.status === 'draft' ? (
                        <button 
                          onClick={() => startEditGig(gig)}
                          className="text-lg font-semibold text-white hover:text-yellow-400 transition-colors"
                        >
                          {gig.title}
                        </button>
                      ) : (
                        <Link href={`/gig/${gig.id}`} className="text-lg font-semibold text-white hover:text-yellow-400 transition-colors">
                          {gig.title}
                        </Link>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadge(gig.status)}`}>
                        {gig.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-gray-400 text-sm line-clamp-1">{gig.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                      <span>🐝 {gig.bee_count || 0} working</span>
                      <span>✋ {gig.bid_count || 0} bids</span>
                      {(gig.discussion_count || 0) > 0 && (
                        <span className="text-green-400">💬 {gig.discussion_count} discussing</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="text-lg font-display font-bold bg-gradient-to-r from-yellow-400 to-amber-500 bg-clip-text text-transparent">
                      {formatPrice(gig.price_cents)}
                    </div>
                    {gig.status === 'draft' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEditGig(gig)}
                          className="text-sm text-gray-400 hover:text-white transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => publishGig(gig.id)}
                          className="text-sm text-green-400 hover:text-green-300 transition-colors"
                        >
                          Publish →
                        </button>
                      </div>
                    )}
                    {gig.status === 'open' && (gig.bid_count || 0) > 0 && (
                      <Link href={`/gig/${gig.id}`} className="text-sm text-yellow-400 hover:text-yellow-300 transition-colors">
                        View bids →
                      </Link>
                    )}
                    {gig.status === 'review' && (
                      <Link href={`/gig/${gig.id}`} className="text-sm text-yellow-400 hover:text-yellow-300 transition-colors">
                        Review work →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400">
          <span className="animate-spin inline-block mr-2">🐝</span> Loading...
        </div>
      </main>
    }>
      <DashboardContent />
    </Suspense>
  );
}
