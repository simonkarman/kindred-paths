import { Suspense } from 'react';
import { SiteHeader } from '@/components/site-header';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <SiteHeader />
      </Suspense>
      {children}
    </>
  );
}
