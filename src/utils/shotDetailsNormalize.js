const NO_HAZARD_PATTERNS = [
  /^none$/i,
  /^no\b/i,
  /^nothing\b/i,
  /^clear\b/i,
  /^all clear\b/i,
  /^no trouble\b/i,
  /^no hazard\b/i,
  /^no obstruction/i,
  /^no obstacle/i,
  /^no bunkers?\b/i,
  /^no water\b/i,
]

/** Phrases in golfer speech that mean there is no hazard in play. */
const NO_HAZARD_MESSAGE_PATTERNS = [
  /\bno obstructions?\b/i,
  /\bno obstacles?\b/i,
  /\bnothing in (the |my )?way\b/i,
  /\bclear (path|shot|of (trouble|hazards?|obstructions?|obstacles?))\b/i,
  /\bno (trouble|hazards?|bunkers?|water|obstructions?|obstacles?)\b/i,
  /\bwithout (any )?(trouble|hazards?|obstructions?|obstacles?|bunkers?|water)\b/i,
  /\ball clear\b/i,
  /\bno trouble in play\b/i,
  /\bnothing (to (carry|worry about)|ahead|in play)\b/i,
]

/** Phrases that mean the ball is on a tee / from the tee box. */
const TEE_SHOT_MESSAGE_PATTERNS = [
  /\btee shot\b/i,
  /\boff the tee\b/i,
  /\bon the tee\b/i,
  /\bfrom the tee\b/i,
  /\btee box\b/i,
  /\bteeing (ground|area)\b/i,
  /\bteed up\b/i,
  /\bpar 3 tee\b/i,
]

const SKIP_GATHERING_PATTERNS = [
  /\bjust tell me\b/i,
  /\bjust advise\b/i,
  /\bwhat should i hit\b/i,
  /\bgive me (a |the )?club\b/i,
  /\bthat'?s (all|it)\b/i,
  /\bnothing else\b/i,
  /\bdon'?t know\b/i,
  /\bnot sure\b/i,
  /\bskip\b/i,
]

function isEmptyDetail(value) {
  if (value == null) return true
  if (typeof value === 'string') return value.trim() === ''
  return false
}

function latestUserTexts(messages) {
  return (messages ?? [])
    .filter((m) => m?.role === 'user' && typeof m.text === 'string')
    .map((m) => m.text)
    .join('\n')
}

export function messageImpliesNoHazard(messages) {
  const text = latestUserTexts(messages)
  if (!text.trim()) return false
  return NO_HAZARD_MESSAGE_PATTERNS.some((pattern) => pattern.test(text))
}

export function messageImpliesTeeShot(messages) {
  const text = latestUserTexts(messages)
  if (!text.trim()) return false
  return TEE_SHOT_MESSAGE_PATTERNS.some((pattern) => pattern.test(text))
}

export function normalizeHazardFields(details) {
  if (!details || typeof details !== 'object') return details

  const normalized = { ...details }
  const danger = String(normalized.danger ?? '').trim()
  const dangerSide = String(normalized.dangerSide ?? '').trim()

  if (danger && NO_HAZARD_PATTERNS.some((pattern) => pattern.test(danger))) {
    normalized.danger = 'none'
    if (!dangerSide || NO_HAZARD_PATTERNS.some((pattern) => pattern.test(dangerSide))) {
      normalized.dangerSide = 'none in play'
    }
  }

  return normalized
}

/**
 * Fill fields from golfer wording when the model left them blank.
 * e.g. "no obstructions" → danger none; "on the tee" → teed up / Tee shot
 */
export function applyUserMessageInferences(details, messages) {
  const next = { ...(details ?? {}) }
  const text = latestUserTexts(messages)

  if (
    messageImpliesNoHazard(messages) &&
    (isEmptyDetail(next.danger) ||
      NO_HAZARD_PATTERNS.some((pattern) => pattern.test(String(next.danger).trim())))
  ) {
    next.danger = 'none'
    if (
      isEmptyDetail(next.dangerSide) ||
      NO_HAZARD_PATTERNS.some((pattern) => pattern.test(String(next.dangerSide).trim()))
    ) {
      next.dangerSide = 'none in play'
    }
  }

  if (messageImpliesTeeShot(messages)) {
    next.shotType = 'Tee shot'
    next.lie = 'teed up'
  } else if (next.shotType === 'Tee shot' && isEmptyDetail(next.lie)) {
    next.lie = 'teed up'
  }

  if (!(typeof next.distance === 'number' && next.distance > 0) && text.trim()) {
    const inferredDistance = inferDistanceFromText(text)
    if (inferredDistance) {
      next.distance = inferredDistance.distance
      if (isEmptyDetail(next.units)) {
        next.units = inferredDistance.units
      }
    }
  }

  return normalizeHazardFields(next)
}

function inferDistanceFromText(text) {
  const unitToCanonical = (raw) => {
    const u = String(raw).toLowerCase()
    if (u.startsWith('m') && !u.startsWith('y')) return 'metres'
    return 'yards'
  }

  // Prefer "hole is about 300 yards" / "300 yard hole"
  const holeMatch = text.match(
    /\bhole\b[^.?!]{0,48}?\b(\d{2,3})\s*(yards?|metres?|meters?|yds?|m)\b|\b(\d{2,3})\s*(yards?|metres?|meters?|yds?|m)\s+hole\b/i
  )
  if (holeMatch) {
    const value = holeMatch[1] || holeMatch[3]
    const unit = holeMatch[2] || holeMatch[4]
    return { distance: Number(value), units: unitToCanonical(unit) }
  }

  // "about 30 yards away" / "got 150 yards"
  const awayMatch = text.match(
    /\b(?:about|around|roughly|got|have)?\s*(\d{2,3})\s*(yards?|metres?|meters?|yds?|m)\b(?:\s*(?:away|to (?:the )?(?:green|pin|flag)))?/i
  )
  if (awayMatch) {
    return { distance: Number(awayMatch[1]), units: unitToCanonical(awayMatch[2]) }
  }

  return null
}

export function userWantsAdviceNow(messages) {
  const latestUser = [...(messages ?? [])].reverse().find((m) => m.role === 'user')
  if (!latestUser?.text) return false
  return SKIP_GATHERING_PATTERNS.some((pattern) => pattern.test(latestUser.text))
}

export function convertDistanceUnits(distance, fromUnits, toUnits) {
  if (typeof distance !== 'number' || distance <= 0) return distance
  if (fromUnits === toUnits) return Math.round(distance)

  if (fromUnits === 'yards' && toUnits === 'metres') {
    return Math.round(distance * 0.9144)
  }

  if (fromUnits === 'metres' && toUnits === 'yards') {
    return Math.round(distance / 0.9144)
  }

  return Math.round(distance)
}
