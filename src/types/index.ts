export type Personality = 'casual' | 'professional'

export interface User {
  id: string
  jid: string
  name: string
  personality: Personality
  timezone: string
  created_at: string
}

export interface Reminder {
  id: string
  user_jid: string
  message: string
  remind_at: string
  recurring: 'daily' | 'weekly' | 'monthly' | null
  done: boolean
  created_at: string
}

export interface Todo {
  id: string
  user_jid: string
  title: string
  priority: 'low' | 'normal' | 'high'
  due_date: string | null
  done: boolean
  created_at: string
}

export interface Note {
  id: string
  user_jid: string
  title: string
  content: string
  category: string | null
  created_at: string
}

export type AIAction =
  | { type: 'chat'; response: string }
  | { type: 'create_reminder'; message: string; remind_at: string; recurring?: string }
  | { type: 'create_todo'; title: string; priority?: string; due_date?: string }
  | { type: 'save_note'; title: string; content: string; category?: string }
  | { type: 'list_todos'; status?: string }
  | { type: 'list_reminders'; status?: string }
  | { type: 'list_notes'; query?: string }
  | { type: 'switch_personality'; mode: Personality }
  | { type: 'complete_todo'; id?: string; query?: string }
  | { type: 'delete_reminder'; id?: string; query?: string }

export interface MessageContext {
  user: User
  message: string
  senderName: string
}
