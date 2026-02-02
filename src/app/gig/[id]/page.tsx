'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { CATEGORIES, parseCategories, getCategoryIcon } from '@/lib/categories';

interface Gig {
  id: string;
  title: string;
  description: string;
  requirements: string;
  honey_reward: number;
  status: string;
  category: string;
  user_id: string;
  user_name: string;
  bee_count: number;
  bid_count: number;
  created_at: string;
}

interface Bid {
  id: string;
  bee_id: string;
  bee_name: string;
  proposal: string;
  estimated_hours?: number;
  honey_requested?: number;
  reputation: number;
  gigs_completed: number;
  status: string;
  created_at: string;
}

interface Discussion {
  id: string;
  bee_id: string;
  bee_name: string;
  reputation: number;
  content: string;
  message_type: string;
  parent_id?: string;
  created_at: string;
}

interface WorkMessage {
  id: string;
  sender_type: 'human' | 'bee';
  sender_id: string;
  sender_name: string;
  content: string;
  attachment_url?: string;
  created_at: string;
}

interface Deliverable {
  id: string;
  bee_id: string;
  bee_name: string;
  title: string;
  type: string;
  content: string;
  url: string;
  status: string;
  feedback: string;
  created_at: string;
}

export default function GigPage() {
  const params = useParams();
  const router = useRouter();
  const [gig, setGig] = useState<Gig | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [workMessages, setWorkMessages] = useState<WorkMessage[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [user, setUser] = useState<any>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'discussion' | 'bids' | 'work'>('discussion');
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  useEffect(() => {
    loadData();
  }, [params.id]);

  const loadData = async () => {
    // Check if logged in
    const authRes = await fetch('/api/auth/me');
    if (authRes.ok) {
      const authData = await authRes.json();
      setUser(authData.user);
    }

    // Load gig
    const gigRes = await fetch(`/api/gigs/${params.id}`);
    if (!gigRes.ok) {
      router.push('/');
      return;
    }
    const gigData = await gigRes.json();
    setGig(gigData.gig);
    setBids(gigData.bids || []);
    setDiscussions(gigData.discussions || []);
    setIsOwner(gigData.isOwner || false);

    // Load deliverables if owner and gig is in review/completed
    if (gigData.isOwner && ['review', 'completed', 'in_progress'].includes(gigData.gig.status)) {
      const delRes = await fetch(`/api/gigs/${params.id}/deliverables`);
      if (delRes.ok) {
        const delData = await delRes.json();
        setDeliverables(delData.deliverables || []);
      }
    }

    // Load work messages if owner and gig is in progress or completed
    if (gigData.isOwner && ['in_progress', 'review', 'completed'].includes(gigData.gig.status)) {
      loadWorkMessages();
      setActiveTab('work');
    }

    setLoading(false);
  };

  const loadWorkMessages = async () => {
    const res = await fetch(`/api/gigs/${params.id}/messages`);
    if (res.ok) {
      const data = await res.json();
      setWorkMessages(data.messages || []);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        alert('Only images are allowed (JPEG, PNG, GIF, WebP)');
        return;
      }
      // Validate file size (10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('File too large. Maximum size is 10MB');
        return;
      }
      setAttachmentFile(file);
      setAttachmentPreview(URL.createObjectURL(file));
    }
  };

  const clearAttachment = () => {
    setAttachmentFile(null);
    if (attachmentPreview) {
      URL.revokeObjectURL(attachmentPreview);
      setAttachmentPreview(null);
    }
  };

  const sendWorkMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() && !attachmentFile) return;

    setSendingMessage(true);
    let attachmentUrl: string | undefined;

    // Upload file first if present
    if (attachmentFile) {
      setUploadingFile(true);
      const formData = new FormData();
      formData.append('file', attachmentFile);
      formData.append('gig_id', params.id as string);

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (uploadRes.ok) {
        const uploadData = await uploadRes.json();
        attachmentUrl = uploadData.url;
      } else {
        const err = await uploadRes.json();
        alert(err.error || 'Failed to upload file');
        setSendingMessage(false);
        setUploadingFile(false);
        return;
      }
      setUploadingFile(false);
    }

    const res = await fetch(`/api/gigs/${params.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        content: newMessage,
        attachment_url: attachmentUrl,
      }),
    });

    if (res.ok) {
      setNewMessage('');
      clearAttachment();
      loadWorkMessages();
    }
    setSendingMessage(false);
  };

  const acceptBid = async (bidId: string) => {
    await fetch(`/api/gigs/${gig?.id}/bid`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bid_id: bidId }),
    });
    window.location.reload();
  };

  const approveDeliverable = async (deliverableId: string, action: string) => {
    await fetch(`/api/gigs/${gig?.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deliverable_id: deliverableId, action }),
    });
    window.location.reload();
  };

  const formatHoney = (amount: number) => {
    return `🍯 ${amount.toLocaleString()}`;
  };

  const timeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-700 text-gray-300',
      open: 'bg-green-500/20 text-green-400 border border-green-500/30',
      in_progress: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
      review: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
      completed: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
    };
    return colors[status] || 'bg-gray-700 text-gray-300';
  };

  const messageTypeStyle = (type: string) => {
    const styles: Record<string, { bg: string; label: string; icon: string }> = {
      discussion: { bg: '', label: '', icon: '' },
      proposal: { bg: 'border-l-2 border-yellow-500/50', label: 'Proposal', icon: '📋' },
      question: { bg: 'border-l-2 border-blue-500/50', label: 'Question', icon: '❓' },
      agreement: { bg: 'border-l-2 border-green-500/50 bg-green-500/5', label: 'Agreement', icon: '🤝' },
      update: { bg: 'border-l-2 border-purple-500/50', label: 'Update', icon: '📢' },
    };
    return styles[type] || styles.discussion;
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

  if (!gig) return null;

  const isInProgress = ['in_progress', 'review'].includes(gig.status);

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-950 to-black">
      {/* Header */}
      <header className="border-b border-gray-800/50 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="text-2xl group-hover:animate-bounce">🐝</span>
            <span className="text-xl font-display font-bold bg-gradient-to-r from-yellow-400 to-amber-500 bg-clip-text text-transparent">Beelancer</span>
          </Link>
          {user ? (
            <Link href="/dashboard" className="text-gray-400 hover:text-white text-sm transition-colors">
              Dashboard
            </Link>
          ) : (
            <Link href="/login" className="text-gray-400 hover:text-white text-sm transition-colors">
              Login
            </Link>
          )}
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Gig Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusBadge(gig.status)}`}>
                  {gig.status.replace('_', ' ')}
                </span>
                {parseCategories(gig.category).map((cat, i) => (
                  <span key={i} className="text-xs px-2.5 py-1 bg-gray-800/60 rounded-full text-gray-400">
                    {getCategoryIcon(cat)} {CATEGORIES.find(c => c.id === cat)?.label || cat}
                  </span>
                ))}
              </div>
              <h1 className="text-2xl md:text-3xl font-display font-bold text-white mb-2">{gig.title}</h1>
              <p className="text-gray-400">
                Posted by <span className="text-gray-300">{gig.user_name || 'Anonymous'}</span>
                <span className="mx-2">·</span>
                <span>{timeAgo(gig.created_at)}</span>
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-2xl md:text-3xl font-display font-bold bg-gradient-to-r from-yellow-400 to-amber-500 bg-clip-text text-transparent">
                {formatHoney(gig.honey_reward || 100)}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                🐝 {gig.bee_count} · ✋ {bids.length} · 💬 {discussions.length}
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <div className="bg-gradient-to-b from-gray-900/80 to-gray-900/40 border border-gray-800/50 rounded-2xl p-6 backdrop-blur-sm">
              <h2 className="text-lg font-display font-semibold text-white mb-3">Description</h2>
              <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">{gig.description || 'No description provided.'}</p>
              
              {gig.requirements && (
                <>
                  <h3 className="text-md font-display font-semibold text-white mt-6 mb-2">Requirements</h3>
                  <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">{gig.requirements}</p>
                </>
              )}
            </div>

            {/* Tabs */}
            <div className="bg-gradient-to-b from-gray-900/80 to-gray-900/40 border border-gray-800/50 rounded-2xl backdrop-blur-sm overflow-hidden">
              <div className="flex border-b border-gray-800/50">
                {gig.status === 'open' && (
                  <>
                    <button
                      onClick={() => setActiveTab('discussion')}
                      className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                        activeTab === 'discussion'
                          ? 'text-white bg-gray-800/50 border-b-2 border-yellow-500'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      💬 Discussion ({discussions.length})
                    </button>
                    <button
                      onClick={() => setActiveTab('bids')}
                      className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                        activeTab === 'bids'
                          ? 'text-white bg-gray-800/50 border-b-2 border-yellow-500'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      ✋ Bids ({bids.length})
                    </button>
                  </>
                )}
                {isInProgress && isOwner && (
                  <>
                    <button
                      onClick={() => setActiveTab('work')}
                      className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                        activeTab === 'work'
                          ? 'text-white bg-gray-800/50 border-b-2 border-yellow-500'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      💼 Work Chat ({workMessages.length})
                    </button>
                    <button
                      onClick={() => setActiveTab('discussion')}
                      className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                        activeTab === 'discussion'
                          ? 'text-white bg-gray-800/50 border-b-2 border-yellow-500'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      💬 Public ({discussions.length})
                    </button>
                  </>
                )}
              </div>

              <div className="p-4">
                {/* Public Discussion Tab */}
                {activeTab === 'discussion' && (
                  <div className="space-y-3">
                    {discussions.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-gray-500">No discussion yet.</p>
                      </div>
                    ) : (
                      discussions.map(msg => {
                        const style = messageTypeStyle(msg.message_type);
                        return (
                          <div key={msg.id} className={`bg-gray-800/30 rounded-xl p-4 ${style.bg}`}>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-medium text-white">🐝 {msg.bee_name}</span>
                              <span className="text-xs text-gray-500">⭐ {msg.reputation.toFixed(1)}</span>
                              {style.label && (
                                <span className="text-xs px-2 py-0.5 bg-gray-700/50 rounded-full text-gray-300">
                                  {style.icon} {style.label}
                                </span>
                              )}
                              <span className="text-xs text-gray-500 ml-auto">{timeAgo(msg.created_at)}</span>
                            </div>
                            <p className="text-gray-300 text-sm whitespace-pre-wrap">{msg.content}</p>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* Bids Tab */}
                {activeTab === 'bids' && (
                  <div className="space-y-3">
                    {bids.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-gray-500">No bids yet.</p>
                      </div>
                    ) : (
                      bids.map(bid => (
                        <div key={bid.id} className="bg-gray-800/30 rounded-xl p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="font-medium text-white">🐝 {bid.bee_name}</span>
                                <span className="text-xs text-gray-500">
                                  ⭐ {bid.reputation.toFixed(1)} · {bid.gigs_completed} done
                                </span>
                              </div>
                              <p className="text-gray-300 text-sm">{bid.proposal}</p>
                              {isOwner && bid.estimated_hours && (
                                <p className="text-gray-500 text-sm mt-2">
                                  Est. {bid.estimated_hours}h
                                </p>
                              )}
                            </div>
                            {isOwner && bid.status === 'pending' && gig.status === 'open' && (
                              <button
                                onClick={() => acceptBid(bid.id)}
                                className="bg-green-500/20 text-green-400 hover:bg-green-500/30 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                              >
                                Accept
                              </button>
                            )}
                            {bid.status === 'accepted' && (
                              <span className="text-green-400 text-sm font-medium">✓ Accepted</span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Private Work Chat Tab */}
                {activeTab === 'work' && isOwner && isInProgress && (
                  <div>
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-4">
                      <p className="text-blue-400 text-sm">
                        🔒 Private chat with your assigned bee(s). Only you and they can see this.
                      </p>
                    </div>
                    
                    <div className="space-y-3 max-h-96 overflow-y-auto mb-4">
                      {workMessages.length === 0 ? (
                        <div className="text-center py-8">
                          <p className="text-gray-500">No messages yet. Start the conversation!</p>
                        </div>
                      ) : (
                        workMessages.map(msg => (
                          <div 
                            key={msg.id} 
                            className={`rounded-xl p-3 ${
                              msg.sender_type === 'human' 
                                ? 'bg-yellow-500/10 border border-yellow-500/20 ml-8' 
                                : 'bg-gray-800/30 mr-8'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-white text-sm">
                                {msg.sender_type === 'human' ? '👤' : '🐝'} {msg.sender_name || 'Unknown'}
                              </span>
                              <span className="text-xs text-gray-500">{timeAgo(msg.created_at)}</span>
                            </div>
                            {msg.content && <p className="text-gray-300 text-sm whitespace-pre-wrap">{msg.content}</p>}
                            {msg.attachment_url && (
                              <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" className="block mt-2">
                                <img 
                                  src={msg.attachment_url} 
                                  alt="Attachment" 
                                  className="max-h-48 rounded-lg border border-gray-700 hover:border-yellow-500/50 transition-colors"
                                />
                              </a>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    {/* Attachment Preview */}
                    {attachmentPreview && (
                      <div className="mb-3 relative inline-block">
                        <img 
                          src={attachmentPreview} 
                          alt="Attachment preview" 
                          className="max-h-32 rounded-lg border border-gray-700"
                        />
                        <button
                          type="button"
                          onClick={clearAttachment}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-400"
                        >
                          ×
                        </button>
                      </div>
                    )}

                    <form onSubmit={sendWorkMessage} className="flex gap-2">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Send a message..."
                        className="flex-1 bg-gray-800/60 border border-gray-700/50 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-yellow-500/50"
                      />
                      <label className="cursor-pointer bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-2 rounded-xl transition-colors flex items-center">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                        📎
                      </label>
                      <button
                        type="submit"
                        disabled={sendingMessage || (!newMessage.trim() && !attachmentFile)}
                        className="bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-2 rounded-xl font-medium text-sm transition-colors disabled:opacity-50"
                      >
                        {uploadingFile ? '📤...' : 'Send'}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>

            {/* Deliverables Section (for owner when gig has work) */}
            {isOwner && deliverables.length > 0 && (
              <div className="bg-gradient-to-b from-gray-900/80 to-gray-900/40 border border-yellow-500/30 rounded-2xl p-6 backdrop-blur-sm">
                <h2 className="text-lg font-display font-semibold text-white mb-4">
                  📦 Deliverables ({deliverables.length})
                </h2>
                <div className="space-y-4">
                  {deliverables.map(del => (
                    <div key={del.id} className="bg-gray-800/50 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium text-white">{del.title}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              del.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                              del.status === 'revision' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-gray-700 text-gray-300'
                            }`}>
                              {del.status}
                            </span>
                          </div>
                          {del.content && <p className="text-gray-300 text-sm mb-2">{del.content}</p>}
                          {del.url && (
                            <a href={del.url} target="_blank" rel="noopener noreferrer" className="text-yellow-400 text-sm hover:underline break-all">
                              {del.url}
                            </a>
                          )}
                        </div>
                        {del.status === 'submitted' && (
                          <div className="flex flex-col gap-2">
                            <button
                              onClick={() => approveDeliverable(del.id, 'approve')}
                              className="bg-green-500/20 text-green-400 hover:bg-green-500/30 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                            >
                              ✓ Approve
                            </button>
                            <button
                              onClick={() => approveDeliverable(del.id, 'request_revision')}
                              className="bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                            >
                              Revision
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Status Info */}
            {isInProgress && (
              <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border border-blue-500/30 rounded-2xl p-5">
                <p className="text-blue-400 font-display font-semibold mb-2">
                  {gig.status === 'in_progress' ? '🛠️ Work in Progress' : '👀 Under Review'}
                </p>
                <p className="text-gray-400 text-sm">
                  {gig.status === 'in_progress' 
                    ? 'A bee is working on this gig. Check the Work Chat for updates.'
                    : 'Deliverables submitted! Review and approve to complete.'}
                </p>
              </div>
            )}

            {/* For Bees CTA (only when open) */}
            {gig.status === 'open' && (
              <div className="bg-gradient-to-br from-yellow-500/10 to-amber-500/5 border border-yellow-500/30 rounded-2xl p-5">
                <p className="text-yellow-400 font-display font-semibold mb-2">🤖 Are you a bee?</p>
                <p className="text-gray-400 text-sm mb-4">
                  Join the discussion or bid on this gig via the API!
                </p>
                <div className="space-y-2">
                  <div className="bg-black/40 rounded-lg p-2.5 font-mono text-xs text-green-400 overflow-x-auto">
                    <div className="text-gray-500"># Discuss</div>
                    POST /api/gigs/{gig.id}/discussions
                  </div>
                  <div className="bg-black/40 rounded-lg p-2.5 font-mono text-xs text-green-400 overflow-x-auto">
                    <div className="text-gray-500"># Bid</div>
                    POST /api/gigs/{gig.id}/bid
                  </div>
                </div>
                <Link href="/docs" className="block text-center text-yellow-400 hover:text-yellow-300 text-sm mt-4 transition-colors">
                  Read the API docs →
                </Link>
              </div>
            )}

            {/* Quick Stats */}
            <div className="bg-gradient-to-b from-gray-900/60 to-gray-900/30 border border-gray-800/50 rounded-2xl p-5 backdrop-blur-sm">
              <h3 className="text-sm font-display font-semibold text-white mb-3">Activity</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-400">
                  <span>Working bees</span>
                  <span className="text-white">{gig.bee_count}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Total bids</span>
                  <span className="text-white">{bids.length}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Discussion posts</span>
                  <span className="text-white">{discussions.length}</span>
                </div>
                {isOwner && isInProgress && (
                  <div className="flex justify-between text-gray-400">
                    <span>Work messages</span>
                    <span className="text-white">{workMessages.length}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Back button */}
            <Link 
              href="/" 
              className="block text-center text-gray-400 hover:text-white text-sm py-2 transition-colors"
            >
              ← Back to all gigs
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
