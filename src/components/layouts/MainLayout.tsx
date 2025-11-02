import { ReactNode, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/navigation/AppSidebar';
import { LogOut, Menu, PanelLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useMediaQuery } from '@/hooks/useResponsive';


interface MainLayoutProps {
  children: ReactNode;
  showSidebar?: boolean;
}

export function MainLayout({ children, showSidebar = true }: MainLayoutProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: 'خروج موفق',
        description: 'با موفقیت از سامانه خارج شدید'
      });
      navigate('/');
    } catch (error) {
      toast({
        title: 'خطا در خروج',
        description: 'مشکلی در خروج از سامانه پیش آمد',
        variant: 'destructive'
      });
    }
  };

  if (!showSidebar || !user) {
    return (
      <div className="min-h-screen bg-background">
        {user && (
          <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-14 items-center justify-between">
              <Link to="/" className="flex items-center gap-2">
                <img src="/ahrom-logo.png" alt="لوگو اهرم" className="h-8 w-auto" />
                <span className="font-bold text-lg">اهرم</span>
              </Link>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="ml-2 h-4 w-4" />
                خروج
              </Button>
            </div>
          </header>
        )}
        <main className="flex-1">{children}</main>
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-screen flex w-full bg-background relative">
        {/* Desktop Sidebar */}
        <div className="hidden md:block">
          <AppSidebar />
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col w-full">
          {/* Header */}
          <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-14 items-center justify-between px-4">
              <div className="flex items-center gap-3">
                {/* Desktop Sidebar Trigger */}
                <div className="hidden md:block">
                  <SidebarTrigger className="h-9 w-9">
                    <PanelLeft className="h-4 w-4" />
                  </SidebarTrigger>
                </div>

                {/* Mobile Menu */}
                <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                  <SheetTrigger asChild className="md:hidden">
                    <Button variant="ghost" size="icon">
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-64 p-0 bg-sidebar text-sidebar-foreground">
                    <AppSidebar onNavigate={() => setMobileMenuOpen(false)} staticMode />
                  </SheetContent>
                </Sheet>

                <Link to="/" className="flex items-center gap-2">
                  <img src="/ahrom-logo.png" alt="لوگو اهرم" className="h-8 w-auto" />
                  <span className="font-bold text-lg hidden sm:inline">اهرم</span>
                </Link>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-2">
                  <LogOut className="h-4 w-4" />
                  <span>خروج</span>
                </Button>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 w-full">
            <div className="container mx-auto py-4 sm:py-6 px-4">
              
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
