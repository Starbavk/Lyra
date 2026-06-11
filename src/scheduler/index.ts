import cron from 'node-cron'
import * as db from '../database/index.js'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'

dayjs.extend(utc)
dayjs.extend(timezone)

type SendMessageFn = (jid: string, text: string) => Promise<void>

let sendMessage: SendMessageFn | null = null

export function setSendMessageFn(fn: SendMessageFn): void {
  sendMessage = fn
}

export function startScheduler(): void {
  cron.schedule('* * * * *', async () => {
    if (!sendMessage) return

    const now = dayjs().tz('Asia/Jakarta').format('YYYY-MM-DDTHH:mm:ss')
    const reminders = db.getPendingReminders()

    for (const reminder of reminders) {
      const remindAt = dayjs(reminder.remind_at).tz('Asia/Jakarta').format('YYYY-MM-DDTHH:mm:ss')

      if (dayjs(remindAt).isBefore(dayjs()) || dayjs(remindAt).isSame(dayjs(), 'minute')) {
        try {
          const user = db.getUserByJid(reminder.user_jid)
          const greeting = user?.personality === 'casual' ? 'Hai! ⏰' : 'Pengingat:'
          await sendMessage(reminder.user_jid, `${greeting}\n${reminder.message}`)

          if (!reminder.recurring) {
            db.markReminderDone(reminder.id)
          } else {
            const next = getNextRecurring(reminder.remind_at, reminder.recurring)
            db.createReminder(reminder.user_jid, reminder.message, next, reminder.recurring)
            db.markReminderDone(reminder.id)
          }
        } catch (err) {
          console.error('Failed to send reminder:', err)
        }
      }
    }
  })

  console.log('Scheduler started: checking reminders every minute')
}

function getNextRecurring(fromDate: string, recurring: string): string {
  const d = dayjs(fromDate).tz('Asia/Jakarta')
  switch (recurring) {
    case 'daily': return d.add(1, 'day').format('YYYY-MM-DDTHH:mm:ssZ')
    case 'weekly': return d.add(1, 'week').format('YYYY-MM-DDTHH:mm:ssZ')
    case 'monthly': return d.add(1, 'month').format('YYYY-MM-DDTHH:mm:ssZ')
    default: return d.add(1, 'day').format('YYYY-MM-DDTHH:mm:ssZ')
  }
}
