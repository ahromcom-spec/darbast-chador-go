import { useState, useEffect, useCallback, useRef } from 'react';
import { ModuleLayout } from '@/components/layouts/ModuleLayout';
import { BankCardsList } from '@/components/bank-cards/BankCardsList';
import { BankCardForm } from '@/components/bank-cards/BankCardForm';
import { BankCardTransactions } from '@/components/bank-cards/BankCardTransactions';
import { useBankCards, BankCard } from '@/hooks/useBankCards';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreditCard, History, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { recalculateAllBankCardBalances } from '@/hooks/useBankCardRealtimeSync';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function BankCardsModule() {
  const { cards, loading, saving, createCard, updateCard, deleteCard, toggleCardStatus, getCardTransactions, fetchCards } = useBankCards();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<BankCard | null>(null);
  const [viewingCard, setViewingCard] = useState<BankCard | null>(null);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Setup realtime subscription for daily_report_staff changes
  useEffect(() => {
    const channel = supabase
      .channel('bank-cards-module-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_report_staff'
        },
        (payload) => {
          // Only process changes that affect bank cards
          const oldData = payload.old as any;
          const newData = payload.new as any;
          
          if ((oldData?.bank_card_id && oldData?.is_cash_box) || 
              (newData?.bank_card_id && newData?.is_cash_box)) {
            // Refetch cards to get updated balances
            fetchCards();
          }
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

  const handleCreate = async (data: any) => {
    const result = await createCard(data);
    if (result) {
      setIsFormOpen(false);
    }
  };

  const handleUpdate = async (data: any) => {
    if (!editingCard) return;
    const result = await updateCard(editingCard.id, data);
    if (result) {
      setEditingCard(null);
    }
  };

  const handleEdit = (card: BankCard) => {
    setEditingCard(card);
  };

  const handleViewTransactions = (card: BankCard) => {
    setViewingCard(card);
  };

  // Manual recalculation of all balances
  const handleRecalculateAll = async () => {
    setIsRecalculating(true);
    try {
      await recalculateAllBankCardBalances();
      await fetchCards();
      toast.success('موجودی تمام کارت‌ها بازمحاسبه شد');
    } catch (error) {
      console.error('Error recalculating balances:', error);
      toast.error('خطا در بازمحاسبه موجودی');
    } finally {
      setIsRecalculating(false);
    }
  };

  return (
    <ModuleLayout
      defaultModuleKey="bank_cards"
      defaultTitle="ماژول ثبت کارت حساب بانکی"
      defaultDescription="مدیریت کارت‌های بانکی و پیگیری موجودی"
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <CreditCard className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold">کارت‌های بانکی</h2>
              <p className="text-sm text-muted-foreground">
                مدیریت و پیگیری کارت‌های حساب بانکی شرکت
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              onClick={handleRecalculateAll}
              disabled={isRecalculating}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isRecalculating ? 'animate-spin' : ''}`} />
              بازمحاسبه موجودی
            </Button>
            <Button onClick={() => setIsFormOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              ثبت کارت جدید
            </Button>
          </div>
        </div>

        <Tabs defaultValue="cards" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="cards" className="gap-2">
              <CreditCard className="h-4 w-4" />
              کارت‌ها
            </TabsTrigger>
            <TabsTrigger value="summary" className="gap-2">
              <History className="h-4 w-4" />
              خلاصه موجودی
            </TabsTrigger>
          </TabsList>

          <TabsContent value="cards" className="mt-6">
            <BankCardsList
              cards={cards}
              loading={loading}
              onEdit={handleEdit}
              onDelete={deleteCard}
              onToggleStatus={toggleCardStatus}
              onViewTransactions={handleViewTransactions}
            />
          </TabsContent>

          <TabsContent value="summary" className="mt-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cards.filter(c => c.is_active).map((card) => (
                <div
                  key={card.id}
                  className="p-4 rounded-xl border bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold">{card.card_name}</span>
                    <span className="text-xs text-muted-foreground">{card.bank_name}</span>
                  </div>
                  <div className="text-2xl font-bold text-emerald-600">
                    {card.current_balance.toLocaleString('fa-IR')} تومان
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    موجودی اولیه: {card.initial_balance.toLocaleString('fa-IR')} تومان
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 rounded-xl bg-primary/5 border">
              <div className="flex items-center justify-between">
                <span className="font-semibold">جمع کل موجودی کارت‌های فعال:</span>
                <span className="text-2xl font-bold text-primary">
                  {cards
                    .filter(c => c.is_active)
                    .reduce((sum, c) => sum + c.current_balance, 0)
                    .toLocaleString('fa-IR')}{' '}
                  تومان
                </span>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Create Dialog */}
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>ثبت کارت بانکی جدید</DialogTitle>
            </DialogHeader>
            <BankCardForm
              onSubmit={handleCreate}
              onCancel={() => setIsFormOpen(false)}
              saving={saving}
            />
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={!!editingCard} onOpenChange={(open) => !open && setEditingCard(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>ویرایش کارت بانکی</DialogTitle>
            </DialogHeader>
            {editingCard && (
              <BankCardForm
                initialData={editingCard}
                onSubmit={handleUpdate}
                onCancel={() => setEditingCard(null)}
                saving={saving}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Transactions Dialog */}
        <Dialog open={!!viewingCard} onOpenChange={(open) => !open && setViewingCard(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                تراکنش‌های کارت: {viewingCard?.card_name}
              </DialogTitle>
            </DialogHeader>
            {viewingCard && (
              <BankCardTransactions
                card={viewingCard}
                getTransactions={getCardTransactions}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </ModuleLayout>
  );
}
