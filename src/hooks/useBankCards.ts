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
  allowed_modules: string[] | null;
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
  // Effective transaction timestamp resolved from the referenced row
  // (order_payments.payment_date or daily_report_staff.created_at), falling
  // back to bank_card_transactions.created_at when no reference is found.
  effective_time?: string | null;
  // Timestamp used for the visible report/reference date line.
  // It is resolved from the referenced source so date-only fields do not always show 00:00.
  display_report_time?: string | null;
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
        .eq('bank_card_id', cardId);

      if (error) throw error;

      const txs = ((data || []) as BankCardTransaction[]);

      const normalizeDatePart = (value?: string | null) => (value || '').slice(0, 10);
      const buildDailyReportTime = (dateValue?: string | null, timeValue?: string | null) => {
        const datePart = normalizeDatePart(dateValue);
        if (!datePart) return null;
        const rawTime = (timeValue || '').trim();
        const safeTime = /^([01]?\d|2[0-3]):[0-5]\d$/.test(rawTime) ? rawTime.padStart(5, '0') : '00:00';
        return `${datePart}T${safeTime}:00+03:30`;
      };

      // Enrich each transaction with the actual time from its referenced source row.
      const orderPaymentIds = txs.filter(t => t.reference_type === 'order_payment' && t.reference_id).map(t => t.reference_id as string);
      const dailyReportIds = [...new Set(txs.filter(t => t.reference_type === 'daily_report_staff' && t.reference_id).map(t => t.reference_id as string))];

      const [opRes, drRes, drsRes] = await Promise.all([
        orderPaymentIds.length
          ? supabase.from('order_payments').select('id, payment_date, created_at').in('id', orderPaymentIds)
          : Promise.resolve({ data: [] as any[] } as any),
        dailyReportIds.length
          ? supabase.from('daily_reports').select('id, report_date').in('id', dailyReportIds)
          : Promise.resolve({ data: [] as any[] } as any),
        dailyReportIds.length
          ? supabase
              .from('daily_report_staff')
              .select('id, daily_report_id, bank_card_id, transaction_time, created_at, amount_received, amount_spent, receiving_notes, spending_notes')
              .in('daily_report_id', dailyReportIds)
              .eq('bank_card_id', cardId)
          : Promise.resolve({ data: [] as any[] } as any),
      ]);

      const opMap = new Map<string, string>();
      (opRes.data || []).forEach((r: any) => opMap.set(r.id, r.payment_date || r.created_at));
      const drMap = new Map<string, string>();
      (drRes.data || []).forEach((r: any) => drMap.set(r.id, r.report_date));
      const staffRowsByReport = new Map<string, any[]>();
      (drsRes.data || []).forEach((r: any) => {
        const rows = staffRowsByReport.get(r.daily_report_id) || [];
        rows.push(r);
        staffRowsByReport.set(r.daily_report_id, rows);
      });

      const enriched = txs.map(t => {
        let effective: string | null = null;
        let displayReportTime: string | null = null;
        if (t.reference_type === 'order_payment' && t.reference_id) {
          effective = opMap.get(t.reference_id) || t.created_at;
          displayReportTime = effective;
        } else if (t.reference_type === 'daily_report_staff' && t.reference_id) {
          const sourceRows = staffRowsByReport.get(t.reference_id) || [];
          const matchedRow = sourceRows.find((row: any) => {
            const sourceAmount = t.transaction_type === 'deposit' ? row.amount_received : row.amount_spent;
            return Number(sourceAmount ?? 0) === Number(t.amount ?? 0);
          }) || sourceRows[0];
          // Prefer the explicit transaction_time recorded in the source row.
          // If it is missing, fall back to the transaction's own created_at
          // (which was set with the precise timestamp when the row was inserted),
          // NOT to a 00:00 default — that was the bug causing wrong display times.
          const built = buildDailyReportTime(drMap.get(t.reference_id) || t.report_date, matchedRow?.transaction_time);
          // Always use the daily_report's date (with the source transaction_time when present,
          // otherwise 00:00). Never fall back to the bank transaction's own created_at,
          // because that reflects when the row was inserted into the DB — not the actual
          // report date of the underlying staff transaction.
          effective = built || t.created_at;
          displayReportTime = effective;
        }
        if (!effective) effective = t.created_at;
        if (!displayReportTime) {
          displayReportTime = t.created_at;
        }
        return { ...t, effective_time: effective, display_report_time: displayReportTime } as BankCardTransaction;
      });

      // Ascending by effective time (oldest first, newest last)
      const sorted = enriched.sort((a, b) => {
        const tA = a.effective_time || a.created_at || '';
        const tB = b.effective_time || b.created_at || '';
        return tA.localeCompare(tB);
      });

      return sorted;
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
