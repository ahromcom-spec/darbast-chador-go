import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Briefcase, CheckCircle2, Clock, XCircle, Package } from 'lucide-react';

interface Row {
  id: string;
  status: string;
  assignment_type?: string | null;
  assigned_at: string;
  project?: {
    id: string;
    code: string | number;
    status: string | null;
    execution_stage: string | null;
    address: string | null;
    customer_name: string | null;
  } | null;
}

const assignmentStatus: Record<string, { label: string; cls: string }> = {
  pending: { label: 'در انتظار پاسخ', cls: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  accepted: { label: 'پذیرفته شده', cls: 'bg-green-100 text-green-800 border-green-300' },
  rejected: { label: 'رد شده', cls: 'bg-red-100 text-red-700 border-red-300' },
  cancelled: { label: 'لغو شده', cls: 'bg-gray-100 text-gray-700 border-gray-300' },
};

const stageLabel: Record<string, string> = {
  pending: 'در انتظار تایید مدیران',
  approved: 'تایید شده',
  pending_execution: 'آماده اجرا',
  in_progress: 'در حال اجرا',
  completed: 'اتمام',
  paid: 'پرداخت شده',
  closed: 'بسته شده',
  rejected: 'رد شده',
};

/**
 * Shows v3 order assignments associated with a contractor (in CEO contractor management).
 * Lists pending + accepted orders with execution stage so admins can see who is doing what.
 */
export default function ContractorV3AssignmentsInfo({ contractorId }: { contractorId: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from('project_v3_assignments')
        .select('id,status,assignment_type,assigned_at,project:projects_v3(id,code,status,execution_stage,address,customer_name)')
        .eq('contractor_id', contractorId)
        .in('status', ['pending', 'accepted'])
        .order('assigned_at', { ascending: false })
        .limit(20);
      if (mounted) setRows((data as any) || []);
    })();
  }, [contractorId]);

  if (!rows || rows.length === 0) return null;

  const accepted = rows.filter(r => r.status === 'accepted');
  const pending = rows.filter(r => r.status === 'pending');

  return (
    <div className="rounded-lg border bg-blue-50/40 dark:bg-blue-950/10 border-blue-200/60 p-2.5 space-y-2 text-xs">
      <div className="flex items-center gap-1.5 text-blue-800 font-medium">
        <Briefcase className="h-3.5 w-3.5" />
        <span>سفارش‌های ارجاع‌شده به این پیمانکار</span>
      </div>

      {accepted.length > 0 && (
        <div className="space-y-1">
          <div className="text-[11px] text-green-800 font-medium flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> پذیرفته‌شده ({accepted.length})
          </div>
          {accepted.map(r => (
            <div key={r.id} className="flex items-center gap-2 flex-wrap bg-white/60 rounded px-2 py-1 border border-green-200">
              <Package className="h-3 w-3 text-green-700" />
              <span className="font-semibold">سفارش {r.project?.code ?? '—'}</span>
              {r.project?.customer_name && <span className="text-muted-foreground">· {r.project.customer_name}</span>}
              <Badge variant="outline" className="text-[10px] bg-white">
                {stageLabel[r.project?.execution_stage || r.project?.status || ''] || r.project?.execution_stage || r.project?.status || '—'}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {pending.length > 0 && (
        <div className="space-y-1">
          <div className="text-[11px] text-yellow-800 font-medium flex items-center gap-1">
            <Clock className="h-3 w-3" /> در انتظار پاسخ پیمانکار ({pending.length})
          </div>
          {pending.map(r => (
            <div key={r.id} className="flex items-center gap-2 flex-wrap bg-white/60 rounded px-2 py-1 border border-yellow-200">
              <Package className="h-3 w-3 text-yellow-700" />
              <span className="font-semibold">سفارش {r.project?.code ?? '—'}</span>
              {r.project?.customer_name && <span className="text-muted-foreground">· {r.project.customer_name}</span>}
              <Badge variant="outline" className={`text-[10px] ${assignmentStatus.pending.cls}`}>
                {assignmentStatus.pending.label}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
