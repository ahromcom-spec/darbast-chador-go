import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, Search, X } from "lucide-react";

export interface SmsServiceOption {
  id: string;
  name: string;
  typeName: string;
  active: boolean;
}

export const serviceLabel = (s: SmsServiceOption | undefined) =>
  s ? `${s.typeName} › ${s.name}` : "خدمت حذف‌شده";

export function groupServices(services: SmsServiceOption[]) {
  const groups = new Map<string, SmsServiceOption[]>();
  for (const s of services) groups.set(s.typeName, [...(groups.get(s.typeName) || []), s]);
  return [...groups.entries()];
}

interface ListProps {
  services: SmsServiceOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  /** خدماتی که قابل انتخاب نیستند و دلیلش */
  blocked?: Record<string, string>;
}

/** فهرست خدمات گروه‌بندی‌شده بر اساس نوع خدمت با امکان انتخاب کل گروه */
export function SmsServiceList({ services, value, onChange, blocked = {} }: ListProps) {
  const [q, setQ] = useState("");
  const selected = new Set(value);
  const filtered = useMemo(() => {
    const t = q.trim();
    return t ? services.filter((s) => `${s.typeName} ${s.name}`.includes(t)) : services;
  }, [services, q]);
  const toggle = (id: string, on: boolean) => {
    const next = new Set(selected);
    on ? next.add(id) : next.delete(id);
    onChange([...next]);
  };
  return (
    <div className="space-y-2" dir="rtl">
      <div className="relative">
        <Search className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input className="h-8 pr-7 text-xs" placeholder="جستجوی خدمت..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="max-h-72 overflow-y-auto space-y-3 pl-1">
        {groupServices(filtered).map(([typeName, list]) => {
          const selectable = list.filter((s) => !blocked[s.id]);
          const allOn = selectable.length > 0 && selectable.every((s) => selected.has(s.id));
          return (
            <div key={typeName} className="rounded-md border p-2">
              <label className="flex items-center gap-2 text-xs font-semibold mb-1 cursor-pointer">
                <Checkbox
                  checked={allOn}
                  disabled={selectable.length === 0}
                  onCheckedChange={(v) => {
                    const next = new Set(selected);
                    selectable.forEach((s) => (v ? next.add(s.id) : next.delete(s.id)));
                    onChange([...next]);
                  }}
                />
                {typeName}
                <span className="text-[10px] font-normal text-muted-foreground">(همه زیرشاخه‌ها)</span>
              </label>
              <div className="space-y-1 pr-5">
                {list.map((s) => (
                  <label key={s.id} className={"flex items-center gap-2 text-xs " + (blocked[s.id] ? "opacity-60" : "cursor-pointer")}>
                    <Checkbox
                      checked={selected.has(s.id)}
                      disabled={!!blocked[s.id] && !selected.has(s.id)}
                      onCheckedChange={(v) => toggle(s.id, !!v)}
                    />
                    <span>{s.name}</span>
                    {!s.active && <Badge variant="outline" className="text-[9px] h-4 px-1">غیرفعال در سایت</Badge>}
                    {blocked[s.id] && <span className="text-[10px] text-muted-foreground">— {blocked[s.id]}</span>}
                  </label>
                ))}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">خدمتی یافت نشد.</p>}
      </div>
    </div>
  );
}

interface PickerProps extends ListProps {
  placeholder: string;
  tone?: "target" | "exclude";
}

/** انتخاب‌گر خدمات به شکل دکمه بازشونده + نمایش برچسب انتخاب‌ها */
export function SmsServicePicker({ services, value, onChange, blocked, placeholder, tone = "target" }: PickerProps) {
  const byId = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);
  return (
    <div className="space-y-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs justify-between w-full sm:w-auto gap-2">
            {value.length ? `${value.length.toLocaleString("fa-IR")} خدمت انتخاب شده` : placeholder}
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <SmsServiceList services={services} value={value} onChange={onChange} blocked={blocked} />
        </PopoverContent>
      </Popover>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((id) => (
            <Badge key={id} variant={tone === "exclude" ? "destructive" : "secondary"} className="gap-1 text-[11px] font-normal">
              {serviceLabel(byId.get(id))}
              <button type="button" aria-label="حذف" onClick={() => onChange(value.filter((v) => v !== id))}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
