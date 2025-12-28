import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { CalendarIcon } from 'lucide-react';
import { format as formatJalali } from 'date-fns-jalali';

interface RentalStartDatePickerProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

const persianDays = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];

export function RentalStartDatePicker({ 
  value, 
  onChange, 
  placeholder = 'انتخاب تاریخ شروع کرایه',
  disabled = false
}: RentalStartDatePickerProps) {
  const [open, setOpen] = useState(false);
  const selectedDate = value ? new Date(value) : undefined;

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    const newDate = new Date(date);
    newDate.setHours(12, 0, 0, 0);
    onChange(newDate.toISOString());
    setOpen(false);
  };

  const formatDisplayDate = () => {
    if (!selectedDate) return placeholder;
    const dayOfWeek = persianDays[selectedDate.getDay()];
    const jalaliDate = formatJalali(selectedDate, 'yyyy/MM/dd');
    return `${dayOfWeek} ${jalaliDate}`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start text-right font-normal',
            !selectedDate && 'text-muted-foreground'
          )}
        >
          <CalendarIcon className="ml-2 h-4 w-4" />
          {formatDisplayDate()}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-auto p-0 z-[9999]" 
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleDateSelect}
          disabled={(date) => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            // Allow dates from 1 year ago to 1 year in the future
            const minDate = new Date(today);
            minDate.setFullYear(minDate.getFullYear() - 1);
            const maxDate = new Date(today);
            maxDate.setFullYear(maxDate.getFullYear() + 1);
            return date < minDate || date > maxDate;
          }}
          className="p-3 pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );
}
