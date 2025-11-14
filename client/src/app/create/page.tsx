import { Metadata } from 'next';
import { CardEditor } from '@/components/editor/card-editor';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `Create Card - Kindred Paths`,
  }
}

export default async function CardCreate() {
  return <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
    <CardEditor />
  </div>;
};
