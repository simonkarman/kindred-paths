import { getCards } from '@/utils/api';
import { CardOverview } from '@/components/overview/card-overview';
import { Suspense } from 'react';

export default async function Home() {
  const cards = await getCards();
  return <Suspense><CardOverview cards={cards} /></Suspense>;
}
