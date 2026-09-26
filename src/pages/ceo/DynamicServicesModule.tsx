import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useIsCEOPhone } from '@/hooks/useIsCEOPhone';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  ChevronDown, ChevronLeft, Plus, Pencil, Trash2, Loader2, Settings, FolderTree, Save, X,
} from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { ServicePricingRatesDialog } from '@/components/ceo/ServicePricingRatesDialog';

interface ServiceType {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  sort_order: number | null;
}
interface Sub {
  id: string;
  service_type_id: string;
  parent_id: string | null;
  name: string;
  code: string;
  is_active: boolean;
  sort_order: number | null;
  form_path: string | null;
  children: Sub[];
}

const DEPTH_MAX = 3; // service -> sub -> sub-sub

export default function DynamicServicesModule() {
  const { isCEO, loading: authLoading } = useIsCEOPhone();
  const [types, setTypes] = useState<ServiceType[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{ kind: 'type' | 'sub'; id: string } | null>(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editForm, setEditForm] = useState('');
  const [newRootName, setNewRootName] = useState('');
  const [pricingSub, setPricingSub] = useState<Sub | null>(null);

  const load = async () => {
    setLoading(true);
    const [t, s] = await Promise.all([
      supabase.from('service_types_v3').select('*').order('sort_order').order('name'),
      supabase.from('subcategories').select('*').order('sort_order').order('name'),
    ]);
    if (t.error) toast.error('خطا در بارگذاری خدمات');
    if (s.error) toast.error('خطا در بارگذاری زیرشاخه‌ها');
    setTypes((t.data || []) as any);
    setSubs((s.data || []).map((r: any) => ({ ...r, children: [] })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const tree = useMemo(() => {
    const map = new Map<string, Sub>();
    subs.forEach(x => map.set(x.id, { ...x, children: [] }));
    const roots: Record<string, Sub[]> = {};
    map.forEach(node => {
      if (node.parent_id) {
        const p = map.get(node.parent_id);
        if (p) p.children.push(node);
      } else {
        (roots[node.service_type_id] ||= []).push(node);
      }
    });
    return { map, roots };
  }, [subs]);

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const startEditType = (t: ServiceType) => {
    setEditing({ kind: 'type', id: t.id });
    setEditName(t.name);
    setEditCode(t.code);
    setEditForm('');
  };
  const startEditSub = (s: Sub) => {
    setEditing({ kind: 'sub', id: s.id });
    setEditName(s.name);
    setEditCode(s.code);
    setEditForm(s.form_path || '');
  };
  const cancelEdit = () => setEditing(null);

  const saveEdit = async () => {
    if (!editing) return;
    if (!editName.trim()) return toast.error('نام الزامی است');
    if (editing.kind === 'type') {
      const { error } = await supabase.from('service_types_v3')
        .update({ name: editName.trim(), code: editCode.trim() || editName.trim() })
        .eq('id', editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from('subcategories')
        .update({
          name: editName.trim(),
          code: editCode.trim() || editName.trim(),
          form_path: editForm.trim() || null,
        })
        .eq('id', editing.id);
      if (error) return toast.error(error.message);
    }
    toast.success('ذخیره شد');
    setEditing(null);
    load();
  };

  const toggleActiveType = async (t: ServiceType) => {
    const { error } = await supabase.from('service_types_v3')
      .update({ is_active: !t.is_active }).eq('id', t.id);
    if (error) return toast.error(error.message);
    load();
  };
  const toggleActiveSub = async (s: Sub) => {
    const { error } = await supabase.from('subcategories')
      .update({ is_active: !s.is_active }).eq('id', s.id);
    if (error) return toast.error(error.message);
    load();
  };

  const deleteType = async (t: ServiceType) => {
    const { error } = await supabase.from('service_types_v3').delete().eq('id', t.id);
    if (error) return toast.error('حذف نشد: ' + error.message);
    toast.success('حذف شد');
    load();
  };
  const deleteSub = async (s: Sub) => {
    const { error } = await supabase.from('subcategories').delete().eq('id', s.id);
    if (error) return toast.error('حذف نشد: ' + error.message);
    toast.success('حذف شد');
    load();
  };

  const addRoot = async () => {
    if (!newRootName.trim()) return;
    const code = String(Math.floor(Date.now() / 1000)).slice(-6);
    const { error } = await supabase.from('service_types_v3').insert({
      name: newRootName.trim(),
      code,
      is_active: true,
      sort_order: types.length,
    } as any);
    if (error) return toast.error(error.message);
    setNewRootName('');
    toast.success('خدمت جدید ایجاد شد');
    load();
  };

  const addChildSub = async (serviceTypeId: string, parentId: string | null, depth: number) => {
    if (depth > DEPTH_MAX) return toast.error(`حداکثر عمق ${DEPTH_MAX} سطح مجاز است`);
    const name = window.prompt('نام زیرشاخه جدید:');
    if (!name || !name.trim()) return;
    const code = String(Math.floor(Date.now() / 1000)).slice(-6);
    const { error } = await supabase.from('subcategories').insert({
      name: name.trim(),
      code,
      service_type_id: serviceTypeId,
      parent_id: parentId,
      is_active: true,
      sort_order: 0,
      form_path: null,
    } as any);
    if (error) return toast.error(error.message);
    toast.success('زیرشاخه اضافه شد');
    if (parentId) setExpanded(prev => new Set(prev).add(parentId));
    load();
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  if (!isCEO) return <Navigate to="/" replace />;

  const renderSub = (s: Sub, serviceTypeId: string, depth: number) => {
    const isEditing = editing?.kind === 'sub' && editing.id === s.id;
    const hasChildren = s.children.length > 0;
    const canAddChild = depth < DEPTH_MAX;
    const isOpen = expanded.has(s.id);
    return (
      <div key={s.id} className="ml-4 border-r-2 border-muted pr-3 my-1.5">
        <div className={cn(
          "flex items-center gap-2 flex-wrap p-2 rounded-md border",
          s.is_active ? "bg-background" : "bg-muted/40 opacity-70"
        )}>
          {hasChildren ? (
            <button onClick={() => toggleExpand(s.id)} className="p-1 hover:bg-accent rounded">
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          ) : <span className="w-6" />}
          {isEditing ? (
            <div className="flex-1 flex flex-col sm:flex-row gap-2">
              <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="نام" className="text-right" />
              <Input value={editCode} onChange={e => setEditCode(e.target.value)} placeholder="کد" className="text-right w-24" />
              <Input value={editForm} onChange={e => setEditForm(e.target.value)} placeholder="مسیر فرم (مثلاً /scaffolding/form)" className="text-right flex-1" />
              <Button size="sm" onClick={saveEdit}><Save className="h-4 w-4" /></Button>
              <Button size="sm" variant="ghost" onClick={cancelEdit}><X className="h-4 w-4" /></Button>
            </div>
          ) : (
            <>
              <span className="flex-1 font-medium text-right">{s.name}</span>
              <span className="text-xs text-muted-foreground">کد: {s.code}</span>
              {s.form_path && <span className="text-xs text-blue-600 truncate max-w-[160px]">{s.form_path}</span>}
              <Switch checked={s.is_active} onCheckedChange={() => toggleActiveSub(s)} />
              {canAddChild && (
                <Button size="sm" variant="outline" onClick={() => addChildSub(serviceTypeId, s.id, depth + 1)} title="افزودن زیرشاخه">
                  <Plus className="h-4 w-4" />
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setPricingSub(s)} title="قیمت‌گذاری فرم">قیمت فرم</Button>
              <Button size="sm" variant="ghost" onClick={() => startEditSub(s)}><Pencil className="h-4 w-4" /></Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="ghost" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                </AlertDialogTrigger>
                <AlertDialogContent dir="rtl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>حذف زیرشاخه؟</AlertDialogTitle>
                    <AlertDialogDescription>«{s.name}» و همه زیرشاخه‌های آن حذف می‌شود.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>انصراف</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteSub(s)}>حذف</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
        {isOpen && hasChildren && (
          <div className="mt-1">
            {s.children.map(c => renderSub(c, serviceTypeId, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-6 w-6 text-primary" />
              ماژول مدیریت خدمات داینامیک
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              ساختار خدمات نمایش‌داده‌شده در صفحه اصلی را مدیریت کنید. مسیر فرم هر برگ سفارش را مشخص می‌کند.
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-6">
              <Input
                value={newRootName}
                onChange={e => setNewRootName(e.target.value)}
                placeholder="نام خدمت اصلی جدید (مثلاً برق‌کاری)"
                className="text-right"
              />
              <Button onClick={addRoot}><Plus className="h-4 w-4 ml-1" /> افزودن خدمت</Button>
            </div>

            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : (
              <div className="space-y-3">
                {types.map(t => {
                  const isOpen = expanded.has(t.id);
                  const roots = tree.roots[t.id] || [];
                  const isEditingType = editing?.kind === 'type' && editing.id === t.id;
                  return (
                    <div key={t.id} className={cn("border rounded-lg p-3", !t.is_active && "opacity-60 bg-muted/30")}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={() => toggleExpand(t.id)} className="p-1 hover:bg-accent rounded">
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                        </button>
                        <FolderTree className="h-5 w-5 text-primary" />
                        {isEditingType ? (
                          <div className="flex-1 flex gap-2">
                            <Input value={editName} onChange={e => setEditName(e.target.value)} className="text-right" />
                            <Input value={editCode} onChange={e => setEditCode(e.target.value)} className="text-right w-24" placeholder="کد" />
                            <Button size="sm" onClick={saveEdit}><Save className="h-4 w-4" /></Button>
                            <Button size="sm" variant="ghost" onClick={cancelEdit}><X className="h-4 w-4" /></Button>
                          </div>
                        ) : (
                          <>
                            <span className="flex-1 font-bold text-right">{t.name}</span>
                            <span className="text-xs text-muted-foreground">کد: {t.code}</span>
                            <Switch checked={t.is_active} onCheckedChange={() => toggleActiveType(t)} />
                            <Button size="sm" variant="outline" onClick={() => addChildSub(t.id, null, 1)}>
                              <Plus className="h-4 w-4 ml-1" /> زیرشاخه
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => startEditType(t)}><Pencil className="h-4 w-4" /></Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="ghost" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent dir="rtl">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>حذف خدمت؟</AlertDialogTitle>
                                  <AlertDialogDescription>«{t.name}» و همه زیرشاخه‌های آن حذف می‌شود. این عمل بازگشت‌پذیر نیست.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>انصراف</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteType(t)}>حذف</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                      </div>
                      {isOpen && (
                        <div className="mt-2">
                          {roots.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-4">زیرشاخه‌ای ندارد.</p>
                          ) : roots.map(r => renderSub(r, t.id, 1))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
        <ServicePricingRatesDialog
          open={!!pricingSub}
          onOpenChange={(o) => !o && setPricingSub(null)}
          subcategory={pricingSub}
          serviceName={types.find(t => t.id === pricingSub?.service_type_id)?.name || ''}
        />
      </div>
    </div>
  );
}
