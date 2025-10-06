import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, Building2 } from 'lucide-react';
import ScaffoldingFacadeForm from './ScaffoldingFacadeForm';

type ScaffoldingType = 'with-materials' | 'without-materials';
type ServiceType = 'facade' | 'formwork' | 'ceiling';

export default function ScaffoldingForm() {
  const navigate = useNavigate();
  const [scaffoldingType, setScaffoldingType] = useState<ScaffoldingType>('with-materials');
  const [serviceType, setServiceType] = useState<ServiceType>('facade');

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-background py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="space-y-6">
          {/* Back Button */}
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="gap-2"
          >
            <ArrowRight className="h-4 w-4" />
            بازگشت
          </Button>

          {/* Main Selection Card */}
          <Card className="shadow-elegant">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl flex items-center justify-center gap-2">
                <Building2 className="h-6 w-6 text-primary" />
                فرم درخواست خدمات داربست فلزی
              </CardTitle>
              <CardDescription>
                نوع خدمات و زیرشاخه مورد نظر خود را انتخاب کنید
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Scaffolding Type Selection */}
              <div className="space-y-3">
                <h3 className="font-semibold text-primary">نوع خدمات داربست:</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button
                    variant={scaffoldingType === 'with-materials' ? 'default' : 'outline'}
                    onClick={() => setScaffoldingType('with-materials')}
                    className="h-auto p-4 text-right justify-start"
                  >
                    <div className="space-y-1">
                      <div className="font-semibold">داربست به همراه اجناس</div>
                      <div className="text-xs opacity-90">شامل تمام مواد و ابزار</div>
                    </div>
                  </Button>
                  <Button
                    variant={scaffoldingType === 'without-materials' ? 'default' : 'outline'}
                    onClick={() => setScaffoldingType('without-materials')}
                    className="h-auto p-4 text-right justify-start"
                  >
                    <div className="space-y-1">
                      <div className="font-semibold">داربست بدون اجناس</div>
                      <div className="text-xs opacity-75">فقط نصب و فک داربست</div>
                    </div>
                  </Button>
                </div>
              </div>

              {/* Service Type Selection - Only for "with-materials" */}
              {scaffoldingType === 'with-materials' && (
                <div className="space-y-3 p-4 bg-secondary/50 rounded-lg border-2 border-construction/20">
                  <h3 className="font-semibold text-primary">زیرشاخه خدمات:</h3>
                  <div className="grid gap-3">
                    <Button
                      variant={serviceType === 'facade' ? 'default' : 'outline'}
                      onClick={() => setServiceType('facade')}
                      className="h-auto p-3 text-right justify-start"
                    >
                      <div className="font-medium">خدمات داربست نما و سطحی</div>
                    </Button>
                    <Button
                      variant={serviceType === 'formwork' ? 'default' : 'outline'}
                      onClick={() => setServiceType('formwork')}
                      className="h-auto p-3 text-right justify-start"
                    >
                      <div className="font-medium">خدمات داربست کفراژ و حجمی</div>
                    </Button>
                    <Button
                      variant={serviceType === 'ceiling' ? 'default' : 'outline'}
                      onClick={() => setServiceType('ceiling')}
                      className="h-auto p-3 text-right justify-start"
                    >
                      <div className="font-medium">خدمات داربست زیربتن سقف</div>
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Form Section - Only show for facade with materials for now */}
          {scaffoldingType === 'with-materials' && serviceType === 'facade' && (
            <ScaffoldingFacadeForm />
          )}

          {/* Coming Soon Message for other types */}
          {(scaffoldingType === 'without-materials' || 
            (scaffoldingType === 'with-materials' && serviceType !== 'facade')) && (
            <Card className="shadow-elegant">
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">
                  فرم این خدمات به زودی اضافه خواهد شد
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
