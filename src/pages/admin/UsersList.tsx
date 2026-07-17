import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Eye, Search, LogIn, MessageSquare, MessageSquareOff, MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useAdminLoginAsUser } from '@/hooks/useAdminLoginAsUser';
import { toast } from 'sonner';

interface OrderAddr {
  id: string;
  code: string | null;
  address: string | null;
  detailed_address: string | null;
  created_at: string;
}

export default function UsersList() {
  usePageTitle('مدیریت کاربران');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedAddresses, setExpandedAddresses] = useState<Set<string>>(new Set());
  const { loginAsUser, isLoading: isLoginAsUserLoading } = useAdminLoginAsUser();

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users-list-with-addresses'],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select(`
          user_id,
          full_name,
          phone_number,
          created_at,
          sms_notifications_enabled
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const userIds = (profiles || []).map(p => p.user_id);

      // Fetch customers & roles & orders in bulk
      const [{ data: customers }, { data: allRoles }] = await Promise.all([
        supabase.from('customers').select('id, user_id').in('user_id', userIds),
        supabase.from('user_roles').select('user_id, role').in('user_id', userIds),
      ]);

      const customerIds = (customers || []).map(c => c.id);
      const { data: orders } = customerIds.length
        ? await supabase
            .from('projects_v3')
            .select('id, code, address, detailed_address, created_at, customer_id')
            .in('customer_id', customerIds)
            .order('created_at', { ascending: false })
        : { data: [] as any[] };

      const customerByUser = new Map<string, string>();
      (customers || []).forEach(c => customerByUser.set(c.user_id, c.id));

      const ordersByCustomer = new Map<string, OrderAddr[]>();
      (orders || []).forEach((o: any) => {
        const arr = ordersByCustomer.get(o.customer_id) || [];
        arr.push(o);
        ordersByCustomer.set(o.customer_id, arr);
      });

      const rolesByUser = new Map<string, string[]>();
      (allRoles || []).forEach((r: any) => {
        const arr = rolesByUser.get(r.user_id) || [];
        arr.push(r.role);
        rolesByUser.set(r.user_id, arr);
      });

      return (profiles || []).map(p => {
        const cid = customerByUser.get(p.user_id);
        const userOrders = cid ? (ordersByCustomer.get(cid) || []) : [];
        return {
          ...p,
          roles: rolesByUser.get(p.user_id) || [],
          orders: userOrders,
        };
      });
    }
  });

  const toggleSmsMutation = useMutation({
    mutationFn: async ({ userId, enabled }: { userId: string; enabled: boolean }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ sms_notifications_enabled: enabled })
        .eq('user_id', userId);
      if (error) throw error;
      return { userId, enabled };
    },
    onSuccess: ({ enabled }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users-list-with-addresses'] });
      toast.success(enabled ? 'ارسال پیامک به این کاربر فعال شد' : 'ارسال پیامک به این کاربر غیرفعال شد');
    },
    onError: (err: any) => {
      toast.error('خطا در ذخیره: ' + (err?.message || 'نامشخص'));
    },
  });

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return users;
    return users?.filter(user => {
      if (user.full_name?.toLowerCase().includes(term)) return true;
      if (user.phone_number?.includes(term)) return true;
      const anyAddr = (user.orders || []).some(o =>
        (o.address || '').toLowerCase().includes(term) ||
        (o.detailed_address || '').toLowerCase().includes(term)
      );
      return anyAddr;
    });
  }, [users, searchTerm]);

  const toggleAddr = (uid: string) => {
    setExpandedAddresses(prev => {
      const n = new Set(prev);
      n.has(uid) ? n.delete(uid) : n.add(uid);
      return n;
    });
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="w-full p-2 sm:p-3 space-y-2" dir="rtl">
      <Card>
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-lg">ماژول ورود به حساب کاربران</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 px-2 pb-2">
          <div className="relative">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="جستجو بر اساس نام، شماره تماس یا آدرس..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10 h-9"
            />
          </div>

          <div className="rounded-md border w-full overflow-hidden">
            <Table className="w-full table-fixed text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right p-2 w-[14%]">نام کامل</TableHead>
                  <TableHead className="text-right p-2 w-[12%]">شماره تماس</TableHead>
                  <TableHead className="text-right p-2 w-[14%]">نقش‌ها</TableHead>
                  <TableHead className="text-right p-2 w-[10%]">تاریخ ثبت‌نام</TableHead>
                  <TableHead className="text-right p-2 w-[22%]">آخرین آدرس سفارش</TableHead>
                  <TableHead className="text-center p-2 w-[10%]">پیامک</TableHead>
                  <TableHead className="text-center p-2 w-[18%]">عملیات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers?.map((user) => {
                  const smsEnabled = (user as any).sms_notifications_enabled !== false;
                  const orders = user.orders || [];
                  const latest = orders[0];
                  const isExpanded = expandedAddresses.has(user.user_id);
                  const hasMore = orders.length > 1;
                  return (
                  <TableRow key={user.user_id}>
                    <TableCell className="font-medium p-2 break-words">
                      {user.full_name || 'نامشخص'}
                    </TableCell>
                    <TableCell dir="ltr" className="text-right p-2">
                      {user.phone_number || '-'}
                    </TableCell>
                    <TableCell className="p-2">
                      <div className="flex gap-1 flex-wrap">
                        {user.roles.length > 0 ? (
                          user.roles.map(role => (
                            <Badge key={role} variant="secondary" className="text-[10px] px-1.5 py-0">
                              {role}
                            </Badge>
                          ))
                        ) : (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">کاربر عادی</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="p-2 whitespace-nowrap">
                      {new Date(user.created_at).toLocaleDateString('fa-IR')}
                    </TableCell>
                    <TableCell className="p-2 align-top">
                      {latest ? (
                        <div className="space-y-1">
                          <button
                            type="button"
                            onClick={() => hasMore && toggleAddr(user.user_id)}
                            className={`w-full text-right flex items-start gap-1 group ${hasMore ? 'cursor-pointer hover:text-primary' : 'cursor-default'}`}
                            title={hasMore ? `${orders.length} آدرس - برای مشاهده کلیک کنید` : ''}
                          >
                            <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0 text-muted-foreground" />
                            <span className="text-[11px] break-words flex-1">
                              {latest.address || '-'}
                              {latest.detailed_address ? ` - ${latest.detailed_address}` : ''}
                            </span>
                            {hasMore && (
                              isExpanded
                                ? <ChevronUp className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                : <ChevronDown className="h-3 w-3 mt-0.5 flex-shrink-0" />
                            )}
                          </button>
                          {hasMore && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0">
                              {orders.length} سفارش
                            </Badge>
                          )}
                          {isExpanded && hasMore && (
                            <div className="mt-1 space-y-1 border-r-2 border-primary/30 pr-2">
                              {orders.slice(1).map(o => (
                                <div key={o.id} className="text-[10px] text-muted-foreground flex items-start gap-1">
                                  <MapPin className="h-2.5 w-2.5 mt-0.5 flex-shrink-0" />
                                  <span className="break-words">
                                    {o.code ? `[${o.code}] ` : ''}
                                    {o.address || '-'}
                                    {o.detailed_address ? ` - ${o.detailed_address}` : ''}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-[11px]">بدون سفارش</span>
                      )}
                    </TableCell>
                    <TableCell className="p-2">
                      <div className="flex items-center justify-center gap-1.5" title={smsEnabled ? 'ارسال پیامک فعال است' : 'ارسال پیامک غیرفعال است'}>
                        {smsEnabled ? (
                          <MessageSquare className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <MessageSquareOff className="h-3.5 w-3.5 text-red-600" />
                        )}
                        <Switch
                          checked={smsEnabled}
                          disabled={toggleSmsMutation.isPending}
                          onCheckedChange={(checked) => toggleSmsMutation.mutate({ userId: user.user_id, enabled: checked })}
                          aria-label="فعال/غیرفعال کردن پیامک"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="p-2">
                      <div className="flex gap-1 justify-center flex-wrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => navigate(`/admin/users/${user.user_id}`)}
                        >
                          <Eye className="h-3.5 w-3.5 ml-1" />
                          مشاهده
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => loginAsUser(user.user_id)}
                          disabled={isLoginAsUserLoading}
                          className="gap-1 h-7 px-2 text-xs"
                        >
                          <LogIn className="h-3.5 w-3.5" />
                          ورود
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {filteredUsers?.length === 0 && (
            <div className="text-center py-4 text-muted-foreground text-sm">
              کاربری یافت نشد
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
