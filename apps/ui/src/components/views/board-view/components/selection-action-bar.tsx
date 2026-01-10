import { Button } from '@/components/ui/button';
import { Pencil, X, CheckSquare, Trash2, Loader2, Cloud } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface SelectionActionBarProps {
  selectedCount: number;
  totalCount: number;
  onEdit: () => void;
  onClear: () => void;
  onSelectAll: () => void;
  // Delete-Funktionalität
  onDelete?: () => void;
  syncedCount?: number;
  isDeleting?: boolean;
}

export function SelectionActionBar({
  selectedCount,
  totalCount,
  onEdit,
  onClear,
  onSelectAll,
  onDelete,
  syncedCount = 0,
  isDeleting = false,
}: SelectionActionBarProps) {
  if (selectedCount === 0) return null;

  const allSelected = selectedCount === totalCount;

  return (
    <div
      className={cn(
        'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
        'flex items-center gap-3 px-4 py-3 rounded-xl',
        'bg-background/95 backdrop-blur-sm border border-border shadow-lg',
        'animate-in slide-in-from-bottom-4 fade-in duration-200'
      )}
      data-testid="selection-action-bar"
    >
      <span className="text-sm font-medium text-foreground">
        {selectedCount} feature{selectedCount !== 1 ? 's' : ''} selected
        {syncedCount > 0 && (
          <span className="ml-1.5 inline-flex items-center text-xs text-muted-foreground">
            <Cloud className="w-3 h-3 mr-0.5" />
            {syncedCount}
          </span>
        )}
      </span>

      <div className="h-4 w-px bg-border" />

      <div className="flex items-center gap-2">
        {/* Delete Button */}
        {onDelete && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                disabled={isDeleting}
                className={cn(
                  'h-8 text-destructive hover:text-destructive hover:bg-destructive/10',
                  isDeleting && 'opacity-50 cursor-not-allowed'
                )}
                data-testid="selection-delete-button"
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-1.5" />
                )}
                Delete
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {syncedCount > 0
                ? `Delete ${selectedCount} feature(s) (${syncedCount} synced)`
                : `Delete ${selectedCount} feature(s)`}
            </TooltipContent>
          </Tooltip>
        )}

        <Button
          variant="default"
          size="sm"
          onClick={onEdit}
          className="h-8 bg-brand-500 hover:bg-brand-600"
          data-testid="selection-edit-button"
        >
          <Pencil className="w-4 h-4 mr-1.5" />
          Edit Selected
        </Button>

        {!allSelected && (
          <Button
            variant="outline"
            size="sm"
            onClick={onSelectAll}
            className="h-8"
            data-testid="selection-select-all-button"
          >
            <CheckSquare className="w-4 h-4 mr-1.5" />
            Select All ({totalCount})
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="h-8 text-muted-foreground hover:text-foreground"
          data-testid="selection-clear-button"
        >
          <X className="w-4 h-4 mr-1.5" />
          Clear
        </Button>
      </div>
    </div>
  );
}
