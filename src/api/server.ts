import express from 'express'
import type { Request, Response } from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import * as db from '../database/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
app.use(express.json())
app.use(express.static(path.join(__dirname, '../../web')))

export function startApiServer(port: number): void {
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', bot: 'Memoris', version: '0.1.0' })
  })

  app.get('/api/users/:jid', (req: Request, res: Response) => {
    const user = db.getUserByJid(String(req.params.jid))
    if (!user) return res.status(404).json({ error: 'User not found' })
    res.json(user)
  })

  app.get('/api/users/:jid/todos', (req: Request, res: Response) => {
    const done = req.query.done === 'true' ? true : req.query.done === 'false' ? false : undefined
    const todos = db.getTodos(String(req.params.jid), done)
    res.json(todos)
  })

  app.get('/api/users/:jid/reminders', (req: Request, res: Response) => {
    const done = req.query.done === 'true' ? true : req.query.done === 'false' ? false : undefined
    const reminders = db.getReminders(String(req.params.jid), done)
    res.json(reminders)
  })

  app.get('/api/users/:jid/notes', (req: Request, res: Response) => {
    const query = req.query.q as string | undefined
    const notes = db.getNotes(String(req.params.jid), query)
    res.json(notes)
  })

  app.listen(port, () => {
    console.log(`🌐 API server running on port ${port}`)
  })
}
