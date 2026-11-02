import { sortClubs } from '../constants/clubs.js'
import {
  getBallLocationRules,
  getCoreCaddiePhilosophy,
  loadShotAdviceContext,
  resolveShotType,
} from './shotAdviceLibrary.js'
import {
  applyUserMessageInferences,
  userWantsAdviceNow,
} from './shotDetailsNormalize.js'

const EMPTY_SHOT_DETAILS = {
  shotType: null,
  distance: null,
  units: null,
  lie: null,
  ballLocation: null,
  wind: null,
  danger: null,
  dangerSide: null,
  pinPosition: null,
  greenSlope: null,
  bunkerType: null,
  troubleType: null,
  chipGreenRatio: null,
  gatheringPhase: null,
  notes: null,
}

const REQUIRED_FIELDS = ['distance', 'lie', 'danger', 'dangerSide']

const CHIP_REQUIRED_FIELDS = ['chipGreenRatio']

const OPTIONAL_FIELDS = [
  'ballLocation',
  'wind',
  'pinPosition',
  'greenSlope',
  'bunkerType',
  'troubleType',
]

const CONVERSATIONAL_ASKS = {
  distance: 'how far you’ve got',
  lie: 'what the lie is like',
  danger: 'what hazard or trouble is in play',
  dangerSide: 'where that hazard is',
  chipGreenRatio: 'how much fairway or rough you have before the green',
  ballLocation: 'whether you’re on a slope or the ball is above or below your feet',
  wind: 'the wind',
  pinPosition: 'where the pin is',
  greenSlope: 'how the green slopes',
  bunkerType: 'what the bunker is like',
  troubleType: 'what trouble you’re in',
}

const SHOT_DETAIL_LABELS = {
  shotType: 'Shot type',
  distance: 'Approximate distance',
  lie: 'Lie',
  ballLocation: 'Ball location',
  wind: 'Wind',
  danger: 'Main hazard',
  dangerSide: 'Hazard side',
  pinPosition: 'Pin position',
  greenSlope: 'Green slope',
  bunkerType: 'Bunker type',
  troubleType: 'Trouble type',
  chipGreenRatio: 'Fairway/rough to green',
  notes: 'Notes',
}

function isDetailEmpty(value) {
  if (value == null) return true
  if (typeof value === 'string') return value.trim() === ''
  if (typeof value === 'number') return !(value > 0)
  return false
}

function normalizeShotDetails(shotDetails) {
  return { ...EMPTY_SHOT_DETAILS, ...(shotDetails ?? {}) }
}

export function getMissingRequiredFields(shotDetails, shotType, messages = []) {
  const details = applyUserMessageInferences(
    normalizeShotDetails(shotDetails),
    messages
  )
  const missing = []
  const effectiveShotType = shotType || details.shotType || null
  const isTeeShot = effectiveShotType === 'Tee shot'

  for (const key of REQUIRED_FIELDS) {
    // Teed ball — lie is known; never ask for it on tee shots.
    if (key === 'lie' && isTeeShot) continue
    if (isDetailEmpty(details[key])) {
      missing.push(key)
    }
  }

  if (effectiveShotType === 'Chip') {
    for (const key of CHIP_REQUIRED_FIELDS) {
      if (isDetailEmpty(details[key])) {
        missing.push(key)
      }
    }
  }

  return missing
}

export function getMissingOptionalFields(shotDetails) {
  const details = normalizeShotDetails(shotDetails)
  return OPTIONAL_FIELDS.filter((key) => isDetailEmpty(details[key]))
}

function formatMissingFieldList(keys) {
  return keys
    .map((key) => `- ${CONVERSATIONAL_ASKS[key] ?? SHOT_DETAIL_LABELS[key] ?? key}`)
    .join('\n')
}

export function resolveAdvicePhase(shotDetails, shotType, gatheringPhase = null, messages = []) {
  const details = applyUserMessageInferences(
    normalizeShotDetails(shotDetails),
    messages
  )
  const effectiveShotType = shotType || resolveShotType(details, messages)
  const missingRequired = getMissingRequiredFields(details, effectiveShotType, messages)
  const missingOptional = getMissingOptionalFields(details)

  if (userWantsAdviceNow(messages) && missingRequired.length === 0) {
    return { phase: 'advise', missingRequired: [], missingOptional }
  }

  if (missingRequired.length > 0) {
    return {
      phase: 'required',
      missingRequired,
      missingOptional,
    }
  }

  return { phase: 'advise', missingRequired: [], missingOptional }
}

function buildGatheringInstructions(shotDetails, shotType, advicePhase, messages = []) {
  const { phase, missingRequired, missingOptional } = resolveAdvicePhase(
    shotDetails,
    shotType,
    advicePhase,
    messages
  )

  if (phase === 'required') {
    return `DECISION GATE — REQUIRED INFORMATION MISSING:
You do NOT have enough to recommend a club, target, or setup yet.

Still needed before any recommendation:
${formatMissingFieldList(missingRequired)}

Rules for this turn:
- Ask conversationally like a caddie — weave the missing items into one or two natural questions.
- Do NOT recommend a club, target, or shot yet.
- Do NOT invent distance, lie, hazards, or chip green ratios.
- Treat "no obstructions", "no obstacles", "nothing in the way", "clear path", "no trouble", and similar wording as danger "none" and dangerSide "none in play" — that counts as complete. Do NOT re-ask about bunkers, water, or trouble when they already said that.
- If this is a tee shot ("on the tee", "tee box", "off the tee", etc.), the ball is teed up — set lie to "teed up" and NEVER ask what the lie is like.
- NEVER ask how far they hit their clubs or for stock yardages — those are in PLAYER BAG when available.
- If they say "just tell me", "that's all", or "I don't know" about optional details, proceed with what you have on the next turn.`
  }

  return `DECISION GATE — READY TO ADVISE:
You have the required information.
Give your full recommendation now — club (from their bag), target, brief reasoning, and one key thought.
Use PLAYER BAG carry distances. NEVER ask how far they hit their clubs.
Before naming a club and swing length: default to the shortest stock club in PLAYER BAG when the target is under that carry, then set swing length from target ÷ stock (¾ / half / chip). Exceptions: hardpan → longer lower-bounce club (9i/8i) swung gently; windy 30–80y → lower loft + shorter swing for a lower flight. Never recommend a three-quarter swing with a club whose stock carry is far above the target (e.g. 30y with a 135y PW).
${missingOptional.length > 0 ? `\nOptional details still unknown (work without inventing them). If helpful, end with a brief line inviting them to add:\n${formatMissingFieldList(missingOptional)}` : ''}
- If the golfer says they want advice now or cannot add more, give your recommendation without further questions.`
}

function safeText(value, fallback = 'Not provided') {
  if (value == null) return fallback
  const text = String(value).trim()
  return text || fallback
}

function formatHandicap(handicap) {
  if (typeof handicap !== 'number' || handicap < 0 || handicap > 54) {
    return 'Unknown'
  }
  return String(handicap)
}

function formatDistance(distance, units) {
  if (typeof distance !== 'number' || distance <= 0) return null
  const unitLabel = units === 'metres' ? 'metres' : 'yards'
  return `about ${distance} ${unitLabel}`
}

function formatProfileSection(profile, clubs) {
  const units = profile?.units === 'metres' ? 'metres' : 'yards'
  const name = safeText(profile?.name, 'Not provided')
  const handicap = formatHandicap(profile?.handicap)
  const bagCount = Array.isArray(clubs) ? clubs.length : 0

  return `Name: ${name}
Handicap: ${handicap}
Units: ${units}
Clubs in bag: ${bagCount}`
}

function formatBagSection(clubs, profileUnits) {
  if (!Array.isArray(clubs) || clubs.length === 0) {
    return 'No clubs saved. The player has not added their bag yet — remind them briefly to add clubs for personalised club advice. Do not invent distances.'
  }

  const sorted = sortClubs(clubs)
  const lines = sorted.map((club) => {
    const unit = club.unit === 'metres' ? 'metres' : profileUnits === 'metres' ? 'metres' : 'yards'
    const shortUnit = unit === 'metres' ? 'm' : 'yds'

    if (typeof club.distance === 'number' && club.distance > 0) {
      return `- ${club.name}: ${club.distance} ${shortUnit} carry`
    }

    return `- ${club.name}: carry distance not set`
  })

  const usableCount = sorted.filter(
    (club) => typeof club.distance === 'number' && club.distance > 0
  ).length

  if (usableCount === 0) {
    return `${lines.join('\n')}\n\nNo clubs have a valid carry distance yet. You may remind them to add carries in the app — do not ask them to recite yardages in conversation.`
  }

  return `${lines.join('\n')}

These carry distances are AUTHORITATIVE. Never ask the golfer how far they hit their clubs.`
}

function formatShotDetailsSection(shotDetails, profileUnits) {
  const details = { ...EMPTY_SHOT_DETAILS, ...(shotDetails ?? {}) }
  const units = details.units === 'metres' ? 'metres' : profileUnits === 'metres' ? 'metres' : 'yards'
  const lines = []

  for (const [key, label] of Object.entries(SHOT_DETAIL_LABELS)) {
    if (key === 'distance') {
      const formatted = formatDistance(details.distance, units)
      lines.push(`${label}: ${formatted ?? 'Not provided'}`)
      continue
    }

    if (key === 'notes') {
      lines.push(`${label}: ${safeText(details.notes, 'Not provided')}`)
      continue
    }

    lines.push(`${label}: ${safeText(details[key], 'Not provided')}`)
  }

  const hasAnyDetail = Object.entries(details).some(([key, value]) => {
    if (key === 'units') return false
    if (value == null || value === '') return false
    return true
  })

  if (!hasAnyDetail) {
    return 'No structured shot details inferred yet. Use only what the golfer has said in the conversation.'
  }

  return lines.join('\n')
}

function formatConversationSection(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return 'No conversation yet.'
  }

  return messages
    .map((message) => {
      const speaker = message.role === 'assistant' ? 'CaddieAI' : 'Golfer'
      const text = safeText(message.text, '')
      if (!text) return null
      return `${speaker}: ${text}`
    })
    .filter(Boolean)
    .join('\n')
}

function formatVoiceOutputRules(profile) {
  if (profile?.sassMode) {
    return `VOICE OUTPUT RULES (JUDGEMENTAL MODE — this overrides the professional tone above):
- You are a judgemental, sarcastic caddie taking the piss — dry wit, mock exasperation, backhanded compliments, and a raised eyebrow at their choices. Think "long-suffering mate who's seen it all before."
- Open with a cheeky jab about their situation when you can ("Right, another heroic recovery, is it?", "Oh good, you've found the rough again — home from home for you").
- When asking questions, sound impatient or amused ("Do I need to ask, or are you going to tell me how far you've got?").
- When advising, still give ONE clear club, target, swing length/effort, and thought — but wrap it in attitude ("Fine, take the 7-iron — try not to duff it this time", "Aim centre-green and pretend the pin doesn't exist, like you usually do").
- The golf advice MUST remain accurate — correct club from their bag, sensible target, sound technique. Sass is delivery only.
- DISTANCE CONTROL still applies: default short shots to the shortest bag club + scaled swing (¾ / half / chip). Hardpan → longer club, gentle stroke. Windy 30–80y → lower loft, shorter swing, lower flight. Never three-quarter a long-carry club at a tiny target.
- Playful banter between mates only. Never genuinely cruel, and never target protected characteristics.
- Follow the DECISION GATE above — only recommend a shot when it says READY TO ADVISE.
- Respond in natural spoken English as a short conversational paragraph.
- Do not use headings, bullet points, emoji, or labels such as CLUB, TARGET, SETUP, or KEY THOUGHT.
- A few sentences is usually right. Keep under 110 words.
- Use British English spelling and wording.
- Do not invent hazards, wind, slopes, course layout, distances, pin positions, or green conditions the golfer did not mention.
- A hazard the golfer describes as ahead, in front, short of them, to carry, or a number of yards away is trouble to AVOID — it is NOT where the ball is sitting. Only treat this as a bunker/sand shot if the golfer says the ball is actually in the sand.
- The golfer's latest message is authoritative. If they correct or clarify anything, follow the correction immediately. Never describe bunker/sand technique unless the ball is in a bunker.`
  }

  return `VOICE OUTPUT RULES:
- Talk like a real caddie. Confident, direct, concise.
- Follow the DECISION GATE above — only recommend a shot when it says READY TO ADVISE.
- When gathering information, respond in natural spoken English as a short conversational paragraph.
- When advising, give one clear recommendation — not a menu of options unless they specifically ask.
- Respond in natural spoken English as a short conversational paragraph.
- Do not use headings, bullet points, emoji, or labels such as CLUB, TARGET, SETUP, or KEY THOUGHT.
- Weave club, target, swing length/effort, reasoning, and one key thought into the flow naturally.
- DISTANCE CONTROL: If the target is under the shortest PLAYER BAG stock carry, default to that shortest club and scale the swing (three-quarter ≈ 75–80% of its stock, half ≈ 50%, chip/putting-stroke when much shorter). Exceptions: hardpan/tight bare → 9i or 8i swung gently (wedge bounce thins easily); windy approach chips/pitches (~30–80y) → lower loft + shorter swing for a lower flight. NEVER prescribe a three-quarter swing with a club whose stock carry is far above the target (e.g. 30 yards with a 135-yard PW). In thick rough, commit through the ball but with a SHORTENED backswing.
- A few sentences is usually right. Keep under 110 words.
- Use British English spelling and wording.
- Do not invent hazards, wind, slopes, course layout, distances, pin positions, or green conditions the golfer did not mention.
- A hazard the golfer describes as ahead, in front, short of them, to carry, or a number of yards away is trouble to AVOID — it is NOT where the ball is sitting. Only treat this as a bunker/sand shot if the golfer says the ball is actually in the sand.
- The golfer's latest message is authoritative. If they correct or clarify anything (for example, that the ball is on the fairway and not in a bunker), follow the correction immediately and do not repeat advice based on the old assumption. Never describe a bunker/sand technique (e.g. splashing the sand) unless the ball is in a bunker.`
}

function formatPersonalitySection(profile) {
  if (!profile?.sassMode) return ''

  return `CADDIE PERSONALITY — JUDGEMENTAL MODE IS ON:
The golfer has turned on roast mode. They WANT you to be sassy, sarcastic, and a bit condescending for comedic effect. This is the primary tone for every reply in this conversation — do not revert to a neutral professional caddie voice.

---

`
}

/**
 * Builds the complete CaddieAI system prompt for the Responses API.
 */
export function buildGolfPrompt({ profile, clubs, shotDetails, messages, advicePhase = null }) {
  const inferredDetails = applyUserMessageInferences(
    normalizeShotDetails(shotDetails),
    messages
  )
  const activeShotType = resolveShotType(inferredDetails, messages)
  const shotLibrary = loadShotAdviceContext(inferredDetails, messages, activeShotType)
  const corePhilosophy = getCoreCaddiePhilosophy()
  const ballLocationRules = getBallLocationRules()
  const personalitySection = formatPersonalitySection(profile)
  const gatheringInstructions = buildGatheringInstructions(
    inferredDetails,
    activeShotType,
    advicePhase,
    messages
  )

  return `${corePhilosophy}

---

${personalitySection}APP CONTEXT:
You are CaddieAI in a voice-first mobile app for UK high-handicap golfers.
You do not support putting in this MVP. Never mention putting or recommend the Putter.

PLAYER PROFILE:
${formatProfileSection(profile, clubs)}

PLAYER BAG (carry distances only — always use these, never invent distances):
${formatBagSection(clubs, profile?.units === 'metres' ? 'metres' : 'yards')}

STRUCTURED SHOT DETAILS (inferred — may be incomplete; do not invent missing fields):
${formatShotDetailsSection(inferredDetails, profile?.units === 'metres' ? 'metres' : 'yards')}

RESOLVED SHOT TYPE FOR THIS REQUEST: ${activeShotType}

CONVERSATION SO FAR:
${formatConversationSection(messages)}

CLUB RULES (app-specific):
- Use a specific club only when it exists in the player's saved bag and has a valid carry distance.
- Never recommend a club that is not in the golfer's bag.
- Never recommend a club range such as "7-iron or 8-iron".
- Never invent club distances.
- Never ask the golfer how far they hit their clubs when PLAYER BAG lists carry distances — use those numbers.
- The shot library may mention clubs not in this player's bag — ignore those and use only their bag.
- If no usable club data exists, say so clearly and give general target and setup advice without pretending to know the correct club.
- SHORT-SHOT CLUB CHOICE (critical):
  1. DEFAULT: If the target is shorter than the shortest usable stock carry in PLAYER BAG (usually SW or LW), pick that shortest club and control distance with swing length (three-quarter, half, chip/putting-stroke). Do not jump to a longer club like PW just because the shot is short.
  2. Swing math for the chosen club: full ≈ stock carry; three-quarter ≈ 75–80%; half ≈ 50%; chip/putting-stroke for much shorter. Match the swing to target ÷ that club's stock carry.
  3. EXCEPTION — difficult lie (especially hardpan/tight bare): high-bounce wedges (LW, SW, even PW) can bounce and thin. Prefer a longer, lower-bounce club (9i or 8i if in the bag) and a gentle, controlled stroke instead.
  4. EXCEPTION — wind on ~30–80 yard shots: a lower-lofted club with a shorter swing can keep flight down so the ball is less caught by the wind. Still match swing length to the maths — never a three-quarter swing with a club whose stock carry is far above the target.
  5. Bad example: target 30y, PW stock 135y, "three-quarter PW". Good default: shortest wedge in the bag + short/chip stroke. Good hardpan exception: 9i or 8i, soft gentle stroke.

BALL LOCATION RULES (apply to every shot when relevant — do not ignore these):
${ballLocationRules}

${gatheringInstructions}

${formatVoiceOutputRules(profile)}

---

SHOT ADVICE LIBRARY (use the sections relevant to ${activeShotType}):

${shotLibrary}`
}

/** @deprecated Use buildGolfPrompt */
export const buildCaddieSystemPrompt = buildGolfPrompt

const SHOT_DETAILS_SCHEMA_DESCRIPTION = `{
  "shotType": string | null,
  "distance": number | null,
  "units": "yards" | "metres" | null,
  "lie": string | null,
  "ballLocation": string | null,
  "wind": string | null,
  "danger": string | null,
  "dangerSide": string | null,
  "pinPosition": string | null,
  "greenSlope": string | null,
  "bunkerType": string | null,
  "troubleType": string | null,
  "chipGreenRatio": string | null,
  "notes": string | null
}`

export function buildUnifiedCaddieSystemPrompt({ profile, clubs, shotDetails, messages, advicePhase }) {
  return `${buildGolfPrompt({ profile, clubs, shotDetails, messages, advicePhase })}

---

STRUCTURED OUTPUT (return JSON only):
{
  "reply": "your spoken caddie response for this turn",
  "shotDetails": ${SHOT_DETAILS_SCHEMA_DESCRIPTION}
}

Rules for shotDetails:
- Merge with STRUCTURED SHOT DETAILS above — preserve known values unless the latest golfer message changes them.
- If the latest golfer message corrects or contradicts an earlier value, OVERWRITE the old value with the correction. Do not keep a contradicted value. In particular, update shotType and lie when the golfer clarifies where the ball is.
- Use null for unknown values. Do not guess.
- shotType: one of "Tee shot", "Approach", "Recovery", "Chip", "Pitch", "Bunker", or null. Only use "Bunker" when the ball is in the sand — a bunker the golfer must carry or avoid is a hazard (set danger/dangerSide), not the shot type. If they are on the tee / tee box / teed up, shotType is "Tee shot" and lie must be "teed up" — never ask for lie.
- ballLocation: slope or foot position only — e.g. "upslope", "downslope", "ball above feet", "ball below feet", "flat", or null.
- danger: hazard type, or "none" if the golfer clearly said there is no trouble in play — including wording like "no obstructions", "no obstacles", "nothing in the way", or "clear path". A bunker ahead/short of the target belongs here.
- dangerSide: where the hazard sits, or "none in play" when there is no hazard.
- chipGreenRatio: for chip shots — rough split of fairway/rough vs green, or null.
- notes: brief summary of relevant context from the latest message, or null.

Rules for reply:
- Follow the DECISION GATE above for whether to ask questions or give advice.
- reply must be natural spoken English only — no JSON, headings, or bullet points inside reply.${profile?.sassMode ? '\n- ROAST MODE: the reply MUST sound sassy and judgemental — include at least one cheeky jab, backhanded compliment, or mock-exasperated line. Do not write a plain professional caddie reply.' : ''}`
}

export function parseCaddieResponseJson(text, previousDetails = null, messages = []) {
  try {
    const parsed = JSON.parse(text)
    const reply = typeof parsed.reply === 'string' ? parsed.reply.trim() : ''
    const shotDetails = mergeShotDetails(
      previousDetails ?? emptyShotDetails(),
      parsed.shotDetails ?? parsed
    )
    return {
      reply,
      shotDetails: applyUserMessageInferences(shotDetails, messages),
    }
  } catch {
    return {
      reply: typeof text === 'string' ? text.trim() : '',
      shotDetails: applyUserMessageInferences(
        previousDetails ?? emptyShotDetails(),
        messages
      ),
    }
  }
}

export function buildExtractionSystemPrompt() {
  return `You extract structured golf shot details from a UK golfer's voice transcript.

RULES:
- Return JSON only matching the schema exactly.
- Use null for unknown values. Do not guess.
- Only set a field when the golfer clearly stated it in the latest message or conversation.
- Preserve previously known details unless the newest user message explicitly changes or contradicts them.
- notes: brief summary of relevant context from the latest message, or null.
- units: "yards" or "metres" only when distance is known.
- shotType: one of "Tee shot", "Approach", "Recovery", "Chip", "Pitch", "Bunker", or null.
- ballLocation: slope or foot position only — e.g. "upslope", "downslope", "ball above feet", "ball below feet", "flat", or null. Do not put grass lie here.
- danger: hazard type, or "none" if the golfer clearly said there is no trouble in play — including "no obstructions", "no obstacles", "nothing in the way", or "clear path".
- dangerSide: where the hazard is relative to target or player, or "none in play" when there is no hazard.
- chipGreenRatio: for chip shots only — rough split of fairway/rough vs green, e.g. "mostly green", "half fairway half green", "lots of green to work with", or null.

Schema:
${SHOT_DETAILS_SCHEMA_DESCRIPTION}`
}

export function buildExtractionUserInput({ messages, previousDetails }) {
  const conversation = messages
    .map((m) => `${m.role === 'assistant' ? 'CaddieAI' : 'Golfer'}: ${m.text}`)
    .join('\n')

  return `Previous structured details:
${JSON.stringify(previousDetails ?? EMPTY_SHOT_DETAILS, null, 2)}

Conversation:
${conversation}

Update structured details based on the latest golfer message. Return JSON only.`
}

export function buildCaddieConversationInput(messages) {
  return messages.map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.text,
  }))
}

export function emptyShotDetails() {
  return { ...EMPTY_SHOT_DETAILS }
}

export function mergeShotDetails(previous, extracted) {
  const base = { ...EMPTY_SHOT_DETAILS, ...previous }
  if (!extracted || typeof extracted !== 'object') return base

  for (const key of Object.keys(EMPTY_SHOT_DETAILS)) {
    const value = extracted[key]
    if (value !== null && value !== undefined && value !== '') {
      base[key] = value
    }
  }

  return base
}
