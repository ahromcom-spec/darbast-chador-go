import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, Building2 } from 'lucide-react';
import ComprehensiveScaffoldingForm from './ComprehensiveScaffoldingForm';

export default function ScaffoldingForm() {
  const navigate = useNavigate();

  return (
    <div 
      className="min-h-screen py-8 relative"
      style={{
        backgroundImage: 'url(/background-building.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed'
      }}
    >
      <div className="absolute inset-0 bg-black/50 z-0" />
      
      <div className="container mx-auto px-4 max-w-7xl relative z-10">
        <div className="space-y-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="gap-2 text-white hover:bg-white/10"
          >
            <ArrowRight className="h-4 w-4" />
            بازگشت
          </Button>

          <Card className="shadow-2xl bg-card/95 backdrop-blur-md border-2">
            <CardHeader className="text-center border-b">
              <CardTitle className="text-2xl flex items-center justify-center gap-2">
                <Building2 className="h-6 w-6 text-primary" />
                فرم قیمت‌گذاری خدمات داربست فلزی به همراه تمامی اجناس
              </CardTitle>
              <CardDescription>
                لطفاً نوع خدمات مورد نظر خود را انتخاب کرده و اطلاعات پروژه را وارد کنید
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <ComprehensiveScaffoldingForm />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
