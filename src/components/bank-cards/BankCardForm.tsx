import { useState } from 'react';
import { BankCard, CreateBankCardData } from '@/hooks/useBankCards';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PersianDatePicker } from '@/components/ui/persian-date-picker';
import { Loader2 } from 'lucide-react';

interface BankCardFormProps {
  initialData?: BankCard;
  onSubmit: (data: CreateBankCardData) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

export function BankCardForm({ initialData, onSubmit, onCancel, saving }: BankCardFormProps) {
  const [formData, setFormData] = useState<CreateBankCardData>({
    card_name: initialData?.card_name || '',
    bank_name: initialData?.bank_name || '',
    card_number: initialData?.card_number || '',
    initial_balance: initialData?.initial_balance || 0,
    registration_date: initialData?.registration_date || new Date().toISOString().split('T')[0],
    notes: initialData?.notes || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.card_name.trim()) {
      return;
    }
    if (!formData.bank_name.trim()) {
      return;
    }

    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="card_name">نام کارت *</Label>
          <Input
            id="card_name"
            value={formData.card_name}
            onChange={(e) => setFormData({ ...formData, card_name: e.target.value })}
            placeholder="مثال: کارت اصلی شرکت"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="bank_name">نام بانک *</Label>
          <Input
            id="bank_name"
            value={formData.bank_name}
            onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
            placeholder="مثال: ملت"
            required
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="card_number">شماره کارت (اختیاری)</Label>
          <Input
            id="card_number"
            value={formData.card_number}
            onChange={(e) => setFormData({ ...formData, card_number: e.target.value })}
            placeholder="۱۶ رقم"
            maxLength={16}
            dir="ltr"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="initial_balance">موجودی اولیه (تومان) *</Label>
          <Input
            id="initial_balance"
            type="number"
            value={formData.initial_balance}
            onChange={(e) => setFormData({ ...formData, initial_balance: Number(e.target.value) })}
            placeholder="0"
            min={0}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="registration_date">تاریخ ثبت کارت *</Label>
        <PersianDatePicker
          value={formData.registration_date ? new Date(formData.registration_date).toISOString() : undefined}
          onChange={(isoString) => {
            const date = new Date(isoString);
            setFormData({ ...formData, registration_date: date.toISOString().split('T')[0] });
          }}
          placeholder="انتخاب تاریخ ثبت"
          timeMode="none"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">توضیحات (اختیاری)</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="توضیحات اضافی..."
          rows={3}
        />
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          انصراف
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
          {initialData ? 'بروزرسانی' : 'ثبت کارت'}
        </Button>
      </div>
    </form>
  );
}
