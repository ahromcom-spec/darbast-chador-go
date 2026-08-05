import { useEffect, useState } from 'react';
import { Star, Loader2, CheckCircle2, Pencil, UserX } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { formatPersianDate } from '@/lib/dateUtils';

const AHROM_CONTRACTOR_LABEL = 'پیمانکاری اهرم';
const AHROM_MANAGEMENT_LABEL = 'مدیریت و پیگیری اهرم';

interface OrderRatingSectionProps {
  orderId: string;
}

interface RatingRow {
  id: string;
  contractor_score: number | null;
  contractor_comment: string | null;
  contractor_target_label: string;
  management_score: number | null;
  management_comment: string | null;
  management_target_label: string;
  is_anonymous: boolean | null;
  updated_at: string;
}

function StarPicker({
  value,
  onChange,
  readOnly,
}: {
  value: number;
  onChange?: (v: number) => void;
  readOnly?: boolean;
}) {
  const [hover, setHover] = useState(0);
  const active = hover || value;

  return (
    <div className="flex items-center gap-1" dir="ltr">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(n)}
          onMouseEnter={() => !readOnly && setHover(n)}
          onMouseLeave={() => !readOnly && setHover(0)}
          className={readOnly ? 'cursor-default' : 'transition-transform hover:scale-110'}
          aria-label={`${n} ستاره`}
        >
          <Star
            className={`h-8 w-8 ${
              n <= active ? 'fill-yellow-500 text-yellow-500' : 'text-muted-foreground/40'
            }`}
          />
        </button>
      ))}
      {value > 0 && (
        <span className="ms-2 text-sm font-bold text-yellow-600">{value} / 5</span>
      )}
    </div>
  );
}

export default function OrderRatingSection({ orderId }: OrderRatingSectionProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [existing, setExisting] = useState<RatingRow | null>(null);

  const [contractorScore, setContractorScore] = useState(0);
  const [contractorComment, setContractorComment] = useState('');
  const [managementScore, setManagementScore] = useState(0);
  const [managementComment, setManagementComment] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);

  const [contractorLabel, setContractorLabel] = useState(AHROM_CONTRACTOR_LABEL);
  const [contractorTargetId, setContractorTargetId] = useState<string | null>(null);

  // تعیین مقصد امتیاز عملکرد اجرایی: پیمانکار سفارش یا خود اهرم
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: orderData } = await supabase
        .from('projects_v3')
        .select('contractor_id')
        .eq('id', orderId)
        .maybeSingle();

      if (cancelled) return;

      if (orderData?.contractor_id) {
        const { data: contractor } = await supabase
          .from('contractors')
          .select('user_id, company_name')
          .eq('id', orderData.contractor_id)
          .maybeSingle();

        if (cancelled) return;
        if (contractor) {
          setContractorTargetId((contractor as any).user_id ?? null);
          setContractorLabel(
            (contractor as any).company_name || AHROM_CONTRACTOR_LABEL
          );
          return;
        }
      }

      setContractorTargetId(null);
      setContractorLabel(AHROM_CONTRACTOR_LABEL);
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const loadRating = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('order_ratings')
      .select('*')
      .eq('order_id', orderId)
      .eq('rater_id', user.id)
      .maybeSingle();

    const row = (data as RatingRow | null) || null;
    setExisting(row);
    if (row) {
      setContractorScore(row.contractor_score || 0);
      setContractorComment(row.contractor_comment || '');
      setManagementScore(row.management_score || 0);
      setManagementComment(row.management_comment || '');
      setIsAnonymous(!!row.is_anonymous);
      setEditing(false);
    } else {
      setEditing(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadRating();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, user?.id]);

  const handleSave = async () => {
    if (!user?.id) return;
    if (!contractorScore && !managementScore) {
      toast({
        title: 'امتیازی انتخاب نشده',
        description: 'لطفا حداقل یکی از دو امتیاز را مشخص کنید.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    const payload = {
      order_id: orderId,
      rater_id: user.id,
      contractor_score: contractorScore || null,
      contractor_comment: contractorComment.trim() || null,
      contractor_target_id: contractorTargetId,
      contractor_target_label: contractorLabel,
      management_score: managementScore || null,
      management_comment: managementComment.trim() || null,
      management_target_id: null,
      management_target_label: AHROM_MANAGEMENT_LABEL,
      is_anonymous: isAnonymous,
    };

    const { error } = await supabase
      .from('order_ratings')
      .upsert(payload as any, { onConflict: 'order_id,rater_id' });

    setSaving(false);

    if (error) {
      console.error('Error saving order rating:', error);
      toast({
        title: 'خطا در ثبت امتیاز',
        description: 'ثبت امتیاز انجام نشد. لطفا مجددا تلاش کنید.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: '✓ امتیاز شما در سایت ثبت شد',
      description: 'امتیاز شما ذخیره شد و در هر زمان قابل ویرایش است.',
    });
    await loadRating();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-yellow-200">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            امتیازدهی به سفارش
          </span>
          {existing && !editing && (
            <Badge variant="outline" className="gap-1 text-green-700 border-green-300">
              <CheckCircle2 className="h-3.5 w-3.5" />
              ثبت شده در سایت
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-muted-foreground">
          لطفا تجربه خود از این سفارش را در دو بخش زیر با ما به اشتراک بگذارید.
        </p>

        {/* آیتم اول: عملکرد پیمانکار و اجرایی */}
        <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-semibold text-sm">۱. عملکرد پیمانکار و اجرایی</h4>
            <Badge variant="secondary" className="text-xs">{contractorLabel}</Badge>
          </div>
          <StarPicker
            value={contractorScore}
            onChange={setContractorScore}
            readOnly={!editing}
          />
          {editing ? (
            <Textarea
              value={contractorComment}
              onChange={(e) => setContractorComment(e.target.value)}
              placeholder="توضیحات شما درباره عملکرد پیمانکار و اجرای کار (اختیاری)"
              rows={3}
            />
          ) : (
            contractorComment && (
              <p className="text-sm text-muted-foreground whitespace-pre-line">
                {contractorComment}
              </p>
            )
          )}
        </div>

        {/* آیتم دوم: مدیریت، پیگیری و زمانبندی سفارش */}
        <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-semibold text-sm">۲. مدیریت، پیگیری و زمان‌بندی سفارش</h4>
            <Badge variant="secondary" className="text-xs">{AHROM_MANAGEMENT_LABEL}</Badge>
          </div>
          <StarPicker
            value={managementScore}
            onChange={setManagementScore}
            readOnly={!editing}
          />
          {editing ? (
            <Textarea
              value={managementComment}
              onChange={(e) => setManagementComment(e.target.value)}
              placeholder="توضیحات شما درباره مدیریت، پیگیری و زمان‌بندی سفارش (اختیاری)"
              rows={3}
            />
          ) : (
            managementComment && (
              <p className="text-sm text-muted-foreground whitespace-pre-line">
                {managementComment}
              </p>
            )
          )}
        </div>

        {/* امتیازدهی ناشناس */}
        {editing ? (
          <div className="flex items-start gap-2 p-3 rounded-lg border border-dashed bg-muted/20">
            <Checkbox
              id="rating-anonymous"
              checked={isAnonymous}
              onCheckedChange={(v) => setIsAnonymous(v === true)}
              className="mt-0.5"
            />
            <div className="space-y-1">
              <Label htmlFor="rating-anonymous" className="flex items-center gap-1.5 cursor-pointer text-sm font-medium">
                <UserX className="h-4 w-4 text-muted-foreground" />
                امتیازدهی به صورت ناشناس
              </Label>
              <p className="text-xs text-muted-foreground">
                با فعال کردن این گزینه، نام شما در امتیاز ثبت‌شده برای پیمانکار و پرسنل نمایش داده نمی‌شود.
              </p>
            </div>
          </div>
        ) : (
          isAnonymous && (
            <Badge variant="outline" className="gap-1 text-xs">
              <UserX className="h-3.5 w-3.5" />
              این امتیاز به صورت ناشناس ثبت شده است
            </Badge>
          )
        )}

        {existing && !editing && (
          <p className="text-xs text-muted-foreground">
            آخرین ویرایش: {formatPersianDate(existing.updated_at, { showDayOfWeek: true })}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {editing ? (
            <>
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
                {existing ? 'ذخیره ویرایش امتیاز' : 'ثبت امتیاز'}
              </Button>
              {existing && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setContractorScore(existing.contractor_score || 0);
                    setContractorComment(existing.contractor_comment || '');
                    setManagementScore(existing.management_score || 0);
                    setManagementComment(existing.management_comment || '');
                    setIsAnonymous(!!existing.is_anonymous);
                    setEditing(false);
                  }}
                  disabled={saving}
                >
                  انصراف
                </Button>
              )}
            </>
          ) : (
            <Button variant="outline" onClick={() => setEditing(true)} className="gap-2">
              <Pencil className="h-4 w-4" />
              ویرایش امتیاز
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
