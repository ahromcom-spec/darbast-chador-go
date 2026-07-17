import { useState } from 'react';
import { ExternalLink, FolderOpen, Calendar, UserPlus, ShoppingCart, ClipboardList } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';

export interface ParsedModuleOpen {
  module_key: string;
  label?: string;
  summary?: string;
  route?: string;
  params?: Record<string, string | number | undefined | null>;
}

interface Props { data: ParsedModuleOpen }

const MODULE_META: Record<string, { route: string; title: string; icon: any; color: string }> = {
  daily_report: { route: '/daily-report', title: 'ماژول گزارش روزانه کلی اهرم', icon: ClipboardList, color: 'blue' },
  daily_report_executive: { route: '/daily-report', title: 'ماژول گزارش روزانه اجرایی اهرم', icon: ClipboardList, color: 'red' },
  daily_report_support: { route: '/daily-report', title: 'ماژول گزارش روزانه پشتیبانی اهرم', icon: ClipboardList, color: 'amber' },
  daily_report_management: { route: '/daily-report', title: 'ماژول گزارش روزانه مدیریت اهرم', icon: ClipboardList, color: 'purple' },
  site_registration: { route: '/site-registration', title: 'ماژول ثبت‌نام در سایت اهرم', icon: UserPlus, color: 'green' },
  new_order: { route: '/user/create-project', title: 'ثبت سفارش جدید', icon: ShoppingCart, color: 'orange' },
};

const persianDigits = (s: string) => s.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);

const formatPersianDate = (iso?: string): string | null => {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric', month: 'long', day: 'numeric',
    }).format(d);
  } catch {
    return null;
  }
};

export const ModuleOpenCard = ({ data }: Props) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const meta = MODULE_META[data.module_key] || {
    route: data.route || '/',
    title: data.label || 'باز کردن ماژول',
    icon: FolderOpen,
    color: 'blue',
  };
  const Icon = meta.icon;

  const params = data.params || {};
  const dateParam = typeof params.date === 'string' ? params.date : undefined;
  const persianDate = formatPersianDate(dateParam);

  const displayTitle = data.label || meta.title;

  const buildUrl = () => {
    const route = data.route || meta.route;
    const usp = new URLSearchParams();

    // Daily-report family: always include moduleKey so the correct module opens
    if (data.module_key.startsWith('daily_report')) {
      usp.set('moduleKey', data.module_key);
      if (dateParam) usp.set('date', dateParam);
    } else if (data.module_key === 'site_registration') {
      if (params.phone) usp.set('phone', String(params.phone));
      if (params.name) usp.set('name', String(params.name));
    } else {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') usp.set(k, String(v));
      });
    }
    const qs = usp.toString();
    return qs ? `${route}?${qs}` : route;
  };

  const handleOpen = () => {
    setOpen(false);
    navigate(buildUrl());
  };

  return (
    <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-3 space-y-3" dir="rtl">
      <div className="flex items-center gap-2 text-blue-700 font-bold text-sm">
        <Icon className="w-4 h-4" />
        <span>{displayTitle}</span>
      </div>

      {data.summary && (
        <div className="text-xs text-blue-900/80 leading-6 whitespace-pre-line">{data.summary}</div>
      )}

      <div className="grid grid-cols-1 gap-1.5 text-[11px] text-blue-900/80">
        {persianDate && (
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3 h-3" />
            <span>تاریخ: {persianDigits(persianDate)}</span>
          </div>
        )}
        {params.phone && (
          <div>📱 شماره: {persianDigits(String(params.phone))}</div>
        )}
        {params.name && (
          <div>👤 نام: {String(params.name)}</div>
        )}
      </div>

      <Button
        onClick={() => setOpen(true)}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
      >
        <ExternalLink className="w-4 h-4 ml-2" />
        باز کردن ماژول
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle>تایید باز کردن ماژول</DialogTitle>
            <DialogDescription className="pt-2 text-right leading-7">
              آیا می‌خواهید <span className="font-bold">{displayTitle}</span>
              {persianDate && <> برای تاریخ <span className="font-bold">{persianDigits(persianDate)}</span></>}
              {' '}باز شود؟
              {params.phone && (
                <div className="mt-2 text-xs">شماره پیش‌پر: {persianDigits(String(params.phone))}</div>
              )}
              {params.name && (
                <div className="text-xs">نام پیش‌پر: {String(params.name)}</div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>انصراف</Button>
            <Button onClick={handleOpen} className="bg-blue-600 hover:bg-blue-700 text-white">
              <ExternalLink className="w-4 h-4 ml-2" />
              باز کن
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export function parseModuleOpens(content: string): { cleanText: string; opens: ParsedModuleOpen[] } {
  const re = /<<AHROM_OPEN_MODULE>>([\s\S]*?)<<END_MODULE>>/g;
  const opens: ParsedModuleOpen[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(m[1].trim());
      if (parsed && typeof parsed.module_key === 'string') opens.push(parsed);
    } catch { /* skip */ }
  }
  const cleanText = content.replace(re, '').trim();
  return { cleanText, opens };
}
