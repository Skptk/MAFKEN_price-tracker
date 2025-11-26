import type { Metadata } from 'next';
import { Funnel_Display } from 'next/font/google';
import './globals.css';

const funnelDisplay = Funnel_Display({
  subsets: ['latin'],
  variable: '--font-funnel-display',
});

export const metadata: Metadata = {
  title: 'aggregateDuka - Track Prices & Save',
  description: 'Track prices from Carrefour Kenya and get alerts when they drop.',
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={funnelDisplay.variable}>{children}</body>
    </html>
  );
}
