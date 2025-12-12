import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useDebounce } from '@/hooks/useDebounce';
import { Loader2, Search, UserPlus, User, Phone, Check, Clock, X, Trash2 } from 'lucide-react';

interface AddProjectCollaboratorProps {
  projectId: string;
  projectTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCollaboratorAdded?: () => void;
}

interface Collaborator {
  id: string;
  invitee_user_id: string | null;
  invitee_phone_number: string;
  status: string;
  invited_at: string;
  invitee_name?: string;
}

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  pending: { label: 'در انتظار پذیرش', variant: 'secondary' },
  accepted: { label: 'پذیرفته شده', variant: 'default' },
  rejected: { label: 'رد شده', variant: 'destructive' },
};

export function AddProjectCollaborator({ projectId, projectTitle, open, onOpenChange, onCollaboratorAdded }: AddProjectCollaboratorProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [targetUser, setTargetUser] = useState<{ id: string; name: string; phone: string } | null>(null);
  const [userNotFound, setUserNotFound] = useState(false);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loadingCollaborators, setLoadingCollaborators] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  const { toast } = useToast();
  const { user } = useAuth();
  const debouncedPhone = useDebounce(phoneNumber, 500);

  useEffect(() => {
    if (open) {
      fetchCollaborators();
    }
  }, [open, projectId]);

  useEffect(() => {
    if (debouncedPhone.length >= 10) {
      searchUser(debouncedPhone);
    } else {
      setTargetUser(null);
      setUserNotFound(false);
    }
  }, [debouncedPhone]);

  const formatPhoneNumber = (phone: string): string => {
    let formatted = phone.replace(/\D/g, '');
    if (formatted.startsWith('98')) {
      formatted = '0' + formatted.slice(2);
    } else if (formatted.startsWith('+98')) {
      formatted = '0' + formatted.slice(3);
    }
    if (!formatted.startsWith('0')) {
      formatted = '0' + formatted;
    }
    return formatted;
  };

  const fetchCollaborators = async () => {
    setLoadingCollaborators(true);
    try {
      const { data, error } = await supabase
        .from('project_collaborators')
        .select('id, invitee_user_id, invitee_phone_number, status, invited_at')
        .eq('project_id', projectId)
        .order('invited_at', { ascending: false });

      if (error) throw error;

      const enrichedCollabs = await Promise.all(
        (data || []).map(async (collab) => {
          let inviteeName = '';
          if (collab.invitee_user_id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('user_id', collab.invitee_user_id)
              .maybeSingle();
            inviteeName = profile?.full_name || '';
          }
          return { ...collab, invitee_name: inviteeName };
        })
      );

      setCollaborators(enrichedCollabs);
    } catch (error) {
      console.error('Error fetching collaborators:', error);
    } finally {
      setLoadingCollaborators(false);
    }
  };

  const searchUser = async (phone: string) => {
    setIsSearching(true);
    setUserNotFound(false);
    setTargetUser(null);

    try {
      const formattedPhone = formatPhoneNumber(phone);
      
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, phone_number')
        .eq('phone_number', formattedPhone)
        .maybeSingle();

      if (error) throw error;

      if (!profile) {
        setUserNotFound(true);
        return;
      }

      if (profile.user_id === user?.id) {
        toast({
          title: 'خطا',
          description: 'نمی‌توانید خودتان را به عنوان همکار اضافه کنید',
          variant: 'destructive'
        });
        return;
      }

      const existingCollab = collaborators.find(c => 
        c.invitee_phone_number === formattedPhone && c.status !== 'rejected'
      );
      if (existingCollab) {
        toast({
          title: 'توجه',
          description: 'این کاربر قبلاً به عنوان همکار اضافه شده است',
          variant: 'default'
        });
        return;
      }

      setTargetUser({
        id: profile.user_id,
        name: profile.full_name || 'کاربر',
        phone: profile.phone_number || formattedPhone
      });
    } catch (error) {
      console.error('Error searching user:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const addCollaborator = async () => {
    if (!targetUser || !user) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('project_collaborators')
        .insert({
          project_id: projectId,
          inviter_user_id: user.id,
          invitee_user_id: targetUser.id,
          invitee_phone_number: targetUser.phone,
          status: 'pending'
        });

      if (error) throw error;

      await supabase.from('notifications').insert({
        user_id: targetUser.id,
        title: 'دعوت به همکاری در پروژه',
        body: `شما به همکاری در پروژه "${projectTitle}" دعوت شده‌اید. لطفاً از طریق پروفایل خود تایید کنید.`,
        type: 'collaboration_invite',
        link: '/profile'
      });

      toast({
        title: 'موفق',
        description: 'دعوتنامه همکاری ارسال شد'
      });

      setPhoneNumber('');
      setTargetUser(null);
      fetchCollaborators();
      onCollaboratorAdded?.();
    } catch (error: any) {
      console.error('Error adding collaborator:', error);
      toast({
        title: 'خطا',
        description: error.message || 'خطا در ارسال دعوتنامه',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteCollaborator = async (collabId: string) => {
    setDeletingId(collabId);
    try {
      const { error } = await supabase
        .from('project_collaborators')
        .delete()
        .eq('id', collabId);

      if (error) throw error;

      toast({
        title: 'موفق',
        description: 'دعوتنامه حذف شد'
      });
      fetchCollaborators();
    } catch (error: any) {
      toast({
        title: 'خطا',
        description: 'خطا در حذف دعوتنامه',
        variant: 'destructive'
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            اضافه کردن همکار به پروژه
          </DialogTitle>
          <DialogDescription>
            پروژه: {projectTitle}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loadingCollaborators ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : collaborators.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">همکاران فعلی:</Label>
              {collaborators.map((collab) => (
                <div key={collab.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{collab.invitee_name || 'کاربر'}</span>
                    <span className="text-xs text-muted-foreground" dir="ltr">({collab.invitee_phone_number})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusLabels[collab.status]?.variant || 'secondary'}>
                      {statusLabels[collab.status]?.label || collab.status}
                    </Badge>
                    {collab.status === 'pending' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => deleteCollaborator(collab.id)}
                        disabled={deletingId === collab.id}
                      >
                        {deletingId === collab.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="phone">شماره موبایل همکار جدید</Label>
            <div className="relative">
              <Input
                id="phone"
                type="tel"
                placeholder="09123456789"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                dir="ltr"
                className="pl-10"
              />
              {isSearching && (
                <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>

          {userNotFound && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
              کاربری با این شماره موبایل در سیستم یافت نشد
            </div>
          )}

          {targetUser && (
            <div className="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-200">{targetUser.name}</p>
                  <p className="text-sm text-green-600" dir="ltr">{targetUser.phone}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            بستن
          </Button>
          <Button
            onClick={addCollaborator}
            disabled={!targetUser || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
                در حال ارسال...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4 ml-2" />
                ارسال دعوتنامه
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
