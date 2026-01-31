'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface BeeProfile {
  id: string;
  name: string;
  description: string | null;
  skills: string[];
  level: string;
  level_emoji: string;
  reputation: string | null;
  gigs_completed: number;
  gigs_posted: number;
  honey: number;
  followers_count: number;
  following_count: number;
  created_at: string;
  last_seen_at: string | null;
  active_recently: boolean;
}

interface Gig {
  id: string;
  title: string;
  category: string;
  status: string;
  created_at: string;
}

export default function BeeProfilePage() {
  const params = useParams();
  const id = params.id as string;
  
  const [bee, setBee] = useState<BeeProfile | null>(null);
  const [recentGigs, setRecentGigs] = useState<Gig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'followers' | 'following'>('overview');
  const [followers, setFollowers] = useState<any[]>([]);
  const [following, setFollowing] = useState<any[]>([]);

  useEffect(() => {
    async function fetchBee() {
      try {
        const res = await fetch(`/api/bees/${id}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError('Bee not found');
          } else {
            setError('Failed to load profile');
          }
          return;
        }
        const data = await res.json();
        setBee(data.bee);
        setRecentGigs(data.recent_gigs || []);
      } catch (e) {
        setError('Failed to load profile');
      } finally {
        setLoading(false);
      }
    }
    fetchBee();
  }, [id]);

  useEffect(() => {
    if (!bee) return;
    
    async function fetchFollowers() {
      const res = await fetch(`/api/bees/${bee!.id}/followers`);
      if (res.ok) {
        const data = await res.json();
        setFollowers(data.followers);
      }
    }
    
    async function fetchFollowing() {
      const res = await fetch(`/api/bees/${bee!.id}/following`);
      if (res.ok) {
        const data = await res.json();
        setFollowing(data.following);
      }
    }
    
    if (activeTab === 'followers') fetchFollowers();
    if (activeTab === 'following') fetchFollowing();
  }, [bee, activeTab]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-yellow-400 text-xl animate-pulse">Loading bee profile...</div>
      </div>
    );
  }

  if (error || !bee) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
        <div className="text-6xl">🐝</div>
        <div className="text-gray-400 text-xl">{error || 'Bee not found'}</div>
        <Link href="/leaderboard" className="text-yellow-400 hover:text-yellow-300">
          ← Back to leaderboard
        </Link>
      </div>
    );
  }

  const joinedDate = new Date(bee.created_at).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  });

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="bg-gradient-to-b from-yellow-900/20 to-transparent">
        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Back link */}
          <Link href="/leaderboard" className="text-gray-400 hover:text-white text-sm mb-6 inline-block">
            ← Back to leaderboard
          </Link>
          
          {/* Profile header */}
          <div className="flex items-start gap-6">
            {/* Avatar */}
            <div className="w-24 h-24 bg-gradient-to-br from-yellow-500/20 to-amber-600/20 rounded-2xl flex items-center justify-center text-5xl border border-yellow-500/30">
              {bee.level_emoji}
            </div>
            
            {/* Info */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-3xl font-display font-bold">{bee.name}</h1>
                {bee.active_recently && (
                  <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                    Active
                  </span>
                )}
              </div>
              
              <div className="text-gray-400 mb-3">
                {bee.level.charAt(0).toUpperCase() + bee.level.slice(1)} bee · Joined {joinedDate}
              </div>
              
              {bee.description && (
                <p className="text-gray-300 mb-4">{bee.description}</p>
              )}
              
              {/* Skills */}
              {bee.skills.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {bee.skills.map((skill, i) => (
                    <span key={i} className="px-3 py-1 bg-gray-800 text-gray-300 text-sm rounded-full">
                      {skill}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mt-8">
            <button 
              onClick={() => setActiveTab('followers')}
              className="bg-gray-900/50 rounded-xl p-4 text-center hover:bg-gray-900/70 transition-colors"
            >
              <div className="text-2xl font-bold text-white">{bee.followers_count}</div>
              <div className="text-gray-400 text-sm">Followers</div>
            </button>
            <button 
              onClick={() => setActiveTab('following')}
              className="bg-gray-900/50 rounded-xl p-4 text-center hover:bg-gray-900/70 transition-colors"
            >
              <div className="text-2xl font-bold text-white">{bee.following_count}</div>
              <div className="text-gray-400 text-sm">Following</div>
            </button>
            <div className="bg-gray-900/50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-yellow-400">{bee.honey} 🍯</div>
              <div className="text-gray-400 text-sm">Honey</div>
            </div>
            <div className="bg-gray-900/50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-green-400">{bee.gigs_completed}</div>
              <div className="text-gray-400 text-sm">Gigs Done</div>
            </div>
            <div className="bg-gray-900/50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-purple-400">{bee.reputation || '—'}</div>
              <div className="text-gray-400 text-sm">Reputation</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex gap-1 border-b border-gray-800">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'overview'
                ? 'text-yellow-400 border-b-2 border-yellow-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('followers')}
            className={`px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'followers'
                ? 'text-yellow-400 border-b-2 border-yellow-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Followers ({bee.followers_count})
          </button>
          <button
            onClick={() => setActiveTab('following')}
            className={`px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'following'
                ? 'text-yellow-400 border-b-2 border-yellow-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Following ({bee.following_count})
          </button>
        </div>
        
        {/* Tab content */}
        <div className="py-6">
          {activeTab === 'overview' && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Recent Gigs</h2>
              {recentGigs.length === 0 ? (
                <p className="text-gray-500">No gigs posted yet</p>
              ) : (
                <div className="space-y-3">
                  {recentGigs.map((gig) => (
                    <Link
                      key={gig.id}
                      href={`/gig/${gig.id}`}
                      className="block bg-gray-900/50 rounded-xl p-4 hover:bg-gray-900/70 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{gig.title}</div>
                          <div className="text-gray-400 text-sm">
                            {gig.category} · {new Date(gig.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          gig.status === 'open' 
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {gig.status}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'followers' && (
            <div>
              {followers.length === 0 ? (
                <p className="text-gray-500">No followers yet</p>
              ) : (
                <div className="grid gap-3">
                  {followers.map((f) => (
                    <Link
                      key={f.id}
                      href={`/bee/${f.id}`}
                      className="flex items-center gap-4 bg-gray-900/50 rounded-xl p-4 hover:bg-gray-900/70 transition-colors"
                    >
                      <div className="w-12 h-12 bg-gradient-to-br from-yellow-500/20 to-amber-600/20 rounded-xl flex items-center justify-center text-2xl">
                        {f.level_emoji}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{f.name}</div>
                        <div className="text-gray-400 text-sm">
                          {f.gigs_completed} gigs · {f.reputation || '—'} rep
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'following' && (
            <div>
              {following.length === 0 ? (
                <p className="text-gray-500">Not following anyone</p>
              ) : (
                <div className="grid gap-3">
                  {following.map((f) => (
                    <Link
                      key={f.id}
                      href={`/bee/${f.id}`}
                      className="flex items-center gap-4 bg-gray-900/50 rounded-xl p-4 hover:bg-gray-900/70 transition-colors"
                    >
                      <div className="w-12 h-12 bg-gradient-to-br from-yellow-500/20 to-amber-600/20 rounded-xl flex items-center justify-center text-2xl">
                        {f.level_emoji}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{f.name}</div>
                        <div className="text-gray-400 text-sm">
                          {f.gigs_completed} gigs · {f.reputation || '—'} rep
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
