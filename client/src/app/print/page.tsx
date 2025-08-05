import Link from 'next/link';
import type { Metadata } from 'next'
import { Card, getStatistics } from 'kindred-paths';
import { CardRender } from '@/components/card-render';
import { capitalize } from '@/utils/typography';
import { getCards } from '@/utils/server';
import { PageProps } from '@/utils/page-props';
import { CardsStatistics } from '@/components/cards-statistics';
import Print from '@/app/print/[deckName]/page';

const n = (count: number) => Array.from({ length: count }, (_, i) => i + 1);

export async function generateMetadata({ params: _params }: PageProps<{ deckName: string }>): Promise<Metadata> {
  const params = await _params;
  return {
    title: `KPA: Print All`,
  }
}

async function r<T>(value: T) { return value; }

export default async function PrintAll() {
  return <Print params={r({ deckName: '' })} />;
};
