import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getServerUrlSync } from '@/lib/http-api-client';

// Local type definition to avoid strict dependency on pg-sync package in UI for now
export interface PublicProjectData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  hasPassword: boolean;
  logoUrl?: string;
  publicSettings: PublicBoardSettings;
}

export interface PublicBoardSettings {
  allowTicketCreation: boolean;
  showComments: boolean;
  visibleStatuses: string[];
  introMessage?: string;
  theme: 'dark' | 'light';
}

export interface PublicTicketAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
}

export type PublicTicketCategory = 'bug' | 'feature' | 'question';

export interface PublicTicket {
  id: string;
  title: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  /** Extracted from structured description (Phase 5.3) */
  creatorName?: string | null;
  /** Extracted from structured description (Phase 5.3) */
  category?: PublicTicketCategory | null;
  attachments?: PublicTicketAttachment[];
}

export interface CreatePublicTicketPayload {
  title: string;
  description?: string;
  creatorName: string;
  category: PublicTicketCategory;
  attachments?: Array<{
    filename: string;
    mimeType: string;
    size: number;
    base64: string;
  }>;
}

export interface CreatePublicTicketResponse {
  success: boolean;
  ticket: {
    id: string;
    title: string;
    status: string;
  };
  attachments?: PublicTicketAttachment[];
  attachmentErrors?: string[];
  message?: string;
}

const API_BASE = `${getServerUrlSync()}/api/public/projects`;

async function fetchProjectMeta(slug: string): Promise<PublicProjectData> {
  const res = await fetch(`${API_BASE}/${slug}/meta`, {
    credentials: 'include',
  });
  if (!res.ok) {
    if (res.status === 404) throw new Error('Project not found');
    throw new Error('Failed to load project');
  }
  return res.json();
}

async function loginToProject(slug: string, password: string): Promise<void> {
  const res = await fetch(`${API_BASE}/${slug}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
    credentials: 'include',
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Login failed');
  }
}

async function logoutFromProject(slug: string): Promise<void> {
  const res = await fetch(`${API_BASE}/${slug}/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
    credentials: 'include',
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Logout failed');
  }
}

async function fetchProjectBoard(
  slug: string
): Promise<{ project: PublicProjectData; tickets: PublicTicket[] }> {
  const res = await fetch(`${API_BASE}/${slug}/board`, {
    credentials: 'include',
  });

  if (res.status === 401) {
    throw new Error('UNAUTHORIZED');
  }

  if (!res.ok) {
    throw new Error('Failed to load board');
  }

  return res.json();
}

async function createPublicTicket(
  slug: string,
  payload: CreatePublicTicketPayload
): Promise<CreatePublicTicketResponse> {
  const res = await fetch(`${API_BASE}/${slug}/tickets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    credentials: 'include',
  });

  const data = (await res.json().catch(() => ({}))) as CreatePublicTicketResponse & {
    error?: string;
  };

  if (!res.ok) {
    throw new Error(data.error || 'Failed to create ticket');
  }

  return data;
}

export function usePublicProjectMeta(slug: string) {
  return useQuery({
    queryKey: ['public-project', slug, 'meta'],
    queryFn: () => fetchProjectMeta(slug),
    retry: false,
  });
}

export function usePublicProjectAuth(slug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (password: string) => loginToProject(slug, password),
    onSuccess: () => {
      // Invalidate board query to trigger refetch
      queryClient.invalidateQueries({ queryKey: ['public-project', slug, 'board'] });
    },
  });
}

export function usePublicProjectLogout(slug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => logoutFromProject(slug),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public-project', slug, 'board'] });
    },
  });
}

export function usePublicProjectBoard(slug: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['public-project', slug, 'board'],
    queryFn: () => fetchProjectBoard(slug),
    retry: false,
    enabled,
  });
}

export function usePublicCreateTicket(slug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreatePublicTicketPayload) => createPublicTicket(slug, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public-project', slug, 'board'] });
    },
  });
}
