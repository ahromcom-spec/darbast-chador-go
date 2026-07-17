import { useAuth } from '@/contexts/AuthContext';
import { AssistantAvatar } from './AssistantAvatar';

/**
 * فقط برای کاربران واردشده دستیار اهرم را نمایش می‌دهد
 * تا مهمان‌ها نتوانند از آن استفاده کنند.
 */
export function AssistantAvatarGate() {
  const auth = useAuth();
  if (auth?.loading) return null;
  if (!auth?.user) return null;
  return <AssistantAvatar />;
}
