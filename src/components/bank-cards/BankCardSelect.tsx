import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';


const NONE_VALUE = '__none__';

interface BankCard {
  id: string;
  card_name: string;
  bank_name: string;
  current_balance: number;
  initial_balance?: number;
}

interface BankCardSelectProps {
  value: string | null;
  onValueChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  showBalance?: boolean;
  showManagementCards?: boolean;
  onlyManagementCards?: boolean;
  allowedCardIds?: string[];
  /** When provided, show balance as of this date (YYYY-MM-DD) instead of current balance */
  asOfDate?: string;
}

/**
 * Calculate historical balance for a card as of a specific date.
 * Uses bank_card_transactions (single source of truth) with report_date <= asOfDate.
 */
async function getHistoricalBalance(cardId: string, asOfDate: string, initialBalance: number): Promise<number> {
  // 1) Manual transactions net (exclude daily report logs)
  const { data: manualTx } = await supabase
    .from('bank_card_transactions')
    .select('transaction_type, amount, reference_type')
    .eq('bank_card_id', cardId)
    .lte('report_date', asOfDate)
    .or('reference_type.is.null,reference_type.neq.daily_report_staff');

  const manualNet = (manualTx || []).reduce((sum, t) => {
    const amt = Number(t.amount ?? 0) || 0;
    return sum + (t.transaction_type === 'deposit' ? amt : -amt);
  }, 0);

  // 2) Daily report cash-box net (filter by report date via daily_reports join)
  const { data: reports } = await supabase
    .from('daily_reports')
    .select('id')
    .lte('report_date', asOfDate);

  let dailyNet = 0;
  if (reports && reports.length > 0) {
    const reportIds = reports.map(r => r.id);
    const { data: drRows } = await supabase
      .from('daily_report_staff')
      .select('amount_received, amount_spent')
      .eq('bank_card_id', cardId)
      .eq('is_cash_box', true)
      .in('daily_report_id', reportIds);

    dailyNet = (drRows || []).reduce((sum, r) => {
      const received = Number(r.amount_received ?? 0) || 0;
      const spent = Number(r.amount_spent ?? 0) || 0;
      return sum + received - spent;
    }, 0);
  }

  return initialBalance + manualNet + dailyNet;
}

export function BankCardSelect({
  value,
  onValueChange,
  placeholder = 'انتخاب کارت بانکی',
  disabled = false,
  showBalance = true,
  showManagementCards = false,
  onlyManagementCards = false,
  allowedCardIds,
  asOfDate,
}: BankCardSelectProps) {
  const [cards, setCards] = useState<BankCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [historicalBalances, setHistoricalBalances] = useState<Record<string, number>>({});
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const isFetchingRef = useRef(false);

  const fetchCards = useCallback(async () => {
    if (isFetchingRef.current) return;
    
    try {
      isFetchingRef.current = true;
      const { data, error } = await supabase
        .from('bank_cards')
        .select('id, card_name, bank_name, current_balance, initial_balance')
        .eq('is_active', true)
        .order('card_name');

      if (error) throw error;
      setCards((data || []) as BankCard[]);
    } catch (error) {
      console.error('Error fetching bank cards:', error);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  // Calculate historical balances when asOfDate changes
  useEffect(() => {
    if (!asOfDate || cards.length === 0) {
      setHistoricalBalances({});
      return;
    }

    let cancelled = false;
    const calcAll = async () => {
      const balances: Record<string, number> = {};
      for (const card of cards) {
        balances[card.id] = await getHistoricalBalance(card.id, asOfDate, card.initial_balance || 0);
      }
      if (!cancelled) setHistoricalBalances(balances);
    };
    calcAll();
    return () => { cancelled = true; };
  }, [asOfDate, cards]);

  const getDisplayBalance = useCallback((card: BankCard) => {
    if (asOfDate && historicalBalances[card.id] !== undefined) {
      return historicalBalances[card.id];
    }
    return card.current_balance;
  }, [asOfDate, historicalBalances]);

  const updateCardBalance = useCallback((cardId: string, newBalance: number) => {
    setCards((prev) =>
      prev.map((card) =>
        card.id === cardId ? { ...card, current_balance: newBalance } : card
      )
    );
  }, []);

  useEffect(() => {
    fetchCards();

    const handleBalanceUpdated = () => { fetchCards(); };
    window.addEventListener('bank-card-balance-updated', handleBalanceUpdated);

    const channel = supabase
      .channel('bank-cards-select-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bank_cards'
        },
        (payload) => {
          if (payload.eventType === 'UPDATE' && payload.new) {
            const newData = payload.new as any;
            updateCardBalance(newData.id, newData.current_balance);
          } else {
            fetchCards();
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      window.removeEventListener('bank-card-balance-updated', handleBalanceUpdated);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [fetchCards, updateCardBalance]);

  const filteredCards = useMemo(() => {
    if (allowedCardIds && allowedCardIds.length > 0) return cards.filter(card => allowedCardIds.includes(card.id));
    if (onlyManagementCards) return cards.filter(card => card.card_name.includes('مدیریت'));
    if (showManagementCards) return cards;
    return cards.filter(card => !card.card_name.includes('مدیریت'));
  }, [cards, showManagementCards, onlyManagementCards, allowedCardIds]);

  if (loading) {
    return (
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder="در حال بارگذاری..." />
        </SelectTrigger>
      </Select>
    );
  }

  if (filteredCards.length === 0) {
    return (
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder="کارتی ثبت نشده" />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <Select
      value={value ?? undefined}
      onValueChange={(v) => onValueChange(v === NONE_VALUE ? null : v)}
      disabled={disabled}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder}>
          {value && (() => {
            const selectedCard = cards.find(c => c.id === value);
            const displayBal = selectedCard ? getDisplayBalance(selectedCard) : 0;
            return (
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-emerald-600" />
                <span>{selectedCard?.card_name || placeholder}</span>
                {showBalance && (
                  <span className={cn(
                    "text-xs font-medium",
                    displayBal >= 0 ? "text-emerald-600" : "text-red-600"
                  )}>
                    {displayBal.toLocaleString('fa-IR')} تومان
                  </span>
                )}
              </div>
            );
          })()}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE_VALUE}>
          <span className="text-muted-foreground">بدون کارت</span>
        </SelectItem>
        {filteredCards.map((card) => {
          const displayBal = getDisplayBalance(card);
          return (
            <SelectItem key={card.id} value={card.id}>
              <div className="flex items-center justify-between gap-4 w-full">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-emerald-600" />
                  <span>{card.card_name}</span>
                  <span className="text-xs text-muted-foreground">({card.bank_name})</span>
                </div>
                {showBalance && (
                  <span className={cn(
                    "text-xs font-medium",
                    displayBal >= 0 ? "text-emerald-600" : "text-red-600"
                  )}>
                    موجودی: {displayBal.toLocaleString('fa-IR')} تومان
                  </span>
                )}
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
