import { processMessage } from '../ai/engine.js'
import * as db from '../database/index.js'
import type { AIAction, MessageContext } from '../types/index.js'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'

dayjs.extend(utc)

function formatDateTime(iso: string): string {
  return dayjs(iso).format('DD MMM YYYY HH:mm')
}

function formatList(items: { title?: string; message?: string; done?: boolean; priority?: string; remind_at?: string; due_date?: string | null }[], type: string): string {
  if (items.length === 0) return `Tidak ada ${type}.`

  return items.map((item, i) => {
    const status = item.done ? '✅' : '⏳'
    const title = item.title || item.message || ''
    const time = item.remind_at ? ` (${formatDateTime(item.remind_at)})` : item.due_date ? ` (deadline: ${formatDateTime(item.due_date)})` : ''
    const priority = item.priority && item.priority !== 'normal' ? ` [${item.priority}]` : ''
    return `${i + 1}. ${status} ${title}${priority}${time}`
  }).join('\n')
}

export async function handleAction(ctx: MessageContext, action: AIAction): Promise<string> {
  switch (action.type) {
    case 'chat':
      return action.response

    case 'create_reminder': {
      db.createReminder(ctx.user.jid, action.message, action.remind_at, action.recurring)
      const time = formatDateTime(action.remind_at)
      let reply = `Oke, reminder udah di-set ✅\nPesan: ${action.message}\nWaktu: ${time}`
      if (action.recurring) reply += `\nUlang: ${action.recurring}`
      return reply
    }

    case 'create_todo': {
      db.createTodo(ctx.user.jid, action.title, action.priority, action.due_date)
      let reply = `Task ditambahkan ✅\n${action.title}`
      if (action.priority && action.priority !== 'normal') reply += ` [${action.priority}]`
      if (action.due_date) reply += `\nDeadline: ${formatDateTime(action.due_date)}`
      return reply
    }

    case 'save_note': {
      db.createNote(ctx.user.jid, action.title, action.content, action.category)
      return `Catatan disimpan ✅\nJudul: ${action.title}\nKategori: ${action.category || 'umum'}`
    }

    case 'list_todos': {
      const done = action.status === 'done' ? true : action.status === 'pending' ? false : undefined
      const todos = db.getTodos(ctx.user.jid, done)
      const label = done === true ? 'Selesai' : done === false ? 'Pending' : 'Semua'
      return `📋 To-Do List (${label}):\n${formatList(todos, 'todo')}`
    }

    case 'list_reminders': {
      const done = action.status === 'done' ? true : action.status === 'pending' ? false : undefined
      const reminders = db.getReminders(ctx.user.jid, done)
      const label = done === true ? 'Selesai' : done === false ? 'Pending' : 'Semua'
      return `🔔 Reminder (${label}):\n${formatList(reminders, 'reminder')}`
    }

    case 'list_notes': {
      const notes = db.getNotes(ctx.user.jid, action.query)
      if (notes.length === 0) return 'Tidak ada catatan yang ditemukan.'
      const header = action.query ? `Catatan untuk "${action.query}":` : '📝 Catatan:'
      return `${header}\n${notes.map((n, i) => `${i + 1}. ${n.title}${n.category ? ` [${n.category}]` : ''}`).join('\n')}`
    }

    case 'complete_todo': {
      const todos = db.getTodos(ctx.user.jid, false)
      const match = todos.find(t => t.title.toLowerCase().includes((action.query || '').toLowerCase()))
      if (!match) return `Tidak ada task yang cocok dengan "${action.query}".`
      db.completeTodoById(match.id)
      return `✅ Task selesai: ${match.title}`
    }

    case 'switch_personality': {
      db.updatePersonality(ctx.user.jid, action.mode)
      if (action.mode === 'casual') {
        return 'Mode santai aktif! 🎉 Yuk ngobrol santai aja!'
      }
      return 'Mode profesional aktif. Siap membantu Anda dengan efisien.'
    }

    default:
      return 'Maaf, saya tidak bisa memproses perintah itu.'
  }
}

export async function processUserMessage(ctx: MessageContext): Promise<string> {
  const action = await processMessage(ctx)
  return handleAction(ctx, action)
}
