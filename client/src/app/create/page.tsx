import { CardEditor } from '@/components/editor/card-editor';
import Link from 'next/link';

export default async function CardCreate() {
  return <>
    <p className="px-2">
      <Link href={'/'} className="underline text-blue-600">Go back</Link>
    </p>
    <CardEditor start={{
      id: '<new>',
      name: 'New Card',
      rarity: 'common',
      supertype: undefined,
      types: ['creature'],
      subtypes: undefined,
      manaCost: { colorless: 1 },
      rules: undefined,
      pt: undefined,
      collectorNumber: 1,
      art: undefined,
      tags: { status: "concept", createdAt: new Date().toISOString().substring(0, 10) },
    }} />
  </>;
};
