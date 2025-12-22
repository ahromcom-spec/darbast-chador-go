import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useDailyReportBulkDelete(onSuccess?: () => void) {
  const { toast } = useToast();
  const [selectedReportIds, setSelectedReportIds] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const toggleReportSelection = (reportId: string) => {
    setSelectedReportIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(reportId)) {
        newSet.delete(reportId);
      } else {
        newSet.add(reportId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = (reportIds: string[]) => {
    if (selectedReportIds.size === reportIds.length) {
      setSelectedReportIds(new Set());
    } else {
      setSelectedReportIds(new Set(reportIds));
    }
  };

  const clearSelection = () => {
    setSelectedReportIds(new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedReportIds.size === 0) return;
    
    setDeleting(true);
    try {
      const ids = Array.from(selectedReportIds);
      
      // Delete related records first
      await supabase
        .from('daily_report_orders')
        .delete()
        .in('daily_report_id', ids);
        
      await supabase
        .from('daily_report_staff')
        .delete()
        .in('daily_report_id', ids);
      
      // Delete the reports
      const { error } = await supabase
        .from('daily_reports')
        .delete()
        .in('id', ids);

      if (error) throw error;

      toast({
        title: '✓ حذف شد',
        description: `${selectedReportIds.size} گزارش با موفقیت حذف شدند.`
      });

      setBulkDeleteDialogOpen(false);
      clearSelection();
      onSuccess?.();
    } catch (error) {
      console.error('Error bulk deleting reports:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'خطا در حذف گزارشات'
      });
    } finally {
      setDeleting(false);
    }
  };

  return {
    selectedReportIds,
    bulkDeleteDialogOpen,
    setBulkDeleteDialogOpen,
    deleting,
    toggleReportSelection,
    toggleSelectAll,
    clearSelection,
    handleBulkDelete
  };
}
