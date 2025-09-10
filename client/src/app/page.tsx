import { getCards } from '@/utils/server';
import { CardOverview } from '@/components/overview/card-overview';

export default async function Home() {
  const cards = await getCards();
  return <CardOverview cards={cards} />;
}
