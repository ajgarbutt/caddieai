import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ADVICE_DIR = join(__dirname, '../data/shot-advice')
const REFERENCES_DIR = join(ADVICE_DIR, 'references')

const SHOT_TYPE_FILES = {
  'Tee shot': ['tee-shots.md'],
  Approach: ['approach-shots.md'],
  Recovery: ['recovery-shots.md'],
  Chip: ['chip-shots.md'],
  Pitch: ['pitch-shots.md'],
  Bunker: ['bunker-shots.md'],
}

// Bunker only when the BALL is in the sand — a bunker mentioned as a hazard
// ahead ("bunker 20 yards in front") is danger, not the shot type.
const INFERENCE_PATTERNS = [
  {
    type: 'Bunker',
    pattern:
      /\b(in (?:a|the) (?:greenside |fairway )?bunker|in (?:a|the) trap|in the sand|bunkered|plugged|fried egg|sand shot|bunker shot|splash shot)\b/i,
  },
  { type: 'Chip', pattern: /\b(chip|chipping|bump and run|around the green|greenside)\b/i },
  { type: 'Pitch', pattern: /\b(pitch|pitching)\b/i },
  { type: 'Recovery', pattern: /\b(recovery|punch|trees|blocked|lay up|layup)\b/i },
  { type: 'Tee shot', pattern: /\b(tee shot|off the tee|on the tee|from the tee|tee box|teeing (ground|area)|teed up|par 3 tee)\b/i },
  { type: 'Approach', pattern: /\b(approach|into the green|to the pin|to the green)\b/i },
]

// Phrases in the latest message that clearly contradict a stored shot type,
// so a stale inference (e.g. Bunker) can be corrected rather than persisting.
const SHOT_TYPE_CONTRADICTIONS = {
  Bunker:
    /\b(not in (?:a|the) bunker|not in the sand|on the fairway|in the fairway|on the grass|on the short stuff|out of the bunker now)\b/i,
}

export function messageContradictsShotType(text, shotType) {
  if (!text || !shotType) return false
  const pattern = SHOT_TYPE_CONTRADICTIONS[shotType]
  return pattern ? pattern.test(text) : false
}

let skillCache = null
const referenceCache = new Map()

function readAdviceFile(relativePath) {
  if (referenceCache.has(relativePath)) {
    return referenceCache.get(relativePath)
  }
  const content = readFileSync(join(ADVICE_DIR, relativePath), 'utf8').trim()
  referenceCache.set(relativePath, content)
  return content
}

function readReferenceFile(filename) {
  if (referenceCache.has(filename)) {
    return referenceCache.get(filename)
  }
  const content = readFileSync(join(REFERENCES_DIR, filename), 'utf8').trim()
  referenceCache.set(filename, content)
  return content
}

function stripSkillFrontmatter(content) {
  if (content.startsWith('---')) {
    const end = content.indexOf('---', 3)
    if (end !== -1) return content.slice(end + 3).trim()
  }
  return content
}

export function getCoreCaddiePhilosophy() {
  if (!skillCache) {
    skillCache = stripSkillFrontmatter(readAdviceFile('SKILL.md'))
  }
  return skillCache
}

export function getClubYardagePrinciples() {
  const full = readReferenceFile('club-yardages.md')
  const marker = '## Applying adjustments'
  const markerIndex = full.indexOf(marker)
  const principles = full.slice(markerIndex >= 0 ? markerIndex : 0)

  return `CLUB DISTANCE PRINCIPLES (use ONLY the player's saved bag distances below — never generic stock yardages):

${principles}

IMPORTANT: Ignore any example carry distances elsewhere in the shot library. The PLAYER BAG section is the only source of truth for club selection.

SHORT-SHOT CHECK: If target < shortest PLAYER BAG stock carry → default to that shortest club and scale the swing (¾ / half / chip). Exceptions: hardpan → 9i/8i gentle stroke (bounce); windy 30–80y → lower loft + shorter swing for lower flight. Never three-quarter a 135y PW at a 30y target.`
}

const SHOT_FACTORS_BY_TYPE = {
  'Tee shot': ['lie', 'wind', 'hazards', 'tee'],
  Approach: ['lie', 'wind', 'hazards', 'approach'],
  Recovery: ['lie', 'wind', 'hazards'],
  Chip: ['lie', 'chip'],
  Pitch: ['lie', 'wind', 'chip'],
  Bunker: ['lie', 'wind', 'hazards'],
}

function extractShotFactorsSections(shotType) {
  const full = readReferenceFile('shot-factors.md')
  const keys = SHOT_FACTORS_BY_TYPE[shotType] ?? ['lie', 'wind', 'hazards']
  const sections = []

  const sectionMarkers = [
    { key: 'lie', marker: '## Lie' },
    { key: 'wind', marker: '## Wind' },
    { key: 'hazards', marker: '## Hazards' },
    { key: 'tee', marker: '## Tee shots' },
    { key: 'approach', marker: '## Approach shot target selection' },
    { key: 'chip', marker: '## Chipping and pitching' },
  ]

  for (const { key, marker } of sectionMarkers) {
    if (!keys.includes(key)) continue
    const start = full.indexOf(marker)
    if (start === -1) continue
    const rest = full.slice(start + marker.length)
    const nextHeading = rest.search(/\n## /)
    const content = nextHeading === -1 ? rest : rest.slice(0, nextHeading)
    sections.push(`${marker}${content}`.trim())
  }

  return sections.length > 0 ? sections.join('\n\n---\n\n') : full.slice(0, 2000)
}

export function getBallLocationRules() {
  return readReferenceFile('ball-location.md')
}

function inferShotTypeFromText(text) {
  if (!text) return null
  for (const { type, pattern } of INFERENCE_PATTERNS) {
    if (pattern.test(text)) return type
  }
  return null
}

export function resolveShotType(shotDetails, messages) {
  const explicit = shotDetails?.shotType
  const latestUser = [...(messages ?? [])].reverse().find((m) => m.role === 'user')
  const latestText = latestUser?.text ?? ''

  // Trust a stored shot type unless the latest message contradicts it.
  if (
    explicit &&
    SHOT_TYPE_FILES[explicit] &&
    !messageContradictsShotType(latestText, explicit)
  ) {
    return explicit
  }

  const inferred = inferShotTypeFromText(latestText)
  if (inferred) return inferred

  if (typeof shotDetails?.distance === 'number') {
    if (shotDetails.distance <= 30) return 'Chip'
    if (shotDetails.distance <= 100) return 'Pitch'
  }

  return 'Approach'
}

export function selectShotAdviceReferences(shotDetails, messages) {
  const shotType = resolveShotType(shotDetails, messages)
  const files = SHOT_TYPE_FILES[shotType] ?? ['approach-shots.md']

  return {
    shotType,
    files: Array.from(files),
  }
}

export function loadShotAdviceContext(shotDetails, messages, shotTypeOverride = null) {
  const shotType = shotTypeOverride ?? resolveShotType(shotDetails, messages)
  const { files } = selectShotAdviceReferences(shotDetails, messages)

  const sections = [
    `ACTIVE SHOT TYPE: ${shotType}`,
    getClubYardagePrinciples(),
    `## shot-factors (relevant sections)\n\n${extractShotFactorsSections(shotType)}`,
    ...files.map((file) => `## ${file}\n\n${readReferenceFile(file)}`),
  ]

  return sections.join('\n\n---\n\n')
}

export const SHOT_TYPES = Object.keys(SHOT_TYPE_FILES)
