import { getOpenAIClient, getOpenAIModel } from './_lib/openai.js'
import { checkRateLimit, getClientIp } from './_lib/rateLimit.js'
import {
  MAX_CADDIE_BODY_BYTES,
  MAX_CONVERSATION_MESSAGES,
  MAX_OUTPUT_TOKENS,
  OPENAI_ADVICE_TEMPERATURE,
  OPENAI_SASS_TEMPERATURE,
} from './_lib/config.js'
import {
  buildCaddieConversationInput,
  buildUnifiedCaddieSystemPrompt,
  emptyShotDetails,
  parseCaddieResponseJson,
  resolveAdvicePhase,
} from '../src/utils/buildGolfPrompt.js'
import { buildSgExpertSystemPrompt } from '../src/utils/sgExpertPrompt.js'
import { applyUserMessageInferences, normalizeHazardFields } from '../src/utils/shotDetailsNormalize.js'
import {
  messageContradictsShotType,
  resolveShotType,
} from '../src/utils/shotAdviceLibrary.js'

function sendJson(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

function sendSse(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`)
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === 'object') {
      resolve(req.body)
      return
    }

    const chunks = []
    let size = 0

    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_CADDIE_BODY_BYTES) {
        reject(new Error('BODY_TOO_LARGE'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })

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

function sanitizeProfile(profile) {
  if (!profile || typeof profile !== 'object') return null
  const units = profile.units === 'metres' ? 'metres' : 'yards'
  const handicap =
    typeof profile.handicap === 'number' && profile.handicap >= 0 && profile.handicap <= 54
      ? profile.handicap
      : null
  const name = typeof profile.name === 'string' ? profile.name.trim().slice(0, 80) : ''
  const sassMode = Boolean(profile.sassMode)
  return { name, handicap, units, sassMode }
}

function sanitizeClubs(clubs) {
  if (!Array.isArray(clubs)) return []
  return clubs
    .slice(0, 20)
    .map((club) => {
      if (!club || typeof club !== 'object') return null
      const name = typeof club.name === 'string' ? club.name.trim().slice(0, 60) : ''
      if (!name) return null
      const unit = club.unit === 'metres' ? 'metres' : 'yards'
      let distance = null
      if (typeof club.distance === 'number' && club.distance > 0) {
        distance = Math.round(club.distance)
      } else if (typeof club.distance === 'string' && club.distance.trim() !== '') {
        const parsed = Number(club.distance)
        if (Number.isFinite(parsed) && parsed > 0) distance = Math.round(parsed)
      }
      return {
        id: typeof club.id === 'string' ? club.id.slice(0, 64) : `club-${Date.now()}`,
        name,
        distance,
        unit,
      }
    })
    .filter(Boolean)
}

function sanitizeShotDetails(details) {
  const base = emptyShotDetails()
  if (!details || typeof details !== 'object') return base

  const stringFields = [
    'shotType',
    'lie',
    'ballLocation',
    'wind',
    'danger',
    'dangerSide',
    'pinPosition',
    'greenSlope',
    'bunkerType',
    'troubleType',
    'chipGreenRatio',
    'notes',
  ]

  for (const key of stringFields) {
    if (typeof details[key] === 'string') {
      base[key] = details[key].trim().slice(0, 200) || null
    }
  }

  if (typeof details.distance === 'number' && details.distance > 0) {
    base.distance = Math.round(details.distance)
  }

  if (details.units === 'yards' || details.units === 'metres') {
    base.units = details.units
  }

  if (
    details.gatheringPhase === 'required' ||
    details.gatheringPhase === 'optional' ||
    details.gatheringPhase === 'complete'
  ) {
    base.gatheringPhase = details.gatheringPhase
  }

  return normalizeHazardFields(base)
}

function sanitizeMessages(messages) {
  if (!Array.isArray(messages)) return []

  return messages
    .slice(-MAX_CONVERSATION_MESSAGES)
    .map((message) => {
      if (!message || typeof message !== 'object') return null
      const role = message.role === 'assistant' ? 'assistant' : 'user'
      const text = typeof message.text === 'string' ? message.text.trim().slice(0, 2000) : ''
      if (!text) return null
      const createdAt =
        typeof message.createdAt === 'string' ? message.createdAt : new Date().toISOString()
      return { role, text, createdAt }
    })
    .filter(Boolean)
}

function latestUserText(messages) {
  return [...messages].reverse().find((m) => m.role === 'user')?.text ?? ''
}

/**
 * When the golfer's latest message contradicts a stored shot type (e.g. they
 * clarify the ball is on the fairway, not in a bunker), force the corrected
 * type so the stale value can't persist into the next turn.
 */
function applyShotTypeCorrection(shotDetails, previousDetails, messages, activeShotType) {
  const previousType = previousDetails?.shotType
  if (
    previousType &&
    messageContradictsShotType(latestUserText(messages), previousType) &&
    shotDetails.shotType === previousType
  ) {
    shotDetails.shotType = activeShotType
  }
  return shotDetails
}

function adviceTemperature(profile) {
  return profile?.sassMode ? OPENAI_SASS_TEMPERATURE : OPENAI_ADVICE_TEMPERATURE
}

function buildPromptContext(profile, clubs, previousDetails, messages) {
  const inferredDetails = applyUserMessageInferences(previousDetails, messages)
  const activeShotType = resolveShotType(inferredDetails, messages)
  const adviceState = resolveAdvicePhase(
    inferredDetails,
    activeShotType,
    inferredDetails.gatheringPhase ?? null,
    messages
  )

  const promptDetails = {
    ...inferredDetails,
    shotType: activeShotType,
    gatheringPhase: adviceState.phase,
  }

  return {
    activeShotType,
    adviceState,
    systemPrompt: buildUnifiedCaddieSystemPrompt({
      profile,
      clubs,
      shotDetails: promptDetails,
      messages,
      advicePhase: adviceState.phase,
    }),
  }
}

function expertReply(text, messages) {
  return parseCaddieResponseJson(text, null, messages).reply
}

async function getSgExpertReply(openai, model, profile, messages, brief) {
  const response = await openai.responses.create({
    model,
    temperature: OPENAI_ADVICE_TEMPERATURE,
    max_output_tokens: MAX_OUTPUT_TOKENS,
    input: [
      { role: 'system', content: buildSgExpertSystemPrompt({ profile, brief }) },
      ...buildCaddieConversationInput(messages),
    ],
    text: { format: { type: 'json_object' } },
  })
  return expertReply(response.output_text || '{}', messages)
}

async function streamSgExpertReply(openai, model, profile, messages, brief, res) {
  res.status(200)
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  const stream = await openai.responses.create({
    model,
    temperature: OPENAI_ADVICE_TEMPERATURE,
    max_output_tokens: MAX_OUTPUT_TOKENS,
    input: [
      { role: 'system', content: buildSgExpertSystemPrompt({ profile, brief }) },
      ...buildCaddieConversationInput(messages),
    ],
    text: { format: { type: 'json_object' } },
    stream: true,
  })

  let fullText = ''
  for await (const event of stream) {
    if (event.type === 'response.output_text.delta') {
      fullText += event.delta
      sendSse(res, { type: 'delta', text: event.delta })
    }
  }

  sendSse(res, {
    type: 'done',
    reply: expertReply(fullText, messages),
    extractedShotDetails: null,
  })
  res.end()
}

async function getCaddieReply(openai, model, profile, clubs, previousDetails, messages) {
  const { activeShotType, adviceState, systemPrompt } = buildPromptContext(
    profile,
    clubs,
    previousDetails,
    messages
  )
  const conversation = buildCaddieConversationInput(messages)

  const response = await openai.responses.create({
    model,
    temperature: adviceTemperature(profile),
    max_output_tokens: MAX_OUTPUT_TOKENS,
    input: [{ role: 'system', content: systemPrompt }, ...conversation],
    text: { format: { type: 'json_object' } },
  })

  const { reply, shotDetails } = parseCaddieResponseJson(
    response.output_text || '{}',
    previousDetails,
    messages
  )

  applyShotTypeCorrection(shotDetails, previousDetails, messages, activeShotType)
  shotDetails.gatheringPhase =
    adviceState.phase === 'advise' ? 'complete' : adviceState.phase

  return { reply, shotDetails, adviceState }
}

async function streamCaddieReply(openai, model, profile, clubs, previousDetails, messages, res) {
  const { activeShotType, adviceState, systemPrompt } = buildPromptContext(
    profile,
    clubs,
    previousDetails,
    messages
  )
  const conversation = buildCaddieConversationInput(messages)

  res.status(200)
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  const stream = await openai.responses.create({
    model,
    temperature: adviceTemperature(profile),
    max_output_tokens: MAX_OUTPUT_TOKENS,
    input: [{ role: 'system', content: systemPrompt }, ...conversation],
    text: { format: { type: 'json_object' } },
    stream: true,
  })

  let fullText = ''

  for await (const event of stream) {
    if (event.type === 'response.output_text.delta') {
      fullText += event.delta
      sendSse(res, { type: 'delta', text: event.delta })
    }
  }

  const { reply, shotDetails } = parseCaddieResponseJson(fullText, previousDetails, messages)
  applyShotTypeCorrection(shotDetails, previousDetails, messages, activeShotType)
  shotDetails.gatheringPhase =
    adviceState.phase === 'advise' ? 'complete' : adviceState.phase

  sendSse(res, {
    type: 'done',
    reply,
    extractedShotDetails: shotDetails,
  })
  res.end()
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed.' })
  }

  const ip = getClientIp(req)
  const rate = checkRateLimit(`caddie:${ip}`)
  if (!rate.allowed) {
    return sendJson(res, 429, {
      error: `Easy there — too many requests. Try again in ${rate.retryAfterSeconds} seconds.`,
    })
  }

  let openai
  try {
    openai = getOpenAIClient()
  } catch (error) {
    console.error('[caddie] OpenAI client unavailable:', error)
    return sendJson(res, 503, {
      error: 'CaddieAI is not configured yet. Please try again later.',
    })
  }

  let body
  try {
    body = await readJsonBody(req)
  } catch (error) {
    if (error.message === 'BODY_TOO_LARGE') {
      return sendJson(res, 413, { error: 'That request is too large.' })
    }
    return sendJson(res, 400, { error: 'Invalid request body.' })
  }

  const profile = sanitizeProfile(body.profile)
  const clubs = sanitizeClubs(body.clubs)
  const previousDetails = sanitizeShotDetails(body.shotDetails)
  const messages = sanitizeMessages(body.messages)
  const stream = Boolean(body.stream)
  const expert = body.mode === 'sg'
  const brief = typeof body.brief === 'string' ? body.brief.trim().slice(0, 12000) : ''

  if (!profile) {
    return sendJson(res, 400, { error: 'Profile data is missing or invalid.' })
  }

  if (messages.length === 0) {
    return sendJson(res, 400, { error: 'At least one message is required.' })
  }

  const latestUser = [...messages].reverse().find((m) => m.role === 'user')
  if (!latestUser) {
    return sendJson(res, 400, { error: 'A golfer message is required.' })
  }

  if (expert && !brief) {
    return sendJson(res, 400, { error: 'Strokes gained stats are missing.' })
  }

  try {
    const model = getOpenAIModel()

    if (expert) {
      if (stream) {
        await streamSgExpertReply(openai, model, profile, messages, brief, res)
        return
      }
      const reply = await getSgExpertReply(openai, model, profile, messages, brief)
      if (!reply) {
        return sendJson(res, 502, { error: 'Sorry, something went wrong. Please try again.' })
      }
      return sendJson(res, 200, { reply, extractedShotDetails: null })
    }

    if (stream) {
      await streamCaddieReply(openai, model, profile, clubs, previousDetails, messages, res)
      return
    }

    const { reply, shotDetails } = await getCaddieReply(
      openai,
      model,
      profile,
      clubs,
      previousDetails,
      messages
    )

    if (!reply) {
      return sendJson(res, 502, {
        error: 'Sorry, something went wrong. Please try again.',
      })
    }

    return sendJson(res, 200, { reply, extractedShotDetails: shotDetails })
  } catch (error) {
    console.error('[caddie] handler error:', error)
    if (!res.headersSent) {
      return sendJson(res, 500, {
        error: 'Sorry, something went wrong. Please try again.',
      })
    }
    res.end()
  }
}
