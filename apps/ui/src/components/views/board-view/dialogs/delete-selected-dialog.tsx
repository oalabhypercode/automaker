/**
 * Delete Selected Features Dialog
 *
 * Confirmation dialog for bulk-deleting selected features.
 * Shows warning when synced features will be deleted from Postgres database.
 *
 * @see docs/pg-online-sync/tasks/phase-7.0-synced-delete-status.md (Phase 7.4)
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Trash2, Loader2, Package, Cloud, AlertTriangle } from 'lucide-react';
import type { Feature } from '@automaker/types';

interface DeleteSelectedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  selectedFeatures: Feature[];
  syncedFeatures: Feature[];
  isDeleting: boolean;
}

export function DeleteSelectedDialog({
  open,
  onOpenChange,
  onConfirm,
  selectedFeatures,
  syncedFeatures,
  isDeleting,
}: DeleteSelectedDialogProps) {
  const totalCount = selectedFeatures.length;
  const syncedCount = syncedFeatures.length;
  const localCount = totalCount - syncedCount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="delete-selected-dialog" className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-destructive" />
            Delete Features
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete {totalCount} feature
            {totalCount !== 1 ? 's' : ''}? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {/* Feature breakdown */}
        <div className="space-y-3 py-2">
          {localCount > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Package className="w-4 h-4" />
              <span>
                {localCount} local feature{localCount !== 1 ? 's' : ''}
              </span>
            </div>
          )}

          {syncedCount > 0 && (
            <div className="flex items-center gap-2 text-sm text-sky-500">
              <Cloud className="w-4 h-4" />
              <span>
                {syncedCount} synced feature{syncedCount !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        {/* Warning for synced features */}
        {syncedCount > 0 && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-500">Database Warning</p>
              <p className="text-muted-foreground mt-1">
                The synced features will also be removed from the Postgres database.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="mt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
            data-testid="confirm-delete-selected"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete {totalCount}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
