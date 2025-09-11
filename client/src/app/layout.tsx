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
        className={`${geistSans.variable} ${geistMono.variable} flex flex-col antialiased w-262 mx-auto min-h-svh`}
      >
        <header className="print:hidden flex items-end justify-between p-2 py-1 border-zinc-200">
          <div>
            <Link href={"/"}>
              <h1 className="font-bold text-lg tracking-wide">Kindred Paths</h1>
            </Link>
            <p className="text-zinc-600 text-sm italic">
              A tool for managing a collection of custom Magic the Gathering cards.
            </p>
          </div>
        </header>
        <main className="grow p-2 space-y-2">
          {children}
        </main>
        <footer className="print:hidden w-full text-center text-xs text-zinc-500 p-2">
          Kindred Paths is created by <a className="underline text-blue-600" href="https://simonkarman.nl">Simon Karman</a>.
          Source code on <a className="underline text-blue-600" href="https://github.com/simonkarman/kindred-paths">GitHub</a>.
        </footer>
      </body>
    </html>
  );
}
