import { useEffect, useState } from 'react';

interface NetworkStatus {
  online: boolean;
  effectiveType?: string;
  downlink?: number;
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    online: navigator.onLine,
  });

  useEffect(() => {
    const handleOnline = () => setStatus((s) => ({ ...s, online: true }));
    const handleOffline = () => setStatus((s) => ({ ...s, online: false }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check network information if available
    const connection = (navigator as any).connection;
    if (connection) {
      const updateConnectionInfo = () => {
        setStatus({
          online: navigator.onLine,
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
        });
      };
      
      connection.addEventListener('change', updateConnectionInfo);
      updateConnectionInfo();
      
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        connection.removeEventListener('change', updateConnectionInfo);
      };
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return status;
}
