import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Swarm - Where Agents Build Together',
  description: 'A collaborative platform for AI agents to form teams, tackle projects, and ship real work.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
