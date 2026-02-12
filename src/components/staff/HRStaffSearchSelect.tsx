import { useState, useEffect, useMemo } from 'react';
import { Search, User, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface HREmployee {
  id: string;
  phone_number: string;
  full_name: string;
  position: string | null;
  department: string | null;
  status: string;
}

interface HRStaffSearchSelectProps {
  value: string;
  onValueChange: (value: string, staffName: string) => void;
  placeholder?: string;
  filterActive?: boolean;
}

// ---- Shared cache (prevents repeated fetch on each open across the app) ----
const EMP_CACHE_TTL_MS = 2 * 60 * 1000;

type EmployeeCacheData = {
  activeOnly: HREmployee[];
  all: HREmployee[];
};

let employeeCache: { fetchedAt: number; data: EmployeeCacheData } | null = null;
let employeePromise: Promise<EmployeeCacheData> | null = null;

const loadEmployeesCached = async (): Promise<EmployeeCacheData> => {
  const now = Date.now();

  if (employeeCache && now - employeeCache.fetchedAt < EMP_CACHE_TTL_MS) {
    return employeeCache.data;
  }

  if (employeePromise) return employeePromise;

  employeePromise = (async () => {
    const { data, error } = await supabase
      .from('hr_employees')
      .select('id, phone_number, full_name, position, department, status')
      .order('full_name', { ascending: true });

    if (error) throw error;

    const all = ((data as HREmployee[]) || []).filter((e) => e.full_name);
    const activeOnly = all.filter((e) => ['active', 'pending_registration'].includes(e.status));

    const result: EmployeeCacheData = { all, activeOnly };
    employeeCache = { fetchedAt: Date.now(), data: result };
    return result;
  })().finally(() => {
    employeePromise = null;
  });

  return employeePromise;
};

export function HRStaffSearchSelect({
  value,
  onValueChange,
  placeholder = 'انتخاب نیرو',
  filterActive = true,
}: HRStaffSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<HREmployee[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!open) return;

    setLoading(true);
    loadEmployeesCached()
      .then((cache) => {
        if (cancelled) return;
        setEmployees(filterActive ? cache.activeOnly : cache.all);
      })
      .catch((error) => {
        console.error('Error fetching HR employees:', error);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, filterActive]);

  const selectedEmployee = employees.find((e) => e.phone_number === value);

  const filteredEmployees = useMemo(() => {
    if (!search.trim()) return employees;

    const searchLower = search.toLowerCase().trim();
    return employees.filter((emp) => {
      const phone = emp.phone_number.toLowerCase();
      const name = emp.full_name.toLowerCase();
      const position = (emp.position || '').toLowerCase();
      const department = (emp.department || '').toLowerCase();

      return phone.includes(searchLower) || name.includes(searchLower) || position.includes(searchLower) || department.includes(searchLower);
    });
  }, [search, employees]);

  const handleSelect = (phone: string, name: string) => {
    onValueChange(phone, name);
    setOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onValueChange('', '');
  };

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between bg-white/50 hover:bg-white/70 text-right"
        >
          <span className="truncate flex-1 text-right">
            {selectedEmployee ? `${selectedEmployee.full_name} - ${selectedEmployee.phone_number}` : value ? value : placeholder}
          </span>
          {selectedEmployee || value ? (
            <X className="h-4 w-4 shrink-0 opacity-50 hover:opacity-100" onClick={handleClear} />
          ) : (
            <User className="h-4 w-4 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[350px] p-0 z-[9999] bg-background border shadow-lg"
        align="start"
        side="bottom"
        sideOffset={4}
        style={{ pointerEvents: 'auto' }}
      >
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجو با نام یا شماره موبایل..."
              className="pr-10 text-sm"
              autoFocus
            />
          </div>
        </div>

        <ScrollArea className="h-[300px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {employees.length === 0 ? 'هیچ نیرویی در سیستم ثبت نشده است' : 'نیرویی یافت نشد'}
            </div>
          ) : (
            <div className="p-1 bg-background">
              {filteredEmployees.map((employee) => (
                <button
                  key={employee.id}
                  type="button"
                  onClick={() => handleSelect(employee.phone_number, employee.full_name)}
                  className={`w-full text-right px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors cursor-pointer ${
                    value === employee.phone_number ? 'bg-amber-100 dark:bg-amber-900/30' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-medium flex items-center gap-2">
                        <span>{employee.full_name}</span>
                        {employee.status === 'pending_registration' && (
                          <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">
                            در انتظار
                          </Badge>
                        )}
                      </div>
                      {employee.position && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {employee.position}
                          {employee.department && ` - ${employee.department}`}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground font-mono" dir="ltr">
                      {employee.phone_number}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
