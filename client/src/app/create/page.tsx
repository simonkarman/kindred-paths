import { Metadata } from 'next';
import { CardEditor } from '@/components/editor/card-editor';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `KPA: Create Card`,
  }
}

export default async function CardCreate() {
  return <>
    <CardEditor start={{
      id: '<new>',
      name: 'New Card',
      rarity: 'common',
      supertype: undefined,
      tokenColors: undefined,
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
