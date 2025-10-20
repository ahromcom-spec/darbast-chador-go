import { Outlet, useLocation } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/AdminSidebar';
import { GeneralManagerSidebar } from '@/components/GeneralManagerSidebar';
import { PageGuide } from '@/components/common/PageGuide';

export default function AdminLayout() {
  const location = useLocation();
  const isGeneralManager = location.pathname.startsWith('/general-manager');
  
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        {isGeneralManager ? <GeneralManagerSidebar /> : <AdminSidebar />}
        <div className="flex-1">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4">
            <SidebarTrigger />
            <h1 className="text-lg font-semibold">
              {isGeneralManager ? 'پنل مدیریت کل احرم' : 'پنل مدیریت احرم'}
            </h1>
          </header>
          <main className="flex-1 p-6">
            <PageGuide />
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
