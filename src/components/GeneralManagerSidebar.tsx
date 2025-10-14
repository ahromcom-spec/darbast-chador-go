import { LayoutDashboard, LogOut, UserPlus, Users, Building2 } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const menuItems = [
  { title: 'داشبورد', url: '/admin/general-manager', icon: LayoutDashboard },
  { title: 'مدیریت پیمانکاران', url: '/admin/contractors', icon: Building2 },
  { title: 'مدیریت پرسنل', url: '/admin/staff', icon: Users },
  { title: 'درخواست‌های پرسنل', url: '/admin/staff-requests', icon: UserPlus },
  { title: 'مدیریت لیست مجاز', url: '/admin/whitelist', icon: Users },
];

export function GeneralManagerSidebar() {
  const { open } = useSidebar();
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const fetchPendingCount = async () => {
      const { data } = await supabase
        .from('staff_profiles')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');
      
      setPendingCount(data?.length || 0);
    };

    fetchPendingCount();

    // Subscribe to changes
    const channel = supabase
      .channel('staff_profiles_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_profiles' }, () => {
        fetchPendingCount();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted/50';

  return (
    <Sidebar className={open ? 'w-60' : 'w-14'} collapsible="icon">
      <SidebarContent>
        <div className="p-4">
          <h2 className={open ? 'text-lg font-bold' : 'text-xs text-center'}>
            {open ? 'پنل مدیریت کل' : 'پنل'}
          </h2>
          {open && user?.email && (
            <p className="text-xs text-muted-foreground mt-1">{user.email}</p>
          )}
        </div>

        <Separator />

        <SidebarGroup>
          <SidebarGroupLabel>منوی اصلی</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className={getNavCls}>
                      <item.icon className="h-4 w-4" />
                      {open && (
                        <span className="flex-1 flex items-center justify-between">
                          <span>{item.title}</span>
                          {item.url === '/general-manager/staff-requests' && pendingCount > 0 && (
                            <Badge variant="destructive" className="mr-auto">
                              {pendingCount}
                            </Badge>
                          )}
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="mt-auto p-4">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            {open && <span className="mr-2">خروج</span>}
          </Button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}