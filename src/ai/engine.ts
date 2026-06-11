import OpenAI from 'openai'
import { getSystemPrompt, getFunctionDefinitions } from './personality.js'
import type { AIAction, MessageContext, Personality } from '../types/index.js'

function getOpenAI(): OpenAI {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

export async function processMessage(ctx: MessageContext): Promise<AIAction> {
  const systemPrompt = getSystemPrompt(ctx.user.personality, process.env.BOT_NAME || 'Memoris')

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `${ctx.senderName}: ${ctx.message}` }
    ],
    tools: getFunctionDefinitions().map(fn => ({ type: 'function' as const, function: fn })),
    tool_choice: 'auto',
    temperature: ctx.user.personality === 'casual' ? 0.8 : 0.4,
    max_tokens: 500
  })

  const choice = response.choices[0]

  if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls) {
    const toolCall = choice.message.tool_calls[0]
    const args = JSON.parse(toolCall.function.arguments)

    switch (toolCall.function.name) {
      case 'create_reminder':
        return { type: 'create_reminder', message: args.message, remind_at: args.remind_at, recurring: args.recurring }
      case 'create_todo':
        return { type: 'create_todo', title: args.title, priority: args.priority, due_date: args.due_date }
      case 'save_note':
        return { type: 'save_note', title: args.title, content: args.content, category: args.category }
      case 'list_todos':
        return { type: 'list_todos', status: args.status }
      case 'list_reminders':
        return { type: 'list_reminders', status: args.status }
      case 'list_notes':
        return { type: 'list_notes', query: args.query }
      case 'complete_todo':
        return { type: 'complete_todo', query: args.query }
      case 'switch_personality':
        return { type: 'switch_personality', mode: args.mode as Personality }
      default:
        return { type: 'chat', response: 'Maaf, saya tidak bisa melakukan itu.' }
    }
  }

  return { type: 'chat', response: choice.message.content || '' }
}

export async function generateResponse(userMessage: string, context: string, personality: Personality): Promise<string> {
  const openai = getOpenAI()
  const systemPrompt = getSystemPrompt(personality, process.env.BOT_NAME || 'Memoris')
  const fullPrompt = `${systemPrompt}\n\nKonteks:\n${context}\n\nUser: ${userMessage}`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: fullPrompt }],
    temperature: personality === 'casual' ? 0.8 : 0.4,
    max_tokens: 500
  })

  return response.choices[0].message.content || ''
}
