import { useEffect, useRef, useState } from 'react';
import { useTableArrowNavigation } from '@/hooks/useTableArrowNavigation';
import { Plus, Trash2, User, CreditCard, Building, Clock } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger, PopoverClose } from '@/components/ui/popover';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { CalculatorInput } from '@/components/ui/CalculatorInput';
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { StaffSearchSelect } from '@/components/staff/StaffSearchSelect';
import { StaffReportRow, StaffMember } from '@/hooks/useDailyReport';
import { WorkStatusSelect } from '@/components/daily-report/WorkStatusSelect';
import { BankCardSelect } from '@/components/bank-cards/BankCardSelect';
import { OvertimeInput } from '@/components/daily-report/OvertimeInput';
import { formatOvertime } from '@/lib/overtimeUtils';
import { supabase } from '@/integrations/supabase/client';


interface BankCardInfo {
  id: string;
  card_name: string;
  bank_name: string;
}

const TIME_HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'));
const TIME_MINUTES = Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, '0'));

interface StaffReportsTableProps {
  staffReports: StaffReportRow[];
  staffMembers: StaffMember[];
  totals: {
    presentCount: number;
    totalReceived: number;
    totalSpent: number;
    totalOvertime?: number;
  };
  onUpdateRow: (index: number, field: string, value: unknown) => void;
  onRemoveRow: (index: number) => void;
  onAddRow: () => void;
  onSetStaffReports: (updater: (prev: StaffReportRow[]) => StaffReportRow[]) => void;
  /** Report date in YYYY-MM-DD format for historical balance display */
  reportDate?: string;
  /** Module key to filter bank cards by allowed_modules */
  moduleKey?: string;
}

export function StaffReportsTable({
  staffReports,
  staffMembers,
  totals,
  onUpdateRow,
  onRemoveRow,
  onAddRow,
  onSetStaffReports,
  reportDate,
  moduleKey,
}: StaffReportsTableProps) {
  const balance = totals.totalReceived - totals.totalSpent;
  const balanceState: 'balanced' | 'deficit' | 'surplus' = balance === 0 ? 'balanced' : balance < 0 ? 'deficit' : 'surplus';

  // Fetch bank cards for displaying names
  const [bankCards, setBankCards] = useState<BankCardInfo[]>([]);
  
  useEffect(() => {
    const fetchBankCards = async () => {
      try {
        const { data, error } = await supabase
          .from('bank_cards')
          .select('id, card_name, bank_name')
          .eq('is_active', true);
        
        if (error) throw error;
        setBankCards((data || []) as BankCardInfo[]);
      } catch (error) {
        console.error('Error fetching bank cards:', error);
      }
    };
    fetchBankCards();
  }, []);

  // Helper to get card name by ID
  const getCardName = (cardId: string | null | undefined): string => {
    if (!cardId) return '';
    const card = bankCards.find(c => c.id === cardId);
    return card ? `${card.card_name} (${card.bank_name})` : '';
  };

  // Helper: focus & open the trigger button of the next row in the same column
  const focusNextRowTrigger = (currentIndex: number, attr: 'data-staff-cell' | 'data-workstatus-cell') => {
    let attempts = 0;
    const tryFocus = () => {
      attempts++;
      const nextEl = document.querySelector(
        `[${attr}="${currentIndex + 1}"] button`
      ) as HTMLButtonElement | null;
      if (nextEl) {
        nextEl.focus();
        nextEl.click();
        return;
      }
      if (attempts < 10) requestAnimationFrame(tryFocus);
    };
    requestAnimationFrame(tryFocus);
  };

  const handleStaffSelect = (index: number, code: string, name: string, userId?: string) => {
    // Check if this staff is already selected
    const alreadySelected = staffReports.some(
      (r, i) => i !== index && r.staff_user_id === code && code
    );
    if (alreadySelected) {
      toast.error('این نیرو قبلاً انتخاب شده است');
      return;
    }
    
    // Update all fields at once
    onSetStaffReports((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        staff_user_id: code,
        staff_name: code && name ? `${code} - ${name}` : '',
        real_user_id: userId || null
      };
      
      // Add new row if this is the last regular (non-cash-box, non-company-expense) row
      const regularRows = updated.filter((r) => !r.is_cash_box && !r.is_company_expense);
      const lastRegularRow = regularRows[regularRows.length - 1];
      const lastRegularIndex = lastRegularRow ? updated.lastIndexOf(lastRegularRow) : -1;
      
      if (index === lastRegularIndex && code) {
        updated.push({
          staff_user_id: null,
          staff_name: '',
          work_status: 'غایب',
          overtime_hours: 0,
          amount_received: 0,
          receiving_notes: '',
          amount_spent: 0,
          spending_notes: '',
          notes: '',
          is_cash_box: false,
          transaction_time: null,
        });
      }
      
      return updated;
    });

    // After selection, auto-jump to the next row's staff dropdown
    if (code) {
      focusNextRowTrigger(index, 'data-staff-cell');
    }
  };

  const handleWorkStatusChange = (index: number, value: string) => {
    onUpdateRow(index, 'work_status', value);
    focusNextRowTrigger(index, 'data-workstatus-cell');
  };

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const arrowNavRef = useTableArrowNavigation<HTMLDivElement>();

  // Scroll to rightmost position on mount (for RTL layout)
  // In RTL, scrollLeft = 0 is the rightmost position
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = 0;
    }
  }, [staffReports.length]);

  // Combine refs
  const setRefs = (el: HTMLDivElement | null) => {
    (scrollContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
    (arrowNavRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
  };

  // Handler to add a bank card row (cash box row)
  const handleAddBankCardRow = () => {
    onSetStaffReports((prev) => {
      // Add the new cash box row at the beginning
      const newRow: StaffReportRow = {
        staff_user_id: null,
        staff_name: '',
        work_status: 'غایب',
        overtime_hours: 0,
        amount_received: 0,
        receiving_notes: '',
        amount_spent: 0,
        spending_notes: '',
        notes: '',
        is_cash_box: true,
        bank_card_id: null,
        transaction_time: null,
      };
      return [newRow, ...prev];
    });
  };

  return (
    <Card data-dropdown-boundary className="relative border-2 border-amber-500/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <User className="h-5 w-5 text-amber-600" />
            </div>
            <CardTitle className="text-lg">گزارش پرسنل</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleAddBankCardRow} variant="outline" className="gap-2 border-emerald-500 text-emerald-600 hover:bg-emerald-50">
              <CreditCard className="h-4 w-4" />
              افزودن کارت بانکی
            </Button>
            <Button size="sm" onClick={onAddRow} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              افزودن نیرو
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div ref={setRefs} className="overflow-x-auto daily-report-touch-scroll" dir="rtl">
          <Table className="table-fixed border-collapse border border-amber-300 w-[900px]">
            <TableHeader>
              <TableRow className="bg-amber-100 dark:bg-amber-900/30">
                <TableHead className="w-[40px] border border-amber-300"></TableHead>
                <TableHead className="w-[100px] text-right whitespace-nowrap px-1 border border-amber-300 text-xs">توضیحات</TableHead>
                <TableHead className="w-[100px] text-right whitespace-nowrap px-1 border border-amber-300 text-xs">کارت بانکی</TableHead>
                <TableHead className="w-[100px] text-right whitespace-nowrap px-1 border border-amber-300 text-xs">توضیحات خرج</TableHead>
                <TableHead className="w-[50px] text-right whitespace-nowrap px-1 border border-amber-300 text-xs">مبلغ خرج</TableHead>
                <TableHead className="w-[100px] text-right whitespace-nowrap px-1 border border-amber-300 text-xs">توضیحات دریافتی</TableHead>
                <TableHead className="w-[50px] text-right whitespace-nowrap px-1 border border-amber-300 text-xs">مبلغ دریافتی</TableHead>
                <TableHead className="w-[70px] text-right whitespace-nowrap px-1 border border-amber-300 text-xs">اضافه کاری</TableHead>
                <TableHead className="w-[70px] text-right whitespace-nowrap px-1 border border-amber-300 text-xs">کارکرد</TableHead>
                <TableHead className="w-[80px] text-right whitespace-nowrap px-1 border border-amber-300 text-xs">نیروها</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staffReports.map((row, index) => (
                <TableRow 
                  key={index} 
                  className={
                    row.is_company_expense 
                      ? 'bg-blue-50 dark:bg-blue-900/20' 
                      : row.is_cash_box 
                        ? 'bg-amber-50 dark:bg-amber-900/20' 
                        : 'even:bg-amber-50/50'
                  }
                >
                  <TableCell className="border border-amber-200">
                    {/* Show delete button for regular rows OR if there are duplicate company expense rows */}
                    {(!row.is_cash_box && !row.is_company_expense) || 
                     (row.is_company_expense && staffReports.filter(r => r.is_company_expense).length > 1) ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onRemoveRow(index)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </TableCell>
                  <TableCell className="border border-amber-200">
                    <AutoResizeTextarea
                      value={row.notes}
                      onChange={(e) => {
                        if (e.target.value.length <= 600) {
                          onUpdateRow(index, 'notes', e.target.value);
                        }
                      }}
                      placeholder={row.is_company_expense ? "هزینه‌های شرکت (نهار، ایاب‌ذهاب و...)" : "توضیحات..."}
                       className="w-[24ch] min-h-[140px]"
                       maxLength={600}
                     />
                   </TableCell>
                   <TableCell className="border border-amber-200">
                     {row.is_company_expense || row.is_cash_box ? (
                       <span className="text-muted-foreground">—</span>
                     ) : (
                       <div className="w-[140px]">
                         <BankCardSelect
                           value={row.bank_card_id || null}
                           onValueChange={(value) => onUpdateRow(index, 'bank_card_id', value)}
                           placeholder="انتخاب کارت"
                           showBalance={true}
                           moduleKey={moduleKey}
                           showManagementCards={true}
                           asOfDate={reportDate}
                         />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="border border-amber-200">
                    <AutoResizeTextarea
                      value={row.spending_notes}
                      onChange={(e) => {
                        if (e.target.value.length <= 600) {
                          onUpdateRow(index, 'spending_notes', e.target.value);
                        }
                      }}
                      placeholder="توضیحات..."
                       className="w-[24ch] min-h-[140px]"
                       maxLength={600}
                     />
                   </TableCell>
                   <TableCell className="border border-amber-200">
                     <div className="relative">
                       <CalculatorInput
                         value={row.amount_spent}
                         onChange={(val) => onUpdateRow(index, 'amount_spent', val)}
                         className="w-full pl-10 text-left tabular-nums text-sm"
                         dir="ltr"
                         placeholder="0"
                       />
                       <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">تومان</span>
                     </div>
                  </TableCell>
                  <TableCell className="border border-amber-200">
                    {/* فیلد توضیحات دریافتی برای سطرهای شرکت و کارت بانکی فعال است */}
                    {row.is_cash_box || row.is_company_expense ? (
                      <AutoResizeTextarea
                        value={row.receiving_notes}
                        onChange={(e) => {
                          if (e.target.value.length <= 600) {
                            onUpdateRow(index, 'receiving_notes', e.target.value);
                          }
                        }}
                        placeholder={row.is_company_expense ? "توضیحات دریافتی شرکت..." : "توضیحات..."}
                         className="w-[24ch] min-h-[140px]"
                         maxLength={600}
                       />
                     ) : (
                       <AutoResizeTextarea
                         value={row.receiving_notes}
                         onChange={(e) => {
                           if (e.target.value.length <= 600) {
                             onUpdateRow(index, 'receiving_notes', e.target.value);
                           }
                         }}
                         placeholder="توضیحات..."
                         className="w-[24ch] min-h-[140px]"
                        maxLength={600}
                      />
                    )}
                  </TableCell>
                  <TableCell className="border border-amber-200">
                    {/* فیلد مبلغ دریافتی برای سطرهای شرکت و کارت بانکی فعال است */}
                    {row.is_cash_box || row.is_company_expense ? (
                       <div className="relative">
                         <CalculatorInput
                           value={row.amount_received}
                           onChange={(val) => onUpdateRow(index, 'amount_received', val)}
                           className="w-full pl-10 text-left tabular-nums text-sm"
                           dir="ltr"
                           placeholder="0"
                         />
                         <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">تومان</span>
                       </div>
                     ) : (
                       <div className="relative">
                         <CalculatorInput
                           value={row.amount_received}
                           onChange={(val) => onUpdateRow(index, 'amount_received', val)}
                           className="w-full pl-10 text-left tabular-nums text-sm"
                           dir="ltr"
                           placeholder="0"
                         />
                         <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">تومان</span>
                       </div>
                    )}
                  </TableCell>
                  <TableCell className="border border-amber-200">
                    {row.is_cash_box || row.is_company_expense ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <OvertimeInput
                        value={row.overtime_hours || 0}
                        onChange={(hours) => onUpdateRow(index, 'overtime_hours', hours)}
                        className="w-[100px]"
                      />

                    )}
                  </TableCell>
                  <TableCell className="border border-amber-200" {...(!row.is_cash_box && !row.is_company_expense ? { 'data-workstatus-cell': index } : {})}>
                    {row.is_cash_box || row.is_company_expense ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <WorkStatusSelect
                        value={row.work_status}
                        onValueChange={(value) => handleWorkStatusChange(index, value)}
                        className="w-[80px]"
                      />
                    )}
                  </TableCell>
                  <TableCell className="border border-amber-200">
                    {row.is_company_expense ? (
                       <div className="w-[120px] font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-2 text-xs leading-tight">
                         <Building className="h-4 w-4 shrink-0" />
                         <span>ماهیت شرکت اهرم</span>
                        </div>
                      ) : row.is_cash_box ? (
                        <div className="w-[140px] flex items-center gap-1">
                          <div className="flex-1 min-w-0">
                            <BankCardSelect
                              value={row.bank_card_id || null}
                              onValueChange={(value) => onUpdateRow(index, 'bank_card_id', value)}
                              placeholder="انتخاب کارت بانکی"
                              showBalance={true}
                              moduleKey={moduleKey}
                              showManagementCards={true}
                              asOfDate={reportDate}
                            />
                          </div>
                          {row.bank_card_id && (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  type="button"
                                  className={`h-7 w-7 shrink-0 ${row.transaction_time ? 'text-emerald-600' : 'text-muted-foreground'}`}
                                  title={row.transaction_time ? `ساعت تراکنش: ${row.transaction_time}` : 'تنظیم ساعت تراکنش'}
                                >
                                  <Clock className="h-4 w-4" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-56 p-3" align="end">
                                <div className="space-y-2">
                                  <label className="text-xs font-medium">ساعت تراکنش (۲۴ ساعته)</label>
                                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2" dir="ltr">
                                    <Select
                                      value={row.transaction_time ? row.transaction_time.split(':')[0] : undefined}
                                      onValueChange={(hour) => {
                                        const minute = row.transaction_time ? row.transaction_time.split(':')[1] || '00' : '00';
                                        onUpdateRow(index, 'transaction_time', `${hour}:${minute}`);
                                      }}
                                    >
                                      <SelectTrigger className="h-10 text-center tabular-nums" dir="ltr">
                                        <SelectValue placeholder="HH" />
                                      </SelectTrigger>
                                      <SelectContent className="max-h-60" align="center">
                                        {TIME_HOURS.map((hour) => (
                                          <SelectItem key={hour} value={hour} className="text-center tabular-nums">
                                            {hour}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <span className="font-bold">:</span>
                                    <Select
                                      value={row.transaction_time ? row.transaction_time.split(':')[1] || '00' : undefined}
                                      onValueChange={(minute) => {
                                        const hour = row.transaction_time ? row.transaction_time.split(':')[0] || '00' : '00';
                                        onUpdateRow(index, 'transaction_time', `${hour}:${minute}`);
                                      }}
                                    >
                                      <SelectTrigger className="h-10 text-center tabular-nums" dir="ltr">
                                        <SelectValue placeholder="MM" />
                                      </SelectTrigger>
                                      <SelectContent className="max-h-60" align="center">
                                        {TIME_MINUTES.map((minute) => (
                                          <SelectItem key={minute} value={minute} className="text-center tabular-nums">
                                            {minute}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <p className="text-[10px] text-muted-foreground">
                                    در صورت خالی بودن، ساعت ۰۰:۰۰ ثبت می‌شود.
                                  </p>
                                  <PopoverClose asChild>
                                    <Button
                                      type="button"
                                      variant="default"
                                      size="sm"
                                      className="w-full text-xs"
                                      onClick={() => {
                                        if (!row.transaction_time) {
                                          onUpdateRow(index, 'transaction_time', '00:00');
                                        }
                                      }}
                                    >
                                      تایید ساعت
                                    </Button>
                                  </PopoverClose>
                                </div>
                              </PopoverContent>
                            </Popover>
                          )}
                        </div>
                      ) : (
                      <div data-staff-cell={index}>
                        <StaffSearchSelect
                          value={row.staff_user_id || ''}
                          displayName={row.staff_name?.replace(/^MANUAL-\d+\s*-\s*/, '') || undefined}
                          onValueChange={(code, name, userId) => handleStaffSelect(index, code, name, userId)}
                          placeholder="انتخاب نیرو"
                          excludeCodes={staffReports
                            .filter((r, i) => i !== index && r.staff_user_id)
                            .map(r => r.staff_user_id as string)}
                        />
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}

              {/* Summary Row */}
              <TableRow className="bg-amber-200 dark:bg-amber-800/40 font-bold">
                <TableCell className="border border-amber-300" colSpan={4}></TableCell>
                <TableCell className="border border-amber-300">{totals.totalSpent.toLocaleString('fa-IR')} تومان</TableCell>
                <TableCell className="border border-amber-300"></TableCell>
                <TableCell className="border border-amber-300">{totals.totalReceived.toLocaleString('fa-IR')} تومان</TableCell>
                <TableCell className="border border-amber-300">{totals.totalOvertime} ساعت</TableCell>
                <TableCell className="border border-amber-300">{totals.presentCount} نیرو</TableCell>
                <TableCell className="border border-amber-300 text-right">جمع:</TableCell>
              </TableRow>

              {/* Balance Row */}
              <TableRow
                className={
                  balanceState === 'balanced'
                    ? 'bg-green-100 dark:bg-green-900/30'
                    : balanceState === 'deficit'
                      ? 'bg-red-100 dark:bg-red-900/30'
                      : 'bg-amber-100 dark:bg-amber-900/30'
                }
              >
                <TableCell colSpan={10} className="text-center">
                  <Badge
                    variant={balanceState === 'balanced' ? 'default' : balanceState === 'deficit' ? 'destructive' : 'secondary'}
                    className="text-base px-4 py-2"
                  >
                    {balanceState === 'balanced' ? 'تراز مالی صحیح است' : balanceState === 'deficit' ? 'کسری مالی' : 'مازاد مالی'}
                    {balanceState !== 'balanced' && ` (${Math.abs(balance).toLocaleString('fa-IR')} تومان)`}
                  </Badge>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
