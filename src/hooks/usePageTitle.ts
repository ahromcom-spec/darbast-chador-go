import { useEffect } from 'react';

export function usePageTitle(title: string) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title ? `${title} | اهرم` : 'اهرم - خدمات ساختمانی';
    
    return () => {
      document.title = previousTitle;
    };
  }, [title]);
}
