import { useState } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { usePhoneWhitelist } from '@/hooks/usePhoneWhitelist';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Trash2, Edit } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

const AVAILABLE_ROLES = [
  { value: 'contractor', label: 'پیمانکار' },
  { value: 'operations_manager', label: 'مدیر عملیات' },
  { value: 'scaffold_supervisor', label: 'سرپرست داربست' },
  { value: 'warehouse_manager', label: 'مدیر انبار' },
  { value: 'finance_manager', label: 'مدیر مالی' },
  { value: 'general_manager', label: 'مدیر کل' },
];

export const PhoneWhitelistManagement = () => {
  usePageTitle('مدیریت دسترسی شماره‌ها');

  const { whitelist, loading, addToWhitelist, removeFromWhitelist, updateWhitelist } =
    usePhoneWhitelist();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any>(null);

  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  const handleAdd = async () => {
    if (!phoneNumber || selectedRoles.length === 0) return;

    const result = await addToWhitelist(phoneNumber, selectedRoles, notes);
    if (result.success) {
      setIsAddDialogOpen(false);
      setPhoneNumber('');
      setSelectedRoles([]);
      setNotes('');
    }
  };

  const handleEdit = async () => {
    if (!editingEntry || selectedRoles.length === 0) return;

    const result = await updateWhitelist(editingEntry.id, selectedRoles, notes);
    if (result.success) {
      setIsEditDialogOpen(false);
      setEditingEntry(null);
      setSelectedRoles([]);
      setNotes('');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('آیا از حذف این شماره مطمئن هستید؟')) {
      await removeFromWhitelist(id);
    }
  };

  const openEditDialog = (entry: any) => {
    setEditingEntry(entry);
    setSelectedRoles(entry.allowed_roles || []);
    setNotes(entry.notes || '');
    setIsEditDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            مدیریت دسترسی شماره‌ها
          </h1>
          <p className="text-muted-foreground mt-2">
            مدیریت شماره‌های مجاز برای دسترسی به نقش‌های مختلف
          </p>
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              افزودن شماره جدید
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>افزودن شماره به لیست مجاز</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="phone">شماره موبایل</Label>
                <Input
                  id="phone"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="09XXXXXXXXX"
                  validatePhone
                />
              </div>

              <div>
                <Label>نقش‌های مجاز</Label>
                <div className="space-y-2 mt-2">
                  {AVAILABLE_ROLES.map((role) => (
                    <div key={role.value} className="flex items-center space-x-2 space-x-reverse">
                      <Checkbox
                        id={role.value}
                        checked={selectedRoles.includes(role.value)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedRoles([...selectedRoles, role.value]);
                          } else {
                            setSelectedRoles(
                              selectedRoles.filter((r) => r !== role.value)
                            );
                          }
                        }}
                      />
                      <label
                        htmlFor={role.value}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {role.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="notes">یادداشت (اختیاری)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="توضیحات اضافی..."
                />
              </div>

              <Button onClick={handleAdd} className="w-full">
                افزودن
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">در حال بارگذاری...</p>
        </div>
      ) : whitelist.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              هیچ شماره‌ای در لیست مجاز وجود ندارد
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {whitelist.map((entry) => (
            <Card key={entry.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{entry.phone_number}</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(entry)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(entry.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div>
                    <span className="text-sm font-medium">نقش‌های مجاز:</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {entry.allowed_roles.map((role) => (
                        <span
                          key={role}
                          className="px-2 py-1 bg-primary/10 text-primary text-xs rounded"
                        >
                          {AVAILABLE_ROLES.find((r) => r.value === role)?.label ||
                            role}
                        </span>
                      ))}
                    </div>
                  </div>
                  {entry.notes && (
                    <div>
                      <span className="text-sm font-medium">یادداشت:</span>
                      <p className="text-sm text-muted-foreground mt-1">
                        {entry.notes}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ویرایش دسترسی</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>شماره موبایل</Label>
              <Input value={editingEntry?.phone_number || ''} disabled />
            </div>

            <div>
              <Label>نقش‌های مجاز</Label>
              <div className="space-y-2 mt-2">
                {AVAILABLE_ROLES.map((role) => (
                  <div key={role.value} className="flex items-center space-x-2 space-x-reverse">
                    <Checkbox
                      id={`edit-${role.value}`}
                      checked={selectedRoles.includes(role.value)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedRoles([...selectedRoles, role.value]);
                        } else {
                          setSelectedRoles(
                            selectedRoles.filter((r) => r !== role.value)
                          );
                        }
                      }}
                    />
                    <label
                      htmlFor={`edit-${role.value}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {role.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="edit-notes">یادداشت (اختیاری)</Label>
              <Textarea
                id="edit-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="توضیحات اضافی..."
              />
            </div>

            <Button onClick={handleEdit} className="w-full">
              ذخیره تغییرات
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
