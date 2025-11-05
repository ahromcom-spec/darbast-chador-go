import { Outlet, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layouts/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Home, AlertCircle, DollarSign } from 'lucide-react';

export default function SalesLayout() {
  const navigate = useNavigate();

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/sales')}
                className="gap-2"
              >
                <Home className="h-4 w-4" />
                داشبورد
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/sales/pending-orders')}
                className="gap-2"
              >
                <AlertCircle className="h-4 w-4" />
                سفارشات در انتظار
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/sales/orders')}
                className="gap-2"
              >
                <DollarSign className="h-4 w-4" />
                مدیریت تسویه
              </Button>
            </div>
          </CardContent>
        </Card>
        
        <Outlet />
      </div>
    </MainLayout>
  );
}
