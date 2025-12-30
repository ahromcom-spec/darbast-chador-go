import { useState } from 'react';
import { Building2, ChevronDown, ChevronUp, ChevronLeft, Pencil, Check, X, Trash2, Users, UserMinus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';

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

interface AssignedModuleItemProps {
  module: AssignedModuleData;
  index: number;
  totalItems: number;
  onMoveUp: (moduleKey: string) => void;
  onMoveDown: (moduleKey: string) => void;
  onEditModule: (moduleKey: string, newName: string, newDescription: string) => void;
  onRemoveAssignment: (assignmentId: string) => void;
  onDeleteModule: (moduleKey: string) => void;
  customNames?: Record<string, { name: string; description: string }>;
}

export function AssignedModuleItem({
  module,
  index,
  totalItems,
  onMoveUp,
  onMoveDown,
  onEditModule,
  onRemoveAssignment,
  onDeleteModule,
  customNames = {},
}: AssignedModuleItemProps) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedDescription, setEditedDescription] = useState('');

  const displayName = customNames[module.moduleKey]?.name || module.moduleName;
  const displayDescription = customNames[module.moduleKey]?.description || module.moduleDescription;
  const hasAssignments = module.assignments.length > 0;

  const startEditing = () => {
    setEditedName(displayName);
    setEditedDescription(displayDescription);
    setIsEditing(true);
  };

  const saveEdit = () => {
    if (editedName.trim()) {
      onEditModule(module.moduleKey, editedName.trim(), editedDescription.trim());
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
      url.searchParams.set('moduleKey', module.moduleKey);
      return `${url.pathname}${url.search}${url.hash}`;
    } catch {
      const sep = href.includes('?') ? '&' : '?';
      return `${href}${sep}moduleKey=${encodeURIComponent(module.moduleKey)}`;
    }
  };

  if (isEditing) {
    return (
      <div className="p-4 rounded-lg border-2 border-primary bg-background">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${module.bgColor || 'bg-gray-100'} flex-shrink-0`}>
              <Building2 className={`h-5 w-5 ${module.color || 'text-gray-600'}`} />
            </div>
            <span className="text-xs text-muted-foreground">ویرایش ماژول</span>
          </div>
          <Input
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            placeholder="نام ماژول"
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

  return (
    <div className="relative">
      <div className="p-4 rounded-lg border-2 bg-background border-border hover:border-muted-foreground/30 transition-all">
        <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
          {/* Up/Down buttons */}
          <div className="flex flex-col gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onMoveUp(module.moduleKey)}
              disabled={index === 0}
              title="بالا"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onMoveDown(module.moduleKey)}
              disabled={index === totalItems - 1}
              title="پایین"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>

          {/* Module icon & toggle */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`p-2 rounded-lg ${module.bgColor || 'bg-gray-100'} hover:opacity-80 transition-opacity flex-shrink-0`}
          >
            <Building2 className={`h-5 w-5 ${module.color || 'text-gray-600'}`} />
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
                {module.assignments.length} نفر
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

            {/* Delete button only shown if no assignments */}
            {!hasAssignments && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteModule(module.moduleKey);
                }}
                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                title="حذف ماژول"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}

            {module.href && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(buildModuleHref(module.href!));
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
          {module.assignments.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground text-sm border rounded-lg border-dashed">
              هیچ کاربری به این ماژول اختصاص داده نشده است.
              <br />
              <span className="text-xs">اکنون می‌توانید این ماژول را حذف کنید.</span>
            </div>
          ) : (
            module.assignments.map((user) => (
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
