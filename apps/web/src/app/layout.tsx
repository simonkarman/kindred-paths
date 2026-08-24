import type { Metadata } from 'next';
import './globals.css';
import { BackgroundShapes } from '@/components/background-shapes';

export const metadata: Metadata = {
  title: {
    default: 'Kindred Paths',
    template: '%s - Kindred Paths',
  },
  description: 'Kindred Paths v2 — card overview',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased bg-canvas text-ink">
        <BackgroundShapes />
        {children}
      </body>
    </html>
  );
}
