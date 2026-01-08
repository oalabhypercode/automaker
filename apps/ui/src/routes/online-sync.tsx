import { createFileRoute } from '@tanstack/react-router';
import { OnlineSyncView } from '@/components/views/online-sync-view';

export const Route = createFileRoute('/online-sync')({
  component: OnlineSyncView,
});
