import { readGolfCollections } from '../golf/migrate.js'
import {
  DEFAULT_REFERENCE_HANDICAP,
  DEFAULT_SG_MODE,
  GOLF_SCHEMA_VERSION,
  readReferenceHandicap,
  readSgMode,
} from '../golf/schema.js'
import { createEmptyShotDetails } from './shot.js'

const STORAGE_KEY = 'caddieai'
const GUEST_FLAG = 'caddieai-guest'
const GUEST_ID_KEY = 'caddieai-guest-id'

const defaultProfile = {
  name: '',
  handicap: null,
  units: 'yards',
  sassMode: false,
  onboardingComplete: false,
  referenceHandicap: DEFAULT_REFERENCE_HANDICAP,
  sgMode: DEFAULT_SG_MODE,
}

const defaultVoiceSettings = {
  autoReadResponses: true,
}

export function createEmptyStore(userId = crypto.randomUUID()) {
  return {
    schemaVersion: GOLF_SCHEMA_VERSION,
    userId,
    clubs: [],
    profile: { ...defaultProfile },
    currentShot: null,
    sgChat: emptySgChat(),
    feedback: [],
    voiceSettings: { ...defaultVoiceSettings },
    courses: [],
    courseHoles: [],
    rounds: [],
    golfShots: [],
  }
}

export const defaultData = createEmptyStore()

function emptySgChat() {
  return { messages: [], scope: null }
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) return []
  return messages.slice(-40).flatMap((message) => {
    if (!message || typeof message !== 'object') return []
    const text = typeof message.text === 'string' ? message.text : ''
    if (!text.trim()) return []
    return [
      {
        role: message.role === 'assistant' ? 'assistant' : 'user',
        text,
        createdAt:
          typeof message.createdAt === 'string' ? message.createdAt : new Date().toISOString(),
      },
    ]
  })
}

function normalizeSgScope(scope) {
  if (scope === 'career') return 'career'
  if (typeof scope === 'string' && scope.trim() && scope.length <= 80) return scope.trim()
  return null
}

function normalizeSgChat(chat) {
  if (!chat || typeof chat !== 'object') return emptySgChat()
  return { messages: normalizeMessages(chat.messages), scope: normalizeSgScope(chat.scope) }
}

function normalizeCurrentShot(shot, units = 'yards') {
  if (!shot || typeof shot !== 'object') return null

  if (Array.isArray(shot.messages) && shot.id && shot.details) {
    return {
      id: shot.id,
      createdAt: shot.createdAt ?? new Date().toISOString(),
      details: { ...createEmptyShotDetails(units), ...shot.details },
      messages: shot.messages.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        text: m.text ?? '',
        createdAt: m.createdAt ?? new Date().toISOString(),
      })),
    }
  }

  return null
}

function normalizeClubUnit(unit) {
  if (unit === 'm' || unit === 'metres') return 'metres'
  if (unit === 'yds' || unit === 'yards') return 'yards'
  return 'yards'
}

function normalizeClubs(clubs) {
  if (!Array.isArray(clubs)) return []
  return clubs.map((club) => {
    const rawDistance = club.distance
    let distance = null
    if (typeof rawDistance === 'number' && rawDistance > 0) {
      distance = rawDistance
    } else if (typeof rawDistance === 'string' && rawDistance.trim() !== '') {
      const parsed = Number(rawDistance)
      if (Number.isFinite(parsed) && parsed > 0) distance = parsed
    }

    return {
      ...club,
      unit: normalizeClubUnit(club.unit),
      distance,
    }
  })
}

function normalizeProfile(profile) {
  const merged = {
    ...defaultProfile,
    ...(profile && typeof profile === 'object' ? profile : {}),
  }
  merged.referenceHandicap = readReferenceHandicap(merged.referenceHandicap)
  merged.sgMode = readSgMode(merged.sgMode)
  return merged
}

function validUserId(userId) {
  return typeof userId === 'string' && userId.trim() !== ''
}

export function normalizeStoredDocument(parsed, userId) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return createEmptyStore(userId)
  }

  const resolvedUserId = validUserId(userId)
    ? userId
    : validUserId(parsed.userId)
      ? parsed.userId
      : crypto.randomUUID()
  const profile = normalizeProfile(parsed.profile)
  const golf = readGolfCollections(parsed, resolvedUserId)

  return {
    schemaVersion: GOLF_SCHEMA_VERSION,
    userId: resolvedUserId,
    clubs: normalizeClubs(parsed.clubs),
    profile,
    currentShot: normalizeCurrentShot(parsed.currentShot, profile.units ?? 'yards'),
    sgChat: normalizeSgChat(parsed.sgChat),
    feedback: Array.isArray(parsed.feedback) ? parsed.feedback : [],
    voiceSettings: { ...defaultVoiceSettings, ...parsed.voiceSettings },
    courses: golf.courses,
    courseHoles: golf.courseHoles,
    rounds: golf.rounds,
    golfShots: golf.golfShots,
  }
}

export function readLegacyStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

export function getStoredData() {
  try {
    const legacy = readLegacyStore()
    if (!legacy) return createEmptyStore()
    return normalizeStoredDocument(legacy)
  } catch {
    return createEmptyStore()
  }
}

export function saveStoredData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    return true
  } catch {
    return false
  }
}

export function clearStoredData() {
  try {
    localStorage.removeItem(STORAGE_KEY)
    return true
  } catch {
    return false
  }
}

export function isGuestMode() {
  try {
    return localStorage.getItem(GUEST_FLAG) === '1'
  } catch {
    return false
  }
}

export function enableGuestMode() {
  try {
    localStorage.setItem(GUEST_FLAG, '1')
    return true
  } catch {
    return false
  }
}

export function disableGuestMode() {
  try {
    localStorage.removeItem(GUEST_FLAG)
    return true
  } catch {
    return false
  }
}

export function guestUserId() {
  try {
    const legacy = readLegacyStore()
    const storedId = legacy && typeof legacy.userId === 'string' ? legacy.userId.trim() : ''
    if (storedId) {
      localStorage.setItem(GUEST_ID_KEY, storedId)
      return storedId
    }
    const existing = localStorage.getItem(GUEST_ID_KEY)
    if (existing && existing.trim()) return existing.trim()
    const id = crypto.randomUUID()
    localStorage.setItem(GUEST_ID_KEY, id)
    return id
  } catch {
    return crypto.randomUUID()
  }
}
