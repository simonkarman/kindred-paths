import { getCards } from '@/utils/api';
import { CardOverview } from '@/components/overview/card-overview';

export default async function Home() {
  const cards = await getCards();
  return <CardOverview cards={cards} />;
}
