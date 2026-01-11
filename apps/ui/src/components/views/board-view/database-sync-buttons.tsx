/**
 * 🔄 Database Sync Buttons
 *
 * Compact sync buttons for the Kanban Board header.
 * Provides Pull/Push functionality between local features and Postgres DB.
 *
 * @see docs/pg-online-sync/tasks/phase-6.3-simplified-sync.md
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Download, Upload, Loader2, CloudOff, CloudUpload } from 'lucide-react';
import { useDatabaseSync } from '@/hooks/use-database-sync';
import { useSeedLocalProjects } from '@/hooks/use-online-projects';
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

  // No matching project - show "Connect to DB" button
  if (!isConnected) {
    return <ConnectToDbButton projectPath={projectPath} projectName={projectName} />;
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

/**
 * Button to connect/seed the current project to the database
 */
function ConnectToDbButton({
  projectPath,
  projectName,
}: {
  projectPath: string | null;
  projectName: string;
}) {
  const [isConnecting, setIsConnecting] = useState(false);
  const seedLocalProjects = useSeedLocalProjects();

  const handleConnect = async () => {
    if (!projectPath || !projectName) {
      toast.error('Kein Projekt ausgewählt');
      return;
    }

    setIsConnecting(true);
    try {
      const result = await seedLocalProjects.mutateAsync({
        projects: [{ name: projectName, path: projectPath }],
        includeTickets: true,
      });

      if (result.success) {
        const { summary } = result;
        if (summary.projectsCreated > 0) {
          toast.success(`Projekt "${projectName}" zur Datenbank hinzugefügt`, {
            description: `${summary.ticketsCreated} Ticket(s) importiert`,
          });
          // Force a reload to update the connection status
          window.location.reload();
        } else {
          toast.info('Projekt bereits in Datenbank vorhanden');
          window.location.reload();
        }
      }
    } catch (error) {
      toast.error('Verbindung fehlgeschlagen', {
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            onClick={handleConnect}
            disabled={isConnecting || !projectPath}
            className="h-8 px-2.5 bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20 hover:border-amber-500/50 hover:shadow-[0_0_15px_-3px_rgba(245,158,11,0.5)] transition-all"
          >
            {isConnecting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CloudUpload className="w-4 h-4" />
            )}
            <span className="ml-1.5 text-xs">Connect</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Mit Datenbank verbinden</p>
          <p className="text-xs text-muted-foreground">
            Projekt zur Postgres-DB hinzufügen und Tickets importieren
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
