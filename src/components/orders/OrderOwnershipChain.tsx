import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  User, 
  ArrowDown, 
  ArrowLeftRight, 
  Phone, 
  Calendar,
  Crown,
  UserPlus,
  Check,
  Clock,
  X,
  Briefcase,
  ChevronDown
} from 'lucide-react';
import { formatPersianDate } from '@/lib/dateUtils';

interface ChainItem {
  id: string;
  type: 'owner' | 'transfer' | 'collaborator' | 'manager';
  from_user_id?: string;
  from_name?: string;
  from_phone?: string;
  to_user_id?: string;
  to_name?: string;
  to_phone?: string;
  status?: string;
  created_at: string;
  is_current_owner?: boolean;
  role?: string;
}

interface OrderOwnershipChainProps {
  orderId: string;
  currentOwnerId: string;
  ownerName?: string;
  ownerPhone?: string;
  transferredFromUserId?: string;
  transferredFromPhone?: string;
  executedBy?: string;
  approvedBy?: string;
}

export function OrderOwnershipChain({ 
  orderId, 
  currentOwnerId, 
  ownerName, 
  ownerPhone,
  transferredFromUserId,
  transferredFromPhone,
  executedBy,
  approvedBy
}: OrderOwnershipChainProps) {
  const [chainItems, setChainItems] = useState<ChainItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const INITIAL_ITEMS_COUNT = 2;

  useEffect(() => {
    fetchOwnershipChain();
  }, [orderId, currentOwnerId, executedBy, approvedBy]);

  const fetchOwnershipChain = async () => {
    try {
      setLoading(true);
      const items: ChainItem[] = [];

      // 1. Fetch transfer requests for this order (shows transfer history)
      const { data: transfers, error: transferError } = await supabase
        .from('order_transfer_requests')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });

      if (transferError) {
        console.error('Error fetching transfers:', transferError);
      }

      // 2. Fetch collaborators for this order
      const { data: collaborators, error: collabError } = await supabase
        .from('order_collaborators')
        .select('*')
        .eq('order_id', orderId)
        .order('invited_at', { ascending: true });

      if (collabError) {
        console.error('Error fetching collaborators:', collabError);
      }

      // 3. Determine original owner
      let originalOwnerPhone = ownerPhone || '';
      let originalOwnerName = ownerName || '';
      let originalOwnerId = currentOwnerId;

      // If there's a transferred_from, that means the original owner transferred it
      if (transferredFromUserId && transferredFromPhone) {
        // Get original owner info
        const { data: originalProfile } = await supabase
          .from('profiles')
          .select('full_name, phone_number')
          .eq('user_id', transferredFromUserId)
          .maybeSingle();

        originalOwnerPhone = transferredFromPhone;
        originalOwnerName = originalProfile?.full_name || 'کاربر';
        originalOwnerId = transferredFromUserId;
      }

      // Add original registrant
      items.push({
        id: 'original-owner',
        type: 'owner',
        to_user_id: originalOwnerId,
        to_name: originalOwnerName || 'کاربر ثبت‌کننده',
        to_phone: originalOwnerPhone,
        created_at: new Date().toISOString(),
        is_current_owner: !transferredFromUserId && originalOwnerId === currentOwnerId
      });

      // 4. Process transfers
      if (transfers && transfers.length > 0) {
        for (const transfer of transfers) {
          // Get from user info
          let fromName = '';
          const { data: fromProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', transfer.from_user_id)
            .maybeSingle();
          fromName = fromProfile?.full_name || 'کاربر';

          // Get to user info
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
            from_name: fromName,
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

      // 5. Process collaborators
      if (collaborators && collaborators.length > 0) {
        for (const collab of collaborators) {
          // Get inviter info
          let inviterName = '';
          const { data: inviterProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', collab.inviter_user_id)
            .maybeSingle();
          inviterName = inviterProfile?.full_name || 'کاربر';

          // Get invitee info
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
            from_name: inviterName,
            to_user_id: collab.invitee_user_id,
            to_name: inviteeName,
            to_phone: collab.invitee_phone_number,
            status: collab.status,
            created_at: collab.invited_at,
            is_current_owner: false
          });
        }
      }

      // 6. Add executed_by manager if exists
      if (executedBy) {
        const { data: executorProfile } = await supabase
          .from('profiles')
          .select('full_name, phone_number')
          .eq('user_id', executedBy)
          .maybeSingle();

        // Get role from user_roles
        const { data: executorRoles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', executedBy);

        const roleName = executorRoles?.map(r => {
          const roleLabels: Record<string, string> = {
            'scaffold_executive_manager': 'مدیر اجرایی داربست',
            'executive_manager_scaffold_execution_with_materials': 'مدیر اجرایی داربست با اجناس',
            'sales_manager': 'مدیر فروش',
            'general_manager': 'مدیر کل',
            'ceo': 'مدیرعامل',
            'admin': 'مدیر سیستم'
          };
          return roleLabels[r.role] || r.role;
        }).join(', ') || 'مدیر اجرایی';

        items.push({
          id: 'executed-by-' + executedBy,
          type: 'manager',
          to_user_id: executedBy,
          to_name: executorProfile?.full_name || 'مدیر اجرایی',
          to_phone: executorProfile?.phone_number || '',
          created_at: new Date().toISOString(),
          is_current_owner: false,
          role: roleName
        });
      }

      // Sort by date
      items.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      setChainItems(items);
    } catch (error) {
      console.error('Error fetching ownership chain:', error);
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

  // Always show at least the owner section
  // If there's only the owner with no transfers/collaborators/managers, show a minimal view
  const showMinimalView = chainItems.length <= 1 && !chainItems.some(item => item.type === 'transfer' || item.type === 'collaborator' || item.type === 'manager');

  const displayedItems = showAll ? chainItems : chainItems.slice(0, INITIAL_ITEMS_COUNT);
  const hasMoreItems = chainItems.length > INITIAL_ITEMS_COUNT;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5 text-primary" />
          زنجیره مالکیت سفارش
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Vertical line connecting items - hide if only one item */}
          {!showMinimalView && chainItems.length > 1 && (
            <div className="absolute right-5 top-6 bottom-6 w-0.5 bg-border" />
          )}
          
          <div className="space-y-4">
            {displayedItems.map((item, index) => (
              <div key={item.id} className="relative flex items-start gap-4">
                {/* Icon circle */}
                <div className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                  item.type === 'owner' 
                    ? 'bg-primary/10 border-primary text-primary' 
                    : item.type === 'transfer'
                      ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-500 text-blue-600 dark:text-blue-400'
                      : item.type === 'manager'
                        ? 'bg-purple-100 dark:bg-purple-900/30 border-purple-500 text-purple-600 dark:text-purple-400'
                        : 'bg-green-100 dark:bg-green-900/30 border-green-500 text-green-600 dark:text-green-400'
                }`}>
                  {item.type === 'owner' && <Crown className="h-4 w-4" />}
                  {item.type === 'transfer' && <ArrowLeftRight className="h-4 w-4" />}
                  {item.type === 'collaborator' && <UserPlus className="h-4 w-4" />}
                  {item.type === 'manager' && <Briefcase className="h-4 w-4" />}
                </div>

                {/* Content */}
                <div className="flex-1 pb-4">
                  <div className="bg-muted/50 rounded-lg p-3">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">
                        {item.type === 'owner' && 'ثبت‌کننده اصلی سفارش'}
                        {item.type === 'transfer' && 'انتقال سفارش'}
                        {item.type === 'collaborator' && 'افزودن همکار'}
                        {item.type === 'manager' && 'مدیر مسئول سفارش'}
                      </span>
                      {item.status && getStatusBadge(item.status)}
                    </div>

                    {/* Content based on type */}
                    {item.type === 'owner' && (
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>{item.to_name}</span>
                        {item.to_phone && (
                          <a 
                            href={`tel:${item.to_phone}`} 
                            className="text-primary hover:underline flex items-center gap-1" 
                            dir="ltr"
                          >
                            <Phone className="h-3 w-3" />
                            {item.to_phone}
                          </a>
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
                            <a 
                              href={`tel:${item.to_phone}`} 
                              className="text-primary hover:underline flex items-center gap-1" 
                              dir="ltr"
                            >
                              <Phone className="h-3 w-3" />
                              {item.to_phone}
                            </a>
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
                            <a 
                              href={`tel:${item.to_phone}`} 
                              className="text-primary hover:underline flex items-center gap-1" 
                              dir="ltr"
                            >
                              <Phone className="h-3 w-3" />
                              {item.to_phone}
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {item.type === 'manager' && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Briefcase className="h-4 w-4 text-muted-foreground" />
                          <span>{item.to_name}</span>
                          {item.to_phone && (
                            <a 
                              href={`tel:${item.to_phone}`} 
                              className="text-primary hover:underline flex items-center gap-1" 
                              dir="ltr"
                            >
                              <Phone className="h-3 w-3" />
                              {item.to_phone}
                            </a>
                          )}
                        </div>
                        {item.role && (
                          <Badge variant="secondary" className="text-xs">{item.role}</Badge>
                        )}
                      </div>
                    )}

                    {/* Date */}
                    {item.type !== 'owner' && item.type !== 'manager' && (
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

          {/* Show More Button */}
          {hasMoreItems && !showAll && (
            <div className="mt-4 text-center">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowAll(true)}
                className="gap-2 text-primary"
              >
                <ChevronDown className="h-4 w-4" />
                نمایش بیشتر ({chainItems.length - INITIAL_ITEMS_COUNT} مورد دیگر)
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
