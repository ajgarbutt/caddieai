import { config } from 'dotenv'
import { resolve } from 'node:path'
import OpenAI from 'openai'
import { OPENAI_MODEL_FALLBACK } from './config.js'

let client = null
let envLoaded = false

function ensureEnvLoaded() {
  if (envLoaded) return
  envLoaded = true
  if (!process.env.OPENAI_API_KEY) {
    config({ path: resolve(process.cwd(), '.env.local') })
    config({ path: resolve(process.cwd(), '.env') })
  }
}

export function getOpenAIClient() {
  ensureEnvLoaded()

  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new Error('SERVICE_UNAVAILABLE')
  }

  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }

  return client
}

export function getOpenAIModel() {
  ensureEnvLoaded()
  return process.env.OPENAI_MODEL?.trim() || OPENAI_MODEL_FALLBACK
}
