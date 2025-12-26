import { Plus, Trash2, Package, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { OrderSearchSelect } from '@/components/orders/OrderSearchSelect';
import { OrderReportRow, Order, ROW_COLORS } from '@/hooks/useDailyReport';

interface OrderReportsTableProps {
  orderReports: OrderReportRow[];
  orders: Order[];
  onUpdateRow: (index: number, field: keyof OrderReportRow, value: string) => void;
  onRemoveRow: (index: number) => void;
  onAddRow: () => void;
  onViewOrder?: (orderId: string) => void;
}

export function OrderReportsTable({
  orderReports,
  orders,
  onUpdateRow,
  onRemoveRow,
  onAddRow,
  onViewOrder,
}: OrderReportsTableProps) {
  const getRowColorClass = (color: string) => {
    return ROW_COLORS.find(c => c.value === color)?.class || 'bg-background';
  };

  const displayRows = orderReports.length === 0 
    ? [{
        order_id: '',
        activity_description: '',
        service_details: '',
        team_name: '',
        notes: '',
        row_color: ROW_COLORS[0].value,
      }] 
    : orderReports;

  return (
    <Card className="border-2 border-blue-500/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Package className="h-5 w-5 text-blue-600" />
            </div>
            <CardTitle className="text-lg">گزارش سفارشات مشتری</CardTitle>
          </div>
          <Button size="sm" onClick={onAddRow} className="gap-2">
            <Plus className="h-4 w-4" />
            افزودن ردیف
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table className="table-auto border-collapse border border-blue-300">
            <TableHeader>
              <TableRow className="bg-blue-100 dark:bg-blue-900/30">
                <TableHead className="w-[50px] border border-blue-300"></TableHead>
                <TableHead className="whitespace-nowrap px-2 border border-blue-300">رنگ</TableHead>
                <TableHead className="text-right whitespace-nowrap px-2 border border-blue-300">توضیحات</TableHead>
                <TableHead className="text-right whitespace-nowrap px-2 border border-blue-300">اکیپ</TableHead>
                <TableHead className="text-right whitespace-nowrap px-2 border border-blue-300">تعداد، ابعاد و متراژ خدمات</TableHead>
                <TableHead className="text-right whitespace-nowrap px-2 border border-blue-300">شرح فعالیت امروز</TableHead>
                <TableHead className="text-right whitespace-nowrap px-2 border border-blue-300">سفارش مشتری را انتخاب کنید</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayRows.map((row, index) => (
                <TableRow key={index} className={`${getRowColorClass(row.row_color)} even:opacity-90`}>
                  <TableCell className="border border-blue-200">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemoveRow(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                  <TableCell className="border border-blue-200">
                    <div className={`w-6 h-6 rounded ${getRowColorClass(row.row_color)}`}></div>
                  </TableCell>
                  <TableCell className="border border-blue-200">
                    <AutoResizeTextarea
                      value={row.notes}
                      onChange={(e) => onUpdateRow(index, 'notes', e.target.value)}
                      className="min-h-[50px] min-w-[120px] bg-white/50"
                      placeholder="توضیحات..."
                    />
                  </TableCell>
                  <TableCell className="border border-blue-200">
                    <Input
                      value={row.team_name}
                      onChange={(e) => onUpdateRow(index, 'team_name', e.target.value)}
                      className="bg-white/50 min-w-[100px]"
                      placeholder="نام اکیپ"
                    />
                  </TableCell>
                  <TableCell className="border border-blue-200">
                    <AutoResizeTextarea
                      value={row.service_details}
                      onChange={(e) => onUpdateRow(index, 'service_details', e.target.value)}
                      className="min-h-[50px] min-w-[150px] bg-white/50"
                      placeholder="جزئیات خدمات..."
                    />
                  </TableCell>
                  <TableCell className="border border-blue-200">
                    <AutoResizeTextarea
                      value={row.activity_description}
                      onChange={(e) => onUpdateRow(index, 'activity_description', e.target.value)}
                      className="min-h-[50px] min-w-[150px] bg-white/50"
                      placeholder="شرح فعالیت..."
                    />
                  </TableCell>
                  <TableCell className="border border-blue-200">
                    <div className="flex items-center gap-2">
                      <OrderSearchSelect
                        value={row.order_id}
                        orders={orders}
                        onValueChange={(orderId: string) => {
                          onUpdateRow(index, 'order_id', orderId);
                          // Assign color based on index
                          onUpdateRow(index, 'row_color', ROW_COLORS[index % ROW_COLORS.length].value);
                        }}
                        placeholder="انتخاب سفارش"
                      />
                      {row.order_id && onViewOrder && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onViewOrder(row.order_id)}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
