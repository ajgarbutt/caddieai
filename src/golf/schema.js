/** @typedef {'handicap' | 'raw'} SgMode */
/** @typedef {'in_progress' | 'complete'} RoundStatus */
/** @typedef {'TEE' | 'FAIRWAY' | 'ROUGH' | 'SAND' | 'RECOVERY' | 'PUTTS' | 'PENALTY'} ShotType */
/** @typedef {'replay' | 'drop'} PenaltyKind */
/** @typedef {3 | 4 | 5} HolePar */

/**
 * @typedef {Object} Course
 * @property {string} id
 * @property {string} userId
 * @property {string} name
 * @property {string} teeName
 * @property {number} courseRating
 * @property {number} slopeRating
 * @property {string | null} deletedAt
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} CourseHole
 * @property {string} id
 * @property {string} courseId
 * @property {number} holeNumber
 * @property {HolePar} par
 * @property {number} yards
 */

/**
 * A snapshot of one hole at the time a round was started.
 * @typedef {Object} RoundHole
 * @property {number} holeNumber
 * @property {HolePar} par
 * @property {number} yards
 * @property {boolean} holedOut
 */

/**
 * @typedef {Object} Round
 * @property {string} id
 * @property {string} userId
 * @property {string} courseId
 * @property {string} playedAt
 * @property {boolean} nineHoles
 * @property {RoundStatus} status
 * @property {boolean} includeInAnalysis
 * @property {string | null} notes
 * @property {number | null} handicapScoreOverride
 * @property {number} courseRating
 * @property {number} slopeRating
 * @property {RoundHole[]} holes
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * A scored shot. `currentShot` in the caddie is a different record.
 * Distance is yards, except PUTTS (feet). PENALTY distance is null.
 * @typedef {Object} GolfShot
 * @property {string} id
 * @property {string} roundId
 * @property {number} holeNumber
 * @property {number} seq
 * @property {ShotType} type
 * @property {number | null} distance
 * @property {number} penaltyStrokes
 * @property {PenaltyKind | null} penaltyKind
 */

/**
 * @typedef {Object} GolfStore
 * @property {string} userId
 * @property {Course[]} courses
 * @property {CourseHole[]} courseHoles
 * @property {Round[]} rounds
 * @property {GolfShot[]} golfShots
 */

export const GOLF_SCHEMA_VERSION = 1

export const DEFAULT_REFERENCE_HANDICAP = 18
export const DEFAULT_SG_MODE = 'handicap'

export const SHOT_TYPES = [
  'TEE',
  'FAIRWAY',
  'ROUGH',
  'SAND',
  'RECOVERY',
  'PUTTS',
  'PENALTY',
]

export const PENALTY_KINDS = ['replay', 'drop']

export const SG_MODES = ['handicap', 'raw']
export const ROUND_STATUSES = ['in_progress', 'complete']

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

export class GolfDataError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message)
    this.name = 'GolfDataError'
  }
}

/** @param {unknown} value */
function asNumber(value) {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.trim() !== '') return Number(value.trim())
  return Number.NaN
}

/** @param {unknown} value */
export function parseReferenceHandicap(value) {
  let signed = Number.NaN
  if (typeof value === 'string') {
    const trimmed = value.trim()
    const plus = trimmed.startsWith('+')
    const numeric = Number(plus ? trimmed.slice(1).trim() : trimmed)
    if (Number.isFinite(numeric)) signed = plus ? -Math.abs(numeric) : numeric
  } else if (typeof value === 'number' && Number.isFinite(value)) {
    signed = value
  }

  const rounded = Math.round(signed * 10) / 10
  if (!Number.isFinite(rounded) || rounded < -10 || rounded > 54) {
    throw new GolfDataError('Reference handicap must be a number from +10 to 54.')
  }
  return rounded
}

/** @param {unknown} value */
export function readReferenceHandicap(value) {
  if (value == null || value === '') return DEFAULT_REFERENCE_HANDICAP
  try {
    return parseReferenceHandicap(value)
  } catch {
    return DEFAULT_REFERENCE_HANDICAP
  }
}

/** @param {unknown} value */
export function parseSgMode(value) {
  if (value === 'handicap' || value === 'raw') return value
  throw new GolfDataError('Strokes-gained mode must be "handicap" or "raw".')
}

/** @param {unknown} value */
export function readSgMode(value) {
  return value === 'raw' || value === 'handicap' ? value : DEFAULT_SG_MODE
}

/**
 * @param {Object} profile
 * @param {Object} [updates]
 */
export function withGolfProfile(profile, updates = {}) {
  const next = { ...profile }
  if (Object.prototype.hasOwnProperty.call(updates, 'referenceHandicap')) {
    next.referenceHandicap = parseReferenceHandicap(updates.referenceHandicap)
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'sgMode')) {
    next.sgMode = parseSgMode(updates.sgMode)
  }
  return next
}

/** @param {unknown} value @param {string} label */
function parseName(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new GolfDataError(`${label} is required.`)
  }
  return value.trim()
}

/** @param {unknown} value */
export function parseCourseRating(value) {
  const rating = asNumber(value)
  const rounded = Math.round(rating * 10) / 10
  if (!Number.isFinite(rounded) || rounded <= 0 || rounded > 100) {
    throw new GolfDataError('Course rating must be a number like 70.1.')
  }
  return rounded
}

/** Course-builder rating: one decimal place, from 50.0 to 85.0. */
export function parseBuilderCourseRating(value) {
  const rating = parseCourseRating(value)
  if (rating < 50 || rating > 85) {
    throw new GolfDataError('Course rating must be from 50.0 to 85.0.')
  }
  return rating
}

/** Course-builder hole length. */
export function parseBuilderYards(value) {
  const yards = parseYards(value)
  if (yards < 50 || yards > 700) {
    throw new GolfDataError('Each hole must be a whole number of yards from 50 to 700.')
  }
  return yards
}

/** @param {unknown} value */
export function parseSlope(value) {
  const slope = asNumber(value)
  if (!Number.isInteger(slope) || slope < 55 || slope > 155) {
    throw new GolfDataError('Slope rating must be a whole number from 55 to 155.')
  }
  return slope
}

/** @param {unknown} value */
export function parseHoleNumber(value) {
  const holeNumber = asNumber(value)
  if (!Number.isInteger(holeNumber) || holeNumber < 1 || holeNumber > 18) {
    throw new GolfDataError('Hole number must be a whole number from 1 to 18.')
  }
  return holeNumber
}

/** @param {unknown} value */
export function parsePar(value) {
  const par = asNumber(value)
  if (par !== 3 && par !== 4 && par !== 5) {
    throw new GolfDataError('Par must be 3, 4, or 5.')
  }
  return /** @type {HolePar} */ (par)
}

/** @param {unknown} value */
export function parseYards(value) {
  const yards = asNumber(value)
  if (!Number.isInteger(yards) || yards < 1 || yards > 800) {
    throw new GolfDataError('Hole length must be a whole number of yards from 1 to 800.')
  }
  return yards
}

/** @param {unknown} value */
function parseSeq(value) {
  const seq = asNumber(value)
  if (!Number.isInteger(seq) || seq < 1) {
    throw new GolfDataError('Shot sequence must start at 1.')
  }
  return seq
}

/** @param {unknown} value */
export function parseShotType(value) {
  if (typeof value === 'string' && SHOT_TYPES.includes(value)) {
    return /** @type {ShotType} */ (value)
  }
  throw new GolfDataError(
    'Shot type must be TEE, FAIRWAY, ROUGH, SAND, RECOVERY, PUTTS, or PENALTY.'
  )
}

/** @param {unknown} value */
function parseDistance(value) {
  const distance = asNumber(value)
  const rounded = Math.round(distance * 100) / 100
  if (!Number.isFinite(rounded) || rounded <= 0) {
    throw new GolfDataError('Distance must be greater than 0.')
  }
  return rounded
}

/** @param {unknown} value */
function parsePenaltyDistance(value) {
  if (value == null || value === '') return null
  throw new GolfDataError('A penalty entry does not have a distance.')
}

/** @param {unknown} value */
function parsePenaltyStrokes(value) {
  const strokes = asNumber(value)
  if (strokes !== 1 && strokes !== 2) {
    throw new GolfDataError('Penalty strokes must be 1 or 2.')
  }
  return strokes
}

/** @param {unknown} value */
function parseNonPenaltyStrokes(value) {
  if (value == null || value === '' || value === 0) return 0
  throw new GolfDataError('Penalty strokes are only set on a PENALTY entry.')
}

/**
 * @param {unknown} value
 * @param {boolean} isPenalty
 * @param {number} penaltyStrokes
 * @returns {import('./schema.js').PenaltyKind | null}
 */
function parsePenaltyKind(value, isPenalty, penaltyStrokes) {
  if (!isPenalty) {
    if (value == null || value === '') return null
    throw new GolfDataError('Penalty kind is only set on a PENALTY entry.')
  }
  if (value === 'replay' || value === 'drop') return value
  if (value == null || value === '') return penaltyStrokes === 2 ? 'replay' : 'drop'
  throw new GolfDataError('Penalty kind must be "replay" or "drop".')
}

/** @param {unknown} value @param {string} label */
function parseBoolean(value, label) {
  if (typeof value !== 'boolean') {
    throw new GolfDataError(`${label} must be true or false.`)
  }
  return value
}

/** @param {unknown} value */
export function parsePlayedAt(value) {
  if (typeof value !== 'string') {
    throw new GolfDataError('Played date must be YYYY-MM-DD.')
  }
  const match = DATE_ONLY.exec(value)
  if (!match) throw new GolfDataError('Played date must be YYYY-MM-DD.')
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new GolfDataError('Played date must be a real calendar date.')
  }
  return value
}

/** @param {unknown} value */
function parseStatus(value) {
  if (value === 'in_progress' || value === 'complete') return value
  throw new GolfDataError('Round status must be "in_progress" or "complete".')
}

/** @param {unknown} value */
function parseNotes(value) {
  if (value == null || value === '') return null
  if (typeof value !== 'string') throw new GolfDataError('Notes must be text.')
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/** @param {unknown} value */
function parseScoreOverride(value) {
  if (value == null || value === '') return null
  const score = asNumber(value)
  if (!Number.isInteger(score)) {
    throw new GolfDataError('Handicap score override must be a whole number.')
  }
  return score
}

/** @param {unknown} value */
function requireId(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new GolfDataError('A record id is required.')
  }
  return value.trim()
}

/** @param {unknown} value @param {string} [fallback] */
function readTimestamp(value, fallback = new Date().toISOString()) {
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) return value
  return fallback
}

/** @param {unknown} value */
function readDeletedAt(value) {
  if (value == null || value === '') return null
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) return value
  return null
}

/**
 * @param {Object<string, unknown>} updates
 * @param {Set<string>} allowed
 */
export function assertPatch(updates, allowed) {
  if (!updates || typeof updates !== 'object') {
    throw new GolfDataError('Update must be an object.')
  }
  for (const key of Object.keys(updates)) {
    if (!allowed.has(key)) throw new GolfDataError(`Cannot update "${key}".`)
  }
}

/**
 * @param {string} userId
 * @param {Object} raw
 * @returns {Course}
 */
export function toCourse(userId, raw) {
  const now = new Date().toISOString()
  return {
    id: requireId(raw.id),
    userId,
    name: parseName(raw.name, 'Course name'),
    teeName: typeof raw.teeName === 'string' ? raw.teeName.trim() : '',
    courseRating: parseCourseRating(raw.courseRating),
    slopeRating: parseSlope(raw.slopeRating),
    deletedAt: readDeletedAt(raw.deletedAt),
    createdAt: readTimestamp(raw.createdAt, now),
    updatedAt: readTimestamp(raw.updatedAt, now),
  }
}

/**
 * @param {Object} raw
 * @returns {CourseHole}
 */
export function toCourseHole(raw) {
  return {
    id: requireId(raw.id),
    courseId: requireId(raw.courseId),
    holeNumber: parseHoleNumber(raw.holeNumber),
    par: parsePar(raw.par),
    yards: parseYards(raw.yards),
  }
}

/**
 * @param {Object} raw
 * @returns {RoundHole}
 */
export function toRoundHole(raw) {
  return {
    holeNumber: parseHoleNumber(raw.holeNumber),
    par: parsePar(raw.par),
    yards: parseYards(raw.yards),
    holedOut: raw.holedOut == null ? false : parseBoolean(raw.holedOut, 'holedOut'),
  }
}

/** @param {unknown} value */
export function parseRoundHoles(value) {
  if (!Array.isArray(value)) throw new GolfDataError('Round holes must be a list.')
  /** @type {RoundHole[]} */
  const holes = []
  for (const raw of value) {
    const hole = toRoundHole(raw)
    if (holes.some((item) => item.holeNumber === hole.holeNumber)) {
      throw new GolfDataError(`Hole ${hole.holeNumber} is duplicated on this round.`)
    }
    holes.push(hole)
  }
  return holes.sort((a, b) => a.holeNumber - b.holeNumber)
}

/**
 * @param {string} userId
 * @param {Object} raw
 * @returns {Round}
 */
export function toRound(userId, raw) {
  const now = new Date().toISOString()
  return {
    id: requireId(raw.id),
    userId,
    courseId: requireId(raw.courseId),
    playedAt: parsePlayedAt(raw.playedAt),
    nineHoles: raw.nineHoles == null ? false : parseBoolean(raw.nineHoles, 'nineHoles'),
    status: raw.status == null ? 'in_progress' : parseStatus(raw.status),
    includeInAnalysis:
      raw.includeInAnalysis == null
        ? true
        : parseBoolean(raw.includeInAnalysis, 'includeInAnalysis'),
    notes: parseNotes(raw.notes),
    handicapScoreOverride: parseScoreOverride(raw.handicapScoreOverride),
    courseRating: parseCourseRating(raw.courseRating),
    slopeRating: parseSlope(raw.slopeRating),
    holes: parseRoundHoles(raw.holes),
    createdAt: readTimestamp(raw.createdAt, now),
    updatedAt: readTimestamp(raw.updatedAt, now),
  }
}

/**
 * @param {Object} raw
 * @returns {GolfShot}
 */
export function toShot(raw) {
  const type = parseShotType(raw.type)
  const penalty = type === 'PENALTY'
  const penaltyStrokes = penalty
    ? parsePenaltyStrokes(raw.penaltyStrokes)
    : parseNonPenaltyStrokes(raw.penaltyStrokes)
  return {
    id: requireId(raw.id),
    roundId: requireId(raw.roundId),
    holeNumber: parseHoleNumber(raw.holeNumber),
    seq: parseSeq(raw.seq),
    type,
    distance: penalty ? parsePenaltyDistance(raw.distance) : parseDistance(raw.distance),
    penaltyStrokes,
    penaltyKind: parsePenaltyKind(raw.penaltyKind, penalty, penaltyStrokes),
  }
}
