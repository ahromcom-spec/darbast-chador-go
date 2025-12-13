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
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ArrowLeftRight, 
  Loader2, 
  CheckCircle, 
  User,
  Briefcase,
  Search
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';

interface ManagerOrderTransferProps {
  orderId: string;
  orderCode: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTransferComplete?: () => void;
}

interface StaffMember {
  user_id: string | null;
  full_name: string;
  phone_number: string;
  role: string;
  is_registered: boolean;
}

const roleLabels: Record<string, string> = {
  admin: 'مدیر سیستم',
  ceo: 'مدیرعامل',
  general_manager: 'مدیر کل',
  sales_manager: 'مدیر فروش',
  finance_manager: 'مدیر مالی',
  scaffold_executive_manager: 'مدیر اجرایی داربست',
  executive_manager_scaffold_execution_with_materials: 'مدیر اجرایی داربست با اجناس',
  warehouse_manager: 'مدیر انبارداری',
  operations_manager: 'مدیر عملیات',
};

export function ManagerOrderTransfer({ 
  orderId, 
  orderCode, 
  open, 
  onOpenChange, 
  onTransferComplete 
}: ManagerOrderTransferProps) {
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [filteredStaff, setFilteredStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [transferring, setTransferring] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (open) {
      fetchStaffMembers();
      setSelectedStaff(null);
      setSearchTerm('');
    }
  }, [open]);

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

  const fetchStaffMembers = async () => {
    setLoading(true);
    try {
      // 1. Get whitelisted staff from phone_whitelist
      const { data: whitelistData, error: whitelistError } = await supabase
        .from('phone_whitelist')
        .select('phone_number, allowed_roles, notes')
        .not('allowed_roles', 'cs', '{"customer"}');

      if (whitelistError) throw whitelistError;

      // 2. Get all registered users with manager/staff roles
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
          'executive_manager_scaffold_execution_with_materials',
          'warehouse_manager',
          'operations_manager'
        ]);

      if (rolesError) throw rolesError;

      // 3. Fetch profiles for registered users
      let profilesData: any[] = [];
      if (rolesData && rolesData.length > 0) {
        const userIds = [...new Set(rolesData.map(r => r.user_id))];
        const { data, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, full_name, phone_number')
          .in('user_id', userIds);

        if (profilesError) throw profilesError;
        profilesData = data || [];
      }

      // Build staff list from whitelist
      const staffList: StaffMember[] = [];
      const processedPhones = new Set<string>();

      // First add registered users
      if (rolesData) {
        for (const role of rolesData) {
          if (role.user_id === user?.id) continue;
          
          const profile = profilesData.find(p => p.user_id === role.user_id);
          if (profile?.phone_number) {
            processedPhones.add(profile.phone_number);
          }
          
          staffList.push({
            user_id: role.user_id,
            full_name: profile?.full_name || 'نامشخص',
            phone_number: profile?.phone_number || '',
            role: role.role,
            is_registered: true,
          });
        }
      }

      // Then add whitelisted staff who haven't registered yet
      if (whitelistData) {
        for (const entry of whitelistData) {
          if (processedPhones.has(entry.phone_number)) continue;
          
          const roles = entry.allowed_roles as string[];
          const primaryRole = roles[0] || 'staff';
          
          staffList.push({
            user_id: null,
            full_name: entry.notes || 'پرسنل اهرم',
            phone_number: entry.phone_number,
            role: primaryRole,
            is_registered: false,
          });
        }
      }

      // Remove duplicates by phone number
      const uniqueStaff = staffList.reduce((acc: StaffMember[], current) => {
        const exists = acc.find(item => item.phone_number === current.phone_number);
        if (!exists) {
          acc.push(current);
        }
        return acc;
      }, []);

      setStaffMembers(uniqueStaff);
      setFilteredStaff(uniqueStaff);
    } catch (error) {
      console.error('Error fetching staff members:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'دریافت لیست پرسنل با خطا مواجه شد',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async () => {
    if (!selectedStaff || !user) return;

    // Check if staff is registered
    if (!selectedStaff.is_registered || !selectedStaff.user_id) {
      toast({
        variant: 'destructive',
        title: 'پرسنل ثبت‌نام نکرده',
        description: `${selectedStaff.full_name} هنوز در سیستم ثبت‌نام نکرده است. لطفاً ابتدا از وی بخواهید ثبت‌نام کند.`,
      });
      return;
    }

    setTransferring(true);
    try {
      // Update the order's executed_by field to transfer responsibility
      const { error } = await supabase
        .from('projects_v3')
        .update({
          executed_by: selectedStaff.user_id,
        })
        .eq('id', orderId);

      if (error) throw error;

      // Send notification to the new assignee
      await supabase
        .from('notifications')
        .insert({
          user_id: selectedStaff.user_id,
          title: 'انتقال سفارش به شما',
          body: `سفارش ${orderCode} به شما منتقل شد. لطفاً پیگیری فرمایید.`,
          link: `/executive/orders?orderId=${orderId}`,
          type: 'info',
        });

      // Send push notification
      try {
        await supabase.functions.invoke('send-push-notification', {
          body: {
            user_id: selectedStaff.user_id,
            title: '📋 انتقال سفارش',
            body: `سفارش ${orderCode} به شما منتقل شد.`,
            link: `/executive/orders?orderId=${orderId}`,
            type: 'info'
          }
        });
      } catch (e) {
        console.log('Push notification skipped');
      }

      toast({
        title: '✓ انتقال موفق',
        description: `سفارش ${orderCode} به ${selectedStaff.full_name} منتقل شد.`,
      });

      onOpenChange(false);
      onTransferComplete?.();
    } catch (error: any) {
      console.error('Error transferring order:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'انتقال سفارش با خطا مواجه شد',
      });
    } finally {
      setTransferring(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            انتقال سفارش به پرسنل
          </DialogTitle>
          <DialogDescription>
            سفارش {orderCode} را به یکی از مدیران یا پرسنل منتقل کنید
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
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

            <ScrollArea className="h-[250px] rounded-md border p-2">
              {filteredStaff.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <User className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">پرسنلی یافت نشد</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredStaff.map((staff) => (
                    <Card 
                      key={staff.user_id || staff.phone_number}
                      className={`cursor-pointer transition-all hover:border-primary/50 ${
                        selectedStaff?.phone_number === staff.phone_number 
                          ? 'border-primary bg-primary/5' 
                          : ''
                      } ${!staff.is_registered ? 'opacity-70' : ''}`}
                      onClick={() => setSelectedStaff(staff)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                              staff.is_registered ? 'bg-primary/10' : 'bg-muted'
                            }`}>
                              <User className={`h-4 w-4 ${staff.is_registered ? 'text-primary' : 'text-muted-foreground'}`} />
                            </div>
                            <div>
                              <p className="text-sm font-medium">{staff.full_name}</p>
                              <p className="text-xs text-muted-foreground" dir="ltr">
                                {staff.phone_number}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap justify-end">
                            <Badge variant="outline" className="text-xs">
                              <Briefcase className="h-3 w-3 ml-1" />
                              {roleLabels[staff.role] || staff.role}
                            </Badge>
                            {!staff.is_registered && (
                              <Badge variant="secondary" className="text-xs text-amber-600">
                                ثبت‌نام نشده
                              </Badge>
                            )}
                            {selectedStaff?.phone_number === staff.phone_number && (
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
                  <span className="text-muted-foreground">انتقال به: </span>
                  <span className="font-medium">{selectedStaff.full_name}</span>
                  <span className="text-muted-foreground"> ({roleLabels[selectedStaff.role]})</span>
                </p>
              </div>
            )}

            <Button
              onClick={handleTransfer}
              disabled={!selectedStaff || transferring}
              className="w-full gap-2"
            >
              {transferring ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowLeftRight className="h-4 w-4" />
              )}
              تایید انتقال
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
