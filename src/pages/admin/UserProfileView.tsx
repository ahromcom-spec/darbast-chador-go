import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ArrowRight, User, Phone, Calendar, Shield } from 'lucide-react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function UserProfileView() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();

  const { data: userProfile, isLoading: profileLoading } = useQuery({
    queryKey: ['admin-user-profile', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!userId
  });

  const { data: userRoles, isLoading: rolesLoading } = useQuery({
    queryKey: ['admin-user-roles', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role, created_at')
        .eq('user_id', userId);

      if (error) throw error;
      return data;
    },
    enabled: !!userId
  });

  const { data: userProjects, isLoading: projectsLoading } = useQuery({
    queryKey: ['admin-user-projects', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!userId
  });

  const { data: userTickets, isLoading: ticketsLoading } = useQuery({
    queryKey: ['admin-user-tickets', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!userId
  });

  usePageTitle(userProfile?.full_name || 'مشاهده کاربر');

  if (profileLoading || rolesLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="container mx-auto p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/admin/users')}>
          <ArrowRight className="h-4 w-4 ml-2" />
          بازگشت به لیست کاربران
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-2xl">{userProfile?.full_name || 'نامشخص'}</CardTitle>
              <div className="flex gap-2 mt-2 flex-wrap">
                {userRoles?.map((role) => (
                  <Badge key={role.role} variant="secondary">
                    <Shield className="h-3 w-3 ml-1" />
                    {role.role}
                  </Badge>
                ))}
                {(!userRoles || userRoles.length === 0) && (
                  <Badge variant="outline">کاربر عادی</Badge>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">شماره تماس:</span>
              <span className="font-medium" dir="ltr">{userProfile?.phone_number || '-'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">تاریخ ثبت‌نام:</span>
              <span className="font-medium">
                {userProfile?.created_at ? new Date(userProfile.created_at).toLocaleDateString('fa-IR') : '-'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="projects" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="projects">پروژه‌ها ({userProjects?.length || 0})</TabsTrigger>
          <TabsTrigger value="tickets">تیکت‌ها ({userTickets?.length || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="projects">
          <Card>
            <CardHeader>
              <CardTitle>پروژه‌های کاربر</CardTitle>
            </CardHeader>
            <CardContent>
              {projectsLoading ? (
                <LoadingSpinner />
              ) : userProjects && userProjects.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">نام پروژه</TableHead>
                        <TableHead className="text-right">نوع سرویس</TableHead>
                        <TableHead className="text-right">وضعیت</TableHead>
                        <TableHead className="text-right">تاریخ ایجاد</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {userProjects.map((project) => (
                        <TableRow key={project.id}>
                          <TableCell className="font-medium">{project.project_name}</TableCell>
                          <TableCell>{project.service_type}</TableCell>
                          <TableCell>
                            <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
                              {project.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(project.created_at).toLocaleDateString('fa-IR')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  این کاربر هنوز پروژه‌ای ندارد
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tickets">
          <Card>
            <CardHeader>
              <CardTitle>تیکت‌های کاربر</CardTitle>
            </CardHeader>
            <CardContent>
              {ticketsLoading ? (
                <LoadingSpinner />
              ) : userTickets && userTickets.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">موضوع</TableHead>
                        <TableHead className="text-right">دپارتمان</TableHead>
                        <TableHead className="text-right">وضعیت</TableHead>
                        <TableHead className="text-right">تاریخ ایجاد</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {userTickets.map((ticket) => (
                        <TableRow key={ticket.id}>
                          <TableCell className="font-medium">{ticket.subject}</TableCell>
                          <TableCell>{ticket.department}</TableCell>
                          <TableCell>
                            <Badge 
                              variant={
                                ticket.status === 'open' ? 'default' : 
                                ticket.status === 'closed' ? 'secondary' : 
                                'outline'
                              }
                            >
                              {ticket.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(ticket.created_at).toLocaleDateString('fa-IR')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  این کاربر هنوز تیکتی ندارد
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
