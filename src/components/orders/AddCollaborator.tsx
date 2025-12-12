import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Users, 
  Search, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  UserPlus,
  Trash2,
  Clock 
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDebounce } from '@/hooks/useDebounce';

interface AddCollaboratorProps {
  orderId: string;
  orderCode: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCollaboratorAdded?: () => void;
}

interface Collaborator {
  id: string;
  inviter_user_id: string;
  invitee_user_id: string | null;
  invitee_phone_number: string;
  status: string;
  invited_at: string;
  responded_at: string | null;
  invitee_profile?: {
    full_name: string | null;
  };
}

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'در انتظار تایید', variant: 'secondary' },
  accepted: { label: 'تایید شده', variant: 'default' },
  rejected: { label: 'رد شده', variant: 'destructive' },
};

export function AddCollaborator({ orderId, orderCode, open, onOpenChange, onCollaboratorAdded }: AddCollaboratorProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [targetUser, setTargetUser] = useState<{ id: string; name: string; phone: string } | null>(null);
  const [userNotFound, setUserNotFound] = useState(false);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loadingCollaborators, setLoadingCollaborators] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const debouncedPhone = useDebounce(phoneNumber, 500);

  useEffect(() => {
    if (open) {
      fetchCollaborators();
    }
  }, [open, orderId]);

  const formatPhoneNumber = (phone: string): string => {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('98')) {
      cleaned = '0' + cleaned.slice(2);
    }
    if (!cleaned.startsWith('0') && cleaned.length === 10) {
      cleaned = '0' + cleaned;
    }
    return cleaned;
  };

  useEffect(() => {
    const formattedPhone = formatPhoneNumber(debouncedPhone);
    
    if (formattedPhone.length === 11 && formattedPhone.startsWith('09')) {
      searchUser(formattedPhone);
    } else {
      setTargetUser(null);
      setUserNotFound(false);
    }
  }, [debouncedPhone, user?.id]);

  const fetchCollaborators = async () => {
    setLoadingCollaborators(true);
    try {
      const { data, error } = await supabase
        .from('order_collaborators')
        .select('*')
        .eq('order_id', orderId)
        .order('invited_at', { ascending: false });

      if (error) throw error;

      // Fetch profile names for collaborators
      if (data && data.length > 0) {
        const collaboratorsWithProfiles = await Promise.all(
          data.map(async (collab) => {
            if (collab.invitee_user_id) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('user_id', collab.invitee_user_id)
                .maybeSingle();
              return { ...collab, invitee_profile: profile };
            }
            return collab;
          })
        );
        setCollaborators(collaboratorsWithProfiles);
      } else {
        setCollaborators([]);
      }
    } catch (error) {
      console.error('Error fetching collaborators:', error);
    } finally {
      setLoadingCollaborators(false);
    }
  };

  const searchUser = useCallback(async (formattedPhone: string) => {
    if (!formattedPhone || formattedPhone.length !== 11 || !formattedPhone.startsWith('09')) {
      return;
    }

    setSearching(true);
    setTargetUser(null);
    setUserNotFound(false);

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, phone_number')
        .eq('phone_number', formattedPhone)
        .maybeSingle();

      if (error) throw error;

      if (profile) {
        if (profile.user_id === user?.id) {
          toast({
            title: 'خطا',
            description: 'نمی‌توانید خودتان را به عنوان همکار اضافه کنید',
            variant: 'destructive',
          });
          setUserNotFound(true);
          return;
        }

        // Check if already a collaborator
        const existingCollab = collaborators.find(
          c => c.invitee_phone_number === formattedPhone && c.status !== 'rejected'
        );
        if (existingCollab) {
          toast({
            title: 'خطا',
            description: 'این کاربر قبلاً به عنوان همکار اضافه شده است',
            variant: 'destructive',
          });
          setUserNotFound(true);
          return;
        }

        setTargetUser({
          id: profile.user_id,
          name: profile.full_name || 'بدون نام',
          phone: profile.phone_number || formattedPhone,
        });
      } else {
        setUserNotFound(true);
      }
    } catch (error: any) {
      console.error('Error searching user:', error);
      toast({
        title: 'خطا',
        description: 'خطا در جستجوی کاربر',
        variant: 'destructive',
      });
    } finally {
      setSearching(false);
    }
  }, [user?.id, collaborators, toast]);

  const addCollaborator = async () => {
    if (!targetUser || !user) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('order_collaborators')
        .insert({
          order_id: orderId,
          inviter_user_id: user.id,
          invitee_user_id: targetUser.id,
          invitee_phone_number: targetUser.phone,
          status: 'pending',
        });

      if (error) throw error;

      // Send notification to invitee
      await supabase
        .from('notifications')
        .insert({
          user_id: targetUser.id,
          title: 'دعوت به همکاری در سفارش',
          body: `شما به عنوان همکار در سفارش ${orderCode} دعوت شده‌اید. لطفاً دعوتنامه را بررسی و تایید یا رد کنید.`,
          link: `/user/orders/${orderId}`,
          type: 'info',
        });

      toast({
        title: '✓ موفق',
        description: 'دعوتنامه همکاری ارسال شد. منتظر تایید همکار باشید.',
      });

      setPhoneNumber('');
      setTargetUser(null);
      fetchCollaborators();
      onCollaboratorAdded?.();
    } catch (error: any) {
      console.error('Error adding collaborator:', error);
      toast({
        title: 'خطا',
        description: 'خطا در ارسال دعوتنامه همکاری',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const deleteCollaborator = async (collaboratorId: string) => {
    setDeletingId(collaboratorId);
    try {
      const { error } = await supabase
        .from('order_collaborators')
        .delete()
        .eq('id', collaboratorId);

      if (error) throw error;

      toast({
        title: '✓ حذف شد',
        description: 'همکار از سفارش حذف شد.',
      });

      fetchCollaborators();
      onCollaboratorAdded?.();
    } catch (error: any) {
      console.error('Error deleting collaborator:', error);
      toast({
        title: 'خطا',
        description: 'خطا در حذف همکار',
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            افزودن همکار به سفارش
          </DialogTitle>
          <DialogDescription>
            همکارانی را به سفارش {orderCode} اضافه کنید تا با شما روی این سفارش کار کنند
          </DialogDescription>
        </DialogHeader>

        {/* Existing Collaborators */}
        {loadingCollaborators ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : collaborators.length > 0 ? (
          <Card className="mb-4">
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                همکاران فعلی ({collaborators.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {collaborators.map((collab) => (
                <div
                  key={collab.id}
                  className="flex items-center justify-between p-2 bg-muted/50 rounded-lg"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {collab.invitee_profile?.full_name || 'بدون نام'}
                    </p>
                    <p className="text-xs text-muted-foreground" dir="ltr">
                      {collab.invitee_phone_number}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusLabels[collab.status]?.variant || 'outline'}>
                      {statusLabels[collab.status]?.label || collab.status}
                    </Badge>
                    {collab.status === 'pending' && collab.inviter_user_id === user?.id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
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
            </CardContent>
          </Card>
        ) : null}

        {/* Add New Collaborator Form */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="collab-phone">شماره تماس همکار جدید</Label>
            <div className="flex gap-2">
              <Input
                id="collab-phone"
                placeholder="09123456789"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="flex-1"
                dir="ltr"
              />
              <Button variant="secondary" disabled className="cursor-default">
                {searching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
            {phoneNumber && formatPhoneNumber(phoneNumber).length < 11 && (
              <p className="text-xs text-muted-foreground">شماره باید ۱۱ رقم باشد (مثال: 09123456789)</p>
            )}
          </div>

          {userNotFound && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
              <XCircle className="h-4 w-4 flex-shrink-0" />
              <span>کاربری با این شماره یافت نشد یا قابل اضافه شدن نیست.</span>
            </div>
          )}

          {targetUser && (
            <Card className="border-green-500/50 bg-green-500/5">
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">کاربر یافت شد</span>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">نام:</span>
                  <span className="font-medium">{targetUser.name}</span>
                  <span className="text-muted-foreground">شماره:</span>
                  <span className="font-medium" dir="ltr">{targetUser.phone}</span>
                </div>
              </CardContent>
            </Card>
          )}

          <Separator />

          <div className="text-xs text-muted-foreground space-y-1">
            <p>• همکار پس از تایید می‌تواند جزئیات سفارش را مشاهده کند.</p>
            <p>• می‌توانید در هر زمان همکار را حذف کنید.</p>
          </div>

          <Button
            onClick={addCollaborator}
            disabled={!targetUser || submitting}
            className="w-full gap-2"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            ارسال دعوتنامه همکاری
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
