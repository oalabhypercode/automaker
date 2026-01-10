/**
 * 🔄 Database Sync Buttons
 *
 * Compact sync buttons for the Kanban Board header.
 * Provides Pull/Push functionality between local features and Postgres DB.
 *
 * @see docs/pg-online-sync/tasks/phase-6.3-simplified-sync.md
 */

import { Button } from '@/components/ui/button';
import { Download, Upload, Loader2, CloudOff } from 'lucide-react';
import { useDatabaseSync } from '@/hooks/use-database-sync';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface DatabaseSyncButtonsProps {
  projectPath: string | null;
  projectName: string;
  onFeaturesUpdated: () => void;
}

export function DatabaseSyncButtons({
  projectPath,
  projectName,
  onFeaturesUpdated,
}: DatabaseSyncButtonsProps) {
  const { pullFromDatabase, isPulling, pushToDatabase, isPushing, isConnected, isLoading } =
    useDatabaseSync({
      projectPath,
      projectName,
      onFeaturesUpdated,
    });

  // Show loading state while fetching projects
  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 px-2">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // No matching project - show disabled state with tooltip
  if (!isConnected) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 border border-border/50">
              <CloudOff className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Not connected</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Project not connected to database.</p>
            <p className="text-xs text-muted-foreground">
              Visit Online Sync to connect this project.
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1.5">
        {/* Pull Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              onClick={pullFromDatabase}
              disabled={isPulling || isPushing}
              className="h-8 px-2.5 bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20 hover:border-blue-500/50 hover:shadow-[0_0_15px_-3px_rgba(59,130,246,0.5)] transition-all"
            >
              {isPulling ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span className="ml-1.5 text-xs">Pull</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Pull from Database</p>
            <p className="text-xs text-muted-foreground">
              Fetch tickets from Postgres into local features
            </p>
          </TooltipContent>
        </Tooltip>

        {/* Push Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              onClick={pushToDatabase}
              disabled={isPulling || isPushing}
              className="h-8 px-2.5 bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20 hover:border-emerald-500/50 hover:shadow-[0_0_15px_-3px_rgba(16,185,129,0.5)] transition-all"
            >
              {isPushing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              <span className="ml-1.5 text-xs">Push</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Push to Database</p>
            <p className="text-xs text-muted-foreground">
              Send local features to Postgres database
            </p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
