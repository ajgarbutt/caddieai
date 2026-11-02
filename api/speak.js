import { getOpenAIClient } from './_lib/openai.js'
import { checkRateLimit, getClientIp } from './_lib/rateLimit.js'
import {
  MAX_SPEECH_CHARS,
  OPENAI_TTS_INSTRUCTIONS,
  OPENAI_TTS_MODEL,
  OPENAI_TTS_SPEED,
  OPENAI_TTS_VOICE,
} from './_lib/config.js'

function sendJson(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === 'object') {
      resolve(req.body)
      return
    }

    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        resolve(raw ? JSON.parse(raw) : {})
      } catch {
        reject(new Error('INVALID_JSON'))
      }
    })
    req.on('error', reject)
  })
}

async function pipeSpeechStream(openai, text, res) {
  const speech = await openai.audio.speech.create({
    model: OPENAI_TTS_MODEL,
    voice: OPENAI_TTS_VOICE,
    input: text,
    instructions: OPENAI_TTS_INSTRUCTIONS,
    speed: OPENAI_TTS_SPEED,
    response_format: 'mp3',
  })

  res.status(200)
  res.setHeader('Content-Type', 'audio/mpeg')
  res.setHeader('Cache-Control', 'private, max-age=3600')
  res.setHeader('Transfer-Encoding', 'chunked')

  const body = speech.body
  if (body && typeof body.getReader === 'function') {
    const reader = body.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) res.write(Buffer.from(value))
    }
    res.end()
    return
  }

  const buffer = Buffer.from(await speech.arrayBuffer())
  res.end(buffer)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed.' })
  }

  const ip = getClientIp(req)
  const rate = checkRateLimit(`speak:${ip}`)
  if (!rate.allowed) {
    return sendJson(res, 429, {
      error: `Too many requests. Try again in ${rate.retryAfterSeconds} seconds.`,
    })
  }

  let openai
  try {
    openai = getOpenAIClient()
  } catch (error) {
    console.error('[speak] OpenAI client unavailable:', error)
    return sendJson(res, 503, {
      error: 'CaddieAI is not configured yet. Please try again later.',
    })
  }

  let body
  try {
    body = await readJsonBody(req)
  } catch {
    return sendJson(res, 400, { error: 'Invalid request body.' })
  }

  const text = typeof body.text === 'string' ? body.text.trim().slice(0, MAX_SPEECH_CHARS) : ''
  if (!text) {
    return sendJson(res, 400, { error: 'No text to speak.' })
  }

  const stream = Boolean(body.stream)

  try {
    if (stream) {
      await pipeSpeechStream(openai, text, res)
      return
    }

    const response = await openai.audio.speech.create({
      model: OPENAI_TTS_MODEL,
      voice: OPENAI_TTS_VOICE,
      input: text,
      instructions: OPENAI_TTS_INSTRUCTIONS,
      speed: OPENAI_TTS_SPEED,
      response_format: 'mp3',
    })

    const buffer = Buffer.from(await response.arrayBuffer())
    res.status(200)
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Cache-Control', 'private, max-age=3600')
    res.end(buffer)
  } catch (error) {
    console.error('[speak] handler error:', error)
    if (!res.headersSent) {
      return sendJson(res, 500, { error: 'Could not generate speech audio.' })
    }
    res.end()
  }
}
