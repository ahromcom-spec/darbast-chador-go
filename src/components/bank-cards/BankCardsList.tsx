import { BankCard } from '@/hooks/useBankCards';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  CreditCard, 
  Edit, 
  Trash2, 
  History, 
  ToggleLeft, 
  ToggleRight,
  Building2,
  Calendar
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { format } from 'date-fns-jalali';

interface BankCardsListProps {
  cards: BankCard[];
  loading: boolean;
  onEdit: (card: BankCard) => void;
  onDelete: (id: string) => Promise<boolean>;
  onToggleStatus: (id: string, isActive: boolean) => Promise<boolean>;
  onViewTransactions: (card: BankCard) => void;
}

export function BankCardsList({
  cards,
  loading,
  onEdit,
  onDelete,
  onToggleStatus,
  onViewTransactions,
}: BankCardsListProps) {
  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="overflow-hidden">
            <CardContent className="p-4">
              <Skeleton className="h-6 w-32 mb-3" />
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <CreditCard className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-semibold mb-2">کارتی ثبت نشده</h3>
          <p className="text-muted-foreground">
            برای شروع، یک کارت بانکی جدید ثبت کنید.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <Card
          key={card.id}
          className={`overflow-hidden transition-all ${
            card.is_active
              ? 'border-emerald-200 bg-gradient-to-br from-white to-emerald-50/50 dark:from-gray-950 dark:to-emerald-950/20'
              : 'opacity-60 bg-muted/50'
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <CreditCard className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-semibold">{card.card_name}</h3>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Building2 className="h-3 w-3" />
                    {card.bank_name}
                  </div>
                </div>
              </div>
              <Badge variant={card.is_active ? 'default' : 'secondary'}>
                {card.is_active ? 'فعال' : 'غیرفعال'}
              </Badge>
            </div>

            {card.card_number && (
              <div className="mb-2 text-sm text-muted-foreground font-mono" dir="ltr">
                •••• {card.card_number.slice(-4)}
              </div>
            )}

            <div className="mb-3">
              <div className="text-xs text-muted-foreground mb-1">موجودی فعلی</div>
              <div className="text-xl font-bold text-emerald-600">
                {card.current_balance.toLocaleString('fa-IR')} تومان
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
              <Calendar className="h-3 w-3" />
              تاریخ ثبت: {format(new Date(card.registration_date), 'yyyy/MM/dd')}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(card)}
                className="gap-1"
              >
                <Edit className="h-3 w-3" />
                ویرایش
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => onViewTransactions(card)}
                className="gap-1"
              >
                <History className="h-3 w-3" />
                تراکنش‌ها
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => onToggleStatus(card.id, !card.is_active)}
                className="gap-1"
              >
                {card.is_active ? (
                  <>
                    <ToggleRight className="h-3 w-3" />
                    غیرفعال
                  </>
                ) : (
                  <>
                    <ToggleLeft className="h-3 w-3" />
                    فعال
                  </>
                )}
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-destructive gap-1">
                    <Trash2 className="h-3 w-3" />
                    حذف
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>حذف کارت بانکی</AlertDialogTitle>
                    <AlertDialogDescription>
                      آیا از حذف کارت "{card.card_name}" مطمئن هستید؟ این عملیات قابل برگشت نیست.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>انصراف</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onDelete(card.id)}
                      className="bg-destructive text-destructive-foreground"
                    >
                      حذف
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
