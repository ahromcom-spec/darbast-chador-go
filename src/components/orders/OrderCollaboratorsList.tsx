import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Users, User, Phone, Check, Clock, X } from 'lucide-react';

interface Collaborator {
  id: string;
  invitee_user_id: string | null;
  invitee_phone_number: string;
  inviter_user_id: string;
  status: string;
  invited_at: string;
  inviter_name?: string;
  invitee_name?: string;
}

interface OrderCollaboratorsListProps {
  orderId: string;
  showForManagers?: boolean;
}

const statusLabels: Record<string, { label: string; icon: React.ReactNode; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  pending: { label: 'در انتظار پذیرش', icon: <Clock className="h-3 w-3" />, variant: 'secondary' },
  accepted: { label: 'پذیرفته شده', icon: <Check className="h-3 w-3" />, variant: 'default' },
  rejected: { label: 'رد شده', icon: <X className="h-3 w-3" />, variant: 'destructive' },
};

export function OrderCollaboratorsList({ orderId, showForManagers = false }: OrderCollaboratorsListProps) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [ownerInfo, setOwnerInfo] = useState<{ name: string; phone: string } | null>(null);

  useEffect(() => {
    fetchCollaborators();
  }, [orderId]);

  const fetchCollaborators = async () => {
    try {
      // Fetch collaborators
      const { data: collabs, error } = await supabase
        .from('order_collaborators')
        .select('id, invitee_user_id, invitee_phone_number, inviter_user_id, status, invited_at')
        .eq('order_id', orderId)
        .order('invited_at', { ascending: false });

      if (error) throw error;

      if (!collabs || collabs.length === 0) {
        setCollaborators([]);
        setLoading(false);
        return;
      }

      // Get names for each collaborator
      const enrichedCollabs = await Promise.all(
        collabs.map(async (collab) => {
          // Get inviter name
          const { data: inviterProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', collab.inviter_user_id)
            .maybeSingle();

          // Get invitee name if user_id exists
          let inviteeName = '';
          if (collab.invitee_user_id) {
            const { data: inviteeProfile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('user_id', collab.invitee_user_id)
              .maybeSingle();
            inviteeName = inviteeProfile?.full_name || '';
          }

          return {
            ...collab,
            inviter_name: inviterProfile?.full_name || 'نامشخص',
            invitee_name: inviteeName,
          };
        })
      );

      setCollaborators(enrichedCollabs);

      // Fetch order owner info if showing for managers
      if (showForManagers) {
        const { data: order } = await supabase
          .from('projects_v3')
          .select('customer_name, customer_phone')
          .eq('id', orderId)
          .maybeSingle();

        if (order) {
          setOwnerInfo({
            name: order.customer_name || 'نامشخص',
            phone: order.customer_phone || '',
          });
        }
      }
    } catch (error) {
      console.error('Error fetching collaborators:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return null;
  }

  // Don't show anything if no collaborators
  if (collaborators.length === 0) {
    return null;
  }

  const acceptedCollaborators = collaborators.filter(c => c.status === 'accepted');
  const pendingCollaborators = collaborators.filter(c => c.status === 'pending');

  return (
    <div className="space-y-3 p-4 bg-primary/5 rounded-lg border border-primary/20">
      <div className="flex items-center gap-2 text-primary">
        <Users className="h-5 w-5" />
        <span className="font-semibold">همکاران این سفارش</span>
        <Badge variant="secondary" className="mr-auto">
          {acceptedCollaborators.length} همکار فعال
        </Badge>
      </div>

      {/* Owner info (for managers) */}
      {showForManagers && ownerInfo && (
        <div className="flex items-center gap-2 p-2 bg-background rounded-md">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">مالک اصلی:</span>
          <span className="text-sm">{ownerInfo.name}</span>
          {ownerInfo.phone && (
            <>
              <Phone className="h-3 w-3 text-muted-foreground mr-2" />
              <span className="text-xs text-muted-foreground" dir="ltr">{ownerInfo.phone}</span>
            </>
          )}
        </div>
      )}

      {/* Accepted collaborators */}
      {acceptedCollaborators.length > 0 && (
        <div className="space-y-2">
          {acceptedCollaborators.map((collab) => (
            <div key={collab.id} className="flex items-center justify-between p-2 bg-background rounded-md">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{collab.invitee_name || 'کاربر'}</span>
                <span className="text-xs text-muted-foreground" dir="ltr">({collab.invitee_phone_number})</span>
              </div>
              <Badge variant={statusLabels.accepted.variant} className="gap-1 text-xs">
                {statusLabels.accepted.icon}
                {statusLabels.accepted.label}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {/* Pending invitations (for managers) */}
      {showForManagers && pendingCollaborators.length > 0 && (
        <div className="space-y-2 pt-2 border-t">
          <span className="text-xs text-muted-foreground">دعوت‌های در انتظار:</span>
          {pendingCollaborators.map((collab) => (
            <div key={collab.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm" dir="ltr">{collab.invitee_phone_number}</span>
              </div>
              <Badge variant={statusLabels.pending.variant} className="gap-1 text-xs">
                {statusLabels.pending.icon}
                {statusLabels.pending.label}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}