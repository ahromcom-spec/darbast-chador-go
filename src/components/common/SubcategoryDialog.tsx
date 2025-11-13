import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';

interface Subcategory {
  id: string;
  code: string;
  name: string;
  service_type_id: string;
}

interface SubcategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceName: string;
  subcategories: Subcategory[];
  onSelect: (subcategory: Subcategory) => void;
}

export function SubcategoryDialog({
  open,
  onOpenChange,
  serviceName,
  subcategories,
  onSelect
}: SubcategoryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader className="sticky top-0 bg-background pb-4 border-b border-border/50">
          <DialogTitle className="text-xl font-bold text-center">
            <div className="bg-primary/10 px-4 py-2 rounded-lg">
              <span className="text-primary">{serviceName}</span>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-3 pt-4">
          <p className="text-sm text-muted-foreground text-center mb-4">
            لطفاً نوع خدمات مورد نظر خود را انتخاب کنید
          </p>
          
          {subcategories.map((subcategory) => (
            <Button
              key={subcategory.id}
              onClick={() => {
                onSelect(subcategory);
                onOpenChange(false);
              }}
              variant="outline"
              className="w-full h-auto p-4 justify-between group hover:bg-primary/10 hover:border-primary transition-all animate-fade-in"
            >
              <span className="text-base font-medium text-right flex-1">
                {subcategory.name}
              </span>
              <ChevronLeft className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
