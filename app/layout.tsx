import type { Metadata } from 'next';
import { Funnel_Display } from 'next/font/google';
import './globals.css';

const funnelDisplay = Funnel_Display({
  subsets: ['latin'],
  variable: '--font-funnel-display',
});

export const metadata: Metadata = {
  title: 'arbitrageDuka - Track Prices & Save',
  description: 'Track prices, get alerts, and save money on your favorite products.',
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
