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
  Hammer,
  PanelLeft
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
  SidebarTrigger,
  SidebarHeader,
  useSidebar,
} from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import { useAdminRole } from '@/hooks/useAdminRole';
import { useGeneralManagerRole } from '@/hooks/useGeneralManagerRole';
import { useContractorRole } from '@/hooks/useContractorRole';
import { useExecutiveManagerRole } from '@/hooks/useExecutiveManagerRole';
import { useSalesManagerRole } from '@/hooks/useSalesManagerRole';
import { useFinanceManagerRole } from '@/hooks/useFinanceManagerRole';
import { useAuth } from '@/contexts/AuthContext';
import { useSalesPendingCount } from '@/hooks/useSalesPendingCount';
import { useCEOPendingCount } from '@/hooks/useCEOPendingCount';

interface AppSidebarProps {
  onNavigate?: () => void;
  staticMode?: boolean;
}

export function AppSidebar({ onNavigate, staticMode }: AppSidebarProps) {
  const { user } = useAuth();
  const { open } = useSidebar();
  const { isAdmin } = useAdminRole();
  const { isGeneralManager } = useGeneralManagerRole();
  const { isContractor } = useContractorRole();
  const { isExecutiveManager } = useExecutiveManagerRole();
  const { isSalesManager } = useSalesManagerRole();
  const { isFinanceManager } = useFinanceManagerRole();
  const { data: pendingCount = 0 } = useSalesPendingCount();

  const publicItems = [
    { title: 'صفحه اصلی', url: '/', icon: Home },
  ];

  const userItems = user ? [
    { title: 'پروفایل کاربری', url: '/profile', icon: User, dataTour: 'profile' },
    { title: 'پروژه‌های من', url: '/user/projects', icon: Building2 },
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

  const executiveItems = isExecutiveManager ? [
    { title: 'داشبورد اجرا', url: '/executive', icon: Hammer },
    { title: 'کارتابل اجرایی', url: '/executive/pending-orders', icon: ClipboardList },
    { title: 'تمام سفارشات', url: '/executive/all-orders', icon: ClipboardList },
    { title: 'مشتریان', url: '/executive/customers', icon: Users },
  ] : [];

  const salesItems = isSalesManager ? [
    { title: 'سفارشات در انتظار تایید', url: '/sales/pending-orders', icon: ClipboardList },
    { title: 'مدیریت تسویه سفارشات', url: '/sales/orders', icon: ClipboardList },
  ] : [];

  const financeItems = isFinanceManager ? [
    { title: 'مدیریت مالی', url: '/finance/orders', icon: FileText },
  ] : [];

  const serviceItems = user ? [
    { title: 'ثبت درخواست داربست', url: '/scaffolding/form', icon: Hammer },
  ] : [];

  const getNavClass = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? 'bg-sidebar-primary text-sidebar-primary-foreground font-bold shadow-sm'
      : 'text-foreground font-medium hover:bg-sidebar-accent hover:text-foreground transition-all duration-200';

  const handleClick = () => {
    if (onNavigate) {
      onNavigate();
    }
  };

  return (
    <Sidebar 
      className="border-l" 
      collapsible={staticMode ? 'none' : 'icon'}
    >
      {!staticMode && (
        <SidebarHeader className="border-b p-2 flex items-center justify-end">
          <SidebarTrigger className="h-9 w-9 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shadow">
            <PanelLeft className="h-4 w-4" />
          </SidebarTrigger>
        </SidebarHeader>
      )}
      <SidebarContent>
        {/* عمومی */}
        <SidebarGroup>
          {open && <SidebarGroupLabel className="font-bold text-foreground">عمومی</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {publicItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={!open ? item.title : undefined}>
                    <NavLink to={item.url} className={getNavClass} onClick={handleClick}>
                      <item.icon className={open ? "ml-2 h-4 w-4" : "h-5 w-5"} />
                      {open && <span>{item.title}</span>}
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
            {open && <SidebarGroupLabel className="font-bold text-foreground">کاربری</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {userItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={!open ? item.title : undefined}>
                      <NavLink 
                        to={item.url} 
                        className={getNavClass} 
                        onClick={handleClick}
                        data-tour={item.dataTour}
                      >
                        <item.icon className={open ? "ml-2 h-4 w-4" : "h-5 w-5"} />
                        {open && <span>{item.title}</span>}
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
            {open && <SidebarGroupLabel className="font-bold text-foreground">خدمات</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {serviceItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={!open ? item.title : undefined}>
                      <NavLink to={item.url} className={getNavClass} onClick={handleClick}>
                        <item.icon className={open ? "ml-2 h-4 w-4" : "h-5 w-5"} />
                        {open && <span>{item.title}</span>}
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
            {open && <SidebarGroupLabel className="font-bold text-foreground">پیمانکار</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {contractorItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={!open ? item.title : undefined}>
                      <NavLink to={item.url} className={getNavClass} onClick={handleClick}>
                        <item.icon className={open ? "ml-2 h-4 w-4" : "h-5 w-5"} />
                        {open && <span>{item.title}</span>}
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
            {open && <SidebarGroupLabel className="font-bold text-foreground">مدیریت</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={!open ? item.title : undefined}>
                      <NavLink to={item.url} className={getNavClass} onClick={handleClick}>
                        <item.icon className={open ? "ml-2 h-4 w-4" : "h-5 w-5"} />
                        {open && <span>{item.title}</span>}
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
            {open && <SidebarGroupLabel className="font-bold text-foreground">مدیرکل</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {gmItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={!open ? item.title : undefined}>
                      <NavLink to={item.url} className={getNavClass} onClick={handleClick}>
                        <item.icon className={open ? "ml-2 h-4 w-4" : "h-5 w-5"} />
                        {open && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* مدیر اجرایی */}
        {executiveItems.length > 0 && (
          <SidebarGroup>
            {open && <SidebarGroupLabel className="font-bold text-foreground">اجرا</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {executiveItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={!open ? item.title : undefined}>
                      <NavLink to={item.url} className={getNavClass} onClick={handleClick}>
                        <item.icon className={open ? "ml-2 h-4 w-4" : "h-5 w-5"} />
                        {open && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* مدیر فروش */}
        {salesItems.length > 0 && (
          <SidebarGroup>
            {open && <SidebarGroupLabel className="font-bold text-foreground">فروش</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {salesItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={!open ? item.title : undefined}>
                      <NavLink to={item.url} className={getNavClass} onClick={handleClick}>
                        <item.icon className={open ? "ml-2 h-4 w-4" : "h-5 w-5"} />
                        {open && <span className="flex-1">{item.title}</span>}
                        {open && item.url === '/sales/pending-orders' && pendingCount > 0 && (
                          <Badge variant="destructive" className="mr-auto text-xs">
                            {pendingCount}
                          </Badge>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* مدیر مالی */}
        {financeItems.length > 0 && (
          <SidebarGroup>
            {open && <SidebarGroupLabel className="font-bold text-foreground">مالی</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {financeItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={!open ? item.title : undefined}>
                      <NavLink to={item.url} className={getNavClass} onClick={handleClick}>
                        <item.icon className={open ? "ml-2 h-4 w-4" : "h-5 w-5"} />
                        {open && <span>{item.title}</span>}
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
