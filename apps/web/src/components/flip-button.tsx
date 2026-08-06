'use client';

import { RotateCw } from 'lucide-react';

export function FlipButton({
  onClick,
  className = '',
}: {
  onClick: (e: React.MouseEvent) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Flip card"
      title="Flip card"
      className={`z-10 inline-flex h-14 w-14 items-center justify-center rounded-full border border-white/40 bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/70 ${className}`}
    >
      <RotateCw className="h-7 w-7" />
    </button>
  );
}
