import { Metadata } from 'next';
import { CardEditor } from '@/components/editor/card-editor';
import { Suspense } from 'react';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `Create Card - Kindred Paths`,
  }
}

export default async function CardCreate() {
  return <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
    <Suspense><CardEditor isNewCard={true} /></Suspense>
  </div>;
};
