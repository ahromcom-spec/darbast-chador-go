import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Users, Check, X, MapPin, Layers } from 'lucide-react';
import { formatPersianDate } from '@/lib/dateUtils';

interface ProjectInvite {
  id: string;
  project_id: string;
  inviter_user_id: string;
  invited_at: string;
  inviter_name?: string;
  project_title?: string;
  location_address?: string;
  service_type?: string;
  subcategory?: string;
}

export function PendingProjectInvites() {
  const [invites, setInvites] = useState<ProjectInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchInvites();
    }
  }, [user]);

  const fetchInvites = async () => {
    if (!user) return;

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('phone_number')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profile?.phone_number) {
        setLoading(false);
        return;
      }

      const { data: invitesData, error } = await supabase
        .from('project_collaborators')
        .select('id, project_id, inviter_user_id, invited_at')
        .or(`invitee_user_id.eq.${user.id},invitee_phone_number.eq.${profile.phone_number}`)
        .eq('status', 'pending')
        .order('invited_at', { ascending: false });

      if (error) throw error;

      if (!invitesData || invitesData.length === 0) {
        setInvites([]);
        setLoading(false);
        return;
      }

      const enrichedInvites = await Promise.all(
        invitesData.map(async (invite) => {
          const { data: inviterProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', invite.inviter_user_id)
            .maybeSingle();

          const { data: project } = await supabase
            .from('projects_hierarchy')
            .select(`
              title,
              locations (address_line),
              service_types_v3 (name),
              subcategories (name)
            `)
            .eq('id', invite.project_id)
            .maybeSingle();

          return {
            ...invite,
            inviter_name: inviterProfile?.full_name || 'کاربر',
            project_title: project?.title || 'پروژه',
            location_address: project?.locations?.address_line || '',
            service_type: project?.service_types_v3?.name || '',
            subcategory: project?.subcategories?.name || ''
          };
        })
      );

      setInvites(enrichedInvites);
    } catch (error) {
      console.error('Error fetching project invites:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (invite: ProjectInvite) => {
    if (!user) return;
    setProcessingId(invite.id);

    try {
      // Get project details for creating collaborator's copy
      const { data: project, error: projectError } = await supabase
        .from('projects_hierarchy')
        .select(`
          *,
          locations (*)
        `)
        .eq('id', invite.project_id)
        .single();

      if (projectError) throw projectError;

      // Create location for collaborator
      const { data: newLocation, error: locationError } = await supabase
        .from('locations')
        .insert({
          user_id: user.id,
          address_line: project.locations?.address_line || '',
          lat: project.locations?.lat || 0,
          lng: project.locations?.lng || 0,
          province_id: project.locations?.province_id,
          district_id: project.locations?.district_id,
          title: project.locations?.title || null
        })
        .select()
        .single();

      if (locationError) throw locationError;

      // Create project hierarchy for collaborator
      const { error: hierarchyError } = await supabase
        .from('projects_hierarchy')
        .insert({
          user_id: user.id,
          location_id: newLocation.id,
          service_type_id: project.service_type_id,
          subcategory_id: project.subcategory_id,
          title: project.title,
          status: 'active'
        });

      if (hierarchyError) throw hierarchyError;

      // Update invite status
      const { error: updateError } = await supabase
        .from('project_collaborators')
        .update({
          status: 'accepted',
          invitee_user_id: user.id,
          responded_at: new Date().toISOString()
        })
        .eq('id', invite.id);

      if (updateError) throw updateError;

      // Notify inviter
      await supabase.from('notifications').insert({
        user_id: invite.inviter_user_id,
        title: 'همکاری پروژه پذیرفته شد',
        body: `درخواست همکاری شما در پروژه "${invite.project_title}" پذیرفته شد.`,
        type: 'collaboration_accepted',
        link: '/user/my-projects'
      });

      toast({
        title: 'موفق',
        description: 'پروژه با موفقیت به لیست پروژه‌های شما اضافه شد'
      });

      fetchInvites();
    } catch (error: any) {
      console.error('Error accepting invite:', error);
      toast({
        title: 'خطا',
        description: error.message || 'خطا در پذیرش دعوتنامه',
        variant: 'destructive'
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (invite: ProjectInvite) => {
    if (!user) return;
    setProcessingId(invite.id);

    try {
      const { error } = await supabase
        .from('project_collaborators')
        .update({
          status: 'rejected',
          invitee_user_id: user.id,
          responded_at: new Date().toISOString()
        })
        .eq('id', invite.id);

      if (error) throw error;

      await supabase.from('notifications').insert({
        user_id: invite.inviter_user_id,
        title: 'همکاری پروژه رد شد',
        body: `درخواست همکاری شما در پروژه "${invite.project_title}" رد شد.`,
        type: 'collaboration_rejected',
        link: '/user/my-projects'
      });

      toast({
        title: 'انجام شد',
        description: 'دعوتنامه رد شد'
      });

      fetchInvites();
    } catch (error: any) {
      toast({
        title: 'خطا',
        description: 'خطا در رد دعوتنامه',
        variant: 'destructive'
      });
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (invites.length === 0) {
    return null;
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5 text-primary" />
          دعوت‌های همکاری پروژه
          <Badge variant="secondary">{invites.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {invites.map((invite) => (
          <div
            key={invite.id}
            className="p-4 bg-background rounded-lg border space-y-3"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="font-medium">{invite.project_title}</p>
                <p className="text-sm text-muted-foreground">
                  دعوت از طرف: {invite.inviter_name}
                </p>
              </div>
              <Badge variant="outline">
                {formatPersianDate(invite.invited_at)}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              {invite.location_address && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {invite.location_address}
                </div>
              )}
              {invite.service_type && (
                <div className="flex items-center gap-1">
                  <Layers className="h-3 w-3" />
                  {invite.service_type} - {invite.subcategory}
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                onClick={() => handleAccept(invite)}
                disabled={processingId === invite.id}
                className="flex-1"
              >
                {processingId === invite.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Check className="h-4 w-4 ml-1" />
                    پذیرفتن
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleReject(invite)}
                disabled={processingId === invite.id}
                className="flex-1"
              >
                <X className="h-4 w-4 ml-1" />
                رد کردن
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
