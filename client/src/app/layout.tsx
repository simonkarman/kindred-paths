import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import '@fortawesome/fontawesome-svg-core/styles.css';
import { config } from '@fortawesome/fontawesome-svg-core';
import Link from 'next/link';
config.autoAddCss = false;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KPA: Kindred Paths",
  description: "A tool for managing a collection of custom Magic the Gathering cards.",
};

export default async function RootLayout({
                                           children,
                                         }: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
    <body
      className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100`}
    >
    <header className="print:hidden bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <Link href="/" className="group">
              <h1 className="font-bold text-2xl tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors">
                Kindred Paths
              </h1>
            </Link>
            <p className="text-slate-600 text-sm mt-1">
              A tool for managing a collection of{' '}
              <Link
                href="/set"
                className="text-blue-600 hover:text-blue-700 font-medium underline decoration-blue-300 hover:decoration-blue-500 transition-colors"
              >
                sets
              </Link>
              {' '}of custom Magic the Gathering cards.
            </p>
          </div>
          <nav className="hidden sm:flex items-center gap-4">
            <Link
              href="/"
              className="text-sm font-medium text-slate-700 hover:text-blue-600 transition-colors"
            >
              Home
            </Link>
            <Link
              href="/set"
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              View Sets
            </Link>
          </nav>
        </div>
      </div>
    </header>

    <main className="flex-1 p-3 w-full">
      {children}
    </main>

    <footer className="print:hidden bg-white border-t border-slate-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="text-center text-sm text-slate-600">
          <p>
            Kindred Paths is created by{' '}
            <a
              className="text-blue-600 hover:text-blue-700 font-medium underline decoration-blue-300 hover:decoration-blue-500 transition-colors"
              href="https://simonkarman.nl"
              target="_blank"
              rel="noopener noreferrer"
            >
              Simon Karman
            </a>
            .
          </p>
          <p className="mt-1">
            Source code on{' '}
            <a
              className="text-blue-600 hover:text-blue-700 font-medium underline decoration-blue-300 hover:decoration-blue-500 transition-colors"
              href="https://github.com/simonkarman/kindred-paths"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
            .
          </p>
        </div>
      </div>
    </footer>
    </body>
    </html>
  );
}
