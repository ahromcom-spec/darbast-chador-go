import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Users, CheckCircle2, Clock, XCircle } from 'lucide-react';

interface AssignmentRow {
  id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled' | string;
  assignment_type?: string | null;
  assigned_at: string;
  responded_at?: string | null;
  contractor?: { id: string; company_name: string; phone_number: string | null } | null;
}

const statusMeta: Record<string, { label: string; cls: string; icon: any }> = {
  pending: { label: 'در انتظار پاسخ', cls: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: Clock },
  accepted: { label: 'پذیرفته شد', cls: 'bg-green-100 text-green-800 border-green-300', icon: CheckCircle2 },
  rejected: { label: 'رد شد', cls: 'bg-red-100 text-red-700 border-red-300', icon: XCircle },
  cancelled: { label: 'لغو شد', cls: 'bg-gray-100 text-gray-700 border-gray-300', icon: XCircle },
};

/**
 * Compact summary of contractor assignments for a single projects_v3 order.
 * Shows accepted contractor (if any) and list of pending/other contractors with status.
 */
export default function ProjectV3AssignmentsInfo({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<AssignmentRow[] | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from('project_v3_assignments')
        .select('id,status,assignment_type,assigned_at,responded_at,contractor:contractors(id,company_name,phone_number)')
        .eq('project_id', projectId)
        .order('assigned_at', { ascending: false });
      if (mounted) setRows((data as any) || []);
    })();
    return () => { mounted = false; };
  }, [projectId]);

  if (!rows || rows.length === 0) return null;

  const accepted = rows.find(r => r.status === 'accepted');
  const others = rows.filter(r => r !== accepted);

  return (
    <div className="rounded-lg border bg-muted/30 p-2.5 space-y-1.5 text-xs">
      <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
        <Users className="h-3.5 w-3.5" />
        <span>ارجاع به پیمانکاران ({rows.length})</span>
      </div>
      {accepted && (
        <div className="flex items-center gap-1.5 text-green-800">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>پذیرفته شده توسط: <strong>{accepted.contractor?.company_name || '—'}</strong></span>
          {accepted.contractor?.phone_number && (
            <span dir="ltr" className="text-muted-foreground">{accepted.contractor.phone_number}</span>
          )}
        </div>
      )}
      {others.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {others.map((a) => {
            const m = statusMeta[a.status] || { label: a.status, cls: 'bg-gray-100 text-gray-700 border-gray-300', icon: Clock };
            const Icon = m.icon;
            return (
              <Badge key={a.id} variant="outline" className={`${m.cls} gap-1 font-normal`}>
                <Icon className="h-3 w-3" />
                <span>{a.contractor?.company_name || '—'}</span>
                <span className="opacity-70">· {m.label}</span>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
