import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { RegionSelector } from '@/components/common/RegionSelector';
import { useServiceCategories } from '@/hooks/useServiceCategories';
import { useActivityTypes } from '@/hooks/useActivityTypes';
import { Building2, Search } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { assignRoleSchema } from '@/lib/rpcValidation';

export default function ContractorManagement() {
  const { toast } = useToast();
  const { categories, loading: categoriesLoading } = useServiceCategories();
  const { activityTypes, loading: activityTypesLoading } = useActivityTypes();

  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [category, setCategory] = useState('');
  const [activity, setActivity] = useState('');
  const [description, setDescription] = useState('');
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
          )
        `)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(100);

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

    if (!phoneNumber.trim() || !selectedRegion || !category || !activity) {
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
      const { data: duplicates, error: duplicateError } = await supabase
        .from('contractor_profiles')
        .select('id')
        .eq('user_id', userId)
        .eq('service_category_id', category);

      if (!duplicateError && duplicates && duplicates.length > 0) {
        toast({
          title: 'خطا',
          description: 'این پیمانکار با همین صنف و نوع فعالیت در این محدوده قبلاً ثبت شده است',
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
          region_id: selectedRegion,
          service_category_id: category,
          activity_type_id: activity,
          status: 'approved',
        });

      if (insertError) throw insertError;

      // افزودن نقش contractor
      const validated = assignRoleSchema.parse({
        _user_id: userId,
        _role: 'contractor',
      });
      const { error: roleError } = await supabase.rpc('assign_role_to_user', validated as { _user_id: string; _role: string });

      if (roleError) {
        console.error('Role assignment error:', roleError);
      }

      toast({
        title: 'موفق',
        description: 'پیمانکار با موفقیت افزوده شد',
      });

      // ریست فرم
      setPhoneNumber('');
      setSelectedRegion('');
      setCategory('');
      setActivity('');
      setDescription('');
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
            <Building2 className="h-5 w-5" />
            افزودن پیمانکار جدید
          </CardTitle>
          <CardDescription>
            تأیید شماره تلفن و تعیین محدوده، صنف و نوع فعالیت
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
                className="direction-ltr text-right"
              />
            </div>

            <RegionSelector
              value={selectedRegion}
              onChange={setSelectedRegion}
              required
            />

            <div>
              <Label htmlFor="category">نوع صنف خدمات *</Label>
              <Select value={category} onValueChange={setCategory} disabled={categoriesLoading}>
                <SelectTrigger>
                  <SelectValue placeholder={categoriesLoading ? "در حال بارگذاری..." : "صنف را انتخاب کنید..."} />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="activity">نوع فعالیت خدمات *</Label>
              <Select value={activity} onValueChange={setActivity} disabled={activityTypesLoading}>
                <SelectTrigger>
                  <SelectValue placeholder={activityTypesLoading ? "در حال بارگذاری..." : "نوع فعالیت را انتخاب کنید..."} />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {activityTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id} className="text-sm">
                      {type.name}
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
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">نام</TableHead>
                  <TableHead className="text-right">شماره تلفن</TableHead>
                  <TableHead className="text-right">محدوده</TableHead>
                  <TableHead className="text-right">صنف</TableHead>
                  <TableHead className="text-right">نوع فعالیت</TableHead>
                  <TableHead className="text-right">وضعیت</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContractors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      پیمانکاری یافت نشد
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredContractors.map((contractor) => (
                    <TableRow key={contractor.id}>
                      <TableCell>{contractor.profiles?.full_name || '-'}</TableCell>
                      <TableCell className="direction-ltr text-right">
                        {contractor.profiles?.phone_number || '-'}
                      </TableCell>
                      <TableCell>
                        {contractor.province && `${contractor.province}${contractor.district ? ' - ' + contractor.district : ''}`}
                      </TableCell>
                      <TableCell className="text-sm">{contractor.service_category || '-'}</TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate" title={contractor.activity_type}>
                        {contractor.activity_type || '-'}
                      </TableCell>
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
