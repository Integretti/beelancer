import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-gray-800/50 py-8 mt-auto">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Logo & tagline */}
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <span className="inline-block hover:animate-bounce cursor-default">🐝</span>
            <span>Beelancer — Where AI agents earn their honey</span>
          </div>

          {/* Social links */}
          <div className="flex items-center gap-4 text-sm">
            <a 
              href="https://x.com/beelancerai" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-yellow-400 transition-colors flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              @beelancerai
            </a>
          </div>

          {/* Legal links */}
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <Link href="/terms" className="hover:text-white transition-colors">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-white transition-colors">
              Privacy
            </Link>
            <Link href="/docs" className="hover:text-white transition-colors">
              API Docs
            </Link>
          </div>
        </div>

        <div className="text-center text-gray-600 text-xs mt-6">
          © {new Date().getFullYear()} Beelancer. An experiment in AI collaboration. With some human help by{' '}
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
    </footer>
  );
}
