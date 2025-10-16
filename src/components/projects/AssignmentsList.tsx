import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { toastError } from '@/lib/errorHandler';
import { Plus, Calendar, User, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { faIR } from 'date-fns/locale';

interface Assignment {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  due_date?: string;
  assignee_user_id: string;
  created_at: string;
  profiles?: {
    full_name: string;
  };
}

interface AssignmentsListProps {
  projectId: string;
  canAssign: boolean;
}

const STATUS_LABELS = {
  todo: 'در انتظار',
  in_progress: 'در حال انجام',
  blocked: 'مسدود شده',
  done: 'انجام شده',
};

const PRIORITY_LABELS = {
  low: 'کم',
  medium: 'متوسط',
  high: 'بالا',
  urgent: 'فوری',
};

const PRIORITY_COLORS = {
  low: 'bg-blue-100 text-blue-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

export const AssignmentsList = ({ projectId, canAssign }: AssignmentsListProps) => {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [staffList, setStaffList] = useState<any[]>([]);
  
  const [newAssignment, setNewAssignment] = useState({
    title: '',
    description: '',
    assignee_user_id: '',
    due_date: '',
    priority: 'medium',
  });

  useEffect(() => {
    fetchAssignments();
    if (canAssign) {
      fetchStaffList();
    }
  }, [projectId]);

  const fetchAssignments = async () => {
    try {
      const { data, error } = await supabase
        .from('assignments')
        .select(`
          *,
          profiles:assignee_user_id (
            full_name
          )
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAssignments((data || []) as any);
    } catch (error) {
      console.error('Error fetching assignments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStaffList = async () => {
    try {
      // دریافت لیست کاربران با نقش‌های مجاز
      const { data, error } = await supabase
        .from('user_roles')
        .select(`
          user_id,
          role,
          profiles:user_id (
            full_name
          )
        `)
        .in('role', ['scaffold_worker', 'scaffold_supervisor', 'operations_manager']);

      if (error) throw error;
      setStaffList((data || []) as any);
    } catch (error) {
      console.error('Error fetching staff:', error);
    }
  };

  const handleCreateAssignment = async () => {
    if (!user || !newAssignment.title || !newAssignment.assignee_user_id) {
      toast({
        title: 'خطا',
        description: 'لطفاً تمام فیلدهای ضروری را پر کنید',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('assignments')
        .insert([{
          project_id: projectId,
          title: newAssignment.title,
          description: newAssignment.description,
          assignee_user_id: newAssignment.assignee_user_id,
          assigned_by_user_id: user.id,
          due_date: newAssignment.due_date || null,
          priority: newAssignment.priority,
        }]);

      if (error) throw error;

      toast({
        title: 'موفق',
        description: 'وظیفه با موفقیت ارجاع شد',
      });

      setDialogOpen(false);
      setNewAssignment({
        title: '',
        description: '',
        assignee_user_id: '',
        due_date: '',
        priority: 'medium',
      });
      fetchAssignments();
    } catch (error: any) {
      toast(toastError(error, 'خطا در ثبت وظیفه'));
    }
  };

  const updateAssignmentStatus = async (assignmentId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('assignments')
        .update({
          status: newStatus,
          completed_at: newStatus === 'done' ? new Date().toISOString() : null,
        })
        .eq('id', assignmentId);

      if (error) throw error;

      toast({
        title: 'موفق',
        description: 'وضعیت وظیفه بروزرسانی شد',
      });

      fetchAssignments();
    } catch (error: any) {
      toast(toastError(error, 'خطا در به‌روزرسانی وضعیت'));
    }
  };

  if (loading) {
    return <div className="text-center py-4">در حال بارگذاری...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>وظایف ارجاع شده</CardTitle>
            <CardDescription>لیست وظایف و مسئولیت‌های پروژه</CardDescription>
          </div>
          {canAssign && (
            <Button onClick={() => setDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              ارجاع وظیفه
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {assignments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>هیچ وظیفه‌ای ارجاع نشده است</p>
          </div>
        ) : (
          <div className="space-y-3">
            {assignments.map((assignment) => (
              <div
                key={assignment.id}
                className="p-4 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{assignment.title}</h4>
                      <Badge className={PRIORITY_COLORS[assignment.priority as keyof typeof PRIORITY_COLORS]}>
                        {PRIORITY_LABELS[assignment.priority as keyof typeof PRIORITY_LABELS]}
                      </Badge>
                    </div>
                    
                    {assignment.description && (
                      <p className="text-sm text-muted-foreground">{assignment.description}</p>
                    )}
                    
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span>{(assignment.profiles as any)?.full_name || 'نامشخص'}</span>
                      </div>
                      {assignment.due_date && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>
                            موعد: {new Date(assignment.due_date).toLocaleDateString('fa-IR')}
                          </span>
                        </div>
                      )}
                      <span>
                        {formatDistanceToNow(new Date(assignment.created_at), {
                          addSuffix: true,
                          locale: faIR,
                        })}
                      </span>
                    </div>
                  </div>

                  <Select
                    value={assignment.status}
                    onValueChange={(value) => updateAssignmentStatus(assignment.id, value)}
                    disabled={user?.id !== assignment.assignee_user_id && !canAssign}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Dialog for creating assignment */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ارجاع وظیفه جدید</DialogTitle>
            <DialogDescription>
              یک وظیفه به عضو تیم ارجاع دهید
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="title">عنوان وظیفه *</Label>
              <Input
                id="title"
                value={newAssignment.title}
                onChange={(e) => setNewAssignment({ ...newAssignment, title: e.target.value })}
                placeholder="مثال: نصب داربست طبقه دوم"
              />
            </div>

            <div>
              <Label htmlFor="description">توضیحات</Label>
              <Textarea
                id="description"
                value={newAssignment.description}
                onChange={(e) => setNewAssignment({ ...newAssignment, description: e.target.value })}
                placeholder="جزئیات وظیفه..."
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="assignee">انتساب به *</Label>
              <Select
                value={newAssignment.assignee_user_id}
                onValueChange={(value) => setNewAssignment({ ...newAssignment, assignee_user_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="انتخاب فرد" />
                </SelectTrigger>
                <SelectContent>
                  {staffList.map((staff) => (
                    <SelectItem key={staff.user_id} value={staff.user_id}>
                      {(staff.profiles as any)?.full_name || 'نامشخص'} ({staff.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="priority">اولویت</Label>
                <Select
                  value={newAssignment.priority}
                  onValueChange={(value) => setNewAssignment({ ...newAssignment, priority: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="due_date">موعد</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={newAssignment.due_date}
                  onChange={(e) => setNewAssignment({ ...newAssignment, due_date: e.target.value })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              انصراف
            </Button>
            <Button onClick={handleCreateAssignment}>
              ارجاع وظیفه
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
