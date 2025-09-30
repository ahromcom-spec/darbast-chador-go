import { LayoutDashboard, Package, Users, Settings, LogOut } from 'lucide-react';
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
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

const menuItems = [
  { title: 'داشبورد', url: '/admin', icon: LayoutDashboard },
  { title: 'سفارشات', url: '/admin/orders', icon: Package },
  { title: 'کاربران', url: '/admin/users', icon: Users },
];

export function AdminSidebar() {
  const { collapsed } = useSidebar();
  const { signOut, user } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted/50';

  return (
    <Sidebar className={collapsed ? 'w-14' : 'w-60'} collapsible>
      <SidebarContent>
        <div className="p-4">
          <h2 className={collapsed ? 'text-xs text-center' : 'text-lg font-bold'}>
            {collapsed ? 'پنل' : 'پنل مدیریت'}
          </h2>
          {!collapsed && user?.email && (
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
                      {!collapsed && <span>{item.title}</span>}
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
            {!collapsed && <span className="mr-2">خروج</span>}
          </Button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
