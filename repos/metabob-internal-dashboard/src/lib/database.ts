import Database from 'sqlite3';
import { promisify } from 'util';

let db: Database.Database | null = null;

export interface DatabaseConfig {
  path: string;
}

/**
 * Initialize SQLite database connection
 */
export async function initDatabase(config: DatabaseConfig): Promise<Database.Database> {
  if (db) {
    return db;
  }

  try {
    // Create database connection
    db = new Database.Database(config.path, (err) => {
      if (err) {
        console.error('Error opening database:', err.message);
        throw err;
      }
      console.log('Connected to SQLite database');
    });

    // Enable foreign keys
    await runQuery('PRAGMA foreign_keys = ON');
    
    // Run migrations
    await runMigrations();
    
    return db;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

/**
 * Get database instance
 */
export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Run a SQL query
 */
export async function runQuery(sql: string, params: any[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    database.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
}

/**
 * Get a single row
 */
export async function getRow(sql: string, params: any[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    database.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

/**
 * Get multiple rows
 */
export async function getRows(sql: string, params: any[] = []): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    database.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows || []);
      }
    });
  });
}

/**
 * Run database migrations
 */
async function runMigrations(): Promise<void> {
  try {
    // Create migrations table if it doesn't exist
    await runQuery(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        applied_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Migration 1: Create users table
    const migration1 = '001_create_users_table';
    const migration1Exists = await getRow(
      'SELECT name FROM migrations WHERE name = ?',
      [migration1]
    );

    if (!migration1Exists) {
      await runQuery(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          full_name TEXT NOT NULL,
          role TEXT DEFAULT 'user' CHECK(role IN ('admin', 'user')),
          email_verified BOOLEAN DEFAULT FALSE,
          reset_token TEXT,
          reset_token_expires INTEGER,
          created_at INTEGER DEFAULT (strftime('%s', 'now')),
          updated_at INTEGER DEFAULT (strftime('%s', 'now'))
        )
      `);

      await runQuery(`
        CREATE INDEX idx_users_email ON users(email)
      `);

      await runQuery(`
        CREATE INDEX idx_users_reset_token ON users(reset_token)
      `);

      await runQuery(
        'INSERT INTO migrations (name) VALUES (?)',
        [migration1]
      );

      console.log('Applied migration:', migration1);
    }

    // Migration 2: Create sessions table
    const migration2 = '002_create_sessions_table';
    const migration2Exists = await getRow(
      'SELECT name FROM migrations WHERE name = ?',
      [migration2]
    );

    if (!migration2Exists) {
      await runQuery(`
        CREATE TABLE sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          refresh_token TEXT UNIQUE NOT NULL,
          expires_at INTEGER NOT NULL,
          created_at INTEGER DEFAULT (strftime('%s', 'now')),
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `);

      await runQuery(`
        CREATE INDEX idx_sessions_refresh_token ON sessions(refresh_token)
      `);

      await runQuery(`
        CREATE INDEX idx_sessions_user_id ON sessions(user_id)
      `);

      await runQuery(`
        CREATE INDEX idx_sessions_expires_at ON sessions(expires_at)
      `);

      await runQuery(
        'INSERT INTO migrations (name) VALUES (?)',
        [migration2]
      );

      console.log('Applied migration:', migration2);
    }

    console.log('All migrations completed');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

/**
 * Close database connection
 */
export async function closeDatabase(): Promise<void> {
  if (db) {
    return new Promise((resolve, reject) => {
      db!.close((err) => {
        if (err) {
          reject(err);
        } else {
          db = null;
          console.log('Database connection closed');
          resolve();
        }
      });
    });
  }
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions(): Promise<void> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const result = await runQuery(
      'DELETE FROM sessions WHERE expires_at < ?',
      [now]
    );
    
    if (result.changes > 0) {
      console.log(`Cleaned up ${result.changes} expired sessions`);
    }
  } catch (error) {
    console.error('Failed to cleanup expired sessions:', error);
  }
}