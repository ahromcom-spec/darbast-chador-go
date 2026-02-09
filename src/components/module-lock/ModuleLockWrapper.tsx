import { ReactNode, useCallback, useMemo } from 'react';
import { useModuleLock } from '@/hooks/useModuleLock';
import { useModuleVersionHistory } from '@/hooks/useModuleVersionHistory';
import { ModuleLockStatusBar } from './ModuleLockStatusBar';
import { toast } from 'sonner';

interface ModuleLockWrapperProps {
  moduleKey: string;
  moduleDate?: string;
  children: (props: {
    isReadOnly: boolean;
    saveWithVersion: (data: any) => Promise<number | null>;
    restoreVersion: (versionNumber: number) => Promise<any | null>;
  }) => ReactNode;
  onAutoSave?: (data: any) => Promise<void>;
  getCurrentData?: () => any;
  onDataRestore?: (data: any) => void;
}

export function ModuleLockWrapper({
  moduleKey,
  moduleDate,
  children,
  onAutoSave,
  getCurrentData,
  onDataRestore,
}: ModuleLockWrapperProps) {
  // Handle force takeover - auto-save previous user's data
  const handleForceTakeover = useCallback(
    async (previousOwnerId: string) => {
      if (onAutoSave && getCurrentData) {
        try {
          const currentData = getCurrentData();
          if (currentData) {
            await onAutoSave(currentData);
            toast.info('داده‌های کاربر قبلی ذخیره شد');
          }
        } catch (error) {
          console.error('Error auto-saving on takeover:', error);
        }
      }
    },
    [onAutoSave, getCurrentData]
  );

  const {
    lockStatus,
    isLoading,
    isReadOnly,
    acquireLock,
    releaseLock,
  } = useModuleLock({
    moduleKey,
    moduleDate,
    onForceTakeover: handleForceTakeover,
    autoAcquire: false,
  });

  const { versions, saveVersion, loadVersion, fetchVersions } = useModuleVersionHistory({
    moduleKey,
    moduleDate,
  });

  // Save data with version history
  const saveWithVersion = useCallback(
    async (data: any): Promise<number | null> => {
      if (isReadOnly) {
        toast.error('شما دسترسی ویرایش ندارید');
        return null;
      }
      return await saveVersion(data);
    },
    [isReadOnly, saveVersion]
  );

  // Restore a previous version
  const restoreVersion = useCallback(
    async (versionNumber: number): Promise<any | null> => {
      const data = await loadVersion(versionNumber);
      if (data && onDataRestore) {
        onDataRestore(data);
        toast.success(`نسخه ${versionNumber} بازیابی شد`);
      }
      return data;
    },
    [loadVersion, onDataRestore]
  );

  // Handle version restore from dropdown
  const handleRestoreVersion = useCallback(
    async (versionNumber: number) => {
      if (isReadOnly) {
        toast.error('برای بازیابی نسخه ابتدا کنترل ویرایش را بگیرید');
        return;
      }
      await restoreVersion(versionNumber);
    },
    [isReadOnly, restoreVersion]
  );

  // Mapped versions for display
  const mappedVersions = useMemo(
    () =>
      versions.map((v) => ({
        id: v.id,
        versionNumber: v.versionNumber,
        createdAt: v.createdAt,
      })),
    [versions]
  );

  return (
    <div className="space-y-3">
      <ModuleLockStatusBar
        isReadOnly={isReadOnly}
        isLoading={isLoading}
        isMine={lockStatus.isMine}
        lockedByName={lockStatus.lockedByName}
        onTakeControl={acquireLock}
        onReleaseControl={releaseLock}
        versions={mappedVersions}
        onRestoreVersion={handleRestoreVersion}
      />

      {children({
        isReadOnly,
        saveWithVersion,
        restoreVersion,
      })}
    </div>
  );
}
