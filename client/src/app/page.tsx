import { getCards } from '@/utils/server';
import { CardTable } from '@/components/card-table';

export default async function Home() {
  const cards = await getCards();
  return (<div className="space-y-10">
    <CardTable cards={cards} />
  </div>);
}
