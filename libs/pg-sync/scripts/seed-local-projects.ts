/**
 * Seed Local Projects to Postgres Database
 *
 * This script migrates existing local projects from .automaker/features/
 * to the Postgres database, making them visible in the Online Sync page.
 *
 * Usage:
 *   cd libs/pg-sync
 *
 *   # Option 1: Provide project paths directly (RECOMMENDED)
 *   npx tsx --env-file=../../apps/server/.env scripts/seed-local-projects.ts /path/to/project1 /path/to/project2
 *
 *   # Option 2: Use settings.json (requires DATA_DIR with settings.json)
 *   DATABASE_URL="postgres://..." npx tsx scripts/seed-local-projects.ts
 *
 * Examples:
 *   # Seed a single project
 *   npx tsx --env-file=../../apps/server/.env scripts/seed-local-projects.ts "D:/Projects/my-app"
 *
 *   # Seed multiple projects
 *   npx tsx --env-file=../../apps/server/.env scripts/seed-local-projects.ts "/home/user/project1" "/home/user/project2"
 *
 * @see docs/pg-online-sync/TUTORIAL.md
 * @see shared-docs/database-testing-guide.md
 */

import 'dotenv/config';
import postgres from 'postgres';
import * as fs from 'fs/promises';
import * as path from 'path';

// =============================================================================
// CONFIGURATION
// =============================================================================

// Get project paths from command line arguments
const CLI_PROJECT_PATHS = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));

// Default DATA_DIR path (relative to automaker root when running from libs/pg-sync)
const DEFAULT_DATA_DIR = path.resolve(process.cwd(), '../../apps/server/data');

// Get DATA_DIR from env or use default
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.cwd(), '../../', process.env.DATA_DIR)
  : DEFAULT_DATA_DIR;

// =============================================================================
// TYPES
// =============================================================================

interface ProjectRef {
  id: string;
  name: string;
  path: string;
}

interface GlobalSettings {
  projects?: ProjectRef[];
  // ... other fields we don't need
}

interface LocalFeature {
  id: string;
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  labels?: string[];
  category?: string;
  createdAt?: string;
  updatedAt?: string;
}

// =============================================================================
// DATABASE SCHEMA (inline to avoid build dependencies)
// =============================================================================

// Status mapping from local to remote
const STATUS_MAP: Record<string, string> = {
  backlog: 'backlog',
  todo: 'todo',
  'in-progress': 'in_progress',
  in_progress: 'in_progress',
  review: 'review',
  done: 'done',
  archived: 'archived',
};

// Priority mapping
const PRIORITY_MAP: Record<string, string> = {
  low: 'low',
  medium: 'medium',
  high: 'high',
  urgent: 'urgent',
  critical: 'urgent',
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

// =============================================================================
// MAIN FUNCTIONS
// =============================================================================

async function loadGlobalSettings(): Promise<GlobalSettings | null> {
  const settingsPath = path.join(DATA_DIR, 'settings.json');
  console.log(`\n📂 Loading global settings from: ${settingsPath}`);

  const settings = await readJsonFile<GlobalSettings>(settingsPath);
  if (!settings) {
    console.log('   ⚠️  No settings.json found');
    return null;
  }

  console.log(`   ✅ Found ${settings.projects?.length || 0} project(s)`);
  return settings;
}

async function loadLocalFeatures(projectPath: string): Promise<LocalFeature[]> {
  const featuresDir = path.join(projectPath, '.automaker', 'features');

  if (!(await directoryExists(featuresDir))) {
    console.log(`   ⚠️  No features directory: ${featuresDir}`);
    return [];
  }

  const entries = await fs.readdir(featuresDir, { withFileTypes: true });
  const featureDirs = entries.filter((e) => e.isDirectory());

  const features: LocalFeature[] = [];

  for (const dir of featureDirs) {
    const featureJsonPath = path.join(featuresDir, dir.name, 'feature.json');
    const feature = await readJsonFile<LocalFeature>(featureJsonPath);

    if (feature && feature.id) {
      features.push(feature);
    }
  }

  return features;
}

async function checkExistingProject(
  sql: ReturnType<typeof postgres>,
  slug: string
): Promise<{ id: string } | null> {
  const result = await sql`
    SELECT id FROM projects WHERE slug = ${slug} AND deleted_at IS NULL
  `;
  return result[0] as { id: string } | null;
}

async function checkExistingTicket(
  sql: ReturnType<typeof postgres>,
  projectId: string,
  localId: string
): Promise<boolean> {
  const result = await sql`
    SELECT id FROM tickets WHERE project_id = ${projectId} AND local_id = ${localId}
  `;
  return result.length > 0;
}

async function insertProject(
  sql: ReturnType<typeof postgres>,
  project: ProjectRef
): Promise<string> {
  const slug = generateSlug(project.name);

  // Check if project already exists
  const existing = await sql`
    SELECT id FROM projects WHERE slug = ${slug} AND deleted_at IS NULL
  `;

  if (existing.length > 0) {
    console.log(`   ℹ️  Project "${project.name}" already exists (id: ${existing[0].id})`);
    return existing[0].id as string;
  }

  // Insert new project
  const result = await sql`
    INSERT INTO projects (name, slug, description, customer_access_enabled, sync_enabled, settings)
    VALUES (
      ${project.name},
      ${slug},
      ${'Migrated from local project'},
      ${false},
      ${true},
      ${JSON.stringify({
        publicSettings: {
          allowTicketCreation: true,
          showComments: false,
          visibleStatuses: ['todo', 'in_progress', 'done'],
          theme: 'dark',
        },
      })}
    )
    RETURNING id
  `;

  console.log(`   ✅ Created project "${project.name}" (id: ${result[0].id})`);
  return result[0].id as string;
}

async function insertTicket(
  sql: ReturnType<typeof postgres>,
  projectId: string,
  feature: LocalFeature
): Promise<void> {
  // Check if ticket already exists
  if (await checkExistingTicket(sql, projectId, feature.id)) {
    console.log(`      ℹ️  Ticket "${feature.title || feature.id}" already exists, skipping`);
    return;
  }

  const status = STATUS_MAP[feature.status || 'backlog'] || 'backlog';
  const priority = PRIORITY_MAP[feature.priority || 'medium'] || 'medium';
  const labels = feature.labels || [];

  await sql`
    INSERT INTO tickets (
      project_id,
      local_id,
      title,
      description,
      status,
      priority,
      labels,
      version
    )
    VALUES (
      ${projectId},
      ${feature.id},
      ${feature.title || 'Untitled'},
      ${feature.description || ''},
      ${status}::ticket_status_enum,
      ${priority}::ticket_priority_enum,
      ${labels},
      ${1}
    )
  `;

  console.log(`      ✅ Created ticket: ${feature.title || feature.id}`);
}

async function seedProject(
  sql: ReturnType<typeof postgres>,
  project: ProjectRef
): Promise<{ tickets: number; skipped: number }> {
  console.log(`\n🔄 Processing project: ${project.name}`);
  console.log(`   Path: ${project.path}`);

  // Check if project path exists
  if (!(await directoryExists(project.path))) {
    console.log(`   ⚠️  Project path does not exist, skipping`);
    return { tickets: 0, skipped: 1 };
  }

  // Insert or get project
  const projectId = await insertProject(sql, project);

  // Load and insert features
  const features = await loadLocalFeatures(project.path);
  console.log(`   📝 Found ${features.length} feature(s)`);

  let ticketCount = 0;
  for (const feature of features) {
    try {
      await insertTicket(sql, projectId, feature);
      ticketCount++;
    } catch (error) {
      console.log(`      ❌ Failed to insert ticket ${feature.id}:`, error);
    }
  }

  return { tickets: ticketCount, skipped: 0 };
}

/**
 * Build project refs from CLI paths
 */
function buildProjectRefsFromPaths(paths: string[]): ProjectRef[] {
  return paths.map((projectPath) => {
    // Normalize path
    const normalizedPath = path.resolve(projectPath);
    // Extract project name from path
    const name = path.basename(normalizedPath);
    // Generate a simple ID
    const id = `cli-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    return {
      id,
      name,
      path: normalizedPath,
    };
  });
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('🌱 Seed Local Projects to Postgres');
  console.log('===================================\n');

  // Validate DATABASE_URL
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set!');
    console.error('\nUsage:');
    console.error(
      '  npx tsx --env-file=../../apps/server/.env scripts/seed-local-projects.ts /path/to/project'
    );
    console.error('\nOr with DATABASE_URL directly:');
    console.error(
      '  DATABASE_URL="postgres://..." npx tsx scripts/seed-local-projects.ts /path/to/project'
    );
    process.exit(1);
  }

  // Determine project source: CLI args or settings.json
  let projects: ProjectRef[] = [];

  if (CLI_PROJECT_PATHS.length > 0) {
    // Mode 1: Use CLI-provided paths
    console.log('📁 Mode: CLI project paths');
    console.log(`   Found ${CLI_PROJECT_PATHS.length} project path(s):\n`);
    CLI_PROJECT_PATHS.forEach((p, i) => console.log(`   ${i + 1}. ${p}`));
    projects = buildProjectRefsFromPaths(CLI_PROJECT_PATHS);
  } else {
    // Mode 2: Try to load from settings.json
    console.log('📁 Mode: Load from settings.json');
    console.log(`📊 DATA_DIR: ${DATA_DIR}`);

    const settings = await loadGlobalSettings();
    if (settings?.projects && settings.projects.length > 0) {
      projects = settings.projects;
    }
  }

  // Check if we have projects to process
  if (projects.length === 0) {
    console.log('\n⚠️  No projects found. Nothing to seed.');
    console.log('\n📖 Usage:');
    console.log(
      '   npx tsx --env-file=../../apps/server/.env scripts/seed-local-projects.ts <project-path>'
    );
    console.log('\n📖 Example:');
    console.log(
      '   npx tsx --env-file=../../apps/server/.env scripts/seed-local-projects.ts "D:/Projects/my-app"'
    );
    console.log('\n💡 Tip: Provide the full path to your project directory.');
    console.log('   The project must have a .automaker/features/ directory with features.');
    process.exit(0);
  }

  // Connect to database
  console.log('\n🔌 Connecting to database...');
  const client = postgres(databaseUrl, { prepare: false });

  // Test connection
  try {
    const result = await client`SELECT NOW() as now`;
    console.log(`   ✅ Connected! Server time: ${result[0].now}`);
  } catch (error) {
    console.error('   ❌ Failed to connect:', error);
    await client.end();
    process.exit(1);
  }

  // Process each project
  let totalProjects = 0;
  let totalTickets = 0;
  let skippedProjects = 0;

  for (const project of projects) {
    try {
      const result = await seedProject(client, project);
      totalProjects++;
      totalTickets += result.tickets;
      skippedProjects += result.skipped;
    } catch (error) {
      console.error(`\n❌ Failed to process project ${project.name}:`, error);
      skippedProjects++;
    }
  }

  // Summary
  console.log('\n===================================');
  console.log('📊 Summary:');
  console.log(`   Projects processed: ${totalProjects}`);
  console.log(`   Projects skipped: ${skippedProjects}`);
  console.log(`   Tickets created: ${totalTickets}`);
  console.log('\n✅ Seed completed!');
  console.log('\n📝 Next steps:');
  console.log('   1. Restart the server: npm run dev:web');
  console.log('   2. Go to Online Sync page');
  console.log('   3. Your projects should now appear!');

  await client.end();
}

main().catch((error) => {
  console.error('❌ Seed failed:', error);
  process.exit(1);
});
