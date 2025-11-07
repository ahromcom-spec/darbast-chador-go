import { useState } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { usePhoneWhitelist } from '@/hooks/usePhoneWhitelist';
import { useOrganizationalPositions } from '@/hooks/useOrganizationalPositions';
import { useServiceTypesWithSubcategories } from '@/hooks/useServiceTypesWithSubcategories';
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
import { ServiceTypeSelector } from '@/components/common/ServiceTypeSelector';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export const PhoneWhitelistManagement = () => {
  usePageTitle('مدیریت دسترسی شماره‌ها');

  const { whitelist, loading, addToWhitelist, removeFromWhitelist, updateWhitelist } =
    usePhoneWhitelist();
  const { positions, loading: positionsLoading } = useOrganizationalPositions();
  const { serviceTypes, loading: servicesLoading } = useServiceTypesWithSubcategories();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any>(null);

  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedPosition, setSelectedPosition] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [notes, setNotes] = useState('');

  const handleAdd = async () => {
    if (!phoneNumber || !selectedPosition) return;

    // ترکیب سمت و خدمت برای ایجاد نقش
    const positionName = positions.find(p => p.id === selectedPosition)?.name || '';
    const serviceName = selectedService === 'all' 
      ? 'کل خدمات' 
      : serviceTypes
          .flatMap(st => st.subcategories)
          .find(sub => sub.id === selectedService)?.name || '';
    
    const combinedRole = serviceName ? `${positionName} - ${serviceName}` : positionName;
    
    const result = await addToWhitelist(phoneNumber, [combinedRole], notes);
    if (result.success) {
      setIsAddDialogOpen(false);
      setPhoneNumber('');
      setSelectedPosition('');
      setSelectedService('');
      setNotes('');
    }
  };

  const handleEdit = async () => {
    if (!editingEntry || !selectedPosition) return;

    const positionName = positions.find(p => p.id === selectedPosition)?.name || '';
    const serviceName = selectedService === 'all' 
      ? 'کل خدمات' 
      : serviceTypes
          .flatMap(st => st.subcategories)
          .find(sub => sub.id === selectedService)?.name || '';
    
    const combinedRole = serviceName ? `${positionName} - ${serviceName}` : positionName;

    const result = await updateWhitelist(editingEntry.id, [combinedRole], notes);
    if (result.success) {
      setIsEditDialogOpen(false);
      setEditingEntry(null);
      setSelectedPosition('');
      setSelectedService('');
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
    setNotes(entry.notes || '');
    // پارس کردن نقش ترکیبی
    const role = entry.allowed_roles?.[0] || '';
    if (role.includes(' - ')) {
      const [pos, service] = role.split(' - ');
      const position = positions.find(p => p.name === pos);
      if (position) setSelectedPosition(position.id);
      if (service === 'کل خدمات') {
        setSelectedService('all');
      } else {
        const subcategory = serviceTypes
          .flatMap(st => st.subcategories)
          .find(sub => sub.name === service);
        if (subcategory) setSelectedService(subcategory.id);
      }
    }
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
                />
              </div>

              <div>
                <Label>سمت مدیریتی پرسنل</Label>
                <Select value={selectedPosition} onValueChange={setSelectedPosition}>
                  <SelectTrigger>
                    <SelectValue placeholder="انتخاب سمت..." />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    {positionsLoading ? (
                      <SelectItem value="loading" disabled>
                        در حال بارگذاری...
                      </SelectItem>
                    ) : (
                      positions.map((position) => (
                        <SelectItem key={position.id} value={position.id}>
                          {position.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>نوع خدمات</Label>
                <div className="space-y-2">
                  <Select value={selectedService} onValueChange={setSelectedService}>
                    <SelectTrigger>
                      <SelectValue placeholder="انتخاب نوع خدمات..." />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50 max-h-[300px]">
                      <SelectItem value="all">کل خدمات</SelectItem>
                      {servicesLoading ? (
                        <SelectItem value="loading" disabled>
                          در حال بارگذاری...
                        </SelectItem>
                      ) : (
                        serviceTypes.map((serviceType) => (
                          <div key={serviceType.id}>
                            <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                              {serviceType.name}
                            </div>
                            {serviceType.subcategories.map((sub) => (
                              <SelectItem key={sub.id} value={sub.id} className="pr-6">
                                {sub.name}
                              </SelectItem>
                            ))}
                          </div>
                        ))
                      )}
                    </SelectContent>
                  </Select>
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

              <Button 
                onClick={handleAdd} 
                className="w-full"
                disabled={!phoneNumber || !selectedPosition}
              >
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
                    <span className="text-sm font-medium">سمت و نقش:</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {entry.allowed_roles.map((role) => (
                        <span
                          key={role}
                          className="px-3 py-1.5 bg-primary/10 text-primary text-sm rounded-md font-medium"
                        >
                          {role}
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
              <Label>سمت مدیریتی پرسنل</Label>
              <Select value={selectedPosition} onValueChange={setSelectedPosition}>
                <SelectTrigger>
                  <SelectValue placeholder="انتخاب سمت..." />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {positionsLoading ? (
                    <SelectItem value="loading" disabled>
                      در حال بارگذاری...
                    </SelectItem>
                  ) : (
                    positions.map((position) => (
                      <SelectItem key={position.id} value={position.id}>
                        {position.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>نوع خدمات</Label>
              <Select value={selectedService} onValueChange={setSelectedService}>
                <SelectTrigger>
                  <SelectValue placeholder="انتخاب نوع خدمات..." />
                </SelectTrigger>
                <SelectContent className="bg-background z-50 max-h-[300px]">
                  <SelectItem value="all">کل خدمات</SelectItem>
                  {servicesLoading ? (
                    <SelectItem value="loading" disabled>
                      در حال بارگذاری...
                    </SelectItem>
                  ) : (
                    serviceTypes.map((serviceType) => (
                      <div key={serviceType.id}>
                        <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                          {serviceType.name}
                        </div>
                        {serviceType.subcategories.map((sub) => (
                          <SelectItem key={sub.id} value={sub.id} className="pr-6">
                            {sub.name}
                          </SelectItem>
                        ))}
                      </div>
                    ))
                  )}
                </SelectContent>
              </Select>
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

            <Button 
              onClick={handleEdit} 
              className="w-full"
              disabled={!selectedPosition}
            >
              ذخیره تغییرات
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
