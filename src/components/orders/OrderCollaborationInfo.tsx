import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Users, User, Phone, Check, Clock, X, HandHeart, Eye, Wallet } from 'lucide-react';
import { formatPersianDate } from '@/lib/dateUtils';
import { useAuth } from '@/contexts/AuthContext';

interface CollabRow {
  id: string;
  inviter_user_id: string;
  invitee_user_id: string | null;
  invitee_phone_number: string;
  status: string;
  invited_at: string;
  collaborator_name: string | null;
  collaborator_role: string | null;
  can_view_financials: boolean;
  can_manage_order: boolean;
  inviter_name: string;
  inviter_phone: string;
  invitee_name: string;
}

interface Props {
  orderId: string;
}

const statusInfo: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  pending_manager: { label: 'در انتظار تایید مدیران', className: 'bg-gray-100 text-gray-700', icon: <Clock className="h-3 w-3 ml-1" /> },
  manager_approved: { label: 'در انتظار پذیرش همکار', className: 'bg-yellow-100 text-yellow-700', icon: <Clock className="h-3 w-3 ml-1" /> },
  pending: { label: 'در انتظار پذیرش همکار', className: 'bg-yellow-100 text-yellow-700', icon: <Clock className="h-3 w-3 ml-1" /> },
  pending_registration: { label: 'در انتظار ثبت‌نام همکار', className: 'bg-gray-100 text-gray-700', icon: <Clock className="h-3 w-3 ml-1" /> },
  accepted: { label: 'پذیرفته شده', className: 'bg-green-100 text-green-700', icon: <Check className="h-3 w-3 ml-1" /> },
  approved: { label: 'پذیرفته شده', className: 'bg-green-100 text-green-700', icon: <Check className="h-3 w-3 ml-1" /> },
  rejected: { label: 'رد شده توسط همکار', className: 'bg-red-100 text-red-700', icon: <X className="h-3 w-3 ml-1" /> },
  manager_rejected: { label: 'رد شده توسط مدیران', className: 'bg-red-100 text-red-700', icon: <X className="h-3 w-3 ml-1" /> },
};

export function OrderCollaborationInfo({ orderId }: Props) {
  const { user } = useAuth();
  const [rows, setRows] = useState<CollabRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('order_collaborators')
          .select('id, inviter_user_id, invitee_user_id, invitee_phone_number, status, invited_at, collaborator_name, collaborator_role, can_view_financials, can_manage_order')
          .eq('order_id', orderId)
          .order('invited_at', { ascending: false });

        if (error) throw error;
        if (!data || data.length === 0) {
          if (!cancelled) setRows([]);
          return;
        }

        const userIds = Array.from(
          new Set([
            ...data.map((d: any) => d.inviter_user_id),
            ...data.map((d: any) => d.invitee_user_id).filter(Boolean),
          ])
        );

        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, phone_number')
          .in('user_id', userIds);

        const pMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

        const enriched: CollabRow[] = data.map((d: any) => ({
          ...d,
          inviter_name: pMap.get(d.inviter_user_id)?.full_name || 'کاربر',
          inviter_phone: pMap.get(d.inviter_user_id)?.phone_number || '',
          invitee_name:
            (d.invitee_user_id ? pMap.get(d.invitee_user_id)?.full_name : '') ||
            d.collaborator_name ||
            'کاربر',
        }));

        if (!cancelled) setRows(enriched);
      } catch (e) {
        console.error('Error fetching order collaborations:', e);
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  if (loading || rows.length === 0) return null;

  return (
    <Card className="border-2 border-indigo-200 bg-indigo-50 dark:bg-indigo-950/20 dark:border-indigo-800">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg text-indigo-700 dark:text-indigo-400">
          <Users className="h-5 w-5" />
          🤝 همکاری در این سفارش
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.map((row) => {
          const isInviter = user?.id === row.inviter_user_id;
          const isInvitee = user?.id === row.invitee_user_id;
          const info = statusInfo[row.status];
          const accepted = row.status === 'accepted' || row.status === 'approved';
          const pending = ['pending', 'manager_approved', 'pending_manager', 'pending_registration'].includes(row.status);

          return (
            <div key={row.id} className="space-y-3 rounded-lg border bg-white/70 dark:bg-gray-900/60 p-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* دعوت‌کننده */}
                <div className="bg-white dark:bg-gray-900 rounded-lg p-3 border">
                  <div className="text-xs text-muted-foreground mb-2">دعوت‌کننده (دارنده سفارش)</div>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-blue-600" />
                    <span className="font-medium">{row.inviter_name}</span>
                    {isInviter && <Badge variant="outline" className="text-xs">شما</Badge>}
                  </div>
                  {row.inviter_phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <Phone className="h-3 w-3" />
                      <span dir="ltr">{row.inviter_phone}</span>
                    </div>
                  )}
                </div>

                {/* همکار */}
                <div className="bg-white dark:bg-gray-900 rounded-lg p-3 border">
                  <div className="text-xs text-muted-foreground mb-2">همکار سفارش</div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <HandHeart className="h-4 w-4 text-indigo-600" />
                    <span className="font-medium">{row.invitee_name}</span>
                    {isInvitee && <Badge variant="outline" className="text-xs">شما</Badge>}
                    {row.collaborator_role && (
                      <Badge variant="secondary" className="text-xs">{row.collaborator_role} سفارش</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <Phone className="h-3 w-3" />
                    <span dir="ltr">{row.invitee_phone_number}</span>
                  </div>
                </div>
              </div>

              {/* وضعیت و دسترسی‌ها */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-xs text-muted-foreground">
                  تاریخ دعوت: {formatPersianDate(row.invited_at, { showDayOfWeek: true })}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {row.can_view_financials && (
                    <Badge variant="outline" className="text-xs">
                      <Eye className="h-3 w-3 ml-1" />
                      مشاهده مبالغ
                    </Badge>
                  )}
                  {row.can_manage_order && (
                    <Badge variant="outline" className="text-xs">
                      <Wallet className="h-3 w-3 ml-1" />
                      پرداخت و مدیریت
                    </Badge>
                  )}
                  {info && (
                    <Badge variant="secondary" className={info.className}>
                      {info.icon}
                      {info.label}
                    </Badge>
                  )}
                </div>
              </div>

              {/* پیام همکاری */}
              {accepted && (
                <Alert className="border-green-300 bg-green-50 dark:bg-green-950/20">
                  <Check className="h-4 w-4 text-green-600" />
                  <AlertTitle className="text-green-700">
                    {isInvitee ? 'شما همکار این سفارش هستید' : 'همکار به سفارش اضافه شد'}
                  </AlertTitle>
                  <AlertDescription className="text-green-600">
                    {isInvitee
                      ? `${row.inviter_name}${row.inviter_phone ? ` (${row.inviter_phone})` : ''} شما را به‌عنوان ${row.collaborator_role || 'همکار'} این سفارش اضافه کرده است${row.can_manage_order ? ' و شما امکان پرداخت و مدیریت سفارش را دارید' : row.can_view_financials ? ' و شما امکان مشاهده مبالغ سفارش را دارید' : ''}.`
                      : `${row.invitee_name} (${row.invitee_phone_number}) به‌عنوان ${row.collaborator_role || 'همکار'} این سفارش همکاری را پذیرفته است. مالکیت سفارش همچنان نزد شماست.`}
                  </AlertDescription>
                </Alert>
              )}

              {pending && (
                <Alert className="border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20">
                  <Clock className="h-4 w-4 text-yellow-600" />
                  <AlertTitle className="text-yellow-700">در انتظار تکمیل همکاری</AlertTitle>
                  <AlertDescription className="text-yellow-600">
                    {row.status === 'pending_manager'
                      ? `درخواست همکاری ${row.invitee_name} (${row.invitee_phone_number}) در انتظار تایید مدیران است.`
                      : row.status === 'pending_registration'
                      ? `کاربر با شماره ${row.invitee_phone_number} هنوز ثبت‌نام نکرده است؛ پس از ثبت‌نام، دعوت همکاری برای ایشان نمایش داده می‌شود.`
                      : isInvitee
                      ? `${row.inviter_name} شما را به همکاری در این سفارش دعوت کرده است. برای پذیرش به بخش دعوت‌های همکاری در «سفارشات من» مراجعه کنید.`
                      : `دعوت همکاری برای ${row.invitee_name} (${row.invitee_phone_number}) ارسال شد و در انتظار پذیرش ایشان است.`}
                  </AlertDescription>
                </Alert>
              )}

              {(row.status === 'rejected' || row.status === 'manager_rejected') && (
                <Alert className="border-red-300 bg-red-50 dark:bg-red-950/20">
                  <X className="h-4 w-4 text-red-600" />
                  <AlertTitle className="text-red-700">همکاری انجام نشد</AlertTitle>
                  <AlertDescription className="text-red-600">
                    {row.status === 'manager_rejected'
                      ? `درخواست همکاری ${row.invitee_name} (${row.invitee_phone_number}) توسط مدیران رد شد.`
                      : `${row.invitee_name} (${row.invitee_phone_number}) دعوت همکاری در این سفارش را نپذیرفت.`}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
