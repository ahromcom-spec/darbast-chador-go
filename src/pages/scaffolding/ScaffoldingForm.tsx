import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Calculator, CheckCircle, Building2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFormPersistence } from '@/hooks/useFormPersistence';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import ProjectLocationMap from '@/components/ProjectLocationMap';

const dimensionsSchema = z.object({
  length: z.number().min(0.1, { message: 'طول باید حداقل 0.1 متر باشد' }),
  width: z.number().min(0.1, { message: 'عرض باید حداقل 0.1 متر باشد' }),
  height: z.number().min(0.1, { message: 'ارتفاع باید حداقل 0.1 متر باشد' }),
});

export default function ScaffoldingForm() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [requestData, setRequestData] = useState<any>(null);
  const [projectLocation, setProjectLocation] = useState<{
    address: string;
    coordinates: [number, number];
    distance: number;
  } | null>(null);
  
  const type = searchParams.get('type') as 'with-materials' | 'without-materials';
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Use persistent form hook
  const { 
    updateField, 
    clearForm, 
    getField, 
    isLoaded 
  } = useFormPersistence(`scaffolding-${type}`, {
    length: '',
    width: '',
    height: ''
  });

  const length = getField('length');
  const width = getField('width');  
  const height = getField('height');

  const setLength = (value: string) => updateField('length', value);
  const setWidth = (value: string) => updateField('width', value);
  const setHeight = (value: string) => updateField('height', value);

  useEffect(() => {
    if (!type || !['with-materials', 'without-materials'].includes(type)) {
      navigate('/', { replace: true });
    }
  }, [type, navigate]);

  const getTypeLabel = (type: string) => {
    return type === 'with-materials' ? 'به همراه اجناس' : 'بدون اجناس';
  };

  const getTypeBadgeVariant = (type: string) => {
    return type === 'with-materials' ? 'default' : 'outline';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    try {
      const numLength = parseFloat(length);
      const numWidth = parseFloat(width);
      const numHeight = parseFloat(height);

      const result = dimensionsSchema.safeParse({
        length: numLength,
        width: numWidth,
        height: numHeight,
      });

      if (!result.success) {
        const formattedErrors: Record<string, string> = {};
        result.error.errors.forEach((err) => {
          if (err.path[0]) {
            formattedErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(formattedErrors);
        return;
      }

      setLoading(true);

      const { data, error } = await supabase
        .from('service_requests')
        .insert({
          user_id: user?.id,
          service_type: 'scaffolding',
          sub_type: type,
          length: numLength,
          width: numWidth,
          height: numHeight,
          location_address: projectLocation?.address,
          location_coordinates: projectLocation?.coordinates 
            ? `(${projectLocation.coordinates[0]},${projectLocation.coordinates[1]})`
            : null,
          location_distance: projectLocation?.distance,
        })
        .select()
        .single();

      if (error) {
        toast({
          title: 'خطا در ثبت درخواست',
          description: 'متاسفانه امکان ثبت درخواست وجود ندارد. لطفاً دوباره تلاش کنید.',
          variant: 'destructive',
        });
        return;
      }

      setRequestData(data);
      setSubmitted(true);
      
      // Clear saved form data after successful submission
      clearForm();
      
      toast({
        title: 'درخواست ثبت شد',
        description: 'درخواست شما با موفقیت ثبت شد',
      });

    } catch (error) {
      toast({
        title: 'خطا',
        description: 'خطایی در ثبت درخواست رخ داد',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/');
  };

  const handleNewRequest = () => {
    setSubmitted(false);
    setRequestData(null);
    setErrors({});
    clearForm();
  };

  if (submitted && requestData) {
    return (
    <div className="bg-gradient-to-br from-background via-secondary/30 to-background min-h-screen pt-4 md:pt-8">
      <div className="container mx-auto px-3 md:px-4 py-4 md:py-8">
        <div className="max-w-2xl mx-auto">
          <Card className="shadow-elegant text-center">
            <CardHeader className="pb-3 md:pb-4 p-4 md:p-6">
              <div className="mx-auto w-12 h-12 md:w-16 md:h-16 bg-green-100 rounded-full flex items-center justify-center mb-3 md:mb-4">
                <CheckCircle className="h-6 w-6 md:h-8 md:w-8 text-green-600" />
              </div>
              <CardTitle className="text-xl md:text-2xl font-bold text-green-600">
                درخواست ثبت شد!
              </CardTitle>
              <CardDescription className="text-sm md:text-base">
                درخواست شما با موفقیت در سامانه ثبت شد
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 md:space-y-6 p-3 md:p-6">
              <div className="bg-secondary/50 p-3 md:p-4 rounded-lg space-y-2 md:space-y-3">
                <h3 className="font-semibold text-primary mb-2 md:mb-3 text-sm md:text-base">خلاصه درخواست:</h3>
                <div className="grid grid-cols-2 gap-3 md:gap-4 text-xs md:text-sm">
                    <div>
                      <span className="text-muted-foreground">نوع خدمات:</span>
                      <div className="font-medium">خدمات داربست فلزی</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">نوع داربست:</span>
                      <Badge variant={getTypeBadgeVariant(requestData.sub_type)} className="mt-1">
                        {getTypeLabel(requestData.sub_type)}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">طول:</span>
                      <div className="font-medium">{requestData.length} متر</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">عرض:</span>
                      <div className="font-medium">{requestData.width} متر</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">ارتفاع:</span>
                      <div className="font-medium">{requestData.height} متر</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">حجم کل:</span>
                      <div className="font-medium">
                        {(requestData.length * requestData.width * requestData.height).toFixed(2)} متر مکعب
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground pt-2 border-t">
                    شماره درخواست: {requestData.id.slice(0, 8)}
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-2 md:gap-3">
                  <Button onClick={handleBack} variant="outline" className="flex-1 text-sm">
                    بازگشت به صفحه اصلی
                  </Button>
                  <Button onClick={handleNewRequest} className="flex-1 construction-gradient text-sm">
                    درخواست جدید
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-background via-secondary/30 to-background min-h-screen pt-4 md:pt-8">
      <div className="container mx-auto px-3 md:px-4 py-4 md:py-8">
        <div className="max-w-2xl mx-auto space-y-4 md:space-y-6">
          {/* Back Button */}
          <Button 
            onClick={handleBack}
            variant="outline" 
            className="gap-2 mb-4 md:mb-6 text-sm"
          >
            <ArrowRight className="h-4 w-4" />
            بازگشت
          </Button>

          {/* Form Card */}
          <Card className="shadow-elegant">
            <CardHeader className="text-center pb-3 md:pb-4 p-4 md:p-6">
              <div className="flex items-center justify-center gap-2 md:gap-3 mb-2 md:mb-3">
                <Building2 className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                <CardTitle className="text-lg md:text-2xl font-bold text-primary">
                  ثبت ابعاد داربست
                </CardTitle>
              </div>
              <Badge 
                variant={getTypeBadgeVariant(type)} 
                className="mx-auto text-xs md:text-sm"
              >
                داربست فلزی {getTypeLabel(type)}
              </Badge>
              <CardDescription className="mt-2 text-xs md:text-sm">
                ابعاد مورد نیاز برای داربست را وارد کنید
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4 md:space-y-6 p-3 md:p-6">
                <div className="grid gap-4 md:gap-6 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="length" className="flex items-center gap-2 text-sm md:text-base">
                      <Calculator className="h-3 w-3 md:h-4 md:w-4 text-construction" />
                      طول (متر)
                    </Label>
                    <Input
                      id="length"
                      type="number"
                      step="0.01"
                      min="0.1"
                      placeholder="مثال: 12.5"
                      value={length}
                      onChange={(e) => setLength(e.target.value)}
                      className={errors.length ? 'border-destructive' : ''}
                      disabled={!isLoaded}
                      required
                    />
                    {errors.length && (
                      <p className="text-sm text-destructive">{errors.length}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="width" className="flex items-center gap-2 text-sm md:text-base">
                      <Calculator className="h-3 w-3 md:h-4 md:w-4 text-construction" />
                      عرض (متر)
                    </Label>
                    <Input
                      id="width"
                      type="number"
                      step="0.01"
                      min="0.1"
                      placeholder="مثال: 8.0"
                      value={width}
                      onChange={(e) => setWidth(e.target.value)}
                      className={errors.width ? 'border-destructive' : ''}
                      disabled={!isLoaded}
                      required
                    />
                    {errors.width && (
                      <p className="text-sm text-destructive">{errors.width}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="height" className="flex items-center gap-2 text-sm md:text-base">
                      <Calculator className="h-3 w-3 md:h-4 md:w-4 text-construction" />
                      ارتفاع (متر)
                    </Label>
                    <Input
                      id="height"
                      type="number"
                      step="0.01"
                      min="0.1"
                      placeholder="مثال: 3.5"
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                      className={errors.height ? 'border-destructive' : ''}
                      disabled={!isLoaded}
                      required
                    />
                    {errors.height && (
                      <p className="text-sm text-destructive">{errors.height}</p>
                    )}
                  </div>
                </div>

                {/* Volume Preview */}
                {length && width && height && (
                  <div className="p-3 md:p-4 bg-secondary/50 rounded-lg border-2 border-construction/20">
                    <h3 className="font-semibold text-primary mb-2 text-sm md:text-base">پیش‌نمایش محاسبات:</h3>
                    <div className="text-xs md:text-sm space-y-1">
                      <div>حجم کل: {(parseFloat(length) * parseFloat(width) * parseFloat(height)).toFixed(2)} متر مکعب</div>
                      <div className="text-muted-foreground">
                        {parseFloat(length)} × {parseFloat(width)} × {parseFloat(height)} = حجم کل
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2 md:gap-3 pt-3 md:pt-4">
                  <Button 
                    type="button"
                    onClick={handleBack}
                    variant="outline" 
                    className="flex-1 text-sm"
                  >
                    انصراف
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-1 construction-gradient hover:opacity-90 text-sm"
                    disabled={loading}
                  >
                    {loading ? 'در حال ثبت...' : 'ثبت ابعاد'}
                  </Button>
                </div>
              </CardContent>
            </form>
          </Card>

          {/* Project Location Map */}
          <ProjectLocationMap onLocationSelect={setProjectLocation} />
        </div>
      </div>
    </div>
  );
}