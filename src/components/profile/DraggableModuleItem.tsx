import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Folder, FolderOpen, ChevronLeft, ChevronDown, GripVertical, Pencil, Check, X, Trash2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface ModuleItem {
  id: string;
  type: 'module' | 'folder';
  key: string;
  name: string;
  description: string;
  /** For assigned modules: always show under title and MUST NOT be overridden by customNames */
  assignedPhone?: string;
  /** For assigned modules: always show under title and MUST NOT be overridden by customNames */
  assignedUserName?: string;
  href?: string;
  color?: string;
  bgColor?: string;
  children?: ModuleItem[];
  isOpen?: boolean;
}

interface DraggableModuleItemProps {
  item: ModuleItem;
  index: number;
  onDragStart: (item: ModuleItem, e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (targetItem: ModuleItem, e: React.DragEvent) => void;
  onDropBetween: (targetIndex: number, e: React.DragEvent) => void;
  onDragEnd: () => void;
  onToggleFolder: (folderId: string) => void;
  onEditItem: (item: ModuleItem, newName: string, newDescription: string) => void;
  onNavigate?: (href: string) => void;
  onDelete?: (itemId: string) => void;
  onDuplicate?: (item: ModuleItem) => void;
  level?: number;
  customNames?: Record<string, { name: string; description: string }>;
  showDeleteButton?: boolean;
  showDuplicateButton?: boolean;
  isFirst?: boolean;
  draggedItemId?: string | null;
  canDeleteItem?: (item: ModuleItem) => boolean;
}

export function DraggableModuleItem({
  item,
  index = 0,
  onDragStart,
  onDragOver,
  onDrop,
  onDropBetween,
  onDragEnd,
  onToggleFolder,
  onEditItem,
  onNavigate,
  onDelete,
  onDuplicate,
  level = 0,
  customNames = {},
  showDeleteButton = false,
  showDuplicateButton = false,
  isFirst = false,
  draggedItemId = null,
  canDeleteItem
}: DraggableModuleItemProps) {
  const navigate = useNavigate();
  const [isDragOver, setIsDragOver] = useState(false);
  const [isDragOverBefore, setIsDragOverBefore] = useState(false);
  const [isDragOverAfter, setIsDragOverAfter] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const dragTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dragCounterRef = useRef(0);

  const displayName = customNames[item.key]?.name || item.name;
  const displayDescription = customNames[item.key]?.description || item.description;

  // Handle drop zone before this item
  const handleDropBefore = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverBefore(false);
    onDropBetween(index, e);
  };

  // Handle drop zone after this item
  const handleDropAfter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverAfter(false);
    onDropBetween(index + 1, e);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) {
      setIsDragOver(true);
    }

    // Auto-open folder after hovering for 500ms
    if (item.type === 'folder' && !item.isOpen) {
      if (dragTimeoutRef.current) {
        clearTimeout(dragTimeoutRef.current);
      }
      dragTimeoutRef.current = setTimeout(() => {
        onToggleFolder(item.id);
      }, 500);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) {
      setIsDragOver(false);
      if (dragTimeoutRef.current) {
        clearTimeout(dragTimeoutRef.current);
        dragTimeoutRef.current = null;
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    dragCounterRef.current = 0;
    setIsDragOver(false);

    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current);
      dragTimeoutRef.current = null;
    }

    onDrop(item, e);
  };

  const isDragHandle = (target: EventTarget | null) => {
    const el = target as HTMLElement | null;
    return !!el?.closest?.('[data-drag-handle="true"]');
  };

  const isInteractiveElement = (target: EventTarget | null) => {
    const el = target as HTMLElement | null;
    // Treat common interactive elements as "no drag" unless it's the drag handle
    return !!el?.closest?.('button, a, input, textarea, select, [role="button"], [data-no-drag="true"]');
  };

  const handleDragStartFromHandle = (e: React.DragEvent) => {
    e.stopPropagation();
    onDragStart(item, e);
  };

  const handleDragStartFromCard = (e: React.DragEvent) => {
    // Allow drag from anywhere on the card except interactive controls (edit/delete/navigate/toggle)
    if (!isDragHandle(e.target) && isInteractiveElement(e.target)) {
      e.preventDefault();
      return;
    }
    e.stopPropagation();
    onDragStart(item, e);
  };

  const handleDragEndFromHandle = (e: React.DragEvent) => {
    e.stopPropagation();

    dragCounterRef.current = 0;
    setIsDragOver(false);
    setIsDragOverBefore(false);
    setIsDragOverAfter(false);

    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current);
      dragTimeoutRef.current = null;
    }

    onDragEnd();
  };

  const handleDragEndFromCard = (e: React.DragEvent) => {
    e.stopPropagation();
    handleDragEndFromHandle(e);
  };

  const startEditing = () => {
    setEditedName(displayName);
    setEditedDescription(displayDescription);
    setIsEditing(true);
  };

  const saveEdit = () => {
    if (editedName.trim()) {
      onEditItem(item, editedName.trim(), editedDescription.trim());
      setIsEditing(false);
    }
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditedName('');
    setEditedDescription('');
  };

  const handleNavigate = (href: string) => {
    if (onNavigate) {
      onNavigate(href);
    } else {
      navigate(href);
    }
  };

  const paddingLeft = level * 24;

  if (isEditing) {
    return (
      <div
        className="p-4 rounded-lg border-2 border-primary bg-background"
        style={{ marginRight: `${paddingLeft}px` }}
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {item.type === 'folder' ? (
              <div className="p-2 rounded-lg bg-amber-100 flex-shrink-0">
                <Folder className="h-5 w-5 text-amber-600" />
              </div>
            ) : (
              <div className={`p-2 rounded-lg ${item.bgColor || 'bg-gray-100'} flex-shrink-0`}>
                <Building2 className={`h-5 w-5 ${item.color || 'text-gray-600'}`} />
              </div>
            )}
            <span className="text-xs text-muted-foreground">
              ویرایش {item.type === 'folder' ? 'پوشه' : 'ماژول'}
            </span>
          </div>
          <Input
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            placeholder={item.type === 'folder' ? 'نام پوشه' : 'نام ماژول'}
            className="font-semibold"
            autoFocus
          />
          <Input
            value={editedDescription}
            onChange={(e) => setEditedDescription(e.target.value)}
            placeholder="توضیحات"
            className="text-sm"
          />
          <div className="flex items-center gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={cancelEdit}
              className="gap-1"
            >
              <X className="h-4 w-4" />
              انصراف
            </Button>
            <Button
              size="sm"
              onClick={saveEdit}
              className="gap-1"
            >
              <Check className="h-4 w-4" />
              ذخیره
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isOtherItemBeingDragged = !!draggedItemId && draggedItemId !== item.id;
  const isDragged = draggedItemId === item.id;

  return (
    <div style={{ marginRight: `${paddingLeft}px` }} className="relative">
      {/* Drop zone before this item - only show for first item or when dragging */}
      {isFirst && isOtherItemBeingDragged && (
        <div
          className={`h-5 -mt-1 mb-2 rounded-md transition-all ${
            isDragOverBefore ? 'bg-primary/40 h-6' : 'bg-transparent hover:bg-primary/20'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOverBefore(true);
          }}
          onDragLeave={() => setIsDragOverBefore(false)}
          onDrop={handleDropBefore}
        />
      )}
      
      <div
        draggable
        onDragStart={handleDragStartFromCard}
        onDragEnd={handleDragEndFromCard}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          onDragOver(e);
        }}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`p-4 rounded-lg border-2 bg-background transition-all select-none ${
          isDragged ? 'opacity-60' : ''
        } ${
          isDragOver
            ? 'border-primary bg-primary/5 scale-[1.02]'
            : 'border-border hover:border-muted-foreground/30'
        }`}
      >
        <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
          <button
            type="button"
            draggable
            data-drag-handle="true"
            onDragStart={handleDragStartFromHandle}
            onDragEnd={handleDragEndFromHandle}
            className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-grab active:cursor-grabbing touch-none"
            aria-label="گرفتن و جابه‌جایی"
            title="برای جابه‌جایی بکشید"
          >
            <GripVertical className="h-5 w-5" />
          </button>
          
          {item.type === 'folder' ? (
            <>
              <button
                onClick={() => onToggleFolder(item.id)}
                className="p-2 rounded-lg bg-amber-100 hover:bg-amber-200 transition-colors flex-shrink-0"
              >
                {item.isOpen ? (
                  <FolderOpen className="h-5 w-5 text-amber-600" />
                ) : (
                  <Folder className="h-5 w-5 text-amber-600" />
                )}
              </button>
              <button
                onClick={() => onToggleFolder(item.id)}
                className="flex-1 min-w-0 text-right"
              >
                <div className="font-semibold text-sm whitespace-normal leading-relaxed flex items-center gap-2">
                  {displayName}
                  {item.isOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="text-xs text-muted-foreground whitespace-normal leading-relaxed">
                  {displayDescription}
                  {item.children && item.children.length > 0 && (
                    <span className="mr-2 text-primary">({item.children.length} آیتم)</span>
                  )}
                </div>
              </button>
            </>
          ) : (
            <>
              <div className={`p-2 rounded-lg ${item.bgColor || 'bg-gray-100'} flex-shrink-0`}>
                <Building2 className={`h-5 w-5 ${item.color || 'text-gray-600'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm whitespace-normal leading-relaxed">
                  {displayName}
                </div>
                {(item.assignedPhone || item.assignedUserName) && (
                  <div className="text-xs text-muted-foreground whitespace-normal leading-relaxed mt-0.5">
                    <span dir="ltr" className="inline-block">
                      {item.assignedPhone || ''}
                    </span>
                    {(item.assignedPhone && item.assignedUserName) ? ' - ' : ''}
                    <span>{item.assignedUserName || ''}</span>
                  </div>
                )}
                <div className="text-xs text-muted-foreground whitespace-normal leading-relaxed">
                  {displayDescription}
                </div>
              </div>
            </>
          )}
          
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                startEditing();
              }}
              className="h-8 w-8"
              title="ویرایش"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            {showDuplicateButton && onDuplicate && item.type === 'module' && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicate(item);
                }}
                className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                title="کپی ماژول"
              >
                <Copy className="h-4 w-4" />
              </Button>
            )}
            {showDeleteButton && onDelete && item.type === 'module' && (!canDeleteItem || canDeleteItem(item)) && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(item.id);
                }}
                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                title="حذف"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            {item.type === 'module' && item.href && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNavigate(item.href!);
                }}
              >
                ورود به ماژول
              </Button>
            )}
          </div>
        </div>
      </div>
      
      {/* Drop zone after this item - always visible when dragging */}
      {isOtherItemBeingDragged && (
        <div
          className={`h-5 mt-2 rounded-md transition-all ${
            isDragOverAfter ? 'bg-primary/40 h-6' : 'bg-transparent hover:bg-primary/20'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOverAfter(true);
          }}
          onDragLeave={() => setIsDragOverAfter(false)}
          onDrop={handleDropAfter}
        />
      )}
      
      {/* Render children if folder is open */}
      {item.type === 'folder' && item.isOpen && item.children && (
        <div className="mt-2 space-y-2">
          {item.children.map((child, childIndex) => (
            <DraggableModuleItem
              key={child.id}
              item={child}
              index={childIndex}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onDropBetween={onDropBetween}
              onDragEnd={onDragEnd}
              onToggleFolder={onToggleFolder}
              onEditItem={onEditItem}
              onNavigate={onNavigate}
              onDelete={onDelete}
              onDuplicate={onDuplicate}
              level={level + 1}
              customNames={customNames}
              showDeleteButton={showDeleteButton}
              showDuplicateButton={showDuplicateButton}
              isFirst={childIndex === 0}
              draggedItemId={draggedItemId}
              canDeleteItem={canDeleteItem}
            />
          ))}
        </div>
      )}
    </div>
  );
}
