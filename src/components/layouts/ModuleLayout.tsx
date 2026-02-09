import { ReactNode, useState, useCallback, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useModuleAssignmentInfo } from '@/hooks/useModuleAssignmentInfo';
import { ArrowRight, Package, Save, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ModuleLayoutProps {
  children: ReactNode;
  defaultModuleKey: string;
  defaultTitle: string;
  defaultDescription: string;
  icon?: ReactNode;
  backTo?: string;
  showHeader?: boolean;
  action?: ReactNode;
  /** Whether there are unsaved changes */
  hasUnsavedChanges?: boolean;
  /** Callback to save changes before leaving */
  onSaveBeforeLeave?: () => Promise<boolean>;
  /** Whether save is in progress */
  isSaving?: boolean;
}

export function ModuleLayout({
  children,
  defaultModuleKey,
  defaultTitle,
  defaultDescription,
  icon,
  backTo = '/profile?tab=modules',
  showHeader = true,
  action,
  hasUnsavedChanges = false,
  onSaveBeforeLeave,
  isSaving = false,
}: ModuleLayoutProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeModuleKey = searchParams.get('moduleKey') || defaultModuleKey;
  const { moduleName, moduleDescription } = useModuleAssignmentInfo(
    activeModuleKey,
    defaultTitle,
    defaultDescription
  );

  const [unsavedDialogOpen, setUnsavedDialogOpen] = useState(false);
  const [savingBeforeLeave, setSavingBeforeLeave] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

  // Handle back button click
  const handleBackClick = useCallback(() => {
    if (hasUnsavedChanges) {
      setPendingNavigation(backTo);
      setUnsavedDialogOpen(true);
    } else {
      navigate(backTo);
    }
  }, [hasUnsavedChanges, backTo, navigate]);

  // Handle save and leave
  const handleSaveAndLeave = useCallback(async () => {
    if (!onSaveBeforeLeave || !pendingNavigation) return;
    
    setSavingBeforeLeave(true);
    try {
      const success = await onSaveBeforeLeave();
      if (success) {
        setUnsavedDialogOpen(false);
        navigate(pendingNavigation);
      }
    } finally {
      setSavingBeforeLeave(false);
    }
  }, [onSaveBeforeLeave, pendingNavigation, navigate]);

  // Handle leave without saving
  const handleLeaveWithoutSaving = useCallback(() => {
    if (pendingNavigation) {
      setUnsavedDialogOpen(false);
      navigate(pendingNavigation);
    }
  }, [pendingNavigation, navigate]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    setUnsavedDialogOpen(false);
    setPendingNavigation(null);
  }, []);

  // Browser beforeunload event
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'تغییرات ذخیره نشده دارید. آیا مطمئن هستید؟';
      return e.returnValue;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

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
                  onClick={handleBackClick}
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

      {/* Unsaved Changes Dialog */}
      <AlertDialog open={unsavedDialogOpen} onOpenChange={setUnsavedDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Save className="h-5 w-5 text-primary" />
              تغییرات ذخیره نشده
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              شما تغییراتی در این صفحه انجام داده‌اید که ذخیره نشده‌اند.
              <br />
              آیا می‌خواهید قبل از خروج آن‌ها را ذخیره کنید؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={savingBeforeLeave}
              className="w-full sm:w-auto"
            >
              انصراف
            </Button>
            <Button
              variant="destructive"
              onClick={handleLeaveWithoutSaving}
              disabled={savingBeforeLeave}
              className="w-full sm:w-auto gap-2"
            >
              <Trash2 className="h-4 w-4" />
              خروج بدون ذخیره
            </Button>
            {onSaveBeforeLeave && (
              <Button
                onClick={handleSaveAndLeave}
                disabled={savingBeforeLeave || isSaving}
                className="w-full sm:w-auto gap-2"
              >
                {savingBeforeLeave ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                ذخیره و خروج
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}