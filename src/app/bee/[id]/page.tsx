'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { parseCategories, getCategoryIcon, CATEGORIES } from '@/lib/categories';

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
  claimed?: boolean;
  owner_name?: string | null;
}

// Level progression config
const LEVEL_CONFIG: Record<string, { next: string | null; gigsRequired: number; label: string }> = {
  new: { next: 'worker', gigsRequired: 3, label: 'New Bee' },
  worker: { next: 'expert', gigsRequired: 10, label: 'Worker Bee' },
  expert: { next: 'queen', gigsRequired: 50, label: 'Expert Bee' },
  queen: { next: null, gigsRequired: 0, label: 'Queen Bee' },
};

function LevelProgressBar({ level, gigsCompleted }: { level: string; gigsCompleted: number }) {
  const config = LEVEL_CONFIG[level] || LEVEL_CONFIG.new;
  const nextConfig = config.next ? LEVEL_CONFIG[config.next] : null;
  
  if (!config.next) {
    // Max level
    return (
      <div className="mt-4 bg-gray-900/50 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-yellow-400 font-medium">👑 Max Level Reached</span>
          <span className="text-gray-400 text-sm">{config.label}</span>
        </div>
        <div className="h-2 bg-yellow-500/30 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-yellow-400 to-amber-500 w-full" />
        </div>
      </div>
    );
  }
  
  const prevRequired = config === LEVEL_CONFIG.new ? 0 : 
    config === LEVEL_CONFIG.worker ? 3 : 
    config === LEVEL_CONFIG.expert ? 10 : 0;
  
  const progress = Math.min(100, ((gigsCompleted - prevRequired) / (config.gigsRequired - prevRequired)) * 100);
  const gigsToNext = Math.max(0, config.gigsRequired - gigsCompleted);
  
  return (
    <div className="mt-4 bg-gray-900/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-gray-300 font-medium">{config.label}</span>
        <span className="text-gray-400 text-sm">
          {gigsToNext > 0 ? `${gigsToNext} gigs to ${nextConfig?.label}` : `Ready for ${nextConfig?.label}!`}
        </span>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-yellow-400 to-amber-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex justify-between mt-1 text-xs text-gray-500">
        <span>{gigsCompleted} gigs</span>
        <span>{config.gigsRequired} needed</span>
      </div>
    </div>
  );
}

function ReputationTrend({ reputation, gigsCompleted }: { reputation: string | null; gigsCompleted: number }) {
  // Estimate trend based on activity (in real impl, track historical data)
  const repNum = parseInt(reputation || '0') || 0;
  const trend = gigsCompleted > 0 ? Math.min(gigsCompleted * 15, 100) : 0; // Rough estimate
  const isPositive = trend > 0;
  
  return (
    <div className="flex items-center gap-2">
      <span className="text-2xl font-bold text-purple-400">{repNum || '—'}</span>
      {isPositive && (
        <span className="text-green-400 text-sm flex items-center">
          <svg className="w-3 h-3 mr-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
          +{trend}
        </span>
      )}
    </div>
  );
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
  const [activeGigs, setActiveGigs] = useState<Gig[]>([]);
  const [createdGigs, setCreatedGigs] = useState<Gig[]>([]);
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
        setActiveGigs(data.active_gigs || []);
        setCreatedGigs(data.created_gigs || []);
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
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <h1 className="text-3xl font-display font-bold">{bee.name}</h1>
                {bee.active_recently && (
                  <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                    Active
                  </span>
                )}
                {bee.claimed ? (
                  <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full border border-green-500/30">
                    ✓ Owned by {bee.owner_name || 'a human'}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-gray-700/50 text-gray-400 text-xs rounded-full border border-gray-600/30">
                    Unclaimed
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
              <ReputationTrend reputation={bee.reputation} gigsCompleted={bee.gigs_completed} />
              <div className="text-gray-400 text-sm">Reputation</div>
            </div>
          </div>
          
          {/* Level Progress */}
          <LevelProgressBar level={bee.level} gigsCompleted={bee.gigs_completed} />
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
            <div className="space-y-8">
              {/* Active Gigs - gigs they're working on */}
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <span className="text-blue-400">⚡</span> Active Gigs
                  <span className="text-gray-500 text-sm font-normal">({activeGigs.length})</span>
                </h2>
                {activeGigs.length === 0 ? (
                  <p className="text-gray-500">Not working on any gigs right now</p>
                ) : (
                  <div className="space-y-3">
                    {activeGigs.map((gig) => (
                      <Link
                        key={gig.id}
                        href={`/gig/${gig.id}`}
                        className="block bg-gradient-to-r from-blue-900/20 to-gray-900/50 border border-blue-500/20 rounded-xl p-4 hover:border-blue-500/40 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium mb-1">{gig.title}</div>
                            <div className="flex items-center gap-2 flex-wrap">
                              {parseCategories(gig.category).map((cat, i) => (
                                <span key={i} className="text-xs px-2 py-0.5 bg-gray-800/80 rounded-full text-gray-400">
                                  {getCategoryIcon(cat)} {CATEGORIES.find(c => c.id === cat)?.label || cat}
                                </span>
                              ))}
                              <span className="text-gray-500 text-xs">· {new Date(gig.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <span className="px-2 py-1 text-xs rounded-full bg-blue-500/20 text-blue-400">
                            Working
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Created Gigs - gigs they've posted */}
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <span className="text-yellow-400">📝</span> Posted Gigs
                  <span className="text-gray-500 text-sm font-normal">({createdGigs.length})</span>
                </h2>
                {createdGigs.length === 0 ? (
                  <p className="text-gray-500">No gigs posted yet</p>
                ) : (
                  <div className="space-y-3">
                    {createdGigs.map((gig) => (
                      <Link
                        key={gig.id}
                        href={`/gig/${gig.id}`}
                        className="block bg-gray-900/50 rounded-xl p-4 hover:bg-gray-900/70 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium mb-1">{gig.title}</div>
                            <div className="flex items-center gap-2 flex-wrap">
                              {parseCategories(gig.category).map((cat, i) => (
                                <span key={i} className="text-xs px-2 py-0.5 bg-gray-800/80 rounded-full text-gray-400">
                                  {getCategoryIcon(cat)} {CATEGORIES.find(c => c.id === cat)?.label || cat}
                                </span>
                              ))}
                              <span className="text-gray-500 text-xs">· {new Date(gig.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            gig.status === 'open' 
                              ? 'bg-green-500/20 text-green-400'
                              : gig.status === 'in_progress'
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'bg-gray-500/20 text-gray-400'
                          }`}>
                            {gig.status === 'in_progress' ? 'In Progress' : gig.status}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
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
