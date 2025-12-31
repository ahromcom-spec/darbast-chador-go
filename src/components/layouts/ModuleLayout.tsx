import { ReactNode } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useModuleAssignmentInfo } from '@/hooks/useModuleAssignmentInfo';
import { ArrowRight, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ModuleLayoutProps {
  children: ReactNode;
  defaultModuleKey: string;
  defaultTitle: string;
  defaultDescription: string;
  icon?: ReactNode;
  backTo?: string;
  showHeader?: boolean;
  action?: ReactNode;
}

export function ModuleLayout({
  children,
  defaultModuleKey,
  defaultTitle,
  defaultDescription,
  icon,
  backTo = '/profile?tab=modules',
  showHeader = true,
  action
}: ModuleLayoutProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeModuleKey = searchParams.get('moduleKey') || defaultModuleKey;
  const { moduleName, moduleDescription } = useModuleAssignmentInfo(
    activeModuleKey,
    defaultTitle,
    defaultDescription
  );

  return (
    <div className="min-h-screen bg-background">
      {showHeader && (
        <div className="border-b bg-gradient-to-l from-primary/5 via-background to-background">
          <div className="container mx-auto px-4 py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1">
                <div className="p-2 rounded-lg bg-primary/10">
                  {icon || <Package className="h-5 w-5 text-primary" />}
                </div>
                <div className="text-right flex-1">
                  <h1 className="text-lg md:text-xl font-bold text-foreground">
                    {moduleName}
                  </h1>
                  <p className="text-sm text-muted-foreground hidden sm:block">
                    {moduleDescription}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                {action}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(backTo)}
                  className="gap-2"
                >
                  بازگشت
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}