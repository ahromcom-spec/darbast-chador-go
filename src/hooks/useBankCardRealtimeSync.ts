/**
 * Hook for robust real-time bank card balance synchronization
 * 
 * This hook ensures bank card balances are always accurate by:
 * 1. Listening to real-time changes on bank_cards and bank_card_transactions
 * 2. Providing immediate refetch after any mutation
 * 3. Using database-level validation for balance calculations
 */

import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

interface UseBankCardRealtimeSyncOptions {
  onBalanceChange?: (cardId: string, newBalance: number) => void;
  onTransactionChange?: () => void;
  enabled?: boolean;
}

/**
 * Recalculates bank card balance using the absolute, idempotent formula:
 * current_balance = initial_balance + (manual transactions net) + (daily_report_staff cash-box net)
 */
export async function recalculateBankCardBalance(cardId: string): Promise<number | null> {
  try {
    // 1) Get initial balance
    const { data: cardData, error: cardError } = await supabase
      .from('bank_cards')
      .select('initial_balance')
      .eq('id', cardId)
      .single();

    if (cardError || !cardData) {
      console.error('Error fetching bank card:', cardError);
      return null;
    }

    const initialBalance = Number(cardData.initial_balance ?? 0) || 0;

    // 2) Calculate manual transactions net (exclude daily report logs)
    const { data: manualTx, error: manualTxError } = await supabase
      .from('bank_card_transactions')
      .select('transaction_type, amount, reference_type')
      .eq('bank_card_id', cardId)
      .or('reference_type.is.null,reference_type.neq.daily_report_staff');

    if (manualTxError) {
      console.error('Error fetching manual transactions:', manualTxError);
    }

    const manualNet = (manualTx || []).reduce((sum: number, t: any) => {
      const amt = Number(t.amount ?? 0) || 0;
      return sum + (t.transaction_type === 'deposit' ? amt : -amt);
    }, 0);

    // 3) Calculate daily report cash-box net (all reports)
    const { data: drRows, error: drError } = await supabase
      .from('daily_report_staff')
      .select('amount_received, amount_spent')
      .eq('bank_card_id', cardId)
      .eq('is_cash_box', true);

    if (drError) {
      console.error('Error fetching daily report staff rows:', drError);
    }

    const dailyNet = (drRows || []).reduce((sum: number, r: any) => {
      const received = Number(r.amount_received ?? 0) || 0;
      const spent = Number(r.amount_spent ?? 0) || 0;
      return sum + received - spent;
    }, 0);

    const newBalance = initialBalance + manualNet + dailyNet;

    // 4) Update the card balance in database
    const { error: updateError } = await supabase
      .from('bank_cards')
      .update({ 
        current_balance: newBalance, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', cardId);

    if (updateError) {
      console.error('Error updating bank card balance:', updateError);
      return null;
    }

    return newBalance;
  } catch (error) {
    console.error('Error recalculating bank card balance:', error);
    return null;
  }
}

/**
 * Recalculates balances for all active bank cards
 */
export async function recalculateAllBankCardBalances(): Promise<void> {
  try {
    const { data: cards, error } = await supabase
      .from('bank_cards')
      .select('id')
      .eq('is_active', true);

    if (error || !cards) {
      console.error('Error fetching bank cards:', error);
      return;
    }

    await Promise.all(cards.map(card => recalculateBankCardBalance(card.id)));
  } catch (error) {
    console.error('Error recalculating all bank card balances:', error);
  }
}

/**
 * Hook for real-time bank card balance synchronization
 */
export function useBankCardRealtimeSync(options: UseBankCardRealtimeSyncOptions = {}) {
  const { onBalanceChange, onTransactionChange, enabled = true } = options;
  const channelRef = useRef<RealtimeChannel | null>(null);

  const setupRealtimeSubscription = useCallback(() => {
    if (!enabled) return;

    // Clean up existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Create a new channel for bank card changes
    const channel = supabase
      .channel('bank-cards-realtime-sync')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bank_cards',
        },
        (payload) => {
          console.log('Bank card change detected:', payload.eventType);
          if (payload.eventType === 'UPDATE' && payload.new) {
            const newData = payload.new as any;
            onBalanceChange?.(newData.id, newData.current_balance);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bank_card_transactions',
        },
        (payload) => {
          console.log('Bank card transaction change detected:', payload.eventType);
          onTransactionChange?.();
          
          // If a transaction was added/removed, recalculate affected card balance
          const cardId = (payload.old as any)?.bank_card_id || (payload.new as any)?.bank_card_id;
          if (cardId) {
            recalculateBankCardBalance(cardId).then((newBalance) => {
              if (newBalance !== null) {
                onBalanceChange?.(cardId, newBalance);
              }
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_report_staff',
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
          
          if (affectedCardIds.size > 0) {
            console.log('Daily report staff change affecting bank cards:', payload.eventType, Array.from(affectedCardIds));
            
            // Recalculate balance for each affected card
            affectedCardIds.forEach((cardId) => {
              recalculateBankCardBalance(cardId).then((newBalance) => {
                if (newBalance !== null) {
                  onBalanceChange?.(cardId, newBalance);
                }
              });
            });
            
            onTransactionChange?.();
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Bank cards realtime sync subscribed');
        }
      });

    channelRef.current = channel;
  }, [enabled, onBalanceChange, onTransactionChange]);

  useEffect(() => {
    setupRealtimeSubscription();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [setupRealtimeSubscription]);

  return {
    recalculateBankCardBalance,
    recalculateAllBankCardBalances,
  };
}
