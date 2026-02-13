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
import { recalculateBankCardBalance } from '@/hooks/useBankCardRealtimeSync';

const NONE_VALUE = '__none__';

interface BankCard {
  id: string;
  card_name: string;
  bank_name: string;
  current_balance: number;
}

interface BankCardSelectProps {
  value: string | null;
  onValueChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  showBalance?: boolean;
  /** When true, cards with "مدیریت" in their name are included. Default false (hidden). */
  showManagementCards?: boolean;
  /** When true, ONLY cards with "مدیریت" in their name are shown. Overrides showManagementCards. */
  onlyManagementCards?: boolean;
}

export function BankCardSelect({
  value,
  onValueChange,
  placeholder = 'انتخاب کارت بانکی',
  disabled = false,
  showBalance = true,
  showManagementCards = false,
  onlyManagementCards = false,
}: BankCardSelectProps) {
  const [cards, setCards] = useState<BankCard[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const isFetchingRef = useRef(false);

  const fetchCards = useCallback(async () => {
    // Prevent concurrent fetches
    if (isFetchingRef.current) return;
    
    try {
      isFetchingRef.current = true;
      const { data, error } = await supabase
        .from('bank_cards')
        .select('id, card_name, bank_name, current_balance')
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

  // Update a single card's balance in state without refetching all
  const updateCardBalance = useCallback((cardId: string, newBalance: number) => {
    setCards((prev) =>
      prev.map((card) =>
        card.id === cardId ? { ...card, current_balance: newBalance } : card
      )
    );
  }, []);

  useEffect(() => {
    fetchCards();

    // Subscribe to realtime changes on bank_cards table
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
          // Update specific card balance if it's an UPDATE
          if (payload.eventType === 'UPDATE' && payload.new) {
            const newData = payload.new as any;
            updateCardBalance(newData.id, newData.current_balance);
          } else {
            // For INSERT/DELETE, refetch all
            fetchCards();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_report_staff'
        },
        (payload) => {
          // Only process changes that affect bank cards (cash box rows)
          const oldData = payload.old as any;
          const newData = payload.new as any;
          
          const affectedCardIds = new Set<string>();
          
          if (oldData?.bank_card_id && oldData?.is_cash_box) {
            affectedCardIds.add(oldData.bank_card_id);
          }
          if (newData?.bank_card_id && newData?.is_cash_box) {
            affectedCardIds.add(newData.bank_card_id);
          }
          
          // Recalculate balance for each affected card
          affectedCardIds.forEach((cardId) => {
            recalculateBankCardBalance(cardId).then((newBalance) => {
              if (newBalance !== null) {
                updateCardBalance(cardId, newBalance);
              }
            });
          });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [fetchCards, updateCardBalance]);

  // Filter cards: hide management cards unless explicitly allowed
  const filteredCards = useMemo(() => {
    if (onlyManagementCards) return cards.filter(card => card.card_name.includes('مدیریت'));
    if (showManagementCards) return cards;
    return cards.filter(card => !card.card_name.includes('مدیریت'));
  }, [cards, showManagementCards, onlyManagementCards]);

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
          {value && (
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-emerald-600" />
              <span>{cards.find(c => c.id === value)?.card_name || placeholder}</span>
              {showBalance && (
                <span className={cn(
                  "text-xs font-medium",
                  (cards.find(c => c.id === value)?.current_balance || 0) >= 0 
                    ? "text-emerald-600" 
                    : "text-red-600"
                )}>
                  {(cards.find(c => c.id === value)?.current_balance || 0).toLocaleString('fa-IR')} تومان
                </span>
              )}
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE_VALUE}>
          <span className="text-muted-foreground">بدون کارت</span>
        </SelectItem>
        {filteredCards.map((card) => (
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
                  card.current_balance >= 0 ? "text-emerald-600" : "text-red-600"
                )}>
                  {card.current_balance.toLocaleString('fa-IR')} تومان
                </span>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
