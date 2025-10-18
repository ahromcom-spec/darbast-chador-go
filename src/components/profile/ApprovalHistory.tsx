import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { CheckCircle, XCircle, Clock, FileText } from 'lucide-react';

interface ApprovalHistoryProps {
  userId: string;
}

export function ApprovalHistory({ userId }: ApprovalHistoryProps) {
  const { data: approvals, isLoading } = useQuery({
    queryKey: ['approval-history', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_log')
        .select(`
          id,
          action,
          entity,
          entity_id,
          meta,
          created_at
        `)
        .eq('actor_user_id', userId)
        .in('action', ['approve_order', 'reject_order', 'approve_staff_request', 'reject_staff_request', 'approve_contractor', 'assign_role', 'remove_role'])
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    }
  });

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      approve_order: 'تایید سفارش',
      reject_order: 'رد سفارش',
      approve_staff_request: 'تایید درخواست پرسنل',
      reject_staff_request: 'رد درخواست پرسنل',
      approve_contractor: 'تایید پیمانکار',
      assign_role: 'اختصاص نقش',
      remove_role: 'حذف نقش'
    };
    return labels[action] || action;
  };

  const getActionIcon = (action: string) => {
    if (action.includes('approve')) {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    } else if (action.includes('reject')) {
      return <XCircle className="h-4 w-4 text-red-600" />;
    }
    return <FileText className="h-4 w-4 text-blue-600" />;
  };

  const getActionVariant = (action: string): "default" | "destructive" | "secondary" => {
    if (action.includes('approve')) return "default";
    if (action.includes('reject')) return "destructive";
    return "secondary";
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <LoadingSpinner />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          <CardTitle>تاریخچه تاییدیه‌ها و فعالیت‌های مدیریتی</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          لیست تمام اقداماتی که توسط شما انجام شده است
        </p>
      </CardHeader>
      <CardContent>
        {!approvals || approvals.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            هیچ فعالیت مدیریتی ثبت نشده است
          </div>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">نوع عملیات</TableHead>
                    <TableHead className="text-right">جزئیات</TableHead>
                    <TableHead className="text-right">تاریخ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approvals.map((approval) => (
                    <TableRow key={approval.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getActionIcon(approval.action)}
                          <Badge variant={getActionVariant(approval.action)}>
                            {getActionLabel(approval.action)}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm space-y-1">
                          {approval.meta && typeof approval.meta === 'object' && (
                            <>
                              {(approval.meta as any).code && (
                                <div>
                                  <span className="text-muted-foreground">کد: </span>
                                  <span className="font-medium" dir="ltr">{(approval.meta as any).code}</span>
                                </div>
                              )}
                              {(approval.meta as any).role && (
                                <div>
                                  <span className="text-muted-foreground">نقش: </span>
                                  <span className="font-medium">{(approval.meta as any).role}</span>
                                </div>
                              )}
                              {(approval.meta as any).company_name && (
                                <div>
                                  <span className="text-muted-foreground">شرکت: </span>
                                  <span className="font-medium">{(approval.meta as any).company_name}</span>
                                </div>
                              )}
                              {(approval.meta as any).reason && (
                                <div>
                                  <span className="text-muted-foreground">دلیل: </span>
                                  <span className="text-red-600">{(approval.meta as any).reason}</span>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {new Date(approval.created_at).toLocaleDateString('fa-IR', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
