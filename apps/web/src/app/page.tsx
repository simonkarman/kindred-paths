import { HeroSearch } from './hero-search';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-7xl font-semibold tracking-tight text-navy-700">
          Kindred Paths
        </h1>
        <p className="text-muted">A tool for managing a collection of custom Magic the Gathering cards</p>
      </div>
      <HeroSearch />
    </main>
  );
}
