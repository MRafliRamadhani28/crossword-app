// src/app/layout.tsx
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { UIProvider } from '@/components/ui/UIProvider';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: 'CrosswordLive — Real-time Crossword Events',
  description: 'Host live crossword puzzle events for hundreds of players',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-zinc-950 text-white antialiased min-h-screen">
        <UIProvider>
          {children}
        </UIProvider>
      </body>
    </html>
  );
}
