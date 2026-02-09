import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, User, CreditCard, Building } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { StaffSearchSelect } from '@/components/staff/StaffSearchSelect';
import { StaffReportRow, StaffMember } from '@/hooks/useDailyReport';
import { WorkStatusSelect } from '@/components/daily-report/WorkStatusSelect';
import { BankCardSelect } from '@/components/bank-cards/BankCardSelect';
import { supabase } from '@/integrations/supabase/client';
interface StaffReportsTableProps {
  staffReports: StaffReportRow[];
  staffMembers: StaffMember[];
  totals: {
    presentCount: number;
    totalOvertime: number;
    totalReceived: number;
    totalSpent: number;
  };
  onUpdateRow: (index: number, field: keyof StaffReportRow, value: any) => void;
  onRemoveRow: (index: number) => void;
  onAddRow: () => void;
  onSetStaffReports: (updater: (prev: StaffReportRow[]) => StaffReportRow[]) => void;
}

// Interface for bank card data
interface BankCardInfo {
  id: string;
  card_name: string;
  bank_name: string;
}

export function StaffReportsTable({
  staffReports,
  staffMembers,
  totals,
  onUpdateRow,
  onRemoveRow,
  onAddRow,
  onSetStaffReports,
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
      
      // Add new row if this is the last non-cash-box row
      const nonCashBoxRows = updated.filter((r) => !r.is_cash_box);
      const lastNonCashBoxIndex = updated.findIndex(
        (r, i) => !r.is_cash_box && i === updated.lastIndexOf(nonCashBoxRows[nonCashBoxRows.length - 1])
      );
      
      if (index === lastNonCashBoxIndex && code) {
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
          is_cash_box: false
        });
      }
      
      return updated;
    });
  };

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Scroll to rightmost position on mount (for RTL layout)
  // In RTL, scrollLeft = 0 is the rightmost position
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = 0;
    }
  }, [staffReports.length]);

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
        bank_card_id: null
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
        <div ref={scrollContainerRef} className="overflow-x-auto" dir="rtl">
          <Table className="table-auto border-collapse border border-amber-300">
            <TableHeader>
              <TableRow className="bg-amber-100 dark:bg-amber-900/30">
                <TableHead className="w-[50px] border border-amber-300"></TableHead>
                <TableHead className="text-right whitespace-nowrap px-2 border border-amber-300">توضیحات</TableHead>
                <TableHead className="text-right whitespace-nowrap px-2 border border-amber-300">کارت بانکی</TableHead>
                <TableHead className="text-right whitespace-nowrap px-2 border border-amber-300">توضیحات مبلغ خرج کرد</TableHead>
                <TableHead className="text-right whitespace-nowrap px-2 border border-amber-300">مبلغ خرج کرده شده در کار</TableHead>
                <TableHead className="text-right whitespace-nowrap px-2 border border-amber-300">توضیحات دریافتی</TableHead>
                <TableHead className="text-right whitespace-nowrap px-2 border border-amber-300">مبلغ دریافتی</TableHead>
                <TableHead className="text-right whitespace-nowrap px-2 border border-amber-300">اضافه کاری</TableHead>
                <TableHead className="text-right whitespace-nowrap px-2 border border-amber-300">کارکرد</TableHead>
                <TableHead className="text-right whitespace-nowrap px-2 border border-amber-300">نیروها</TableHead>
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
                        if (e.target.value.length <= 300) {
                          onUpdateRow(index, 'notes', e.target.value);
                        }
                      }}
                      placeholder={row.is_company_expense ? "هزینه‌های شرکت (نهار، ایاب‌ذهاب و...)" : "توضیحات..."}
                       className="w-[14ch] min-h-[70px]"
                       maxLength={300}
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
                        />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="border border-amber-200">
                    <AutoResizeTextarea
                      value={row.spending_notes}
                      onChange={(e) => {
                        if (e.target.value.length <= 300) {
                          onUpdateRow(index, 'spending_notes', e.target.value);
                        }
                      }}
                      placeholder="توضیحات..."
                       className="w-[14ch] min-h-[70px]"
                       maxLength={300}
                     />
                   </TableCell>
                   <TableCell className="border border-amber-200">
                     <div className="relative">
                       <Input
                         type="text"
                         inputMode="numeric"
                         value={row.amount_spent === 0 ? '' : row.amount_spent.toLocaleString('en-US')}
                         onChange={(e) => {
                           const val = e.target.value.replace(/[^0-9۰-۹]/g, '').replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
                           const numVal = parseInt(val) || 0;
                           if (numVal <= 300000000) {
                             onUpdateRow(index, 'amount_spent', numVal);
                           } else {
                             toast.error('مبلغ نمی‌تواند بیشتر از ۳۰۰ میلیون تومان باشد');
                           }
                         }}
                           className="w-[120px] pl-12 text-left tabular-nums"
                        dir="ltr"
                        placeholder="0"
                      />
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">تومان</span>
                    </div>
                  </TableCell>
                  <TableCell className="border border-amber-200">
                    {/* فیلد توضیحات دریافتی برای سطرهای شرکت و کارت بانکی فعال است */}
                    {row.is_cash_box || row.is_company_expense ? (
                      <AutoResizeTextarea
                        value={row.receiving_notes}
                        onChange={(e) => {
                          if (e.target.value.length <= 300) {
                            onUpdateRow(index, 'receiving_notes', e.target.value);
                          }
                        }}
                        placeholder={row.is_company_expense ? "توضیحات دریافتی شرکت..." : "توضیحات..."}
                         className="w-[14ch] min-h-[70px]"
                         maxLength={300}
                       />
                     ) : (
                       <AutoResizeTextarea
                         value={row.receiving_notes}
                         onChange={(e) => {
                           if (e.target.value.length <= 300) {
                             onUpdateRow(index, 'receiving_notes', e.target.value);
                           }
                         }}
                         placeholder="توضیحات..."
                         className="w-[14ch] min-h-[70px]"
                        maxLength={300}
                      />
                    )}
                  </TableCell>
                  <TableCell className="border border-amber-200">
                    {/* فیلد مبلغ دریافتی برای سطرهای شرکت و کارت بانکی فعال است */}
                    {row.is_cash_box || row.is_company_expense ? (
                      <div className="relative">
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={row.amount_received === 0 ? '' : row.amount_received.toLocaleString('en-US')}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9۰-۹]/g, '').replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
                            const numVal = parseInt(val) || 0;
                            if (numVal <= 300000000) {
                              onUpdateRow(index, 'amount_received', numVal);
                            } else {
                              toast.error('مبلغ نمی‌تواند بیشتر از ۳۰۰ میلیون تومان باشد');
                            }
                          }}
                            className="w-[120px] pl-12 text-left tabular-nums"
                           dir="ltr"
                           placeholder="0"
                         />
                         <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">تومان</span>
                       </div>
                     ) : (
                       <div className="relative">
                         <Input
                           type="text"
                           inputMode="numeric"
                           value={row.amount_received === 0 ? '' : row.amount_received.toLocaleString('en-US')}
                           onChange={(e) => {
                             const val = e.target.value.replace(/[^0-9۰-۹]/g, '').replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
                             const numVal = parseInt(val) || 0;
                             if (numVal <= 300000000) {
                               onUpdateRow(index, 'amount_received', numVal);
                             } else {
                               toast.error('مبلغ نمی‌تواند بیشتر از ۳۰۰ میلیون تومان باشد');
                             }
                           }}
                           className="w-[120px] pl-12 text-left tabular-nums"
                          dir="ltr"
                          placeholder="0"
                        />
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">تومان</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="border border-amber-200">
                    {row.is_cash_box || row.is_company_expense ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <div className="relative">
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={row.overtime_hours === 0 ? '' : row.overtime_hours.toString()}
                          onChange={(e) => {
                            const val = e.target.value.replace(/^0+(?=\d)/, '');
                            const numVal = parseFloat(val) || 0;
                            if (numVal <= 15) {
                              onUpdateRow(index, 'overtime_hours', numVal);
                            } else {
                              toast.error('اضافه‌کاری نمی‌تواند بیشتر از ۱۵ ساعت باشد');
                            }
                          }}
                          className="w-[80px] pl-10 text-left"
                          dir="ltr"
                          placeholder="0"
                        />
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">ساعت</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="border border-amber-200">
                    {row.is_cash_box || row.is_company_expense ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <WorkStatusSelect
                        value={row.work_status}
                        onValueChange={(value) => onUpdateRow(index, 'work_status', value)}
                        className="w-[80px]"
                      />
                    )}
                  </TableCell>
                  <TableCell className="border border-amber-200">
                    {row.is_company_expense ? (
                       <div className="w-[160px] font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-2">
                         <Building className="h-5 w-5" />
                         ماهیت شرکت اهرم
                       </div>
                     ) : row.is_cash_box ? (
                       <div className="w-[160px]">
                        <BankCardSelect
                          value={row.bank_card_id || null}
                          onValueChange={(value) => onUpdateRow(index, 'bank_card_id', value)}
                          placeholder="انتخاب کارت بانکی"
                          showBalance={true}
                        />
                      </div>
                    ) : (
                      <StaffSearchSelect
                        value={row.staff_user_id || ''}
                        onValueChange={(code, name, userId) => handleStaffSelect(index, code, name, userId)}
                        placeholder="انتخاب نیرو"
                        excludeCodes={staffReports
                          .filter((r, i) => i !== index && r.staff_user_id)
                          .map(r => r.staff_user_id as string)}
                      />
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
