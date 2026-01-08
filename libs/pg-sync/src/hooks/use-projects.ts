/**
 * 🧭 Project Hooks
 *
 * React Query Hooks für Projekt-Operationen.
 * Diese Hooks sind für die Web-UI gedacht (Projekt-Navigation, Projekt-Switcher).
 *
 * @see docs/pg-online-sync/tasks/phase-2.3-projekt-navigation.md
 */

// =============================================================================
// 📦 HOOK FACTORY TYPES
// =============================================================================

/**
 * Callback-Typen für Hooks (Framework-agnostisch)
 */
export interface ProjectCallbacks<TResult> {
  onSuccess?: (result: TResult) => void;
  onError?: (error: Error) => void;
  onSettled?: () => void;
}

// =============================================================================
// 🔧 PROJECT API FUNCTIONS
// =============================================================================

import {
  createProject as createProjectAction,
  updateProject as updateProjectAction,
  deleteProject as deleteProjectAction,
  addProjectMember as addMemberAction,
  changeProjectMemberRole as changeRoleAction,
  removeProjectMember as removeMemberAction,
  type CreateProjectData,
  type UpdateProjectData,
  type ProjectRoleType,
} from '../actions/project-actions.js';

import {
  findProjectById,
  findProjectBySlug,
  findAllProjects,
  findProjectsByUser,
  findProjectWithMembers,
  projectExists,
  isSlugAvailable,
  countProjects,
  type FindProjectsOptions,
  type ProjectWithMembers,
} from '../finders/project-finder.js';

import type { DbProject } from '../db/schema/projects.js';

// =============================================================================
// 📊 QUERY KEY FACTORY
// =============================================================================

/**
 * Query Keys für Projekt-Queries (für Invalidierung)
 *
 * @example
 * // Alle Projekt-Queries invalidieren
 * queryClient.invalidateQueries({ queryKey: projectKeys.all });
 *
 * // Nur User-Projekte invalidieren
 * queryClient.invalidateQueries({ queryKey: projectKeys.byUser(userId) });
 */
export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (filters: FindProjectsOptions) => [...projectKeys.lists(), filters] as const,
  byUser: (userId: string) => [...projectKeys.all, 'user', userId] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
  detailBySlug: (slug: string) => [...projectKeys.all, 'slug', slug] as const,
  withMembers: (id: string) => [...projectKeys.all, 'members', id] as const,
  slugAvailable: (slug: string) => [...projectKeys.all, 'slug-check', slug] as const,
  count: (options?: Pick<FindProjectsOptions, 'search' | 'includeDeleted'>) =>
    [...projectKeys.all, 'count', options] as const,
};

// =============================================================================
// 📊 QUERY FUNCTIONS (für React Query useQuery)
// =============================================================================

/**
 * Lädt ein einzelnes Projekt nach ID
 */
export async function fetchProject(projectId: string): Promise<DbProject | null> {
  return findProjectById(projectId);
}

/**
 * Lädt ein Projekt nach Slug (URL-freundlicher Identifier)
 */
export async function fetchProjectBySlug(slug: string): Promise<DbProject | null> {
  return findProjectBySlug(slug);
}

/**
 * Lädt alle Projekte mit Filterung und Pagination
 */
export async function fetchAllProjects(options?: FindProjectsOptions): Promise<DbProject[]> {
  return findAllProjects(options);
}

/**
 * Lädt alle Projekte eines Users (für Project-Switcher)
 *
 * @description Dies ist die Hauptfunktion für den Projekt-Dropdown.
 * Zeigt nur Projekte an, in denen der User Mitglied ist.
 */
export async function fetchMyProjects(userId: string): Promise<DbProject[]> {
  return findProjectsByUser(userId);
}

/**
 * Lädt ein Projekt mit allen Mitgliedern
 */
export async function fetchProjectWithMembers(
  projectId: string
): Promise<ProjectWithMembers | null> {
  return findProjectWithMembers(projectId);
}

/**
 * Prüft ob ein Slug verfügbar ist
 */
export async function checkSlugAvailability(
  slug: string,
  excludeProjectId?: string
): Promise<boolean> {
  return isSlugAvailable(slug, excludeProjectId);
}

/**
 * Zählt alle Projekte (für Pagination)
 */
export async function fetchProjectCount(
  options?: Pick<FindProjectsOptions, 'search' | 'includeDeleted'>
): Promise<number> {
  return countProjects(options);
}

// =============================================================================
// ⚡ MUTATION FUNCTIONS (für React Query useMutation)
// =============================================================================

/**
 * Create-Mutation Funktion
 */
export interface CreateProjectParams extends CreateProjectData {}

export async function createProjectMutation(params: CreateProjectParams): Promise<DbProject> {
  return createProjectAction(params);
}

/**
 * Update-Mutation Funktion
 */
export interface UpdateProjectParams {
  projectId: string;
  data: UpdateProjectData;
}

export async function updateProjectMutation(params: UpdateProjectParams): Promise<DbProject> {
  return updateProjectAction(params.projectId, params.data);
}

/**
 * Delete-Mutation Funktion (Soft-Delete)
 */
export interface DeleteProjectParams {
  projectId: string;
}

export async function deleteProjectMutation(params: DeleteProjectParams): Promise<void> {
  return deleteProjectAction(params.projectId);
}

/**
 * Add Member Mutation Funktion
 */
export interface AddMemberParams {
  projectId: string;
  userId: string;
  role?: ProjectRoleType;
}

export async function addMemberMutation(params: AddMemberParams): Promise<void> {
  await addMemberAction(params.projectId, params.userId, params.role);
}

/**
 * Change Member Role Mutation Funktion
 */
export interface ChangeMemberRoleParams {
  projectId: string;
  userId: string;
  newRole: ProjectRoleType;
}

export async function changeMemberRoleMutation(params: ChangeMemberRoleParams): Promise<void> {
  await changeRoleAction(params.projectId, params.userId, params.newRole);
}

/**
 * Remove Member Mutation Funktion
 */
export interface RemoveMemberParams {
  projectId: string;
  userId: string;
}

export async function removeMemberMutation(params: RemoveMemberParams): Promise<void> {
  return removeMemberAction(params.projectId, params.userId);
}

// =============================================================================
// 🎯 QUERY CONFIG FACTORIES (für React Query)
// =============================================================================

/**
 * Config für useQuery Hook (Projekt-Details nach ID)
 */
export function getProjectQueryConfig(projectId: string) {
  return {
    queryKey: projectKeys.detail(projectId),
    queryFn: () => fetchProject(projectId),
    enabled: !!projectId,
  };
}

/**
 * Config für useQuery Hook (Projekt-Details nach Slug)
 *
 * @description Für URL-basiertes Routing wie /projects/[slug]/board
 */
export function getProjectBySlugQueryConfig(slug: string) {
  return {
    queryKey: projectKeys.detailBySlug(slug),
    queryFn: () => fetchProjectBySlug(slug),
    enabled: !!slug,
  };
}

/**
 * Config für useQuery Hook (Alle User-Projekte)
 *
 * @description Primär für den Project-Switcher/Dropdown
 */
export function getMyProjectsQueryConfig(userId: string) {
  return {
    queryKey: projectKeys.byUser(userId),
    queryFn: () => fetchMyProjects(userId),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 Minuten Cache für Projekt-Liste
  };
}

/**
 * Config für useQuery Hook (Alle Projekte mit Filter)
 */
export function getAllProjectsQueryConfig(options?: FindProjectsOptions) {
  return {
    queryKey: projectKeys.list(options ?? {}),
    queryFn: () => fetchAllProjects(options),
  };
}

/**
 * Config für useQuery Hook (Projekt mit Mitgliedern)
 */
export function getProjectWithMembersQueryConfig(projectId: string) {
  return {
    queryKey: projectKeys.withMembers(projectId),
    queryFn: () => fetchProjectWithMembers(projectId),
    enabled: !!projectId,
  };
}

/**
 * Config für useQuery Hook (Slug-Verfügbarkeit)
 *
 * @description Für Echtzeit-Validierung bei Slug-Eingabe
 */
export function getSlugAvailabilityQueryConfig(slug: string, excludeProjectId?: string) {
  return {
    queryKey: projectKeys.slugAvailable(slug),
    queryFn: () => checkSlugAvailability(slug, excludeProjectId),
    enabled: slug.length >= 3, // Nur prüfen wenn Slug mindestens 3 Zeichen hat
  };
}

/**
 * Config für useQuery Hook (Projekt-Anzahl)
 */
export function getProjectCountQueryConfig(
  options?: Pick<FindProjectsOptions, 'search' | 'includeDeleted'>
) {
  return {
    queryKey: projectKeys.count(options),
    queryFn: () => fetchProjectCount(options),
  };
}

// =============================================================================
// 🎯 MUTATION CONFIG FACTORIES (für React Query)
// =============================================================================

/**
 * Config für useMutation Hook (Create Project)
 */
export function getCreateProjectMutationConfig() {
  return {
    mutationFn: createProjectMutation,
  };
}

/**
 * Config für useMutation Hook (Update Project)
 */
export function getUpdateProjectMutationConfig() {
  return {
    mutationFn: updateProjectMutation,
  };
}

/**
 * Config für useMutation Hook (Delete Project)
 */
export function getDeleteProjectMutationConfig() {
  return {
    mutationFn: deleteProjectMutation,
  };
}

/**
 * Config für useMutation Hook (Add Member)
 */
export function getAddMemberMutationConfig() {
  return {
    mutationFn: addMemberMutation,
  };
}

/**
 * Config für useMutation Hook (Change Member Role)
 */
export function getChangeMemberRoleMutationConfig() {
  return {
    mutationFn: changeMemberRoleMutation,
  };
}

/**
 * Config für useMutation Hook (Remove Member)
 */
export function getRemoveMemberMutationConfig() {
  return {
    mutationFn: removeMemberMutation,
  };
}

// =============================================================================
// 🔧 UTILITY FUNCTIONS
// =============================================================================

/**
 * Prüft ob ein Projekt existiert (Utility für UI-Logik)
 */
export async function checkProjectExists(projectId: string): Promise<boolean> {
  return projectExists(projectId);
}
