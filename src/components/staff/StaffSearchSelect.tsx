import { useState, useMemo } from 'react';
import { Search, User, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

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

interface StaffSearchSelectProps {
  value: string;
  onValueChange: (value: string, staffName: string) => void;
  placeholder?: string;
}

export function StaffSearchSelect({
  value,
  onValueChange,
  placeholder = 'انتخاب نیرو'
}: StaffSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedStaff = AHROM_STAFF_LIST.find(s => s.code === value);

  const filteredStaff = useMemo(() => {
    if (!search.trim()) return AHROM_STAFF_LIST;
    
    const searchLower = search.toLowerCase().trim();
    return AHROM_STAFF_LIST.filter(staff => {
      const code = staff.code.toLowerCase();
      const name = staff.name.toLowerCase();
      const fullCode = staff.fullCode.toLowerCase();
      
      return (
        code.includes(searchLower) ||
        name.includes(searchLower) ||
        fullCode.includes(searchLower)
      );
    });
  }, [search]);

  // Sort by code
  const sortedStaff = useMemo(() => {
    return [...filteredStaff].sort((a, b) => a.code.localeCompare(b.code));
  }, [filteredStaff]);

  const handleSelect = (staffCode: string, staffName: string) => {
    onValueChange(staffCode, staffName);
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
              placeholder="جستجو با نام یا کد پرسنل..."
              className="pr-10 text-sm"
              autoFocus
            />
          </div>
        </div>
        <ScrollArea className="h-[300px] overflow-y-auto">
          {sortedStaff.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              پرسنلی یافت نشد
            </div>
          ) : (
            <div className="p-1 bg-background">
              {sortedStaff.map((staff) => (
                <button
                  key={staff.code}
                  type="button"
                  onClick={() => handleSelect(staff.code, staff.name)}
                  className={`w-full text-right px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors cursor-pointer ${
                    value === staff.code ? 'bg-amber-100 dark:bg-amber-900/30' : ''
                  }`}
                >
                  <div className="font-medium flex items-center gap-2">
                    <span className="text-amber-600 font-bold text-xs bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">
                      {staff.code}
                    </span>
                    <span>{staff.name}</span>
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
