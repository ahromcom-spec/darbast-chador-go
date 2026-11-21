/**
 * درخت «پروژه‌های مشتریان» برای مدیریت: مشتری ← آدرس ← پروژه ← سفارش.
 * خالص و بدون شبکه تا قواعد انتخاب/جستجو قابل آزمون باشند.
 */

export interface TreeOrderInput {
  id: string;
  code: string | null;
  customer_id: string;
  hierarchy_project_id: string | null;
  status: string | null;
  execution_stage: string | null;
  is_archived: boolean | null;
  address: string | null;
  detailed_address: string | null;
  created_at: string;
  collaborators?: string[];
}

export interface TreeCustomerMeta {
  full_name: string | null;
  phone_number: string | null;
  customer_code: string | null;
  user_id: string | null;
}

export interface TreeProjectMeta {
  id: string;
  location_id: string | null;
  title: string | null;
  service_label: string;
}

export interface TreeLocationMeta {
  id: string;
  title: string | null;
  address_line: string | null;
}

export interface ProjectNode {
  id: string;
  title: string;
  serviceLabel: string;
  orders: TreeOrderInput[];
}

export interface AddressNode {
  key: string;
  locationId: string | null;
  title: string;
  addressLine: string;
  projects: ProjectNode[];
}

export interface CustomerNode {
  customerId: string;
  userId: string | null;
  fullName: string;
  phone: string;
  customerCode: string | null;
  addresses: AddressNode[];
  orderCount: number;
}

const fold = (s: string | null | undefined) =>
  (s || '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\u200c/g, ' ')
    .toLowerCase()
    .trim();

export function buildCustomerProjectsTree(
  orders: TreeOrderInput[],
  customers: Map<string, TreeCustomerMeta>,
  projects: Map<string, TreeProjectMeta>,
  locations: Map<string, TreeLocationMeta>,
): CustomerNode[] {
  const byCustomer = new Map<string, CustomerNode>();
  const addrIndex = new Map<string, AddressNode>();
  const projIndex = new Map<string, ProjectNode>();

  const sorted = [...orders].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  for (const o of sorted) {
    let c = byCustomer.get(o.customer_id);
    if (!c) {
      const meta = customers.get(o.customer_id);
      c = {
        customerId: o.customer_id,
        userId: meta?.user_id ?? null,
        fullName: meta?.full_name || 'بدون نام',
        phone: meta?.phone_number || '',
        customerCode: meta?.customer_code ?? null,
        addresses: [],
        orderCount: 0,
      };
      byCustomer.set(o.customer_id, c);
    }
    c.orderCount += 1;

    const proj = o.hierarchy_project_id ? projects.get(o.hierarchy_project_id) : undefined;
    const locId = proj?.location_id ?? null;
    const loc = locId ? locations.get(locId) : undefined;
    const addrKey = `${o.customer_id}:${locId ?? `addr:${fold(o.address)}`}`;
    let a = addrIndex.get(addrKey);
    if (!a) {
      a = {
        key: addrKey,
        locationId: locId,
        title: loc?.title || o.detailed_address || '',
        addressLine: loc?.address_line || o.address || 'بدون آدرس',
        projects: [],
      };
      addrIndex.set(addrKey, a);
      c.addresses.push(a);
    }

    const projKey = o.hierarchy_project_id || `order:${o.id}`;
    let p = projIndex.get(projKey);
    if (!p) {
      p = {
        id: projKey,
        title: proj?.title || '',
        serviceLabel: proj?.service_label || 'خدمات',
        orders: [],
      };
      projIndex.set(projKey, p);
      a.projects.push(p);
    }
    p.orders.push(o);
  }
  return Array.from(byCustomer.values());
}

/** جستجو مثل صورتحساب: نام، موبایل، کد مشتری، آدرس، نوع خدمت یا کد سفارش. */
export function filterCustomerProjectsTree(tree: CustomerNode[], query: string): CustomerNode[] {
  const q = fold(query);
  if (!q) return tree;
  const out: CustomerNode[] = [];
  for (const c of tree) {
    const customerHit = [c.fullName, c.phone, c.customerCode].some((v) => fold(v).includes(q));
    if (customerHit) {
      out.push(c);
      continue;
    }
    const addresses: AddressNode[] = [];
    for (const a of c.addresses) {
      const addrHit = fold(a.title).includes(q) || fold(a.addressLine).includes(q);
      if (addrHit) {
        addresses.push(a);
        continue;
      }
      const projects = a.projects.filter(
        (p) =>
          fold(p.serviceLabel).includes(q) ||
          fold(p.title).includes(q) ||
          p.orders.some((o) => fold(o.code).includes(q) || (o.collaborators || []).some((n) => fold(n).includes(q))),
      );
      if (projects.length) addresses.push({ ...a, projects });
    }
    if (addresses.length) out.push({ ...c, addresses });
  }
  return out;
}

/** فقط سفارش‌های فعال (بایگانی‌نشده) هدف انتقال یا همکاری قرار می‌گیرند. */
export function actionableOrders(projects: ProjectNode[]): TreeOrderInput[] {
  const seen = new Set<string>();
  const out: TreeOrderInput[] = [];
  for (const p of projects) {
    for (const o of p.orders) {
      if (o.is_archived || seen.has(o.id)) continue;
      seen.add(o.id);
      out.push(o);
    }
  }
  return out;
}

export function archivedOrderCount(projects: ProjectNode[]): number {
  return projects.reduce((n, p) => n + p.orders.filter((o) => o.is_archived).length, 0);
}

const INACTIVE_COLLAB = ['rejected', 'manager_rejected', 'exited', 'cancelled', 'canceled'];

export interface ExistingCollaborator {
  order_id: string;
  invitee_phone_number: string;
  status: string;
}

/**
 * سفارش‌هایی که همکار جدید باید به آن‌ها اضافه شود:
 * سفارشی که همین شماره از قبل همکار فعالش است یا صاحبش همین شخص است، تکرار نمی‌شود.
 */
export function collaboratorTargets(
  orderIds: string[],
  phone: string,
  existing: ExistingCollaborator[],
  ownerPhoneByOrder: Map<string, string>,
): { add: string[]; alreadyCollaborator: string[]; owner: string[] } {
  const active = new Set(
    existing
      .filter((c) => c.invitee_phone_number === phone && !INACTIVE_COLLAB.includes(c.status))
      .map((c) => c.order_id),
  );
  const add: string[] = [];
  const alreadyCollaborator: string[] = [];
  const owner: string[] = [];
  for (const id of orderIds) {
    if (ownerPhoneByOrder.get(id) === phone) owner.push(id);
    else if (active.has(id)) alreadyCollaborator.push(id);
    else add.push(id);
  }
  return { add, alreadyCollaborator, owner };
}

export function isActiveCollaboratorStatus(status: string): boolean {
  return !INACTIVE_COLLAB.includes(status);
}
