import { toFile } from 'openai/uploads'
import { getOpenAIClient } from './_lib/openai.js'
import { parseAudioUpload } from './_lib/parseMultipart.js'
import { checkRateLimit, getClientIp } from './_lib/rateLimit.js'
import {
  GOLF_TRANSCRIPTION_PROMPT,
  OPENAI_TRANSCRIBE_MODEL,
} from './_lib/config.js'

export const config = {
  api: {
    bodyParser: false,
  },
}

function sendJson(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed.' })
  }

  const ip = getClientIp(req)
  const rate = checkRateLimit(`transcribe:${ip}`)
  if (!rate.allowed) {
    return sendJson(res, 429, {
      error: `Easy there — too many requests. Try again in ${rate.retryAfterSeconds} seconds.`,
    })
  }

  try {
    getOpenAIClient()
  } catch {
    return sendJson(res, 503, {
      error: 'CaddieAI is not configured yet. Please try again later.',
    })
  }

  let upload
  try {
    upload = await parseAudioUpload(req)
  } catch (error) {
    if (error.message === 'FILE_TOO_LARGE') {
      return sendJson(res, 413, {
        error: 'That recording is too long. Please keep it to a short shot description.',
      })
    }
    if (error.message === 'INVALID_FILE_TYPE') {
      return sendJson(res, 415, {
        error: 'Unsupported audio format. Please try recording again.',
      })
    }
    if (error.message === 'NO_FILE') {
      return sendJson(res, 400, { error: 'No audio file was received.' })
    }
    return sendJson(res, 400, { error: 'Could not read the audio upload.' })
  }

  try {
    const openai = getOpenAIClient()
    const file = await toFile(upload.buffer, upload.filename, {
      type: upload.mimeType,
    })

    const result = await openai.audio.transcriptions.create({
      file,
      model: OPENAI_TRANSCRIBE_MODEL,
      language: 'en',
      prompt: GOLF_TRANSCRIPTION_PROMPT,
    })

    const transcript = result.text?.trim()
    if (!transcript) {
      return sendJson(res, 422, {
        error: 'I could not make out any speech in that recording.',
      })
    }

    return sendJson(res, 200, { transcript })
  } catch (error) {
    console.error('[transcribe] handler error:', error)
    return sendJson(res, 500, {
      error: 'I could not transcribe that recording. Please try again.',
    })
  }
}
