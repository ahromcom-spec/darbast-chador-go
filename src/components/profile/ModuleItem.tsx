import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Folder, FolderOpen, ChevronLeft, ChevronDown, Pencil, Check, X, Trash2, Copy, ChevronUp, Plus, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export interface ModuleItemData {
  id: string;
  type: 'module' | 'folder';
  key: string;
  name: string;
  description: string;
  assignedPhone?: string;
  assignedUserName?: string;
  href?: string;
  color?: string;
  bgColor?: string;
  children?: ModuleItemData[];
  isOpen?: boolean;
}

interface ModuleItemProps {
  item: ModuleItemData;
  index: number;
  totalItems: number;
  onMoveUp: (itemId: string) => void;
  onMoveDown: (itemId: string) => void;
  onToggleFolder: (folderId: string) => void;
  onEditItem: (item: ModuleItemData, newName: string, newDescription: string) => void;
  onNavigate?: (href: string) => void;
  onDelete?: (itemId: string) => void;
  onDuplicate?: (item: ModuleItemData) => void;
  onAddToFolder?: (folderId: string, moduleId: string) => void;
  onRemoveFromFolder?: (moduleId: string) => void;
  level?: number;
  customNames?: Record<string, { name: string; description: string }>;
  showDeleteButton?: boolean;
  showDuplicateButton?: boolean;
  canDeleteItem?: (item: ModuleItemData) => boolean;
  availableModulesForFolder?: ModuleItemData[];
  isInsideFolder?: boolean;
}

export function ModuleItem({
  item,
  index,
  totalItems,
  onMoveUp,
  onMoveDown,
  onToggleFolder,
  onEditItem,
  onNavigate,
  onDelete,
  onDuplicate,
  onAddToFolder,
  onRemoveFromFolder,
  level = 0,
  customNames = {},
  showDeleteButton = false,
  showDuplicateButton = false,
  canDeleteItem,
  availableModulesForFolder = [],
  isInsideFolder = false
}: ModuleItemProps) {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [showAddModuleDialog, setShowAddModuleDialog] = useState(false);

  const displayName = customNames[item.key]?.name || item.name;
  const displayDescription = customNames[item.key]?.description || item.description;

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

  return (
    <div style={{ marginRight: `${paddingLeft}px` }} className="relative">
      <div className="p-4 rounded-lg border-2 bg-background border-border hover:border-muted-foreground/30 transition-all">
        <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
          {/* Up/Down buttons */}
          <div className="flex flex-col gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onMoveUp(item.id)}
              disabled={index === 0}
              title="بالا"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onMoveDown(item.id)}
              disabled={index === totalItems - 1}
              title="پایین"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
          
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
          
          <div className="flex items-center gap-1 flex-shrink-0 flex-wrap">
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
            {/* Remove from folder button */}
            {isInsideFolder && onRemoveFromFolder && item.type === 'module' && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveFromFolder(item.id);
                }}
                className="h-8 w-8 text-orange-600 hover:text-orange-600 hover:bg-orange-100"
                title="خروج از پوشه"
              >
                <LogOut className="h-4 w-4" />
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
      
      {/* Folder children and add module button */}
      {item.type === 'folder' && item.isOpen && (
        <div className="mt-2 space-y-2">
          {/* Add module button inside folder */}
          {onAddToFolder && (
            <div className="mr-6 mb-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddModuleDialog(true)}
                className="gap-2 w-full border-dashed border-2 text-muted-foreground hover:text-foreground"
              >
                <Plus className="h-4 w-4" />
                افزودن ماژول به پوشه
              </Button>
            </div>
          )}
          
          {item.children && item.children.map((child, childIndex) => (
            <ModuleItem
              key={child.id}
              item={child}
              index={childIndex}
              totalItems={item.children?.length || 0}
              onMoveUp={onMoveUp}
              onMoveDown={onMoveDown}
              onToggleFolder={onToggleFolder}
              onEditItem={onEditItem}
              onNavigate={onNavigate}
              onDelete={onDelete}
              onDuplicate={onDuplicate}
              onAddToFolder={onAddToFolder}
              onRemoveFromFolder={onRemoveFromFolder}
              level={level + 1}
              customNames={customNames}
              showDeleteButton={showDeleteButton}
              showDuplicateButton={showDuplicateButton}
              canDeleteItem={canDeleteItem}
              isInsideFolder={true}
            />
          ))}
        </div>
      )}

      {/* Add Module to Folder Dialog */}
      <Dialog open={showAddModuleDialog} onOpenChange={setShowAddModuleDialog}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>افزودن ماژول به پوشه «{displayName}»</DialogTitle>
            <DialogDescription>
              ماژول مورد نظر را انتخاب کنید
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {availableModulesForFolder.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                همه ماژول‌ها در پوشه‌ها هستند
              </p>
            ) : (
              availableModulesForFolder.map((mod) => (
                <button
                  key={mod.id}
                  className="w-full p-3 rounded-lg border hover:bg-accent text-right flex items-center gap-3 transition-colors"
                  onClick={() => {
                    onAddToFolder?.(item.id, mod.id);
                    setShowAddModuleDialog(false);
                  }}
                >
                  <div className={`p-2 rounded-lg ${mod.bgColor || 'bg-gray-100'} flex-shrink-0`}>
                    <Building2 className={`h-4 w-4 ${mod.color || 'text-gray-600'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{customNames[mod.key]?.name || mod.name}</div>
                    <div className="text-xs text-muted-foreground">{customNames[mod.key]?.description || mod.description}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
