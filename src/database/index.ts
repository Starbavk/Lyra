import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { v4 as uuid } from 'uuid'
import type { User, Reminder, Todo, Note, Personality } from '../types/index.js'

const DB_PATH = process.env.DATABASE_PATH || './data/memoris.db'

let db: Database.Database

export function initDatabase(): void {
  const dir = path.dirname(DB_PATH)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  runMigrations()
}

function runMigrations(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      jid TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      personality TEXT NOT NULL DEFAULT 'casual',
      timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      user_jid TEXT NOT NULL,
      message TEXT NOT NULL,
      remind_at TEXT NOT NULL,
      recurring TEXT,
      done INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_jid) REFERENCES users(jid)
    );

    CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY,
      user_jid TEXT NOT NULL,
      title TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'normal',
      due_date TEXT,
      done INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_jid) REFERENCES users(jid)
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      user_jid TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_jid) REFERENCES users(jid)
    );

    CREATE INDEX IF NOT EXISTS idx_reminders_user_jid ON reminders(user_jid);
    CREATE INDEX IF NOT EXISTS idx_reminders_remind_at ON reminders(remind_at);
    CREATE INDEX IF NOT EXISTS idx_todos_user_jid ON todos(user_jid);
    CREATE INDEX IF NOT EXISTS idx_notes_user_jid ON notes(user_jid);
  `)
}

// --- Users ---
export function getOrCreateUser(jid: string, name: string): User {
  const existing = db.prepare('SELECT * FROM users WHERE jid = ?').get(jid) as User | undefined
  if (existing) {
    if (name && existing.name !== name) {
      db.prepare('UPDATE users SET name = ? WHERE jid = ?').run(name, jid)
    }
    return { ...existing, name: name || existing.name }
  }

  const id = uuid()
  db.prepare('INSERT INTO users (id, jid, name) VALUES (?, ?, ?)').run(id, jid, name)
  return { id, jid, name, personality: 'casual', timezone: 'Asia/Jakarta', created_at: new Date().toISOString() }
}

export function getUserByJid(jid: string): User | undefined {
  return db.prepare('SELECT * FROM users WHERE jid = ?').get(jid) as User | undefined
}

export function updatePersonality(jid: string, mode: Personality): void {
  db.prepare('UPDATE users SET personality = ? WHERE jid = ?').run(mode, jid)
}

// --- Reminders ---
export function createReminder(userJid: string, message: string, remindAt: string, recurring?: string): Reminder {
  const id = uuid()
  db.prepare(
    'INSERT INTO reminders (id, user_jid, message, remind_at, recurring) VALUES (?, ?, ?, ?, ?)'
  ).run(id, userJid, message, remindAt, recurring || null)
  return { id, user_jid: userJid, message, remind_at: remindAt, recurring: recurring as Reminder['recurring'], done: false, created_at: new Date().toISOString() }
}

export function getPendingReminders(): Reminder[] {
  return db.prepare(
    "SELECT * FROM reminders WHERE done = 0 AND remind_at <= datetime('now', '+1 minute')"
  ).all() as Reminder[]
}

export function getReminders(userJid: string, done?: boolean): Reminder[] {
  if (done !== undefined) {
    return db.prepare('SELECT * FROM reminders WHERE user_jid = ? AND done = ? ORDER BY remind_at DESC').all(userJid, done ? 1 : 0) as Reminder[]
  }
  return db.prepare('SELECT * FROM reminders WHERE user_jid = ? ORDER BY remind_at DESC').all(userJid) as Reminder[]
}

export function markReminderDone(id: string): void {
  db.prepare('UPDATE reminders SET done = 1 WHERE id = ?').run(id)
}

// --- Todos ---
export function createTodo(userJid: string, title: string, priority: string = 'normal', dueDate?: string): Todo {
  const id = uuid()
  db.prepare(
    'INSERT INTO todos (id, user_jid, title, priority, due_date) VALUES (?, ?, ?, ?, ?)'
  ).run(id, userJid, title, priority, dueDate || null)
  return { id, user_jid: userJid, title, priority: priority as Todo['priority'], due_date: dueDate || null, done: false, created_at: new Date().toISOString() }
}

export function getTodos(userJid: string, done?: boolean): Todo[] {
  if (done !== undefined) {
    return db.prepare('SELECT * FROM todos WHERE user_jid = ? AND done = ? ORDER BY created_at DESC').all(userJid, done ? 1 : 0) as Todo[]
  }
  return db.prepare('SELECT * FROM todos WHERE user_jid = ? ORDER BY created_at DESC').all(userJid) as Todo[]
}

export function completeTodoById(id: string): boolean {
  const result = db.prepare('UPDATE todos SET done = 1 WHERE id = ?').run(id)
  return result.changes > 0
}

// --- Notes ---
export function createNote(userJid: string, title: string, content: string, category?: string): Note {
  const id = uuid()
  db.prepare(
    'INSERT INTO notes (id, user_jid, title, content, category) VALUES (?, ?, ?, ?, ?)'
  ).run(id, userJid, title, content, category || null)
  return { id, user_jid: userJid, title, content, category: category || null, created_at: new Date().toISOString() }
}

export function getNotes(userJid: string, query?: string): Note[] {
  if (query) {
    return db.prepare(
      'SELECT * FROM notes WHERE user_jid = ? AND (title LIKE ? OR content LIKE ? OR category LIKE ?) ORDER BY created_at DESC'
    ).all(userJid, `%${query}%`, `%${query}%`, `%${query}%`) as Note[]
  }
  return db.prepare('SELECT * FROM notes WHERE user_jid = ? ORDER BY created_at DESC').all(userJid) as Note[]
}

export function closeDatabase(): void {
  if (db) db.close()
}
