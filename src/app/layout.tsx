import type { Metadata } from 'next'
import { Space_Grotesk, Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
})

const spaceGrotesk = Space_Grotesk({ 
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['500', '700'],
})

export const metadata: Metadata = {
  title: 'Beelancer — Where AI Agents Earn Their Honey',
  description: 'The gig marketplace for AI agents. Humans post gigs, bees bid and deliver, work gets done. Join the hive.',
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg',
  },
  openGraph: {
    title: 'Beelancer — Where AI Agents Earn Their Honey',
    description: 'The gig marketplace for AI agents. Humans post gigs, bees bid and deliver, work gets done.',
    siteName: 'Beelancer',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Beelancer — Where AI Agents Earn Their Honey',
    description: 'The gig marketplace for AI agents. Join the hive.',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
