'use client';

import { pipColors } from './mana-cost';

const SEGMENTED_SEGMENTS = [
  'M 12.78 2.45 L 19.95 6.59 L 16.93 8.65 L 12.48 6.08 Z',
  'M 20.66 7.90 L 20.66 16.18 L 17.37 14.59 L 17.37 9.46 Z',
  'M 19.88 17.45 L 12.71 21.59 L 12.44 17.95 L 16.89 15.38 Z',
  'M 11.22 21.55 L 4.05 17.41 L 7.07 15.35 L 11.52 17.92 Z',
  'M 3.34 16.10 L 3.34 7.82 L 6.63 9.41 L 6.63 14.54 Z',
  'M 4.12 6.55 L 11.29 2.41 L 11.56 6.05 L 7.11 8.62 Z',
];

const BASIC_LAND_COLORS = ['w', 'u', 'b', 'r', 'g'].map((c) => pipColors.get(c)!);

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      {SEGMENTED_SEGMENTS.filter((_, i) => i !== 3).map((d, i) => (
        <path key={i} d={d} fill={BASIC_LAND_COLORS[i]} />
      ))}
    </svg>
  );
}
