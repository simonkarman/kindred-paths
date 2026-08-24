import Link from 'next/link';
import { HeroSearch } from './hero-search';
import { Logo } from '@/components/logo';
import { SocialLinks } from '@/components/social-links';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center gap-8 px-6 pt-[22vh]">
      <div className="flex flex-col items-center gap-4 text-center">
        <Logo className='max-w-40' />
        <h1 className="text-4xl font-semibold tracking-tight text-navy-700 sm:text-6xl lg:text-7xl">
          Kindred Paths
        </h1>
        <p className="text-muted">A tool for managing a collection of custom Magic the Gathering cards</p>
      </div>
      <HeroSearch />
      <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
        <Link
          href="/search?q=set:shx"
          className="rounded-full border border-navy-200 bg-surface px-4 py-1.5 text-navy-700 shadow-sm transition-colors hover:border-navy-400 hover:bg-navy-50"
        >
          Shattered Expense set
        </Link>
        <Link
          href="/search?q=tag:golden"
          className="rounded-full border border-navy-200 bg-surface px-4 py-1.5 text-navy-700 shadow-sm transition-colors hover:border-navy-400 hover:bg-navy-50"
        >
          Golden Renders
        </Link>
      </div>
      <SocialLinks className="text-muted" />
    </main>
  );
}
