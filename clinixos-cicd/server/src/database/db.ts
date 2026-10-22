import sqlite3 from 'sqlite3';
import path from 'path';

const DB_PATH = process.env.DB_PATH || path.resolve(__dirname, '../../clinixos.sqlite');

export const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('[ClinixOS DB] Error connecting to SQLite database:', err.message);
  } else {
    console.log('[ClinixOS DB] Connected to SQLite database at', DB_PATH);
  }
});

// Enable SQLite Foreign Key Constraints & WAL mode
db.serialize(() => {
  db.run('PRAGMA foreign_keys = ON;');
  db.run('PRAGMA journal_mode = WAL;');
});

export const queryAll = <T = any>(sql: string, params: any[] = []): Promise<T[]> => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
};

export const queryOne = <T = any>(sql: string, params: any[] = []): Promise<T | null> => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve((row as T) || null);
    });
  });
};

export const runQuery = (sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};
