import { createFileRoute } from '@tanstack/react-router';
import {
  usePublicProjectMeta,
  usePublicProjectBoard,
  usePublicProjectAuth,
  usePublicProjectLogout,
} from '@/hooks/use-public-project';
import { CustomerLoginForm } from '@/components/auth/customer-login-form';
import { PublicBoardView } from '@/components/public-board/public-board-view';
import { Loader2 } from 'lucide-react';

export const Route = createFileRoute('/p/$slug')({
  component: PublicProjectPage,
});

function PublicProjectPage() {
  const { slug } = Route.useParams();
  const meta = usePublicProjectMeta(slug);
  const auth = usePublicProjectAuth(slug);
  const logout = usePublicProjectLogout(slug);

  // Only fetch board if we have meta data.
  // We don't disable it based on password existence yet, because we might have a cookie.
  // The query will fail with 401 if we need login.
  const board = usePublicProjectBoard(slug, !!meta.data);

  if (meta.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (meta.isError || !meta.data) {
    return (
      <div className="flex h-screen items-center justify-center flex-col gap-4">
        <h1 className="text-2xl font-bold text-destructive">Project Not Found</h1>
        <p className="text-muted-foreground">
          The project you are looking for does not exist or is not public.
        </p>
      </div>
    );
  }

  // Check if we need login
  // 1. Project has password AND (Board returned 401 OR (Board is error and we assume it's auth related))
  const needsLogin =
    meta.data.hasPassword &&
    (board.error?.message === 'UNAUTHORIZED' ||
      (board.error && board.error.message.includes('401')));

  if (needsLogin) {
    return (
      <CustomerLoginForm
        project={meta.data}
        onLogin={async (password) => {
          await auth.mutateAsync(password);
          // Board query invalidation is handled in the hook
        }}
      />
    );
  }

  if (board.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (board.isError) {
    return (
      <div className="flex h-screen items-center justify-center flex-col gap-4">
        <h1 className="text-xl font-bold text-destructive">Error Loading Board</h1>
        <p className="text-muted-foreground">{board.error.message}</p>
      </div>
    );
  }

  return (
    <PublicBoardView
      project={meta.data}
      tickets={board.data?.tickets ?? []}
      onLogout={meta.data.hasPassword ? () => logout.mutate() : undefined}
      isLoggingOut={logout.isPending}
    />
  );
}
