import { getCard } from '@/utils/server';
import Link from 'next/link';
import CardRender from '@/components/card-render';
import CardExplanation from '@/components/card-explanation';

export default async function CardEdit({ params: _params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const params = await _params;
  const serializedCard = await getCard(params.id);
  if (!serializedCard) {
    return <h1 className="text-red-500">Card not found</h1>;
  }
  return (<>
    <p className="px-2">
      <Link href={'/'} className="underline text-blue-600">Go back</Link>
    </p>
    <div className="flex items-start gap-4">
      <CardRender serializedCard={serializedCard} />
      <div className="p-2">
        <CardExplanation serializedCard={serializedCard} />
      </div>
    </div>
  </>);
}
