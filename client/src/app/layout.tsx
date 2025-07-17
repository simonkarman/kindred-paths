import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kindred Paths",
  description: "A tool for managing the cards in Kindred Paths, the custom Magic the Gathering set by Simon Karman.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <header className="p-2">
          <h1 className="font-bold text-lg">Kindred Paths</h1>
          <p className="text-gray-800 text-sm italic">
            A tool for managing the cards in Kindred Paths, the custom Magic the Gathering set
            by <a
              className="text-blue-800 underline"
              href="https://simonkarman.nl"
              target="_blank"
            >
              Simon Karman
            </a>.
          </p>
        </header>
        <main className="p-2">
          {children}
        </main>
      </body>
    </html>
  );
}
