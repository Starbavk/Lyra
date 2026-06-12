import makeWASocket, { useMultiFileAuthState, DisconnectReason, type WASocket, fetchLatestBaileysVersion } from '@whiskeysockets/baileys'
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
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
const processedMessages = new Set<string>()

export function getSocket(): WASocket | null {
  return sock
}

async function sendWithRetry(jid: string, text: string, retries = 3): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    try {
      if (!sock) return false
      await sock.sendMessage(jid, { text })
      return true
    } catch (err: any) {
      if (i < retries - 1) await new Promise(r => setTimeout(r, 2000))
    }
  }
  return false
}

export async function startWhatsAppBot(): Promise<void> {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }

  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true })
  }

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)
  const { version, isLatest } = await fetchLatestBaileysVersion()
  console.log(`📱 WA Protocol v${version.join('.')} (latest: ${isLatest})`)

  sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'warn' }),
    browser: ['Lyra', 'Chrome', '3.0'],
    syncFullHistory: false,
    markOnlineOnConnect: true,
    keepAliveIntervalMs: 15000,
    generateHighQualityLinkPreview: false,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 30000
  })

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      console.log('\n============================================')
      console.log('📱 SCAN QR CODE INI dengan WhatsApp HP!')
      console.log('Buka WhatsApp > Settings > Linked Devices > Link a Device')
      console.log('============================================\n')
      qrcode.generate(qr, { small: true })
      console.log('\n')
    }

    if (connection === 'open') {
      console.log('\n✅ WhatsApp connected! Bot siap dipakai.\n')
    }

    if (connection === 'close') {
      const err = lastDisconnect?.error as Boom | undefined
      const statusCode = err?.output?.statusCode
      console.log('❌ WhatsApp disconnected:', err?.message || 'Unknown', 'Code:', statusCode)

      if (statusCode === DisconnectReason.loggedOut) {
        console.log('🚫 Logged out. Hapus folder auth_info dan restart.')
        return
      }

      const delay = statusCode === DisconnectReason.timedOut ? 1000 : 5000
      console.log(`🔄 Reconnecting in ${delay/1000}s...`)
      reconnectTimer = setTimeout(startWhatsAppBot, delay)
    }
  })

  sock.ev.on('creds.update', saveCreds)

  const ownerNumber = process.env.OWNER_NUMBER || ''

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      try {
        if (!msg.key || !msg.message) continue

        const msgId = msg.key.id
        if (msgId && processedMessages.has(msgId)) continue
        if (msgId) processedMessages.add(msgId)
        if (processedMessages.size > 1000) processedMessages.clear()

        const fromMe = msg.key.fromMe
        const jid = msg.key.remoteJid
        if (!jid || jid.endsWith('@g.us')) continue

        if (ownerNumber && !jid.startsWith(ownerNumber)) continue

        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || ''
        if (!text.trim()) continue

        if (fromMe && text.startsWith('✨ Lyra')) continue

        console.log('📩 Pesan:', text)

        const pushName = msg.pushName || 'User'
        const user = db.getOrCreateUser(jid, pushName)
        const ctx: MessageContext = { user, message: text.trim(), senderName: pushName }

        const reply = await processUserMessage(ctx)
        await sendWithRetry(jid, reply)
      } catch (err: any) {
        console.error('❌ Error:', err?.message)
      }
    }
  })

  setSendMessageFn(async (jid: string, text: string) => {
    await sendWithRetry(jid, text)
  })

  console.log('🤖 Lyra WhatsApp bot is ready!')
}
