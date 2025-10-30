import { Metadata } from 'next';
import { CardInspiration } from './card-inspiration';
import { getCardSampleGenerators } from '@/utils/server';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `Inspire Me! - Kindred Paths`,
  }
}

export default async function CardGenerate() {
  const cardGenerators = await getCardSampleGenerators();
  return <CardInspiration previousCardGenerators={cardGenerators} />;
}
