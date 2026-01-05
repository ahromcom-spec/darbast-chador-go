import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toGregorian, toJalaali, jalaaliMonthLength } from "jalaali-js";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarSelectionMode = "single";

export type CalendarProps = {
  className?: string;
  /** Only 'single' is supported in our Persian calendar. */
  mode?: CalendarSelectionMode;
  selected?: Date;
  onSelect?: (date: Date | undefined) => void;
  disabled?: (date: Date) => boolean;
  /** If provided, calendar opens on this month (Gregorian Date inside that Jalali month). */
  defaultMonth?: Date;
};

const persianMonths = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

const persianWeekDays = ["ش", "ی", "د", "س", "چ", "پ", "ج"]; // شنبه ... جمعه

type JalaliYM = { jy: number; jm: number };

const toJalaliYM = (date: Date): JalaliYM => {
  const j = toJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate());
  return { jy: j.jy, jm: j.jm };
};

const jalaliToGregorianDate = (jy: number, jm: number, jd: number) => {
  const g = toGregorian(jy, jm, jd);
  return new Date(g.gy, g.gm - 1, g.gd);
};

const addJalaliMonths = (jy: number, jm: number, delta: number): JalaliYM => {
  const total = jy * 12 + (jm - 1) + delta;
  const newJy = Math.floor(total / 12);
  const mod = ((total % 12) + 12) % 12;
  return { jy: newJy, jm: mod + 1 };
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

function Calendar({ className, selected, onSelect, disabled, defaultMonth }: CalendarProps) {
  const initialBaseDate = React.useMemo(() => {
    return selected || defaultMonth || new Date();
  }, [selected, defaultMonth]);

  const [{ jy, jm }, setView] = React.useState<JalaliYM>(() => toJalaliYM(initialBaseDate));

  // Keep the visible month in sync with the selected date
  React.useEffect(() => {
    if (!selected) return;
    const next = toJalaliYM(selected);
    setView((prev) => (prev.jy === next.jy && prev.jm === next.jm ? prev : next));
  }, [selected]);

  const monthLength = jalaaliMonthLength(jy, jm);

  const firstDayDate = React.useMemo(() => jalaliToGregorianDate(jy, jm, 1), [jy, jm]);
  const firstWeekIndex = (firstDayDate.getDay() + 1) % 7; // convert Sunday(0)..Saturday(6) -> Saturday(0)..Friday(6)

  const cells: Array<{ day: number; date: Date } | null> = [];
  for (let i = 0; i < firstWeekIndex; i++) cells.push(null);
  for (let day = 1; day <= monthLength; day++) {
    cells.push({ day, date: jalaliToGregorianDate(jy, jm, day) });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = React.useMemo(() => {
    const rows: Array<typeof cells> = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [cells.length, jy, jm]);

  const caption = `${persianMonths[jm - 1]} ${jy}`;

  const goPrev = () => setView(addJalaliMonths(jy, jm, -1));
  const goNext = () => setView(addJalaliMonths(jy, jm, 1));

  const today = new Date();

  return (
    <div className={cn("p-3", className)} dir="rtl">
      <div className="space-y-4">
        <div className="flex items-center justify-center relative">
          {/* RTL: right button = previous month (>) */}
          <button
            type="button"
            onClick={goPrev}
            className={cn(buttonVariants({ variant: "outline" }), "h-7 w-7 bg-transparent p-0 opacity-70 hover:opacity-100 absolute right-1")}
            aria-label="ماه قبل"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <div className="text-sm font-medium">{caption}</div>

          {/* RTL: left button = next month (<) */}
          <button
            type="button"
            onClick={goNext}
            className={cn(buttonVariants({ variant: "outline" }), "h-7 w-7 bg-transparent p-0 opacity-70 hover:opacity-100 absolute left-1")}
            aria-label="ماه بعد"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-7">
          {persianWeekDays.map((w) => (
            <div
              key={w}
              className="text-muted-foreground rounded-md w-9 h-9 flex items-center justify-center font-normal text-[0.8rem]"
            >
              {w}
            </div>
          ))}
        </div>

        <div className="space-y-2">
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7">
              {week.map((cell, ci) => {
                if (!cell) {
                  return <div key={ci} className="h-9 w-9" />;
                }

                const isDisabled = disabled?.(cell.date) ?? false;
                const isSelected = selected ? isSameDay(cell.date, selected) : false;
                const isToday = isSameDay(cell.date, today);

                return (
                  <button
                    key={ci}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => onSelect?.(cell.date)}
                    aria-selected={isSelected}
                    className={cn(
                      buttonVariants({ variant: "ghost" }),
                      "h-9 w-9 p-0 font-normal",
                      isToday && !isSelected && "bg-accent text-accent-foreground",
                      isSelected &&
                        "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                      isDisabled && "text-muted-foreground opacity-50 pointer-events-none",
                    )}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

Calendar.displayName = "Calendar";

export { Calendar };
