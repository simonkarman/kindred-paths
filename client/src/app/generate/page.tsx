import { Metadata } from 'next';
import { CardGenerator } from './card-generator';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `KPA: Generate Card`,
  }
}

export default async function CardGenerate() {
  return (<>
    <h1 className="text-3xl font-bold text-center mb-8">Generate Cards</h1>
    <CardGenerator />
  </>);
}
