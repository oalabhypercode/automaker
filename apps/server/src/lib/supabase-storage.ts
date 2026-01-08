/**
 * Supabase Storage helper utilities for uploads and signed URLs.
 */

import crypto from 'crypto';

interface SupabaseStorageConfig {
  url: string;
  serviceRoleKey: string;
  bucket: string;
  signedUrlTtlSeconds: number;
}

const DEFAULT_BUCKET = 'public-ticket-attachments';
const DEFAULT_SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

function normalizeSupabaseUrl(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function encodeStoragePath(path: string): string {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

export function getSupabaseStorageConfig(): SupabaseStorageConfig {
  const rawUrl = process.env.SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || DEFAULT_BUCKET;
  const signedUrlTtlSeconds = Number.parseInt(
    process.env.SUPABASE_SIGNED_URL_TTL || `${DEFAULT_SIGNED_URL_TTL_SECONDS}`,
    10
  );

  if (!rawUrl || !serviceRoleKey) {
    throw new Error(
      'Supabase storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
    );
  }

  return {
    url: normalizeSupabaseUrl(rawUrl),
    serviceRoleKey,
    bucket,
    signedUrlTtlSeconds: Number.isFinite(signedUrlTtlSeconds)
      ? signedUrlTtlSeconds
      : DEFAULT_SIGNED_URL_TTL_SECONDS,
  };
}

export function buildTicketAttachmentPath(
  projectId: string,
  ticketId: string,
  filename: string
): string {
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const uniqueId = crypto.randomUUID();
  return `projects/${projectId}/tickets/${ticketId}/${uniqueId}-${safeFilename}`;
}

export async function uploadToSupabaseStorage(options: {
  bucket: string;
  path: string;
  contentType: string;
  body: Buffer;
  upsert?: boolean;
}): Promise<void> {
  const { url, serviceRoleKey } = getSupabaseStorageConfig();
  const encodedPath = encodeStoragePath(options.path);
  const requestUrl = `${url}/storage/v1/object/${options.bucket}/${encodedPath}`;

  const response = await fetch(requestUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': options.contentType,
      'x-upsert': options.upsert ? 'true' : 'false',
    },
    body: options.body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Supabase upload failed (${response.status}): ${errorText || response.statusText}`
    );
  }
}

export async function createSupabaseSignedUrl(options: {
  bucket: string;
  path: string;
  expiresInSeconds: number;
}): Promise<string> {
  const { url, serviceRoleKey } = getSupabaseStorageConfig();
  const encodedPath = encodeStoragePath(options.path);
  const requestUrl = `${url}/storage/v1/object/sign/${options.bucket}/${encodedPath}`;

  const response = await fetch(requestUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ expiresIn: options.expiresInSeconds }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Supabase signed URL failed (${response.status}): ${errorText || response.statusText}`
    );
  }

  const data = (await response.json()) as {
    signedURL?: string;
    signedUrl?: string;
    signed_url?: string;
  };

  const signedPath = data.signedURL || data.signedUrl || data.signed_url;
  if (!signedPath) {
    throw new Error('Supabase signed URL response missing URL payload.');
  }

  return signedPath.startsWith('http') ? signedPath : `${url}${signedPath}`;
}
