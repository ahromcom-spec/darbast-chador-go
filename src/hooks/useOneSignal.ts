// OneSignal has been disabled in favor of Najva web push.
// This hook is kept as a no-op for backward compatibility with existing components.

export function useOneSignal() {
  return {
    appId: null as string | null,
    isInitialized: false,
    isSupported: false,
    isSubscribed: false,
    subscriptionId: null as string | null,
    permission: 'default' as NotificationPermission,
    loading: false,
    subscribe: async () => false,
    unsubscribe: async () => false,
  };
}
