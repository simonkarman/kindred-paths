import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <Link href="/overview" className="text-lg underline underline-offset-4 hover:text-neutral-300">
        Go to overview
      </Link>
    </main>
  );
}
