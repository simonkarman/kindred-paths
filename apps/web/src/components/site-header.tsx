'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useSearchShortcut } from './use-search-shortcut';
import { Logo } from './logo';
import { SocialLinks } from './social-links';

const DEBOUNCE_MS = 1000;

export function SiteHeader() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  useSearchShortcut(inputRef);

  const [value, setValue] = useState(searchParams.get('q') ?? '');
  const [pending, setPending] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks the last committed (navigated-to) query, so we can tell whether a change is
  // "meaningful" (would actually alter the search) vs. incidental (e.g. the trailing space
  // the Cmd/Ctrl+F shortcut appends), which shouldn't spin up the spinner/debounce.
  const lastQueryRef = useRef(searchParams.get('q')?.trim() ?? '');

  // Keep the input in sync if the URL's query changes from elsewhere (e.g. back/forward nav).
  useEffect(() => {
    setValue(searchParams.get('q') ?? '');
    lastQueryRef.current = searchParams.get('q')?.trim() ?? '';
  }, [searchParams]);

  const navigate = (query: string) => {
    const trimmed = query.trim();
    lastQueryRef.current = trimmed;
    const search = trimmed ? `?q=${encodeURIComponent(trimmed)}` : '';
    router.push(`/search${search}`);
    setPending(false);
  };

  const onChange = (next: string) => {
    setValue(next);
    if (next.trim() === lastQueryRef.current) {
      // Only whitespace changed (e.g. the shortcut's trailing space) — nothing to search yet.
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setPending(false);
      return;
    }
    setPending(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => navigate(next), DEBOUNCE_MS);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      navigate(value);
    }
  };

  return (
    <header className="sticky top-0 z-20 border-b border-navy-800/40 bg-gradient-to-r from-navy-800 via-navy-700 to-navy-800 shadow-md">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-3">
        <Link href="/" className="shrink-0 text-white" aria-label="Kindred Paths home">
          <Logo className="h-8 w-8" />
        </Link>

        <div className="flex flex-1 items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 shadow-inner backdrop-blur-sm transition-colors focus-within:border-white/30 focus-within:bg-white/15">
          {pending ? (
            <svg className="h-4 w-4 shrink-0 animate-spin text-white/70" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          ) : (
            <svg className="h-4 w-4 shrink-0 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
            </svg>
          )}
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder='Search cards, e.g. "type:creature color:red"'
            className="w-full bg-transparent text-sm text-white placeholder:text-white/50 focus:outline-none"
          />
        </div>

        <Link
          href="/"
          className="shrink-0 rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/10"
        >
          Sets
        </Link>
        <SocialLinks className="text-white/90" />
      </div>
    </header>
  );
}
