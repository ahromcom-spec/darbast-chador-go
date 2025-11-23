import React, { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { X, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ImageZoomModalProps {
  imageUrl: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ImageZoomModal: React.FC<ImageZoomModalProps> = ({ imageUrl, isOpen, onClose }) => {
  const [zoom, setZoom] = useState(1);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.5, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.5, 1));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 overflow-hidden">
        <div className="relative w-full h-[90vh] bg-black/95 flex items-center justify-center">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 z-50 bg-background/80 hover:bg-background"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex gap-2 bg-background/80 p-2 rounded-lg">
            <Button variant="ghost" size="icon" onClick={handleZoomOut} disabled={zoom <= 1}>
              <ZoomOut className="h-5 w-5" />
            </Button>
            <span className="px-4 py-2 text-sm font-medium">{Math.round(zoom * 100)}%</span>
            <Button variant="ghost" size="icon" onClick={handleZoomIn} disabled={zoom >= 3}>
              <ZoomIn className="h-5 w-5" />
            </Button>
          </div>

          <div className="overflow-auto max-w-full max-h-full p-4">
            <img
              src={imageUrl}
              alt="Zoomed"
              className="transition-transform duration-200"
              style={{ transform: `scale(${zoom})` }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
