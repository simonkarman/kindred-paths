import { getCardSummaries } from '@/utils/server';
import { CardTable } from '@/components/card-table';
import { GroupOverview } from '@/components/group-overview';

// aspect-[63/88] w-100
export default async function Home() {
  const cardSummaries = await getCardSummaries();
  return (<>
    <h2 className="font-bold text-lg mb-2">Card Table</h2>
    <CardTable cardSummaries={cardSummaries} />
    <h2 className="font-bold text-lg mb-2 mt-10">Card Groups</h2>
    <GroupOverview cardSummaries={cardSummaries} />
  </>);
}
