import { Metadata } from 'next';
import { CardGenerator } from './card-generator';
import { getCardSampleGenerators } from '@/utils/server';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `KPA: Generate Card`,
  }
}

export default async function CardGenerate() {
  const cardGenerators = await getCardSampleGenerators();
  return <CardGenerator previousCardGenerators={cardGenerators} />;
}
