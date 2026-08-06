export function BackgroundShapes() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none fixed inset-x-0 bottom-0 -z-10 h-[60vh] w-full text-navy-300"
      viewBox="0 0 1440 640"
      preserveAspectRatio="xMidYMax slice"
      fill="none"
    >
      <circle cx="140" cy="560" r="120" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1.5" />
      <circle cx="140" cy="560" r="170" stroke="currentColor" strokeOpacity="0.1" strokeWidth="1.5" />
      <polygon
        points="1220,420 1300,465 1300,555 1220,600 1140,555 1140,465"
        stroke="currentColor"
        strokeOpacity="0.16"
        strokeWidth="1.5"
      />
      <polygon
        points="1220,380 1330,443 1330,570 1220,633 1110,570 1110,443"
        stroke="currentColor"
        strokeOpacity="0.08"
        strokeWidth="1.5"
      />
      <circle cx="760" cy="620" r="60" stroke="currentColor" strokeOpacity="0.14" className="text-gold-500" strokeWidth="1.5" />
      <rect x="620" y="500" width="90" height="90" rx="8" stroke="currentColor" strokeOpacity="0.1" strokeWidth="1.5" transform="rotate(18 665 545)" />
    </svg>
  );
}
