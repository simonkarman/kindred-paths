import type { Metadata } from 'next'
import Print from '@/app/print/[deckName]/page';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `KPA: Print All`,
  }
}

async function asAwaitable<T>(value: T) { return value; }

export default async function PrintAll() {
  return <Print params={asAwaitable({ deckName: '' })} />;
};
