import { GoogleGenerativeAI } from '@google/generative-ai'
import { getSystemPrompt, getFunctionDefinitions } from './personality.js'
import type { AIAction, MessageContext, Personality } from '../types/index.js'

function getGenAI(): GoogleGenerativeAI {
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
}

export async function testGeminiKey(): Promise<boolean> {
  try {
    const genAI = getGenAI()
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
    const result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: 'Balas "OK" saja' }] }] })
    console.log('✅ Gemini API: OK')
    return true
  } catch (err: any) {
    console.error('❌ Gemini API Error:', err.message)
    return false
  }
}

export async function processMessage(ctx: MessageContext): Promise<AIAction> {
  const systemPrompt = getSystemPrompt(ctx.user.personality, process.env.BOT_NAME || 'Lyra')
  const genAI = getGenAI()
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: systemPrompt,
    tools: [{
      functionDeclarations: getFunctionDefinitions() as any
    }]
  })

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: `${ctx.senderName}: ${ctx.message}` }] }],
    generationConfig: {
      temperature: ctx.user.personality === 'casual' ? 0.8 : 0.4,
      maxOutputTokens: 500
    }
  })

  const response = result.response
  const call = response.functionCalls()

  if (call && call.length > 0) {
    const fn = call[0]
    const args = fn.args as Record<string, string>

    switch (fn.name) {
      case 'create_reminder':
        return { type: 'create_reminder', message: String(args.message || ''), remind_at: String(args.remind_at || ''), recurring: args.recurring as string | undefined }
      case 'create_todo':
        return { type: 'create_todo', title: String(args.title || ''), priority: args.priority as string | undefined, due_date: args.due_date as string | undefined }
      case 'save_note':
        return { type: 'save_note', title: String(args.title || ''), content: String(args.content || ''), category: args.category as string | undefined }
      case 'list_todos':
        return { type: 'list_todos', status: args.status as string | undefined }
      case 'list_reminders':
        return { type: 'list_reminders', status: args.status as string | undefined }
      case 'list_notes':
        return { type: 'list_notes', query: args.query as string | undefined }
      case 'complete_todo':
        return { type: 'complete_todo', query: args.query as string | undefined }
      case 'switch_personality':
        return { type: 'switch_personality', mode: (args.mode || 'casual') as Personality }
      default:
        return { type: 'chat', response: 'Maaf, saya tidak bisa melakukan itu.' }
    }
  }

  return { type: 'chat', response: response.text() || '' }
}
