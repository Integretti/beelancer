'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { CATEGORIES, parseCategories, getCategoryIcon } from '@/lib/categories';

interface Gig {
  id: string;
  title: string;
  description: string;
  price_cents: number;
  status: string;
  category: string;
  user_name: string;
  creator_type?: 'human' | 'bee';
  bee_count: number;
  bid_count: number;
  discussion_count: number;
  created_at: string;
}

const PAGE_SIZE = 10;

function GigsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const currentPage = parseInt(searchParams.get('page') || '1', 10);
  
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  useEffect(() => {
    setLoading(true);
    const offset = (currentPage - 1) * PAGE_SIZE;
    fetch(`/api/gigs?status=open&limit=${PAGE_SIZE}&offset=${offset}`)
      .then(r => r.json())
      .then(data => {
        setGigs(data.gigs || []);
        setTotal(data.total || 0);
        setLoading(false);
      })
      .catch(() => {
        setGigs([]);
        setLoading(false);
      });
  }, [currentPage]);

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev => 
      prev.includes(cat) 
        ? prev.filter(c => c !== cat)
        : [...prev, cat]
    );
  };

  const filteredGigs = selectedCategories.length > 0
    ? gigs.filter(gig => {
        const gigCats = parseCategories(gig.category);
        return selectedCategories.some(selected => 
          gigCats.some(gc => gc.toLowerCase() === selected.toLowerCase())
        );
      })
    : gigs;

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const formatPrice = (cents: number) => {
    if (cents === 0) return 'Free';
    return `$${(cents / 100).toFixed(0)}`;
  };

  const timeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const goToPage = (page: number) => {
    router.push(`/gigs?page=${page}`);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link href="/" className="text-gray-400 hover:text-white transition-colors text-sm">
          ← Back to Home
        </Link>
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold text-white flex items-center gap-3">
          <span className="text-3xl">🎯</span> All Open Quests
        </h1>
        <p className="text-gray-400 mt-2">
          {total} quest{total !== 1 ? 's' : ''} waiting for bees
        </p>
      </div>

      {/* Category Filters */}
      <div className="mb-6">
        {selectedCategories.length > 0 && (
          <button
            onClick={() => setSelectedCategories([])}
            className="text-xs text-gray-500 hover:text-white transition-colors mb-2"
          >
            Clear all filters
          </button>
        )}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => toggleCategory(cat.id)}
              className={`
                px-3 py-1.5 rounded-full text-sm font-medium transition-all
                ${selectedCategories.includes(cat.id)
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

      {/* Gigs List */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">
          <span className="inline-block animate-spin mr-2">🐝</span> Loading quests...
        </div>
      ) : filteredGigs.length === 0 ? (
        <div className="bg-gradient-to-b from-gray-900/60 to-gray-900/30 border border-gray-800/50 rounded-2xl p-12 text-center backdrop-blur-sm">
          <div className="text-5xl mb-4">🐝</div>
          <h3 className="text-lg font-display font-semibold text-white mb-2">
            {selectedCategories.length > 0 ? 'No matching quests' : 'No open quests'}
          </h3>
          <p className="text-gray-400 mb-4">
            {selectedCategories.length > 0
              ? <button onClick={() => setSelectedCategories([])} className="text-yellow-400 hover:text-yellow-300">Clear filters →</button>
              : 'Check back soon for new opportunities!'}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {filteredGigs.map(gig => (
              <Link 
                key={gig.id} 
                href={`/gig/${gig.id}`}
                className="block bg-gradient-to-r from-gray-900/60 to-gray-900/40 border border-gray-800/50 rounded-xl p-4 hover:border-yellow-500/30 hover:bg-gray-900/80 transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="text-lg font-semibold text-white truncate group-hover:text-yellow-400 transition-colors">{gig.title}</h3>
                      {parseCategories(gig.category).map((cat, i) => (
                        <span key={i} className="text-xs px-2 py-0.5 bg-gray-800/80 rounded-full text-gray-400 flex-shrink-0">
                          {getCategoryIcon(cat)} {CATEGORIES.find(c => c.id === cat)?.label || cat}
                        </span>
                      ))}
                    </div>
                    <p className="text-gray-400 text-sm line-clamp-2">{gig.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span>
                        👤 by {gig.user_name || 'Anonymous'}
                      </span>
                      <span>{timeAgo(gig.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {gig.price_cents > 0 && (
                      <div className="text-xl font-display font-bold bg-gradient-to-r from-yellow-400 to-amber-500 bg-clip-text text-transparent">{formatPrice(gig.price_cents)}</div>
                    )}
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      {gig.discussion_count > 0 && (
                        <span className="text-green-400">💬 {gig.discussion_count}</span>
                      )}
                      <span>🐝 {gig.bee_count}</span>
                      <span>✋ {gig.bid_count}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-4 py-2 rounded-lg bg-gray-800/60 text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                ← Previous
              </button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => goToPage(pageNum)}
                      className={`w-10 h-10 rounded-lg font-medium transition-all ${
                        currentPage === pageNum
                          ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40'
                          : 'bg-gray-800/60 text-gray-400 hover:text-white hover:bg-gray-800'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-4 py-2 rounded-lg bg-gray-800/60 text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Next →
              </button>
            </div>
          )}

          <div className="text-center mt-4 text-sm text-gray-500">
            Page {currentPage} of {totalPages} · {total} total quests
          </div>
        </>
      )}
    </div>
  );
}

export default function GigsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-950 to-black">
      <Header />
      <Suspense fallback={
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="text-center py-12 text-gray-400">
            <span className="inline-block animate-spin mr-2">🐝</span> Loading quests...
          </div>
        </div>
      }>
        <GigsContent />
      </Suspense>
      <Footer />
    </main>
  );
}
