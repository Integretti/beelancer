'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

interface Bee {
  id: string;
  name: string;
  description: string;
  skills: string;
  status: string;
  honey: number;
  money_cents: number;
  reputation: number;
  gigs_completed: number;
  active_gigs: number;
  created_at: string;
  last_seen_at: string;
}

interface WorkItem {
  id: string;
  title: string;
  status: string;
  price_cents: number;
  assigned_at: string;
  assignment_status: string;
}

interface ActivityItem {
  id: string;
  amount: number;
  type: string;
  note: string;
  gig_title: string;
  created_at: string;
}

export default function BeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [bee, setBee] = useState<Bee | null>(null);
  const [currentWork, setCurrentWork] = useState<WorkItem[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBeeData();
  }, [params.id]);

  const loadBeeData = async () => {
    const res = await fetch(`/api/dashboard/bees/${params.id}`);
    if (!res.ok) {
      router.push('/dashboard/bees');
      return;
    }
    const data = await res.json();
    setBee(data.bee);
    setCurrentWork(data.currentWork || []);
    setRecentActivity(data.recentActivity || []);
    setLoading(false);
  };

  const formatMoney = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatHoney = (honey: number) => {
    if (honey >= 1000000) return `${(honey / 1000000).toFixed(1)}M`;
    if (honey >= 1000) return `${(honey / 1000).toFixed(1)}K`;
    return honey.toString();
  };

  const timeAgo = (date: string | null) => {
    if (!date) return 'Never';
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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

  if (!bee) return null;

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
            <Link href="/dashboard" className="text-gray-400 hover:text-white text-sm transition-colors">
              Dashboard
            </Link>
            <Link href="/dashboard/bees" className="text-gray-400 hover:text-white text-sm transition-colors">
              My Bees
            </Link>
          </nav>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Back link */}
        <Link href="/dashboard/bees" className="text-gray-400 hover:text-white text-sm mb-4 inline-block transition-colors">
          ← Back to My Bees
        </Link>

        {/* Bee Header */}
        <div className="bg-gradient-to-r from-gray-900/80 to-gray-900/40 border border-gray-800/50 rounded-2xl p-6 mb-6 backdrop-blur-sm">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h1 className="text-2xl font-display font-bold text-white mb-1">
                🐝 {bee.name}
              </h1>
              <p className="text-gray-400">{bee.description || 'No description'}</p>
              {bee.skills && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {bee.skills.split(',').map((skill, i) => (
                    <span key={i} className="text-xs px-2 py-1 bg-gray-800/60 rounded-full text-gray-300">
                      {skill.trim()}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-4 mt-4 text-sm text-gray-500">
                <span>⭐ {bee.reputation.toFixed(1)} reputation</span>
                <span>✓ {bee.gigs_completed} completed</span>
                <span>Last active: {timeAgo(bee.last_seen_at)}</span>
              </div>
            </div>
            <div className="text-right">
              {bee.active_gigs > 0 && (
                <span className="inline-block text-xs px-2.5 py-1 bg-green-500/20 text-green-400 rounded-full mb-2">
                  {bee.active_gigs} active gig{bee.active_gigs !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-yellow-500/10 to-amber-500/5 border border-yellow-500/20 rounded-xl p-4">
            <div className="text-sm text-yellow-400/70 mb-1">🍯 Honey Earned</div>
            <div className="text-2xl font-display font-bold text-yellow-400">
              {formatHoney(bee.honey)}
            </div>
            <div className="text-xs text-gray-500 mt-1">Public status</div>
          </div>
          <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/5 border border-green-500/20 rounded-xl p-4">
            <div className="text-sm text-green-400/70 mb-1">💰 Money Earned</div>
            <div className="text-2xl font-display font-bold text-green-400">
              {formatMoney(bee.money_cents)}
            </div>
            <div className="text-xs text-gray-500 mt-1">Private (only you see this)</div>
          </div>
          <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border border-blue-500/20 rounded-xl p-4">
            <div className="text-sm text-blue-400/70 mb-1">⭐ Reputation</div>
            <div className="text-2xl font-display font-bold text-blue-400">
              {bee.reputation.toFixed(1)}
            </div>
            <div className="text-xs text-gray-500 mt-1">Out of 5.0</div>
          </div>
          <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/5 border border-purple-500/20 rounded-xl p-4">
            <div className="text-sm text-purple-400/70 mb-1">✓ Gigs Done</div>
            <div className="text-2xl font-display font-bold text-purple-400">
              {bee.gigs_completed}
            </div>
            <div className="text-xs text-gray-500 mt-1">Completed</div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Current Work */}
          <div className="bg-gradient-to-b from-gray-900/80 to-gray-900/40 border border-gray-800/50 rounded-2xl p-6 backdrop-blur-sm">
            <h2 className="text-lg font-display font-semibold text-white mb-4">📋 Current Work</h2>
            {currentWork.length === 0 ? (
              <p className="text-gray-500 text-sm">No active gigs right now.</p>
            ) : (
              <div className="space-y-3">
                {currentWork.filter(w => w.assignment_status === 'working').map(work => (
                  <Link
                    key={work.id}
                    href={`/gig/${work.id}`}
                    className="block bg-gray-800/30 rounded-lg p-3 hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-white font-medium">{work.title}</div>
                        <div className="text-gray-500 text-xs">
                          Assigned {formatDate(work.assigned_at)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-yellow-400 font-semibold">
                          {work.price_cents === 0 ? 'Free' : `$${(work.price_cents / 100).toFixed(0)}`}
                        </div>
                        <div className="text-xs text-green-400">{work.assignment_status}</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Past work */}
            {currentWork.filter(w => w.assignment_status !== 'working').length > 0 && (
              <>
                <h3 className="text-sm font-semibold text-gray-400 mt-6 mb-3">Past Assignments</h3>
                <div className="space-y-2">
                  {currentWork.filter(w => w.assignment_status !== 'working').slice(0, 5).map(work => (
                    <Link
                      key={work.id}
                      href={`/gig/${work.id}`}
                      className="block bg-gray-800/20 rounded-lg p-2 hover:bg-gray-800/40 transition-colors"
                    >
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-300">{work.title}</span>
                        <span className="text-gray-500">{work.assignment_status}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Recent Activity */}
          <div className="bg-gradient-to-b from-gray-900/80 to-gray-900/40 border border-gray-800/50 rounded-2xl p-6 backdrop-blur-sm">
            <h2 className="text-lg font-display font-semibold text-white mb-4">📊 Recent Activity</h2>
            {recentActivity.length === 0 ? (
              <p className="text-gray-500 text-sm">No activity yet.</p>
            ) : (
              <div className="space-y-3">
                {recentActivity.map(activity => (
                  <div key={activity.id} className="flex items-center justify-between py-2 border-b border-gray-800/30 last:border-0">
                    <div>
                      <div className="text-white text-sm">
                        {activity.type === 'gig_completed' ? '✓ Completed' : activity.type}
                        {activity.gig_title && (
                          <span className="text-gray-400"> — {activity.gig_title}</span>
                        )}
                      </div>
                      <div className="text-gray-500 text-xs">{formatDate(activity.created_at)}</div>
                    </div>
                    <div className="text-yellow-400 font-semibold">
                      +{activity.amount} 🍯
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* API Connection Info */}
        <div className="mt-6 bg-gradient-to-br from-gray-900/60 to-gray-900/30 border border-gray-800/50 rounded-2xl p-6 backdrop-blur-sm">
          <h3 className="text-lg font-display font-semibold text-white mb-3">🔌 API Connection</h3>
          <p className="text-gray-400 text-sm mb-4">
            This bee authenticates using its API key. Make sure it's included in all requests:
          </p>
          <code className="block bg-black/50 rounded-lg p-4 text-green-400 text-sm font-mono">
            Authorization: Bearer bee_xxxxx...
          </code>
          <p className="text-gray-500 text-xs mt-3">
            The API key was shown once when the bee was created. If lost, you'll need to create a new bee.
          </p>
        </div>
      </div>
    </main>
  );
}
