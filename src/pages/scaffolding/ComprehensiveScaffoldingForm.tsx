import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/common/PageHeader';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Dimension {
  length: string;
  width: string;
  height: string;
}

interface ComprehensiveScaffoldingFormProps {
  projectId?: string;
  hideAddressField?: boolean;
  prefilledAddress?: string;
}

const schema = z.object({
  service_type: z.enum(['facade', 'formwork']).default('facade'),
  dimensions: z.array(
    z.object({
      length: z.string().trim().min(1),
      width: z.string().trim().min(1),
      height: z.string().trim().min(1),
    })
  ).min(1),
  notes: z.string().trim().max(500).optional(),
});

export default function ComprehensiveScaffoldingForm({
  prefilledAddress = '',
}: ComprehensiveScaffoldingFormProps = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const navState = (location?.state || {}) as any;
  const { toast } = useToast();
  const { user } = useAuth();

  const [serviceType, setServiceType] = useState<'facade' | 'formwork'>('facade');
  const [dimensions, setDimensions] = useState<Dimension[]>([{ length: '', width: '1', height: '' }]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const address = prefilledAddress || navState?.locationAddress || '';

  const addDimension = () => setDimensions((arr) => [...arr, { length: '', width: '1', height: '' }]);
  const removeDimension = (idx: number) => setDimensions((arr) => arr.filter((_, i) => i !== idx));
  const updateDimension = (idx: number, key: keyof Dimension, value: string) =>
    setDimensions((arr) => arr.map((d, i) => (i === idx ? { ...d, [key]: value } : d)));

  const onSubmit = async () => {
    if (!user) {
      navigate('/auth/login');
      return;
    }

    const parsed = schema.safeParse({
      service_type: serviceType,
      dimensions,
      notes,
    });

    if (!parsed.success) {
      toast({ title: 'خطا', description: 'لطفاً اطلاعات را کامل کنید', variant: 'destructive' });
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .from('scaffolding_requests')
        .insert([
          {
            user_id: user.id,
            address: address || null,
            details: {
              service_type: serviceType,
              dimensions,
              notes: notes || undefined,
            },
            status: 'submitted',
          } as any
        ]);

      if (error) throw error;

      toast({ title: 'ثبت شد', description: 'درخواست شما با موفقیت ثبت شد.' });
      navigate('/profile');
    } catch (e: any) {
      toast({ title: 'خطا', description: e.message || 'ثبت با مشکل مواجه شد', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="ثبت درخواست داربست" description="اطلاعات پایه را وارد کنید" />
      <h1 className="sr-only">فرم ساده ثبت داربست</h1>

      {address && (
        <Alert className="border-primary/30">
          <AlertDescription>
            <div className="space-y-1">
              <p className="font-semibold text-sm">آدرس پروژه</p>
              <p className="text-sm">{address}</p>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="space-y-6 pt-6">
          {/* Service type */}
          <div className="space-y-2">
            <Label htmlFor="service">نوع خدمات</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button variant={serviceType === 'facade' ? 'default' : 'outline'} onClick={() => setServiceType('facade')}>
                نمای ساختمان
              </Button>
              <Button variant={serviceType === 'formwork' ? 'default' : 'outline'} onClick={() => setServiceType('formwork')}>
                قالب‌بندی
              </Button>
            </div>
          </div>

          {/* Dimensions */}
          <div className="space-y-3">
            <Label>ابعاد (متر)</Label>
            {dimensions.map((d, idx) => (
              <div key={idx} className="grid grid-cols-3 gap-3">
                <Input placeholder="طول" value={d.length} onChange={(e) => updateDimension(idx, 'length', e.target.value)} />
                <Input placeholder="عرض" value={d.width} onChange={(e) => updateDimension(idx, 'width', e.target.value)} />
                <Input placeholder="ارتفاع" value={d.height} onChange={(e) => updateDimension(idx, 'height', e.target.value)} />
              </div>
            ))}
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={addDimension}>+ سطر جدید</Button>
              {dimensions.length > 1 && (
                <Button type="button" variant="outline" onClick={() => removeDimension(dimensions.length - 1)}>حذف آخرین</Button>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">توضیحات</Label>
            <Input id="notes" placeholder="توضیحات اضافی" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="pt-2">
            <Button onClick={onSubmit} disabled={loading} className="w-full">
              {loading ? 'در حال ثبت...' : 'ثبت درخواست'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
