import dotenv from 'dotenv'
dotenv.config()

import { initDatabase, closeDatabase } from './database/index.js'
import { startWhatsAppBot } from './whatsapp/bot.js'
import { startScheduler } from './scheduler/index.js'
import { startApiServer } from './api/server.js'

async function main(): Promise<void> {
  console.log('🚀 Lyra - Asisten AI Pribadi via WhatsApp')
  console.log('==========================================')

  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY not set in .env')
    console.log('Copy .env.example to .env and add your OpenAI API key')
    process.exit(1)
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
