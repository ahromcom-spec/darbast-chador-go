import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { CalendarIcon } from 'lucide-react';
import { format as formatJalali } from 'date-fns-jalali';

interface PersianDatePickerProps {
  value?: string; // ISO string
  onChange: (value: string) => void;
  placeholder?: string;
  showTime?: boolean;
  disabled?: boolean;
}

const persianDays = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];

export function PersianDatePicker({ 
  value, 
  onChange, 
  placeholder = 'انتخاب تاریخ',
  showTime = true,
  disabled = false
}: PersianDatePickerProps) {
  const [time, setTime] = useState(() => {
    if (value) {
      const date = new Date(value);
      return {
        hour: date.getHours().toString().padStart(2, '0'),
        minute: date.getMinutes().toString().padStart(2, '0')
      };
    }
    return { hour: '09', minute: '00' };
  });

  const selectedDate = value ? new Date(value) : undefined;

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    
    const newDate = new Date(date);
    newDate.setHours(parseInt(time.hour), parseInt(time.minute), 0, 0);
    onChange(newDate.toISOString());
  };

  const handleTimeChange = (field: 'hour' | 'minute', val: string) => {
    const newTime = { ...time, [field]: val };
    setTime(newTime);
    
    if (selectedDate) {
      const newDate = new Date(selectedDate);
      newDate.setHours(parseInt(newTime.hour), parseInt(newTime.minute), 0, 0);
      onChange(newDate.toISOString());
    }
  };

  const formatDisplayDate = () => {
    if (!selectedDate) return placeholder;
    
    const dayOfWeek = persianDays[selectedDate.getDay()];
    const jalaliDate = formatJalali(selectedDate, 'yyyy/MM/dd');
    
    if (showTime) {
      return `${dayOfWeek} ${jalaliDate} ساعت ${time.hour}:${time.minute}`;
    }
    return `${dayOfWeek} ${jalaliDate}`;
  };

  return (
    <Popover>
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
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleDateSelect}
          initialFocus
          className="p-3 pointer-events-auto"
        />
        {showTime && (
          <div className="border-t p-3 space-y-2">
            <div className="text-sm font-medium text-center mb-2">انتخاب ساعت</div>
            <div className="flex items-center justify-center gap-2" dir="ltr">
              <select
                value={time.hour}
                onChange={(e) => handleTimeChange('hour', e.target.value)}
                className="w-16 px-2 py-1 border rounded text-center"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i.toString().padStart(2, '0')}>
                    {i.toString().padStart(2, '0')}
                  </option>
                ))}
              </select>
              <span className="font-bold">:</span>
              <select
                value={time.minute}
                onChange={(e) => handleTimeChange('minute', e.target.value)}
                className="w-16 px-2 py-1 border rounded text-center"
              >
                {Array.from({ length: 60 }, (_, i) => (
                  <option key={i} value={i.toString().padStart(2, '0')}>
                    {i.toString().padStart(2, '0')}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
