import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { RegionSelector } from '@/components/ceo/RegionSelector';
import { useOrganizationalPositions } from '@/hooks/useOrganizationalPositions';
import { UserPlus, Search } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export default function StaffManagement() {
  const { toast } = useToast();
  const { positions, loading: positionsLoading } = useOrganizationalPositions();

  const [phoneNumber, setPhoneNumber] = useState('');
  const [regionId, setRegionId] = useState('');
  const [positionId, setPositionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [staff, setStaff] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    try {
      const { data, error } = await supabase
        .from('internal_staff_profiles')
        .select(`
          *,
          profiles:user_id (
            full_name,
            phone_number
          ),
          regions:region_id (
            name
          ),
          organizational_positions:position_id (
            name
          )
        `)
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

    if (!phoneNumber.trim() || !regionId || !positionId) {
      toast({
        title: 'خطا',
        description: 'لطفاً تمام فیلدها را پر کنید',
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
        .single();

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

      // بررسی وجود پروفایل پرسنل
      const { data: existingStaff } = await supabase
        .from('internal_staff_profiles')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (existingStaff) {
        toast({
          title: 'خطا',
          description: 'این کاربر قبلاً به عنوان پرسنل ثبت شده است',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // ایجاد پروفایل پرسنل
      const { error: insertError } = await supabase
        .from('internal_staff_profiles')
        .insert({
          user_id: userId,
          phone_verified: true,
          verified_by: (await supabase.auth.getUser()).data.user?.id,
          verified_at: new Date().toISOString(),
          region_id: regionId,
          position_id: positionId,
          status: 'approved',
        });

      if (insertError) throw insertError;

      toast({
        title: 'موفق',
        description: 'پرسنل با موفقیت افزوده شد',
      });

      // ریست فرم
      setPhoneNumber('');
      setRegionId('');
      setPositionId('');
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
            تأیید شماره تلفن و تعیین پست سازمانی
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
              />
            </div>

            <RegionSelector
              value={regionId}
              onChange={setRegionId}
              error={!regionId ? 'محدوده را انتخاب کنید' : ''}
            />

            <div>
              <Label htmlFor="position">پست سازمانی *</Label>
              <Select value={positionId} onValueChange={setPositionId}>
                <SelectTrigger>
                  <SelectValue placeholder="پست سازمانی را انتخاب کنید..." />
                </SelectTrigger>
                <SelectContent>
                  {positionsLoading ? (
                    <SelectItem value="loading" disabled>در حال بارگذاری...</SelectItem>
                  ) : (
                    positions.map((position) => (
                      <SelectItem key={position.id} value={position.id}>
                        {position.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">نام</TableHead>
                <TableHead className="text-right">شماره تلفن</TableHead>
                <TableHead className="text-right">محدوده</TableHead>
                <TableHead className="text-right">پست سازمانی</TableHead>
                <TableHead className="text-right">وضعیت</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStaff.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    پرسنلی یافت نشد
                  </TableCell>
                </TableRow>
              ) : (
                filteredStaff.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>{member.profiles?.full_name || '-'}</TableCell>
                    <TableCell>{member.profiles?.phone_number || '-'}</TableCell>
                    <TableCell>{member.regions?.name || '-'}</TableCell>
                    <TableCell>{member.organizational_positions?.name || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={member.status === 'approved' ? 'default' : 'secondary'}>
                        {member.status === 'approved' ? 'تأیید شده' : 'در انتظار'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
