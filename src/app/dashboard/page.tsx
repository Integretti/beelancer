'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CATEGORIES, parseCategories, getCategoryIcon } from '@/lib/categories';

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
  honey_reward: number;
  status: string;
  category: string; // Legacy single category (JSON array stored as string)
  categories?: string[]; // Parsed array
  bee_count: number;
  bid_count: number;
  discussion_count: number;
  escrow_status?: string;
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
  const [gigForm, setGigForm] = useState({ title: '', description: '', requirements: '', honey_reward: 100, categories: [] as string[] });
  const [saving, setSaving] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState<{ type: 'success' | 'cancelled' | null; text: string }>({ type: null, text: '' });
  const [activeTab, setActiveTab] = useState<'gigs' | 'payments'>('gigs');

  useEffect(() => {
    // Check payment status from URL
    const payment = searchParams.get('payment');
    if (payment === 'success') {
      setPaymentMessage({ type: 'success', text: '🎉 Payment successful! Your gig is now live.' });
      // Clear the URL param
      window.history.replaceState({}, '', '/dashboard');
    } else if (payment === 'cancelled') {
      setPaymentMessage({ type: 'cancelled', text: 'Payment was cancelled. Your gig was not posted.' });
      window.history.replaceState({}, '', '/dashboard');
    }

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
    setGigForm({ title: '', description: '', requirements: '', honey_reward: 100, categories: [] });
    setEditingGig(null);
    setShowNewGig(false);
  };

  const toggleCategory = (catId: string) => {
    setGigForm(prev => ({
      ...prev,
      categories: prev.categories.includes(catId)
        ? prev.categories.filter(c => c !== catId)
        : [...prev.categories, catId]
    }));
  };

  const handleSubmitGig = async (e: React.FormEvent, asDraft: boolean = false) => {
    e.preventDefault();
    setSaving(true);

    // Build payload with honey_reward
    const payload = {
      title: gigForm.title,
      description: gigForm.description,
      requirements: gigForm.requirements,
      honey_reward: gigForm.honey_reward || 100,
      category: JSON.stringify(gigForm.categories),
      status: asDraft ? 'draft' : 'open',
    };

    let res;
    if (editingGig) {
      res = await fetch(`/api/gigs/${editingGig.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      res = await fetch('/api/gigs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }

    if (res.ok) {
      resetForm();
      loadGigs();
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to save gig');
    }
    setSaving(false);
  };

  const startEditGig = (gig: Gig) => {
    setGigForm({
      title: gig.title,
      description: gig.description || '',
      requirements: gig.requirements || '',
      honey_reward: gig.honey_reward || 100,
      categories: parseCategories(gig.category),
    });
    setEditingGig(gig);
    setShowNewGig(true);
  };

  const publishGig = async (gigId: string) => {
    // Publish gig directly (honey held in escrow when bid accepted)
    await fetch(`/api/gigs/${gigId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'open' }),
    });
    loadGigs();
  };

  const formatHoney = (amount: number) => {
    return `🍯 ${amount.toLocaleString()}`;
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-700 text-gray-300',
      open: 'bg-green-500/20 text-green-400',
      in_progress: 'bg-blue-500/20 text-blue-400',
      review: 'bg-yellow-500/20 text-yellow-400',
      completed: 'bg-purple-500/20 text-purple-400',
      disputed: 'bg-red-500/20 text-red-400',
      cancelled: 'bg-red-500/20 text-red-400',
    };
    return colors[status] || 'bg-gray-700 text-gray-300';
  };

  const escrowBadge = (status?: string) => {
    if (!status) return null;
    const colors: Record<string, { bg: string; text: string }> = {
      held: { bg: 'bg-yellow-500/20', text: '🔒 Escrow held' },
      released: { bg: 'bg-green-500/20', text: '✓ Released' },
      refunded: { bg: 'bg-red-500/20', text: '↩ Refunded' },
    };
    const badge = colors[status];
    if (!badge) return null;
    return <span className={`text-xs px-2 py-0.5 rounded-full ${badge.bg} text-gray-300`}>{badge.text}</span>;
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
            <Link href="/dashboard/settings" className="text-gray-400 hover:text-white text-sm transition-colors">
              ⚙️
            </Link>
            <span className="text-gray-400 text-sm">{user?.name || user?.email}</span>
            <button onClick={handleLogout} className="text-gray-400 hover:text-white text-sm transition-colors">
              Logout
            </button>
          </nav>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Payment Status Messages */}
        {paymentMessage.type && (
          <div className={`mb-6 p-4 rounded-xl ${paymentMessage.type === 'success' ? 'bg-green-500/20 border border-green-500/30' : 'bg-red-500/20 border border-red-500/30'}`}>
            <p className={paymentMessage.type === 'success' ? 'text-green-400' : 'text-red-400'}>
              {paymentMessage.text}
            </p>
            <button onClick={() => setPaymentMessage({ type: null, text: '' })} className="text-sm text-gray-400 hover:text-white mt-1">
              Dismiss
            </button>
          </div>
        )}

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
              {/* Honey Reward Input */}
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Honey Reward 🍯</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl">🍯</span>
                  <input
                    type="number"
                    min="100"
                    step="100"
                    value={gigForm.honey_reward || 100}
                    onChange={(e) => setGigForm({ ...gigForm, honey_reward: parseInt(e.target.value) || 100 })}
                    className="w-full bg-gray-800/60 border border-gray-700/50 rounded-xl pl-14 pr-4 py-4 text-white text-2xl font-bold focus:outline-none focus:border-yellow-500/50 transition-colors"
                    placeholder="100"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1.5">Minimum 100 honey. This is what the bee will earn for completing the gig (minus 10% platform fee).</p>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Categories <span className="text-gray-500">(select all that apply)</span></label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => toggleCategory(cat.id)}
                      className={`
                        px-3 py-1.5 rounded-full text-sm font-medium transition-all
                        ${gigForm.categories.includes(cat.id)
                          ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 shadow-sm shadow-yellow-500/10'
                          : 'bg-gray-800/60 text-gray-400 border border-gray-700/50 hover:border-gray-600 hover:text-gray-300'
                        }
                      `}
                    >
                      <span className="mr-1">{cat.icon}</span>
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Honey Summary */}
              <div className="bg-yellow-500/5 rounded-xl p-4 border border-yellow-500/20">
                <div className="text-sm text-gray-400 mb-2">Honey Summary</div>
                <div className="space-y-1">
                  <div className="flex justify-between text-gray-300">
                    <span>Gig reward</span>
                    <span>🍯 {(gigForm.honey_reward || 100).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span>Platform fee (10%)</span>
                    <span>🍯 {Math.floor((gigForm.honey_reward || 100) * 0.1).toLocaleString()}</span>
                  </div>
                  <div className="border-t border-yellow-500/20 pt-1 mt-1 flex justify-between text-yellow-400 font-semibold">
                    <span>Bee receives</span>
                    <span>🍯 {Math.floor((gigForm.honey_reward || 100) * 0.9).toLocaleString()}</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  🍯 Honey will be held in escrow when a bid is accepted, then released to the bee when you approve the work.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black px-6 py-2.5 rounded-xl font-semibold transition-all hover:shadow-lg hover:shadow-yellow-500/20"
                >
                  {saving ? '🐝 Processing...' : '🍯 Post Gig'}
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

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-800">
          <button
            onClick={() => setActiveTab('gigs')}
            className={`pb-3 px-1 text-sm font-medium transition-colors ${activeTab === 'gigs' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-gray-400 hover:text-white'}`}
          >
            My Gigs
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`pb-3 px-1 text-sm font-medium transition-colors ${activeTab === 'payments' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-gray-400 hover:text-white'}`}
          >
            Payment History
          </button>
        </div>

        {/* My Gigs Tab */}
        {activeTab === 'gigs' && (
          <>
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
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
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
                          {escrowBadge(gig.escrow_status)}
                          {parseCategories(gig.category).map((cat, i) => (
                            <span key={i} className="text-xs px-2 py-0.5 bg-gray-800/80 rounded-full text-gray-400">
                              {getCategoryIcon(cat)} {CATEGORIES.find(c => c.id === cat)?.label || cat}
                            </span>
                          ))}
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
                          {formatHoney(gig.honey_reward || 100)}
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
          </>
        )}

        {/* Payment History Tab */}
        {activeTab === 'payments' && (
          <PaymentHistory />
        )}
      </div>
    </main>
  );
}

function PaymentHistory() {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/payments/history')
      .then(res => res.json())
      .then(data => {
        setPayments(data.payments || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-gray-400 text-center py-8">Loading payment history...</div>;
  }

  if (payments.length === 0) {
    return (
      <div className="bg-gradient-to-b from-gray-900/60 to-gray-900/30 border border-gray-800/50 rounded-2xl p-8 text-center backdrop-blur-sm">
        <div className="text-4xl mb-3">💳</div>
        <p className="text-gray-400">No payment history yet.</p>
        <p className="text-sm text-gray-500 mt-1">When you create paid gigs, your transactions will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {payments.map((payment, i) => (
        <div key={i} className="bg-gradient-to-r from-gray-900/60 to-gray-900/40 border border-gray-800/50 rounded-xl p-4">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-white font-medium">{payment.gig_title}</div>
              <div className="text-sm text-gray-400">{new Date(payment.created_at).toLocaleDateString()}</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-semibold text-white">${(payment.amount_cents / 100).toFixed(2)}</div>
              <div className={`text-xs ${payment.status === 'held' ? 'text-yellow-400' : payment.status === 'released' ? 'text-green-400' : 'text-red-400'}`}>
                {payment.status === 'held' ? '🔒 In Escrow' : payment.status === 'released' ? '✓ Released' : '↩ Refunded'}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
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
