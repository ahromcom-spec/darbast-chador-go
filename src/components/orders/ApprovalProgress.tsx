import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, Circle } from 'lucide-react';
import { OrderApproval } from '@/hooks/useOrderApprovals';

interface ApprovalProgressProps {
  approvals: OrderApproval[];
  loading?: boolean;
}

const roleNames: Record<string, string> = {
  'ceo': 'مدیرعامل',
  'scaffold_executive_manager': 'مدیر اجرایی',
  'sales_manager': 'مدیر فروش',
  'general_manager_scaffold_execution_with_materials': 'مدیرعامل',
  'executive_manager_scaffold_execution_with_materials': 'مدیر اجرایی',
  
};

export const ApprovalProgress = ({ approvals, loading }: ApprovalProgressProps) => {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (approvals.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">وضعیت تایید</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            این سفارش نیاز به تایید چندمرحله‌ای ندارد
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalApprovals = approvals.length;
  const completedApprovals = approvals.filter(a => a.approved_at).length;
  const progressPercent = (completedApprovals / totalApprovals) * 100;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">وضعیت تایید</CardTitle>
          <Badge variant={completedApprovals === totalApprovals ? "default" : "secondary"}>
            {completedApprovals} از {totalApprovals}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="w-full bg-secondary rounded-full h-2">
          <div 
            className="bg-primary h-2 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Approval List */}
        <div className="space-y-3">
          {approvals.map((approval) => {
            const isApproved = !!approval.approved_at;
            const roleName = roleNames[approval.approver_role] || approval.approver_role;

            return (
              <div 
                key={approval.id} 
                className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30"
              >
                <div className="mt-0.5">
                  {isApproved ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <Clock className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{roleName}</p>
                    {isApproved ? (
                      <Badge variant="default" className="text-xs">
                        تایید شده
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        در انتظار
                      </Badge>
                    )}
                  </div>
                  {isApproved && approval.approver_name && (
                    <p className="text-xs text-muted-foreground">
                      توسط: {approval.approver_name}
                    </p>
                  )}
                  {isApproved && approval.approved_at && (
                    <p className="text-xs text-muted-foreground">
                      {new Date(approval.approved_at).toLocaleDateString('fa-IR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        {completedApprovals === totalApprovals ? (
          <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
            <p className="text-sm text-green-800 dark:text-green-200 text-center">
              ✓ همه تاییدات انجام شده است
            </p>
          </div>
        ) : (
          <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200 text-center">
              {totalApprovals - completedApprovals} تایید باقی‌مانده
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
