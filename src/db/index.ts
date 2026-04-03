// src/db/index.ts

import { openDatabaseSync } from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';

import * as schema from './schema';
import migrations from './migrations/migrations';

const expoDb = openDatabaseSync('tavi.db');
const db = drizzle(expoDb, { schema });

export async function initializeDatabase(): Promise<void> {
  try {
    await migrate(db, migrations);
    console.log('[DB] Migrations applied successfully');
  } catch (error) {
    console.error('[DB] Migration failed:', error);
    throw error;
  }
}

export default db;