import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { recalculateBankCardBalance } from './useBankCardRealtimeSync';

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

      // Delete bank card transactions linked to these reports and recalculate balances
      const { data: linkedStaff } = await supabase
        .from('daily_report_staff')
        .select('bank_card_id')
        .in('daily_report_id', ids)
        .not('bank_card_id', 'is', null);

      const affectedCardIds = [...new Set((linkedStaff || []).map(s => s.bank_card_id).filter(Boolean))] as string[];

      await supabase
        .from('bank_card_transactions')
        .delete()
        .eq('reference_type', 'daily_report_staff')
        .in('reference_id', ids);

      // Delete related records first
      const { error: ordersError } = await supabase
        .from('daily_report_orders')
        .delete()
        .in('daily_report_id', ids);
      if (ordersError) throw ordersError;

      const { error: staffError } = await supabase
        .from('daily_report_staff')
        .delete()
        .in('daily_report_id', ids);
      if (staffError) throw staffError;

      // Recalculate affected bank card balances
      for (const cardId of affectedCardIds) {
        await recalculateBankCardBalance(cardId);
      }

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
      const message = (error as any)?.message ? String((error as any).message) : '';
      const isRls = message.toLowerCase().includes('row-level security') || message.toLowerCase().includes('permission denied');

      toast({
        variant: 'destructive',
        title: 'خطا',
        description: isRls ? 'شما دسترسی حذف گزارشات را ندارید' : 'خطا در حذف گزارشات'
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
