import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export function useOrderArchive(onSuccess?: () => void) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [bulkArchiveDialogOpen, setBulkArchiveDialogOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [orderToArchive, setOrderToArchive] = useState<{ id: string; code: string } | null>(null);

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrderIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = (orderIds: string[]) => {
    if (selectedOrderIds.size === orderIds.length) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(orderIds));
    }
  };

  const clearSelection = () => {
    setSelectedOrderIds(new Set());
  };

  const handleArchiveOrder = async () => {
    if (!orderToArchive || !user) return;
    
    setArchiving(true);
    try {
      const { error } = await supabase
        .from('projects_v3')
        .update({
          is_archived: true,
          archived_at: new Date().toISOString(),
          archived_by: user.id
        })
        .eq('id', orderToArchive.id);

      if (error) throw error;

      toast({
        title: '✓ بایگانی شد',
        description: `سفارش ${orderToArchive.code} با موفقیت بایگانی شد.`
      });

      setArchiveDialogOpen(false);
      setOrderToArchive(null);
      onSuccess?.();
    } catch (error) {
      console.error('Error archiving order:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'خطا در بایگانی سفارش'
      });
    } finally {
      setArchiving(false);
    }
  };

  const handleBulkArchive = async () => {
    if (selectedOrderIds.size === 0 || !user) return;
    
    setArchiving(true);
    try {
      const { error } = await supabase
        .from('projects_v3')
        .update({
          is_archived: true,
          archived_at: new Date().toISOString(),
          archived_by: user.id
        })
        .in('id', Array.from(selectedOrderIds));

      if (error) throw error;

      toast({
        title: '✓ بایگانی شد',
        description: `${selectedOrderIds.size} سفارش با موفقیت بایگانی شدند.`
      });

      setBulkArchiveDialogOpen(false);
      clearSelection();
      onSuccess?.();
    } catch (error) {
      console.error('Error bulk archiving orders:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'خطا در بایگانی سفارشات'
      });
    } finally {
      setArchiving(false);
    }
  };

  const openArchiveDialog = (order: { id: string; code: string }) => {
    setOrderToArchive(order);
    setArchiveDialogOpen(true);
  };

  return {
    selectedOrderIds,
    archiveDialogOpen,
    setArchiveDialogOpen,
    bulkArchiveDialogOpen,
    setBulkArchiveDialogOpen,
    archiving,
    orderToArchive,
    toggleOrderSelection,
    toggleSelectAll,
    clearSelection,
    handleArchiveOrder,
    handleBulkArchive,
    openArchiveDialog
  };
}
