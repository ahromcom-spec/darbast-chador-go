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
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useDebounce } from '@/hooks/useDebounce';
import { ContactPickerButton } from '@/components/common/ContactPickerButton';
import { Users, Search, CheckCircle, XCircle, Loader2, UserPlus, LogOut } from 'lucide-react';

interface Props {
  orderId: string;
  orderCode: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCollaboratorAdded?: () => void;
}

interface Collaborator {
  id: string;
  invitee_phone_number: string;
  invitee_user_id: string | null;
  status: string;
  can_view_financials: boolean;
  can_manage_order: boolean;
  full_name?: string | null;
}

const statusLabels: Record<string, string> = {
  pending_manager: 'در انتظار تایید مدیر',
  manager_approved: 'در انتظار تایید همکار',
  pending: 'در انتظار تایید همکار',
  pending_registration: 'در انتظار ثبت‌نام همکار',
  accepted: 'تایید شده',
  approved: 'تایید شده',
  rejected: 'رد شده',
  manager_rejected: 'رد شده توسط مدیر',
  exited: 'خارج شده',
};

const INACTIVE = ['rejected', 'manager_rejected', 'exited', 'cancelled', 'canceled'];

export function ManagerCustomerCollaborator({
  orderId,
  orderCode,
  open,
  onOpenChange,
  onCollaboratorAdded,
}: Props) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [targetUser, setTargetUser] = useState<{ id: string; name: string; phone: string } | null>(null);
  const [userNotFound, setUserNotFound] = useState(false);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [canViewFinancials, setCanViewFinancials] = useState(true);
  const [canManageOrder, setCanManageOrder] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const debouncedPhone = useDebounce(phoneNumber, 500);

  const fetchCollaborators = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('order_collaborators')
        .select('id, invitee_phone_number, invitee_user_id, status, can_view_financials, can_manage_order')
        .eq('order_id', orderId)
        .order('invited_at', { ascending: false });
      if (error) throw error;

      const withNames = await Promise.all(
        (data || []).map(async (c: any) => {
          try {
            const { data: p } = await supabase
              .rpc('lookup_profile_by_phone' as any, { _phone: c.invitee_phone_number })
              .maybeSingle();
            return { ...c, full_name: (p as any)?.full_name ?? null };
          } catch {
            return { ...c, full_name: null };
          }
        }),
      );
      setCollaborators(withNames as Collaborator[]);
    } catch (error) {
      console.error('Error loading collaborators:', error);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (open) {
      setPhoneNumber('');
      setTargetUser(null);
      setUserNotFound(false);
      fetchCollaborators();
    }
  }, [open, fetchCollaborators]);

  const formatPhoneNumber = (phone: string): string => {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('98')) cleaned = '0' + cleaned.slice(2);
    if (!cleaned.startsWith('0') && cleaned.length === 10) cleaned = '0' + cleaned;
    return cleaned;
  };

  const searchUser = useCallback(async (formattedPhone: string) => {
    setSearching(true);
    setTargetUser(null);
    setUserNotFound(false);
    try {
      const { data, error } = await supabase
        .rpc('lookup_profile_by_phone' as any, { _phone: formattedPhone })
        .maybeSingle();
      if (error) throw error;
      const profile = data as { user_id: string; full_name: string | null; phone_number: string | null } | null;
      if (profile) {
        setTargetUser({
          id: profile.user_id,
          name: profile.full_name || 'بدون نام',
          phone: profile.phone_number || formattedPhone,
        });
      } else {
        setUserNotFound(true);
      }
    } catch (error) {
      console.error('Error searching customer:', error);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const formatted = formatPhoneNumber(debouncedPhone);
    if (formatted.length === 11 && formatted.startsWith('09')) {
      searchUser(formatted);
    } else {
      setTargetUser(null);
      setUserNotFound(false);
    }
  }, [debouncedPhone, searchUser]);

  const addCollaborator = async () => {
    if (!user) return;
    const formatted = formatPhoneNumber(phoneNumber);
    if (formatted.length !== 11 || !formatted.startsWith('09')) return;

    if (collaborators.some(c => c.invitee_phone_number === (targetUser?.phone || formatted) && !INACTIVE.includes(c.status))) {
      toast({ title: 'خطا', description: 'این شماره از قبل همکار این سفارش است', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('order_collaborators').insert({
        order_id: orderId,
        inviter_user_id: user.id,
        invitee_user_id: targetUser?.id || null,
        invitee_phone_number: targetUser?.phone || formatted,
        status: targetUser ? 'manager_approved' : 'pending_registration',
        manager_approved_by: user.id,
        manager_approved_at: new Date().toISOString(),
        can_view_financials: canViewFinancials,
        can_manage_order: canManageOrder,
      } as any);
      if (error) throw error;

      toast({
        title: '✓ ثبت شد',
        description: targetUser
          ? `دعوت همکاری برای ${targetUser.name} ارسال شد و در انتظار پذیرش ایشان است.`
          : 'دعوت ثبت شد و تا زمان ثبت‌نام این شماره در انتظار می‌ماند.',
      });
      setPhoneNumber('');
      setTargetUser(null);
      fetchCollaborators();
      onCollaboratorAdded?.();
    } catch (error: any) {
      console.error('Error adding collaborator:', error);
      toast({ title: 'خطا', description: error.message || 'خطا در افزودن همکار', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const removeCollaborator = async (id: string) => {
    setRemovingId(id);
    try {
      const { error } = await supabase
        .from('order_collaborators')
        .update({ status: 'exited' } as any)
        .eq('id', id);
      if (error) throw error;
      toast({ title: '✓ حذف شد', description: 'همکار از سفارش خارج شد.' });
      fetchCollaborators();
      onCollaboratorAdded?.();
    } catch (error: any) {
      console.error('Error removing collaborator:', error);
      toast({ title: 'خطا', description: 'خطا در حذف همکار', variant: 'destructive' });
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            افزودن همکار مشتری به سفارش
          </DialogTitle>
          <DialogDescription>
            برای سفارش {orderCode} می‌توانید در هر مرحله یک مشتری دیگر را به‌عنوان همکار اضافه کنید.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>شماره تلفن همکار</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="09xxxxxxxxx"
                  dir="ltr"
                  className="pr-10 text-left"
                />
              </div>
              <ContactPickerButton onContactSelected={(phone) => setPhoneNumber(phone)} />
            </div>
          </div>

          {searching && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> در حال جستجو...
            </div>
          )}

          {targetUser && (
            <Card className="border-primary/40 bg-primary/5">
              <CardContent className="pt-4 space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  {targetUser.name}
                </div>
                <p className="text-xs text-muted-foreground" dir="ltr">{targetUser.phone}</p>
              </CardContent>
            </Card>
          )}

          {userNotFound && (
            <Card className="border-amber-500/40 bg-amber-500/5">
              <CardContent className="pt-4 flex items-center gap-2 text-xs">
                <XCircle className="h-4 w-4 text-amber-600" />
                این شماره ثبت‌نام نکرده است؛ دعوت تا زمان ثبت‌نام در انتظار می‌ماند.
              </CardContent>
            </Card>
          )}

          <div className="space-y-2 rounded-md border p-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="mgr-collab-fin"
                checked={canViewFinancials}
                onCheckedChange={(v) => setCanViewFinancials(!!v)}
              />
              <Label htmlFor="mgr-collab-fin" className="text-sm font-normal cursor-pointer">
                مشاهده اطلاعات مالی سفارش
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="mgr-collab-manage"
                checked={canManageOrder}
                onCheckedChange={(v) => setCanManageOrder(!!v)}
              />
              <Label htmlFor="mgr-collab-manage" className="text-sm font-normal cursor-pointer">
                مدیریت سفارش (انتقال، افزودن همکار و درخواست‌ها)
              </Label>
            </div>
          </div>

          <Button
            onClick={addCollaborator}
            disabled={submitting || formatPhoneNumber(phoneNumber).length !== 11}
            className="w-full gap-2"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            افزودن همکار
          </Button>

          <Separator />

          <div className="space-y-2">
            <Label className="text-sm">همکاران فعلی</Label>
            {loading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : collaborators.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">همکاری برای این سفارش ثبت نشده است.</p>
            ) : (
              <ScrollArea className="h-[180px] rounded-md border p-2">
                <div className="space-y-2">
                  {collaborators.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{c.full_name || 'بدون نام'}</p>
                        <p className="text-xs text-muted-foreground" dir="ltr">{c.invitee_phone_number}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={INACTIVE.includes(c.status) ? 'outline' : 'secondary'} className="text-xs">
                          {statusLabels[c.status] || c.status}
                        </Badge>
                        {!INACTIVE.includes(c.status) && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removeCollaborator(c.id)}
                            disabled={removingId === c.id}
                          >
                            {removingId === c.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <LogOut className="h-4 w-4 text-destructive" />
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
