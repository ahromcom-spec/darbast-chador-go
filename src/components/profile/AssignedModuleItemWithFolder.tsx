import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Folder, FolderOpen, ChevronLeft, ChevronDown, ChevronUp, Pencil, Check, X, Trash2, Users, UserMinus, Plus, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export interface AssignedUser {
  id: string;
  phone: string;
  name?: string;
}

export interface AssignedModuleData {
  moduleKey: string;
  moduleName: string;
  moduleDescription: string;
  href?: string;
  color?: string;
  bgColor?: string;
  assignments: AssignedUser[];
}

// Data structure for hierarchy
export interface AssignedHierarchyItem {
  id: string;
  type: 'module' | 'folder';
  key: string;
  name: string;
  description: string;
  href?: string;
  color?: string;
  bgColor?: string;
  children?: AssignedHierarchyItem[];
  isOpen?: boolean;
  // For modules with assignments
  assignments?: AssignedUser[];
}

interface AssignedModuleItemWithFolderProps {
  item: AssignedHierarchyItem;
  index: number;
  totalItems: number;
  onMoveUp: (itemId: string) => void;
  onMoveDown: (itemId: string) => void;
  onToggleFolder: (folderId: string) => void;
  onEditItem: (item: AssignedHierarchyItem, newName: string, newDescription: string) => void;
  onRemoveAssignment: (assignmentId: string) => void;
  onDeleteItem: (itemId: string) => void;
  onAddToFolder?: (folderId: string, moduleId: string) => void;
  onRemoveFromFolder?: (moduleId: string) => void;
  customNames?: Record<string, { name: string; description: string }>;
  level?: number;
  isInsideFolder?: boolean;
  availableModulesForFolder?: AssignedHierarchyItem[];
  allModulesData?: Map<string, AssignedModuleData>;
}

export function AssignedModuleItemWithFolder({
  item,
  index,
  totalItems,
  onMoveUp,
  onMoveDown,
  onToggleFolder,
  onEditItem,
  onRemoveAssignment,
  onDeleteItem,
  onAddToFolder,
  onRemoveFromFolder,
  customNames = {},
  level = 0,
  isInsideFolder = false,
  availableModulesForFolder = [],
  allModulesData,
}: AssignedModuleItemWithFolderProps) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [showAddModuleDialog, setShowAddModuleDialog] = useState(false);

  const displayName = customNames[item.key]?.name || item.name;
  const displayDescription = customNames[item.key]?.description || item.description;
  
  // Get assignments from allModulesData if available
  const moduleData = allModulesData?.get(item.key);
  const assignments = item.assignments || moduleData?.assignments || [];
  const hasAssignments = assignments.length > 0;

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

  const buildModuleHref = (href: string) => {
    try {
      const url = new URL(href, window.location.origin);
      url.searchParams.set('moduleKey', item.key);
      return `${url.pathname}${url.search}${url.hash}`;
    } catch {
      const sep = href.includes('?') ? '&' : '?';
      return `${href}${sep}moduleKey=${encodeURIComponent(item.key)}`;
    }
  };

  const paddingRight = level * 24;

  // Editing mode
  if (isEditing) {
    return (
      <div
        className="p-4 rounded-lg border-2 border-primary bg-background"
        style={{ marginRight: `${paddingRight}px` }}
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
            <Button variant="ghost" size="sm" onClick={cancelEdit} className="gap-1">
              <X className="h-4 w-4" />
              انصراف
            </Button>
            <Button size="sm" onClick={saveEdit} className="gap-1">
              <Check className="h-4 w-4" />
              ذخیره
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Folder
  if (item.type === 'folder') {
    const childCount = item.children?.length || 0;
    const canDeleteFolder = childCount === 0;

    return (
      <div style={{ marginRight: `${paddingRight}px` }}>
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

            {/* Folder icon */}
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

            {/* Folder info */}
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
                {childCount > 0 && (
                  <span className="mr-2 text-primary">({childCount} آیتم)</span>
                )}
              </div>
            </button>

            {/* Actions */}
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
              {canDeleteFolder && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteItem(item.id);
                  }}
                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  title="حذف پوشه خالی"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Folder children */}
        {item.isOpen && (
          <div className="mt-2 space-y-2">
            {item.children?.map((child, childIndex) => (
              <AssignedModuleItemWithFolder
                key={child.id}
                item={child}
                index={childIndex}
                totalItems={item.children?.length || 0}
                onMoveUp={onMoveUp}
                onMoveDown={onMoveDown}
                onToggleFolder={onToggleFolder}
                onEditItem={onEditItem}
                onRemoveAssignment={onRemoveAssignment}
                onDeleteItem={onDeleteItem}
                onAddToFolder={onAddToFolder}
                onRemoveFromFolder={onRemoveFromFolder}
                customNames={customNames}
                level={level + 1}
                isInsideFolder={true}
                allModulesData={allModulesData}
              />
            ))}

            {/* Add module button */}
            {onAddToFolder && (
              <div className="mr-6 mt-2">
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

  // Module
  return (
    <div style={{ marginRight: `${paddingRight}px` }} className="relative">
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

          {/* Module icon & toggle */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`p-2 rounded-lg ${item.bgColor || 'bg-gray-100'} hover:opacity-80 transition-opacity flex-shrink-0`}
          >
            <Building2 className={`h-5 w-5 ${item.color || 'text-gray-600'}`} />
          </button>

          {/* Module info */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex-1 min-w-0 text-right"
          >
            <div className="font-semibold text-sm whitespace-normal leading-relaxed flex items-center gap-2">
              {displayName}
              <Badge variant="secondary" className="text-xs">
                <Users className="h-3 w-3 ml-1" />
                {assignments.length} نفر
              </Badge>
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div className="text-xs text-muted-foreground whitespace-normal leading-relaxed">
              {displayDescription}
            </div>
          </button>

          {/* Actions */}
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

            {/* Remove from folder button */}
            {isInsideFolder && onRemoveFromFolder && (
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

            {/* Delete button only shown if no assignments */}
            {!hasAssignments && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteItem(item.id);
                }}
                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                title="حذف ماژول"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}

            {item.href && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(buildModuleHref(item.href!));
                }}
              >
                ورود به ماژول
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Expanded: list of assigned users */}
      {isOpen && (
        <div className="mt-2 mr-6 space-y-2">
          {assignments.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground text-sm border rounded-lg border-dashed">
              هیچ کاربری به این ماژول اختصاص داده نشده است.
              <br />
              <span className="text-xs">اکنون می‌توانید این ماژول را حذف کنید.</span>
            </div>
          ) : (
            assignments.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">
                    {user.name || 'کاربر یافت نشد'}
                  </div>
                  <div className="text-xs text-muted-foreground" dir="ltr">
                    {user.phone}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemoveAssignment(user.id)}
                  className="gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <UserMinus className="h-4 w-4" />
                  لغو اختصاص
                </Button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
