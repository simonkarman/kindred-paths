import { getCards } from '@/utils/server';
import { CardTable } from '@/components/card-table';
import { GroupOverview } from '@/components/group-overview';

// aspect-[63/88] w-100
export default async function Home() {
  const cards = await getCards();
  return (<div className="space-y-10">
    <div>
      <h2 className="font-bold text-lg mb-2">Card Table</h2>
      <CardTable cards={cards} />
    </div>
    <div>
      <h2 className="font-bold text-lg mb-2">Card Groups</h2>
      <GroupOverview cards={cards} />
    </div>
  </div>);
}
