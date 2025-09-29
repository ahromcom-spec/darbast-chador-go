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
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';

const dimensionsSchema = z.object({
  length: z.number().min(0.1, { message: 'طول باید حداقل 0.1 متر باشد' }),
  width: z.number().min(0.1, { message: 'عرض باید حداقل 0.1 متر باشد' }),
  height: z.number().min(0.1, { message: 'ارتفاع باید حداقل 0.1 متر باشد' }),
});

export default function ScaffoldingForm() {
  const [searchParams] = useSearchParams();
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [requestData, setRequestData] = useState<any>(null);
  
  const type = searchParams.get('type') as 'with-materials' | 'without-materials';
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

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
    setLength('');
    setWidth('');
    setHeight('');
    setErrors({});
  };

  if (submitted && requestData) {
    return (
      <div className="bg-gradient-to-br from-background via-secondary/30 to-background min-h-screen pt-8">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <Card className="shadow-elegant text-center">
              <CardHeader className="pb-4">
                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <CardTitle className="text-2xl font-bold text-green-600">
                  درخواست ثبت شد!
                </CardTitle>
                <CardDescription>
                  درخواست شما با موفقیت در سامانه ثبت شد
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-secondary/50 p-4 rounded-lg space-y-3">
                  <h3 className="font-semibold text-primary mb-3">خلاصه درخواست:</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">نوع خدمت:</span>
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
                
                <div className="flex gap-3">
                  <Button onClick={handleBack} variant="outline" className="flex-1">
                    بازگشت به صفحه اصلی
                  </Button>
                  <Button onClick={handleNewRequest} className="flex-1 construction-gradient">
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
    <div className="bg-gradient-to-br from-background via-secondary/30 to-background min-h-screen pt-8">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Back Button */}
          <Button 
            onClick={handleBack}
            variant="outline" 
            className="gap-2 mb-6"
          >
            <ArrowRight className="h-4 w-4" />
            بازگشت
          </Button>

          {/* Form Card */}
          <Card className="shadow-elegant">
            <CardHeader className="text-center pb-4">
              <div className="flex items-center justify-center gap-3 mb-3">
                <Building2 className="h-6 w-6 text-primary" />
                <CardTitle className="text-2xl font-bold text-primary">
                  ثبت ابعاد داربست
                </CardTitle>
              </div>
              <Badge 
                variant={getTypeBadgeVariant(type)} 
                className="mx-auto"
              >
                داربست فلزی {getTypeLabel(type)}
              </Badge>
              <CardDescription className="mt-2">
                ابعاد مورد نیاز برای داربست را وارد کنید
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-6">
                <div className="grid gap-6 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="length" className="flex items-center gap-2">
                      <Calculator className="h-4 w-4 text-construction" />
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
                      required
                    />
                    {errors.length && (
                      <p className="text-sm text-destructive">{errors.length}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="width" className="flex items-center gap-2">
                      <Calculator className="h-4 w-4 text-construction" />
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
                      required
                    />
                    {errors.width && (
                      <p className="text-sm text-destructive">{errors.width}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="height" className="flex items-center gap-2">
                      <Calculator className="h-4 w-4 text-construction" />
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
                      required
                    />
                    {errors.height && (
                      <p className="text-sm text-destructive">{errors.height}</p>
                    )}
                  </div>
                </div>

                {/* Volume Preview */}
                {length && width && height && (
                  <div className="p-4 bg-secondary/50 rounded-lg border-2 border-construction/20">
                    <h3 className="font-semibold text-primary mb-2">پیش‌نمایش محاسبات:</h3>
                    <div className="text-sm space-y-1">
                      <div>حجم کل: {(parseFloat(length) * parseFloat(width) * parseFloat(height)).toFixed(2)} متر مکعب</div>
                      <div className="text-muted-foreground">
                        {parseFloat(length)} × {parseFloat(width)} × {parseFloat(height)} = حجم کل
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <Button 
                    type="button"
                    onClick={handleBack}
                    variant="outline" 
                    className="flex-1"
                  >
                    انصراف
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-1 construction-gradient hover:opacity-90"
                    disabled={loading}
                  >
                    {loading ? 'در حال ثبت...' : 'ثبت ابعاد'}
                  </Button>
                </div>
              </CardContent>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}