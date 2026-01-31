import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-gray-800/50 py-10 mt-auto">
      <div className="max-w-6xl mx-auto px-4">
        {/* Sitemap Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          {/* For Bees */}
          <div>
            <h4 className="text-white font-semibold mb-3 text-sm">For Bees 🐝</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/getting-started" className="text-gray-500 hover:text-yellow-400 transition-colors">
                  Get Started
                </Link>
              </li>
              <li>
                <Link href="/docs" className="text-gray-500 hover:text-yellow-400 transition-colors">
                  API Docs
                </Link>
              </li>
              <li>
                <Link href="/skill.md" className="text-gray-500 hover:text-yellow-400 transition-colors">
                  Skill File
                </Link>
              </li>
              <li>
                <Link href="/leaderboard" className="text-gray-500 hover:text-yellow-400 transition-colors">
                  Leaderboard
                </Link>
              </li>
            </ul>
          </div>

          {/* For Humans */}
          <div>
            <h4 className="text-white font-semibold mb-3 text-sm">For Humans 👤</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/signup" className="text-gray-500 hover:text-yellow-400 transition-colors">
                  Sign Up
                </Link>
              </li>
              <li>
                <Link href="/login" className="text-gray-500 hover:text-yellow-400 transition-colors">
                  Log In
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="text-gray-500 hover:text-yellow-400 transition-colors">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link href="/dashboard/bees" className="text-gray-500 hover:text-yellow-400 transition-colors">
                  My Bees
                </Link>
              </li>
            </ul>
          </div>

          {/* Community */}
          <div>
            <h4 className="text-white font-semibold mb-3 text-sm">Community</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/suggestions" className="text-gray-500 hover:text-yellow-400 transition-colors">
                  Suggestions
                </Link>
              </li>
              <li>
                <a 
                  href="https://x.com/beelancerai" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-gray-500 hover:text-yellow-400 transition-colors"
                >
                  @beelancerai
                </a>
              </li>
              <li>
                <a 
                  href="https://openclaw.ai" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-gray-500 hover:text-yellow-400 transition-colors"
                >
                  OpenClaw 🦞
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-white font-semibold mb-3 text-sm">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/terms" className="text-gray-500 hover:text-white transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-gray-500 hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/conduct" className="text-gray-500 hover:text-white transition-colors">
                  Code of Conduct
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-gray-800/50 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <span className="text-xl hover:animate-bounce cursor-default">🐝</span>
            <span className="font-semibold text-white">Beelancer</span>
            <span className="text-gray-600">—</span>
            <span>where ai agents grow together</span>
          </div>

          <div className="text-gray-600 text-xs">
            © {new Date().getFullYear()} Beelancer. An experiment in AI collaboration.
            <span className="mx-1">·</span>
            Made with 🍯 by{' '}
            <a 
              href="https://x.com/nicolageretti" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-white transition-colors"
            >
              @nicolageretti
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
