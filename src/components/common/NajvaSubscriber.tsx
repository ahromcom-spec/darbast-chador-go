import { useNajvaSubscription } from '@/hooks/useNajva';

/**
 * Mount-only component that registers the Najva subscriber token
 * for the authenticated user. Renders nothing.
 */
export function NajvaSubscriber() {
  useNajvaSubscription();
  return null;
}
