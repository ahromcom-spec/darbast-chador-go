import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, Package, MapPin, ArrowRight, Edit2, Save, X, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface UserOrder {
  id: string;
  created_at: string;
  service_type: string;
  sub_type: string;
  length: number;
  width: number;
  height: number;
  status: string;
  location_address: string | null;
  location_distance: number | null;
}

export default function UserProfile() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<UserOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [fullName, setFullName] = useState('');
  const [originalName, setOriginalName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchUserData();
    fetchOrders();
  }, [user]);

  const fetchUserData = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      const name = data?.full_name || '';
      setFullName(name);
      setOriginalName(name);
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const fetchOrders = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('service_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('خطا در دریافت سفارشات');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('user_id', user.id);

      if (error) throw error;

      setOriginalName(fullName);
      setEditMode(false);
      toast.success('اطلاعات با موفقیت ذخیره شد');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('خطا در ذخیره اطلاعات');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setFullName(originalName);
    setEditMode(false);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('با موفقیت از سامانه خارج شدید');
      navigate('/auth/login');
    } catch (error) {
      toast.error('خطا در خروج از سامانه');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: 'در انتظار', variant: 'default' as const },
      processing: { label: 'در حال انجام', variant: 'secondary' as const },
      completed: { label: 'تکمیل شده', variant: 'outline' as const },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getTypeLabel = (type: string) => {
    return type === 'with-materials' ? 'به همراه اجناس' : 'بدون اجناس';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-background via-secondary/30 to-background min-h-screen">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              onClick={() => navigate('/')}
              className="gap-2"
            >
              <ArrowRight className="h-4 w-4" />
              بازگشت به صفحه اصلی
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="gap-2 md:hidden"
            >
              <LogOut className="h-4 w-4" />
              خروج
            </Button>
          </div>
          <h1 className="text-3xl font-bold">پنل کاربری</h1>
          <p className="text-muted-foreground mt-2">مدیریت اطلاعات و سفارشات خود</p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="profile">اطلاعات حساب</TabsTrigger>
            <TabsTrigger value="orders">سفارشات من</TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card className="shadow-elegant">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  اطلاعات حساب کاربری
                </CardTitle>
                <CardDescription>مشاهده و ویرایش اطلاعات شخصی</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">آدرس ایمیل</Label>
                    <Input
                      id="email"
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">
                      ایمیل قابل تغییر نیست
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fullName">نام و نام خانوادگی</Label>
                    <div className="flex gap-2">
                      <Input
                        id="fullName"
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        disabled={!editMode}
                        className={!editMode ? 'bg-muted' : ''}
                      />
                      {!editMode ? (
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setEditMode(true)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="default"
                            size="icon"
                            onClick={handleSaveProfile}
                            disabled={saving}
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={handleCancelEdit}
                            disabled={saving}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <h3 className="font-medium mb-2">آمار کلی</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-secondary/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">کل سفارشات</p>
                        <p className="text-2xl font-bold">{orders.length}</p>
                      </div>
                      <div className="p-4 bg-secondary/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">در انتظار</p>
                        <p className="text-2xl font-bold">
                          {orders.filter((o) => o.status === 'pending').length}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders">
            <Card className="shadow-elegant">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  سفارشات من
                </CardTitle>
                <CardDescription>لیست سفارشات ثبت شده</CardDescription>
              </CardHeader>
              <CardContent>
                {orders.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">هنوز سفارشی ثبت نکرده‌اید</p>
                    <Button
                      className="mt-4"
                      onClick={() => navigate('/')}
                    >
                      ثبت سفارش جدید
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>شماره</TableHead>
                          <TableHead>نوع</TableHead>
                          <TableHead>ابعاد (م)</TableHead>
                          <TableHead>حجم (م³)</TableHead>
                          <TableHead>آدرس</TableHead>
                          <TableHead>فاصله</TableHead>
                          <TableHead>وضعیت</TableHead>
                          <TableHead>تاریخ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.map((order, index) => (
                          <TableRow key={order.id}>
                            <TableCell className="font-medium">
                              {orders.length - index}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{getTypeLabel(order.sub_type)}</Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {order.length} × {order.width} × {order.height}
                            </TableCell>
                            <TableCell className="font-medium">
                              {(order.length * order.width * order.height).toFixed(2)}
                            </TableCell>
                            <TableCell className="max-w-xs truncate">
                              {order.location_address ? (
                                <div className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-xs">{order.location_address}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-xs">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {order.location_distance ? (
                                <span className="text-sm">{order.location_distance} کم</span>
                              ) : (
                                <span className="text-muted-foreground text-xs">-</span>
                              )}
                            </TableCell>
                            <TableCell>{getStatusBadge(order.status)}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(order.created_at).toLocaleDateString('fa-IR')}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
