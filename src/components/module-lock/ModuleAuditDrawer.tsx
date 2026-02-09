import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserRoles } from '@/hooks/useUserRoles';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Settings2, User, Clock, Edit3, Plus, Loader2, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns-jalali';
import { faIR } from 'date-fns-jalali/locale';

interface AuditRecord {
  id: string;
  versionNumber: number;
  savedBy: string;
  savedByName: string;
  createdAt: string;
  changeType: 'create' | 'edit';
}

interface ModuleAuditDrawerProps {
  moduleKey: string;
  moduleDate?: string;
  moduleName?: string;
}

export function ModuleAuditDrawer({
  moduleKey,
  moduleDate,
  moduleName = 'ماژول',
}: ModuleAuditDrawerProps) {
  const { isAdmin, isCEO, isGeneralManager } = useUserRoles();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [auditRecords, setAuditRecords] = useState<AuditRecord[]>([]);
  const [originalCreator, setOriginalCreator] = useState<{ name: string; date: string } | null>(null);
  const [lastModifier, setLastModifier] = useState<{ name: string; date: string } | null>(null);

  const effectiveDate = moduleDate || new Date().toISOString().split('T')[0];

  // Only authorized roles can see audit info
  const canViewAudit = isAdmin || isCEO || isGeneralManager;

  useEffect(() => {
    if (isOpen && canViewAudit) {
      fetchAuditData();
    }
  }, [isOpen, moduleKey, effectiveDate, canViewAudit]);

  const fetchAuditData = async () => {
    setIsLoading(true);
    try {
      // Fetch version history
      const { data: versions, error } = await supabase
        .from('module_version_history')
        .select('id, version_number, saved_by, created_at')
        .eq('module_key', moduleKey)
        .eq('module_date', effectiveDate)
        .order('version_number', { ascending: true });

      if (error) throw error;

      if (!versions || versions.length === 0) {
        setAuditRecords([]);
        setOriginalCreator(null);
        setLastModifier(null);
        return;
      }

      // Fetch user names for all saved_by IDs
      const userIds = [...new Set(versions.map((v) => v.saved_by))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      const userNameMap: Record<string, string> = {};
      profiles?.forEach((p) => {
        userNameMap[p.id] = p.full_name || 'کاربر ناشناس';
      });

      // Map versions to audit records
      const records: AuditRecord[] = versions.map((v, index) => ({
        id: v.id,
        versionNumber: v.version_number,
        savedBy: v.saved_by,
        savedByName: userNameMap[v.saved_by] || 'کاربر ناشناس',
        createdAt: v.created_at,
        changeType: index === 0 ? 'create' : 'edit',
      }));

      setAuditRecords(records.reverse()); // Show newest first

      // Set original creator (first version)
      const firstVersion = versions[0];
      setOriginalCreator({
        name: userNameMap[firstVersion.saved_by] || 'کاربر ناشناس',
        date: firstVersion.created_at,
      });

      // Set last modifier (last version)
      const lastVersion = versions[versions.length - 1];
      setLastModifier({
        name: userNameMap[lastVersion.saved_by] || 'کاربر ناشناس',
        date: lastVersion.created_at,
      });
    } catch (error) {
      console.error('Error fetching audit data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'EEEE d MMMM yyyy - HH:mm', { locale: faIR });
    } catch {
      return dateStr;
    }
  };

  const formatShortDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'd MMMM - HH:mm', { locale: faIR });
    } catch {
      return dateStr;
    }
  };

  if (!canViewAudit) {
    return null;
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <Settings2 className="h-4 w-4" />
          <span className="hidden sm:inline">مشخصات</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-full sm:max-w-md">
        <SheetHeader className="text-right">
          <SheetTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            مشخصات و تاریخچه
          </SheetTitle>
          <SheetDescription>
            اطلاعات مالکیت و تغییرات {moduleName}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid gap-4">
                {/* Original Creator */}
                <div className="rounded-lg border bg-card p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-primary/10 p-2">
                      <Plus className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 text-right">
                      <p className="text-sm font-medium text-muted-foreground">
                        ایجادکننده اولیه
                      </p>
                      {originalCreator ? (
                        <>
                          <p className="mt-1 font-semibold">{originalCreator.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(originalCreator.date)}
                          </p>
                        </>
                      ) : (
                        <p className="mt-1 text-muted-foreground">هنوز ذخیره نشده</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Last Modifier */}
                <div className="rounded-lg border bg-card p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-secondary p-2">
                      <Edit3 className="h-4 w-4 text-secondary-foreground" />
                    </div>
                    <div className="flex-1 text-right">
                      <p className="text-sm font-medium text-muted-foreground">
                        آخرین ویرایش‌کننده
                      </p>
                      {lastModifier ? (
                        <>
                          <p className="mt-1 font-semibold">{lastModifier.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(lastModifier.date)}
                          </p>
                        </>
                      ) : (
                        <p className="mt-1 text-muted-foreground">هنوز ویرایش نشده</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Version History */}
              <div>
                <h3 className="mb-3 flex items-center gap-2 font-semibold">
                  <Clock className="h-4 w-4" />
                  تاریخچه تغییرات
                </h3>

                {auditRecords.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    هنوز تغییری ثبت نشده است
                  </p>
                ) : (
                  <ScrollArea className="h-[300px] pr-1">
                    <div className="space-y-3">
                      {auditRecords.map((record, index) => (
                        <div
                          key={record.id}
                          className="relative rounded-lg border bg-muted/30 p-3"
                        >
                          {/* Version badge */}
                          <div className="mb-2 flex items-center justify-between">
                            <Badge
                              variant={record.changeType === 'create' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {record.changeType === 'create' ? 'ایجاد' : 'ویرایش'}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              نسخه {record.versionNumber}
                            </span>
                          </div>

                          {/* User info */}
                          <div className="flex items-center gap-2 text-right">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm font-medium">{record.savedByName}</span>
                          </div>

                          {/* Timestamp */}
                          <div className="mt-1 flex items-center gap-2 text-right">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {formatShortDate(record.createdAt)}
                            </span>
                          </div>

                          {/* Indicator line for timeline */}
                          {index < auditRecords.length - 1 && (
                            <div className="absolute -bottom-3 right-6 h-3 w-0.5 bg-border" />
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
