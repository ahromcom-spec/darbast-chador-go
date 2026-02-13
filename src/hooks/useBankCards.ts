import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useBankCardRealtimeSync, recalculateBankCardBalance } from './useBankCardRealtimeSync';

export interface BankCard {
  id: string;
  card_name: string;
  bank_name: string;
  card_number: string | null;
  initial_balance: number;
  current_balance: number;
  registration_date: string;
  notes: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface BankCardTransaction {
  id: string;
  bank_card_id: string;
  transaction_type: 'deposit' | 'withdrawal';
  amount: number;
  balance_after: number;
  description: string | null;
  reference_type: string | null;
  reference_id: string | null;
  created_by: string | null;
  created_at: string;
  // Enriched fields for daily report transactions
  module_name?: string | null;
  report_date?: string | null;
}

export interface CreateBankCardData {
  card_name: string;
  bank_name: string;
  card_number?: string;
  initial_balance: number;
  registration_date: string;
  notes?: string;
}

export function useBankCards() {
  const { user } = useAuth();
  const [cards, setCards] = useState<BankCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const isFetchingRef = useRef(false);

  const fetchCards = useCallback(async () => {
    if (!user || isFetchingRef.current) return;

    try {
      isFetchingRef.current = true;
      setLoading(true);
      const { data, error } = await supabase
        .from('bank_cards')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCards((data || []) as BankCard[]);
    } catch (error) {
      console.error('Error fetching bank cards:', error);
      toast.error('خطا در دریافت کارت‌های بانکی');
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [user]);

  // Handle balance change from realtime sync
  const handleBalanceChange = useCallback((cardId: string, newBalance: number) => {
    setCards((prev) =>
      prev.map((card) =>
        card.id === cardId ? { ...card, current_balance: newBalance } : card
      )
    );
  }, []);

  // Handle transaction change - refetch cards
  const handleTransactionChange = useCallback(() => {
    fetchCards();
  }, [fetchCards]);

  // Setup realtime sync
  useBankCardRealtimeSync({
    onBalanceChange: handleBalanceChange,
    onTransactionChange: handleTransactionChange,
    enabled: !!user,
  });

  const createCard = useCallback(async (cardData: CreateBankCardData) => {
    if (!user) return null;

    try {
      setSaving(true);
      const { data, error } = await supabase
        .from('bank_cards')
        .insert({
          card_name: cardData.card_name,
          bank_name: cardData.bank_name,
          card_number: cardData.card_number || null,
          initial_balance: cardData.initial_balance,
          current_balance: cardData.initial_balance,
          registration_date: cardData.registration_date,
          notes: cardData.notes || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      
      toast.success('کارت بانکی با موفقیت ثبت شد');
      await fetchCards();
      return data as BankCard;
    } catch (error) {
      console.error('Error creating bank card:', error);
      toast.error('خطا در ثبت کارت بانکی');
      return null;
    } finally {
      setSaving(false);
    }
  }, [user, fetchCards]);

  const updateCard = useCallback(async (id: string, cardData: Partial<CreateBankCardData>) => {
    if (!user) return false;

    try {
      setSaving(true);
      const { error } = await supabase
        .from('bank_cards')
        .update({
          ...cardData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
      
      toast.success('کارت بانکی بروزرسانی شد');
      await fetchCards();
      return true;
    } catch (error) {
      console.error('Error updating bank card:', error);
      toast.error('خطا در بروزرسانی کارت بانکی');
      return false;
    } finally {
      setSaving(false);
    }
  }, [user, fetchCards]);

  const deleteCard = useCallback(async (id: string) => {
    if (!user) return false;

    try {
      setSaving(true);
      const { error } = await supabase
        .from('bank_cards')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast.success('کارت بانکی حذف شد');
      await fetchCards();
      return true;
    } catch (error) {
      console.error('Error deleting bank card:', error);
      toast.error('خطا در حذف کارت بانکی');
      return false;
    } finally {
      setSaving(false);
    }
  }, [user, fetchCards]);

  const toggleCardStatus = useCallback(async (id: string, isActive: boolean) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('bank_cards')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      
      toast.success(isActive ? 'کارت فعال شد' : 'کارت غیرفعال شد');
      await fetchCards();
      return true;
    } catch (error) {
      console.error('Error toggling card status:', error);
      toast.error('خطا در تغییر وضعیت کارت');
      return false;
    }
  }, [user, fetchCards]);

  const addTransaction = useCallback(async (
    cardId: string,
    type: 'deposit' | 'withdrawal',
    amount: number,
    description?: string,
    referenceType?: string,
    referenceId?: string
  ) => {
    if (!user) return false;

    try {
      // Get current balance
      const card = cards.find(c => c.id === cardId);
      if (!card) {
        toast.error('کارت یافت نشد');
        return false;
      }

      const newBalance = type === 'deposit' 
        ? card.current_balance + amount 
        : card.current_balance - amount;

      // Insert transaction
      const { error: txError } = await supabase
        .from('bank_card_transactions')
        .insert({
          bank_card_id: cardId,
          transaction_type: type,
          amount,
          balance_after: newBalance,
          description,
          reference_type: referenceType,
          reference_id: referenceId,
          created_by: user.id,
        });

      if (txError) throw txError;

      // Update card balance
      const { error: updateError } = await supabase
        .from('bank_cards')
        .update({ 
          current_balance: newBalance,
          updated_at: new Date().toISOString()
        })
        .eq('id', cardId);

      if (updateError) throw updateError;

      await fetchCards();
      return true;
    } catch (error) {
      console.error('Error adding transaction:', error);
      toast.error('خطا در ثبت تراکنش');
      return false;
    }
  }, [user, cards, fetchCards]);

  const getCardTransactions = useCallback(async (cardId: string) => {
    try {
      const { data, error } = await supabase
        .from('bank_card_transactions')
        .select('*')
        .eq('bank_card_id', cardId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const transactions = (data || []) as BankCardTransaction[];

      // Enrich daily_report_staff transactions with module name and report date
      const dailyReportTxs = transactions.filter(
        (tx) => tx.reference_type === 'daily_report_staff' && tx.reference_id
      );

      if (dailyReportTxs.length > 0) {
        const staffIds = dailyReportTxs.map((tx) => tx.reference_id!);
        
        // Get daily_report_staff -> daily_reports info
        const { data: staffRows } = await supabase
          .from('daily_report_staff')
          .select('id, daily_report_id')
          .in('id', staffIds);

        if (staffRows && staffRows.length > 0) {
          const reportIds = [...new Set(staffRows.map((s) => s.daily_report_id))];
          
          const { data: reports } = await supabase
            .from('daily_reports')
            .select('id, module_key, report_date')
            .in('id', reportIds);

          // Get module names
          const moduleKeys = [...new Set((reports || []).map((r) => r.module_key).filter(Boolean))] as string[];
          let moduleNameMap = new Map<string, string>();
          
          if (moduleKeys.length > 0) {
            const { data: modules } = await supabase
              .from('module_assignments')
              .select('module_key, module_name')
              .in('module_key', moduleKeys);
            
            (modules || []).forEach((m) => {
              if (!moduleNameMap.has(m.module_key)) {
                moduleNameMap.set(m.module_key, m.module_name);
              }
            });
          }

          // Build lookup maps
          const staffToReport = new Map(staffRows.map((s) => [s.id, s.daily_report_id]));
          const reportMap = new Map((reports || []).map((r) => [r.id, r]));

          // Enrich transactions
          for (const tx of dailyReportTxs) {
            const reportId = staffToReport.get(tx.reference_id!);
            if (reportId) {
              const report = reportMap.get(reportId);
              if (report) {
                tx.report_date = report.report_date;
                tx.module_name = report.module_key ? (moduleNameMap.get(report.module_key) || report.module_key) : null;
              }
            }
          }
        }
      }

      return transactions;
    } catch (error) {
      console.error('Error fetching transactions:', error);
      return [];
    }
  }, []);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  return {
    cards,
    activeCards: cards.filter(c => c.is_active),
    loading,
    saving,
    fetchCards,
    createCard,
    updateCard,
    deleteCard,
    toggleCardStatus,
    addTransaction,
    getCardTransactions,
  };
}
