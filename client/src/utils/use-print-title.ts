import { useEffect } from 'react';

export function usePrintTitle(printTitle: string) {
  useEffect(() => {
    const originalTitle = document.title;

    const handleBeforePrint = () => {
      document.title = printTitle;
    };

    const handleAfterPrint = () => {
      document.title = originalTitle;
    };

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [printTitle]);
}
