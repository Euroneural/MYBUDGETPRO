// SQLiteService - provides SQLite (sql.js) backed persistence that can work with a
// user-selected database file (e.g., on local disk, USB drive, or network share).
// The service mirrors the key methods of localDB (addItem, getItem, etc.) so that
// existing controllers can switch to it with minimal changes.
//
// Usage pattern:
//  import { sqliteService } from './services/sqlite-service.js';
//  await sqliteService.init();   // prompts the user to pick the database file (once)
//  await sqliteService.addItem('transactions', {...});
//
// The first time a file is chosen, an empty schema is created with the required
// tables. Afterwards, the service stores a FileSystemHandle in localStorage so
// it can silently re-open the DB on subsequent visits (subject to browser
// permissions).
//
// Limitations:
//  – Requires browsers that implement the File-System-Access API (Chromium-based)
//    or the polyfill (TODO).
//  – sql.js runs the DB in memory; we must export() the database into a Uint8Array
//    and write it back to disk on each transaction batch. Calls are debounced to
//    avoid excessive writes.

import initSqlJs from 'sql.js/dist/sql-wasm.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { openDB } from 'idb';

const DB_HANDLE_KEY = 'dbFileHandle';
const SAVE_DEBOUNCE_MS = 1000;

class SQLiteService {
  _tbl(name){
    // Quote identifier to allow dashes or reserved words
    return '`'+name.replace(/`/g,'')+'`';
  }
  /* --------------------------------------------- */
  /* IndexedDB helper for storing the handle       */
  /* --------------------------------------------- */
  async _handlesDB() {
    if (!this._idb) {
      this._idb = await openDB('budgetpro-handles', 1, {
        upgrade(db) {
          db.createObjectStore('handles');
        },
      });
    }
    return this._idb;
  }

  async _saveHandle(handle) {
    const db = await this._handlesDB();
    await db.put('handles', handle, DB_HANDLE_KEY);
  }

  async _loadHandle() {
    const db = await this._handlesDB();
    return db.get('handles', DB_HANDLE_KEY);
  }

  constructor() {
    this.SQL = null;          // sql.js init result
    this.db = null;           // sql.js Database instance
    this.fileHandle = null;   // FileSystemFileHandle
    this.saveTimer = null;
    this.ready = false;
  }

  /* ------------------------------------------------------------ */
  /* Public API                                                  */
  /* ------------------------------------------------------------ */

  async init() {
    if (this.ready) return true;

    // 1. Load sql.js (WASM)
    if (!this.SQL) {
      this.SQL = await initSqlJs({ locateFile: () => wasmUrl });
    }

    // 2. Get (or request) FileSystemFileHandle
    await this._obtainFileHandle();

    // 3. Read database bytes (if file exists) and open db
    await this._openDatabase();

    // 4. Ensure required tables exist
    this._ensureSchema();
  // Patch existing tables to add any new columns
  this._patchSchema();

    this.ready = true;
    return true;
  }

  // Generic CRUD helpers
  async addItem(table, item) {
  const attemptInsert = () => {
    const cols = Object.keys(item);
    const placeholders = cols.map(() => '?').join(',');
    const stmt = `INSERT INTO ${this._tbl(table)} (${cols.join(',')}) VALUES (${placeholders});`;
    this._run(stmt, Object.values(item));
  };
  try {
    attemptInsert();
  } catch (err) {
    if (/no column named/i.test(err.message || '')) {
      // Attempt to self-patch schema then retry once
      console.warn('SQLiteService: auto-patching schema after missing column error');
      this._patchSchema();
      attemptInsert();
    } else {
      throw err;
    }
  }
  return this._queueSave();
}

  async updateItem(table, item, idCol = 'id') {
    const cols = Object.keys(item).filter(k => k !== idCol);
    const assignments = cols.map(c => `${c} = ?`).join(',');
    const stmt = `UPDATE ${this._tbl(table)} SET ${assignments} WHERE ${idCol} = ?;`;
    const values = [...cols.map(c => item[c]), item[idCol]];
    this._run(stmt, values);
    return this._queueSave();
  }

  async deleteItem(table, id, idCol = 'id') {
    this._run(`DELETE FROM ${this._tbl(table)} WHERE ${idCol} = ?;`, [id]);
    return this._queueSave();
  }

  async getAllItems(table, whereSql = '', params = []) {
    const attempt = (tbl) => {
      const stmt = `SELECT * FROM ${this._tbl(tbl)} ${whereSql};`;
      return this._select(stmt, params);
    };
    try {
      return attempt(table);
    } catch (err) {
      if (/syntax error/i.test(err.message || '') && table.includes('-')) {
        const base = table.split('-')[0];
        console.warn(`SQLiteService: retrying query on base table ${base}`);
        return attempt(base);
      }
      throw err;
    }
  }

  async getItem(table, id, idCol = 'id') {
    const res = await this._select(`SELECT * FROM ${this._tbl(table)} WHERE ${idCol} = ? LIMIT 1;`, [id]);
    return res[0] || null;
  }

  /* ------------------------------------------------------------ */
  /* Internal Helpers                                             */
  /* ------------------------------------------------------------ */

  async _obtainFileHandle() {
  // 1. Attempt to restore previously saved handle from IndexedDB
  try {
    const stored = await this._loadHandle();
    if (stored) {
      // Check existing permission
      let perm = await stored.queryPermission({ mode: 'readwrite' });
      // If permission is denied, we cannot reuse it silently.
      if (perm !== 'denied') {
        // "granted" or "prompt" – both are usable without requiring the user to pick the file again.
        // Browsers may still show a lightweight permission prompt on first access when state is "prompt",
        // but we avoid forcing the user to locate the file via the picker.
        this.fileHandle = stored;
        return; // Reuse existing handle
      }
    }
  } catch (e) {
    console.warn('SQLiteService: could not restore stored handle', e);
  }

  // 2. No (usable) stored handle – prompt the user to pick or create a database file
  // Prefer allowing the user to pick an existing DB file, but fall back to creating a new one
  try {
    const [picked] = await window.showOpenFilePicker({
      multiple: false,
      types: [
        {
          description: 'SQLite database',
          accept: { 'application/x-sqlite3': ['.db'] },
        },
      ],
    });
    this.fileHandle = picked;
  } catch (_) {
    // User may have cancelled – offer save dialog instead
    this.fileHandle = await window.showSaveFilePicker({
      suggestedName: 'budgetpro.db',
      types: [
        {
          description: 'SQLite database',
          accept: { 'application/x-sqlite3': ['.db'] },
        },
      ],
    });
  }

  // Persist the newly chosen handle for future sessions
  await this._saveHandle(this.fileHandle);
}

  async _openDatabase() {
    const file = await this.fileHandle.getFile();
    const arrayBuffer = await file.arrayBuffer();
    const u8 = new Uint8Array(arrayBuffer);
    this.db = new this.SQL.Database(u8.length ? u8 : undefined);
  }

  _ensureSchema() {
    const tables = [
      `CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        date TEXT,
        description TEXT,
        amount REAL,
        type TEXT,
        category TEXT,
        account TEXT,
        notes TEXT,
        recurring INTEGER DEFAULT 0,
        imported INTEGER DEFAULT 0,
        status TEXT,
        createdAt TEXT,
        updatedAt TEXT,
        originalRow TEXT
       );`,
      `CREATE TABLE IF NOT EXISTS categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE
       );`,
      `CREATE TABLE IF NOT EXISTS budgets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          month TEXT UNIQUE,
          data TEXT -- JSON string
       );`,
      `CREATE TABLE IF NOT EXISTS accounts (
          id TEXT PRIMARY KEY,
          name TEXT UNIQUE,
          type TEXT,
          created INTEGER
       );`,
    ];
    this.db.exec('BEGIN;');
    tables.forEach(sql => this.db.exec(sql));
    this.db.exec('COMMIT;');
  }

  /**
   * Create per-account tables if they don't already exist.
   */
  createAccountTables(accountId){
    if(!this.db) return;
    const txTable = `transactions-${accountId}`;
    const qTx = this._tbl(txTable);
    const catTable = `categories-${accountId}`;
    const qCat = this._tbl(catTable);
    const budTable = `budgets-${accountId}`;
    const qBud = this._tbl(budTable);
    this.db.exec('BEGIN;');
    this.db.exec(`CREATE TABLE IF NOT EXISTS ${qTx} (
        id TEXT PRIMARY KEY,
        date TEXT,
        description TEXT,
        amount REAL,
        type TEXT,
        category TEXT,
        account TEXT,
        notes TEXT,
        recurring INTEGER DEFAULT 0,
        imported INTEGER DEFAULT 0,
        status TEXT,
        createdAt TEXT,
        updatedAt TEXT,
        originalRow TEXT
      );`);
    this.db.exec(`CREATE TABLE IF NOT EXISTS ${qCat} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE
      );`);
    this.db.exec(`CREATE TABLE IF NOT EXISTS ${qBud} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        month TEXT UNIQUE,
        data TEXT
      );`);
    this.db.exec('COMMIT;');
  }

  /**
   * Ensure all expected columns exist in transactions table; adds missing ones.
   */
  _patchSchema() {
  // Patch transactions table
  const txNeeded = {
  description: 'TEXT',
  amount: 'REAL',
  type: 'TEXT',
  account: 'TEXT',
  notes: 'TEXT',
  recurring: 'INTEGER',
  imported: 'INTEGER',
  status: 'TEXT',
  createdAt: 'TEXT',
  updatedAt: 'TEXT',
  originalRow: 'TEXT'
};

  this._ensureColumns('transactions', txNeeded);

  // Patch accounts table
  const accNeeded = {
    created: 'INTEGER',
    type: 'TEXT'
  };
  this._ensureColumns('accounts', accNeeded);
}

/**
 * Ensure each column exists in table, add via ALTER TABLE if missing.
 */
_ensureColumns(table, needed){
  const existing = this._select(`PRAGMA table_info(${table});`).map(r=>r.name);
  Object.entries(needed).forEach(([col,type])=>{
    if(!existing.includes(col)){
      console.log(`SQLiteService: adding missing column ${col} to ${table}`);
      this._run(`ALTER TABLE ${table} ADD COLUMN ${col} ${type};`);
    }
  });
}

  _run(sql, params = []) {
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    stmt.step();
    stmt.free();
  }

  _select(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      stmt.bind(params);
      const rows = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      stmt.free();
      return rows;
    } catch (err) {
      console.error('SQLiteService _select error', err, 'SQL=', sql, 'params=', params);
      throw err;
    }
  }

  _queueSave() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this._saveToDisk(), SAVE_DEBOUNCE_MS);
  }

  async _saveToDisk() {
    const data = this.db.export();
    const writable = await this.fileHandle.createWritable();
    await writable.write(data);
    await writable.close();
  }
}

export const sqliteService = new SQLiteService();
