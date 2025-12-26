import { useState, useMemo, useEffect } from 'react';
import { Search, User, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';

// لیست ثابت پرسنل اهرم با کد
const AHROM_STAFF_LIST = [
  { code: '0101', name: 'داود احمدی', fullCode: '0001۰۱/۹۹۱۰۱۰' },
  { code: '0104', name: 'حسن صادقی', fullCode: '0001۰۴' },
  { code: '0105', name: 'حسین محمدی', fullCode: '0001۰۵/۱۰۱۴۱۰' },
  { code: '0106', name: 'جلال احمدی', fullCode: '0001۰۶/۱۰۱۷۱۰' },
  { code: '0107', name: 'احمد زاهدلوئی', fullCode: '0001۰۷' },
  { code: '0108', name: 'مرتضی رضائی', fullCode: '0001۰۸/۹۹۱۹۱۰' },
  { code: '0103', name: 'مهدی صادقی', fullCode: '0001۰۳/۱۰۱۵۱۰' },
  { code: '0124', name: 'محمد بهرامی ناصر', fullCode: '0001۲۴' },
  { code: '0128', name: 'حسین سارجالو جانعلی', fullCode: '0001۲۸، استادکار داربست، قم' },
  { code: '0129', name: 'حامد قاسمی جواد', fullCode: '0001۲۹، استادکار داربست، قم' },
  { code: '0133', name: 'مهدی بهرامی زیاد', fullCode: '0001۳۳' },
  { code: '0134', name: 'علی محمدی', fullCode: '۰۱۳۸۴ (۰۹۱۲۵۵۱۱۶۵۲)مالک' },
  { code: '0136', name: 'متین قاسمی فرزند جواد', fullCode: '0001۳۶' },
  { code: '0137', name: 'ابوالفضل ساجدی', fullCode: '0001۳۷' },
  { code: '0138', name: 'حسین سارجالو رحیم', fullCode: '0001۳۸' },
  { code: '0139', name: 'سید مصطفی حسینی یزدی', fullCode: '0001۳۹' },
  { code: '0140', name: 'یاسین طریقی', fullCode: '0001۴۰' },
  { code: '0142', name: 'علیرضا رضایی', fullCode: '0001۴۲' },
  { code: '0143', name: 'محمدمهدی چاقری', fullCode: '0001۴۳' },
  { code: '0147', name: 'محمدرضا سارجالو داربست', fullCode: '0001۴۷' },
];

interface StaffMember {
  code: string;
  name: string;
  fullCode: string;
  source?: 'static' | 'hr' | 'salary';
  user_id?: string | null;
}

interface StaffSearchSelectProps {
  value: string;
  onValueChange: (value: string, staffName: string, userId?: string | null) => void;
  placeholder?: string;
  excludeCodes?: string[];
}

export function StaffSearchSelect({
  value,
  onValueChange,
  placeholder = 'انتخاب نیرو',
  excludeCodes = []
}: StaffSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [hrStaff, setHrStaff] = useState<StaffMember[]>([]);
  const [salaryStaff, setSalaryStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch HR employees and salary settings staff, and match with profiles for user_id
  useEffect(() => {
    const fetchStaff = async () => {
      setLoading(true);
      try {
        // Fetch all profiles to match phone numbers with user_id
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, phone_number, full_name');
        
        const phoneToUserMap = new Map<string, string>();
        profilesData?.forEach(p => {
          if (p.phone_number && p.user_id) {
            // Store both normalized and original formats
            phoneToUserMap.set(p.phone_number, p.user_id);
            // Also store without leading zero for matching
            if (p.phone_number.startsWith('0')) {
              phoneToUserMap.set(p.phone_number.substring(1), p.user_id);
            }
          }
        });

        // Fetch from staff_salary_settings
        const { data: salaryData } = await supabase
          .from('staff_salary_settings')
          .select('staff_code, staff_name');

        if (salaryData) {
          const salaryList: StaffMember[] = salaryData.map(s => {
            // Try to find user_id by matching phone number in staff_name
            const phoneMatch = (s.staff_name || '').match(/09\d{9}/);
            const matchedUserId = phoneMatch ? phoneToUserMap.get(phoneMatch[0]) : null;
            
            return {
              code: s.staff_code || '',
              name: s.staff_name || '',
              fullCode: s.staff_code || '',
              source: 'salary' as const,
              user_id: matchedUserId || null
            };
          }).filter(s => s.code && s.name);
          setSalaryStaff(salaryList);
        }

        // Fetch from hr_employees with user_id
        const { data: hrData } = await supabase
          .from('hr_employees')
          .select('phone_number, full_name, position, department, user_id');

        if (hrData) {
          const hrList: StaffMember[] = hrData.map(h => {
            // If hr_employee doesn't have user_id, try to find it from profiles by phone
            let userId = h.user_id;
            if (!userId && h.phone_number) {
              userId = phoneToUserMap.get(h.phone_number) || null;
            }
            
            return {
              code: h.phone_number || '',
              name: h.full_name || '',
              fullCode: `${h.position || ''} - ${h.department || ''}`.trim().replace(/^- | -$/g, ''),
              source: 'hr' as const,
              user_id: userId || null
            };
          }).filter(h => h.code && h.name);
          setHrStaff(hrList);
        }
      } catch (error) {
        console.error('Error fetching staff:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStaff();
  }, []);

  // Combine all staff lists, removing duplicates by code
  const allStaff = useMemo(() => {
    const staticList: StaffMember[] = AHROM_STAFF_LIST.map((s) => ({
      ...s,
      source: 'static' as const,
    }));

    // NOTE: If we have duplicates by code, we prefer the entry that is linked to a real user_id
    // so that wallet/accounting sync can work.
    const combined = [...salaryStaff, ...hrStaff, ...staticList];

    const score = (s: StaffMember) => {
      const sourceScore = s.source === 'hr' ? 3 : s.source === 'salary' ? 2 : 1;
      const hasUserScore = s.user_id ? 100 : 0;
      return hasUserScore + sourceScore;
    };

    const uniqueMap = new Map<string, StaffMember>();
    for (const staff of combined) {
      const existing = uniqueMap.get(staff.code);
      if (!existing || score(staff) > score(existing)) {
        uniqueMap.set(staff.code, staff);
      }
    }

    return Array.from(uniqueMap.values());
  }, [hrStaff, salaryStaff]);

  const selectedStaff = allStaff.find(s => s.code === value);

  const filteredStaff = useMemo(() => {
    // First filter out excluded codes (but allow current value)
    const availableStaff = allStaff.filter(staff => 
      staff.code === value || !excludeCodes.includes(staff.code)
    );
    
    if (!search.trim()) return availableStaff;
    
    const searchLower = search.toLowerCase().trim();
    return availableStaff.filter(staff => {
      const code = staff.code.toLowerCase();
      const name = staff.name.toLowerCase();
      const fullCode = staff.fullCode.toLowerCase();
      
      return (
        code.includes(searchLower) ||
        name.includes(searchLower) ||
        fullCode.includes(searchLower)
      );
    });
  }, [search, allStaff, excludeCodes, value]);

  // Sort by code
  const sortedStaff = useMemo(() => {
    return [...filteredStaff].sort((a, b) => a.code.localeCompare(b.code));
  }, [filteredStaff]);

  const handleSelect = (staff: StaffMember) => {
    onValueChange(staff.code, staff.name, staff.user_id);
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
            {selectedStaff
              ? `${selectedStaff.name} - ${selectedStaff.code}`
              : placeholder}
          </span>
          {selectedStaff ? (
            <X
              className="h-4 w-4 shrink-0 opacity-50 hover:opacity-100"
              onClick={handleClear}
            />
          ) : (
            <User className="h-4 w-4 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[320px] sm:w-[350px] p-0 z-[9999] bg-background border shadow-lg" 
        align="end"
        side="top"
        sideOffset={4}
        avoidCollisions={true}
        collisionPadding={8}
        style={{ pointerEvents: 'auto' }}
      >
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجو با نام یا کد پرسنل..."
              className="pr-10 text-sm"
              autoFocus
            />
          </div>
        </div>
        <ScrollArea className="h-[300px] overflow-y-auto">
          {loading ? (
            <div className="py-6 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin ml-2" />
              <span>در حال بارگذاری...</span>
            </div>
          ) : sortedStaff.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              پرسنلی یافت نشد
            </div>
          ) : (
            <div className="p-1 bg-background">
              {sortedStaff.map((staff) => (
                <button
                  key={staff.code}
                  type="button"
                  onClick={() => handleSelect(staff)}
                  className={`w-full text-right px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors cursor-pointer ${
                    value === staff.code ? 'bg-amber-100 dark:bg-amber-900/30' : ''
                  }`}
                >
                  <div className="font-medium flex items-center gap-2">
                    <span className={`font-bold text-xs px-1.5 py-0.5 rounded ${
                      staff.source === 'salary' 
                        ? 'text-green-600 bg-green-100 dark:bg-green-900/30' 
                        : staff.source === 'hr'
                        ? 'text-blue-600 bg-blue-100 dark:bg-blue-900/30'
                        : 'text-amber-600 bg-amber-100 dark:bg-amber-900/30'
                    }`}>
                      {staff.code}
                    </span>
                    <span>{staff.name}</span>
                    {staff.fullCode && staff.fullCode !== staff.code && (
                      <span className="text-xs text-muted-foreground">({staff.fullCode})</span>
                    )}
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

export { AHROM_STAFF_LIST };
