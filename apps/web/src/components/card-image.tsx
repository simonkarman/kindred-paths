'use client';

import { useState } from 'react';

export function CardImage({ cid, name }: { cid: string; name: string }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="relative aspect-[488/684] w-full overflow-hidden rounded-2xl border border-line bg-navy-50 shadow-lg">
      {!loaded && <div className="absolute inset-0 animate-pulse bg-navy-100" />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/render/${cid}/0`}
        alt={name}
        onLoad={() => setLoaded(true)}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
}
