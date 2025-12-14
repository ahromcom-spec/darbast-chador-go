import { Outlet, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layouts/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Home, AlertCircle, DollarSign, Users } from 'lucide-react';
import { useSalesPendingCount } from '@/hooks/useSalesPendingCount';

export default function SalesLayout() {
  const navigate = useNavigate();
  const { data: pendingCount = 0 } = useSalesPendingCount();

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
                className="gap-2 relative"
              >
                <AlertCircle className="h-4 w-4" />
                سفارشات در انتظار
                {pendingCount > 0 && (
                  <Badge variant="destructive" className="mr-2 text-xs">
                    {pendingCount}
                  </Badge>
                )}
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/sales/customers')}
                className="gap-2"
              >
                <Users className="h-4 w-4" />
                مشتریان
              </Button>
            </div>
          </CardContent>
        </Card>
        
        <Outlet />
      </div>
    </MainLayout>
  );
}
