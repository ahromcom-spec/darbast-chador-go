import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Calculator, Plus, Trash2, CalendarDays, Image as ImageIcon } from 'lucide-react';
import { MediaUploader } from './MediaUploader';

interface ExpertPricingRequestDialogProps {
  subcategoryId: string;
  provinceId: string;
  districtId?: string;
  address: string;
  detailedAddress?: string;
  locationLat?: number;
  locationLng?: number;
  serviceTypeName?: string;
}

interface Dimension {
  length: string;
  width: string;
  height: string;
}

export const ExpertPricingRequestDialog = ({
  subcategoryId,
  provinceId,
  districtId,
  address,
  detailedAddress,
  locationLat,
  locationLng,
  serviceTypeName
}: ExpertPricingRequestDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [description, setDescription] = useState('');
  const [dimensions, setDimensions] = useState<Dimension[]>([{ length: '', width: '', height: '' }]);
  const [requestedDate, setRequestedDate] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  
  const { toast } = useToast();
  const { user } = useAuth();

  const addDimension = () => {
    setDimensions([...dimensions, { length: '', width: '', height: '' }]);
  };

  const removeDimension = (index: number) => {
    if (dimensions.length > 1) {
      setDimensions(dimensions.filter((_, i) => i !== index));
    }
  };

  const updateDimension = (index: number, field: keyof Dimension, value: string) => {
    const updated = [...dimensions];
    updated[index][field] = value;
    setDimensions(updated);
  };

  const handleFilesChange = (files: File[]) => {
    setUploadedFiles(files);
  };

  const handleSubmit = async () => {
    if (!user) {
      toast({ title: 'خطا', description: 'لطفاً وارد حساب کاربری شوید', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      // Get customer ID
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (customerError || !customer) {
        throw new Error('مشتری یافت نشد');
      }

      // Insert using raw SQL query via postgrest
      const insertData = {
        customer_id: customer.id,
        subcategory_id: subcategoryId,
        province_id: provinceId,
        district_id: districtId || null,
        address: address,
        detailed_address: detailedAddress || null,
        location_lat: locationLat || null,
        location_lng: locationLng || null,
        description: description,
        dimensions: dimensions.filter(d => d.length || d.width || d.height),
        requested_date: requestedDate ? new Date(requestedDate).toISOString() : null,
        status: 'pending'
      };

      // Use fetch directly to avoid TypeScript issues with new table
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/expert_pricing_requests`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(insertData)
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'خطا در ثبت درخواست');
      }

      toast({
        title: '✅ درخواست ثبت شد',
        description: 'درخواست قیمت‌گذاری شما ثبت شد و کارشناسان به زودی بررسی خواهند کرد.'
      });

      setOpen(false);
      // Reset form
      setDescription('');
      setDimensions([{ length: '', width: '', height: '' }]);
      setRequestedDate('');
      setUploadedFiles([]);

    } catch (error: any) {
      console.error('Error submitting request:', error);
      toast({
        title: 'خطا',
        description: error.message || 'خطا در ثبت درخواست',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 border-primary/30 hover:bg-primary/10">
          <Calculator className="h-4 w-4" />
          درخواست قیمت‌گذاری توسط کارشناس
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            درخواست قیمت‌گذاری توسط کارشناسان
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Service Info */}
          {serviceTypeName && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">نوع خدمات: <span className="font-medium text-foreground">{serviceTypeName}</span></p>
              <p className="text-sm text-muted-foreground mt-1">آدرس: <span className="font-medium text-foreground">{address}</span></p>
            </div>
          )}

          {/* Description */}
          <div className="space-y-2">
            <Label>توضیحات سفارش</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="توضیحات خود را درباره سفارش وارد کنید..."
              rows={3}
            />
          </div>

          {/* Dimensions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>ابعاد کار (متر)</Label>
              <Button type="button" variant="outline" size="sm" onClick={addDimension}>
                <Plus className="h-4 w-4 ml-1" />
                افزودن ابعاد
              </Button>
            </div>
            
            {dimensions.map((dim, index) => (
              <div key={index} className="flex gap-2 items-center">
                <div className="flex-1">
                  <Input
                    type="number"
                    placeholder="طول"
                    value={dim.length}
                    onChange={(e) => updateDimension(index, 'length', e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <Input
                    type="number"
                    placeholder="عرض"
                    value={dim.width}
                    onChange={(e) => updateDimension(index, 'width', e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <Input
                    type="number"
                    placeholder="ارتفاع"
                    value={dim.height}
                    onChange={(e) => updateDimension(index, 'height', e.target.value)}
                  />
                </div>
                {dimensions.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeDimension(index)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          {/* Requested Date */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              تاریخ درخواست اجرا
            </Label>
            <Input
              type="datetime-local"
              value={requestedDate}
              onChange={(e) => setRequestedDate(e.target.value)}
            />
          </div>

          {/* Media Upload */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              عکس و فیلم از محل کار
            </Label>
            <MediaUploader onFilesChange={handleFilesChange} />
          </div>

          {/* Submit Button */}
          <Button 
            onClick={handleSubmit} 
            disabled={loading} 
            className="w-full"
          >
            {loading ? 'در حال ثبت...' : 'ثبت درخواست قیمت‌گذاری'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
