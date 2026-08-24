'use client';

import { useEffect, useRef, useState } from 'react';
import { assetPath, IS_STATIC_EXPORT } from '@/lib/asset-path';

export function CardImage({
  cid,
  name,
  faceIndex = 0,
  children,
}: {
  cid: string;
  name: string;
  faceIndex?: number;
  children?: React.ReactNode;
}) {
  // Static export: images live under /renders/<cid>-<face>.png (baked by scripts/export-static.mjs).
  // Dynamic: streamed from the /api/render route.
  const src = IS_STATIC_EXPORT
    ? assetPath(`/renders/${cid}-${faceIndex}.png`)
    : `/api/render/${cid}/${faceIndex}`;
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  // Show the pulsing placeholder again when the requested face actually changes (e.g.
  // flipping the card), rather than leaving the previous face's "loaded" image visible/stale
  // while the new one streams in. This must NOT run on the initial mount: on a direct/fresh
  // page load the <img> below is already present in the server-rendered HTML, so the ref
  // callback's synchronous `img.complete` check may have already marked it as loaded by the
  // time this effect runs — resetting unconditionally here would clobber that and leave the
  // image stuck invisible forever (no further `load` event will ever fire for an already
  // complete image).
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setLoaded(false);
    setErrored(false);
  }, [faceIndex]);

  return (
    <div className="relative aspect-488/684 w-full">
      <div className="absolute inset-0 overflow-hidden rounded-2xl border border-line bg-navy-50 shadow-lg">
        {!loaded && !errored && <div className="absolute inset-0 animate-pulse bg-navy-100" />}
        {errored && (
          <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-muted">
            Failed to load image.
          </div>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={faceIndex}
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
          src={src}
          alt={name}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      </div>
      {children}
    </div>
  );
}
