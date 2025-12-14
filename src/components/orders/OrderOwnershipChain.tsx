import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

interface OrderOwnershipChainProps {
  orderId: string;
  currentOwnerId: string;
  ownerName?: string;
  ownerPhone?: string;
  transferredFromUserId?: string;
  transferredFromPhone?: string;
}

export function OrderOwnershipChain({ 
  orderId, 
  currentOwnerId, 
  ownerName, 
  ownerPhone,
  transferredFromUserId,
  transferredFromPhone 
}: OrderOwnershipChainProps) {
  const [chainItems, setChainItems] = useState<ChainItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOwnershipChain();
  }, [orderId, currentOwnerId]);

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

  // If no transfers or collaborators, just show simple owner
  if (chainItems.length <= 1 && !chainItems.some(item => item.type === 'transfer' || item.type === 'collaborator')) {
    return null; // Don't show the chain if there's only the owner with no transfers/collaborators
  }

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
          {/* Vertical line connecting items */}
          <div className="absolute right-5 top-6 bottom-6 w-0.5 bg-border" />
          
          <div className="space-y-4">
            {chainItems.map((item, index) => (
              <div key={item.id} className="relative flex items-start gap-4">
                {/* Icon circle */}
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

                {/* Content */}
                <div className="flex-1 pb-4">
                  <div className="bg-muted/50 rounded-lg p-3">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">
                        {item.type === 'owner' && 'ثبت‌کننده اصلی سفارش'}
                        {item.type === 'transfer' && 'انتقال سفارش'}
                        {item.type === 'collaborator' && 'افزودن همکار'}
                      </span>
                      {item.status && getStatusBadge(item.status)}
                    </div>

                    {/* Content based on type */}
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

                    {/* Date */}
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
