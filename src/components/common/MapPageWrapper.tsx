import React, { useEffect } from 'react';

interface MapPageWrapperProps {
  children: React.ReactNode;
}

/**
 * Wrapper component that hides PWA install banner and notifications on map pages
 */
export const MapPageWrapper: React.FC<MapPageWrapperProps> = ({ children }) => {
  useEffect(() => {
    // Hide PWA install banner
    const pwaInstallBanner = document.querySelector('[data-pwa-install-banner]');
    if (pwaInstallBanner instanceof HTMLElement) {
      pwaInstallBanner.style.display = 'none';
    }

    // Hide notification banner
    const notificationBanner = document.querySelector('[data-notification-banner]');
    if (notificationBanner instanceof HTMLElement) {
      notificationBanner.style.display = 'none';
    }

    // Hide any notification bells or popups
    const notificationBells = document.querySelectorAll('[data-notification-bell]');
    notificationBells.forEach(bell => {
      if (bell instanceof HTMLElement) {
        bell.style.display = 'none';
      }
    });

    return () => {
      // Restore visibility when leaving map page
      if (pwaInstallBanner instanceof HTMLElement) {
        pwaInstallBanner.style.display = '';
      }
      if (notificationBanner instanceof HTMLElement) {
        notificationBanner.style.display = '';
      }
      notificationBells.forEach(bell => {
        if (bell instanceof HTMLElement) {
          bell.style.display = '';
        }
      });
    };
  }, []);

  return <>{children}</>;
};
