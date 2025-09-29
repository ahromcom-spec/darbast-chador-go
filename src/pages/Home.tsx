import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { LogOut, Wrench, Building2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Home() {
  const [selectedService, setSelectedService] = useState<string>('');
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: 'خروج موفق',
      description: 'با موفقیت از سامانه خارج شدید',
    });
  };

  const handleScaffoldingTypeSelect = (type: 'with-materials' | 'without-materials') => {
    navigate(`/scaffolding/form?type=${type}`);
  };

  const handleTarpaulinSelect = () => {
    toast({
      title: 'به زودی',
      description: 'خدمات چادر برزنتی به زودی اضافه خواهد شد',
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-background">
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-sm border-b shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Building2 className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-xl font-bold text-primary">خدمات ساختمانی</h1>
              <p className="text-sm text-muted-foreground">سامانه سفارش آنلاین</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium">خوش آمدید</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSignOut}
              className="gap-2"
            >
              <LogOut className="h-4 w-4" />
              خروج
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-8">
          {/* Welcome Card */}
          <Card className="text-center shadow-elegant persian-slide">
            <CardHeader className="pb-4">
              <CardTitle className="text-3xl font-bold primary-gradient bg-clip-text text-transparent">
                انتخاب خدمت
              </CardTitle>
              <CardDescription className="text-lg">
                خدمت مورد نظر خود را انتخاب کنید
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Service Selection */}
          <Card className="shadow-elegant">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-construction" />
                انتخاب نوع خدمت
              </CardTitle>
              <CardDescription>
                از میان خدمات زیر یکی را انتخاب کنید
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">نوع خدمت:</label>
                <Select value={selectedService} onValueChange={setSelectedService}>
                  <SelectTrigger className="w-full text-right">
                    <SelectValue placeholder="انتخاب کنید..." />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    <SelectItem value="scaffolding">خدمات داربست فلزی</SelectItem>
                    <SelectItem value="tarpaulin">خدمات چادر برزنتی</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Scaffolding Options */}
              {selectedService === 'scaffolding' && (
                <div className="space-y-4 p-4 bg-secondary/50 rounded-lg border-2 border-construction/20">
                  <div className="flex items-center gap-2 mb-3">
                    <Building2 className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-primary">انواع خدمات داربست فلزی</h3>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Button
                      onClick={() => handleScaffoldingTypeSelect('with-materials')}
                      className="h-auto p-4 construction-gradient hover:opacity-90 text-right justify-start"
                    >
                      <div className="space-y-1">
                        <div className="font-semibold">داربست به همراه اجناس</div>
                        <div className="text-xs opacity-90">شامل تمام مواد و ابزار</div>
                      </div>
                    </Button>
                    <Button
                      onClick={() => handleScaffoldingTypeSelect('without-materials')}
                      variant="outline"
                      className="h-auto p-4 border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground text-right justify-start"
                    >
                      <div className="space-y-1">
                        <div className="font-semibold">داربست بدون اجناس</div>
                        <div className="text-xs opacity-75">فقط نصب و راه‌اندازی</div>
                      </div>
                    </Button>
                  </div>
                </div>
              )}

              {/* Tarpaulin Options */}
              {selectedService === 'tarpaulin' && (
                <div className="space-y-4 p-4 bg-secondary/50 rounded-lg border-2 border-construction/20">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="secondary" className="bg-gold/20 text-gold-light border-gold/30">
                      به زودی
                    </Badge>
                    <h3 className="font-semibold text-muted-foreground">خدمات چادر برزنتی</h3>
                  </div>
                  <Button
                    onClick={handleTarpaulinSelect}
                    disabled
                    variant="outline"
                    className="w-full opacity-60"
                  >
                    این خدمت به زودی اضافه خواهد شد
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}