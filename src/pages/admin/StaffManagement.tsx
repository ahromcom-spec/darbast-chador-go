import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { RegionSelector } from '@/components/common/RegionSelector';
import { useOrganizationalPositions } from '@/hooks/useOrganizationalPositions';
import { UserPlus, Search } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';

export default function StaffManagement() {
  const { toast } = useToast();
  const { positions, loading: positionsLoading } = useOrganizationalPositions();

  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [position, setPosition] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [staff, setStaff] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    try {
      const { data, error } = await supabase
        .from('staff_profiles')
        .select(`
          *,
          profiles:user_id (
            full_name,
            phone_number
          )
        `)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setStaff(data || []);
    } catch (error) {
      console.error('Error fetching staff:', error);
      toast({
        title: 'خطا',
        description: 'دریافت لیست پرسنل با مشکل مواجه شد',
        variant: 'destructive',
      });
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!phoneNumber.trim() || !selectedRegion || !position) {
      toast({
        title: 'خطا',
        description: 'لطفاً تمام فیلدهای الزامی را پر کنید',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      // پیدا کردن کاربر با شماره تلفن
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('phone_number', phoneNumber)
        .maybeSingle();

      if (profileError || !profileData) {
        toast({
          title: 'خطا',
          description: 'کاربری با این شماره تلفن یافت نشد. ابتدا باید در سیستم ثبت‌نام کند.',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      const userId = profileData.user_id;

      // بررسی تکراری نبودن
      const { data: duplicates } = await supabase
        .from('staff_verification_requests')
        .select('id')
        .eq('user_id', userId)
        .eq('position_id', position);

      if (duplicates && duplicates.length > 0) {
        toast({
          title: 'خطا',
          description: 'این پرسنل با همین نقش و محدوده قبلاً ثبت شده است',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // نقش برای staff_profiles باید از app_role باشد
      // استفاده از operations_manager به عنوان نقش پیش‌فرض
      const defaultRole = 'operations_manager';

      // ایجاد رکورد درخواست تأیید شده پرسنل
      const currentUser = await supabase.auth.getUser();
      const { error: insertError } = await supabase
        .from('staff_verification_requests')
        .insert({
          user_id: userId,
          phone_number: phoneNumber,
          requested_role: defaultRole as any,
          position_id: position,
          region_id: selectedRegion,
          status: 'approved',
          verified_by: currentUser.data.user?.id,
          verified_at: new Date().toISOString(),
        });

      if (insertError) throw insertError;

      // اختصاص نقش سیستمی
      const { error: roleError } = await supabase.rpc('assign_role_to_user', {
        _user_id: userId,
        _role: defaultRole,
      });

      if (roleError) {
        console.error('Error assigning role:', roleError);
      }

      toast({
        title: 'موفق',
        description: 'پرسنل با موفقیت افزوده شد',
      });

      // ریست فرم
      setPhoneNumber('');
      setSelectedRegion('');
      setPosition('');
      setDescription('');
      fetchStaff();
    } catch (error) {
      console.error('Error adding staff:', error);
      toast({
        title: 'خطا',
        description: 'افزودن پرسنل با مشکل مواجه شد',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredStaff = staff.filter((member) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      member.profiles?.full_name?.toLowerCase().includes(searchLower) ||
      member.profiles?.phone_number?.includes(searchLower)
    );
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            افزودن پرسنل جدید
          </CardTitle>
          <CardDescription>
            تأیید شماره تلفن و تعیین محدوده و سمت پرسنل
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddStaff} className="space-y-4">
            <div>
              <Label htmlFor="phone">شماره تلفن *</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="09123456789"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                maxLength={11}
                className="direction-ltr text-right"
              />
            </div>

            <RegionSelector
              value={selectedRegion}
              onChange={setSelectedRegion}
              required
            />

            <div>
              <Label htmlFor="position">نوع سمت *</Label>
              <Select value={position} onValueChange={setPosition} disabled={positionsLoading}>
                <SelectTrigger>
                  <SelectValue placeholder={positionsLoading ? "در حال بارگذاری..." : "سمت را انتخاب کنید..."} />
                </SelectTrigger>
                <SelectContent>
                  {positions.map((pos) => (
                    <SelectItem key={pos.id} value={pos.id}>
                      {pos.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="description">توضیحات (اختیاری)</Label>
              <Textarea
                id="description"
                placeholder="توضیحات تکمیلی..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'در حال افزودن...' : 'افزودن پرسنل'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>لیست پرسنل</CardTitle>
          <div className="flex items-center gap-2 pt-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="جستجو بر اساس نام یا شماره تلفن..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">نام</TableHead>
                  <TableHead className="text-right">شماره تلفن</TableHead>
                  <TableHead className="text-right">محدوده</TableHead>
                  <TableHead className="text-right">سمت</TableHead>
                  <TableHead className="text-right">وضعیت</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStaff.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      پرسنلی یافت نشد
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStaff.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>{member.profiles?.full_name || '-'}</TableCell>
                      <TableCell className="direction-ltr text-right">
                        {member.profiles?.phone_number || '-'}
                      </TableCell>
                      <TableCell>
                        {member.province && `${member.province}${member.staff_category ? ' - ' + member.staff_category : ''}`}
                      </TableCell>
                      <TableCell>{member.staff_position || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="default">
                          تأیید شده
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
