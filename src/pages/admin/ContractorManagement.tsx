import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { RegionSelector } from '@/components/ceo/RegionSelector';
import { useServiceCategories } from '@/hooks/useServiceCategories';
import { useActivityTypes } from '@/hooks/useActivityTypes';
import { UserPlus, Search } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export default function ContractorManagement() {
  const { toast } = useToast();
  const { categories, loading: categoriesLoading } = useServiceCategories();
  const { activityTypes, loading: activityTypesLoading } = useActivityTypes();

  const [phoneNumber, setPhoneNumber] = useState('');
  const [regionId, setRegionId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [activityTypeId, setActivityTypeId] = useState('');
  const [loading, setLoading] = useState(false);
  const [contractors, setContractors] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchContractors();
  }, []);

  const fetchContractors = async () => {
    try {
      const { data, error } = await supabase
        .from('contractor_profiles')
        .select(`
          *,
          profiles:user_id (
            full_name,
            phone_number
          ),
          regions:region_id (
            name
          ),
          service_categories:service_category_id (
            name
          ),
          service_activity_types:activity_type_id (
            name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setContractors(data || []);
    } catch (error) {
      console.error('Error fetching contractors:', error);
      toast({
        title: 'خطا',
        description: 'دریافت لیست پیمانکاران با مشکل مواجه شد',
        variant: 'destructive',
      });
    }
  };

  const handleAddContractor = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!phoneNumber.trim() || !regionId || !categoryId || !activityTypeId) {
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

      // بررسی وجود پروفایل پیمانکار
      const { data: existingContractor } = await supabase
        .from('contractor_profiles')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (existingContractor) {
        toast({
          title: 'خطا',
          description: 'این کاربر قبلاً به عنوان پیمانکار ثبت شده است',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // ایجاد پروفایل پیمانکار
      const { error: insertError } = await supabase
        .from('contractor_profiles')
        .insert({
          user_id: userId,
          phone_verified: true,
          verified_by: (await supabase.auth.getUser()).data.user?.id,
          verified_at: new Date().toISOString(),
          region_id: regionId,
          service_category_id: categoryId,
          activity_type_id: activityTypeId,
          status: 'approved',
        });

      if (insertError) throw insertError;

      // افزودن نقش contractor
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role: 'contractor',
        });

      if (roleError && roleError.code !== '23505') throw roleError;

      toast({
        title: 'موفق',
        description: 'پیمانکار با موفقیت افزوده شد',
      });

      // ریست فرم
      setPhoneNumber('');
      setRegionId('');
      setCategoryId('');
      setActivityTypeId('');
      fetchContractors();
    } catch (error) {
      console.error('Error adding contractor:', error);
      toast({
        title: 'خطا',
        description: 'افزودن پیمانکار با مشکل مواجه شد',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredContractors = contractors.filter((contractor) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      contractor.profiles?.full_name?.toLowerCase().includes(searchLower) ||
      contractor.profiles?.phone_number?.includes(searchLower)
    );
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            افزودن پیمانکار جدید
          </CardTitle>
          <CardDescription>
            تأیید شماره تلفن و تعیین اطلاعات پیمانکار
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddContractor} className="space-y-4">
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
              <Label htmlFor="category">نوع صنف خدمات *</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="صنف را انتخاب کنید..." />
                </SelectTrigger>
                <SelectContent>
                  {categoriesLoading ? (
                    <SelectItem value="loading" disabled>در حال بارگذاری...</SelectItem>
                  ) : (
                    categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="activity">نوع فعالیت خدمات *</Label>
              <Select value={activityTypeId} onValueChange={setActivityTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="نوع فعالیت را انتخاب کنید..." />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {activityTypesLoading ? (
                    <SelectItem value="loading" disabled>در حال بارگذاری...</SelectItem>
                  ) : (
                    activityTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'در حال افزودن...' : 'افزودن پیمانکار'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>لیست پیمانکاران</CardTitle>
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
                <TableHead className="text-right">صنف</TableHead>
                <TableHead className="text-right">وضعیت</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContractors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    پیمانکاری یافت نشد
                  </TableCell>
                </TableRow>
              ) : (
                filteredContractors.map((contractor) => (
                  <TableRow key={contractor.id}>
                    <TableCell>{contractor.profiles?.full_name || '-'}</TableCell>
                    <TableCell>{contractor.profiles?.phone_number || '-'}</TableCell>
                    <TableCell>{contractor.regions?.name || '-'}</TableCell>
                    <TableCell>{contractor.service_categories?.name || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={contractor.status === 'approved' ? 'default' : 'secondary'}>
                        {contractor.status === 'approved' ? 'تأیید شده' : 'در انتظار'}
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
