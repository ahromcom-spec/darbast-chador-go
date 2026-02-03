import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Ruler, DollarSign, Save, Calculator, User, Phone, MapPin, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { parseOrderNotes } from './OrderDetailsView';
import { formatPersianDate } from '@/lib/dateUtils';

interface ExpertPricingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: {
    id: string;
    code: string;
    status: string;
    address: string;
    detailed_address: string | null;
    created_at: string;
    customer_name: string;
    customer_phone: string;
    notes: any;
    payment_amount: number | null;
  };
  onSuccess: () => void;
}

export function ExpertPricingDialog({ open, onOpenChange, order, onSuccess }: ExpertPricingDialogProps) {
  const [unitPrice, setUnitPrice] = useState('');
  const [totalPrice, setTotalPrice] = useState('');
  const [useUnitPrice, setUseUnitPrice] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const parsedNotes = parseOrderNotes(order.notes);
  const dimensions = parsedNotes?.dimensions || [];
  const description = parsedNotes?.description || '';

  // محاسبه حجم کل (طول × عرض × ارتفاع)
  const totalVolume = dimensions.reduce((sum: number, dim: any) => {
    const length = parseFloat(dim.length) || 0;
    const width = parseFloat(dim.width) || 0;
    const height = parseFloat(dim.height) || 0;
    return sum + (length * width * height);
  }, 0);

  // محاسبه قیمت کل از فی قیمت
  const calculatedTotalPrice = useUnitPrice && unitPrice 
    ? (parseFloat(unitPrice.replace(/,/g, '')) || 0) * totalVolume 
    : 0;

  // وقتی فی قیمت تغییر می‌کند، قیمت کل را آپدیت کن
  useEffect(() => {
    if (useUnitPrice && unitPrice) {
      const calculated = (parseFloat(unitPrice.replace(/,/g, '')) || 0) * totalVolume;
      setTotalPrice(Math.round(calculated).toString());
    }
  }, [unitPrice, useUnitPrice, totalVolume]);

  // وقتی order تغییر می‌کند، مقادیر را ریست کن
  useEffect(() => {
    if (open) {
      const existingUnitPrice = parsedNotes?.unit_price;
      const existingTotalPrice = order.payment_amount;
      
      if (existingUnitPrice) {
        setUnitPrice(existingUnitPrice.toString());
        setUseUnitPrice(true);
      } else {
        setUnitPrice('');
      }
      
      if (existingTotalPrice) {
        setTotalPrice(existingTotalPrice.toString());
      } else {
        setTotalPrice('');
      }
    }
  }, [open, order.id]);

  const formatNumber = (value: string) => {
    const numericValue = value.replace(/[^\d]/g, '');
    return numericValue ? parseInt(numericValue).toLocaleString('fa-IR') : '';
  };

  const handleUnitPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^\d]/g, '');
    setUnitPrice(value ? parseInt(value).toLocaleString('fa-IR') : '');
  };

  const handleTotalPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^\d]/g, '');
    setTotalPrice(value);
  };

  const handleSave = async () => {
    const finalPrice = useUnitPrice 
      ? calculatedTotalPrice 
      : (parseFloat(totalPrice.replace(/,/g, '')) || 0);

    if (finalPrice <= 0) {
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'لطفاً قیمت را وارد کنید'
      });
      return;
    }

    setSaving(true);
    try {
      const unitPriceValue = useUnitPrice 
        ? parseFloat(unitPrice.replace(/,/g, '')) || 0 
        : null;

      const updatedNotes = {
        ...parsedNotes,
        price_set_by_manager: true,
        manager_set_price: finalPrice,
        unit_price: unitPriceValue,
        pricing_method: useUnitPrice ? 'unit_price' : 'total_price',
        pricing_date: new Date().toISOString()
      };

      const { error } = await supabase
        .from('projects_v3')
        .update({
          payment_amount: finalPrice,
          notes: updatedNotes
        })
        .eq('id', order.id);

      if (error) throw error;

      toast({
        title: '✓ قیمت ثبت شد',
        description: `قیمت ${finalPrice.toLocaleString('fa-IR')} تومان برای سفارش ${order.code} ثبت شد`
      });

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      console.error('Error saving price:', err);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: err.message || 'خطا در ذخیره قیمت'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            تعیین قیمت سفارش {order.code}
          </DialogTitle>
          <DialogDescription>
            قیمت را بر اساس فی متر یا قیمت کلی تعیین کنید
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* اطلاعات مشتری */}
          <Card className="bg-muted/30">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{order.customer_name}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span dir="ltr">{order.customer_phone}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{order.address}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {formatPersianDate(order.created_at, { showDayOfWeek: true })}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* توضیحات سفارش */}
          {description && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
              <Label className="text-xs text-muted-foreground">توضیحات مشتری</Label>
              <p className="text-sm mt-1">{description}</p>
            </div>
          )}

          {/* ابعاد و متراژ */}
          {dimensions.length > 0 && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Ruler className="h-4 w-4 text-amber-600" />
                <Label className="text-sm font-medium">ابعاد درخواست شده</Label>
              </div>
              <div className="space-y-1">
                {dimensions.map((dim: any, idx: number) => {
                  const volume = (parseFloat(dim.length) || 0) * (parseFloat(dim.width) || 0) * (parseFloat(dim.height) || 0);
                  return (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span>
                        <Badge variant="outline" className="ml-2">{idx + 1}</Badge>
                        طول: {dim.length || '-'} × عرض: {dim.width || '-'} × ارتفاع: {dim.height || '-'}
                      </span>
                      <span className="text-muted-foreground">
                        {volume.toFixed(1)} متر مکعب
                      </span>
                    </div>
                  );
                })}
              </div>
              <Separator className="my-2" />
              <div className="flex items-center justify-between font-semibold text-primary">
                <span className="flex items-center gap-1">
                  <Calculator className="h-4 w-4" />
                  جمع کل حجم:
                </span>
                <span>{totalVolume.toFixed(1)} متر مکعب</span>
              </div>
            </div>
          )}

          <Separator />

          {/* انتخاب روش قیمت‌گذاری */}
          <div className="flex items-center justify-between">
            <Label className="text-sm">قیمت‌گذاری بر اساس فی متر</Label>
            <Switch 
              checked={useUnitPrice} 
              onCheckedChange={setUseUnitPrice}
            />
          </div>

          {useUnitPrice ? (
            <div className="space-y-4">
              {/* فی قیمت */}
              <div className="space-y-2">
                <Label htmlFor="unit-price" className="flex items-center gap-1">
                  <DollarSign className="h-4 w-4" />
                  فی قیمت (هر متر مربع)
                </Label>
                <div className="relative">
                  <Input
                    id="unit-price"
                    type="text"
                    inputMode="numeric"
                    value={unitPrice}
                    onChange={handleUnitPriceChange}
                    placeholder="مثال: ۵۰۰,۰۰۰"
                    className="pl-16 text-lg font-semibold"
                    autoFocus
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    تومان
                  </span>
                </div>
              </div>

              {/* نمایش محاسبه */}
              {totalVolume > 0 && unitPrice && (
                <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span>فی قیمت:</span>
                      <span>{unitPrice} تومان</span>
                    </div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span>حجم کل:</span>
                      <span>{totalVolume.toFixed(1)} متر مکعب</span>
                    </div>
                    <Separator className="my-2" />
                    <div className="flex items-center justify-between font-bold text-lg text-green-700 dark:text-green-400">
                      <span>قیمت کل:</span>
                      <span>{Math.round(calculatedTotalPrice).toLocaleString('fa-IR')} تومان</span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="total-price" className="flex items-center gap-1">
                <DollarSign className="h-4 w-4" />
                قیمت کل سفارش
              </Label>
              <div className="relative">
                <Input
                  id="total-price"
                  type="text"
                  inputMode="numeric"
                  value={totalPrice ? parseInt(totalPrice).toLocaleString('fa-IR') : ''}
                  onChange={handleTotalPriceChange}
                  placeholder="قیمت کل را وارد کنید"
                  className="pl-16 text-lg font-semibold"
                  autoFocus
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  تومان
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            انصراف
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? (
              <>در حال ذخیره...</>
            ) : (
              <>
                <Save className="h-4 w-4" />
                ثبت قیمت
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
