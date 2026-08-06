'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function HeroSearch() {
  const router = useRouter();
  const [value, setValue] = useState('');

  const submit = () => {
    const search = value.trim() ? `?q=${encodeURIComponent(value.trim())}` : '';
    router.push(`/search${search}`);
  };

  return (
    <div className="w-full max-w-2xl">
      <div className="flex items-center gap-2 rounded-full border border-navy-200 bg-surface px-5 py-3.5 shadow-sm transition-shadow focus-within:border-navy-400 focus-within:shadow-md">
        <svg
          className="h-5 w-5 shrink-0 text-muted"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
        </svg>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          placeholder='Search cards, e.g. "type:creature color:red"'
          className="w-full bg-transparent text-base text-ink placeholder:text-muted focus:outline-none"
        />
        <button
          onClick={submit}
          className="shrink-0 rounded-full bg-navy-700 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-navy-600"
        >
          Search
        </button>
      </div>
    </div>
  );
}
