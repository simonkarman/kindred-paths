'use client';

import { RotateCw } from 'lucide-react';

const SIZE_CLASSES = {
  sm: 'h-9 w-9',
  lg: 'h-14 w-14',
};
const ICON_SIZE_CLASSES = {
  sm: 'h-4 w-4',
  lg: 'h-7 w-7',
};

export function FlipButton({
  onClick,
  className = '',
  size = 'lg',
}: {
  onClick: (e: React.MouseEvent) => void;
  className?: string;
  size?: 'sm' | 'lg';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Flip card"
      title="Flip card"
      className={`z-10 inline-flex items-center justify-center rounded-full border border-white/40 bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/70 ${SIZE_CLASSES[size]} ${className}`}
    >
      <RotateCw className={ICON_SIZE_CLASSES[size]} />
    </button>
  );
}
