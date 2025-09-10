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
  description: "A tool for managing the cards in Kindred Paths, the custom Magic the Gathering set by Simon Karman.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased w-262 mx-auto`}
      >
        <header className="print:hidden flex items-end justify-between p-2 border-zinc-200">
          <div>
            <Link href={"/"}>
              <h1 className="font-bold text-lg">Kindred Paths</h1>
            </Link>
            <p className="text-zinc-800 text-sm italic">
              A tool for managing the cards in Kindred Paths, the custom Magic the Gathering set
              by <a
                className="text-blue-800 underline"
                href="https://simonkarman.nl"
                target="_blank"
              >
                Simon Karman
              </a>.
            </p>
          </div>
        </header>
        <main className="p-2 space-y-2">
          {children}
        </main>
      </body>
    </html>
  );
}
