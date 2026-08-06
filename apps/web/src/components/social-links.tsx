import { Feather } from 'lucide-react';
import { SiGithub } from '@icons-pack/react-simple-icons';

const LINK_CLASS =
  'inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-current/10';

/**
 * Icon-only links to the project's source and its author's site. Rendered both on the home
 * page (light background) and in the shared header (dark background) via the className prop.
 */
export function SocialLinks({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-1 ${className ?? ''}`}>
      <a
        href="https://github.com/simonkarman/kindred-paths"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="View source on GitHub"
        title="View source on GitHub"
        className={LINK_CLASS}
      >
        <SiGithub className="h-5 w-5" size={20} />
      </a>
      <a
        href="https://simonkarman.nl"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Visit Simon Karman's website"
        title="Visit Simon Karman's website"
        className={LINK_CLASS}
      >
        <Feather className="h-5 w-5" strokeWidth={1.75} />
      </a>
    </div>
  );
}
