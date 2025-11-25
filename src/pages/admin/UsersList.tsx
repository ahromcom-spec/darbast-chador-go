import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Eye, Search, LogIn } from 'lucide-react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useAdminLoginAsUser } from '@/hooks/useAdminLoginAsUser';

export default function UsersList() {
  usePageTitle('مدیریت کاربران');
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const { loginAsUser, isLoading: isLoginAsUserLoading } = useAdminLoginAsUser();

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users-list'],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select(`
          user_id,
          full_name,
          phone_number,
          created_at
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get roles for each user
      const usersWithRoles = await Promise.all(
        (profiles || []).map(async (profile) => {
          const { data: roles } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', profile.user_id);

          return {
            ...profile,
            roles: roles?.map(r => r.role) || []
          };
        })
      );

      return usersWithRoles;
    }
  });

  const filteredUsers = users?.filter(user => 
    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.phone_number?.includes(searchTerm)
  );

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="container mx-auto p-6 space-y-6" dir="rtl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">مدیریت کاربران</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="جستجو بر اساس نام یا شماره تماس..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10"
            />
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">نام کامل</TableHead>
                  <TableHead className="text-right">شماره تماس</TableHead>
                  <TableHead className="text-right">نقش‌ها</TableHead>
                  <TableHead className="text-right">تاریخ ثبت‌نام</TableHead>
                  <TableHead className="text-center">عملیات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers?.map((user) => (
                  <TableRow key={user.user_id}>
                    <TableCell className="font-medium">
                      {user.full_name || 'نامشخص'}
                    </TableCell>
                    <TableCell dir="ltr" className="text-right">
                      {user.phone_number || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {user.roles.length > 0 ? (
                          user.roles.map(role => (
                            <Badge key={role} variant="secondary">
                              {role}
                            </Badge>
                          ))
                        ) : (
                          <Badge variant="outline">کاربر عادی</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(user.created_at).toLocaleDateString('fa-IR')}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2 justify-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/admin/users/${user.user_id}`)}
                        >
                          <Eye className="h-4 w-4 ml-2" />
                          مشاهده
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => loginAsUser(user.user_id)}
                          disabled={isLoginAsUserLoading}
                          className="gap-2"
                        >
                          <LogIn className="h-4 w-4" />
                          ورود
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredUsers?.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              کاربری یافت نشد
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
