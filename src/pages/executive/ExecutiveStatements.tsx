import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { CustomerStatementsTab } from '@/components/executive/CustomerStatementsTab';

export default function ExecutiveStatements() {
  const [searchParams] = useSearchParams();
  const f = (searchParams.get('filter') || 'all') as 'open' | 'closed' | 'all';
  const titleMap: Record<string, string> = {
    open: 'صورتحساب‌های باز مشتریان',
    closed: 'صورتحساب‌های بسته شده مشتریان',
    all: 'همه صورتحساب‌های مشتریان',
  };
  return (
    <div className="space-y-6">
      <PageHeader title={titleMap[f]} description="مدیریت و نظارت بر صورتحساب‌های مشتریان" showBackButton backTo="/executive" />
      <CustomerStatementsTab filter={f} />
    </div>
  );
}
