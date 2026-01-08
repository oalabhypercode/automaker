import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  // Schema-Dateien
  schema: './src/db/schema/index.ts',

  // Migrations-Ordner
  out: './drizzle',

  // Datenbank-Typ
  dialect: 'postgresql',

  // Verbose Logging
  verbose: true,

  // Strict Mode für bessere Typsicherheit
  strict: true,

  // DB Credentials aus Umgebungsvariable
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
