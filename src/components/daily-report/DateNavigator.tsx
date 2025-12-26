import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PersianDatePicker } from '@/components/ui/persian-date-picker';

interface DateNavigatorProps {
  reportDate: Date;
  onDateChange: (date: Date) => void;
}

export function DateNavigator({ reportDate, onDateChange }: DateNavigatorProps) {
  const goToPreviousDay = () => {
    const prevDay = new Date(reportDate);
    prevDay.setDate(prevDay.getDate() - 1);
    onDateChange(prevDay);
  };

  const goToNextDay = () => {
    const nextDay = new Date(reportDate);
    nextDay.setDate(nextDay.getDate() + 1);
    onDateChange(nextDay);
  };

  return (
    <div className="flex items-center gap-3 justify-end">
      {/* Navigation buttons on the left */}
      <div className="flex items-center gap-2">
        {/* Previous day button - leftmost */}
        <Button
          variant="outline"
          size="sm"
          onClick={goToPreviousDay}
          className="gap-1 px-3"
        >
          <span className="text-lg">←</span>
          روز قبل
        </Button>
        
        {/* Next day button */}
        <Button
          variant="outline"
          size="sm"
          onClick={goToNextDay}
          className="gap-1 px-3"
        >
          روز بعد
          <span className="text-lg">→</span>
        </Button>
      </div>
      
      <PersianDatePicker
        value={reportDate.toISOString()}
        onChange={(date) => date && onDateChange(new Date(date))}
        timeMode="none"
      />
      
      <Label className="text-sm font-medium">تاریخ گزارش:</Label>
    </div>
  );
}
