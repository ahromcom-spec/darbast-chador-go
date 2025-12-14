import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, User, Phone, Check, Clock, X, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

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
  isOwner?: boolean;
  onCollaboratorRemoved?: () => void;
  ownerName?: string;
  ownerPhone?: string;
}

const statusLabels: Record<string, { label: string; icon: React.ReactNode; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  pending: { label: 'در انتظار پذیرش', icon: <Clock className="h-3 w-3" />, variant: 'secondary' },
  accepted: { label: 'پذیرفته شده', icon: <Check className="h-3 w-3" />, variant: 'default' },
  rejected: { label: 'رد شده', icon: <X className="h-3 w-3" />, variant: 'destructive' },
};

export function OrderCollaboratorsList({ orderId, showForManagers = false, isOwner = false, onCollaboratorRemoved, ownerName, ownerPhone }: OrderCollaboratorsListProps) {
  const { user } = useAuth();
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

    } catch (error) {
      console.error('Error fetching collaborators:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteCollaborator = async (collaboratorId: string, isSelf: boolean = false) => {
    try {
      setDeletingId(collaboratorId);
      const { error } = await supabase
        .from('order_collaborators')
        .delete()
        .eq('id', collaboratorId);

      if (error) throw error;

      setCollaborators(prev => prev.filter(c => c.id !== collaboratorId));
      
      if (isSelf) {
        toast.success('شما از همکاری این سفارش خارج شدید');
      } else {
        toast.success('همکار با موفقیت حذف شد');
      }
      
      onCollaboratorRemoved?.();
    } catch (error) {
      console.error('Error deleting collaborator:', error);
      toast.error('خطا در حذف همکار');
    } finally {
      setDeletingId(null);
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
      {/* Order owner section */}
      {(ownerName || ownerPhone) && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <User className="h-5 w-5" />
            <span className="font-semibold">مالک سفارش</span>
          </div>
          <div className="flex items-center gap-3 p-3 bg-background rounded-md border border-border">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium">{ownerName || 'نامشخص'}</span>
              {ownerPhone && (
                <span className="text-xs text-muted-foreground" dir="ltr">{ownerPhone}</span>
              )}
            </div>
            <Badge variant="outline" className="mr-auto text-xs">ثبت‌کننده</Badge>
          </div>
        </div>
      )}

      {/* Collaborators section */}
      {(acceptedCollaborators.length > 0 || pendingCollaborators.length > 0) && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <Users className="h-5 w-5" />
            <span className="font-semibold">همکاران این سفارش</span>
            <Badge variant="secondary" className="mr-auto">
              {acceptedCollaborators.length} همکار فعال
            </Badge>
          </div>
        </div>
      )}

      {/* Accepted collaborators */}
      {acceptedCollaborators.length > 0 && (
        <div className="space-y-2">
          {acceptedCollaborators.map((collab) => {
            // Allow owner to remove any collaborator, or collaborator to remove themselves
            const canRemove = isOwner || collab.invitee_user_id === user?.id;
            
            return (
              <div key={collab.id} className="flex items-center justify-between p-2 bg-background rounded-md">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{collab.invitee_name || 'کاربر'}</span>
                  <span className="text-xs text-muted-foreground" dir="ltr">({collab.invitee_phone_number})</span>
                  {collab.invitee_user_id === user?.id && (
                    <Badge variant="outline" className="text-xs">شما</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={statusLabels.accepted.variant} className="gap-1 text-xs">
                    {statusLabels.accepted.icon}
                    {statusLabels.accepted.label}
                  </Badge>
                  {canRemove && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => deleteCollaborator(collab.id, collab.invitee_user_id === user?.id)}
                      disabled={deletingId === collab.id}
                      title={collab.invitee_user_id === user?.id ? 'لغو همکاری' : 'حذف همکار'}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pending invitations (for managers or owner) */}
      {(showForManagers || isOwner) && pendingCollaborators.length > 0 && (
        <div className="space-y-2 pt-2 border-t">
          <span className="text-xs text-muted-foreground">دعوت‌های در انتظار:</span>
          {pendingCollaborators.map((collab) => (
            <div key={collab.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm" dir="ltr">{collab.invitee_phone_number}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={statusLabels.pending.variant} className="gap-1 text-xs">
                  {statusLabels.pending.icon}
                  {statusLabels.pending.label}
                </Badge>
                {isOwner && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => deleteCollaborator(collab.id)}
                    disabled={deletingId === collab.id}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}