import BackupPanel from '@/components/backup/BackupPanel';
import CEOPhoneOnly from '@/components/backup/CEOPhoneOnly';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

export default function BackupSettings() {
  return (
    <ProtectedRoute>
      <CEOPhoneOnly>
        <div className="container mx-auto max-w-3xl py-6 px-4 space-y-4" dir="rtl">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">بکاپ و حالت آفلاین</h1>
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ArrowRight className="ml-2 h-4 w-4" />
                بازگشت
              </Button>
            </Link>
          </div>
          <BackupPanel scope="user" />
        </div>
      </CEOPhoneOnly>
    </ProtectedRoute>
  );
}
