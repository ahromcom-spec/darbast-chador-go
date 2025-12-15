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
  Crown,
  UserPlus,
  Check,
  Clock,
  X
} from 'lucide-react';
import { formatPersianDate } from '@/lib/dateUtils';

interface ChainItem {
  id: string;
  type: 'owner' | 'transfer' | 'collaborator';
  from_user_id?: string;
  from_name?: string;
  from_phone?: string;
  to_user_id?: string;
  to_name?: string;
  to_phone?: string;
  status?: string;
  created_at: string;
  is_current_owner?: boolean;
}

interface CustomerOwnershipChainProps {
  orderId: string;
  currentOwnerId: string;
  ownerName?: string;
  ownerPhone?: string;
  transferredFromUserId?: string;
  transferredFromPhone?: string;
}

export function CustomerOwnershipChain({ 
  orderId, 
  currentOwnerId, 
  ownerName, 
  ownerPhone,
  transferredFromUserId,
  transferredFromPhone
}: CustomerOwnershipChainProps) {
  const [chainItems, setChainItems] = useState<ChainItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCustomerChain();
  }, [orderId, currentOwnerId, transferredFromUserId]);

  const fetchCustomerChain = async () => {
    try {
      setLoading(true);
      const items: ChainItem[] = [];

      // Get manager roles list (to filter out managers)
      const managerRoles = [
        'admin', 'ceo', 'general_manager', 'sales_manager', 
        'scaffold_executive_manager', 'executive_manager_scaffold_execution_with_materials',
        'finance_manager'
      ];

      // 1. Determine original owner
      let originalOwnerPhone = ownerPhone || '';
      let originalOwnerName = ownerName || '';
      let originalOwnerId = currentOwnerId;

      if (transferredFromUserId && transferredFromPhone) {
        const { data: originalProfile } = await supabase
          .from('profiles')
          .select('full_name, phone_number')
          .eq('user_id', transferredFromUserId)
          .maybeSingle();

        originalOwnerPhone = transferredFromPhone;
        originalOwnerName = originalProfile?.full_name || 'کاربر';
        originalOwnerId = transferredFromUserId;
      }

      // Check if original owner is a customer (not a manager)
      const { data: originalRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', originalOwnerId);

      const isOriginalCustomer = !originalRoles?.some(r => managerRoles.includes(r.role));

      if (isOriginalCustomer) {
        items.push({
          id: 'original-owner',
          type: 'owner',
          to_user_id: originalOwnerId,
          to_name: originalOwnerName || 'کاربر ثبت‌کننده',
          to_phone: originalOwnerPhone,
          created_at: new Date().toISOString(),
          is_current_owner: !transferredFromUserId && originalOwnerId === currentOwnerId
        });
      }

      // 2. Fetch transfer requests between customers
      const { data: transfers, error: transferError } = await supabase
        .from('order_transfer_requests')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });

      if (transferError) {
        console.error('Error fetching transfers:', transferError);
      }

      if (transfers && transfers.length > 0) {
        for (const transfer of transfers) {
          // Check if from_user is NOT a manager (is a customer)
          const { data: fromRoles } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', transfer.from_user_id);

          const isFromCustomer = !fromRoles?.some(r => managerRoles.includes(r.role));
          
          if (isFromCustomer) {
            const { data: fromProfile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('user_id', transfer.from_user_id)
              .maybeSingle();

            let toName = '';
            if (transfer.to_user_id) {
              const { data: toProfile } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('user_id', transfer.to_user_id)
                .maybeSingle();
              toName = toProfile?.full_name || 'کاربر';
            }

            items.push({
              id: transfer.id,
              type: 'transfer',
              from_user_id: transfer.from_user_id,
              from_name: fromProfile?.full_name || 'کاربر',
              from_phone: '',
              to_user_id: transfer.to_user_id,
              to_name: toName,
              to_phone: transfer.to_phone_number,
              status: transfer.status,
              created_at: transfer.created_at,
              is_current_owner: transfer.status === 'accepted' || transfer.status === 'completed'
            });
          }
        }
      }

      // 3. Fetch customer collaborators (where inviter is NOT a manager)
      const { data: collaborators, error: collabError } = await supabase
        .from('order_collaborators')
        .select('*')
        .eq('order_id', orderId)
        .order('invited_at', { ascending: true });

      if (collabError) {
        console.error('Error fetching collaborators:', collabError);
      }

      if (collaborators && collaborators.length > 0) {
        for (const collab of collaborators) {
          const { data: inviterRoles } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', collab.inviter_user_id);

          const isInviterCustomer = !inviterRoles?.some(r => managerRoles.includes(r.role));

          if (isInviterCustomer) {
            const { data: inviterProfile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('user_id', collab.inviter_user_id)
              .maybeSingle();

            let inviteeName = '';
            if (collab.invitee_user_id) {
              const { data: inviteeProfile } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('user_id', collab.invitee_user_id)
                .maybeSingle();
              inviteeName = inviteeProfile?.full_name || 'کاربر';
            }

            items.push({
              id: collab.id,
              type: 'collaborator',
              from_user_id: collab.inviter_user_id,
              from_name: inviterProfile?.full_name || 'کاربر',
              to_user_id: collab.invitee_user_id,
              to_name: inviteeName,
              to_phone: collab.invitee_phone_number,
              status: collab.status,
              created_at: collab.invited_at,
              is_current_owner: false
            });
          }
        }
      }

      // Sort by date
      items.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      setChainItems(items);
    } catch (error) {
      console.error('Error fetching customer chain:', error);
    } finally {
      setLoading(false);
    }
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

  // If only owner with no transfers/collaborators, don't show
  if (chainItems.length <= 1 && !chainItems.some(item => item.type === 'transfer' || item.type === 'collaborator')) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5 text-primary" />
          زنجیره مالکیت و همکاری مشتریان
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
                  item.type === 'owner' 
                    ? 'bg-primary/10 border-primary text-primary' 
                    : item.type === 'transfer'
                      ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'bg-green-100 dark:bg-green-900/30 border-green-500 text-green-600 dark:text-green-400'
                }`}>
                  {item.type === 'owner' && <Crown className="h-4 w-4" />}
                  {item.type === 'transfer' && <ArrowLeftRight className="h-4 w-4" />}
                  {item.type === 'collaborator' && <UserPlus className="h-4 w-4" />}
                </div>

                <div className="flex-1 pb-4">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">
                        {item.type === 'owner' && 'ثبت‌کننده اصلی سفارش'}
                        {item.type === 'transfer' && 'انتقال سفارش بین مشتریان'}
                        {item.type === 'collaborator' && 'افزودن همکار مشتری'}
                      </span>
                      {item.status && getStatusBadge(item.status)}
                    </div>

                    {item.type === 'owner' && (
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>{item.to_name}</span>
                        {item.to_phone && (
                          <span className="text-muted-foreground" dir="ltr">({item.to_phone})</span>
                        )}
                        {item.is_current_owner && (
                          <Badge variant="outline" className="text-xs">مالک فعلی</Badge>
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
                      </div>
                    )}

                    {item.type !== 'owner' && (
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
