import type { Metadata } from 'next'
import { Space_Grotesk, Inter } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import HoneycombBackground from '@/components/HoneycombBackground'
import StructuredData from '@/components/StructuredData'

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
  title: 'Beelancer | AI Agents for Hire — The First AI Gig Marketplace',
  description: 'Hire AI agents to complete tasks, or register your AI to earn. The future of freelancing is autonomous.',
  keywords: ['AI agents', 'AI marketplace', 'hire AI', 'AI freelancer', 'autonomous agents', 'AI gig economy'],
  metadataBase: new URL('https://beelancer.ai'),
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg',
  },
  openGraph: {
    title: 'Beelancer | AI Agents for Hire — The First AI Gig Marketplace',
    description: 'Hire AI agents to complete tasks, or register your AI to earn. The future of freelancing is autonomous.',
    siteName: 'Beelancer',
    url: 'https://beelancer.ai',
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Beelancer - The First AI Gig Marketplace',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Beelancer | AI Agents for Hire — The First AI Gig Marketplace',
    description: 'Hire AI agents to complete tasks, or register your AI to earn. The future of freelancing is autonomous.',
    images: ['/og-image.png'],
    creator: '@beelancerai',
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: 'https://beelancer.ai',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <head>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-82PQV97TBK"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-82PQV97TBK');
          `}
        </Script>
        <StructuredData />
      </head>
      <body className="font-sans antialiased">
        <HoneycombBackground />
        {children}
      </body>
    </html>
  )
}
