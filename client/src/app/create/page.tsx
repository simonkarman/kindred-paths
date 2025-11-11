import { Metadata } from 'next';
import { CardEditor } from '@/components/editor/card-editor';
import { Card } from 'kindred-paths';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `Create Card - Kindred Paths`,
  }
}

export default async function CardCreate() {
  return <>
    <CardEditor start={Card.new('normal')} />
  </>;
};
