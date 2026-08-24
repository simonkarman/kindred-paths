'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ManaCost } from '@/components/mana-cost';
import { CardImage } from '@/components/card-image';
import { FlipButton } from '@/components/flip-button';
import { RulesText } from '@/components/rules-text';
import { IS_STATIC_EXPORT } from '@/lib/asset-path';
import { capitalize } from '@kindred-paths/shared';

export type CardDetailFace = {
  name: string;
  typeLine: string;
  manaCost: string;
  rules: { variant: string; content: string }[];
  pt?: { power: number | string; toughness: number | string };
  loyalty?: number;
};

export function CardDetailView({
  cid,
  faces,
  isDual,
  set,
  initialFaceIndex = 0,
}: {
  cid: string;
  faces: CardDetailFace[];
  isDual: boolean;
  set?: string;
  initialFaceIndex?: number;
}) {
  const [faceIndex, setFaceIndex] = useState(initialFaceIndex);
  const activeFace = faces[faceIndex] ?? faces[0];

  // Static export can't read ?face= at build time (initialFaceIndex is always 0), so pick
  // it up from the URL on mount. Same effect as the server-side read in dynamic mode.
  useEffect(() => {
    if (!IS_STATIC_EXPORT || !isDual) return;
    if (typeof window === 'undefined') return;
    const face = new URLSearchParams(window.location.search).get('face');
    const parsed = Number(face);
    if (Number.isInteger(parsed) && parsed > 0 && parsed < faces.length) {
      setFaceIndex(parsed);
    }
  }, [isDual, faces.length]);

  const flip = () => {
    const next = (faceIndex + 1) % faces.length;
    setFaceIndex(next);

    // Keep the URL in sync (so the current face is shareable/refreshable) without
    // triggering a Next.js navigation/RSC round-trip for what's purely a client-side
    // toggle — omit the param entirely for face 0 to keep "plain" URLs untouched. This
    // must happen outside the setFaceIndex updater: calling it from within an updater
    // function runs it during React's render phase (and twice in Strict Mode), which
    // trips "Cannot update a component while rendering a different component" since
    // history.replaceState notifies the Next.js router.
    const url = new URL(window.location.href);
    if (next === 0) {
      url.searchParams.delete('face');
    } else {
      url.searchParams.set('face', String(next));
    }
    window.history.replaceState({}, '', url.toString());
  };

  return (
    <div className="flex flex-col items-center gap-8 md:flex-row md:items-start">
      {/* Left: card image */}
      <div className="w-full max-w-md shrink-0 md:w-95 lg:w-105">
        <CardImage cid={cid} name={activeFace.name} faceIndex={faceIndex}>
          {isDual && (
            <FlipButton
              className="absolute -right-4.5 top-17.5"
              onClick={(e) => {
                e.preventDefault();
                flip();
              }}
            />
          )}
        </CardImage>
      </div>

      {/* Right: rules panel — for dual-faced cards, both faces are shown stacked, with the
          currently viewed face subtly highlighted rather than swapping the content out. */}
      <div className="w-full space-y-4 rounded-lg border border-line bg-surface p-6 shadow-sm">
        {faces.map((face, index) => {
          const active = index === faceIndex;
          return (
            <div
              key={index}
              className={`space-y-4 transition-opacity duration-200 ${
                index > 0 ? 'mt-4 border-t border-line pt-4' : ''
              } ${isDual && !active ? 'opacity-60' : 'opacity-100'}`}
            >
              <div
                className={isDual ? `-mx-6 space-y-4 px-6 ${active ? 'border-l-2 border-l-gold-500' : 'border-l-2 border-l-transparent'}` : 'space-y-4'}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-semibold text-ink">{face.name}</h1>
                    {isDual && (
                      <span className="rounded-full bg-gold-500/15 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-gold-600">
                        {index === 0 ? 'Front' : 'Back'}
                      </span>
                    )}
                  </div>
                  {face.manaCost && <ManaCost cost={face.manaCost} />}
                </div>
                <p className="-mt-3 text-sm text-muted">{face.typeLine}</p>

                {face.rules.length > 0 && (
                  <div className="space-y-3">
                    {face.rules.map((rule, ruleIndex) => (
                      <p
                        key={ruleIndex}
                        className={
                          rule.variant === 'keyword' || rule.variant === 'ability'
                            ? 'text-sm leading-relaxed text-ink'
                            : 'text-sm leading-relaxed italic text-muted'
                        }
                      >
                        <RulesText content={rule.variant === 'keyword' ? capitalize(rule.content) : rule.content} />
                      </p>
                    ))}
                  </div>
                )}

                {(face.pt || face.loyalty !== undefined) && (
                  <p className="text-right text-lg font-semibold text-ink">
                    {face.pt ? `${face.pt.power}/${face.pt.toughness}` : face.loyalty}
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {set && (
          <div className="pt-2">
            <Link
              href={`/search?q=${encodeURIComponent(`set:${set}`)}`}
              className="uppercase inline-block rounded-full border border-line px-2 py-0.5 text-xs font-medium text-muted transition-colors hover:bg-navy-50/50 hover:text-ink"
            >
              {set}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
