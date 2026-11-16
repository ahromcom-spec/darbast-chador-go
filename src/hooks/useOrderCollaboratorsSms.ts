import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  fetchOrderCollaboratorsSms, groupCollaboratorsByOrder, setOrderCollaboratorSms, type OrderCollaboratorSms,
} from '@/lib/orderCollaboratorSms';

const KEY = 'order-collaborators-sms';

/** همکاران پذیرفته‌شده سفارش‌ها همراه کلید پیامک هر همکار (فقط برای مدیران سفارش؛ برای بقیه خالی). */
export function useOrderCollaboratorsSms(orderIds: string[]) {
  const sortedIds = useMemo(() => Array.from(new Set(orderIds.filter(Boolean))).sort(), [orderIds]);
  const query = useQuery({
    queryKey: [KEY, sortedIds],
    queryFn: () => fetchOrderCollaboratorsSms(sortedIds),
    enabled: sortedIds.length > 0,
    staleTime: 30_000,
    retry: false,
  });
  const byOrder = useMemo(() => groupCollaboratorsByOrder(query.data || []), [query.data]);
  return { byOrder, isManager: !query.isError, loading: query.isLoading, refetch: query.refetch };
}

export function useToggleCollaboratorSms() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ collaborator, enabled }: { collaborator: OrderCollaboratorSms; enabled: boolean }) =>
      setOrderCollaboratorSms(collaborator.id, enabled),
    onMutate: async ({ collaborator, enabled }) => {
      await qc.cancelQueries({ queryKey: [KEY] });
      const snapshots = qc.getQueriesData<OrderCollaboratorSms[]>({ queryKey: [KEY] });
      for (const [k, rows] of snapshots) {
        if (rows) qc.setQueryData(k, rows.map((r) => (r.id === collaborator.id ? { ...r, sms_enabled: enabled } : r)));
      }
      return { snapshots };
    },
    onError: (_e, _v, ctx) => {
      ctx?.snapshots.forEach(([k, rows]) => qc.setQueryData(k, rows));
      toast.error('تغییر پیامک همکار ذخیره نشد');
    },
    onSuccess: (ok, { collaborator, enabled }) => {
      if (!ok) { toast.error('این همکار دیگر در سفارش نیست'); return; }
      toast.success(enabled
        ? `پیامک ${collaborator.name} روشن شد؛ با تغییر مراحل سفارش پیام می‌گیرد`
        : `پیامک ${collaborator.name} خاموش شد؛ پیامی برایش ارسال نمی‌شود`);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
