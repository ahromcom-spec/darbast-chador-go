import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Users, 
  Loader2, 
  CheckCircle, 
  User,
  Briefcase,
  Search,
  UserPlus,
  Trash2,
  Clock
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';

interface ManagerAddStaffCollaboratorProps {
  orderId: string;
  orderCode: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCollaboratorAdded?: () => void;
}

interface StaffMember {
  user_id: string;
  full_name: string;
  phone_number: string;
  role: string;
}

interface StaffCollaborator {
  id: string;
  invitee_user_id: string;
  status: string;
  invited_at: string;
  full_name?: string;
  phone_number?: string;
  role?: string;
}

const roleLabels: Record<string, string> = {
  admin: 'مدیر سیستم',
  ceo: 'مدیرعامل',
  general_manager: 'مدیر کل',
  sales_manager: 'مدیر فروش',
  finance_manager: 'مدیر مالی',
  scaffold_executive_manager: 'مدیر اجرایی داربست',
  executive_manager_scaffold_execution_with_materials: 'مدیر اجرایی داربست با اجناس',
};

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'در انتظار تایید', variant: 'secondary' },
  accepted: { label: 'تایید شده', variant: 'default' },
  rejected: { label: 'رد شده', variant: 'destructive' },
};

export function ManagerAddStaffCollaborator({ 
  orderId, 
  orderCode, 
  open, 
  onOpenChange, 
  onCollaboratorAdded 
}: ManagerAddStaffCollaboratorProps) {
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [filteredStaff, setFilteredStaff] = useState<StaffMember[]>([]);
  const [existingCollaborators, setExistingCollaborators] = useState<StaffCollaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (open) {
      fetchData();
      setSelectedStaff(null);
      setSearchTerm('');
    }
  }, [open, orderId]);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredStaff(staffMembers);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = staffMembers.filter(staff => 
        staff.full_name?.toLowerCase().includes(term) ||
        staff.phone_number?.includes(term) ||
        roleLabels[staff.role]?.toLowerCase().includes(term)
      );
      setFilteredStaff(filtered);
    }
  }, [searchTerm, staffMembers]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch existing collaborators for this order
      const { data: collabData, error: collabError } = await supabase
        .from('order_collaborators')
        .select('id, invitee_user_id, status, invited_at, invitee_phone_number')
        .eq('order_id', orderId);

      if (collabError) throw collabError;

      // Get all users with manager/staff roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', [
          'admin',
          'ceo',
          'general_manager',
          'sales_manager',
          'finance_manager',
          'scaffold_executive_manager',
          'executive_manager_scaffold_execution_with_materials'
        ]);

      if (rolesError) throw rolesError;

      if (rolesData && rolesData.length > 0) {
        const userIds = [...new Set(rolesData.map(r => r.user_id))];
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, full_name, phone_number')
          .in('user_id', userIds);

        if (profilesError) throw profilesError;

        // Build staff list excluding current user and already added collaborators
        const existingCollabUserIds = new Set(
          collabData?.filter(c => c.status !== 'rejected').map(c => c.invitee_user_id) || []
        );

        const staffList: StaffMember[] = rolesData
          .filter(r => r.user_id !== user?.id && !existingCollabUserIds.has(r.user_id))
          .map(role => {
            const profile = profilesData?.find(p => p.user_id === role.user_id);
            return {
              user_id: role.user_id,
              full_name: profile?.full_name || 'نامشخص',
              phone_number: profile?.phone_number || '',
              role: role.role,
            };
          });

        // Remove duplicates
        const uniqueStaff = staffList.reduce((acc: StaffMember[], current) => {
          const exists = acc.find(item => item.user_id === current.user_id);
          if (!exists) {
            acc.push(current);
          }
          return acc;
        }, []);

        setStaffMembers(uniqueStaff);
        setFilteredStaff(uniqueStaff);

        // Enrich existing collaborators with profile and role info
        const enrichedCollabs: StaffCollaborator[] = await Promise.all(
          (collabData || []).map(async (collab) => {
            const profile = profilesData?.find(p => p.user_id === collab.invitee_user_id);
            const roleInfo = rolesData.find(r => r.user_id === collab.invitee_user_id);
            return {
              ...collab,
              full_name: profile?.full_name || 'نامشخص',
              phone_number: profile?.phone_number || collab.invitee_phone_number,
              role: roleInfo?.role,
            };
          })
        );
        setExistingCollaborators(enrichedCollabs.filter(c => c.status !== 'rejected'));
      } else {
        setStaffMembers([]);
        setFilteredStaff([]);
        setExistingCollaborators([]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'دریافت اطلاعات با خطا مواجه شد',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddCollaborator = async () => {
    if (!selectedStaff || !user) return;

    setAdding(true);
    try {
      const { error } = await supabase
        .from('order_collaborators')
        .insert({
          order_id: orderId,
          inviter_user_id: user.id,
          invitee_user_id: selectedStaff.user_id,
          invitee_phone_number: selectedStaff.phone_number,
          status: 'accepted', // Auto-accept for staff members
        });

      if (error) throw error;

      // Send notification
      await supabase
        .from('notifications')
        .insert({
          user_id: selectedStaff.user_id,
          title: 'افزوده شدن به سفارش',
          body: `شما به عنوان همکار به سفارش ${orderCode} اضافه شدید.`,
          link: `/executive/orders?orderId=${orderId}`,
          type: 'info',
        });

      // Send push notification
      try {
        await supabase.functions.invoke('send-push-notification', {
          body: {
            user_id: selectedStaff.user_id,
            title: '👥 همکاری در سفارش',
            body: `شما به سفارش ${orderCode} اضافه شدید.`,
            link: `/executive/orders?orderId=${orderId}`,
            type: 'info'
          }
        });
      } catch (e) {
        console.log('Push notification skipped');
      }

      toast({
        title: '✓ افزوده شد',
        description: `${selectedStaff.full_name} به سفارش اضافه شد.`,
      });

      setSelectedStaff(null);
      fetchData();
      onCollaboratorAdded?.();
    } catch (error: any) {
      console.error('Error adding collaborator:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'افزودن همکار با خطا مواجه شد',
      });
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveCollaborator = async (collabId: string) => {
    setDeletingId(collabId);
    try {
      const { error } = await supabase
        .from('order_collaborators')
        .delete()
        .eq('id', collabId);

      if (error) throw error;

      toast({
        title: '✓ حذف شد',
        description: 'همکار از سفارش حذف شد.',
      });

      fetchData();
      onCollaboratorAdded?.();
    } catch (error: any) {
      console.error('Error removing collaborator:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'حذف همکار با خطا مواجه شد',
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            افزودن همکار پرسنل
          </DialogTitle>
          <DialogDescription>
            پرسنل اهرم را برای همکاری در سفارش {orderCode} اضافه کنید
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Existing Collaborators */}
            {existingCollaborators.length > 0 && (
              <div className="bg-muted/30 rounded-lg p-3 border border-border/50">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">همکاران فعلی ({existingCollaborators.length})</span>
                </div>
                <div className="space-y-2">
                  {existingCollaborators.map((collab) => (
                    <div
                      key={collab.id}
                      className="flex items-center justify-between p-2 bg-background rounded-md border border-border/30"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{collab.full_name}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground" dir="ltr">
                              {collab.phone_number}
                            </span>
                            {collab.role && (
                              <Badge variant="outline" className="text-xs">
                                {roleLabels[collab.role] || collab.role}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge 
                          variant={statusLabels[collab.status]?.variant || 'outline'}
                          className="text-xs"
                        >
                          {collab.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                          {collab.status === 'accepted' && <CheckCircle className="h-3 w-3 mr-1" />}
                          {statusLabels[collab.status]?.label || collab.status}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleRemoveCollaborator(collab.id)}
                          disabled={deletingId === collab.id}
                        >
                          {deletingId === collab.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Add New Collaborator */}
            <div className="space-y-2">
              <Label>جستجو در پرسنل</Label>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="نام، شماره تلفن یا سمت..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
            </div>

            <ScrollArea className="h-[200px] rounded-md border p-2">
              {filteredStaff.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <User className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">پرسنلی برای افزودن یافت نشد</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredStaff.map((staff) => (
                    <Card 
                      key={staff.user_id}
                      className={`cursor-pointer transition-all hover:border-primary/50 ${
                        selectedStaff?.user_id === staff.user_id 
                          ? 'border-primary bg-primary/5' 
                          : ''
                      }`}
                      onClick={() => setSelectedStaff(staff)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">{staff.full_name}</p>
                              <p className="text-xs text-muted-foreground" dir="ltr">
                                {staff.phone_number}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              <Briefcase className="h-3 w-3 ml-1" />
                              {roleLabels[staff.role] || staff.role}
                            </Badge>
                            {selectedStaff?.user_id === staff.user_id && (
                              <CheckCircle className="h-4 w-4 text-primary" />
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>

            <Separator />

            {selectedStaff && (
              <div className="bg-primary/5 p-3 rounded-lg border border-primary/20">
                <p className="text-sm">
                  <span className="text-muted-foreground">افزودن: </span>
                  <span className="font-medium">{selectedStaff.full_name}</span>
                  <span className="text-muted-foreground"> ({roleLabels[selectedStaff.role]})</span>
                </p>
              </div>
            )}

            <Button
              onClick={handleAddCollaborator}
              disabled={!selectedStaff || adding}
              className="w-full gap-2"
            >
              {adding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              افزودن همکار
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
