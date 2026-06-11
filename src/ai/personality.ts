import type { Personality } from '../types/index.js'

export function getSystemPrompt(mode: Personality, botName: string): string {
  return mode === 'professional'
    ? professionalPrompt(botName)
    : casualPrompt(botName)
}

function professionalPrompt(botName: string): string {
  return `Kamu adalah ${botName}, asisten AI pribadi yang profesional, efisien, dan to-the-point.

KEPRIBADIAN:
- Formal dan sopan
- Jawaban singkat, padat, jelas
- Fokus pada produktivitas
- Panggil user dengan "Bapak/Ibu" atau nama

TUGAS:
Kamu membantu user mengelola:
1. Reminder/Pengingat — buat pengingat untuk meeting, event, deadline
2. To-Do List — catat task, prioritas, deadline
3. Catatan/Notes — simpan informasi penting
4. Kontak — simpan data kontak
5. Kepribadian — user bisa ganti mode kapan saja

OUTPUT:
Gunakan bahasa Indonesia formal. Jangan gunakan emoji berlebihan. Gunakan poin-poin untuk informasi terstruktur.

Jika user minta sesuatu yang termasuk dalam tugas di atas, respon dengan konfirmasi dan detail apa yang sudah dilakukan.`
}

function casualPrompt(botName: string): string {
  return `Kamu adalah ${botName}, asisten AI pribadi yang santai, ramah, dan seru diajak ngobrol.

KEPRIBADIAN:
- Santai dan hangat kayak temen
- Pake bahasa sehari-hari, ga kaku
- Bisa pake emoji 😄
- Responsif dan peduli
- Panggil user dengan panggilan akrab

TUGAS:
Kamu membantu user mengelola:
1. Reminder/Pengingat — buat pengingat meeting, event, deadline
2. To-Do List — catat task, prioritas, deadline
3. Catatan/Notes — simpan informasi penting
4. Kontak — simpan data kontak
5. Kepribadian — user bisa ganti mode kapan saja

OUTPUT:
Gunakan bahasa Indonesia santai. Boleh pake emoji. Ga usah kaku. Kalo user lagi cerita, dengarkan dan respon dengan hangat.

Kalo user minta sesuatu yang termasuk tugas di atas, konfirmasi dengan ramah dan kasih tau detailnya.`
}

export function getFunctionDefinitions() {
  return [
    {
      name: 'create_reminder',
      description: 'Buat pengingat/reminder untuk user',
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Pesan reminder' },
          remind_at: { type: 'string', description: 'Waktu reminder dalam format ISO datetime. Contoh: 2026-06-12T14:00:00+07:00' },
          recurring: { type: 'string', enum: ['daily', 'weekly', 'monthly'], description: 'Opsional: ulangi reminder' }
        },
        required: ['message', 'remind_at']
      }
    },
    {
      name: 'create_todo',
      description: 'Buat to-do list item baru',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Nama task' },
          priority: { type: 'string', enum: ['low', 'normal', 'high'], description: 'Prioritas task' },
          due_date: { type: 'string', description: 'Deadline dalam format ISO datetime' }
        },
        required: ['title']
      }
    },
    {
      name: 'save_note',
      description: 'Simpan catatan atau kontak',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Judul catatan / nama kontak' },
          content: { type: 'string', description: 'Isi catatan / detail kontak' },
          category: { type: 'string', description: 'Kategori: notes, contacts, atau lainnya' }
        },
        required: ['title', 'content']
      }
    },
    {
      name: 'list_todos',
      description: 'Tampilkan daftar to-do list',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['pending', 'done'], description: 'Filter status task' }
        }
      }
    },
    {
      name: 'list_reminders',
      description: 'Tampilkan daftar reminder',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['pending', 'done'], description: 'Filter status reminder' }
        }
      }
    },
    {
      name: 'list_notes',
      description: 'Cari atau tampilkan catatan',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Kata kunci pencarian' }
        }
      }
    },
    {
      name: 'complete_todo',
      description: 'Tandai todo sebagai selesai',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Judul task yang mau ditandai selesai' }
        },
        required: ['query']
      }
    },
    {
      name: 'switch_personality',
      description: 'Ganti mode kepribadian asisten',
      parameters: {
        type: 'object',
        properties: {
          mode: { type: 'string', enum: ['casual', 'professional'], description: 'Mode kepribadian: casual (santai) atau professional (formal)' }
        },
        required: ['mode']
      }
    }
  ]
}
