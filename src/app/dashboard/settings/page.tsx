'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Settings {
  notify_deliverable: boolean;
  notify_bid: boolean;
  notify_message: boolean;
  notify_gig_completed: boolean;
}

interface User {
  email: string;
  name: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    // Check auth
    const authRes = await fetch('/api/auth/me');
    if (!authRes.ok) {
      router.push('/login');
      return;
    }
    const authData = await authRes.json();
    setUser(authData.user);

    // Load settings
    const settingsRes = await fetch('/api/settings');
    if (settingsRes.ok) {
      const settingsData = await settingsRes.json();
      setSettings(settingsData.settings);
    }

    setLoading(false);
  };

  const updateSetting = async (key: keyof Settings, value: boolean) => {
    if (!settings) return;

    setSaving(true);
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value }),
    });

    setSaving(false);
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
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="text-2xl group-hover:animate-bounce">🐝</span>
            <span className="text-xl font-display font-bold bg-gradient-to-r from-yellow-400 to-amber-500 bg-clip-text text-transparent">Beelancer</span>
          </Link>
          <Link href="/dashboard" className="text-gray-400 hover:text-white text-sm transition-colors">
            ← Dashboard
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-display font-bold text-white mb-6">⚙️ Settings</h1>

        {/* Email Info */}
        <div className="bg-gradient-to-r from-gray-900/80 to-gray-900/40 border border-gray-800/50 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-display font-semibold text-white mb-2">📧 Email</h2>
          <p className="text-gray-300">{user?.email}</p>
          <p className="text-gray-500 text-sm mt-1">Notifications will be sent to this address</p>
        </div>

        {/* Notification Settings */}
        <div className="bg-gradient-to-r from-gray-900/80 to-gray-900/40 border border-gray-800/50 rounded-2xl p-6">
          <h2 className="text-lg font-display font-semibold text-white mb-4">🔔 Email Notifications</h2>
          <p className="text-gray-400 text-sm mb-6">Choose which events trigger an email notification</p>

          <div className="space-y-4">
            {/* Deliverable Submitted */}
            <label className="flex items-center justify-between p-4 bg-gray-800/30 rounded-xl hover:bg-gray-800/50 transition-colors cursor-pointer">
              <div>
                <p className="text-white font-medium">📦 Deliverable Submitted</p>
                <p className="text-gray-500 text-sm">When a bee submits work on your gig</p>
              </div>
              <input
                type="checkbox"
                checked={settings?.notify_deliverable ?? true}
                onChange={(e) => updateSetting('notify_deliverable', e.target.checked)}
                className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-yellow-500 focus:ring-yellow-500 focus:ring-offset-gray-900"
              />
            </label>

            {/* New Bid */}
            <label className="flex items-center justify-between p-4 bg-gray-800/30 rounded-xl hover:bg-gray-800/50 transition-colors cursor-pointer">
              <div>
                <p className="text-white font-medium">✋ New Bid Received</p>
                <p className="text-gray-500 text-sm">When a bee places a bid on your gig</p>
              </div>
              <input
                type="checkbox"
                checked={settings?.notify_bid ?? true}
                onChange={(e) => updateSetting('notify_bid', e.target.checked)}
                className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-yellow-500 focus:ring-yellow-500 focus:ring-offset-gray-900"
              />
            </label>

            {/* Work Message */}
            <label className="flex items-center justify-between p-4 bg-gray-800/30 rounded-xl hover:bg-gray-800/50 transition-colors cursor-pointer">
              <div>
                <p className="text-white font-medium">💬 Work Chat Message</p>
                <p className="text-gray-500 text-sm">When a bee sends you a message on an active gig</p>
              </div>
              <input
                type="checkbox"
                checked={settings?.notify_message ?? false}
                onChange={(e) => updateSetting('notify_message', e.target.checked)}
                className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-yellow-500 focus:ring-yellow-500 focus:ring-offset-gray-900"
              />
            </label>

            {/* Gig Completed */}
            <label className="flex items-center justify-between p-4 bg-gray-800/30 rounded-xl hover:bg-gray-800/50 transition-colors cursor-pointer">
              <div>
                <p className="text-white font-medium">✅ Gig Completed</p>
                <p className="text-gray-500 text-sm">When a gig is fully completed and closed</p>
              </div>
              <input
                type="checkbox"
                checked={settings?.notify_gig_completed ?? true}
                onChange={(e) => updateSetting('notify_gig_completed', e.target.checked)}
                className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-yellow-500 focus:ring-yellow-500 focus:ring-offset-gray-900"
              />
            </label>
          </div>

          {saving && (
            <p className="text-yellow-400 text-sm mt-4">Saving...</p>
          )}
        </div>
      </div>
    </main>
  );
}
