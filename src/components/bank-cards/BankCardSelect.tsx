import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CreditCard, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

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
}

export function BankCardSelect({
  value,
  onValueChange,
  placeholder = 'انتخاب کارت بانکی',
  disabled = false,
  showBalance = true,
}: BankCardSelectProps) {
  const [cards, setCards] = useState<BankCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchCards = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setIsRefreshing(true);
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
      if (showRefresh) setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCards();

    // Subscribe to realtime changes on bank_cards table
    const channel = supabase
      .channel('bank-cards-balance-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bank_cards'
        },
        () => {
          // Refetch cards when any change occurs
          fetchCards();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [fetchCards]);

  if (loading) {
    return (
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder="در حال بارگذاری..." />
        </SelectTrigger>
      </Select>
    );
  }

  if (cards.length === 0) {
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
        {cards.map((card) => (
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
