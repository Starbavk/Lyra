import makeWASocket, { useMultiFileAuthState, DisconnectReason, type WASocket } from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import qrcode from 'qrcode-terminal'
import path from 'path'
import fs from 'fs'
import pino from 'pino'
import { processUserMessage } from '../commands/handler.js'
import * as db from '../database/index.js'
import { setSendMessageFn } from '../scheduler/index.js'
import type { MessageContext } from '../types/index.js'

const AUTH_DIR = path.join(process.cwd(), 'auth_info')
let sock: WASocket | null = null

export function getSocket(): WASocket | null {
  return sock
}

export async function startWhatsAppBot(): Promise<void> {
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true })
  }

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    browser: ['Memoris', 'Chrome', '3.0']
  })

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      console.log('\n📱 Scan QR code ini dengan WhatsApp kamu:\n')
      qrcode.generate(qr, { small: true })
      console.log('\nBuka WhatsApp > Settings > Linked Devices > Link a Device\n')
    }

    if (connection === 'open') {
      console.log('✅ WhatsApp connected!')
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut
      console.log('❌ WhatsApp disconnected:', lastDisconnect?.error?.message)
      if (shouldReconnect) {
        console.log('🔄 Reconnecting in 5s...')
        setTimeout(startWhatsAppBot, 5000)
      } else {
        console.log('🚫 Logged out, delete auth_info folder and restart')
      }
    }
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.key || msg.key.fromMe) continue
      if (!msg.message) continue

      const jid = msg.key.remoteJid
      if (!jid) continue

      const text = msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        ''

      if (!text.trim()) continue

      const pushName = msg.pushName || 'User'

      try {
        const user = db.getOrCreateUser(jid, pushName)
        const ctx: MessageContext = { user, message: text.trim(), senderName: pushName }
        const reply = await processUserMessage(ctx)
        await sock!.sendMessage(jid, { text: reply })
      } catch (err) {
        console.error('Error processing message:', err)
        await sock!.sendMessage(jid, { text: 'Maaf, ada error. Coba lagi ya.' })
      }
    }
  })

  setSendMessageFn(async (jid: string, text: string) => {
    if (sock) {
      await sock.sendMessage(jid, { text })
    }
  })

  console.log('🤖 WhatsApp bot is ready!')
}
