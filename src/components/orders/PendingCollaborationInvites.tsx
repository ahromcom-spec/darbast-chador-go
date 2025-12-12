import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Users, Check, X, Package, MapPin, Calendar, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface CollaborationInvite {
  id: string;
  order_id: string;
  inviter_user_id: string;
  status: string;
  invited_at: string;
  inviter_name?: string;
  inviter_phone?: string;
  order_code?: string;
  order_address?: string;
  order_status?: string;
  subcategory_name?: string;
}

export function PendingCollaborationInvites() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [invites, setInvites] = useState<CollaborationInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchInvites();
    }
  }, [user]);

  const fetchInvites = async () => {
    if (!user) return;

    try {
      // Get user's phone number
      const { data: profile } = await supabase
        .from('profiles')
        .select('phone_number')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profile?.phone_number) {
        setInvites([]);
        setLoading(false);
        return;
      }

      // Fetch pending collaboration invites for this user
      const { data: collaborations, error } = await supabase
        .from('order_collaborators')
        .select(`
          id,
          order_id,
          inviter_user_id,
          status,
          invited_at
        `)
        .or(`invitee_user_id.eq.${user.id},invitee_phone_number.eq.${profile.phone_number}`)
        .eq('status', 'pending')
        .order('invited_at', { ascending: false });

      if (error) throw error;

      if (!collaborations || collaborations.length === 0) {
        setInvites([]);
        setLoading(false);
        return;
      }

      // Fetch additional details for each invite
      const enrichedInvites = await Promise.all(
        collaborations.map(async (collab) => {
          // Get inviter profile
          const { data: inviterProfile } = await supabase
            .from('profiles')
            .select('full_name, phone_number')
            .eq('user_id', collab.inviter_user_id)
            .maybeSingle();

          // Get order details
          const { data: order } = await supabase
            .from('projects_v3')
            .select(`
              code,
              address,
              status,
              subcategories:subcategory_id (name)
            `)
            .eq('id', collab.order_id)
            .maybeSingle();

          return {
            ...collab,
            inviter_name: inviterProfile?.full_name || 'نامشخص',
            inviter_phone: inviterProfile?.phone_number || '',
            order_code: order?.code || '',
            order_address: order?.address || '',
            order_status: order?.status || '',
            subcategory_name: (order?.subcategories as any)?.name || '',
          } as CollaborationInvite;
        })
      );

      setInvites(enrichedInvites);
    } catch (error) {
      console.error('Error fetching collaboration invites:', error);
      toast.error('خطا در دریافت دعوت‌نامه‌های همکاری');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (invite: CollaborationInvite) => {
    if (!user) return;

    setProcessingId(invite.id);
    try {
      const { error } = await supabase
        .from('order_collaborators')
        .update({
          status: 'accepted',
          invitee_user_id: user.id,
          responded_at: new Date().toISOString(),
        })
        .eq('id', invite.id);

      if (error) throw error;

      // Send notification to inviter
      await supabase.from('notifications').insert({
        user_id: invite.inviter_user_id,
        title: 'دعوت همکاری پذیرفته شد',
        body: `دعوت همکاری شما برای سفارش #${invite.order_code} پذیرفته شد.`,
        type: 'success',
        link: `/user/orders/${invite.order_id}`,
      });

      toast.success('دعوت همکاری با موفقیت پذیرفته شد');
      
      // Remove from list
      setInvites(prev => prev.filter(i => i.id !== invite.id));
    } catch (error) {
      console.error('Error accepting collaboration:', error);
      toast.error('خطا در پذیرش دعوت همکاری');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (invite: CollaborationInvite) => {
    if (!user) return;

    setProcessingId(invite.id);
    try {
      const { error } = await supabase
        .from('order_collaborators')
        .update({
          status: 'rejected',
          invitee_user_id: user.id,
          responded_at: new Date().toISOString(),
        })
        .eq('id', invite.id);

      if (error) throw error;

      // Send notification to inviter
      await supabase.from('notifications').insert({
        user_id: invite.inviter_user_id,
        title: 'دعوت همکاری رد شد',
        body: `دعوت همکاری شما برای سفارش #${invite.order_code} رد شد.`,
        type: 'info',
        link: `/user/orders/${invite.order_id}`,
      });

      toast.success('دعوت همکاری رد شد');
      
      // Remove from list
      setInvites(prev => prev.filter(i => i.id !== invite.id));
    } catch (error) {
      console.error('Error rejecting collaboration:', error);
      toast.error('خطا در رد دعوت همکاری');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return null;
  }

  if (invites.length === 0) {
    return null;
  }

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg text-primary">
          <Users className="h-5 w-5" />
          دعوت‌نامه‌های همکاری در انتظار
          <Badge variant="secondary" className="mr-auto">
            {invites.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {invites.map((invite) => (
          <div
            key={invite.id}
            className="p-4 rounded-lg border bg-card hover:shadow-md transition-shadow"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-2 flex-1">
                {/* Order Code */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-foreground">
                    سفارش #{invite.order_code}
                  </span>
                </div>

                {/* Service Type */}
                {invite.subcategory_name && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Package className="h-4 w-4" />
                    <span>{invite.subcategory_name}</span>
                  </div>
                )}

                {/* Address */}
                {invite.order_address && (
                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span className="line-clamp-1">{invite.order_address}</span>
                  </div>
                )}

                {/* Inviter Info */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  <span>
                    دعوت از طرف: {invite.inviter_name}
                    {invite.inviter_phone && ` (${invite.inviter_phone})`}
                  </span>
                </div>

                {/* Invite Date */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>
                    {new Date(invite.invited_at).toLocaleDateString('fa-IR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="default"
                  className="gap-1"
                  onClick={() => handleAccept(invite)}
                  disabled={processingId === invite.id}
                >
                  {processingId === invite.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  پذیرش
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={() => handleReject(invite)}
                  disabled={processingId === invite.id}
                >
                  <X className="h-4 w-4" />
                  رد
                </Button>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
