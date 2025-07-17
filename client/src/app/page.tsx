import { getCardSummaries } from '@/utils/server';
import { CardTable } from '@/components/card-table';

// aspect-[63/88] w-100
export default async function Home() {
  const cardSummaries = await getCardSummaries();
  return (<>
    <h2 className="font-bold text-lg mb-2">Cards</h2>
    <CardTable cardSummaries={cardSummaries} />
  </>);
}
