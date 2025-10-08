import { NavLink } from 'react-router-dom';
import {
  Home,
  Building2,
  Briefcase,
  MessageSquare,
  User,
  Shield,
  Settings,
  FileText,
  Users,
  ClipboardList,
  Hammer
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useAdminRole } from '@/hooks/useAdminRole';
import { useGeneralManagerRole } from '@/hooks/useGeneralManagerRole';
import { useContractorRole } from '@/hooks/useContractorRole';
import { useAuth } from '@/contexts/AuthContext';

interface AppSidebarProps {
  onNavigate?: () => void;
}

export function AppSidebar({ onNavigate }: AppSidebarProps) {
  const { user } = useAuth();
  const { isAdmin } = useAdminRole();
  const { isGeneralManager } = useGeneralManagerRole();
  const { isContractor } = useContractorRole();

  const publicItems = [
    { title: 'صفحه اصلی', url: '/', icon: Home },
  ];

  const userItems = user ? [
    { title: 'پروفایل کاربری', url: '/profile', icon: User },
    { title: 'پروژه‌های من', url: '/projects', icon: Building2 },
    { title: 'تیکت‌های پشتیبانی', url: '/tickets', icon: MessageSquare },
  ] : [];

  const contractorItems = isContractor ? [
    { title: 'کارتابل پیمانکار', url: '/contractor/dashboard', icon: Briefcase },
  ] : [];

  const adminItems = (isAdmin || isGeneralManager) ? [
    { title: 'پنل مدیریت', url: '/admin', icon: Shield },
    { title: 'مدیریت سفارشات', url: '/admin/orders', icon: ClipboardList },
    { title: 'درخواست‌های کارکنان', url: '/admin/staff-requests', icon: Users },
    { title: 'لیست سفید کارکنان', url: '/admin/whitelist', icon: FileText },
  ] : [];

  const gmItems = isGeneralManager ? [
    { title: 'داشبورد مدیرکل', url: '/admin/general-manager', icon: Settings },
  ] : [];

  const serviceItems = user ? [
    { title: 'ثبت درخواست داربست', url: '/scaffolding/form', icon: Hammer },
  ] : [];

  const getNavClass = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? 'bg-primary/10 text-primary font-medium border-r-2 border-primary'
      : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground';

  const handleClick = () => {
    if (onNavigate) {
      onNavigate();
    }
  };

  return (
    <Sidebar className="border-l">
      <SidebarContent>
        {/* عمومی */}
        <SidebarGroup>
          <SidebarGroupLabel>عمومی</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {publicItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className={getNavClass} onClick={handleClick}>
                      <item.icon className="ml-2 h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* کاربری */}
        {userItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>کاربری</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {userItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} className={getNavClass} onClick={handleClick}>
                        <item.icon className="ml-2 h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* خدمات */}
        {serviceItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>خدمات</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {serviceItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} className={getNavClass} onClick={handleClick}>
                        <item.icon className="ml-2 h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* پیمانکار */}
        {contractorItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>پیمانکار</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {contractorItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} className={getNavClass} onClick={handleClick}>
                        <item.icon className="ml-2 h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* مدیریت */}
        {adminItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>مدیریت</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} className={getNavClass} onClick={handleClick}>
                        <item.icon className="ml-2 h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* مدیرکل */}
        {gmItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>مدیرکل</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {gmItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} className={getNavClass} onClick={handleClick}>
                        <item.icon className="ml-2 h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
