import { Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { GeneralManagerSidebar } from '@/components/GeneralManagerSidebar';
import { PageGuide } from '@/components/common/PageGuide';

export default function GeneralManagerLayout() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <GeneralManagerSidebar />
        <div className="flex-1">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4">
            <SidebarTrigger />
            <h1 className="text-lg font-semibold">پنل مدیرعامل احرم</h1>
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