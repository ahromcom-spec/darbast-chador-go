import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { PhoneLink } from '@/components/ui/PhoneLink';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeftRight, ChevronDown, ChevronUp, Folder, FolderOpen, MapPin, Search, User, UserPlus, Users, Archive, X } from 'lucide-react';
import {
  actionableOrders,
  archivedOrderCount,
  buildCustomerProjectsTree,
  filterCustomerProjectsTree,
  isActiveCollaboratorStatus,
  type AddressNode,
  type CustomerNode,
  type ProjectNode,
  type TreeCustomerMeta,
  type TreeLocationMeta,
  type TreeOrderInput,
  type TreeProjectMeta,
} from '@/lib/customerProjectsTree';
import { BulkProjectActionDialog, type BulkActionMode } from '@/components/executive/BulkProjectActionDialog';

const fa = (n: number) => new Intl.NumberFormat('fa-IR').format(n);
const CHUNK = 150;

async function inChunks<T>(ids: string[], fetcher: (chunk: string[]) => Promise<T[]>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) out.push(...(await fetcher(ids.slice(i, i + CHUNK))));
  return out;
}

const STAGE_LABELS: Record<string, string> = {
  awaiting_payment: 'در انتظار پرداخت',
  order_executed: 'اجرا شد',
  awaiting_collection: 'در انتظار جمع‌آوری',
  in_collection: 'در حال جمع‌آوری',
  collected: 'جمع‌آوری شد',
};
const STATUS_LABELS: Record<string, string> = {
  draft: 'پیش‌نویس',
  pending: 'در انتظار تایید',
  pending_execution: 'در انتظار اجرا',
  approved: 'تایید شده',
  rejected: 'رد شده',
  scheduled: 'زمان‌بندی شده',
  in_progress: 'در حال اجرا',
  active: 'فعال',
  completed: 'تکمیل شده',
  paid: 'پرداخت شده',
  closed: 'بسته شده',
};
const orderStateLabel = (o: TreeOrderInput) =>
  o.is_archived ? 'بایگانی' : (o.execution_stage && STAGE_LABELS[o.execution_stage]) || STATUS_LABELS[o.status || ''] || o.status || '';

interface ActionTarget {
  mode: BulkActionMode;
  scopeLabel: string;
  projects: ProjectNode[];
  customer: CustomerNode;
}

export function CustomerProjectsTab() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const moduleKey = searchParams.get('moduleKey') || '';
  const [loading, setLoading] = useState(true);
  const [tree, setTree] = useState<CustomerNode[]>([]);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'active' | 'all'>('active');
  const [openCustomers, setOpenCustomers] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [action, setAction] = useState<ActionTarget | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const orders: any[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from('projects_v3')
          .select('id, code, customer_id, hierarchy_project_id, status, execution_stage, is_archived, address, detailed_address, created_at')
          .not('is_deep_archived', 'is', true)
          .order('created_at', { ascending: false })
          .range(from, from + 999);
        if (error) throw error;
        orders.push(...(data || []));
        if (!data || data.length < 1000) break;
      }

      const orderIds = orders.map((o) => o.id);
      const customerIds = Array.from(new Set(orders.map((o) => o.customer_id).filter(Boolean))) as string[];
      const hierIds = Array.from(new Set(orders.map((o) => o.hierarchy_project_id).filter(Boolean))) as string[];

      const [customerRows, hierRows, collabRows] = await Promise.all([
        inChunks(customerIds, async (c) => (await supabase.from('customers').select('id, user_id').in('id', c)).data || []),
        inChunks(hierIds, async (c) =>
          (await supabase.from('projects_hierarchy').select('id, location_id, title, service_types_v3(name), subcategories(name)').in('id', c)).data || [],
        ),
        inChunks(orderIds, async (c) =>
          (await supabase.from('order_collaborators').select('order_id, invitee_phone_number, invitee_user_id, status').in('order_id', c)).data || [],
        ),
      ]);

      const locIds = Array.from(new Set((hierRows as any[]).map((h) => h.location_id).filter(Boolean))) as string[];
      const activeCollabs = (collabRows as any[]).filter((c) => isActiveCollaboratorStatus(c.status));
      const userIds = Array.from(
        new Set([
          ...(customerRows as any[]).map((c) => c.user_id),
          ...activeCollabs.map((c) => c.invitee_user_id),
        ].filter(Boolean)),
      ) as string[];

      const [locRows, profileRows] = await Promise.all([
        inChunks(locIds, async (c) => (await supabase.from('locations').select('id, title, address_line').in('id', c)).data || []),
        inChunks(userIds, async (c) =>
          (await supabase.from('profiles').select('user_id, full_name, phone_number, customer_code').in('user_id', c)).data || [],
        ),
      ]);

      const profileByUser = new Map((profileRows as any[]).map((p) => [p.user_id, p]));
      const customers = new Map<string, TreeCustomerMeta>(
        (customerRows as any[]).map((c) => {
          const p = profileByUser.get(c.user_id);
          return [c.id, { user_id: c.user_id, full_name: p?.full_name ?? null, phone_number: p?.phone_number ?? null, customer_code: p?.customer_code ?? null }];
        }),
      );
      const projects = new Map<string, TreeProjectMeta>(
        (hierRows as any[]).map((h) => [
          h.id,
          {
            id: h.id,
            location_id: h.location_id,
            title: h.title,
            service_label: [h.service_types_v3?.name, h.subcategories?.name].filter(Boolean).join(' - ') || 'خدمات',
          },
        ]),
      );
      const locations = new Map<string, TreeLocationMeta>((locRows as any[]).map((l) => [l.id, l]));
      const collabByOrder = new Map<string, string[]>();
      for (const c of activeCollabs) {
        const name = (c.invitee_user_id && profileByUser.get(c.invitee_user_id)?.full_name) || c.invitee_phone_number;
        const list = collabByOrder.get(c.order_id) || [];
        if (!list.includes(name)) list.push(name);
        collabByOrder.set(c.order_id, list);
      }

      const input: TreeOrderInput[] = orders.map((o) => ({ ...o, collaborators: collabByOrder.get(o.id) || [] }));
      setTree(buildCustomerProjectsTree(input, customers, projects, locations));
    } catch (e: any) {
      console.error(e);
      toast({ title: 'خطا', description: e.message || 'بارگذاری پروژه‌ها ناموفق بود', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const viewTree = useMemo(() => {
    if (view === 'all') return tree;
    return tree
      .map((c) => ({
        ...c,
        addresses: c.addresses
          .map((a) => ({ ...a, projects: a.projects.filter((p) => p.orders.some((o) => !o.is_archived)) }))
          .filter((a) => a.projects.length > 0),
      }))
      .filter((c) => c.addresses.length > 0);
  }, [tree, view]);

  const filtered = useMemo(() => filterCustomerProjectsTree(viewTree, search), [viewTree, search]);
  const searching = search.trim().length > 0;

  const toggleCustomer = (id: string) =>
    setOpenCustomers((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleProject = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const setAddressSelection = (a: AddressNode, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      a.projects.forEach((p) => (on ? next.add(p.id) : next.delete(p.id)));
      return next;
    });

  const openAction = (mode: BulkActionMode, customer: CustomerNode, projects: ProjectNode[], scopeLabel: string) =>
    setAction({ mode, customer, projects, scopeLabel });

  const actionOrders = action ? actionableOrders(action.projects) : [];

  const totals = useMemo(() => {
    let addresses = 0;
    let projects = 0;
    for (const c of filtered) {
      addresses += c.addresses.length;
      for (const a of c.addresses) projects += a.projects.length;
    }
    return { customers: filtered.length, addresses, projects };
  }, [filtered]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4" dir="rtl">
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="جستجوی نام، موبایل یا کد مشتری، آدرس، نوع خدمت، کد سفارش یا همکار..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <Button size="sm" variant={view === 'active' ? 'default' : 'outline'} className="gap-1" onClick={() => setView('active')}>
              <FolderOpen className="h-3.5 w-3.5" /> پروژه‌های فعال
            </Button>
            <Button size="sm" variant={view === 'all' ? 'default' : 'outline'} className="gap-1" onClick={() => setView('all')}>
              <Archive className="h-3.5 w-3.5" /> همه همراه بایگانی
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            {fa(totals.customers)} مشتری · {fa(totals.addresses)} آدرس · {fa(totals.projects)} پروژه
          </p>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">پروژه‌ای یافت نشد</CardContent>
        </Card>
      ) : (
        filtered.map((c) => {
          const isOpen = searching || openCustomers.has(c.customerId);
          const projectCount = c.addresses.reduce((n, a) => n + a.projects.length, 0);
          return (
            <Collapsible key={c.customerId} open={isOpen} onOpenChange={() => toggleCustomer(c.customerId)}>
              <Card>
                <CollapsibleTrigger className="w-full text-right">
                  <CardHeader className="p-4 cursor-pointer hover:bg-muted/40">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-3">
                        <User className="h-5 w-5 text-primary" />
                        <div>
                          <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                            {c.fullName}
                            {c.customerCode && (
                              <span className="text-[11px] font-mono bg-primary/10 text-primary px-2 py-0.5 rounded">کد: {c.customerCode}</span>
                            )}
                          </CardTitle>
                          {c.phone && (
                            <div className="text-xs text-muted-foreground mt-1" onClick={(e) => e.stopPropagation()}>
                              <PhoneLink phone={c.phone} />
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{fa(c.addresses.length)} آدرس</Badge>
                        <Badge variant="outline">{fa(projectCount)} پروژه</Badge>
                        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <CardContent className="p-3 pt-0 space-y-3">
                    {c.addresses.map((a) => {
                      const chosen = a.projects.filter((p) => selected.has(p.id));
                      const allChosen = chosen.length === a.projects.length;
                      const addrLabel = `آدرس «${a.title || a.addressLine}»`;
                      return (
                        <div key={a.key} className="rounded-lg border bg-muted/30">
                          <div className="p-3 flex items-start justify-between gap-3 flex-wrap">
                            <div className="flex items-start gap-2 min-w-0">
                              <Checkbox
                                className="mt-1"
                                checked={allChosen ? true : chosen.length ? 'indeterminate' : false}
                                onCheckedChange={(v) => setAddressSelection(a, v === true)}
                                aria-label="انتخاب همه پروژه‌های این آدرس"
                              />
                              <FolderOpen className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                              <div className="min-w-0">
                                {a.title && <p className="text-xs text-muted-foreground">{a.title}</p>}
                                <p className="text-sm font-medium flex items-center gap-1">
                                  <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                  <span className="break-words">{a.addressLine}</span>
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="secondary">{fa(a.projects.length)} پروژه</Badge>
                              <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => openAction('transfer', c, a.projects, addrLabel)}>
                                <ArrowLeftRight className="h-3.5 w-3.5" /> انتقال آدرس
                              </Button>
                              <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => openAction('collaborate', c, a.projects, addrLabel)}>
                                <UserPlus className="h-3.5 w-3.5" /> همکار برای آدرس
                              </Button>
                            </div>
                          </div>

                          {chosen.length > 0 && (
                            <div className="mx-3 mb-2 flex items-center justify-between gap-2 flex-wrap rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
                              <span>{allChosen ? `همه ${fa(chosen.length)} پروژه این آدرس انتخاب شده` : `${fa(chosen.length)} از ${fa(a.projects.length)} پروژه این آدرس انتخاب شده`}</span>
                              <div className="flex gap-2">
                                <Button size="sm" className="h-8 gap-1" onClick={() => openAction('transfer', c, chosen, `${fa(chosen.length)} پروژه انتخاب‌شده`)}>
                                  <ArrowLeftRight className="h-3.5 w-3.5" /> انتقال
                                </Button>
                                <Button size="sm" variant="secondary" className="h-8 gap-1" onClick={() => openAction('collaborate', c, chosen, `${fa(chosen.length)} پروژه انتخاب‌شده`)}>
                                  <UserPlus className="h-3.5 w-3.5" /> افزودن همکار
                                </Button>
                                <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setAddressSelection(a, false)} aria-label="لغو انتخاب">
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          )}

                          <div className="px-3 pb-3 space-y-2">
                            {a.projects.map((p) => {
                              const visibleOrders = view === 'all' ? p.orders : p.orders.filter((o) => !o.is_archived);
                              const collaborators = Array.from(new Set(p.orders.flatMap((o) => o.collaborators || [])));
                              return (
                                <div key={p.id} className="rounded-md border bg-card p-3">
                                  <div className="flex items-start justify-between gap-3 flex-wrap">
                                    <div className="flex items-start gap-2 min-w-0">
                                      <Checkbox
                                        className="mt-0.5"
                                        checked={selected.has(p.id)}
                                        onCheckedChange={() => toggleProject(p.id)}
                                        aria-label={`انتخاب پروژه ${p.serviceLabel}`}
                                      />
                                      <Folder className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                      <div className="min-w-0">
                                        <p className="text-sm font-medium">{p.serviceLabel}</p>
                                        {p.title && <p className="text-xs text-muted-foreground">{p.title}</p>}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <Badge variant="outline">{fa(visibleOrders.length)} سفارش</Badge>
                                      <Button size="sm" variant="ghost" className="h-8 gap-1" onClick={() => openAction('transfer', c, [p], `پروژه «${p.serviceLabel}»`)}>
                                        <ArrowLeftRight className="h-3.5 w-3.5" /> انتقال
                                      </Button>
                                      <Button size="sm" variant="ghost" className="h-8 gap-1" onClick={() => openAction('collaborate', c, [p], `پروژه «${p.serviceLabel}»`)}>
                                        <UserPlus className="h-3.5 w-3.5" /> همکار
                                      </Button>
                                    </div>
                                  </div>

                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    {visibleOrders.map((o) => (
                                      <button
                                        key={o.id}
                                        type="button"
                                        onClick={() => navigate(`/executive/all-orders?orderId=${o.id}${moduleKey ? `&moduleKey=${moduleKey}` : ''}`)}
                                        className={`text-[11px] rounded border px-2 py-0.5 hover:bg-accent/20 ${o.is_archived ? 'opacity-60' : ''}`}
                                        title="باز کردن جزئیات سفارش"
                                      >
                                        <span className="font-mono">{o.code}</span>
                                        <span className="text-muted-foreground"> · {orderStateLabel(o)}</span>
                                      </button>
                                    ))}
                                  </div>

                                  {collaborators.length > 0 && (
                                    <div className="mt-2 flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground">
                                      <Users className="h-3.5 w-3.5" /> همکاران:
                                      {collaborators.map((n) => (
                                        <span key={n} className="rounded bg-secondary px-1.5 py-0.5 text-secondary-foreground">{n}</span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })
      )}

      {action && (
        <BulkProjectActionDialog
          open={!!action}
          onOpenChange={(o) => !o && setAction(null)}
          mode={action.mode}
          scopeLabel={action.scopeLabel}
          orders={actionOrders}
          archivedCount={archivedOrderCount(action.projects)}
          ownerPhone={action.customer.phone}
          onDone={() => {
            setSelected(new Set());
            load();
          }}
        />
      )}
    </div>
  );
}
