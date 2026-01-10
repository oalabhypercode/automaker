/**
 * 🔄 Online Sync View
 *
 * Management interface for online-sync projects and their public access settings.
 *
 * @see docs/pg-online-sync/tasks/phase-3.5-kunden-permissions.md
 */

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Globe,
  Lock,
  Unlock,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Loader2,
  Settings2,
  Eye,
  EyeOff,
  MessageSquarePlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/app-store';
import {
  useOnlineProjects,
  useSeedLocalProjects,
  useEnableCustomerAccess,
  useDisableCustomerAccess,
  useSetProjectPassword,
  useRemoveProjectPassword,
  useUpdatePublicSettings,
  useUpdateProjectSlug,
  type OnlineProject,
} from '@/hooks/use-online-projects';

const ALL_STATUSES = ['backlog', 'todo', 'in_progress', 'review', 'done', 'archived'];
const STATUS_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  todo: 'Todo',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done',
  archived: 'Archived',
};

export function OnlineSyncView() {
  const { data: projects, isLoading, error } = useOnlineProjects();
  const localProjects = useAppStore((state) => state.projects);
  const seedLocalProjects = useSeedLocalProjects();
  const hasLocalProjects = localProjects.length > 0;

  const handleSeedLocalProjects = useCallback(async () => {
    if (!hasLocalProjects) {
      toast.error('No local projects found to import');
      return;
    }

    try {
      const result = await seedLocalProjects.mutateAsync({
        projects: localProjects.map((project) => ({
          name: project.name,
          path: project.path,
        })),
        includeTickets: true,
      });

      const { summary } = result;
      toast.success(
        `Imported ${summary.projectsCreated} project(s) and ${summary.ticketsCreated} ticket(s)`
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to import local projects');
    }
  }, [hasLocalProjects, localProjects, seedLocalProjects]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center flex-col gap-4">
        <h1 className="text-xl font-bold text-destructive">Error</h1>
        <p className="text-muted-foreground">{error.message}</p>
        <p className="text-sm text-muted-foreground">
          Make sure the pg-sync database is configured and accessible.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden content-bg">
      {/* Header */}
      <div className="border-b border-border/60 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Globe className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Online Sync</h1>
            <p className="text-sm text-muted-foreground">
              Manage public access settings for your online projects
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {!projects || projects.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Globe className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-lg font-medium mb-2">No Online Projects</h2>
                <p className="text-sm text-muted-foreground">
                  Projects synced to the online database will appear here.
                </p>
                {hasLocalProjects ? (
                  <div className="mt-6 space-y-4">
                    <div className="flex flex-wrap justify-center gap-2">
                      {localProjects.map((project) => (
                        <Badge key={project.id} variant="outline">
                          {project.name}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <Button
                        onClick={handleSeedLocalProjects}
                        disabled={seedLocalProjects.isPending}
                      >
                        {seedLocalProjects.isPending && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Import Local Projects
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        This will create online entries and import tickets from .automaker/features.
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground mt-4">
                    Open or create a project to import it here.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            projects.map((project) => <ProjectCard key={project.id} project={project} />)
          )}
        </div>
      </div>
    </div>
  );
}

function ProjectCard({ project }: { project: OnlineProject }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader
          className="cursor-pointer hover:bg-muted/30 transition-colors w-full text-left"
          onClick={() => setIsOpen(!isOpen)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <div>
                <CardTitle className="text-base">{project.name}</CardTitle>
                <CardDescription className="text-xs">/{project.slug}</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {project.customerAccessEnabled ? (
                <Badge variant="success" size="sm">
                  <Globe className="h-3 w-3 mr-1" />
                  Public
                </Badge>
              ) : (
                <Badge variant="muted" size="sm">
                  <EyeOff className="h-3 w-3 mr-1" />
                  Private
                </Badge>
              )}
              {project.hasPassword && (
                <Badge variant="warning" size="sm">
                  <Lock className="h-3 w-3 mr-1" />
                  Protected
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-6">
            <ProjectSettingsPanel project={project} />
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function ProjectSettingsPanel({ project }: { project: OnlineProject }) {
  const [newPassword, setNewPassword] = useState('');
  const [newSlug, setNewSlug] = useState(project.slug);
  const [copied, setCopied] = useState(false);

  const enableAccess = useEnableCustomerAccess(project.id);
  const disableAccess = useDisableCustomerAccess(project.id);
  const setPassword = useSetProjectPassword(project.id);
  const removePassword = useRemoveProjectPassword(project.id);
  const updateSettings = useUpdatePublicSettings(project.id);
  const updateSlug = useUpdateProjectSlug(project.id);

  const publicUrl = `${window.location.origin}/p/${project.slug}`;

  const handleCopyUrl = useCallback(() => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    toast.success('URL copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  }, [publicUrl]);

  const handleToggleAccess = useCallback(async () => {
    try {
      if (project.customerAccessEnabled) {
        await disableAccess.mutateAsync();
        toast.success('Public access disabled');
      } else {
        await enableAccess.mutateAsync();
        toast.success('Public access enabled');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update access');
    }
  }, [project.customerAccessEnabled, enableAccess, disableAccess]);

  const handleSetPassword = useCallback(async () => {
    if (!newPassword || newPassword.length < 4) {
      toast.error('Password must be at least 4 characters');
      return;
    }
    try {
      await setPassword.mutateAsync(newPassword);
      setNewPassword('');
      toast.success('Password set successfully');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to set password');
    }
  }, [newPassword, setPassword]);

  const handleRemovePassword = useCallback(async () => {
    try {
      await removePassword.mutateAsync();
      toast.success('Password removed');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove password');
    }
  }, [removePassword]);

  const handleUpdateSlug = useCallback(async () => {
    if (newSlug === project.slug) return;
    try {
      await updateSlug.mutateAsync(newSlug);
      toast.success('URL updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update URL');
    }
  }, [newSlug, project.slug, updateSlug]);

  const handleToggleSetting = useCallback(
    async (key: 'allowTicketCreation' | 'showComments', value: boolean) => {
      try {
        await updateSettings.mutateAsync({ [key]: value });
        toast.success('Settings updated');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to update settings');
      }
    },
    [updateSettings]
  );

  const handleUpdateVisibleStatuses = useCallback(
    async (statuses: string[]) => {
      try {
        await updateSettings.mutateAsync({ visibleStatuses: statuses });
        toast.success('Visible statuses updated');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to update statuses');
      }
    },
    [updateSettings]
  );

  const handleUpdateIntroMessage = useCallback(
    async (message: string) => {
      try {
        await updateSettings.mutateAsync({ introMessage: message });
        toast.success('Intro message updated');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to update message');
      }
    },
    [updateSettings]
  );

  const handleUpdateTheme = useCallback(
    async (theme: 'dark' | 'light') => {
      try {
        await updateSettings.mutateAsync({ theme });
        toast.success('Theme updated');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to update theme');
      }
    },
    [updateSettings]
  );

  const isUpdating =
    enableAccess.isPending ||
    disableAccess.isPending ||
    setPassword.isPending ||
    removePassword.isPending ||
    updateSettings.isPending ||
    updateSlug.isPending;

  return (
    <div className="space-y-6">
      {/* Public Access Toggle */}
      <div className="flex items-center justify-between rounded-lg border border-border/60 p-4">
        <div className="flex items-center gap-3">
          <Globe className="h-5 w-5 text-muted-foreground" />
          <div>
            <Label className="text-sm font-medium">Public Access</Label>
            <p className="text-xs text-muted-foreground">
              Allow customers to view this project at a public URL
            </p>
          </div>
        </div>
        <Switch
          checked={project.customerAccessEnabled}
          onCheckedChange={handleToggleAccess}
          disabled={isUpdating}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* Public URL */}
      {project.customerAccessEnabled && (
        <div className="space-y-3">
          <Label className="text-sm font-medium">Public URL</Label>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
              <span className="text-sm text-muted-foreground">{window.location.origin}/p/</span>
              <Input
                value={newSlug}
                onChange={(e) =>
                  setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                }
                className="h-auto p-0 border-0 bg-transparent text-sm font-medium focus-visible:ring-0"
                placeholder="project-slug"
              />
            </div>
            {newSlug !== project.slug && (
              <Button size="sm" onClick={handleUpdateSlug} disabled={isUpdating}>
                Save
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={handleCopyUrl}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      )}

      {/* Password Protection */}
      {project.customerAccessEnabled && (
        <div className="space-y-3">
          <Label className="text-sm font-medium">Password Protection</Label>
          {project.hasPassword ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Password is set</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRemovePassword}
                disabled={isUpdating}
              >
                <Unlock className="h-4 w-4 mr-2" />
                Remove
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter password (min 4 chars)"
                className="flex-1"
              />
              <Button size="sm" onClick={handleSetPassword} disabled={isUpdating || !newPassword}>
                <Lock className="h-4 w-4 mr-2" />
                Set Password
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {project.hasPassword
              ? 'Customers must enter this password to access the board.'
              : 'Without a password, anyone with the link can view the board.'}
          </p>
        </div>
      )}

      {/* Board Settings */}
      {project.customerAccessEnabled && (
        <div className="space-y-4 pt-4 border-t border-border/60">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm font-medium">Board Settings</Label>
          </div>

          {/* Allow Ticket Creation */}
          <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
            <div className="flex items-center gap-3">
              <MessageSquarePlus className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label className="text-sm">Allow Ticket Creation</Label>
                <p className="text-xs text-muted-foreground">Customers can submit new tickets</p>
              </div>
            </div>
            <Switch
              checked={project.publicSettings.allowTicketCreation}
              onCheckedChange={(checked) => handleToggleSetting('allowTicketCreation', checked)}
              disabled={isUpdating}
            />
          </div>

          {/* Show Comments */}
          <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
            <div className="flex items-center gap-3">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label className="text-sm">Show Comments</Label>
                <p className="text-xs text-muted-foreground">Display public comments on tickets</p>
              </div>
            </div>
            <Switch
              checked={project.publicSettings.showComments}
              onCheckedChange={(checked) => handleToggleSetting('showComments', checked)}
              disabled={isUpdating}
            />
          </div>

          {/* Visible Statuses */}
          <div className="space-y-2">
            <Label className="text-sm">Visible Status Columns</Label>
            <div className="flex flex-wrap gap-2">
              {ALL_STATUSES.map((status) => {
                const isVisible = project.publicSettings.visibleStatuses.includes(status);
                return (
                  <Badge
                    key={status}
                    variant={isVisible ? 'default' : 'outline'}
                    className={cn('cursor-pointer transition-colors', !isVisible && 'opacity-50')}
                    onClick={() => {
                      const newStatuses = isVisible
                        ? project.publicSettings.visibleStatuses.filter((s) => s !== status)
                        : [...project.publicSettings.visibleStatuses, status];
                      if (newStatuses.length > 0) {
                        handleUpdateVisibleStatuses(newStatuses);
                      }
                    }}
                  >
                    {STATUS_LABELS[status]}
                  </Badge>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Click to toggle which columns customers can see
            </p>
          </div>

          {/* Theme */}
          <div className="space-y-2">
            <Label className="text-sm">Theme</Label>
            <Select
              value={project.publicSettings.theme}
              onValueChange={(value: 'dark' | 'light') => handleUpdateTheme(value)}
              disabled={isUpdating}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="light">Light</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Intro Message */}
          <div className="space-y-2">
            <Label className="text-sm">Welcome Message (optional)</Label>
            <Textarea
              value={project.publicSettings.introMessage}
              onChange={(e) => handleUpdateIntroMessage(e.target.value)}
              placeholder="Welcome to our project roadmap!"
              rows={2}
              disabled={isUpdating}
            />
            <p className="text-xs text-muted-foreground">
              Displayed at the top of the public board
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
