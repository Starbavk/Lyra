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
      const owner = process.env.OWNER_NUMBER
      if (owner && sock) {
        const jid = owner + '@s.whatsapp.net'
        sock.sendMessage(jid, { text: '✨ Lyra siap! Kirim "Halo" untuk mulai.' })
          .then(() => console.log('📤 Welcome message sent to', jid))
          .catch(e => console.log('📤 Gagal kirim welcome:', e.message))
      }
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

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    console.log('📨 Event messages.upsert type:', type, 'count:', messages.length)
    for (const msg of messages) {
      try {
        const fromMe = msg.key?.fromMe
        const jid = msg.key?.remoteJid
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '(media/non-text)'
        console.log(`  📩 fromMe:${fromMe} jid:${jid} text:${text}`)

        if (!msg.key || !msg.message) continue
        if (!jid || jid.endsWith('@g.us')) continue

        const msgText = msg.message.conversation || msg.message.extendedTextMessage?.text || ''
        if (!msgText.trim()) continue

        if (ownerNumber && !jid.startsWith(ownerNumber) && !(fromMe && ownerNumber && jid.startsWith(ownerNumber))) continue

        console.log('✅ Memproses:', msgText)

        const pushName = msg.pushName || 'User'
        const user = db.getOrCreateUser(jid, pushName)
        const ctx: MessageContext = { user, message: msgText.trim(), senderName: pushName }

        await sock!.sendMessage(jid, { text: 'Tunggu ya, lagi diproses...' })

        const reply = await processUserMessage(ctx)
        await sock!.sendMessage(jid, { text: reply })
      } catch (err: any) {
        console.error('❌ Error:', err?.message || err)
        try {
          const jid = msg?.key?.remoteJid
          if (jid) await sock?.sendMessage(jid, { text: 'Maaf, ada error. Coba lagi ya.' })
        } catch {}
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
