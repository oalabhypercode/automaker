/**
 * 🔍 Debug Script: Public Project Not Found
 *
 * Dieses Script untersucht, warum ein Projekt unter /p/{slug} nicht gefunden wird.
 * Es prüft alle 3 Bedingungen der findPublicProjectBySlug Query.
 *
 * Usage: npx tsx scripts/debug-public-project.ts ai-cutting-automaker
 */

import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env from apps/server
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, '../apps/server/.env') });

import { eq, and, isNull } from 'drizzle-orm';
import { getDb, closeConnections } from '../libs/pg-sync/src/db/client.js';
import { projects } from '../libs/pg-sync/src/db/schema/index.js';

const SLUG_TO_DEBUG = process.argv[2] || 'ai-cutting-automaker';

async function main() {
  console.log('\n🔍 DEBUG: Public Project Lookup');
  console.log('═'.repeat(60));
  console.log(`🎯 Searching for slug: "${SLUG_TO_DEBUG}"`);
  console.log('═'.repeat(60));

  const db = getDb();

  // Step 1: Find ANY project with this slug (ignoring all filters)
  console.log('\n📋 Step 1: Find project by slug (no filters)...\n');

  const anyProject = await db
    .select({
      id: projects.id,
      name: projects.name,
      slug: projects.slug,
      customerAccessEnabled: projects.customerAccessEnabled,
      deletedAt: projects.deletedAt,
      customerPasswordHash: projects.customerPasswordHash,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .where(eq(projects.slug, SLUG_TO_DEBUG.toLowerCase()))
    .limit(1);

  if (anyProject.length === 0) {
    console.log('❌ PROBLEM GEFUNDEN: Kein Projekt mit diesem Slug existiert!');
    console.log(`   Der Slug "${SLUG_TO_DEBUG}" existiert nicht in der Datenbank.`);
    console.log('\n💡 Mögliche Ursachen:');
    console.log('   - Das Projekt wurde nie erstellt');
    console.log('   - Der Slug wurde geändert');
    console.log('   - Das Projekt hat einen anderen Slug');

    // List all projects to help debug
    console.log('\n📋 Alle existierenden Projekte:');
    const allProjects = await db
      .select({
        name: projects.name,
        slug: projects.slug,
        customerAccessEnabled: projects.customerAccessEnabled,
        deletedAt: projects.deletedAt,
      })
      .from(projects)
      .limit(20);

    if (allProjects.length === 0) {
      console.log('   (keine Projekte in der Datenbank)');
    } else {
      allProjects.forEach((p, i) => {
        const status = p.deletedAt
          ? '🗑️ gelöscht'
          : p.customerAccessEnabled
            ? '🌐 public'
            : '🔒 privat';
        console.log(`   ${i + 1}. ${p.name} (/${p.slug}) - ${status}`);
      });
    }

    await closeConnections();
    return;
  }

  const project = anyProject[0];
  console.log('✅ Projekt gefunden!\n');
  console.log('   📌 ID:', project.id);
  console.log('   📛 Name:', project.name);
  console.log('   🔗 Slug:', project.slug);
  console.log('   📅 Erstellt:', project.createdAt);
  console.log('   📅 Aktualisiert:', project.updatedAt);

  // Step 2: Check all 3 conditions
  console.log('\n📋 Step 2: Prüfe die 3 Bedingungen für Public Access...\n');

  let issuesFound = 0;

  // Check 1: Slug (already matched, so this is OK)
  console.log('   ✅ Bedingung 1: Slug matcht');
  console.log(`      DB-Slug: "${project.slug}" === Suche: "${SLUG_TO_DEBUG.toLowerCase()}"`);

  // Check 2: customerAccessEnabled
  if (project.customerAccessEnabled === true) {
    console.log('   ✅ Bedingung 2: customerAccessEnabled = true');
  } else {
    console.log('   ❌ PROBLEM: customerAccessEnabled = FALSE!');
    console.log('      Das Projekt ist NICHT für Public Access aktiviert.');
    console.log('      💡 Lösung: Aktiviere "Public Access" Toggle in Online Sync');
    issuesFound++;
  }

  // Check 3: deletedAt
  if (project.deletedAt === null) {
    console.log('   ✅ Bedingung 3: deletedAt = null (nicht gelöscht)');
  } else {
    console.log('   ❌ PROBLEM: Projekt ist GELÖSCHT!');
    console.log(`      deletedAt: ${project.deletedAt}`);
    console.log('      💡 Lösung: Projekt wiederherstellen');
    issuesFound++;
  }

  // Step 3: Try the exact query that findPublicProjectBySlug uses
  console.log('\n📋 Step 3: Exakte Query wie findPublicProjectBySlug...\n');

  const publicProject = await db
    .select({
      id: projects.id,
      name: projects.name,
      slug: projects.slug,
    })
    .from(projects)
    .where(
      and(
        eq(projects.slug, SLUG_TO_DEBUG.toLowerCase()),
        eq(projects.customerAccessEnabled, true),
        isNull(projects.deletedAt)
      )
    )
    .limit(1);

  if (publicProject.length > 0) {
    console.log('   ✅ findPublicProjectBySlug würde dieses Projekt finden!');
    console.log('   🤔 Das Problem liegt woanders (vielleicht Server-Restart nötig?)');
  } else {
    console.log('   ❌ findPublicProjectBySlug findet NICHTS!');
    console.log('   Dies erklärt den "Project Not Found" Fehler.');
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 ZUSAMMENFASSUNG');
  console.log('═'.repeat(60));

  if (issuesFound === 0) {
    console.log('✅ Alle Bedingungen erfüllt - Projekt SOLLTE gefunden werden!');
    console.log('\n💡 Falls der Fehler weiterhin besteht:');
    console.log('   1. Server neu starten');
    console.log('   2. Browser-Cache leeren');
    console.log('   3. Prüfen ob der richtige Server läuft (Port richtig?)');
  } else {
    console.log(`❌ ${issuesFound} Problem(e) gefunden!`);
    console.log('\n💡 Behebe die oben markierten Probleme.');
  }

  console.log('\n');
  await closeConnections();
}

main().catch((err) => {
  console.error('Script error:', err);
  process.exit(1);
});
