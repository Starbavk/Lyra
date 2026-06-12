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

export function getSocket(): WASocket | null {
  return sock
}

export async function startWhatsAppBot(): Promise<void> {
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
    syncFullHistory: true,
    markOnlineOnConnect: false,
    keepAliveIntervalMs: 30000,
    generateHighQualityLinkPreview: false,
    connectTimeoutMs: 30000
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
      console.log('❌ WhatsApp disconnected:', err?.message || 'Unknown error')
      console.log('   Status code:', statusCode)

      if (statusCode === DisconnectReason.loggedOut) {
        console.log('🚫 Logged out. Hapus folder auth_info dan restart.')
        return
      }

      const isConnectionLost = !statusCode || statusCode === DisconnectReason.connectionClosed || statusCode === DisconnectReason.connectionLost
      const delay = isConnectionLost ? 3000 : 10000
      console.log(`🔄 Reconnecting in ${delay/1000}s...\n`)
      setTimeout(startWhatsAppBot, delay)
    }
  })

  sock.ev.on('creds.update', saveCreds)

  const ownerNumber = process.env.OWNER_NUMBER || ''

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.key || !msg.message) continue

      const jid = msg.key.remoteJid
      if (!jid || jid.endsWith('@g.us')) continue

      if (ownerNumber && !jid.startsWith(ownerNumber)) continue

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

  console.log('🤖 Lyra WhatsApp bot is ready!')
}
