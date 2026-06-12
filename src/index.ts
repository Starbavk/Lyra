import dotenv from 'dotenv'
dotenv.config()

import { initDatabase, closeDatabase } from './database/index.js'
import { startWhatsAppBot } from './whatsapp/bot.js'
import { startScheduler } from './scheduler/index.js'
import { startApiServer } from './api/server.js'
import { testGeminiKey } from './ai/engine.js'

async function main(): Promise<void> {
  console.log('🚀 Lyra - Asisten AI Pribadi via WhatsApp')
  console.log('==========================================')

  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY not set in .env')
    process.exit(1)
  }

  const geminiOk = await testGeminiKey()
  if (!geminiOk) {
    console.log('⚠️  Gemini API bermasalah, bot tetap jalan tapi AI mungkin error')
  }

  initDatabase()
  console.log('✅ Database initialized')

  startScheduler()

  const port = parseInt(process.env.PORT || '3000', 10)
  startApiServer(port)

  await startWhatsAppBot()

  process.on('SIGINT', () => {
    console.log('\nShutting down...')
    closeDatabase()
    process.exit(0)
  })

  process.on('SIGTERM', () => {
    closeDatabase()
    process.exit(0)
  })
}

main().catch(console.error)
