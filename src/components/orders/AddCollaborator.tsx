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
import { ContactPickerButton } from '@/components/common/ContactPickerButton';

interface AddCollaboratorProps {
  orderId: string;
  orderCode: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCollaboratorAdded?: () => void;
  ownerName?: string;
  ownerPhone?: string;
}

interface Collaborator {
  id: string;
  inviter_user_id: string;
  invitee_user_id: string | null;
  invitee_phone_number: string;
  status: string;
  invited_at: string;
  responded_at: string | null;
  can_view_financials?: boolean;
  can_manage_order?: boolean;
  invitee_profile?: {
    full_name: string | null;
  };
}


const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending_manager: { label: 'در انتظار تایید مدیر', variant: 'secondary' },
  manager_rejected: { label: 'رد شده توسط مدیر', variant: 'destructive' },
  manager_approved: { label: 'تایید شده توسط مدیر - در انتظار همکار', variant: 'secondary' },
  pending_registration: { label: 'در انتظار ثبت‌نام همکار', variant: 'secondary' },
  pending: { label: 'در انتظار تایید همکار', variant: 'secondary' },
  accepted: { label: 'تایید شده', variant: 'default' },
  rejected: { label: 'رد شده توسط همکار', variant: 'destructive' },
};

const MAX_COLLABORATORS = 5;

export function AddCollaborator({ orderId, orderCode, open, onOpenChange, onCollaboratorAdded, ownerName, ownerPhone }: AddCollaboratorProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [targetUser, setTargetUser] = useState<{ id: string; name: string; phone: string } | null>(null);
  const [userNotFound, setUserNotFound] = useState(false);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loadingCollaborators, setLoadingCollaborators] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [newCanViewFinancials, setNewCanViewFinancials] = useState(true);
  const [newCanManageOrder, setNewCanManageOrder] = useState(false);
  const [updatingPermId, setUpdatingPermId] = useState<string | null>(null);

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

      // Fetch profile names by phone (uses security-definer RPC to bypass profiles RLS)
      if (data && data.length > 0) {
        const collaboratorsWithProfiles = await Promise.all(
          data.map(async (collab) => {
            try {
              const { data: profileResult } = await supabase
                .rpc('lookup_profile_by_phone' as any, { _phone: collab.invitee_phone_number })
                .maybeSingle();
              const profile = profileResult as { full_name: string | null } | null;
              return { ...collab, invitee_profile: profile ? { full_name: profile.full_name } : undefined };
            } catch {
              return collab;
            }
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
      const { data: profileResult, error } = await supabase
        .rpc('lookup_profile_by_phone' as any, { _phone: formattedPhone })
        .maybeSingle();

      if (error) throw error;
      const profile = profileResult as { user_id: string; full_name: string | null; phone_number: string | null } | null;

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

        // Check if already an active collaborator (ignore any rejected statuses to allow re-invitation)
        const existingCollab = collaborators.find(
          c => c.invitee_phone_number === formattedPhone &&
               !['rejected', 'manager_rejected', 'recipient_rejected'].includes(c.status)
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

  // Count active (non-rejected) collaborators
  const INACTIVE_STATUSES = ['rejected', 'manager_rejected', 'recipient_rejected'];
  const activeCollaboratorsCount = collaborators.filter(c => !INACTIVE_STATUSES.includes(c.status)).length;
  const canAddMoreCollaborators = activeCollaboratorsCount < MAX_COLLABORATORS;

  const addCollaborator = async () => {
    const formattedPhone = formatPhoneNumber(phoneNumber);
    if (!user || formattedPhone.length !== 11 || !formattedPhone.startsWith('09')) return;

    if (!canAddMoreCollaborators) {
      toast({
        title: 'محدودیت تعداد همکاران',
        description: `حداکثر ${MAX_COLLABORATORS} همکار می‌توانید به هر سفارش اضافه کنید.`,
        variant: 'destructive',
      });
      return;
    }

    if (collaborators.some(c => c.invitee_phone_number === formattedPhone && !INACTIVE_STATUSES.includes(c.status))) {
      toast({
        title: 'خطا',
        description: 'این شماره قبلاً به عنوان همکار اضافه شده است',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('order_collaborators')
        .insert({
          order_id: orderId,
          inviter_user_id: user.id,
          invitee_user_id: targetUser?.id || null,
          invitee_phone_number: targetUser?.phone || formattedPhone,
          status: 'pending_manager',
          can_view_financials: newCanViewFinancials,
          can_manage_order: newCanManageOrder,
        } as any);


      if (error) throw error;

      toast({
        title: '✓ ثبت شد',
        description: 'درخواست همکاری ثبت شد و در انتظار تایید مدیر است. پس از تایید مدیر، دعوت به همکار ارسال می‌شود.',
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

  const updatePermission = async (
    collaboratorId: string,
    patch: { can_view_financials?: boolean; can_manage_order?: boolean }
  ) => {
    setUpdatingPermId(collaboratorId);
    try {
      const { error } = await supabase
        .from('order_collaborators')
        .update(patch as any)
        .eq('id', collaboratorId);

      if (error) throw error;

      setCollaborators(prev => prev.map(c => (c.id === collaboratorId ? { ...c, ...patch } : c)));
      toast({ title: '✓ ذخیره شد', description: 'سطح دسترسی همکار به‌روزرسانی شد.' });
      onCollaboratorAdded?.();
    } catch (error: any) {
      console.error('Error updating collaborator permission:', error);
      toast({ title: 'خطا', description: 'خطا در ذخیره سطح دسترسی', variant: 'destructive' });
    } finally {
      setUpdatingPermId(null);
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

        {/* Order Owner Section */}
        {(ownerName || ownerPhone) && (
          <div className="bg-primary/5 rounded-lg p-3 border border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-primary">مالک سفارش (ثبت‌کننده)</span>
            </div>
            <div className="flex items-center gap-3 p-2 bg-background rounded-md">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-medium text-primary">
                  {(ownerName || 'م')[0]}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{ownerName || 'نامشخص'}</p>
                {ownerPhone && (
                  <p className="text-xs text-muted-foreground" dir="ltr">{ownerPhone}</p>
                )}
              </div>
              <Badge variant="outline" className="text-xs flex-shrink-0">ثبت‌کننده</Badge>
            </div>
          </div>
        )}

        {/* Existing Collaborators - Always show this section */}
        <div className="bg-muted/30 rounded-lg p-3 border border-border/50">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">همکاران این سفارش</span>
          </div>
          
          {loadingCollaborators ? (
            <div className="flex justify-center py-3">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : collaborators.length > 0 ? (
            <div className="space-y-2">
              {collaborators.map((collab) => {
                const isInviter = collab.inviter_user_id === user?.id;
                const isActive = !INACTIVE_STATUSES.includes(collab.status);
                return (
                <div
                  key={collab.id}
                  className="p-2 bg-background rounded-md border border-border/30 space-y-2"
                >
                  <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-medium text-primary">
                        {(collab.invitee_profile?.full_name || 'ب')[0]}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {collab.invitee_profile?.full_name || 'بدون نام'}
                      </p>
                      <p className="text-xs text-muted-foreground" dir="ltr">
                        {collab.invitee_phone_number}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge 
                      variant={statusLabels[collab.status]?.variant || 'outline'}
                      className="text-xs"
                    >
                      {(collab.status === 'pending' || collab.status === 'pending_manager' || collab.status === 'manager_approved' || collab.status === 'pending_registration') && <Clock className="h-3 w-3 mr-1" />}
                      {collab.status === 'accepted' && <CheckCircle className="h-3 w-3 mr-1" />}
                      {statusLabels[collab.status]?.label || collab.status}
                    </Badge>
                    {isInviter && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => deleteCollaborator(collab.id)}
                        disabled={deletingId === collab.id}
                        title="حذف دسترسی همکار"
                      >
                        {deletingId === collab.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    )}
                  </div>
                  </div>

                  {isInviter && isActive && (
                    <div className="space-y-2 rounded-md bg-muted/40 p-2 border border-border/30">
                      <p className="text-xs font-medium text-muted-foreground">سطح دسترسی همکار</p>
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <Checkbox
                          checked={collab.can_view_financials !== false}
                          disabled={updatingPermId === collab.id}
                          onCheckedChange={(v) => updatePermission(collab.id, { can_view_financials: v === true })}
                        />
                        <span>دسترسی به مبالغ و پرداخت‌ها</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <Checkbox
                          checked={collab.can_manage_order === true}
                          disabled={updatingPermId === collab.id}
                          onCheckedChange={(v) => updatePermission(collab.id, { can_manage_order: v === true })}
                        />
                        <span>امکان انتقال سفارش و افزودن همکار جدید</span>
                      </label>
                      {collab.can_view_financials !== false && collab.can_manage_order === true && (
                        <p className="text-xs text-green-600">دسترسی کامل به همه بخش‌های سفارش</p>
                      )}
                    </div>
                  )}
                </div>
                );
              })}

            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-2">
              هنوز همکاری به این سفارش اضافه نشده است
            </p>
          )}
        </div>

        <Separator />

        {/* Add New Collaborator Form */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="collab-phone">شماره تماس همکار جدید</Label>
            <div className="flex gap-2">
              <Input
                id="collab-phone"
                placeholder="09100000000"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="flex-1"
                dir="ltr"
              />
              <ContactPickerButton
                onContactSelected={(phone) => setPhoneNumber(phone)}
                disabled={searching}
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
              <p className="text-xs text-muted-foreground">شماره باید ۱۱ رقم باشد (مثال: 09100000000)</p>
            )}
          </div>

          {userNotFound && (
            <div className="flex items-center gap-2 p-3 bg-muted text-muted-foreground rounded-lg text-sm">
              <Clock className="h-4 w-4 flex-shrink-0" />
              <span>این شماره هنوز ثبت‌نام نکرده است؛ دعوت با همین شماره ذخیره می‌شود و بعد از ثبت‌نام همکار قابل پذیرش است.</span>
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

          {!canAddMoreCollaborators && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3 text-center">
              شما به حداکثر تعداد همکاران ({MAX_COLLABORATORS} نفر) رسیده‌اید.
            </div>
          )}

          <Button
            onClick={addCollaborator}
            disabled={formatPhoneNumber(phoneNumber).length !== 11 || !formatPhoneNumber(phoneNumber).startsWith('09') || submitting || !canAddMoreCollaborators}
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
