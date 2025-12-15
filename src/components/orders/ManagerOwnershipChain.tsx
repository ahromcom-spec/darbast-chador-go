import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  User, 
  ArrowDown, 
  ArrowLeftRight, 
  Calendar,
  UserPlus,
  Check,
  Clock,
  X,
  Briefcase
} from 'lucide-react';
import { formatPersianDate } from '@/lib/dateUtils';

interface ChainItem {
  id: string;
  type: 'manager' | 'transfer' | 'collaborator';
  from_user_id?: string;
  from_name?: string;
  from_phone?: string;
  to_user_id?: string;
  to_name?: string;
  to_phone?: string;
  status?: string;
  created_at: string;
  role?: string;
}

interface ManagerOwnershipChainProps {
  orderId: string;
  executedBy?: string;
  approvedBy?: string;
}

export function ManagerOwnershipChain({ 
  orderId, 
  executedBy,
  approvedBy
}: ManagerOwnershipChainProps) {
  const [chainItems, setChainItems] = useState<ChainItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchManagerChain();
  }, [orderId, executedBy, approvedBy]);

  const fetchManagerChain = async () => {
    try {
      setLoading(true);
      const items: ChainItem[] = [];

      // Get manager roles list
      const managerRoles = [
        'admin', 'ceo', 'general_manager', 'sales_manager', 
        'scaffold_executive_manager', 'executive_manager_scaffold_execution_with_materials',
        'finance_manager'
      ];

      // 1. Fetch transfer requests between managers
      const { data: transfers, error: transferError } = await supabase
        .from('order_transfer_requests')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });

      if (transferError) {
        console.error('Error fetching transfers:', transferError);
      }

      // Filter transfers that involve managers
      if (transfers && transfers.length > 0) {
        for (const transfer of transfers) {
          // Check if from_user is a manager
          const { data: fromRoles } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', transfer.from_user_id);

          const isFromManager = fromRoles?.some(r => managerRoles.includes(r.role));
          
          // Only include if from_user is a manager (manager-to-manager or manager-to-staff transfers)
          if (isFromManager) {
            // Get from user info
            const { data: fromProfile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('user_id', transfer.from_user_id)
              .maybeSingle();

            // Get to user info and roles
            let toName = '';
            let toRole = '';
            if (transfer.to_user_id) {
              const { data: toProfile } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('user_id', transfer.to_user_id)
                .maybeSingle();
              toName = toProfile?.full_name || 'کاربر';

              const { data: toRoles } = await supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', transfer.to_user_id);

              toRole = toRoles?.map(r => getRoleLabel(r.role)).join(', ') || '';
            }

            // Get from user role
            const fromRole = fromRoles?.map(r => getRoleLabel(r.role)).join(', ') || '';

            items.push({
              id: transfer.id,
              type: 'transfer',
              from_user_id: transfer.from_user_id,
              from_name: fromProfile?.full_name || 'مدیر',
              from_phone: '',
              to_user_id: transfer.to_user_id,
              to_name: toName,
              to_phone: transfer.to_phone_number,
              status: transfer.status,
              created_at: transfer.created_at,
              role: fromRole ? `از ${fromRole}` + (toRole ? ` به ${toRole}` : '') : undefined
            });
          }
        }
      }

      // 2. Fetch manager collaborators
      const { data: collaborators, error: collabError } = await supabase
        .from('order_collaborators')
        .select('*')
        .eq('order_id', orderId)
        .order('invited_at', { ascending: true });

      if (collabError) {
        console.error('Error fetching collaborators:', collabError);
      }

      // Filter collaborators where inviter is a manager
      if (collaborators && collaborators.length > 0) {
        for (const collab of collaborators) {
          const { data: inviterRoles } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', collab.inviter_user_id);

          const isInviterManager = inviterRoles?.some(r => managerRoles.includes(r.role));

          if (isInviterManager) {
            const { data: inviterProfile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('user_id', collab.inviter_user_id)
              .maybeSingle();

            let inviteeName = '';
            let inviteeRole = '';
            if (collab.invitee_user_id) {
              const { data: inviteeProfile } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('user_id', collab.invitee_user_id)
                .maybeSingle();
              inviteeName = inviteeProfile?.full_name || 'کاربر';

              const { data: inviteeRoles } = await supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', collab.invitee_user_id);

              inviteeRole = inviteeRoles?.map(r => getRoleLabel(r.role)).join(', ') || '';
            }

            const inviterRole = inviterRoles?.map(r => getRoleLabel(r.role)).join(', ') || '';

            items.push({
              id: collab.id,
              type: 'collaborator',
              from_user_id: collab.inviter_user_id,
              from_name: inviterProfile?.full_name || 'مدیر',
              to_user_id: collab.invitee_user_id,
              to_name: inviteeName,
              to_phone: collab.invitee_phone_number,
              status: collab.status,
              created_at: collab.invited_at,
              role: inviterRole ? `توسط ${inviterRole}` + (inviteeRole ? ` برای ${inviteeRole}` : '') : undefined
            });
          }
        }
      }

      // 3. Add executed_by manager
      if (executedBy) {
        const { data: executorProfile } = await supabase
          .from('profiles')
          .select('full_name, phone_number')
          .eq('user_id', executedBy)
          .maybeSingle();

        const { data: executorRoles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', executedBy);

        const roleName = executorRoles?.map(r => getRoleLabel(r.role)).join(', ') || 'مدیر اجرایی';

        items.push({
          id: 'executed-by-' + executedBy,
          type: 'manager',
          to_user_id: executedBy,
          to_name: executorProfile?.full_name || 'مدیر اجرایی',
          to_phone: executorProfile?.phone_number || '',
          created_at: new Date().toISOString(),
          role: roleName
        });
      }

      // 4. Add approved_by manager if different from executed_by
      if (approvedBy && approvedBy !== executedBy) {
        const { data: approverProfile } = await supabase
          .from('profiles')
          .select('full_name, phone_number')
          .eq('user_id', approvedBy)
          .maybeSingle();

        const { data: approverRoles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', approvedBy);

        const roleName = approverRoles?.map(r => getRoleLabel(r.role)).join(', ') || 'تأییدکننده';

        items.push({
          id: 'approved-by-' + approvedBy,
          type: 'manager',
          to_user_id: approvedBy,
          to_name: approverProfile?.full_name || 'تأییدکننده',
          to_phone: approverProfile?.phone_number || '',
          created_at: new Date().toISOString(),
          role: roleName
        });
      }

      // Sort by date
      items.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      setChainItems(items);
    } catch (error) {
      console.error('Error fetching manager chain:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRoleLabel = (role: string): string => {
    const roleLabels: Record<string, string> = {
      'scaffold_executive_manager': 'مدیر اجرایی داربست',
      'executive_manager_scaffold_execution_with_materials': 'مدیر اجرایی داربست با اجناس',
      'sales_manager': 'مدیر فروش',
      'general_manager': 'مدیر کل',
      'ceo': 'مدیرعامل',
      'admin': 'مدیر سیستم',
      'finance_manager': 'مدیر مالی'
    };
    return roleLabels[role] || role;
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'accepted':
      case 'completed':
        return <Badge variant="default" className="gap-1 text-xs"><Check className="h-3 w-3" />تایید شده</Badge>;
      case 'pending_manager':
        return <Badge variant="secondary" className="gap-1 text-xs"><Clock className="h-3 w-3" />در انتظار تایید مدیر</Badge>;
      case 'pending_recipient':
      case 'pending':
        return <Badge variant="secondary" className="gap-1 text-xs"><Clock className="h-3 w-3" />در انتظار پذیرش</Badge>;
      case 'rejected':
      case 'manager_rejected':
      case 'recipient_rejected':
        return <Badge variant="destructive" className="gap-1 text-xs"><X className="h-3 w-3" />رد شده</Badge>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4 animate-spin" />
            <span className="text-sm">در حال بارگذاری...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (chainItems.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Briefcase className="h-5 w-5 text-primary" />
          زنجیره انتقال و همکاری مدیران
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {chainItems.length > 1 && (
            <div className="absolute right-5 top-6 bottom-6 w-0.5 bg-border" />
          )}
          
          <div className="space-y-4">
            {chainItems.map((item) => (
              <div key={item.id} className="relative flex items-start gap-4">
                <div className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                  item.type === 'manager'
                    ? 'bg-purple-100 dark:bg-purple-900/30 border-purple-500 text-purple-600 dark:text-purple-400'
                    : item.type === 'transfer'
                      ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'bg-green-100 dark:bg-green-900/30 border-green-500 text-green-600 dark:text-green-400'
                }`}>
                  {item.type === 'manager' && <Briefcase className="h-4 w-4" />}
                  {item.type === 'transfer' && <ArrowLeftRight className="h-4 w-4" />}
                  {item.type === 'collaborator' && <UserPlus className="h-4 w-4" />}
                </div>

                <div className="flex-1 pb-4">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">
                        {item.type === 'manager' && 'مدیر مسئول سفارش'}
                        {item.type === 'transfer' && 'انتقال بین مدیران'}
                        {item.type === 'collaborator' && 'افزودن همکار مدیریتی'}
                      </span>
                      {item.status && getStatusBadge(item.status)}
                    </div>

                    {item.type === 'manager' && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Briefcase className="h-4 w-4 text-muted-foreground" />
                          <span>{item.to_name}</span>
                          {item.to_phone && (
                            <span className="text-muted-foreground" dir="ltr">({item.to_phone})</span>
                          )}
                        </div>
                        {item.role && (
                          <Badge variant="secondary" className="text-xs">{item.role}</Badge>
                        )}
                      </div>
                    )}

                    {item.type === 'transfer' && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">از:</span>
                          <span>{item.from_name}</span>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground mr-4">
                          <ArrowDown className="h-3 w-3" />
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">به:</span>
                          <span>{item.to_name || 'کاربر'}</span>
                          {item.to_phone && (
                            <span className="text-muted-foreground" dir="ltr">({item.to_phone})</span>
                          )}
                        </div>
                        {item.role && (
                          <Badge variant="outline" className="text-xs mt-1">{item.role}</Badge>
                        )}
                      </div>
                    )}

                    {item.type === 'collaborator' && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">دعوت توسط:</span>
                          <span>{item.from_name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <UserPlus className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">همکار:</span>
                          <span>{item.to_name || 'کاربر'}</span>
                          {item.to_phone && (
                            <span className="text-muted-foreground" dir="ltr">({item.to_phone})</span>
                          )}
                        </div>
                        {item.role && (
                          <Badge variant="outline" className="text-xs mt-1">{item.role}</Badge>
                        )}
                      </div>
                    )}

                    {item.type !== 'manager' && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                        <Calendar className="h-3 w-3" />
                        <span>{formatPersianDate(item.created_at, { showDayOfWeek: true })}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
