'use client';

import { useState } from 'react';

export function CardImage({ cid, name }: { cid: string; name: string }) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  return (
    <div className="relative aspect-488/684 w-full overflow-hidden rounded-2xl border border-line bg-navy-50 shadow-lg">
      {!loaded && !errored && <div className="absolute inset-0 animate-pulse bg-navy-100" />}
      {errored && (
        <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-muted">
          Failed to load image.
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={(img) => {
          // On a full page load (refresh / direct URL), this <img> is already present in
          // the server-rendered HTML, so the browser can start (and finish) fetching it
          // before React hydrates and attaches the onLoad listener below. In that case the
          // native `load` event fires and is lost before anyone is listening for it, so
          // `loaded` would otherwise stay false forever even though the image is fully
          // loaded. Checking `.complete` here (ref callbacks run synchronously on mount)
          // catches that case; `naturalWidth > 0` rules out a "complete" broken image.
          if (img?.complete) {
            if (img.naturalWidth > 0) setLoaded(true);
            else setErrored(true);
          }
        }}
        src={`/api/render/${cid}/0`}
        alt={name}
        onLoad={() => setLoaded(true)}
        onError={() => setErrored(true)}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
}
