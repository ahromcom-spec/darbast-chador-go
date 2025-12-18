import { Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

interface OrderArchiveControlsProps {
  // Bulk selection bar
  showBulkBar?: boolean;
  selectedCount: number;
  totalCount: number;
  onToggleSelectAll: () => void;
  onBulkArchive: () => void;
  
  // Single archive dialog
  archiveDialogOpen: boolean;
  onArchiveDialogChange: (open: boolean) => void;
  orderToArchive: { id: string; code: string } | null;
  onConfirmArchive: () => void;
  
  // Bulk archive dialog
  bulkArchiveDialogOpen: boolean;
  onBulkArchiveDialogChange: (open: boolean) => void;
  onConfirmBulkArchive: () => void;
  
  // Loading state
  archiving: boolean;
}

export function OrderArchiveControls({
  showBulkBar = true,
  selectedCount,
  totalCount,
  onToggleSelectAll,
  onBulkArchive,
  archiveDialogOpen,
  onArchiveDialogChange,
  orderToArchive,
  onConfirmArchive,
  bulkArchiveDialogOpen,
  onBulkArchiveDialogChange,
  onConfirmBulkArchive,
  archiving
}: OrderArchiveControlsProps) {
  return (
    <>
      {/* Bulk Selection Bar */}
      {showBulkBar && totalCount > 0 && (
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={selectedCount === totalCount && totalCount > 0}
              onCheckedChange={onToggleSelectAll}
            />
            <span className="text-sm text-muted-foreground">
              {selectedCount > 0 ? `${selectedCount} سفارش انتخاب شده` : 'انتخاب همه'}
            </span>
          </div>
          {selectedCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onBulkArchive}
              className="gap-2"
            >
              <Archive className="h-4 w-4" />
              بایگانی {selectedCount} سفارش
            </Button>
          )}
        </div>
      )}

      {/* Single Archive Dialog */}
      <Dialog open={archiveDialogOpen} onOpenChange={onArchiveDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>بایگانی سفارش</DialogTitle>
            <DialogDescription>
              آیا مطمئن هستید که می‌خواهید سفارش {orderToArchive?.code} را بایگانی کنید؟
              سفارش بایگانی شده از لیست سفارشات فعال حذف می‌شود.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => onArchiveDialogChange(false)}>
              انصراف
            </Button>
            <Button onClick={onConfirmArchive} disabled={archiving}>
              {archiving ? 'در حال بایگانی...' : 'بایگانی'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Archive Dialog */}
      <Dialog open={bulkArchiveDialogOpen} onOpenChange={onBulkArchiveDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>بایگانی دسته‌جمعی</DialogTitle>
            <DialogDescription>
              آیا مطمئن هستید که می‌خواهید {selectedCount} سفارش را بایگانی کنید؟
              سفارشات بایگانی شده از لیست سفارشات فعال حذف می‌شوند.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => onBulkArchiveDialogChange(false)}>
              انصراف
            </Button>
            <Button onClick={onConfirmBulkArchive} disabled={archiving}>
              {archiving ? 'در حال بایگانی...' : `بایگانی ${selectedCount} سفارش`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface OrderCardArchiveButtonProps {
  orderId: string;
  isSelected: boolean;
  onToggleSelection: () => void;
  onArchive: () => void;
}

export function OrderCardArchiveButton({
  orderId,
  isSelected,
  onToggleSelection,
  onArchive
}: OrderCardArchiveButtonProps) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        checked={isSelected}
        onCheckedChange={onToggleSelection}
        onClick={(e) => e.stopPropagation()}
      />
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          onArchive();
        }}
        className="gap-1 text-muted-foreground hover:text-destructive"
      >
        <Archive className="h-4 w-4" />
      </Button>
    </div>
  );
}
